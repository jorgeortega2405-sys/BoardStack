import { currentUser } from '../services/api.service.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { setupSliderPill } from '../utils/dom.util.js';

async function createPricingView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--narrow component-container--pricing';
  container.setAttribute('data-ref', 'pricing-container');

  let currentCycle: 'monthly' | 'yearly' = 'monthly';
  const isCurrentPro = currentUser?.subscription_tier === 'pro';

  container.innerHTML = `
    <div class="component-header" data-ref="pricing-header-block">
      <h1 class="component-title" data-ref="pricing-title">${i18n.t('pricing.title')}</h1>
      <p class="component-subtitle" data-ref="pricing-subtitle">${i18n.t('pricing.subtitle')}</p>
    </div>

    <div class="component-bar--center" data-ref="pricing-cycle-bar">
      <div class="component-toggle-pill component-toggle-pill--slider" data-ref="billing-toggle-pill" data-cycle="monthly" data-tabs="2" data-active-index="0">
        <div class="component-toggle-indicator" data-ref="billing-toggle-indicator"></div>
        <button type="button" class="component-tab is-active" data-ref="btn-cycle-monthly" data-cycle="monthly">
          ${i18n.t('pricing.billing_monthly')}
        </button>
        <button type="button" class="component-tab" data-ref="btn-cycle-yearly" data-cycle="yearly">
          ${i18n.t('pricing.billing_yearly')}
        </button>
      </div>
    </div>

    <div class="component-card component-card--plan component-card--featured" data-ref="plan-card-pro" data-tier="pro">
      <div class="component-card-section component-card-section--header" data-ref="card-header-pro">
        <h2 class="component-card-title" data-ref="card-title-pro">${i18n.t('pricing.pro_title')}</h2>
        <p class="component-card-desc" data-ref="card-desc-pro">${i18n.t('pricing.pro_desc')}</p>
        <span class="component-card-storage-badge" data-ref="storage-badge-pro">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
          <span>${i18n.t('pricing.pro_storage')}</span>
        </span>
      </div>

      <div class="component-card-section component-card-section--price" data-ref="card-price-pro">
        <div class="component-card-price-label" data-ref="plan-price-label">${i18n.t('pricing.price_from')}</div>
        <div class="component-card-price-container" data-ref="plan-price-container">
          <span class="component-card-price">$<span data-ref="plan-price-val">9.99</span></span>
          <span class="component-card-period" data-ref="plan-period-val">${i18n.t('pricing.price_month')}</span>
        </div>
      </div>

      <div class="component-card-section component-card-section--action" data-ref="card-action-pro">
        <button type="button" class="component-card-button" data-ref="btn-get-pro" ${isCurrentPro ? 'disabled' : ''}>
          ${isCurrentPro ? i18n.t('pricing.plan_active') : i18n.t('pricing.get_pro')}
        </button>
      </div>

      <div class="component-card-section component-card-section--features" data-ref="card-features-pro">
        <div class="component-card-features" data-ref="features-container-pro">
          <div class="component-card-feature-item" data-ref="feature-item-1">
            <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
            <div class="component-card-feature-text-container">
              <span class="component-card-feature-title">${i18n.t('pricing.feature_batch_title')}</span>
              <span class="component-card-feature-desc">${i18n.t('pricing.feature_batch_desc')}</span>
            </div>
          </div>

          <div class="component-card-feature-item" data-ref="feature-item-2">
            <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
            <div class="component-card-feature-text-container">
              <span class="component-card-feature-title">${i18n.t('pricing.feature_files_title')}</span>
              <span class="component-card-feature-desc">${i18n.t('pricing.feature_files_desc')}</span>
            </div>
          </div>

          <div class="component-card-feature-item" data-ref="feature-item-3">
            <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
            <div class="component-card-feature-text-container">
              <span class="component-card-feature-title">${i18n.t('pricing.feature_storage_title')}</span>
              <span class="component-card-feature-desc">${i18n.t('pricing.feature_storage_desc')}</span>
            </div>
          </div>

          <div class="component-card-feature-item" data-ref="feature-item-4">
            <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
            <div class="component-card-feature-text-container">
              <span class="component-card-feature-title">${i18n.t('pricing.feature_ocr_title')}</span>
              <span class="component-card-feature-desc">${i18n.t('pricing.feature_ocr_desc')}</span>
            </div>
          </div>

          <div class="component-card-feature-item" data-ref="feature-item-5">
            <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
            <div class="component-card-feature-text-container">
              <span class="component-card-feature-title">${i18n.t('pricing.feature_workflows_title')}</span>
              <span class="component-card-feature-desc">${i18n.t('pricing.feature_workflows_desc')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="component-group component-group--legal" data-ref="pricing-legal-group">
      <div class="component-item component-item--stacked" data-ref="item-legal-disclaimer">
        <div class="component-item__content" data-ref="content-legal">
          <div class="component-item__text" data-ref="text-legal">
            <h3 class="component-item__title" data-ref="title-legal">${i18n.t('pricing.legal_title')}</h3>
            <p class="component-item__desc" data-ref="desc-legal-availability">${i18n.t('pricing.legal_availability')}</p>
            <p class="component-item__desc" data-ref="desc-legal-age">${i18n.t('pricing.legal_age')}</p>
            <p class="component-item__desc" data-ref="desc-legal-renewal">${i18n.t('pricing.legal_renewal')}</p>
            <p class="component-item__desc" data-ref="desc-legal-cancellation">${i18n.t('pricing.legal_cancellation')}</p>
          </div>
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const billingTogglePill = container.querySelector<HTMLElement>('[data-ref="billing-toggle-pill"]');
  const priceVal = container.querySelector<HTMLElement>('[data-ref="plan-price-val"]');
  const periodVal = container.querySelector<HTMLElement>('[data-ref="plan-period-val"]');
  const btnGetPro = container.querySelector<HTMLButtonElement>('[data-ref="btn-get-pro"]');

  setupSliderPill(billingTogglePill, (index, tab) => {
    const cycle = (tab.getAttribute('data-cycle') as 'monthly' | 'yearly') || (index === 1 ? 'yearly' : 'monthly');
    currentCycle = cycle;
    if (cycle === 'yearly') {
      if (priceVal) priceVal.textContent = '7.99';
      if (periodVal) periodVal.textContent = i18n.t('pricing.price_yearly_note');
    } else {
      if (priceVal) priceVal.textContent = '9.99';
      if (periodVal) periodVal.textContent = i18n.t('pricing.price_month');
    }
  });

  btnGetPro?.addEventListener('click', () => {
    if (isCurrentPro) return;
    if (!currentUser) {
      navigate('/login');
      return;
    }
    navigate(`/checkout?plan=pro&cycle=${currentCycle}`);
  });

  return container;
}

export {
  createPricingView
};
