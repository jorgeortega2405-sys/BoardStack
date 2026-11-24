import { createFooterComponent } from '../components/footer.component.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';

type HelpSection = 'cookies' | 'privacy' | 'security' | 'terms';

async function createHelpView(section: HelpSection = 'terms', navigate?: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-layout--full component-main--gap-24';
  container.setAttribute('data-ref', 'help-layout');

  const contentBlock = document.createElement('div');
  contentBlock.className = 'component-block component-block--legal';
  contentBlock.setAttribute('data-ref', 'help-content-block');

  const headingKey = `help.${section}_heading`;
  const body1Key = `help.${section}_body_1`;
  const body2Key = `help.${section}_body_2`;

  contentBlock.innerHTML = `
    <span class="component-badge" data-ref="help-legal-badge">
      <svg class="component-icon" aria-hidden="true" style="width: 14px; height: 14px;"><use href="/icons.svg#verified_user"></use></svg>
      <span>${i18n.t('help.badge_legal')}</span>
    </span>
    <h1 class="component-title" data-ref="help-title">
      ${i18n.t(headingKey)}
    </h1>
    <p class="component-subtitle" data-ref="help-body-1">
      ${i18n.t(body1Key)}
    </p>
    <p class="component-subtitle" data-ref="help-body-2">
      ${i18n.t(body2Key)}
    </p>
  `;

  renderIcons(contentBlock);

  const footerBlock = createFooterComponent(navigate);

  container.appendChild(contentBlock);
  container.appendChild(footerBlock);

  return container;
}

export {
  createHelpView
};

export type {
  HelpSection
};
