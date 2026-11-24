import { createFooterComponent } from '../components/footer.component.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { toast } from '../services/toast.service.js';

async function createContactView(navigate?: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-layout--full component-main--gap-24';
  container.setAttribute('data-ref', 'contact-layout');

  const heroBlock = document.createElement('div');
  heroBlock.className = 'component-block';
  heroBlock.setAttribute('data-ref', 'contact-hero-block');
  heroBlock.innerHTML = `
    <span class="component-badge" data-ref="contact-badge">${i18n.t('contact.badge')}</span>
    <h1 class="component-title" data-ref="contact-title">${i18n.t('contact.title')}</h1>
    <p class="component-subtitle" data-ref="contact-subtitle">${i18n.t('contact.subtitle')}</p>
  `;

  const mainBlock = document.createElement('div');
  mainBlock.className = 'component-block';
  mainBlock.setAttribute('data-ref', 'contact-main-block');
  mainBlock.innerHTML = `
    <div class="component-grid component-grid--2-col" data-ref="contact-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; width: 100%;">
      
      <div class="component-group" data-ref="contact-info-col" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="component-card component-card--feature" data-ref="card-contact-support" style="padding: 24px;">
          <div class="component-card__icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#support_agent"></use></svg>
          </div>
          <h2 class="component-title" data-ref="support-card-title">${i18n.t('contact.support_title')}</h2>
          <p class="component-subtitle" data-ref="support-card-desc">${i18n.t('contact.support_desc')}</p>
          <div class="component-item__actions" style="margin-top: 12px;">
            <button type="button" class="component-button component-button--outline component-button--h34" data-ref="btn-go-faq">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#help"></use></svg>
              <span>${i18n.t('contact.faq_link_text')}</span>
            </button>
          </div>
        </div>

        <div class="component-card component-card--feature" data-ref="card-contact-sales" style="padding: 24px;">
          <div class="component-card__icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#domain"></use></svg>
          </div>
          <h2 class="component-title" data-ref="sales-card-title">${i18n.t('contact.sales_title')}</h2>
          <p class="component-subtitle" data-ref="sales-card-desc">${i18n.t('contact.sales_desc')}</p>
          <div class="component-item__actions" style="margin-top: 12px;">
            <button type="button" class="component-button component-button--black component-button--h34" data-ref="btn-go-sales">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
              <span>${i18n.t('contact.sales_btn')}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="component-card" data-ref="contact-form-card" style="padding: 28px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 16px; background: var(--bg-surface, #ffffff);">
        <div class="component-header" style="margin-bottom: 20px;">
          <h2 class="component-title" data-ref="form-card-title" style="font-size: 18px; margin: 0 0 6px 0;">${i18n.t('contact.form_title')}</h2>
          <p class="component-subtitle" data-ref="form-card-subtitle" style="font-size: 13px; margin: 0;">${i18n.t('contact.form_subtitle')}</p>
        </div>

        <form data-ref="contact-form" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="component-item component-item--stacked" style="display: flex; flex-direction: column; gap: 6px; align-items: stretch;">
            <label class="component-label" for="field-contact-name" style="font-size: 12.5px; font-weight: 500;">
              ${i18n.t('contact.field_name')} *
            </label>
            <input
              type="text"
              class="field__input--simple"
              id="field-contact-name"
              data-ref="input-contact-name"
              placeholder="${i18n.t('contact.field_name_placeholder')}"
              autocomplete="name"
              required
              style="width: 100%; height: 38px;"
            />
          </div>

          <div class="component-item component-item--stacked" style="display: flex; flex-direction: column; gap: 6px; align-items: stretch;">
            <label class="component-label" for="field-contact-email" style="font-size: 12.5px; font-weight: 500;">
              ${i18n.t('contact.field_email')} *
            </label>
            <input
              type="email"
              class="field__input--simple"
              id="field-contact-email"
              data-ref="input-contact-email"
              placeholder="${i18n.t('contact.field_email_placeholder')}"
              autocomplete="email"
              required
              style="width: 100%; height: 38px;"
            />
          </div>

          <div class="component-item component-item--stacked" style="display: flex; flex-direction: column; gap: 6px; align-items: stretch;">
            <label class="component-label" for="field-contact-subject" style="font-size: 12.5px; font-weight: 500;">
              ${i18n.t('contact.field_subject')} *
            </label>
            <input
              type="text"
              class="field__input--simple"
              id="field-contact-subject"
              data-ref="input-contact-subject"
              placeholder="${i18n.t('contact.field_subject_placeholder')}"
              required
              style="width: 100%; height: 38px;"
            />
          </div>

          <div class="component-item component-item--stacked" style="display: flex; flex-direction: column; gap: 6px; align-items: stretch;">
            <label class="component-label" for="field-contact-message" style="font-size: 12.5px; font-weight: 500;">
              ${i18n.t('contact.field_message')} *
            </label>
            <textarea
              class="field__input--simple"
              id="field-contact-message"
              data-ref="textarea-contact-message"
              placeholder="${i18n.t('contact.field_message_placeholder')}"
              required
              rows="4"
              style="width: 100%; height: auto; min-height: 100px; padding: 10px 12px; resize: vertical;"
            ></textarea>
          </div>

          <button type="submit" class="component-button component-button--black component-button--h40" data-ref="btn-submit-contact" style="width: 100%; margin-top: 8px;">
            <span>${i18n.t('contact.btn_submit')}</span>
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#send"></use></svg>
          </button>
        </form>
      </div>

    </div>
  `;

  renderIcons(heroBlock);
  renderIcons(mainBlock);

  const goFaqBtn = mainBlock.querySelector<HTMLButtonElement>('[data-ref="btn-go-faq"]');
  goFaqBtn?.addEventListener('click', () => {
    navigate?.('/help');
  });

  const goSalesBtn = mainBlock.querySelector<HTMLButtonElement>('[data-ref="btn-go-sales"]');
  goSalesBtn?.addEventListener('click', () => {
    navigate?.('/contact-sales');
  });

  const formEl = mainBlock.querySelector<HTMLFormElement>('[data-ref="contact-form"]');
  const nameInput = mainBlock.querySelector<HTMLInputElement>('[data-ref="input-contact-name"]');
  const emailInput = mainBlock.querySelector<HTMLInputElement>('[data-ref="input-contact-email"]');
  const subjectInput = mainBlock.querySelector<HTMLInputElement>('[data-ref="input-contact-subject"]');
  const messageInput = mainBlock.querySelector<HTMLTextAreaElement>('[data-ref="textarea-contact-message"]');

  formEl?.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const nameVal = nameInput?.value.trim() || '';
    const emailVal = emailInput?.value.trim() || '';
    const subjectVal = subjectInput?.value.trim() || '';
    const messageVal = messageInput?.value.trim() || '';

    if (!nameVal || !emailVal || !subjectVal || !messageVal) {
      toast.error(i18n.t('contact.err_required'));
      return;
    }

    toast.success(i18n.t('contact.success_mock'));
    formEl.reset();
  });

  const footerBlock = createFooterComponent(navigate);

  container.appendChild(heroBlock);
  container.appendChild(mainBlock);
  container.appendChild(footerBlock);

  return container;
}

export {
  createContactView
};
