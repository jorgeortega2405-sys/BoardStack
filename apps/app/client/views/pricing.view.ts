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
  let currentBusinessSeats = 3;

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
          <span class="component-card-desc" data-ref="plan-subtext-business" style="font-size: 12px; margin-top: 4px; color: var(--text-secondary);">${i18n.t('pricing.business_price_per_user', { price: '9.67' })}</span>
        </div>

        <div class="component-card-section" data-ref="card-seats-selector-business" style="margin-bottom: 8px;">
          <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; background: var(--bg-hover, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${i18n.t('pricing.business_seats_label')}</span>
              <span class="component-badge component-badge--success" data-ref="pricing-seats-counter-val" style="font-size: 12px; font-weight: 700;">${i18n.t('pricing.business_seats_counter', { count: 3 })}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button type="button" class="component-button component-button--secondary component-button--h34" data-ref="btn-pricing-seats-minus" aria-label="${i18n.t('pricing.business_seats_minus')}" style="min-width: 32px; height: 32px; padding: 0;">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#remove"></use></svg>
              </button>
              <input type="range" min="3" max="50" step="1" value="3" data-ref="input-pricing-seats-range" style="flex: 1; accent-color: var(--action-primary, #111827); cursor: pointer;" />
              <button type="button" class="component-button component-button--secondary component-button--h34" data-ref="btn-pricing-seats-plus" aria-label="${i18n.t('pricing.business_seats_plus')}" style="min-width: 32px; height: 32px; padding: 0;">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              </button>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary);">
              <span>${i18n.t('pricing.business_seats_base_note')}</span>
              <span data-ref="pricing-seats-extra-hint">${i18n.t('pricing.business_seats_extra_monthly')}</span>
            </div>
          </div>
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
  const seatsCounterVal = plansBlock.querySelector<HTMLElement>('[data-ref="pricing-seats-counter-val"]');
  const seatsExtraHint = plansBlock.querySelector<HTMLElement>('[data-ref="pricing-seats-extra-hint"]');
  const inputSeatsRange = plansBlock.querySelector<HTMLInputElement>('[data-ref="input-pricing-seats-range"]');
  const btnSeatsMinus = plansBlock.querySelector<HTMLButtonElement>('[data-ref="btn-pricing-seats-minus"]');
  const btnSeatsPlus = plansBlock.querySelector<HTMLButtonElement>('[data-ref="btn-pricing-seats-plus"]');
  const btnGetBusiness = plansBlock.querySelector<HTMLButtonElement>('[data-ref="btn-get-business"]');

  const btnGetEnterprise = plansBlock.querySelector<HTMLButtonElement>('[data-ref="btn-get-enterprise"]');

  const updateBusinessPricing = () => {
    const extraSeats = Math.max(0, currentBusinessSeats - 3);
    if (seatsCounterVal) {
      seatsCounterVal.textContent = i18n.t('pricing.business_seats_counter', { count: currentBusinessSeats });
    }
    if (inputSeatsRange) {
      inputSeatsRange.value = String(currentBusinessSeats);
    }

    if (currentCycle === 'yearly') {
      const baseYearlyPerMonth = 24.00;
      const extraYearlyPerMonth = extraSeats * 5.00;
      const totalMonthEquiv = baseYearlyPerMonth + extraYearlyPerMonth;
      const perUserMonth = (totalMonthEquiv / currentBusinessSeats).toFixed(2);
      const totalAnnualCharged = (totalMonthEquiv * 12).toFixed(2);

      if (priceValBusiness) priceValBusiness.textContent = totalMonthEquiv.toFixed(2);
      if (periodValBusiness) periodValBusiness.textContent = i18n.t('pricing.business_yearly_billed_note', { amount: totalAnnualCharged });
      if (subtextBusiness) subtextBusiness.textContent = i18n.t('pricing.business_price_per_user', { price: perUserMonth });
      if (seatsExtraHint) seatsExtraHint.textContent = i18n.t('pricing.business_seats_extra_yearly');
    } else {
      const baseMonthly = 29.00;
      const extraMonthly = extraSeats * 6.00;
      const totalMonthly = baseMonthly + extraMonthly;
      const perUserMonth = (totalMonthly / currentBusinessSeats).toFixed(2);

      if (priceValBusiness) priceValBusiness.textContent = totalMonthly.toFixed(2);
      if (periodValBusiness) periodValBusiness.textContent = i18n.t('pricing.price_month');
      if (subtextBusiness) subtextBusiness.textContent = i18n.t('pricing.business_price_per_user', { price: perUserMonth });
      if (seatsExtraHint) seatsExtraHint.textContent = i18n.t('pricing.business_seats_extra_monthly');
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

  const setBusinessSeats = (seats: number) => {
    currentBusinessSeats = Math.min(50, Math.max(3, seats));
    updateBusinessPricing();
  };

  btnSeatsMinus?.addEventListener('click', () => setBusinessSeats(currentBusinessSeats - 1));
  btnSeatsPlus?.addEventListener('click', () => setBusinessSeats(currentBusinessSeats + 1));
  inputSeatsRange?.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) setBusinessSeats(val);
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
    navigate(`/checkout?plan=business&cycle=${currentCycle}&seats=${currentBusinessSeats}`);
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
