import { checkAuthSession, confirmOneTimePaymentApi, confirmSubscriptionPaymentApi, createOneTimePaymentIntentApi, createSubscriptionIntentApi, currentUser, hasSubscriptionFeature, updateUserSubscriptionTier } from '../services/api.service.js';
import { getCurrentLanguage, t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { getStripeAppearance, loadStripeSdk } from '../services/stripe.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { setActiveTeamId } from '../services/workspace.service.js';
import { ViewController } from '../types/common.types.js';
import { applyAvatarTier, getTierDisplayName, normalizeTier } from '../utils/tier.util.js';

class CheckoutController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentIntent: any = null;
  private currentMode: 'recurring' | 'one_time' = 'recurring';
  private currentPlan: 'pro' | 'business' = 'pro';
  private currentStep: 1 | 2 = 1;
  private elements: any = null;
  private flowMode: 'create-team' | 'standard' = 'standard';
  private initialQuery?: URLSearchParams;
  private isCardSelected = false;
  private isInitializingGateway = false;
  private isSubmitting = false;
  private oneTimeDuration: '1_month' | '12_months' = '1_month';
  private paymentElement: any = null;
  private recurringCycle: 'monthly' | 'yearly' = 'monthly';
  private stripe: any = null;
  private teamId: number | null = null;
  private teamName = '';
  private teamSeats = 1;

  constructor(container: HTMLElement, initialQuery?: URLSearchParams) {
    this.container = container;
    this.initialQuery = initialQuery;
  }

  async init(): Promise<void> {
    if (!currentUser) {
      showToast(t('upgrade.login_required', t('ui.inicia_sesion_para_seleccionar_un_plan')), 'info');
      navigate('/login');
      return;
    }

    this.abortController = new AbortController();

    const params = this.initialQuery || new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    const flowParam = params.get('flow');
    this.flowMode = flowParam === 'create-team' ? 'create-team' : 'standard';

    if (planParam === 'business' || this.flowMode === 'create-team') {
      this.currentPlan = 'business';
    } else {
      this.currentPlan = 'pro';
    }

    const rawTeamId = Number(params.get('teamId') || 0);
    this.teamId = Number.isInteger(rawTeamId) && rawTeamId > 0 ? rawTeamId : null;
    this.teamName = (params.get('teamName') || '').trim();
    const rawSeats = Number(params.get('seats') || 0);
    if (Number.isInteger(rawSeats) && rawSeats >= 1) {
      this.teamSeats = Math.min(50, rawSeats);
    } else {
      this.teamSeats = this.flowMode === 'create-team' ? 2 : 1;
    }

    const hasPro = hasSubscriptionFeature('pro');
    const hasBusiness = hasSubscriptionFeature('business');
    const isTeamFlow = this.currentPlan === 'business'
      && (this.flowMode === 'create-team' || this.teamId !== null || this.teamName.length > 0 || this.teamSeats > 1);

    if (this.currentPlan === 'pro' && (hasPro || hasBusiness)) {
      this.renderAlreadyOwnedPlan(normalizeTier(currentUser.subscription_tier), 'pro');
      return;
    }

    if (this.currentPlan === 'business' && hasBusiness && !isTeamFlow) {
      this.flowMode = 'create-team';
    }

    const cycleParam = params.get('cycle');
    if (cycleParam === 'yearly') {
      this.recurringCycle = 'yearly';
      this.oneTimeDuration = '12_months';
    } else {
      this.recurringCycle = 'monthly';
      this.oneTimeDuration = '1_month';
    }

    const modeParam = params.get('mode');
    if (modeParam === 'one_time') {
      this.currentMode = 'one_time';
    } else {
      this.currentMode = 'recurring';
    }

    const pill = this.container.querySelector<HTMLElement>('[data-ref="checkout-mode-toggle"]');
    if (pill) {
      pill.setAttribute('data-cycle', this.currentMode);
    }

    const btnRecurring = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-mode-recurring"]');
    const btnOneTime = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-mode-one-time"]');
    if (btnRecurring && btnOneTime) {
      if (this.currentMode === 'recurring') {
        btnRecurring.classList.add('is-active', 'active');
        btnOneTime.classList.remove('is-active', 'active');
      } else {
        btnOneTime.classList.add('is-active', 'active');
        btnRecurring.classList.remove('is-active', 'active');
      }
    }

    const teamConfigBox = this.container.querySelector<HTMLElement>('[data-ref="checkout-team-config"]');
    const step1Title = this.container.querySelector<HTMLElement>('[data-ref="checkout-step1-title"]');
    const teamNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-checkout-team-name"]');
    const seatsInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-checkout-seats"]');

    if (this.currentPlan === 'business') {
      teamConfigBox?.classList.remove('is-hidden');
      if (step1Title) {
        step1Title.textContent = this.flowMode === 'create-team'
          ? t('checkout.step1_title_team')
          : t('checkout.step1_title');
      }
      if (teamNameInput && this.teamName) {
        teamNameInput.value = this.teamName;
      }
      if (seatsInput) {
        seatsInput.value = String(this.teamSeats);
      }
    } else {
      teamConfigBox?.classList.add('is-hidden');
      if (step1Title) step1Title.textContent = t('checkout.step1_title');
    }

    this.bindEvents();
    this.updatePlanView();
    this.goToStep(1);
    renderIcons(this.container);
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.paymentElement) {
      try {
        this.paymentElement.destroy();
      } catch {}
      this.paymentElement = null;
    }
  }

  private renderAlreadyOwnedPlan(userTier: string, targetTier: string): void {
    const isExactSame = userTier === targetTier;
    const activeBlock = this.container.querySelector<HTMLElement>('[data-ref="checkout-already-active"]');
    const step1El = this.container.querySelector<HTMLElement>('[data-ref="checkout-step-1"]');
    const step2El = this.container.querySelector<HTMLElement>('[data-ref="checkout-step-2"]');
    const btnNext = this.container.querySelector<HTMLElement>('[data-ref="btn-checkout-next"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="checkout-active-title"]');
    const descEl = this.container.querySelector<HTMLElement>('[data-ref="checkout-active-desc"]');
    const summaryPriceRow = this.container.querySelector<HTMLElement>('.checkout-summary-price-row');
    const summaryTermsNote = this.container.querySelector<HTMLElement>('[data-ref="checkout-terms-note"]');
    const feat1El = this.container.querySelector<HTMLElement>('[data-ref="summary-feat-1"]');
    const feat2El = this.container.querySelector<HTMLElement>('[data-ref="summary-feat-2"]');
    const planIconEl = this.container.querySelector<HTMLElement>('[data-ref="summary-plan-icon"]');

    if (step1El) step1El.classList.add('is-hidden');
    if (step2El) step2El.classList.add('is-hidden');
    if (btnNext) btnNext.classList.add('is-hidden');
    if (btnSubmit) btnSubmit.classList.add('is-hidden');

    if (activeBlock) {
      activeBlock.classList.remove('is-hidden');
    }

    const planName = targetTier === 'business'
      ? t('checkout.summary_plan_business')
      : t('checkout.summary_plan_pro');
    const currentName = getTierDisplayName(userTier);

    if (planIconEl) {
      const iconName = targetTier === 'business' ? 'business_center' : 'rocket_launch';
      planIconEl.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${iconName}"></use></svg>`;
    }

    if (feat1El) {
      feat1El.textContent = planName;
    }

    if (feat2El) {
      feat2El.textContent = isExactSame
        ? t('checkout.already_active_status')
        : t('ui.plan_superior_activo_en_tu_cuenta').replace('${currentName}', currentName);
    }

    if (titleEl) {
      titleEl.textContent = isExactSame
        ? `Ya cuentas con el plan ${planName}`
        : t('ui.tu_cuenta_ya_cuenta_con_un_plan_superior');
    }

    if (descEl) {
      descEl.textContent = isExactSame
        ? t('ui.tu_cuenta_ya_dispone_de_este_plan_activo')
        : t('ui.actualmente_dispones_del_plan_el_cual_ya');
    }

    if (summaryPriceRow) {
      summaryPriceRow.classList.add('is-hidden');
    }

    if (summaryTermsNote) {
      summaryTermsNote.classList.add('is-hidden');
    }

    const signal = this.abortController?.signal;
    const btnBilling = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-goto-billing"]');
    const btnPricing = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-goto-pricing"]');

    btnBilling?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/settings/billing');
    }, { signal });

    btnPricing?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/pricing');
    }, { signal });

    renderIcons(this.container);
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    const btnRecurring = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-mode-recurring"]');
    btnRecurring?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.currentMode === 'recurring') return;
      this.setBillingMode('recurring');
    }, { signal });

    const btnOneTime = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-mode-one-time"]');
    btnOneTime?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.currentMode === 'one_time') return;
      this.setBillingMode('one_time');
    }, { signal });

    const card1 = this.container.querySelector<HTMLElement>('[data-ref="option-card-1"]');
    card1?.addEventListener('click', () => {
      if (this.currentMode === 'recurring') {
        if (this.recurringCycle === 'monthly') return;
        this.recurringCycle = 'monthly';
      } else {
        if (this.oneTimeDuration === '1_month') return;
        this.oneTimeDuration = '1_month';
      }
      this.updateSelectionCards();
      this.updateSummary();
      this.invalidateGateway();
    }, { signal });

    const card2 = this.container.querySelector<HTMLElement>('[data-ref="option-card-2"]');
    card2?.addEventListener('click', () => {
      if (this.currentMode === 'recurring') {
        if (this.recurringCycle === 'yearly') return;
        this.recurringCycle = 'yearly';
      } else {
        if (this.oneTimeDuration === '12_months') return;
        this.oneTimeDuration = '12_months';
      }
      this.updateSelectionCards();
      this.updateSummary();
      this.invalidateGateway();
    }, { signal });

    const teamNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-checkout-team-name"]');
    teamNameInput?.addEventListener('input', () => {
      this.teamName = teamNameInput.value.trim();
      this.updateSelectionCards();
      this.updateSummary();
      this.invalidateGateway();
    }, { signal });

    const seatsInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-checkout-seats"]');
    const btnSeatsDec = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-checkout-seats-dec"]');
    const btnSeatsInc = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-checkout-seats-inc"]');

    const applySeats = (nextVal: number) => {
      const clamped = Math.max(1, Math.min(50, Math.floor(Number(nextVal) || 1)));
      if (seatsInput) seatsInput.value = String(clamped);
      if (btnSeatsDec) btnSeatsDec.disabled = clamped <= 1;
      if (btnSeatsInc) btnSeatsInc.disabled = clamped >= 50;
      if (clamped === this.teamSeats) return;
      this.teamSeats = clamped;
      this.updateSelectionCards();
      this.updateSummary();
      this.invalidateGateway();
    };

    btnSeatsDec?.addEventListener('click', (e) => {
      e.preventDefault();
      applySeats(this.teamSeats - 1);
    }, { signal });

    btnSeatsInc?.addEventListener('click', (e) => {
      e.preventDefault();
      applySeats(this.teamSeats + 1);
    }, { signal });

    seatsInput?.addEventListener('change', () => {
      applySeats(Number(seatsInput.value));
    }, { signal });

    const btnNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-checkout-next"]');
    btnNext?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.isTeamPurchase() && !this.teamId && this.teamName.trim().length < 2) {
        const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="checkout-error-banner"]');
        if (errorBanner) {
          errorBanner.textContent = t('checkout.team_name_required');
          errorBanner.classList.remove('is-hidden');
        }
        teamNameInput?.focus();
        return;
      }
      const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="checkout-error-banner"]');
      errorBanner?.classList.add('is-hidden');
      this.goToStep(2);
    }, { signal });

    const btnBackTo1 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-back-to-step1"]');
    btnBackTo1?.addEventListener('click', (e) => {
      e.preventDefault();
      this.goToStep(1);
    }, { signal });

    const methodHeader = this.container.querySelector<HTMLElement>('[data-ref="method-card-header"]');
    methodHeader?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleCardPaymentMethod();
    }, { signal });

    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');
    btnSubmit?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.handlePaymentSubmit();
    }, { signal });
  }

  private isTeamPurchase(): boolean {
    if (this.currentPlan !== 'business') return false;
    return this.flowMode === 'create-team'
      || this.teamId !== null
      || this.teamSeats > 1
      || this.teamName.trim().length > 0;
  }

  private goToStep(step: 1 | 2): void {
    this.currentStep = step;

    const step1El = this.container.querySelector<HTMLElement>('[data-ref="checkout-step-1"]');
    const step2El = this.container.querySelector<HTMLElement>('[data-ref="checkout-step-2"]');
    const btnNext = this.container.querySelector<HTMLElement>('[data-ref="btn-checkout-next"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');

    if (step === 1) {
      if (step1El) step1El.classList.remove('is-hidden');
      if (step2El) step2El.classList.add('is-hidden');
      if (btnNext) btnNext.classList.remove('is-hidden');
      if (btnSubmit) btnSubmit.classList.add('is-hidden');
    } else {
      if (step1El) step1El.classList.add('is-hidden');
      if (step2El) step2El.classList.remove('is-hidden');
      if (btnNext) btnNext.classList.add('is-hidden');
      if (btnSubmit) {
        btnSubmit.classList.remove('is-hidden');
        btnSubmit.disabled = !this.isCardSelected;
      }

      if (this.isCardSelected && !this.paymentElement) {
        void this.initializeGateway();
      }
    }

    renderIcons(this.container);
  }

  private invalidateGateway(): void {
    if (this.paymentElement) {
      try {
        this.paymentElement.destroy();
      } catch {}
      this.paymentElement = null;
    }
    this.currentIntent = null;
    this.isCardSelected = false;
    this.isInitializingGateway = false;

    const methodCard = this.container.querySelector<HTMLElement>('[data-ref="method-card-card"]');
    const methodBody = this.container.querySelector<HTMLElement>('[data-ref="method-card-body"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');

    methodCard?.classList.remove('is-selected');
    if (methodBody) methodBody.classList.add('is-hidden');
    if (btnSubmit) btnSubmit.disabled = true;
  }

  private setBillingMode(mode: 'recurring' | 'one_time'): void {
    this.currentMode = mode;

    const pill = this.container.querySelector<HTMLElement>('[data-ref="checkout-mode-toggle"]');
    if (pill) {
      pill.setAttribute('data-cycle', mode);
    }

    const btnRecurring = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-mode-recurring"]');
    const btnOneTime = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-mode-one-time"]');

    if (btnRecurring && btnOneTime) {
      if (mode === 'recurring') {
        btnRecurring.classList.add('is-active', 'active');
        btnOneTime.classList.remove('is-active', 'active');
      } else {
        btnOneTime.classList.add('is-active', 'active');
        btnRecurring.classList.remove('is-active', 'active');
      }
    }

    this.updateBenefits();
    this.updateSelectionCards();
    this.updateSummary();
    this.invalidateGateway();
  }

  private toggleCardPaymentMethod(): void {
    this.isCardSelected = !this.isCardSelected;

    const methodCard = this.container.querySelector<HTMLElement>('[data-ref="method-card-card"]');
    const methodBody = this.container.querySelector<HTMLElement>('[data-ref="method-card-body"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');

    if (this.isCardSelected) {
      methodCard?.classList.add('is-selected');
      if (methodBody) methodBody.classList.remove('is-hidden');
      if (!this.paymentElement) {
        void this.initializeGateway();
      } else if (btnSubmit) {
        btnSubmit.disabled = false;
      }
    } else {
      methodCard?.classList.remove('is-selected');
      if (methodBody) methodBody.classList.add('is-hidden');
      if (btnSubmit) btnSubmit.disabled = true;
    }
  }

  private updatePlanView(): void {
    const isBusiness = this.currentPlan === 'business';
    const planIconEl = this.container.querySelector<HTMLElement>('[data-ref="summary-plan-icon"]');

    if (planIconEl) {
      const iconName = isBusiness ? 'business_center' : 'rocket_launch';
      planIconEl.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${iconName}"></use></svg>`;
      renderIcons(planIconEl);
    }

    this.updateBenefits();
    this.updateSelectionCards();
    this.updateSummary();
  }

  private getPlanDisplayName(): string {
    return this.currentPlan === 'business'
      ? t('checkout.summary_plan_business')
      : t('checkout.summary_plan_pro');
  }

  private formatBillingDate(monthsToAdd: number): string {
    const date = new Date();
    const targetMonth = date.getMonth() + monthsToAdd;
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(targetMonth);
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDayOfMonth));
    const lang = getCurrentLanguage();
    const locale = lang === 'es' ? 'es-ES' : lang;
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
      .format(date)
      .replace(/\./g, '');
  }

  private updateBenefits(): void {
    const isRecurring = this.currentMode === 'recurring';
    const text1 = this.container.querySelector<HTMLElement>('[data-ref="benefit-text-1"]');

    if (text1) {
      text1.textContent = isRecurring
        ? t('checkout.benefit_recurring')
        : t('checkout.benefit_one_time');
    }
  }

  private updateSelectionCards(): void {
    const isRecurring = this.currentMode === 'recurring';
    const isBusiness = this.currentPlan === 'business';
    const seats = isBusiness ? this.teamSeats : 1;

    const unitMonthly = isBusiness ? 19.99 : 9.99;
    const unitYearlyMonthlyEq = isBusiness ? 15.99 : 7.99;
    const unitYearlyTotal = isBusiness ? 191.88 : 95.88;

    const totalMonthly = Math.round(unitMonthly * seats * 100) / 100;
    const totalYearly = Math.round(unitYearlyTotal * seats * 100) / 100;

    const card1 = this.container.querySelector<HTMLElement>('[data-ref="option-card-1"]');
    const card2 = this.container.querySelector<HTMLElement>('[data-ref="option-card-2"]');
    const title1 = this.container.querySelector<HTMLElement>('[data-ref="option-title-1"]');
    const title2 = this.container.querySelector<HTMLElement>('[data-ref="option-title-2"]');
    const desc1 = this.container.querySelector<HTMLElement>('[data-ref="option-desc-1"]');
    const desc2 = this.container.querySelector<HTMLElement>('[data-ref="option-desc-2"]');
    const price1 = this.container.querySelector<HTMLElement>('[data-ref="option-price-1"]');
    const price2 = this.container.querySelector<HTMLElement>('[data-ref="option-price-2"]');
    const badge2 = this.container.querySelector<HTMLElement>('[data-ref="option-badge-2"]');

    const unitEqLabel = isBusiness && seats > 1
      ? `USD $${(unitYearlyMonthlyEq * seats).toFixed(2)}`
      : `USD $${unitYearlyMonthlyEq.toFixed(2)}`;

    if (isRecurring) {
      if (title1) title1.textContent = t('checkout.option_monthly_title');
      if (desc1) desc1.textContent = t('checkout.option_monthly_desc');
      if (price1) price1.textContent = `USD $${totalMonthly.toFixed(2)}`;

      if (title2) title2.textContent = t('checkout.option_yearly_title');
      if (desc2) desc2.textContent = t('checkout.option_yearly_desc', { unit: unitEqLabel });
      if (price2) price2.textContent = `USD $${totalYearly.toFixed(2)}`;
      if (badge2) {
        badge2.textContent = t('checkout.option_yearly_badge');
        badge2.classList.remove('is-hidden');
      }

      const isMonthlySelected = this.recurringCycle === 'monthly';
      card1?.classList.toggle('is-selected', isMonthlySelected);
      card2?.classList.toggle('is-selected', !isMonthlySelected);
    } else {
      if (title1) title1.textContent = t('checkout.option_onetime_1m_title');
      if (desc1) desc1.textContent = t('checkout.option_onetime_1m_desc');
      if (price1) price1.textContent = `USD $${totalMonthly.toFixed(2)}`;

      if (title2) title2.textContent = t('checkout.option_onetime_12m_title');
      if (desc2) desc2.textContent = t('checkout.option_onetime_12m_desc', { unit: unitEqLabel });
      if (price2) price2.textContent = `USD $${totalYearly.toFixed(2)}`;
      if (badge2) {
        badge2.textContent = t('checkout.option_onetime_12m_badge');
        badge2.classList.remove('is-hidden');
      }

      const isOneMonthSelected = this.oneTimeDuration === '1_month';
      card1?.classList.toggle('is-selected', isOneMonthSelected);
      card2?.classList.toggle('is-selected', !isOneMonthSelected);
    }
  }

  private updateSummary(): void {
    const isRecurring = this.currentMode === 'recurring';
    const isBusiness = this.currentPlan === 'business';
    const seats = isBusiness ? this.teamSeats : 1;
    const isTeam = this.isTeamPurchase();
    const isYearly = isRecurring ? this.recurringCycle === 'yearly' : this.oneTimeDuration === '12_months';

    const unitAmount = isBusiness
      ? (isYearly ? 191.88 : 19.99)
      : (isYearly ? 95.88 : 9.99);
    const amount = Math.round(unitAmount * seats * 100) / 100;

    const planName = this.getPlanDisplayName();
    const formattedPrice = `USD $${amount.toFixed(2)}`;

    const seatsBadgeEl = this.container.querySelector<HTMLElement>('[data-ref="checkout-seats-badge"]');
    if (seatsBadgeEl) {
      seatsBadgeEl.textContent = seats === 1
        ? t('checkout.seats_count_singular')
        : t('checkout.seats_count_plural', { count: seats });
    }

    const seatsHelperEl = this.container.querySelector<HTMLElement>('[data-ref="checkout-seats-helper"]');
    if (seatsHelperEl) {
      const unitStr = isYearly ? 'USD $15.99/mes' : 'USD $19.99/mes';
      seatsHelperEl.textContent = t('checkout.seats_helper', { unit: unitStr });
    }

    const feat1El = this.container.querySelector<HTMLElement>('[data-ref="summary-feat-1"]');
    if (feat1El) {
      feat1El.textContent = isTeam && this.teamName.trim()
        ? `${planName} — ${this.teamName.trim()}`
        : planName;
    }

    const feat2El = this.container.querySelector<HTMLElement>('[data-ref="summary-feat-2"]');
    if (feat2El) {
      if (isRecurring) {
        const nextDate = this.formatBillingDate(isYearly ? 12 : 1);
        feat2El.textContent = isYearly
          ? t('checkout.summary_billing_yearly', { date: nextDate, price: formattedPrice })
          : t('checkout.summary_billing_monthly', { date: nextDate, price: formattedPrice });
      } else {
        const endDate = this.formatBillingDate(isYearly ? 12 : 1);
        feat2El.textContent = isYearly
          ? t('checkout.summary_billing_one_time_12m', { date: endDate, price: formattedPrice })
          : t('checkout.summary_billing_one_time_1m', { date: endDate, price: formattedPrice });
      }
    }

    const feat3El = this.container.querySelector<HTMLElement>('[data-ref="summary-feat-3"]');
    if (feat3El) {
      if (isTeam && seats > 1) {
        const unitLabel = isYearly ? 'USD $15.99/mes' : 'USD $19.99/mes';
        feat3El.textContent = t('checkout.summary_seats_multiple', { count: seats, unit: unitLabel });
      } else {
        feat3El.textContent = t('checkout.summary_seats_single');
      }
    }

    const priceValEl = this.container.querySelector<HTMLElement>('[data-ref="summary-price-val"]');
    if (priceValEl) {
      priceValEl.textContent = formattedPrice;
    }

    const termsSuffixEl = this.container.querySelector<HTMLElement>('[data-ref="terms-suffix"]');
    if (termsSuffixEl) {
      termsSuffixEl.textContent = isRecurring
        ? t('checkout.terms_suffix_recurring', { plan: planName })
        : t('checkout.terms_suffix_one_time', { plan: planName });
    }

    const btnSubmitText = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-text"]');
    if (btnSubmitText && !this.isSubmitting) {
      btnSubmitText.textContent = t('checkout.pay_button_label', { price: formattedPrice });
    }
  }

  private async initializeGateway(): Promise<void> {
    if (this.isInitializingGateway) return;
    this.isInitializingGateway = true;

    const mountPoint = this.container.querySelector<HTMLElement>('[data-ref="stripe-payment-mount-point"]');
    const loadingEl = this.container.querySelector<HTMLElement>('[data-ref="checkout-elements-loading"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="checkout-error-banner"]');

    if (btnSubmit) btnSubmit.disabled = true;
    if (loadingEl) loadingEl.classList.remove('is-hidden');
    if (errorBanner) errorBanner.classList.add('is-hidden');

    if (this.paymentElement) {
      try {
        this.paymentElement.destroy();
      } catch {}
      this.paymentElement = null;
    }

    const isTeam = this.isTeamPurchase();
    const teamOptions = isTeam
      ? {
          scope: 'team' as const,
          seats: this.teamSeats,
          ...(this.teamId ? { teamId: this.teamId } : {}),
          ...(this.teamName.trim() ? { teamName: this.teamName.trim() } : {}),
        }
      : undefined;

    try {
      if (this.currentMode === 'recurring') {
        const res = await createSubscriptionIntentApi(this.currentPlan, this.recurringCycle, teamOptions);
        if (!res.success || !res.clientSecret || !res.publishableKey) {
          if (errorBanner) {
            errorBanner.textContent = res.error || t('checkout.error_connecting_gateway');
            errorBanner.classList.remove('is-hidden');
          }
          if (loadingEl) loadingEl.classList.add('is-hidden');
          return;
        }
        this.currentIntent = res;
      } else {
        const res = await createOneTimePaymentIntentApi(this.currentPlan, this.oneTimeDuration, teamOptions);
        if (!res.success || !res.clientSecret || !res.publishableKey) {
          if (errorBanner) {
            errorBanner.textContent = res.error || t('checkout.error_connecting_gateway');
            errorBanner.classList.remove('is-hidden');
          }
          if (loadingEl) loadingEl.classList.add('is-hidden');
          return;
        }
        this.currentIntent = res;
      }

      this.stripe = await loadStripeSdk(this.currentIntent.publishableKey);

      this.elements = this.stripe.elements({
        appearance: getStripeAppearance(),
        clientSecret: this.currentIntent.clientSecret,
      });

      this.paymentElement = this.elements.create('payment', {
        fields: {
          billingDetails: {
            address: {
              country: 'never',
            },
          },
        },
        terms: {
          card: 'never',
        },
        wallets: {
          applePay: 'never',
          googlePay: 'never',
          link: 'never',
        },
      });

      if (mountPoint) {
        this.paymentElement.mount(mountPoint);
        this.paymentElement.on('ready', () => {
          if (loadingEl) loadingEl.classList.add('is-hidden');
          if (btnSubmit && this.isCardSelected) btnSubmit.disabled = false;
        });

        this.paymentElement.on('change', (e: any) => {
          if (errorBanner) {
            if (e.empty) {
              if (btnSubmit) btnSubmit.disabled = true;
            } else if (e.complete) {
              if (btnSubmit && this.isCardSelected) btnSubmit.disabled = false;
              errorBanner.classList.add('is-hidden');
            }
          }
        });
      }
    } catch {
      if (loadingEl) loadingEl.classList.add('is-hidden');
      if (errorBanner) {
        errorBanner.textContent = t('ui.error_al_cargar_los_componentes_de_pago_');
        errorBanner.classList.remove('is-hidden');
      }
    } finally {
      this.isInitializingGateway = false;
    }
  }

  private async handlePaymentSubmit(): Promise<void> {
    if (this.isSubmitting || !this.stripe || !this.elements || !this.isCardSelected) return;

    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');
    const btnSubmitText = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-text"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="checkout-error-banner"]');

    this.isSubmitting = true;
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnSubmitText) btnSubmitText.textContent = t('checkout.processing_payment');
    if (errorBanner) errorBanner.classList.add('is-hidden');

    try {
      const userLang = navigator.language || 'es-ES';
      const detectedCountry = (userLang.includes('-') ? userLang.split('-')[1] : 'US').toUpperCase();
      const fallbackCountry = detectedCountry.length === 2 ? detectedCountry : 'US';

      const { error, paymentIntent } = await this.stripe.confirmPayment({
        confirmParams: {
          payment_method_data: {
            billing_details: {
              address: {
                country: fallbackCountry,
              },
            },
          },
          return_url: `${window.location.origin}/pricing`,
        },
        elements: this.elements,
        redirect: 'if_required',
      });

      if (error) {
        if (errorBanner) {
          errorBanner.textContent = error.message || t('ui.error_al_procesar_el_pago');
          errorBanner.classList.remove('is-hidden');
        }
        this.isSubmitting = false;
        if (btnSubmit) btnSubmit.disabled = false;
        this.updateSummary();
        return;
      }

      if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
        let resolvedTier = this.currentPlan;
        let resolvedTeamId: number | null = this.currentIntent?.teamId ? Number(this.currentIntent.teamId) : null;
        let resolvedSeats = this.teamSeats;

        if (this.currentMode === 'recurring') {
          const confirmRes = await confirmSubscriptionPaymentApi(
            this.currentIntent.subscriptionId,
            paymentIntent.id
          );
          resolvedTier = (confirmRes.tier as any) || this.currentPlan;
          if (confirmRes.teamId) resolvedTeamId = Number(confirmRes.teamId);
          if (confirmRes.seats) resolvedSeats = Number(confirmRes.seats);
        } else {
          const confirmRes = await confirmOneTimePaymentApi(paymentIntent.id);
          resolvedTier = (confirmRes.planId as any) || this.currentPlan;
          if (confirmRes.teamId) resolvedTeamId = Number(confirmRes.teamId);
          if (confirmRes.seats) resolvedSeats = Number(confirmRes.seats);
        }

        if (resolvedTeamId) {
          setActiveTeamId(resolvedTeamId);
          await checkAuthSession();
          showToast(
            t('checkout.success_team_ready', {
              seats: resolvedSeats,
              team: this.teamName.trim() || this.getPlanDisplayName(),
            }),
            'success'
          );
          window.dispatchEvent(new CustomEvent('subscription-updated', {
            detail: { teamId: resolvedTeamId, user: currentUser },
          }));
          navigate('/settings/team');
          return;
        }

        updateUserSubscriptionTier(resolvedTier);
        await checkAuthSession();
        const avatarEl = document.querySelector<HTMLElement>('[data-ref="btn-user-menu"]');
        applyAvatarTier(avatarEl, resolvedTier);

        showToast(
          this.currentMode === 'recurring'
            ? t('checkout.success_recurring', { plan: this.currentIntent.planName })
            : t('checkout.success_one_time', { plan: this.currentIntent.planName }),
          'success'
        );

        window.dispatchEvent(new CustomEvent('subscription-updated', {
          detail: { tier: resolvedTier, user: currentUser },
        }));

        navigate('/settings/billing');
      } else {
        showToast(t('toasts.el_pago_esta_en_proceso_de_verificacion'), 'info');
        navigate('/settings/billing');
      }
    } catch {
      if (errorBanner) {
        errorBanner.textContent = t('ui.error_inesperado_al_confirmar_la_transac');
        errorBanner.classList.remove('is-hidden');
      }
      this.isSubmitting = false;
      if (btnSubmit) btnSubmit.disabled = false;
      this.updateSummary();
    }
  }
}

async function createCheckoutView(initialQuery?: URLSearchParams): Promise<HTMLElement> {
  const container = await loadTemplate('/views/checkout/checkout.html');
  const controller = new CheckoutController(container, initialQuery);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { CheckoutController, createCheckoutView };
