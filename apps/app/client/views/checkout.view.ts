import { confirmSubscriptionPaymentApi, createSubscriptionIntentApi, currentUser, linkedAccounts, setAuthState } from '../services/api.service.js';
import { getStripeAppearance, loadStripeSdk } from '../services/stripe.service.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { setupSliderPill } from '../utils/dom.util.js';
import { showToast } from '../services/toast.service.js';

async function createCheckoutView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-wrapper component-wrapper--full';
  container.setAttribute('data-ref', 'checkout-wrapper');

  if (!currentUser) {
    showToast(i18n.t('checkout.login_required'), 'info');
    navigate('/login');
    return container;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const initialCycle = urlParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly';
  const initialMode = urlParams.get('mode') === 'one_time' ? 'one_time' : 'recurring';

  let currentStep: 1 | 2 = 1;
  let currentMode: 'one_time' | 'recurring' = initialMode;
  let recurringPeriod: 'monthly' | 'yearly' = initialCycle;
  let oneTimePeriod: '1_month' | '6_months' | '12_months' = '1_month';

  let stripe: any = null;
  let elements: any = null;
  let paymentElement: any = null;
  let currentIntent: any = null;
  let isInitializing = false;
  let isSubmitting = false;

  const isAlreadyPro = currentUser.subscription_tier === 'pro';

  container.innerHTML = `
    <div class="component-backdrop component-backdrop--dots" data-ref="checkout-backdrop"></div>
    <div class="component-body component-body--scrollable" data-ref="checkout-scrollable">
      <div class="component-container component-container--wide" data-ref="checkout-container">
        <div class="component-grid component-grid--2-col" data-ref="checkout-grid">
          
          <div class="component-main" data-ref="checkout-main">
            
            <div class="component-empty-state ${isAlreadyPro ? '' : 'is-hidden'}" data-ref="checkout-already-active">
              <div class="component-card component-card--status" data-ref="checkout-active-card">
                <div class="component-avatar component-avatar--status" data-ref="checkout-active-icon">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
                </div>
                <h2 class="component-title" data-ref="checkout-active-title">${i18n.t('checkout.already_active_title')}</h2>
                <p class="component-subtitle" data-ref="checkout-active-desc">${i18n.t('checkout.already_active_desc')}</p>
                <div class="component-group component-group--actions" data-ref="checkout-active-actions">
                  <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-goto-pricing">
                    ${i18n.t('checkout.view_other_plans')}
                  </button>
                  <button type="button" class="component-button component-button--h55 component-button--secondary component-button--w-full" data-ref="btn-goto-home">
                    ${i18n.t('checkout.back_to_home')}
                  </button>
                </div>
              </div>
            </div>

            <div class="component-step ${isAlreadyPro ? 'is-hidden' : ''}" data-ref="checkout-step-1">
              <h1 class="component-title component-title--lg" data-ref="checkout-step1-title">${i18n.t('checkout.step1_title')}</h1>
              
              <div class="component-toggle-pill component-toggle-pill--slider" data-ref="checkout-mode-toggle" data-cycle="${currentMode}" data-tabs="2" data-active-index="${currentMode === 'one_time' ? '1' : '0'}" style="--slider-tab-count: 2; --slider-active-index: ${currentMode === 'one_time' ? '1' : '0'};">
                <div class="component-toggle-indicator" data-ref="checkout-toggle-indicator"></div>
                <button type="button" class="component-tab ${currentMode === 'recurring' ? 'is-active' : ''}" data-ref="btn-mode-recurring" data-cycle="recurring">
                  ${i18n.t('checkout.mode_recurring')}
                </button>
                <button type="button" class="component-tab ${currentMode === 'one_time' ? 'is-active' : ''}" data-ref="btn-mode-one-time" data-cycle="one_time">
                  ${i18n.t('checkout.mode_one_time')}
                </button>
              </div>

              <div class="component-list component-list--benefits" data-ref="checkout-benefits-list">
                <div class="component-list-item" data-ref="benefit-item-mode">
                  <span class="component-list-item__icon">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  </span>
                  <span data-ref="benefit-text-mode">
                    ${currentMode === 'recurring' ? i18n.t('checkout.mode_recurring_benefit') : i18n.t('checkout.mode_one_time_benefit')}
                  </span>
                </div>
              </div>

              <div class="component-group component-group--options" data-ref="checkout-options-container"></div>
            </div>

            <div class="component-step is-hidden" data-ref="checkout-step-2">
              <button type="button" class="component-link component-link--back" data-ref="btn-back-to-step1">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
                <span data-ref="back-link-text">${i18n.t('checkout.change_cycle_link')}</span>
              </button>
              
              <h1 class="component-title component-title--lg" data-ref="checkout-step2-title">${i18n.t('checkout.step2_title')}</h1>

              <div class="component-list component-list--benefits" data-ref="step2-benefits-list">
                <div class="component-list-item" data-ref="step2-benefit-1">
                  <span class="component-list-item__icon"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg></span>
                  <span>${i18n.t('checkout.stripe_benefit')}</span>
                </div>
                <div class="component-list-item" data-ref="step2-benefit-2">
                  <span class="component-list-item__icon"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg></span>
                  <span>${i18n.t('checkout.guarantee_benefit')}</span>
                </div>
              </div>

              <div class="component-section" data-ref="checkout-methods-section">
                <h2 class="component-section__title">${i18n.t('checkout.available_methods')}</h2>
                <div class="component-list component-list--methods" data-ref="checkout-methods-list">
                  <div class="component-card component-card--method is-selected" data-ref="method-card-card">
                    <div class="component-card__header" data-ref="method-card-header">
                      <div class="component-card__left">
                        <div class="component-radio"></div>
                        <div class="component-icon-box">
                          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#credit_card"></use></svg>
                        </div>
                        <span class="component-card__name">${i18n.t('checkout.credit_card')}</span>
                      </div>
                    </div>
                    <div class="component-card__body" data-ref="method-card-body">
                      <div class="component-elements-box" data-ref="checkout-elements-box">
                        <div class="component-elements-loading" data-ref="checkout-elements-loading">
                          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#sync"></use></svg>
                          <span>${i18n.t('checkout.loading_gateway')}</span>
                        </div>
                        <div data-ref="stripe-payment-mount-point"></div>
                      </div>
                      <div class="component-badge--secure" data-ref="checkout-secure-badge">
                        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#verified_user"></use></svg>
                        <span>${i18n.t('checkout.encrypted_badge')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div class="component-sidebar" data-ref="checkout-sidebar">
            <div class="component-card component-card--summary" data-ref="summary-features-card">
              <h3 class="component-card__title" data-ref="summary-info-title">${i18n.t('checkout.plan_info_title')}</h3>
              <div class="component-list component-list--summary" data-ref="summary-plan-details">
                <div class="component-summary-row" data-ref="summary-row-plan">
                  <span class="component-summary-row__title" data-ref="summary-plan-name">${i18n.t('checkout.plan_pro')}</span>
                  <span class="component-summary-row__price" data-ref="summary-plan-price">USD $9.99</span>
                </div>
                <div class="component-summary-row__meta" data-ref="summary-plan-cycle">${i18n.t('pricing.billing_monthly')}</div>
                <div class="component-summary-row__meta" data-ref="summary-plan-end-date"></div>
              </div>
            </div>

            <div class="component-card component-card--summary ${isAlreadyPro ? 'is-hidden' : ''}" data-ref="summary-price-card">
              <div class="component-price-row" data-ref="summary-price-row">
                <span class="component-price-row__label">${i18n.t('checkout.total_due')}</span>
                <span class="component-price-row__val" data-ref="summary-price-val">USD $9.99</span>
              </div>
              
              <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-checkout-next">
                ${i18n.t('checkout.pay_now')}
              </button>
              
              <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full is-hidden" data-ref="btn-submit-payment" disabled>
                <span data-ref="btn-submit-text">USD $9.99</span>
              </button>

              <div class="component-banner component-banner--danger is-hidden component-block--w-full" data-ref="checkout-error-banner"></div>

              <p class="component-note component-note--legal" data-ref="checkout-terms-note">
                ${i18n.t('checkout.legal_disclaimer')}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const step1El = container.querySelector<HTMLElement>('[data-ref="checkout-step-1"]');
  const step2El = container.querySelector<HTMLElement>('[data-ref="checkout-step-2"]');
  const btnNext = container.querySelector<HTMLButtonElement>('[data-ref="btn-checkout-next"]');
  const btnSubmit = container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');
  const btnSubmitText = container.querySelector<HTMLElement>('[data-ref="btn-submit-text"]');
  const btnBackTo1 = container.querySelector<HTMLButtonElement>('[data-ref="btn-back-to-step1"]');
  const pillToggle = container.querySelector<HTMLElement>('[data-ref="checkout-mode-toggle"]');
  const benefitModeText = container.querySelector<HTMLElement>('[data-ref="benefit-text-mode"]');
  const optionsContainer = container.querySelector<HTMLElement>('[data-ref="checkout-options-container"]');
  const summaryPriceVal = container.querySelector<HTMLElement>('[data-ref="summary-price-val"]');
  const summaryPlanPrice = container.querySelector<HTMLElement>('[data-ref="summary-plan-price"]');
  const summaryPlanCycle = container.querySelector<HTMLElement>('[data-ref="summary-plan-cycle"]');
  const summaryPlanEndDate = container.querySelector<HTMLElement>('[data-ref="summary-plan-end-date"]');
  const errorBanner = container.querySelector<HTMLElement>('[data-ref="checkout-error-banner"]');
  const mountPoint = container.querySelector<HTMLElement>('[data-ref="stripe-payment-mount-point"]');
  const loadingEl = container.querySelector<HTMLElement>('[data-ref="checkout-elements-loading"]');

  const btnGotoPricing = container.querySelector<HTMLButtonElement>('[data-ref="btn-goto-pricing"]');
  const btnGotoHome = container.querySelector<HTMLButtonElement>('[data-ref="btn-goto-home"]');

  btnGotoPricing?.addEventListener('click', () => navigate('/pricing'));
  btnGotoHome?.addEventListener('click', () => navigate('/'));

  if (isAlreadyPro) {
    return container;
  }

  const getSelectedPrice = (): number => {
    if (currentMode === 'recurring') {
      return recurringPeriod === 'yearly' ? 95.88 : 9.99;
    }
    if (oneTimePeriod === '6_months') return 49.99;
    if (oneTimePeriod === '12_months') return 89.99;
    return 9.99;
  };

  const getSelectedPeriod = (): '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly' => {
    return currentMode === 'recurring' ? recurringPeriod : oneTimePeriod;
  };

  const invalidateGateway = () => {
    if (paymentElement) {
      try {
        paymentElement.destroy();
      } catch {}
      paymentElement = null;
    }
    currentIntent = null;
    isInitializing = false;
    if (btnSubmit) btnSubmit.disabled = true;
    if (loadingEl) loadingEl.classList.remove('is-hidden');
    if (errorBanner) errorBanner.classList.add('is-hidden');
  };

  const updateOptions = () => {
    if (!optionsContainer) return;
    optionsContainer.innerHTML = '';

    if (currentMode === 'recurring') {
      const cardMonthly = document.createElement('div');
      cardMonthly.className = `component-card component-card--selectable ${recurringPeriod === 'monthly' ? 'is-selected' : ''}`;
      cardMonthly.setAttribute('data-ref', 'option-card-monthly');
      cardMonthly.innerHTML = `
        <div class="component-card__left">
          <div class="component-radio"></div>
          <div class="component-card__info">
            <div class="component-card__title-row">
              <h3 class="component-card__title">${i18n.t('settings.billing.period_monthly')}</h3>
            </div>
            <p class="component-card__desc">${i18n.t('pricing.billing_monthly')}</p>
          </div>
        </div>
        <div class="component-card__price">USD $9.99 ${i18n.t('pricing.price_month')}</div>
      `;
      cardMonthly.addEventListener('click', () => {
        if (recurringPeriod === 'monthly') return;
        recurringPeriod = 'monthly';
        updateOptions();
        updateSummary();
        invalidateGateway();
      });

      const cardYearly = document.createElement('div');
      cardYearly.className = `component-card component-card--selectable ${recurringPeriod === 'yearly' ? 'is-selected' : ''}`;
      cardYearly.setAttribute('data-ref', 'option-card-yearly');
      cardYearly.innerHTML = `
        <div class="component-card__left">
          <div class="component-radio"></div>
          <div class="component-card__info">
            <div class="component-card__title-row">
              <h3 class="component-card__title">${i18n.t('settings.billing.period_yearly')}</h3>
              <span class="component-badge component-badge--sm component-badge--success">${i18n.t('checkout.cycle_yearly')}</span>
            </div>
            <p class="component-card__desc">${i18n.t('pricing.billing_yearly')}</p>
          </div>
        </div>
        <div class="component-card__price">USD $95.88</div>
      `;
      cardYearly.addEventListener('click', () => {
        if (recurringPeriod === 'yearly') return;
        recurringPeriod = 'yearly';
        updateOptions();
        updateSummary();
        invalidateGateway();
      });

      optionsContainer.appendChild(cardMonthly);
      optionsContainer.appendChild(cardYearly);
    } else {
      const card1M = document.createElement('div');
      card1M.className = `component-card component-card--selectable ${oneTimePeriod === '1_month' ? 'is-selected' : ''}`;
      card1M.setAttribute('data-ref', 'option-card-1m');
      card1M.innerHTML = `
        <div class="component-card__left">
          <div class="component-radio"></div>
          <div class="component-card__info">
            <div class="component-card__title-row">
              <h3 class="component-card__title">${i18n.t('checkout.cycle_1_month')}</h3>
            </div>
            <p class="component-card__desc">${i18n.t('checkout.mode_one_time_benefit')}</p>
          </div>
        </div>
        <div class="component-card__price">USD $9.99</div>
      `;
      card1M.addEventListener('click', () => {
        if (oneTimePeriod === '1_month') return;
        oneTimePeriod = '1_month';
        updateOptions();
        updateSummary();
        invalidateGateway();
      });

      const card6M = document.createElement('div');
      card6M.className = `component-card component-card--selectable ${oneTimePeriod === '6_months' ? 'is-selected' : ''}`;
      card6M.setAttribute('data-ref', 'option-card-6m');
      card6M.innerHTML = `
        <div class="component-card__left">
          <div class="component-radio"></div>
          <div class="component-card__info">
            <div class="component-card__title-row">
              <h3 class="component-card__title">${i18n.t('checkout.cycle_6_months')}</h3>
            </div>
            <p class="component-card__desc">${i18n.t('checkout.mode_one_time_benefit')}</p>
          </div>
        </div>
        <div class="component-card__price">USD $49.99</div>
      `;
      card6M.addEventListener('click', () => {
        if (oneTimePeriod === '6_months') return;
        oneTimePeriod = '6_months';
        updateOptions();
        updateSummary();
        invalidateGateway();
      });

      const card12M = document.createElement('div');
      card12M.className = `component-card component-card--selectable ${oneTimePeriod === '12_months' ? 'is-selected' : ''}`;
      card12M.setAttribute('data-ref', 'option-card-12m');
      card12M.innerHTML = `
        <div class="component-card__left">
          <div class="component-radio"></div>
          <div class="component-card__info">
            <div class="component-card__title-row">
              <h3 class="component-card__title">${i18n.t('checkout.cycle_12_months')}</h3>
            </div>
            <p class="component-card__desc">${i18n.t('checkout.mode_one_time_benefit')}</p>
          </div>
        </div>
        <div class="component-card__price">USD $89.99</div>
      `;
      card12M.addEventListener('click', () => {
        if (oneTimePeriod === '12_months') return;
        oneTimePeriod = '12_months';
        updateOptions();
        updateSummary();
        invalidateGateway();
      });

      optionsContainer.appendChild(card1M);
      optionsContainer.appendChild(card6M);
      optionsContainer.appendChild(card12M);
    }
  };

  const getCycleLabel = (): string => {
    if (currentMode === 'recurring') {
      return recurringPeriod === 'yearly' ? i18n.t('pricing.billing_yearly') : i18n.t('pricing.billing_monthly');
    }
    if (oneTimePeriod === '12_months') return i18n.t('checkout.mode_one_time_12m');
    if (oneTimePeriod === '6_months') return i18n.t('checkout.mode_one_time_6m');
    return i18n.t('checkout.mode_one_time_1m');
  };

  const getFormattedEndDate = (): string => {
    const endDate = new Date();
    if (currentMode === 'recurring') {
      endDate.setMonth(endDate.getMonth() + (recurringPeriod === 'yearly' ? 12 : 1));
    } else if (oneTimePeriod === '12_months') {
      endDate.setMonth(endDate.getMonth() + 12);
    } else if (oneTimePeriod === '6_months') {
      endDate.setMonth(endDate.getMonth() + 6);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    return new Intl.DateTimeFormat(i18n.getLanguage(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(endDate);
  };

  const updateSummary = () => {
    const price = getSelectedPrice();
    const formatted = `USD $${price.toFixed(2)}`;
    if (summaryPriceVal) summaryPriceVal.textContent = formatted;
    if (summaryPlanPrice) summaryPlanPrice.textContent = formatted;
    if (summaryPlanCycle) summaryPlanCycle.textContent = getCycleLabel();
    if (summaryPlanEndDate) summaryPlanEndDate.textContent = `${i18n.t('checkout.end_date_label')}: ${getFormattedEndDate()}`;
    if (btnSubmitText && !isSubmitting) {
      btnSubmitText.textContent = `${i18n.t('checkout.pay_now')} (${formatted})`;
    }
  };

  const goToStep = (step: 1 | 2) => {
    currentStep = step;
    if (step === 1) {
      step1El?.classList.remove('is-hidden');
      step2El?.classList.add('is-hidden');
      btnNext?.classList.remove('is-hidden');
      btnSubmit?.classList.add('is-hidden');
    } else {
      step1El?.classList.add('is-hidden');
      step2El?.classList.remove('is-hidden');
      btnNext?.classList.add('is-hidden');
      btnSubmit?.classList.remove('is-hidden');
      void initializeGateway();
    }
    renderIcons(container);
  };

  setupSliderPill(pillToggle, (_index, tab) => {
    const selectedMode = tab.getAttribute('data-cycle') === 'one_time' ? 'one_time' : 'recurring';
    if (currentMode === selectedMode) return;
    currentMode = selectedMode;
    if (benefitModeText) {
      benefitModeText.textContent = currentMode === 'recurring'
        ? i18n.t('checkout.mode_recurring_benefit')
        : i18n.t('checkout.mode_one_time_benefit');
    }
    updateOptions();
    updateSummary();
    invalidateGateway();
  });

  btnNext?.addEventListener('click', () => {
    errorBanner?.classList.add('is-hidden');
    goToStep(2);
  });

  btnBackTo1?.addEventListener('click', () => {
    goToStep(1);
  });

  const initializeGateway = async () => {
    if (isInitializing || paymentElement) return;
    isInitializing = true;

    if (btnSubmit) btnSubmit.disabled = true;
    if (loadingEl) loadingEl.classList.remove('is-hidden');
    if (errorBanner) errorBanner.classList.add('is-hidden');

    try {
      const period = getSelectedPeriod();
      const res = await createSubscriptionIntentApi(currentMode, period, 'pro');

      if (!res.success || !res.clientSecret || !res.publishableKey) {
        if (errorBanner) {
          errorBanner.textContent = res.error || i18n.t('common.error');
          errorBanner.classList.remove('is-hidden');
        }
        if (loadingEl) loadingEl.classList.add('is-hidden');
        return;
      }

      currentIntent = res;
      stripe = await loadStripeSdk(res.publishableKey);

      elements = stripe.elements({
        appearance: getStripeAppearance(),
        clientSecret: res.clientSecret,
      });

      paymentElement = elements.create('payment', {
        fields: {
          billingDetails: {
            address: { country: 'never' },
          },
        },
        terms: { card: 'never' },
        wallets: {
          applePay: 'never',
          googlePay: 'never',
          link: 'never',
        },
      });

      if (mountPoint) {
        paymentElement.mount(mountPoint);
        paymentElement.on('ready', () => {
          if (loadingEl) loadingEl.classList.add('is-hidden');
          if (btnSubmit) btnSubmit.disabled = false;
        });

        paymentElement.on('change', (e: any) => {
          if (e.empty) {
            if (btnSubmit) btnSubmit.disabled = true;
          } else if (e.complete) {
            if (btnSubmit) btnSubmit.disabled = false;
            errorBanner?.classList.add('is-hidden');
          }
        });
      }
    } catch (err: any) {
      if (loadingEl) loadingEl.classList.add('is-hidden');
      if (errorBanner) {
        errorBanner.textContent = err.message || i18n.t('common.error');
        errorBanner.classList.remove('is-hidden');
      }
    } finally {
      isInitializing = false;
    }
  };

  const handlePaymentSubmit = async () => {
    if (isSubmitting || !stripe || !elements || !currentIntent) return;

    isSubmitting = true;
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnSubmitText) btnSubmitText.textContent = i18n.t('common.loading');
    if (errorBanner) errorBanner.classList.add('is-hidden');

    try {
      const userLang = navigator.language || 'es-ES';
      const detectedCountry = (userLang.includes('-') ? userLang.split('-')[1] : 'US').toUpperCase();
      const fallbackCountry = detectedCountry.length === 2 ? detectedCountry : 'US';

      const { error, paymentIntent } = await stripe.confirmPayment({
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
        elements,
        redirect: 'if_required',
      });

      if (error) {
        if (errorBanner) {
          errorBanner.textContent = error.message || i18n.t('common.error');
          errorBanner.classList.remove('is-hidden');
        }
        isSubmitting = false;
        if (btnSubmit) btnSubmit.disabled = false;
        updateSummary();
        return;
      }

      if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
        const confirmRes = await confirmSubscriptionPaymentApi(paymentIntent.id);

        if (!confirmRes.success) {
          if (errorBanner) {
            errorBanner.textContent = confirmRes.error || i18n.t('common.error');
            errorBanner.classList.remove('is-hidden');
          }
          isSubmitting = false;
          if (btnSubmit) btnSubmit.disabled = false;
          updateSummary();
          return;
        }

        if (currentUser) {
          currentUser.subscription_tier = 'pro';
          setAuthState({ ...currentUser, subscription_tier: 'pro' }, linkedAccounts);
        }

        const avatarBtn = document.querySelector<HTMLElement>('[data-ref="btn-user-menu"]');
        if (avatarBtn) {
          avatarBtn.setAttribute('data-tier', 'pro');
        }

        showToast(i18n.t('checkout.payment_success'), 'success');

        setTimeout(() => {
          navigate('/');
        }, 1200);
      } else {
        showToast(i18n.t('common.loading'), 'info');
        navigate('/');
      }
    } catch (err: any) {
      if (errorBanner) {
        errorBanner.textContent = err.message || i18n.t('common.error');
        errorBanner.classList.remove('is-hidden');
      }
      isSubmitting = false;
      if (btnSubmit) btnSubmit.disabled = false;
      updateSummary();
    }
  };

  btnSubmit?.addEventListener('click', () => {
    void handlePaymentSubmit();
  });

  updateOptions();
  updateSummary();

  return container;
}

export {
  createCheckoutView
};