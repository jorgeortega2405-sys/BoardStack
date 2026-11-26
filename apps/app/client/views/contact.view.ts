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

  const contentContainer = document.createElement('div');
  contentContainer.className = 'component-container component-container--wide';
  contentContainer.setAttribute('data-ref', 'contact-content-container');
  contentContainer.style.maxWidth = '1040px';
  contentContainer.style.width = '100%';
  contentContainer.style.margin = '0 auto';
  contentContainer.style.padding = '0';
  contentContainer.innerHTML = `
    <div class="component-grid--2-col-equal" data-ref="contact-grid" style="align-items: stretch; gap: 24px;">
      
      <div data-ref="contact-info-col" style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
        <div class="component-card component-card--feature" data-ref="card-contact-support" style="flex: 1; padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div class="component-card__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#support_agent"></use></svg>
            </div>
            <h2 class="component-title" style="font-size: 16px; margin: 12px 0 6px 0;" data-ref="support-card-title">${i18n.t('contact.support_title')}</h2>
            <p class="component-subtitle" style="font-size: 13.5px; line-height: 1.5;" data-ref="support-card-desc">${i18n.t('contact.support_desc')}</p>
          </div>
          <div class="component-item__actions" style="margin-top: 16px;">
            <button type="button" class="component-button component-button--outline component-button--h34" data-ref="btn-go-faq">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#help"></use></svg>
              <span>${i18n.t('contact.faq_link_text')}</span>
            </button>
          </div>
        </div>

        <div class="component-card component-card--feature" data-ref="card-contact-sales" style="flex: 1; padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div class="component-card__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#domain"></use></svg>
            </div>
            <h2 class="component-title" style="font-size: 16px; margin: 12px 0 6px 0;" data-ref="sales-card-title">${i18n.t('contact.sales_title')}</h2>
            <p class="component-subtitle" style="font-size: 13.5px; line-height: 1.5;" data-ref="sales-card-desc">${i18n.t('contact.sales_desc')}</p>
          </div>
          <div class="component-item__actions" style="margin-top: 16px;">
            <button type="button" class="component-button component-button--black component-button--h34" data-ref="btn-go-sales">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
              <span>${i18n.t('contact.sales_btn')}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="component-card" data-ref="contact-form-card" style="padding: 28px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 18px; background: var(--bg-surface, #ffffff); box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        <div class="component-header" style="margin-bottom: 20px; text-align: left; align-items: flex-start;">
          <h2 class="component-title" data-ref="form-card-title" style="font-size: 18px; font-weight: 700; margin: 0 0 6px 0;">${i18n.t('contact.form_title')}</h2>
          <p class="component-subtitle" data-ref="form-card-subtitle" style="font-size: 13px; margin: 0;">${i18n.t('contact.form_subtitle')}</p>
        </div>

        <form data-ref="contact-form" style="display: flex; flex-direction: column; gap: 14px; width: 100%;">
          <label class="field" data-ref="field-contact-name">
            <input
              type="text"
              class="field__input"
              data-ref="input-contact-name"
              placeholder=" "
              autocomplete="name"
              required
            />
            <span class="field__label" data-ref="label-contact-name">${i18n.t('contact.field_name')}</span>
          </label>

          <label class="field" data-ref="field-contact-email">
            <input
              type="email"
              class="field__input"
              data-ref="input-contact-email"
              placeholder=" "
              autocomplete="email"
              required
            />
            <span class="field__label" data-ref="label-contact-email">${i18n.t('contact.field_email')}</span>
          </label>

          <label class="field" data-ref="field-contact-subject">
            <input
              type="text"
              class="field__input"
              data-ref="input-contact-subject"
              placeholder=" "
              required
            />
            <span class="field__label" data-ref="label-contact-subject">${i18n.t('contact.field_subject')}</span>
          </label>

          <label class="field field--textarea" data-ref="field-contact-message">
            <textarea
              class="field__textarea"
              data-ref="textarea-contact-message"
              placeholder=" "
              required
              rows="4"
            ></textarea>
            <span class="field__label" data-ref="label-contact-message">${i18n.t('contact.field_message')}</span>
          </label>

          <button type="submit" class="component-button component-button--black component-button--h44" data-ref="btn-submit-contact" style="width: 100%; margin-top: 4px;">
            <span>${i18n.t('contact.btn_submit')}</span>
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#send"></use></svg>
          </button>
        </form>
      </div>

    </div>
  `;

  renderIcons(heroBlock);
  renderIcons(contentContainer);

  const goFaqBtn = contentContainer.querySelector<HTMLButtonElement>('[data-ref="btn-go-faq"]');
  goFaqBtn?.addEventListener('click', () => {
    navigate?.('/help');
  });

  const goSalesBtn = contentContainer.querySelector<HTMLButtonElement>('[data-ref="btn-go-sales"]');
  goSalesBtn?.addEventListener('click', () => {
    navigate?.('/contact-sales');
  });

  const formEl = contentContainer.querySelector<HTMLFormElement>('[data-ref="contact-form"]');
  const nameInput = contentContainer.querySelector<HTMLInputElement>('[data-ref="input-contact-name"]');
  const emailInput = contentContainer.querySelector<HTMLInputElement>('[data-ref="input-contact-email"]');
  const subjectInput = contentContainer.querySelector<HTMLInputElement>('[data-ref="input-contact-subject"]');
  const messageInput = contentContainer.querySelector<HTMLTextAreaElement>('[data-ref="textarea-contact-message"]');

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
  container.appendChild(contentContainer);
  container.appendChild(footerBlock);

  return container;
}

export {
  createContactView
};
