import { confirmSubscriptionPaymentApi, createSubscriptionIntentApi, currentUser, updateUserSubscriptionTier } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { getStripeAppearance, loadStripeSdk } from '../services/stripe.service.js';
import { showToast } from '../services/toast.service.js';
import { applyAvatarTier, getTierDisplayName, getTierWeight, normalizeTier } from '../utils/tier.util.js';

interface CheckoutModalOptions {
  billingPeriod?: 'monthly' | 'yearly';
  onCancel?: () => void;
  onSuccess?: (tier: string) => void;
  planId: 'pro' | 'business';
}

let activeCheckoutModal: { close: () => void } | null = null;

async function openCheckoutModal(options: CheckoutModalOptions): Promise<{ close: () => void } | null> {
  if (activeCheckoutModal) {
    activeCheckoutModal.close();
  }

  if (currentUser) {
    const userTier = normalizeTier(currentUser.subscription_tier);
    const userWeight = getTierWeight(userTier);
    const targetWeight = getTierWeight(options.planId);

    if (userWeight === targetWeight) {
      showToast(`Ya cuentas con el plan ${options.planId === 'business' ? 'Negocios' : 'Pro'} activo.`, 'info');
      return null;
    }
    if (userWeight > targetWeight) {
      showToast(t('toasts.tu_plan_actual_ya_incluye_todas_las_vent'), 'info');
      return null;
    }
  }

  const billingPeriod = options.billingPeriod || 'monthly';
  const planId = options.planId;
  const isYearly = billingPeriod === 'yearly';

  const intentRes = await createSubscriptionIntentApi(planId, billingPeriod);
  if (!intentRes.success || !intentRes.clientSecret || !intentRes.publishableKey) {
    showToast(intentRes.error || t('checkout.error_connecting_gateway'), 'danger');
    return null;
  }

  let stripe: any = null;
  try {
    stripe = await loadStripeSdk(intentRes.publishableKey);
  } catch {
    showToast(t('checkout.error_initializing_payment'), 'danger');
    return null;
  }

  const elements = stripe.elements({
    appearance: getStripeAppearance(),
    clientSecret: intentRes.clientSecret,
  });

  const paymentElement = elements.create('payment', {
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

  const formattedAmount = Number(intentRes.amount || 0).toFixed(2);
  const cycleLabel = isYearly ? 'Facturación Anual' : 'Facturación Mensual';
  const iconName = planId === 'business' ? 'business_center' : 'rocket_launch';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop is-visible is-open';
  backdrop.setAttribute('data-ref', 'modal-checkout-backdrop');

  backdrop.innerHTML = `
    <div class="modal-card modal-card--checkout" data-ref="modal-card-checkout">
      <div class="modal-card__header" data-ref="modal-checkout-header">
        <button type="button" class="modal-close-btn" data-ref="btn-checkout-modal-close" aria-label="Cerrar">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
        <h2 class="modal-card__title" data-ref="checkout-title">Completa tu suscripción</h2>
        <p class="modal-card__description" data-ref="checkout-desc">${t('checkout.modal_desc')}</p>
      </div>

      <div class="checkout-plan-summary" data-ref="checkout-plan-summary">
        <div class="checkout-plan-summary__left">
          <div class="checkout-plan-summary__icon">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${iconName}"></use></svg>
          </div>
          <div>
            <h3 class="checkout-plan-summary__title">${intentRes.planName}</h3>
            <p class="checkout-plan-summary__cycle">${cycleLabel}</p>
          </div>
        </div>
        <div class="checkout-plan-summary__price">USD $${formattedAmount}</div>
      </div>

      <div class="checkout-elements-box" data-ref="checkout-elements-box">
        <div class="checkout-elements-loading" data-ref="checkout-elements-loading">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
          <span>Cargando pasarela segura...</span>
        </div>
        <div data-ref="stripe-payment-mount-point"></div>
      </div>

      <div class="modal-card__actions modal-card__actions--stacked" data-ref="checkout-actions">
        <button type="button" class="component-button component-button--black component-button--h45 component-button--w-full" data-ref="btn-submit-payment" disabled>
          <span data-ref="btn-submit-text">Pagar USD $${formattedAmount}</span>
        </button>
        <div class="banner banner--danger is-hidden" data-ref="checkout-error-banner"></div>
      </div>

      <div class="checkout-secure-badge">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#shield"></use></svg>
        <span>${t('checkout.secure_processing')}</span>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  renderIcons(backdrop);

  const mountPoint = backdrop.querySelector<HTMLElement>('[data-ref="stripe-payment-mount-point"]');
  const loadingEl = backdrop.querySelector<HTMLElement>('[data-ref="checkout-elements-loading"]');
  const btnSubmit = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-submit-payment"]');
  const btnSubmitText = backdrop.querySelector<HTMLElement>('[data-ref="btn-submit-text"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="checkout-error-banner"]');
  const btnClose = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-checkout-modal-close"]');

  if (mountPoint) {
    paymentElement.mount(mountPoint);
    paymentElement.on('ready', () => {
      if (loadingEl) loadingEl.classList.add('is-hidden');
      if (btnSubmit) btnSubmit.disabled = false;
    });
    paymentElement.on('change', (e: any) => {
      if (errorBanner) {
        if (e.empty) {
          if (btnSubmit) btnSubmit.disabled = true;
        } else if (e.complete) {
          if (btnSubmit) btnSubmit.disabled = false;
          errorBanner.classList.add('is-hidden');
        }
      }
    });
  }

  let isSubmitting = false;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (isSubmitting || !btnSubmit) return;
    isSubmitting = true;
    btnSubmit.disabled = true;
    if (btnSubmitText) btnSubmitText.textContent = 'Procesando pago...';
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
          errorBanner.textContent = error.message || t('ui.error_al_procesar_el_pago');
          errorBanner.classList.remove('is-hidden');
        }
        isSubmitting = false;
        btnSubmit.disabled = false;
        if (btnSubmitText) btnSubmitText.textContent = `Pagar USD $${formattedAmount}`;
        return;
      }

      if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
        const confirmRes = await confirmSubscriptionPaymentApi(intentRes.subscriptionId, paymentIntent.id);
        const resolvedTier = confirmRes.tier || planId;

        updateUserSubscriptionTier(resolvedTier);
        const avatarEl = document.querySelector<HTMLElement>('[data-ref="btn-user-menu"]');
        applyAvatarTier(avatarEl, resolvedTier);

        closeModal();
        showToast(t('toasts.felicidades_tu_suscripcion_a_esta_activa'), 'success');

        window.dispatchEvent(new CustomEvent('subscription-updated', {
          detail: { tier: resolvedTier, user: currentUser },
        }));

        options.onSuccess?.(resolvedTier);
      } else {
        closeModal();
        showToast(t('toasts.el_pago_esta_en_proceso_de_verificacion'), 'info');
      }
    } catch {
      if (errorBanner) {
        errorBanner.textContent = t('ui.error_inesperado_al_confirmar_la_transac');
        errorBanner.classList.remove('is-hidden');
      }
      isSubmitting = false;
      btnSubmit.disabled = false;
      if (btnSubmitText) btnSubmitText.textContent = `Pagar USD $${formattedAmount}`;
    }
  };

  btnSubmit?.addEventListener('click', handleSubmit);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === backdrop) {
      closeModal();
    }
  };

  const closeModal = () => {
    window.removeEventListener('keydown', handleKeyDown);
    backdrop.removeEventListener('click', handleBackdropClick);
    try {
      paymentElement.destroy();
    } catch {}
    backdrop.remove();
    document.body.classList.remove('modal-open');
    activeCheckoutModal = null;
    options.onCancel?.();
  };

  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });

  window.addEventListener('keydown', handleKeyDown);
  backdrop.addEventListener('click', handleBackdropClick);

  activeCheckoutModal = { close: closeModal };
  return activeCheckoutModal;
}

export { openCheckoutModal };
export type { CheckoutModalOptions };
