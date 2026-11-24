import { createFooterComponent } from '../components/footer.component.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';

type HelpSection = 'cookies' | 'faq' | 'privacy' | 'security' | 'terms';

async function createHelpView(section: HelpSection = 'faq', navigate?: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-layout--full component-main--gap-24';
  container.setAttribute('data-ref', 'help-layout');

  if (section === 'faq') {
    const heroBlock = document.createElement('div');
    heroBlock.className = 'component-block';
    heroBlock.setAttribute('data-ref', 'help-hero-block');
    heroBlock.innerHTML = `
      <span class="component-badge" data-ref="help-faq-badge">
        <svg class="component-icon" aria-hidden="true" style="width: 14px; height: 14px;"><use href="/icons.svg#help"></use></svg>
        <span>${i18n.t('help.badge_faq')}</span>
      </span>
      <h1 class="component-title" data-ref="help-title">${i18n.t('help.faq_heading')}</h1>
      <p class="component-subtitle" data-ref="help-subtitle">${i18n.t('help.faq_subtitle')}</p>
    `;

    const faqBlock = document.createElement('div');
    faqBlock.className = 'component-block';
    faqBlock.setAttribute('data-ref', 'help-faq-block');

    const faqItems = [
      { a: i18n.t('help.faq_a1'), id: '1', q: i18n.t('help.faq_q1') },
      { a: i18n.t('help.faq_a2'), id: '2', q: i18n.t('help.faq_q2') },
      { a: i18n.t('help.faq_a3'), id: '3', q: i18n.t('help.faq_q3') },
      { a: i18n.t('help.faq_a4'), id: '4', q: i18n.t('help.faq_q4') },
      { a: i18n.t('help.faq_a5'), id: '5', q: i18n.t('help.faq_q5') },
      { a: i18n.t('help.faq_a6'), id: '6', q: i18n.t('help.faq_q6') },
      { a: i18n.t('help.faq_a7'), id: '7', q: i18n.t('help.faq_q7') },
      { a: i18n.t('help.faq_a8'), id: '8', q: i18n.t('help.faq_q8') },
    ];

    faqBlock.innerHTML = `
      <div class="component-group" data-ref="faq-accordion-group" style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 840px;">
        ${faqItems.map((item, idx) => `
          <div class="component-group component-group--accordion ${idx === 0 ? 'is-active' : ''}" data-ref="faq-item-${item.id}">
            <div class="component-accordion-header" data-ref="faq-header-${item.id}">
              <h3 class="component-title" style="font-size: 15px; margin: 0;" data-ref="faq-question-${item.id}">${item.q}</h3>
              <span class="component-accordion-icon" data-ref="faq-icon-${item.id}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </span>
            </div>
            <div class="component-accordion-body" data-ref="faq-body-${item.id}">
              <div class="component-accordion-content" style="padding: 16px 24px;">
                <p class="component-subtitle" style="font-size: 14px; line-height: 1.6; margin: 0;" data-ref="faq-answer-${item.id}">${item.a}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="component-card component-card--feature" data-ref="faq-contact-card" style="text-align: center; align-items: center; padding: 28px; margin-top: 16px; width: 100%; max-width: 840px;">
        <p class="component-title" style="font-size: 15px; margin-bottom: 6px;" data-ref="faq-contact-prompt">${i18n.t('help.faq_contact_prompt')}</p>
        <button type="button" class="component-button component-button--black component-button--h34" data-ref="btn-faq-contact">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#mail"></use></svg>
          <span>${i18n.t('help.faq_contact_btn')}</span>
        </button>
      </div>
    `;

    renderIcons(heroBlock);
    renderIcons(faqBlock);

    faqBlock.querySelectorAll<HTMLElement>('.component-accordion-header').forEach((header) => {
      header.addEventListener('click', () => {
        const parentGroup = header.closest('.component-group--accordion');
        parentGroup?.classList.toggle('is-active');
      });
    });

    const contactBtn = faqBlock.querySelector<HTMLButtonElement>('[data-ref="btn-faq-contact"]');
    contactBtn?.addEventListener('click', () => {
      navigate?.('/contact');
    });

    container.appendChild(heroBlock);
    container.appendChild(faqBlock);
  } else {
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
    container.appendChild(contentBlock);
  }

  const footerBlock = createFooterComponent(navigate);
  container.appendChild(footerBlock);

  return container;
}

export {
  createHelpView
};

export type {
  HelpSection
};
