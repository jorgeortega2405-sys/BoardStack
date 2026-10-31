import { confirmSubscriptionPaymentApi, createSubscriptionIntentApi, currentUser, updateUserSubscriptionTier } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { getStripeAppearance, loadStripeSdk } from '../services/stripe.service.js';
import { showToast } from '../services/toast.service.js';
import { applyAvatarTier } from '../utils/tier.util.js';

export interface CheckoutModalOptions {
  billingPeriod?: 'monthly' | 'yearly';
  onCancel?: () => void;
  onSuccess?: (tier: string) => void;
  planId: 'pro' | 'business';
}

let activeCheckoutModal: { close: () => void } | null = null;

export async function openCheckoutModal(options: CheckoutModalOptions): Promise<{ close: () => void } | null> {
  if (activeCheckoutModal) {
    activeCheckoutModal.close();
  }

  const billingPeriod = options.billingPeriod || 'monthly';
  const planId = options.planId;
  const isYearly = billingPeriod === 'yearly';

  const intentRes = await createSubscriptionIntentApi(planId, billingPeriod);
  if (!intentRes.success || !intentRes.clientSecret || !intentRes.publishableKey) {
    showToast(intentRes.error || t('common.error_occurred') || 'Error al conectar con Stripe.', 'danger');
    return null;
  }

  let stripe: any = null;
  try {
    stripe = await loadStripeSdk(intentRes.publishableKey);
  } catch {
    showToast('No se pudo inicializar Stripe Elements.', 'danger');
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
      <div class="modal-card__header" data-ref="modal-checkout-header" style="position: relative;">
        <button type="button" class="modal-close-btn" data-ref="btn-checkout-modal-close" aria-label="Cerrar">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
        <h2 class="modal-card__title" data-ref="checkout-title" style="font-size: 18px; margin: 0;">Completa tu suscripción</h2>
        <p class="modal-card__description" data-ref="checkout-desc" style="font-size: 13px; margin: 0; color: var(--text-secondary);">Acceso instantáneo con procesamiento seguro de Stripe.</p>
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
          <svg class="component-icon" aria-hidden="true" style="animation: spin 1s linear infinite;"><use href="/icons.svg#autorenew"></use></svg>
          <span>Cargando pasarela segura...</span>
        </div>
        <div data-ref="stripe-payment-mount-point"></div>
      </div>

      <div class="modal-card__actions modal-card__actions--stacked" data-ref="checkout-actions" style="margin-top: 4px;">
        <button type="button" class="component-button component-button--black component-button--h45 component-button--w-full" data-ref="btn-submit-payment" disabled>
          <span data-ref="btn-submit-text">Pagar USD $${formattedAmount}</span>
        </button>
        <div class="banner banner--danger" data-ref="checkout-error-banner" style="display: none; margin-top: 12px; width: 100%;"></div>
      </div>

      <div class="checkout-secure-badge">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#shield"></use></svg>
        <span>Procesamiento cifrado SSL de 256 bits respaldado por Stripe</span>
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
      if (loadingEl) loadingEl.style.display = 'none';
      if (btnSubmit) btnSubmit.disabled = false;
    });
    paymentElement.on('change', (e: any) => {
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

  let isSubmitting = false;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (isSubmitting || !btnSubmit) return;
    isSubmitting = true;
    btnSubmit.disabled = true;
    if (btnSubmitText) btnSubmitText.textContent = 'Procesando pago...';
    if (errorBanner) errorBanner.style.display = 'none';

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
          errorBanner.textContent = error.message || 'Error al procesar el pago.';
          errorBanner.style.display = 'block';
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
        showToast(`¡Felicidades! Tu suscripción a ${intentRes.planName} está activa.`, 'success');

        window.dispatchEvent(new CustomEvent('subscription-updated', {
          detail: { tier: resolvedTier, user: currentUser },
        }));

        options.onSuccess?.(resolvedTier);
      } else {
        closeModal();
        showToast('El pago está en proceso de verificación.', 'info');
      }
    } catch {
      if (errorBanner) {
        errorBanner.textContent = 'Error inesperado al confirmar la transacción.';
        errorBanner.style.display = 'block';
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
