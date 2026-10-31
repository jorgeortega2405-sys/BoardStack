import { confirmOneTimePaymentApi, confirmSubscriptionPaymentApi, createOneTimePaymentIntentApi, createSubscriptionIntentApi, currentUser, updateUserSubscriptionTier } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { getStripeAppearance, loadStripeSdk } from '../services/stripe.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { applyAvatarTier } from '../utils/tier.util.js';

export class CheckoutController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentIntent: any = null;
  private currentMode: 'recurring' | 'one_time' = 'recurring';
  private currentPlan: 'pro' | 'business' = 'pro';
  private currentStep: 1 | 2 = 1;
  private elements: any = null;
  private isSubmitting = false;
  private oneTimeDuration: '1_month' | '12_months' = '1_month';
  private paymentElement: any = null;
  private recurringCycle: 'monthly' | 'yearly' = 'monthly';
  private stripe: any = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    if (!currentUser) {
      showToast(t('upgrade.login_required', 'Inicia sesión para seleccionar un plan.'), 'info');
      navigate('/login');
      return;
    }

    this.abortController = new AbortController();

    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    if (planParam === 'business') {
      this.currentPlan = 'business';
    } else {
      this.currentPlan = 'pro';
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

    const btnNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-checkout-next"]');
    btnNext?.addEventListener('click', (e) => {
      e.preventDefault();
      this.goToStep(2);
    }, { signal });

    const btnBackTo1 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-back-to-step1"]');
    btnBackTo1?.addEventListener('click', (e) => {
      e.preventDefault();
      this.goToStep(1);
    }, { signal });

    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');
    btnSubmit?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.handlePaymentSubmit();
    }, { signal });
  }

  private goToStep(step: 1 | 2): void {
    this.currentStep = step;

    const step1El = this.container.querySelector<HTMLElement>('[data-ref="checkout-step-1"]');
    const step2El = this.container.querySelector<HTMLElement>('[data-ref="checkout-step-2"]');
    const btnNext = this.container.querySelector<HTMLElement>('[data-ref="btn-checkout-next"]');
    const btnSubmit = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-payment"]');

    if (step === 1) {
      if (step1El) step1El.style.display = 'flex';
      if (step2El) step2El.style.display = 'none';
      if (btnNext) btnNext.style.display = 'flex';
      if (btnSubmit) btnSubmit.style.display = 'none';
    } else {
      if (step1El) step1El.style.display = 'none';
      if (step2El) step2El.style.display = 'flex';
      if (btnNext) btnNext.style.display = 'none';
      if (btnSubmit) btnSubmit.style.display = 'flex';

      if (!this.paymentElement) {
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
  }

  private setBillingMode(mode: 'recurring' | 'one_time'): void {
    this.currentMode = mode;

    const btnRecurring = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-mode-recurring"]');
    const btnOneTime = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-mode-one-time"]');

    if (btnRecurring && btnOneTime) {
      if (mode === 'recurring') {
        btnRecurring.classList.add('active');
        btnOneTime.classList.remove('active');
      } else {
        btnOneTime.classList.add('active');
        btnRecurring.classList.remove('active');
      }
    }

    this.updateBenefits();
    this.updateSelectionCards();
    this.updateSummary();
    this.invalidateGateway();
  }

  private updatePlanView(): void {
    const isBusiness = this.currentPlan === 'business';
    const planTitleEl = this.container.querySelector<HTMLElement>('[data-ref="summary-plan-title"]');
    const planIconEl = this.container.querySelector<HTMLElement>('[data-ref="summary-plan-icon"]');

    if (planTitleEl) {
      planTitleEl.textContent = isBusiness ? 'BoardPDF Negocios' : 'BoardPDF Pro';
    }

    if (planIconEl) {
      const iconName = isBusiness ? 'business_center' : 'rocket_launch';
      planIconEl.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${iconName}"></use></svg>`;
      renderIcons(planIconEl);
    }

    this.updateBenefits();
    this.updateSelectionCards();
    this.updateSummary();
  }

  private updateBenefits(): void {
    const isRecurring = this.currentMode === 'recurring';
    const text1 = this.container.querySelector<HTMLElement>('[data-ref="benefit-text-1"]');
    const text2 = this.container.querySelector<HTMLElement>('[data-ref="benefit-text-2"]');
    const text3 = this.container.querySelector<HTMLElement>('[data-ref="benefit-text-3"]');

    if (isRecurring) {
      if (text1) text1.textContent = 'Cancela cuando quieras. Sin compromisos a largo plazo.';
      if (text2) text2.textContent = 'Acceso inmediato e ilimitado a todas las herramientas avanzadas.';
      if (text3) text3.textContent = 'Facturación automática para que nunca pierdas el acceso a tus archivos.';
    } else {
      if (text1) text1.textContent = 'Sin pagos recurrentes. Renueva únicamente cuando tú lo decidas.';
      if (text2) text2.textContent = 'Sin cargos automáticos posteriores en tu tarjeta bancaria.';
      if (text3) text3.textContent = 'Acceso completo garantizado durante todo el período prepagado.';
    }
  }

  private updateSelectionCards(): void {
    const isRecurring = this.currentMode === 'recurring';
    const isBusiness = this.currentPlan === 'business';

    const card1 = this.container.querySelector<HTMLElement>('[data-ref="option-card-1"]');
    const card2 = this.container.querySelector<HTMLElement>('[data-ref="option-card-2"]');
    const title1 = this.container.querySelector<HTMLElement>('[data-ref="option-title-1"]');
    const title2 = this.container.querySelector<HTMLElement>('[data-ref="option-title-2"]');
    const desc1 = this.container.querySelector<HTMLElement>('[data-ref="option-desc-1"]');
    const desc2 = this.container.querySelector<HTMLElement>('[data-ref="option-desc-2"]');
    const price1 = this.container.querySelector<HTMLElement>('[data-ref="option-price-1"]');
    const price2 = this.container.querySelector<HTMLElement>('[data-ref="option-price-2"]');
    const badge2 = this.container.querySelector<HTMLElement>('[data-ref="option-badge-2"]');

    if (isRecurring) {
      if (title1) title1.textContent = 'Mensual';
      if (desc1) desc1.textContent = 'Facturación cada mes';
      if (price1) price1.textContent = isBusiness ? 'USD $19.99' : 'USD $9.99';

      if (title2) title2.textContent = 'Anual';
      if (desc2) desc2.textContent = isBusiness ? 'USD $15.99 al mes facturado anualmente' : 'USD $7.99 al mes facturado anualmente';
      if (price2) price2.textContent = isBusiness ? 'USD $191.88' : 'USD $95.88';
      if (badge2) {
        badge2.textContent = 'Ahorra 20%';
        badge2.style.display = 'inline-flex';
      }

      const isMonthlySelected = this.recurringCycle === 'monthly';
      card1?.classList.toggle('is-selected', isMonthlySelected);
      card2?.classList.toggle('is-selected', !isMonthlySelected);
    } else {
      if (title1) title1.textContent = '1 mes';
      if (desc1) desc1.textContent = 'Pago único sin renovaciones automáticas';
      if (price1) price1.textContent = isBusiness ? 'USD $19.99' : 'USD $9.99';

      if (title2) title2.textContent = '12 meses';
      if (desc2) desc2.textContent = isBusiness ? 'USD $15.99 al mes (1 año prepagado)' : 'USD $7.99 al mes (1 año prepagado)';
      if (price2) price2.textContent = isBusiness ? 'USD $191.88' : 'USD $95.88';
      if (badge2) {
        badge2.textContent = 'Mejor valor';
        badge2.style.display = 'inline-flex';
      }

      const isOneMonthSelected = this.oneTimeDuration === '1_month';
      card1?.classList.toggle('is-selected', isOneMonthSelected);
      card2?.classList.toggle('is-selected', !isOneMonthSelected);
    }
  }

  private updateSummary(): void {
    const isRecurring = this.currentMode === 'recurring';
    const isBusiness = this.currentPlan === 'business';

    let amount = 9.99;
    if (isBusiness) {
      if (isRecurring) {
        amount = this.recurringCycle === 'yearly' ? 191.88 : 19.99;
      } else {
        amount = this.oneTimeDuration === '12_months' ? 191.88 : 19.99;
      }
    } else {
      if (isRecurring) {
        amount = this.recurringCycle === 'yearly' ? 95.88 : 9.99;
      } else {
        amount = this.oneTimeDuration === '12_months' ? 95.88 : 9.99;
      }
    }

    const typeEl = this.container.querySelector<HTMLElement>('[data-ref="summary-plan-type"]');
    if (typeEl) {
      typeEl.textContent = isRecurring ? 'Facturación recurrente' : 'Facturación prepaga (Pago único)';
    }

    const priceValEl = this.container.querySelector<HTMLElement>('[data-ref="summary-price-val"]');
    if (priceValEl) {
      priceValEl.textContent = `USD $${amount.toFixed(2)}`;
    }

    const noticeEl = this.container.querySelector<HTMLElement>('[data-ref="summary-notice-text"]');
    if (noticeEl) {
      if (isRecurring) {
        noticeEl.textContent = this.recurringCycle === 'yearly'
          ? 'Renovación automática cada año. Cancela cuando quieras desde tu configuración.'
          : 'Renovación automática cada mes. Cancela cuando quieras desde tu configuración.';
      } else {
        noticeEl.textContent = this.oneTimeDuration === '12_months'
          ? 'Acceso completo durante 1 año. No se aplicará ninguna renovación automática.'
          : 'Acceso completo durante 1 mes. No se aplicará ninguna renovación automática.';
      }
    }

    const btnSubmitText = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-text"]');
    if (btnSubmitText && !this.isSubmitting) {
      btnSubmitText.textContent = `Pagar USD $${amount.toFixed(2)}`;
    }
  }

  private async initializeGateway(): Promise<void> {
    const mountPoint = this.container.querySelector<HTMLElement>('[data-ref="stripe-payment-mount-point"]');
    const loadingEl = this.container.querySelector<HTMLElement>('[data-ref="checkout-elements-loading"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="checkout-error-banner"]');

    if (btnSubmit) btnSubmit.disabled = true;
    if (loadingEl) loadingEl.style.display = 'flex';
    if (errorBanner) errorBanner.style.display = 'none';

    if (this.paymentElement) {
      try {
        this.paymentElement.destroy();
      } catch {}
      this.paymentElement = null;
    }

    try {
      if (this.currentMode === 'recurring') {
        const res = await createSubscriptionIntentApi(this.currentPlan, this.recurringCycle);
        if (!res.success || !res.clientSecret || !res.publishableKey) {
          if (errorBanner) {
            errorBanner.textContent = res.error || 'Error al conectar con la pasarela de Stripe.';
            errorBanner.style.display = 'block';
          }
          if (loadingEl) loadingEl.style.display = 'none';
          return;
        }
        this.currentIntent = res;
      } else {
        const res = await createOneTimePaymentIntentApi(this.currentPlan, this.oneTimeDuration);
        if (!res.success || !res.clientSecret || !res.publishableKey) {
          if (errorBanner) {
            errorBanner.textContent = res.error || 'Error al conectar con la pasarela de Stripe.';
            errorBanner.style.display = 'block';
          }
          if (loadingEl) loadingEl.style.display = 'none';
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
          if (loadingEl) loadingEl.style.display = 'none';
          if (btnSubmit) btnSubmit.disabled = false;
        });

        this.paymentElement.on('change', (e: any) => {
          if (errorBanner) {
            if (e.empty) {
              if (btnSubmit) btnSubmit.disabled = true;
            } else if (e.complete) {
              if (btnSubmit) btnSubmit.disabled = false;
              errorBanner.style.display = 'none';
            }
          }
        });
      }
    } catch {
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorBanner) {
        errorBanner.textContent = 'Error al cargar los componentes de pago seguro.';
        errorBanner.style.display = 'block';
      }
    }
  }

  private async handlePaymentSubmit(): Promise<void> {
    if (this.isSubmitting || !this.stripe || !this.elements) return;

    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');
    const btnSubmitText = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-text"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="checkout-error-banner"]');

    this.isSubmitting = true;
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnSubmitText) btnSubmitText.textContent = 'Procesando pago...';
    if (errorBanner) errorBanner.style.display = 'none';

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
          errorBanner.textContent = error.message || 'Error al procesar el pago.';
          errorBanner.style.display = 'block';
        }
        this.isSubmitting = false;
        if (btnSubmit) btnSubmit.disabled = false;
        this.updateSummary();
        return;
      }

      if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
        let resolvedTier = this.currentPlan;

        if (this.currentMode === 'recurring') {
          const confirmRes = await confirmSubscriptionPaymentApi(
            this.currentIntent.subscriptionId,
            paymentIntent.id
          );
          resolvedTier = (confirmRes.tier as any) || this.currentPlan;
        } else {
          const confirmRes = await confirmOneTimePaymentApi(paymentIntent.id);
          resolvedTier = (confirmRes.planId as any) || this.currentPlan;
        }

        updateUserSubscriptionTier(resolvedTier);
        const avatarEl = document.querySelector<HTMLElement>('[data-ref="btn-user-menu"]');
        applyAvatarTier(avatarEl, resolvedTier);

        showToast(
          this.currentMode === 'recurring'
            ? `¡Felicidades! Tu suscripción recurrente a ${this.currentIntent.planName} está activa.`
            : `¡Felicidades! Tu acceso de pago único a ${this.currentIntent.planName} está activo.`,
          'success'
        );

        window.dispatchEvent(new CustomEvent('subscription-updated', {
          detail: { tier: resolvedTier, user: currentUser },
        }));

        navigate('/settings/billing');
      } else {
        showToast('El pago está en proceso de verificación.', 'info');
        navigate('/settings/billing');
      }
    } catch {
      if (errorBanner) {
        errorBanner.textContent = 'Error inesperado al confirmar la transacción.';
        errorBanner.style.display = 'block';
      }
      this.isSubmitting = false;
      if (btnSubmit) btnSubmit.disabled = false;
      this.updateSummary();
    }
  }
}

export async function createCheckoutView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/checkout/checkout.html');
  const controller = new CheckoutController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
