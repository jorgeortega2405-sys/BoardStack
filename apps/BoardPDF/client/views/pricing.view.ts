import { getFooterHtml, mountSiteFooter } from '../components/footer.component.js';
import { getLocalizedPath } from '../config/seo.config.js';
import { claimEducationFreeYearApi, currentUser, updateUserSubscriptionTier, verifySubscriptionSessionApi } from '../services/api.service.js';
import { getCurrentLanguage, t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { applyAvatarTier, getTierDisplayName, getTierWeight, normalizeTier } from '../utils/tier.util.js';

export class PricingController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentCategory: 'education' | 'general' = 'general';
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

    const btnCatGeneral = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-category-general"]');
    const btnCatEducation = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-category-education"]');

    btnCatGeneral?.addEventListener('click', (e) => {
      e.preventDefault();
      this.setCategory('general');
    }, { signal });

    btnCatEducation?.addEventListener('click', (e) => {
      e.preventDefault();
      this.setCategory('education');
    }, { signal });

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
      navigate('/contact/sales');
    }, { signal });

    const btnEduInd = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-edu-individual"]');
    btnEduInd?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.handleEducationClaim();
    }, { signal });

    const btnEduSchool = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-edu-school"]');
    btnEduSchool?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/contact/education?type=school');
    }, { signal });

    const btnEduUni = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-edu-university"]');
    btnEduUni?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/contact/education?type=university');
    }, { signal });
  }

  private setCategory(category: 'education' | 'general'): void {
    this.currentCategory = category;
    const isEducation = category === 'education';

    const pill = this.container.querySelector<HTMLElement>('[data-ref="category-toggle-pill"]');
    if (pill) {
      pill.setAttribute('data-category', category);
    }

    const btnGeneral = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-category-general"]');
    const btnEducation = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-category-education"]');

    if (btnGeneral && btnEducation) {
      btnGeneral.classList.toggle('active', !isEducation);
      btnEducation.classList.toggle('active', isEducation);
    }

    const gridGeneral = this.container.querySelector<HTMLElement>('[data-ref="pricing-grid-general"]');
    const gridEducation = this.container.querySelector<HTMLElement>('[data-ref="pricing-grid-education"]');
    const billingPill = this.container.querySelector<HTMLElement>('[data-ref="billing-toggle-pill"]');

    gridGeneral?.classList.toggle('is-hidden', isEducation);
    gridEducation?.classList.toggle('is-hidden', !isEducation);
    billingPill?.classList.toggle('is-hidden', isEducation);
  }

  private async handleEducationClaim(): Promise<void> {
    if (!currentUser) {
      showToast('Inicia sesión o crea una cuenta con tu correo institucional para activar el beneficio.', 'info');
      navigate('/login');
      return;
    }

    const userTier = normalizeTier(currentUser.subscription_tier);
    if (userTier !== 'free') {
      showToast('Tu cuenta ya tiene un plan activo. Solo puedes mantener un plan a la vez.', 'info');
      return;
    }

    const btnEduInd = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-edu-individual"]');
    if (btnEduInd) {
      btnEduInd.disabled = true;
      btnEduInd.innerHTML = '<span>Verificando...</span>';
    }

    const result = await claimEducationFreeYearApi();
    if (result.success) {
      showToast('¡Felicidades! Se ha activado tu año gratuito de BoardPDF Pro.', 'success');
      this.updateUserTierStatus();
      const avatarEl = document.querySelector<HTMLElement>('[data-ref="btn-user-menu"]');
      applyAvatarTier(avatarEl, 'edu_individual');
    } else {
      showToast(result.error || 'No se pudo reclamar el beneficio.', 'danger');
      if (btnEduInd) {
        btnEduInd.disabled = false;
        btnEduInd.innerHTML = '<span class="component-button__default-text">Reclamar 1 año gratis</span><span class="component-button__hover-text">Canjear con .edu</span>';
      }
    }
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

  private updateUserTierStatus(): void {
    if (!currentUser) return;

    const userTier = normalizeTier(currentUser.subscription_tier);
    const userWeight = getTierWeight(userTier);

    const btnPro = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-pro"]');
    const btnBusiness = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-business"]');

    if (btnPro) {
      if (userWeight === 1) {
        btnPro.classList.add('component-button--disabled');
        btnPro.disabled = true;
        btnPro.innerHTML = '<span>Tu plan actual</span>';
      } else if (userWeight > 1) {
        btnPro.classList.add('component-button--disabled');
        btnPro.disabled = true;
        btnPro.innerHTML = '<span>Incluido en tu plan</span>';
      }
    }

    if (btnBusiness) {
      if (userWeight === 2) {
        btnBusiness.classList.add('component-button--disabled');
        btnBusiness.disabled = true;
        btnBusiness.innerHTML = '<span>Tu plan actual</span>';
      } else if (userWeight === 1) {
        const defaultText = btnBusiness.querySelector<HTMLElement>('.component-button__default-text');
        const hoverText = btnBusiness.querySelector<HTMLElement>('.component-button__hover-text');
        if (defaultText) defaultText.textContent = 'Mejorar a Negocios';
        if (hoverText) hoverText.textContent = 'Mejorar ahora';
      } else if (userWeight > 2) {
        btnBusiness.classList.add('component-button--disabled');
        btnBusiness.disabled = true;
        btnBusiness.innerHTML = '<span>Incluido en tu plan</span>';
      }
    }

    const btnEduInd = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-edu-individual"]');
    if (btnEduInd) {
      if (userTier === 'edu_individual') {
        btnEduInd.classList.add('component-button--disabled');
        btnEduInd.disabled = true;
        btnEduInd.innerHTML = '<span>Tu plan actual</span>';
      } else if (userWeight >= 1) {
        btnEduInd.classList.add('component-button--disabled');
        btnEduInd.disabled = true;
        btnEduInd.innerHTML = '<span>Plan activo</span>';
      }
    }

    const btnEduSchool = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-edu-school"]');
    if (btnEduSchool && userTier === 'edu_school') {
      btnEduSchool.classList.add('component-button--disabled');
      btnEduSchool.disabled = true;
      btnEduSchool.innerHTML = '<span>Tu plan actual</span>';
    }

    const btnEduUni = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-subscribe-edu-university"]');
    if (btnEduUni && userTier === 'edu_university') {
      btnEduUni.classList.add('component-button--disabled');
      btnEduUni.disabled = true;
      btnEduUni.innerHTML = '<span>Tu plan actual</span>';
    }
  }

  private handlePlanAction(tierId: string): void {
    if (!currentUser) {
      showToast(t('upgrade.login_required', 'Inicia sesión para seleccionar un plan.'), 'info');
      navigate('/login');
      return;
    }

    if (tierId !== 'pro' && tierId !== 'business') {
      return;
    }

    const userTier = normalizeTier(currentUser.subscription_tier);
    const userWeight = getTierWeight(userTier);
    const targetWeight = getTierWeight(tierId);

    if (userWeight === targetWeight) {
      showToast(`Ya cuentas con el plan ${tierId === 'business' ? 'Negocios' : 'Pro'} activo.`, 'info');
      return;
    }

    if (userWeight > targetWeight) {
      showToast(`Tu plan actual ${getTierDisplayName(userTier)} ya incluye todas las ventajas de este plan.`, 'info');
      return;
    }

    navigate(`/checkout?plan=${tierId}&cycle=${this.currentCycle}`);
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
