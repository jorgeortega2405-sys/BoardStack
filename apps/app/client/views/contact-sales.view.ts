import { createFooterComponent } from '../components/footer.component.js';
import { i18n } from '../i18n/i18n.service.js';
import { currentUser, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { toast } from '../services/toast.service.js';
import { setupDropdown } from '../utils/dom.util.js';

interface LeadFormState {
  companyName: string;
  companySize: string;
  country: string;
  firstName: string;
  hearAbout: string;
  lastName: string;
  notes: string;
  phoneNumber: string;
  roleLevel: string;
  workEmail: string;
}

async function createContactSalesView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-layout--full component-main--gap-24';
  container.setAttribute('data-ref', 'contact-sales-layout');

  const formState: LeadFormState = {
    companyName: '',
    companySize: '',
    country: '',
    firstName: currentUser?.username || '',
    hearAbout: '',
    lastName: '',
    notes: '',
    phoneNumber: '',
    roleLevel: '',
    workEmail: currentUser?.email || '',
  };

  const heroBlock = document.createElement('div');
  heroBlock.className = 'component-block';
  heroBlock.setAttribute('data-ref', 'sales-hero-block');
  heroBlock.innerHTML = `
    <span class="component-badge" data-ref="sales-badge">${i18n.t('sales.badge')}</span>
    <h1 class="component-title" data-ref="sales-title">${i18n.t('sales.title')}</h1>
    <p class="component-subtitle" data-ref="sales-subtitle">${i18n.t('sales.subtitle')}</p>
  `;

  const formContainer = document.createElement('div');
  formContainer.className = 'component-container component-container--narrow';
  formContainer.setAttribute('data-ref', 'sales-form-container');
  formContainer.style.maxWidth = '640px';
  formContainer.style.width = '100%';
  formContainer.style.margin = '0 auto';
  formContainer.style.padding = '0';
  formContainer.innerHTML = `
    <div class="component-card" data-ref="sales-form-card" style="position: relative; overflow: hidden; padding: 32px 28px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 20px; background: var(--bg-surface, #ffffff); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05); width: 100%; box-sizing: border-box;">
      
      <div class="component-card__progress" data-ref="sales-top-progress">
        <div class="component-card__progress-bar" data-ref="sales-progress-bar" style="width: 50%;"></div>
      </div>

      <div data-ref="sales-form-header" style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span class="component-badge" data-ref="sales-step-counter">
            ${i18n.t('sales.step_counter', { current: 1, total: 2 })}
          </span>
          <span class="component-subtitle" data-ref="sales-step-percent" style="font-size: 12.5px; font-weight: 600;">50%</span>
        </div>
      </div>

      <div data-ref="sales-step-1" style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <h2 class="component-title" style="font-size: 18px; font-weight: 700; margin: 0 0 6px 0;">${i18n.t('sales.step_1_title')}</h2>
          <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary); margin: 0;">${i18n.t('sales.step_1_subtitle')}</p>
        </div>

        <div class="component-grid--2-col-equal" style="gap: 12px;">
          <label class="field" data-ref="field-sales-first-name">
            <input
              type="text"
              class="field__input"
              data-ref="input-sales-first-name"
              placeholder=" "
              autocomplete="given-name"
              value="${formState.firstName}"
              required
            />
            <span class="field__label" data-ref="label-sales-first-name">${i18n.t('sales.first_name_label')} *</span>
          </label>

          <label class="field" data-ref="field-sales-last-name">
            <input
              type="text"
              class="field__input"
              data-ref="input-sales-last-name"
              placeholder=" "
              autocomplete="family-name"
              value="${formState.lastName}"
              required
            />
            <span class="field__label" data-ref="label-sales-last-name">${i18n.t('sales.last_name_label')} *</span>
          </label>
        </div>

        <label class="field" data-ref="field-sales-work-email">
          <input
            type="email"
            class="field__input"
            data-ref="input-sales-work-email"
            placeholder=" "
            autocomplete="email"
            value="${formState.workEmail}"
            required
          />
          <span class="field__label" data-ref="label-sales-work-email">${i18n.t('sales.work_email_label')} *</span>
        </label>

        <div class="component-dropdown component-dropdown--field" data-ref="dropdown-wrapper-hear-about">
          <button type="button" class="component-dropdown__trigger" data-ref="btn-trigger-hear-about" aria-label="${i18n.t('sales.hear_about_label')}">
            <div class="component-dropdown__trigger-left">
              <span class="component-dropdown__label">${i18n.t('sales.hear_about_label')} *</span>
              <span class="component-dropdown__trigger-text" data-ref="hear-about-selected-text">${formState.hearAbout ? formState.hearAbout : i18n.t('sales.hear_about_select')}</span>
            </div>
            <svg class="component-icon component-dropdown__trigger-chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>
          <div class="component-menu-backdrop" data-ref="dropdown-backdrop-hear-about">
            <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto" data-ref="dropdown-menu-hear-about">
              <div class="component-menu__list">
                <button type="button" class="component-menu__item" data-value="Google Search">
                  <span class="component-menu__item-text">${i18n.t('sales.hear_about_search')}</span>
                </button>
                <button type="button" class="component-menu__item" data-value="Social Media">
                  <span class="component-menu__item-text">${i18n.t('sales.hear_about_social')}</span>
                </button>
                <button type="button" class="component-menu__item" data-value="Colleague">
                  <span class="component-menu__item-text">${i18n.t('sales.hear_about_colleague')}</span>
                </button>
                <button type="button" class="component-menu__item" data-value="Press / Blog">
                  <span class="component-menu__item-text">${i18n.t('sales.hear_about_press')}</span>
                </button>
                <button type="button" class="component-menu__item" data-value="Event">
                  <span class="component-menu__item-text">${i18n.t('sales.hear_about_event')}</span>
                </button>
                <button type="button" class="component-menu__item" data-value="Other">
                  <span class="component-menu__item-text">${i18n.t('sales.hear_about_other')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top: 8px;">
          <button type="button" class="component-button component-button--black component-button--h44 component-button--w-full" data-ref="btn-sales-next">
            <span>${i18n.t('sales.btn_next')}</span>
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
          </button>
        </div>
      </div>

      <div data-ref="sales-step-2" style="display: none; flex-direction: column; gap: 16px;">
        <div>
          <h2 class="component-title" style="font-size: 18px; font-weight: 700; margin: 0 0 6px 0;">${i18n.t('sales.step_2_title')}</h2>
          <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary); margin: 0;">${i18n.t('sales.step_2_subtitle')}</p>
        </div>

        <div class="component-grid--2-col-equal" style="gap: 12px;">
          <label class="field" data-ref="field-sales-company-name">
            <input
              type="text"
              class="field__input"
              data-ref="input-sales-company-name"
              placeholder=" "
              autocomplete="organization"
              value="${formState.companyName}"
              required
            />
            <span class="field__label" data-ref="label-sales-company-name">${i18n.t('sales.company_name_label')} *</span>
          </label>

          <div class="component-dropdown component-dropdown--field" data-ref="dropdown-wrapper-company-size">
            <button type="button" class="component-dropdown__trigger" data-ref="btn-trigger-company-size" aria-label="${i18n.t('sales.company_size_label')}">
              <div class="component-dropdown__trigger-left">
                <span class="component-dropdown__label">${i18n.t('sales.company_size_label')} *</span>
                <span class="component-dropdown__trigger-text" data-ref="company-size-selected-text">${formState.companySize ? formState.companySize : i18n.t('sales.company_size_select')}</span>
              </div>
              <svg class="component-icon component-dropdown__trigger-chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
            </button>
            <div class="component-menu-backdrop" data-ref="dropdown-backdrop-company-size">
              <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto" data-ref="dropdown-menu-company-size">
                <div class="component-menu__list">
                  <button type="button" class="component-menu__item" data-value="1-10">
                    <span class="component-menu__item-text">${i18n.t('sales.company_size_1_10')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-value="11-50">
                    <span class="component-menu__item-text">${i18n.t('sales.company_size_11_50')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-value="51-200">
                    <span class="component-menu__item-text">${i18n.t('sales.company_size_51_200')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-value="201-1000">
                    <span class="component-menu__item-text">${i18n.t('sales.company_size_201_1000')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-value="1000+">
                    <span class="component-menu__item-text">${i18n.t('sales.company_size_1000_plus')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="component-grid--2-col-equal" style="gap: 12px;">
          <label class="field" data-ref="field-sales-country">
            <input
              type="text"
              class="field__input"
              data-ref="input-sales-country"
              placeholder=" "
              autocomplete="country-name"
              value="${formState.country}"
              required
            />
            <span class="field__label" data-ref="label-sales-country">${i18n.t('sales.country_label')} *</span>
          </label>

          <div class="component-dropdown component-dropdown--field" data-ref="dropdown-wrapper-role-level">
            <button type="button" class="component-dropdown__trigger" data-ref="btn-trigger-role-level" aria-label="${i18n.t('sales.role_level_label')}">
              <div class="component-dropdown__trigger-left">
                <span class="component-dropdown__label">${i18n.t('sales.role_level_label')} *</span>
                <span class="component-dropdown__trigger-text" data-ref="role-level-selected-text">${formState.roleLevel ? formState.roleLevel : i18n.t('sales.role_level_select')}</span>
              </div>
              <svg class="component-icon component-dropdown__trigger-chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
            </button>
            <div class="component-menu-backdrop" data-ref="dropdown-backdrop-role-level">
              <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto" data-ref="dropdown-menu-role-level">
                <div class="component-menu__list">
                  <button type="button" class="component-menu__item" data-value="c_level">
                    <span class="component-menu__item-text">${i18n.t('sales.role_c_level')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-value="vp">
                    <span class="component-menu__item-text">${i18n.t('sales.role_vp')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-value="director">
                    <span class="component-menu__item-text">${i18n.t('sales.role_director')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-value="manager">
                    <span class="component-menu__item-text">${i18n.t('sales.role_manager')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-value="owner">
                    <span class="component-menu__item-text">${i18n.t('sales.role_owner')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-value="team_member">
                    <span class="component-menu__item-text">${i18n.t('sales.role_team_member')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-value="intern">
                    <span class="component-menu__item-text">${i18n.t('sales.role_intern')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <label class="field" data-ref="field-sales-phone">
          <input
            type="tel"
            class="field__input"
            data-ref="input-sales-phone"
            placeholder=" "
            autocomplete="tel"
            value="${formState.phoneNumber}"
            required
          />
          <span class="field__label" data-ref="label-sales-phone">${i18n.t('sales.phone_label')} *</span>
        </label>

        <label class="field field--textarea" data-ref="field-sales-notes">
          <textarea
            class="field__textarea"
            data-ref="input-sales-notes"
            placeholder=" "
            rows="3"
          >${formState.notes}</textarea>
          <span class="field__label" data-ref="label-sales-notes">${i18n.t('sales.notes_label')}</span>
        </label>

        <div style="display: flex; gap: 12px; margin-top: 8px;">
          <button type="button" class="component-button component-button--secondary component-button--h44" data-ref="btn-sales-back" style="flex: 1;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>${i18n.t('sales.btn_back')}</span>
          </button>
          <button type="button" class="component-button component-button--black component-button--h44" data-ref="btn-sales-submit" style="flex: 2;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#send"></use></svg>
            <span>${i18n.t('sales.btn_submit')}</span>
          </button>
        </div>
      </div>

      <div data-ref="sales-success-state" style="display: none; flex-direction: column; align-items: center; text-align: center; padding: 24px 0;">
        <div class="component-avatar component-avatar--status" style="width: 56px; height: 56px; margin-bottom: 16px; background: #ecfdf5; color: #059669;">
          <svg class="component-icon" aria-hidden="true" style="width: 32px; height: 32px;"><use href="/icons.svg#check_circle"></use></svg>
        </div>
        <h2 class="component-title" style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">
          ${i18n.t('sales.success_title')}
        </h2>
        <p class="component-subtitle" style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 24px; max-width: 420px;">
          ${i18n.t('sales.success_desc')}
        </p>
        <div style="display: flex; gap: 12px;">
          <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-success-home">
            <span>${i18n.t('sales.btn_back_home')}</span>
          </button>
          <button type="button" class="component-button component-button--secondary component-button--h40" data-ref="btn-success-pricing">
            <span>${i18n.t('sales.btn_back_pricing')}</span>
          </button>
        </div>
      </div>

    </div>

    <div style="display: flex; justify-content: center; margin-top: 16px;">
      <button type="button" class="component-button component-button--secondary component-button--h34" data-ref="btn-back-to-pricing">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
        <span>${i18n.t('sales.btn_back_pricing')}</span>
      </button>
    </div>
  `;

  const footerBlock = createFooterComponent(navigate);

  renderIcons(heroBlock);
  renderIcons(formContainer);

  container.appendChild(heroBlock);
  container.appendChild(formContainer);
  container.appendChild(footerBlock);

  const step1El = formContainer.querySelector<HTMLElement>('[data-ref="sales-step-1"]');
  const step2El = formContainer.querySelector<HTMLElement>('[data-ref="sales-step-2"]');
  const successEl = formContainer.querySelector<HTMLElement>('[data-ref="sales-success-state"]');
  const headerEl = formContainer.querySelector<HTMLElement>('[data-ref="sales-form-header"]');
  const stepCounterEl = formContainer.querySelector<HTMLElement>('[data-ref="sales-step-counter"]');
  const stepPercentEl = formContainer.querySelector<HTMLElement>('[data-ref="sales-step-percent"]');
  const progressBarEl = formContainer.querySelector<HTMLElement>('[data-ref="sales-progress-bar"]');
  const topProgressEl = formContainer.querySelector<HTMLElement>('[data-ref="sales-top-progress"]');

  const btnNext = formContainer.querySelector<HTMLButtonElement>('[data-ref="btn-sales-next"]');
  const btnBack = formContainer.querySelector<HTMLButtonElement>('[data-ref="btn-sales-back"]');
  const btnSubmit = formContainer.querySelector<HTMLButtonElement>('[data-ref="btn-sales-submit"]');
  const btnBackToPricing = formContainer.querySelector<HTMLButtonElement>('[data-ref="btn-back-to-pricing"]');
  const btnSuccessHome = formContainer.querySelector<HTMLButtonElement>('[data-ref="btn-success-home"]');
  const btnSuccessPricing = formContainer.querySelector<HTMLButtonElement>('[data-ref="btn-success-pricing"]');

  const hearAboutWrapper = formContainer.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-hear-about"]');
  setupDropdown(hearAboutWrapper, {
    onSelect: (val) => {
      formState.hearAbout = val;
      hearAboutWrapper?.querySelectorAll('.component-menu__item').forEach((item) => {
        item.classList.toggle('is-active', item.getAttribute('data-value') === val);
      });
    },
  });

  const companySizeWrapper = formContainer.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-company-size"]');
  setupDropdown(companySizeWrapper, {
    onSelect: (val) => {
      formState.companySize = val;
      companySizeWrapper?.querySelectorAll('.component-menu__item').forEach((item) => {
        item.classList.toggle('is-active', item.getAttribute('data-value') === val);
      });
    },
  });

  const roleLevelWrapper = formContainer.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-role-level"]');
  setupDropdown(roleLevelWrapper, {
    onSelect: (val) => {
      formState.roleLevel = val;
      roleLevelWrapper?.querySelectorAll('.component-menu__item').forEach((item) => {
        item.classList.toggle('is-active', item.getAttribute('data-value') === val);
      });
    },
  });

  btnBackToPricing?.addEventListener('click', () => navigate('/pricing'));
  btnSuccessHome?.addEventListener('click', () => navigate('/'));
  btnSuccessPricing?.addEventListener('click', () => navigate('/pricing'));

  btnNext?.addEventListener('click', () => {
    const firstName = (formContainer.querySelector<HTMLInputElement>('[data-ref="input-sales-first-name"]')?.value || '').trim();
    const lastName = (formContainer.querySelector<HTMLInputElement>('[data-ref="input-sales-last-name"]')?.value || '').trim();
    const workEmail = (formContainer.querySelector<HTMLInputElement>('[data-ref="input-sales-work-email"]')?.value || '').trim();

    if (!firstName) {
      toast.error(i18n.t('sales.first_name_label'));
      return;
    }

    if (!lastName) {
      toast.error(i18n.t('sales.last_name_label'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!workEmail || !emailRegex.test(workEmail)) {
      toast.error(i18n.t('sales.work_email_label'));
      return;
    }

    if (!formState.hearAbout) {
      toast.error(i18n.t('sales.hear_about_label'));
      return;
    }

    formState.firstName = firstName;
    formState.lastName = lastName;
    formState.workEmail = workEmail;

    if (step1El) step1El.style.display = 'none';
    if (step2El) step2El.style.display = 'flex';
    if (stepCounterEl) stepCounterEl.textContent = i18n.t('sales.step_counter', { current: 2, total: 2 });
    if (stepPercentEl) stepPercentEl.textContent = '100%';
    if (progressBarEl) progressBarEl.style.width = '100%';
  });

  btnBack?.addEventListener('click', () => {
    if (step2El) step2El.style.display = 'none';
    if (step1El) step1El.style.display = 'flex';
    if (stepCounterEl) stepCounterEl.textContent = i18n.t('sales.step_counter', { current: 1, total: 2 });
    if (stepPercentEl) stepPercentEl.textContent = '50%';
    if (progressBarEl) progressBarEl.style.width = '50%';
  });

  btnSubmit?.addEventListener('click', async () => {
    const companyName = (formContainer.querySelector<HTMLInputElement>('[data-ref="input-sales-company-name"]')?.value || '').trim();
    const country = (formContainer.querySelector<HTMLInputElement>('[data-ref="input-sales-country"]')?.value || '').trim();
    const phoneNumber = (formContainer.querySelector<HTMLInputElement>('[data-ref="input-sales-phone"]')?.value || '').trim();
    const notes = (formContainer.querySelector<HTMLTextAreaElement>('[data-ref="input-sales-notes"]')?.value || '').trim();

    if (!companyName) {
      toast.error(i18n.t('sales.company_name_label'));
      return;
    }

    if (!formState.companySize) {
      toast.error(i18n.t('sales.company_size_label'));
      return;
    }

    if (!country) {
      toast.error(i18n.t('sales.country_label'));
      return;
    }

    if (!formState.roleLevel) {
      toast.error(i18n.t('sales.role_level_label'));
      return;
    }

    if (!phoneNumber) {
      toast.error(i18n.t('sales.phone_label'));
      return;
    }

    formState.companyName = companyName;
    formState.country = country;
    formState.phoneNumber = phoneNumber;
    formState.notes = notes;

    if (btnSubmit) btnSubmit.disabled = true;
    try {
      const res = await postApi<{ message: string; ok: boolean }>('/api/sales/contact', formState);
      if (res.ok) {
        if (headerEl) headerEl.style.display = 'none';
        if (topProgressEl) topProgressEl.style.display = 'none';
        if (step2El) step2El.style.display = 'none';
        if (successEl) successEl.style.display = 'flex';
        renderIcons(formContainer);
      } else {
        toast.error(i18n.t('common.error'));
      }
    } catch (err: any) {
      toast.error(err.message || i18n.t('common.error'));
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
    }
  });

  return container;
}

export {
  createContactSalesView
};

export type {
  LeadFormState
};
