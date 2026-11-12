import { getFooterHtml, mountSiteFooter } from '../components/footer.component.js';
import { openCreateTeamModal } from '../components/modal.component.js';
import { currentUser, hasSubscriptionFeature, updateUserSubscriptionTier, verifySubscriptionSessionApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { applyAvatarTier, getTierWeight, normalizeTier } from '../utils/tier.util.js';

class PricingController implements ViewController {
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
    this.updateUserTierStatus();
    renderIcons(this.container);

    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
      void this.handlePaymentReturn(sessionId);
    } else if (paymentStatus === 'cancelled') {
      showToast(t('pricing.cancelled'), 'info');
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
      priceEl.classList.add('is-fading');
      periodEl.classList.add('is-fading');

      setTimeout(() => {
        const monthlyPrice = priceEl.getAttribute('data-monthly') || '0.00';
        const yearlyPrice = priceEl.getAttribute('data-yearly') || '0.00';
        const monthlyPeriod = t('pricing.period_monthly');
        const yearlyPeriod = t('pricing.period_yearly');

        priceEl.textContent = isYearly ? yearlyPrice : monthlyPrice;
        periodEl.textContent = isYearly ? yearlyPeriod : monthlyPeriod;

        priceEl.classList.remove('is-fading');
        periodEl.classList.remove('is-fading');
      }, 150);
    }
  }

  private updateUserTierStatus(): void {
    if (!currentUser) return;

    const hasPro = hasSubscriptionFeature('pro');
    const hasBusiness = hasSubscriptionFeature('business');

    const btnPro = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-pro"]');
    const btnBusiness = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-business"]');

    if (btnPro) {
      if (hasBusiness) {
        btnPro.classList.add('component-button--disabled');
        btnPro.disabled = true;
        btnPro.innerHTML = `<span>${t('pricing.included_in_plan')}</span>`;
      } else if (hasPro) {
        btnPro.classList.add('component-button--disabled');
        btnPro.disabled = true;
        btnPro.innerHTML = `<span>${t('pricing.current_plan')}</span>`;
      }
    }

    if (btnBusiness) {
      if (hasBusiness) {
        const defaultText = btnBusiness.querySelector<HTMLElement>('.component-button__default-text');
        const hoverText = btnBusiness.querySelector<HTMLElement>('.component-button__hover-text');
        if (defaultText) defaultText.textContent = t('nav.create_team');
        if (hoverText) hoverText.textContent = t('pricing.cta_start_now');
      } else if (hasPro) {
        const defaultText = btnBusiness.querySelector<HTMLElement>('.component-button__default-text');
        const hoverText = btnBusiness.querySelector<HTMLElement>('.component-button__hover-text');
        if (defaultText) defaultText.textContent = t('pricing.upgrade_to_business');
        if (hoverText) hoverText.textContent = t('pricing.upgrade_now');
      }
    }
  }

  private handlePlanAction(tierId: string): void {
    if (!currentUser) {
      showToast(t('pricing.login_required'), 'info');
      navigate('/login');
      return;
    }

    if (tierId !== 'pro' && tierId !== 'business') {
      return;
    }

    const hasPro = hasSubscriptionFeature('pro');
    const hasBusiness = hasSubscriptionFeature('business');

    if (tierId === 'pro') {
      if (hasBusiness) {
        showToast(t('pricing.already_included'), 'info');
        return;
      }
      if (hasPro) {
        showToast(t('pricing.already_active'), 'info');
        return;
      }
    }

    if (tierId === 'business' && hasBusiness) {
      openCreateTeamModal();
      return;
    }

    const extra = tierId === 'business' ? '&flow=create-team' : '';
    navigate(`/checkout?plan=${tierId}&cycle=${this.currentCycle}${extra}`);
  }

  private async handlePaymentReturn(sessionId: string): Promise<void> {
    try {
      const res = await verifySubscriptionSessionApi(sessionId);
      if (res.success && res.tier) {
        updateUserSubscriptionTier(res.tier);
        const avatarEl = document.querySelector<HTMLElement>('[data-ref="btn-user-menu"]');
        applyAvatarTier(avatarEl, res.tier);
        showToast(t('pricing.success'), 'success');
      } else {
        showToast(res.error || t('pricing.verify_error'), 'danger');
      }
    } catch {
      showToast(t('pricing.confirm_error'), 'danger');
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

async function createPricingView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/pricing/pricing.html');
  const controller = new PricingController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { PricingController, createPricingView };
