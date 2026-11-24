import { createFooterComponent } from '../components/footer.component.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';

async function createFeaturesView(navigate?: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-layout--full component-main--gap-24';
  container.setAttribute('data-ref', 'features-layout');

  const heroBlock = document.createElement('div');
  heroBlock.className = 'component-block';
  heroBlock.setAttribute('data-ref', 'features-hero-block');
  heroBlock.innerHTML = `
    <span class="component-badge" data-ref="features-badge">${i18n.t('features.badge')}</span>
    <h1 class="component-title" data-ref="features-title">${i18n.t('features.title')}</h1>
    <p class="component-subtitle" data-ref="features-subtitle">${i18n.t('features.subtitle')}</p>
  `;

  const gridBlock = document.createElement('div');
  gridBlock.className = 'component-block';
  gridBlock.setAttribute('data-ref', 'features-grid-block');
  gridBlock.innerHTML = `
    <div class="component-grid--3-col" data-ref="features-grid">
      <div class="component-card component-card--feature" data-ref="card-feature-p2p">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#bolt"></use></svg>
        </div>
        <span class="component-badge component-badge--sm" data-ref="badge-feature-p2p">${i18n.t('features.p2p_badge')}</span>
        <h2 class="component-title" data-ref="feature-p2p-title">${i18n.t('features.p2p_title')}</h2>
        <p class="component-subtitle" data-ref="feature-p2p-desc">${i18n.t('features.p2p_desc')}</p>
      </div>

      <div class="component-card component-card--feature" data-ref="card-feature-cloud">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
        </div>
        <span class="component-badge component-badge--sm" data-ref="badge-feature-cloud">${i18n.t('features.cloud_badge')}</span>
        <h2 class="component-title" data-ref="feature-cloud-title">${i18n.t('features.cloud_title')}</h2>
        <p class="component-subtitle" data-ref="feature-cloud-desc">${i18n.t('features.cloud_desc')}</p>
      </div>

      <div class="component-card component-card--feature" data-ref="card-feature-rooms">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
        </div>
        <span class="component-badge component-badge--sm" data-ref="badge-feature-rooms">${i18n.t('features.rooms_badge')}</span>
        <h2 class="component-title" data-ref="feature-rooms-title">${i18n.t('features.rooms_title')}</h2>
        <p class="component-subtitle" data-ref="feature-rooms-desc">${i18n.t('features.rooms_desc')}</p>
      </div>

      <div class="component-card component-card--feature" data-ref="card-feature-security">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
        </div>
        <span class="component-badge component-badge--sm" data-ref="badge-feature-security">${i18n.t('features.security_badge')}</span>
        <h2 class="component-title" data-ref="feature-security-title">${i18n.t('features.security_title')}</h2>
        <p class="component-subtitle" data-ref="feature-security-desc">${i18n.t('features.security_desc')}</p>
      </div>

      <div class="component-card component-card--feature" data-ref="card-feature-enterprise">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#domain"></use></svg>
        </div>
        <span class="component-badge component-badge--sm" data-ref="badge-feature-enterprise">${i18n.t('features.enterprise_badge')}</span>
        <h2 class="component-title" data-ref="feature-enterprise-title">${i18n.t('features.enterprise_title')}</h2>
        <p class="component-subtitle" data-ref="feature-enterprise-desc">${i18n.t('features.enterprise_desc')}</p>
      </div>

      <div class="component-card component-card--feature" data-ref="card-feature-design">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
        </div>
        <span class="component-badge component-badge--sm" data-ref="badge-feature-design">${i18n.t('features.design_badge')}</span>
        <h2 class="component-title" data-ref="feature-design-title">${i18n.t('features.design_title')}</h2>
        <p class="component-subtitle" data-ref="feature-design-desc">${i18n.t('features.design_desc')}</p>
      </div>
    </div>
  `;

  const ctaBlock = document.createElement('div');
  ctaBlock.className = 'component-block';
  ctaBlock.setAttribute('data-ref', 'features-cta-block');
  ctaBlock.innerHTML = `
    <div class="component-promo" data-ref="features-promo">
      <div class="component-promo__content" data-ref="features-promo-content">
        <h2 class="component-title" data-ref="features-cta-title">${i18n.t('features.cta_title')}</h2>
        <p class="component-subtitle" data-ref="features-cta-subtitle">${i18n.t('features.cta_subtitle')}</p>
        <div class="component-promo__actions" data-ref="features-cta-actions">
          <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-cta-start-free">
            <span>${i18n.t('features.btn_start_free')}</span>
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
          </button>
          <button type="button" class="component-button component-button--outline component-button--h40" data-ref="btn-cta-view-pricing">
            <span>${i18n.t('features.btn_view_pricing')}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  renderIcons(heroBlock);
  renderIcons(gridBlock);
  renderIcons(ctaBlock);

  const startFreeBtn = ctaBlock.querySelector<HTMLButtonElement>('[data-ref="btn-cta-start-free"]');
  startFreeBtn?.addEventListener('click', () => {
    navigate?.('/');
  });

  const viewPricingBtn = ctaBlock.querySelector<HTMLButtonElement>('[data-ref="btn-cta-view-pricing"]');
  viewPricingBtn?.addEventListener('click', () => {
    navigate?.('/pricing');
  });

  const footerBlock = createFooterComponent(navigate);

  container.appendChild(heroBlock);
  container.appendChild(gridBlock);
  container.appendChild(ctaBlock);
  container.appendChild(footerBlock);

  return container;
}

export {
  createFeaturesView
};
