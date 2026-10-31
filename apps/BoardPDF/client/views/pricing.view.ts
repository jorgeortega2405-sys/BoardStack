import { getFooterHtml, mountSiteFooter } from '../components/footer.component.js';
import { getLocalizedPath } from '../config/seo.config.js';
import { createCheckoutApi, currentUser, updateUserSubscriptionTier, verifySubscriptionSessionApi } from '../services/api.service.js';
import { getCurrentLanguage, t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { applyAvatarTier } from '../utils/tier.util.js';

export class PricingController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentCycle = 'monthly';
  private footerController: { destroy: () => void } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.bindEvents();
    this.renderFooter();
    renderIcons(this.container);

    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
      void this.handlePaymentReturn(sessionId);
    } else if (paymentStatus === 'cancelled') {
      showToast(t('upgrade.cancelled', 'El proceso de pago fue cancelado.'), 'info');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.footerController) {
      this.footerController.destroy();
      this.footerController = null;
    }
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    const btnMonthly = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cycle-monthly"]');
    const btnYearly = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cycle-yearly"]');

    btnMonthly?.addEventListener('click', (e) => {
      e.preventDefault();
      this.setBillingCycle('monthly');
    }, { signal });

    btnYearly?.addEventListener('click', (e) => {
      e.preventDefault();
      this.setBillingCycle('yearly');
    }, { signal });

    const btnPro = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-pro"]');
    btnPro?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.handlePlanAction('pro');
    }, { signal });

    const btnBusiness = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-business"]');
    btnBusiness?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.handlePlanAction('business');
    }, { signal });

    const btnEnterprise = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-enterprise"]');
    btnEnterprise?.addEventListener('click', (e) => {
      e.preventDefault();
      const currentLang = getCurrentLanguage();
      navigate(getLocalizedPath('contact', currentLang));
    }, { signal });
  }

  private setBillingCycle(cycle: string): void {
    this.currentCycle = cycle;
    const isYearly = cycle === 'yearly';

    const pill = this.container.querySelector<HTMLElement>('[data-ref="billing-toggle-pill"]');
    if (pill) {
      pill.setAttribute('data-cycle', cycle);
    }

    const btnMonthly = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cycle-monthly"]');
    const btnYearly = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cycle-yearly"]');

    if (btnMonthly && btnYearly) {
      if (isYearly) {
        btnMonthly.classList.remove('active');
        btnYearly.classList.add('active');
      } else {
        btnYearly.classList.remove('active');
        btnMonthly.classList.add('active');
      }
    }

    this.updatePriceDisplay('pro', isYearly);
    this.updatePriceDisplay('business', isYearly);
  }

  private updatePriceDisplay(tierId: string, isYearly: boolean): void {
    const priceEl = this.container.querySelector<HTMLElement>(`[data-ref="plan-price-${tierId}"]`);
    const periodEl = this.container.querySelector<HTMLElement>(`[data-ref="plan-period-${tierId}"]`);

    if (priceEl && periodEl) {
      priceEl.style.opacity = '0';
      periodEl.style.opacity = '0';

      setTimeout(() => {
        const monthlyPrice = priceEl.getAttribute('data-monthly') || '0.00';
        const yearlyPrice = priceEl.getAttribute('data-yearly') || '0.00';
        const monthlyPeriod = priceEl.getAttribute('data-period-monthly') || '/ mes';
        const yearlyPeriod = priceEl.getAttribute('data-period-yearly') || '/ mes facturado anualmente';

        priceEl.textContent = isYearly ? yearlyPrice : monthlyPrice;
        periodEl.textContent = isYearly ? yearlyPeriod : monthlyPeriod;

        priceEl.style.opacity = '1';
        periodEl.style.opacity = '1';
      }, 150);
    }
  }

  private async handlePlanAction(tierId: string): Promise<void> {
    if (!currentUser) {
      showToast(t('upgrade.login_required', 'Inicia sesión para seleccionar un plan.'), 'info');
      navigate('/login');
      return;
    }

    const btn = this.container.querySelector<HTMLButtonElement>(`[data-ref="btn-subscribe-${tierId}"]`);
    if (btn) {
      btn.disabled = true;
    }

    try {
      const res = await createCheckoutApi(tierId, this.currentCycle);
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        showToast(res.error || 'No se pudo iniciar el proceso de pago.', 'danger');
        if (btn) btn.disabled = false;
      }
    } catch {
      showToast('Error al conectar con la pasarela de pagos.', 'danger');
      if (btn) btn.disabled = false;
    }
  }

  private async handlePaymentReturn(sessionId: string): Promise<void> {
    try {
      const res = await verifySubscriptionSessionApi(sessionId);
      if (res.success && res.tier) {
        updateUserSubscriptionTier(res.tier);
        const avatarEl = document.querySelector<HTMLElement>('[data-ref="btn-user-menu"]');
        applyAvatarTier(avatarEl, res.tier);
        showToast(t('upgrade.success', '¡Tu suscripción ha sido activada con éxito!'), 'success');
      } else {
        showToast(res.error || 'No se pudo verificar el estado de la suscripción.', 'danger');
      }
    } catch {
      showToast('Error al confirmar tu suscripción.', 'danger');
    } finally {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  private renderFooter(): void {
    const footerContainer = this.container.querySelector<HTMLElement>('[data-ref="pricing-footer-section"]');
    if (!footerContainer) return;

    footerContainer.innerHTML = getFooterHtml();
    this.footerController = mountSiteFooter(footerContainer, this.abortController?.signal);
  }
}

export async function createPricingView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/pricing/pricing.html');
  const controller = new PricingController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
