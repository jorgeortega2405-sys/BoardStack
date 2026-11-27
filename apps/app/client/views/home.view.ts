import { createFooterComponent } from '../components/footer.component.js';
import { createHeaderLogoComponent } from '../components/header-logo.component.js';
import { currentUser, getApi } from '../services/api.service.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { toast } from '../services/toast.service.js';

async function createHomeView(navigate?: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-layout--full component-main--gap-24';
  container.setAttribute('data-ref', 'home-layout');

  const heroBlock = document.createElement('div');
  heroBlock.className = 'component-block';
  heroBlock.setAttribute('data-ref', 'hero-block');

  heroBlock.innerHTML = `
    <h1 class="component-title" data-ref="hero-title">${i18n.t('home.hero_title')}</h1>
    <p class="component-subtitle" data-ref="hero-subtitle">${i18n.t('home.hero_subtitle')}</p>

    <div class="component-search component-search--round" data-ref="room-search-box">
      <div class="component-search__icon" data-ref="room-search-icon">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
      </div>
      <div class="component-search__input-box" data-ref="room-search-input-box">
        <input
          type="text"
          class="component-search__input"
          data-ref="input-room-code"
          placeholder="${i18n.t('home.room_code_placeholder')}"
          autocomplete="off"
          maxlength="64"
          spellcheck="false"
        />
      </div>
      <button type="button" class="component-search__action" data-ref="btn-enter-room" aria-label="${i18n.t('home.btn_enter_room')}" data-tooltip="${i18n.t('home.btn_enter_room')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
      </button>
    </div>
  `;

  const featuresBlock = document.createElement('div');
  featuresBlock.className = 'component-block';
  featuresBlock.setAttribute('data-ref', 'features-block');
  featuresBlock.innerHTML = `
    <span class="component-badge" data-ref="features-badge">${i18n.t('home.features_badge')}</span>
    <h2 class="component-title" data-ref="features-title">${i18n.t('home.features_title')}</h2>
    <p class="component-subtitle" data-ref="features-subtitle">${i18n.t('home.features_subtitle')}</p>

    <div class="component-grid--3-col" data-ref="features-grid">
      <div class="component-card component-card--feature" data-ref="card-feature-p2p">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#bolt"></use></svg>
        </div>
        <h3 class="component-title" data-ref="feature-p2p-title">${i18n.t('home.feature_p2p_title')}</h3>
        <p class="component-subtitle" data-ref="feature-p2p-desc">${i18n.t('home.feature_p2p_desc')}</p>
      </div>

      <div class="component-card component-card--feature" data-ref="card-feature-cloud">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
        </div>
        <h3 class="component-title" data-ref="feature-cloud-title">${i18n.t('home.feature_cloud_title')}</h3>
        <p class="component-subtitle" data-ref="feature-cloud-desc">${i18n.t('home.feature_cloud_desc')}</p>
      </div>

      <div class="component-card component-card--feature" data-ref="card-feature-security">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
        </div>
        <h3 class="component-title" data-ref="feature-security-title">${i18n.t('home.feature_security_title')}</h3>
        <p class="component-subtitle" data-ref="feature-security-desc">${i18n.t('home.feature_security_desc')}</p>
      </div>
    </div>
  `;

  renderIcons(heroBlock);
  renderIcons(featuresBlock);

  const inputEl = heroBlock.querySelector<HTMLInputElement>('[data-ref="input-room-code"]');
  const enterBtn = heroBlock.querySelector<HTMLButtonElement>('[data-ref="btn-enter-room"]');

  const handleJoinRoom = async () => {
    let rawVal = inputEl?.value.trim() || '';
    if (!rawVal) {
      inputEl?.focus();
      return;
    }

    if (rawVal.includes('/')) {
      rawVal = rawVal.split('/').filter(Boolean).pop() || '';
    }

    const noSpaces = rawVal.replace(/\s+/g, '');
    let queryKey = rawVal;
    if (noSpaces.length === 6 && !noSpaces.includes('-') && /^[a-zA-Z0-9]+$/.test(noSpaces)) {
      queryKey = `${noSpaces.slice(0, 3).toUpperCase()}-${noSpaces.slice(3).toUpperCase()}`;
    }

    if (queryKey.length > 64 || !/^[a-zA-Z0-9_\-]+$/.test(queryKey)) {
      toast.error(i18n.t('room.not_found'));
      return;
    }

    enterBtn?.setAttribute('disabled', 'true');
    try {
      let res = await getApi<{ code?: string; ok: boolean; requires_password?: boolean; room_id?: string; slug?: string }>(`/api/rooms/resolve/${encodeURIComponent(queryKey)}`);
      if (!res.ok && queryKey !== rawVal && /^[a-zA-Z0-9_\-]+$/.test(rawVal)) {
        res = await getApi<{ code?: string; ok: boolean; requires_password?: boolean; room_id?: string; slug?: string }>(`/api/rooms/resolve/${encodeURIComponent(rawVal)}`);
      }
      if (res.ok && res.room_id) {
        navigate?.(`/room/${res.slug || res.room_id}`);
      } else {
        toast.error(i18n.t('room.not_found'));
      }
    } catch {
      toast.error(i18n.t('room.not_found'));
    } finally {
      enterBtn?.removeAttribute('disabled');
    }
  };

  enterBtn?.addEventListener('click', () => {
    void handleJoinRoom();
  });

  inputEl?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleJoinRoom();
    }
  });

  const topLogoBlock = createHeaderLogoComponent(navigate);
  container.appendChild(topLogoBlock);
  container.appendChild(heroBlock);
  container.appendChild(featuresBlock);

  const isPro = currentUser?.subscription_tier === 'pro' || currentUser?.subscription_tier === 'business' || currentUser?.subscription_tier === 'enterprise';
  if (!isPro) {
    const proPromoBlock = document.createElement('div');
    proPromoBlock.className = 'component-block';
    proPromoBlock.setAttribute('data-ref', 'pro-promo-block');
    proPromoBlock.innerHTML = `
      <div class="component-promo" data-ref="promo-wrapper">
        <div class="component-promo__content" data-ref="promo-content">
          <span class="component-badge" data-ref="promo-badge">${i18n.t('home.promo_badge')}</span>
          <h2 class="component-title" data-ref="promo-title">${i18n.t('home.promo_title')}</h2>
          <p class="component-subtitle" data-ref="promo-subtitle">${i18n.t('home.promo_subtitle')}</p>

          <div class="component-promo__features" data-ref="promo-features-list">
            <div class="component-promo__feature-item">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
              <span>${i18n.t('home.promo_feat_storage')}</span>
            </div>
            <div class="component-promo__feature-item">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
              <span>${i18n.t('home.promo_feat_slug')}</span>
            </div>
            <div class="component-promo__feature-item">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#bolt"></use></svg>
              <span>${i18n.t('home.promo_feat_persistent')}</span>
            </div>
            <div class="component-promo__feature-item">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
              <span>${i18n.t('home.promo_feat_limits')}</span>
            </div>
          </div>

          <div class="component-promo__actions">
            <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-promo-pricing">
              <span>${i18n.t('home.promo_btn_pricing')}</span>
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
            </button>
          </div>
        </div>

        <div class="component-promo__media" data-ref="promo-media">
          <img class="component-promo__img" data-ref="promo-img" src="/images/modals/upgrade-pro-banner.svg" alt="BoardStack Pro" />
        </div>
      </div>
    `;

    renderIcons(proPromoBlock);

    const promoPricingBtn = proPromoBlock.querySelector<HTMLButtonElement>('[data-ref="btn-promo-pricing"]');
    promoPricingBtn?.addEventListener('click', () => {
      navigate?.('/pricing');
    });

    container.appendChild(proPromoBlock);
  }

  const footerBlock = createFooterComponent(navigate);
  container.appendChild(footerBlock);

  return container;
}

export {
  createHomeView
};
