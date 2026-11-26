import { createFooterComponent } from '../components/footer.component.js';
import { currentUser } from '../services/api.service.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { setupSliderPill } from '../utils/dom.util.js';

async function createPricingView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-layout--full component-main--gap-24';
  container.setAttribute('data-ref', 'pricing-layout');

  let currentCycle: 'monthly' | 'yearly' = 'monthly';

  const isCurrentEnterprise = currentUser?.subscription_tier === 'enterprise';
  const isCurrentBusiness = currentUser?.subscription_tier === 'business';
  const isCurrentPro = currentUser?.subscription_tier === 'pro';

  const plansBlock = document.createElement('div');
  plansBlock.className = 'component-block';
  plansBlock.setAttribute('data-ref', 'pricing-plans-block');
  plansBlock.innerHTML = `
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

    <div class="component-grid component-grid--3-col" data-ref="pricing-plans-grid" style="gap: 20px; align-items: stretch; width: 100%; max-width: 1180px; justify-content: center;">
      
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
            <span class="component-card-price">$<span data-ref="plan-price-val-pro">9.99</span></span>
            <span class="component-card-period" data-ref="plan-period-val-pro">${i18n.t('pricing.price_month')}</span>
          </div>
        </div>

        <div class="component-card-section component-card-section--action" data-ref="card-action-pro">
          <button type="button" class="component-card-button" data-ref="btn-get-pro" ${(isCurrentPro || isCurrentBusiness || isCurrentEnterprise) ? 'disabled' : ''}>
            ${isCurrentPro ? i18n.t('pricing.plan_active') : ((isCurrentBusiness || isCurrentEnterprise) ? i18n.t('pricing.plan_included') : i18n.t('pricing.get_pro'))}
          </button>
        </div>

        <div class="component-card-section component-card-section--features" data-ref="card-features-pro">
          <div class="component-card-features" data-ref="features-container-pro">
            <div class="component-card-feature-item" data-ref="feature-item-storage">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_storage_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_storage_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-slug">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_slug_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_slug_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-persistence">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_persistent_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_persistent_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-expiration">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_expiration_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_expiration_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-permissions">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_controls_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_controls_desc')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="component-card component-card--plan component-card--featured" data-ref="plan-card-business" data-tier="business">
        <div class="component-card-section component-card-section--header" data-ref="card-header-business">
          <h2 class="component-card-title" data-ref="card-title-business">${i18n.t('pricing.business_title')}</h2>
          <p class="component-card-desc" data-ref="card-desc-business">${i18n.t('pricing.business_desc')}</p>
          <span class="component-card-storage-badge" data-ref="storage-badge-business">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
            <span>${i18n.t('pricing.business_storage')}</span>
          </span>
        </div>

        <div class="component-card-section component-card-section--price" data-ref="card-price-business">
          <div class="component-card-price-label" data-ref="plan-price-label-business">${i18n.t('pricing.price_from')}</div>
          <div class="component-card-price-container" data-ref="plan-price-container-business">
            <span class="component-card-price">$<span data-ref="plan-price-val-business">29.00</span></span>
            <span class="component-card-period" data-ref="plan-period-val-business">${i18n.t('pricing.price_month')}</span>
          </div>
          <span class="component-card-desc" data-ref="plan-subtext-business" style="font-size: 12px; margin-top: 4px; color: var(--text-secondary);">${i18n.t('pricing.business_included_seats_price', { price: '9.67' })}</span>
        </div>

        <div class="component-card-section component-card-section--action" data-ref="card-action-business">
          <button type="button" class="component-card-button" data-ref="btn-get-business" ${(isCurrentBusiness || isCurrentEnterprise) ? 'disabled' : ''}>
            ${isCurrentBusiness ? i18n.t('pricing.plan_active') : (isCurrentEnterprise ? i18n.t('pricing.plan_included') : i18n.t('pricing.get_business'))}
          </button>
        </div>

        <div class="component-card-section component-card-section--features" data-ref="card-features-business">
          <div class="component-card-features" data-ref="features-container-business">
            <div class="component-card-feature-item" data-ref="feature-item-biz-seats">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_biz_seats_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_biz_seats_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-biz-storage">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_biz_storage_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_biz_storage_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-biz-rooms">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_biz_rooms_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_biz_rooms_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-biz-sso">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_biz_sso_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_biz_sso_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-biz-org">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_biz_org_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_biz_org_desc')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="component-card component-card--plan component-card--featured" data-ref="plan-card-enterprise" data-tier="enterprise">
        <div class="component-card-section component-card-section--header" data-ref="card-header-enterprise">
          <h2 class="component-card-title" data-ref="card-title-enterprise">${i18n.t('pricing.enterprise_title')}</h2>
          <p class="component-card-desc" data-ref="card-desc-enterprise">${i18n.t('pricing.enterprise_desc')}</p>
        </div>

        <div class="component-card-section component-card-section--price" data-ref="card-price-enterprise">
          <div class="component-card-price-label" data-ref="plan-price-label-enterprise">${i18n.t('pricing.enterprise_custom_pricing_label')}</div>
          <div class="component-card-price-container" data-ref="plan-price-container-enterprise">
            <span class="component-card-price" style="font-size: 26px;"><span data-ref="plan-price-val-enterprise">${i18n.t('pricing.enterprise_custom_price')}</span></span>
          </div>
        </div>

        <div class="component-card-section component-card-section--action" data-ref="card-action-enterprise">
          <button type="button" class="component-card-button" data-ref="btn-get-enterprise" ${isCurrentEnterprise ? 'disabled' : ''}>
            ${isCurrentEnterprise ? i18n.t('pricing.plan_active') : i18n.t('pricing.talk_to_sales')}
          </button>
        </div>

        <div class="component-card-section component-card-section--features" data-ref="card-features-enterprise">
          <div class="component-card-features" data-ref="features-container-enterprise">
            <div class="component-card-feature-item" data-ref="feature-item-ent-storage">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_ent_storage_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_ent_storage_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-ent-seats">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_ent_seats_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_ent_seats_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-ent-sso">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_ent_sso_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_ent_sso_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-ent-pro-perks">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_ent_pro_perks_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_ent_pro_perks_desc')}</span>
              </div>
            </div>

            <div class="component-card-feature-item" data-ref="feature-item-ent-permissions">
              <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
              <div class="component-card-feature-text-container">
                <span class="component-card-feature-title">${i18n.t('pricing.feature_controls_title')}</span>
                <span class="component-card-feature-desc">${i18n.t('pricing.feature_controls_desc')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  const legalBlock = document.createElement('div');
  legalBlock.className = 'component-block component-block--legal';
  legalBlock.setAttribute('data-ref', 'pricing-legal-block');
  legalBlock.innerHTML = `
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
  `;

  const footerBlock = createFooterComponent(navigate);

  renderIcons(plansBlock);
  renderIcons(legalBlock);

  const billingTogglePill = plansBlock.querySelector<HTMLElement>('[data-ref="billing-toggle-pill"]');
  const priceValPro = plansBlock.querySelector<HTMLElement>('[data-ref="plan-price-val-pro"]');
  const periodValPro = plansBlock.querySelector<HTMLElement>('[data-ref="plan-period-val-pro"]');
  const btnGetPro = plansBlock.querySelector<HTMLButtonElement>('[data-ref="btn-get-pro"]');

  const priceValBusiness = plansBlock.querySelector<HTMLElement>('[data-ref="plan-price-val-business"]');
  const periodValBusiness = plansBlock.querySelector<HTMLElement>('[data-ref="plan-period-val-business"]');
  const subtextBusiness = plansBlock.querySelector<HTMLElement>('[data-ref="plan-subtext-business"]');
  const btnGetBusiness = plansBlock.querySelector<HTMLButtonElement>('[data-ref="btn-get-business"]');

  const btnGetEnterprise = plansBlock.querySelector<HTMLButtonElement>('[data-ref="btn-get-enterprise"]');

  const updateBusinessPricing = () => {
    if (currentCycle === 'yearly') {
      if (priceValBusiness) priceValBusiness.textContent = '24.00';
      if (periodValBusiness) periodValBusiness.textContent = i18n.t('pricing.business_yearly_billed_note', { amount: '288.00' });
      if (subtextBusiness) subtextBusiness.textContent = i18n.t('pricing.business_included_seats_price', { price: '8.00' });
    } else {
      if (priceValBusiness) priceValBusiness.textContent = '29.00';
      if (periodValBusiness) periodValBusiness.textContent = i18n.t('pricing.price_month');
      if (subtextBusiness) subtextBusiness.textContent = i18n.t('pricing.business_included_seats_price', { price: '9.67' });
    }
  };

  setupSliderPill(billingTogglePill, (index, tab) => {
    const cycle = (tab.getAttribute('data-cycle') as 'monthly' | 'yearly') || (index === 1 ? 'yearly' : 'monthly');
    currentCycle = cycle;
    if (cycle === 'yearly') {
      if (priceValPro) priceValPro.textContent = '7.99';
      if (periodValPro) periodValPro.textContent = i18n.t('pricing.price_yearly_note');
    } else {
      if (priceValPro) priceValPro.textContent = '9.99';
      if (periodValPro) periodValPro.textContent = i18n.t('pricing.price_month');
    }
    updateBusinessPricing();
  });

  btnGetPro?.addEventListener('click', () => {
    if (isCurrentPro || isCurrentBusiness || isCurrentEnterprise) return;
    if (!currentUser) {
      navigate('/login');
      return;
    }
    navigate(`/checkout?plan=pro&cycle=${currentCycle}`);
  });

  btnGetBusiness?.addEventListener('click', () => {
    if (isCurrentBusiness || isCurrentEnterprise) return;
    if (!currentUser) {
      navigate('/login');
      return;
    }
    navigate(`/checkout?plan=business&cycle=${currentCycle}`);
  });

  btnGetEnterprise?.addEventListener('click', () => {
    if (isCurrentEnterprise) return;
    navigate('/contact-sales');
  });

  container.appendChild(plansBlock);
  container.appendChild(legalBlock);
  container.appendChild(footerBlock);

  return container;
}

export {
  createPricingView
};
