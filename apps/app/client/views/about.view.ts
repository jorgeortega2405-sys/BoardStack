import { createFooterComponent } from '../components/footer.component.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';

async function createAboutView(navigate?: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-layout--full component-main--gap-24';
  container.setAttribute('data-ref', 'about-layout');

  const heroBlock = document.createElement('div');
  heroBlock.className = 'component-block';
  heroBlock.setAttribute('data-ref', 'about-hero-block');
  heroBlock.innerHTML = `
    <span class="component-badge" data-ref="about-badge">${i18n.t('about.badge')}</span>
    <h1 class="component-title" data-ref="about-title">${i18n.t('about.title')}</h1>
    <p class="component-subtitle" data-ref="about-subtitle">${i18n.t('about.subtitle')}</p>
  `;

  const missionBlock = document.createElement('div');
  missionBlock.className = 'component-block component-block--legal';
  missionBlock.setAttribute('data-ref', 'about-mission-block');
  missionBlock.innerHTML = `
    <span class="component-badge" data-ref="mission-badge">
      <svg class="component-icon" aria-hidden="true" style="width: 14px; height: 14px;"><use href="/icons.svg#verified_user"></use></svg>
      <span>${i18n.t('about.mission_badge')}</span>
    </span>
    <h2 class="component-title" data-ref="mission-title">${i18n.t('about.mission_title')}</h2>
    <p class="component-subtitle" data-ref="mission-desc-1">${i18n.t('about.mission_desc_1')}</p>
    <p class="component-subtitle" data-ref="mission-desc-2">${i18n.t('about.mission_desc_2')}</p>
  `;

  const valuesBlock = document.createElement('div');
  valuesBlock.className = 'component-block';
  valuesBlock.setAttribute('data-ref', 'about-values-block');
  valuesBlock.innerHTML = `
    <span class="component-badge" data-ref="values-badge">${i18n.t('about.values_badge')}</span>
    <h2 class="component-title" data-ref="values-title">${i18n.t('about.values_title')}</h2>

    <div class="component-grid--2-col" data-ref="values-grid">
      <div class="component-card component-card--feature" data-ref="card-val-privacy">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
        </div>
        <h3 class="component-title" data-ref="val-privacy-title">${i18n.t('about.val_privacy_title')}</h3>
        <p class="component-subtitle" data-ref="val-privacy-desc">${i18n.t('about.val_privacy_desc')}</p>
      </div>

      <div class="component-card component-card--feature" data-ref="card-val-speed">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#bolt"></use></svg>
        </div>
        <h3 class="component-title" data-ref="val-speed-title">${i18n.t('about.val_speed_title')}</h3>
        <p class="component-subtitle" data-ref="val-speed-desc">${i18n.t('about.val_speed_desc')}</p>
      </div>

      <div class="component-card component-card--feature" data-ref="card-val-security">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#shield"></use></svg>
        </div>
        <h3 class="component-title" data-ref="val-security-title">${i18n.t('about.val_security_title')}</h3>
        <p class="component-subtitle" data-ref="val-security-desc">${i18n.t('about.val_security_desc')}</p>
      </div>

      <div class="component-card component-card--feature" data-ref="card-val-accessibility">
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#accessibility_new"></use></svg>
        </div>
        <h3 class="component-title" data-ref="val-accessibility-title">${i18n.t('about.val_accessibility_title')}</h3>
        <p class="component-subtitle" data-ref="val-accessibility-desc">${i18n.t('about.val_accessibility_desc')}</p>
      </div>
    </div>
  `;

  const quoteBlock = document.createElement('div');
  quoteBlock.className = 'component-block';
  quoteBlock.setAttribute('data-ref', 'about-quote-block');
  quoteBlock.innerHTML = `
    <div class="component-card component-card--feature" data-ref="about-quote-card" style="text-align: center; padding: 36px 24px;">
      <p class="component-title" style="font-size: 18px; font-weight: 500; font-style: italic; margin-bottom: 12px; line-height: 1.5;" data-ref="quote-text">
        "${i18n.t('about.quote_text')}"
      </p>
      <p class="component-subtitle" style="font-size: 13.5px;" data-ref="quote-author">
        ${i18n.t('about.quote_author')}
      </p>
    </div>
  `;

  renderIcons(heroBlock);
  renderIcons(missionBlock);
  renderIcons(valuesBlock);

  const footerBlock = createFooterComponent(navigate);

  container.appendChild(heroBlock);
  container.appendChild(missionBlock);
  container.appendChild(valuesBlock);
  container.appendChild(quoteBlock);
  container.appendChild(footerBlock);

  return container;
}

export {
  createAboutView
};
