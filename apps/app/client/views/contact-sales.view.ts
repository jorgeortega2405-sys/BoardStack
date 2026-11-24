import { currentUser, postApi } from '../services/api.service.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { toast } from '../services/toast.service.js';

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
  container.className = 'component-wrapper component-wrapper--full';
  container.setAttribute('data-ref', 'sales-wrapper');

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

  container.innerHTML = `
    <div class="component-backdrop component-backdrop--dots" data-ref="sales-backdrop"></div>
    <div class="component-body component-body--scrollable" data-ref="sales-scrollable">
      <div class="component-container component-container--wide" data-ref="sales-container" style="max-width: 1040px; margin: 36px auto; padding: 0 20px;">
        <div class="component-grid component-grid--2-col" data-ref="sales-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start;">
          
          <div class="component-main" data-ref="sales-info-col" style="display: flex; flex-direction: column; gap: 20px;">
            <div>
              <span class="component-badge" data-ref="sales-badge" style="margin-bottom: 12px; display: inline-flex;">
                ${i18n.t('sales.badge')}
              </span>
              <h1 class="component-title component-title--lg" data-ref="sales-main-title" style="font-size: 28px; font-weight: 700; margin: 0 0 10px 0; line-height: 1.25;">
                ${i18n.t('sales.title')}
              </h1>
              <p class="component-subtitle" data-ref="sales-main-subtitle" style="font-size: 14px; line-height: 1.5; color: var(--text-secondary); margin: 0;">
                ${i18n.t('sales.subtitle')}
              </p>
            </div>

            <div class="component-card component-card--feature" data-ref="sales-benefits-card" style="padding: 24px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 16px; background: var(--bg-surface, #ffffff);">
              <h2 class="component-title" style="font-size: 15px; font-weight: 600; margin-bottom: 16px;">
                ${i18n.t('sales.benefits_title')}
              </h2>

              <div class="component-list" style="display: flex; flex-direction: column; gap: 14px;">
                <div class="component-item" style="display: flex; gap: 12px; align-items: flex-start;">
                  <div class="component-avatar component-avatar--sm" style="background: var(--bg-hover, #f1f5f9); color: var(--text-primary); min-width: 32px; height: 32px;">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
                  </div>
                  <div>
                    <h3 class="component-title" style="font-size: 13.5px; font-weight: 600; margin: 0 0 2px 0;">${i18n.t('sales.benefit_storage_title')}</h3>
                    <p class="component-subtitle" style="font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4;">${i18n.t('sales.benefit_storage_desc')}</p>
                  </div>
                </div>

                <div class="component-item" style="display: flex; gap: 12px; align-items: flex-start;">
                  <div class="component-avatar component-avatar--sm" style="background: var(--bg-hover, #f1f5f9); color: var(--text-primary); min-width: 32px; height: 32px;">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#security"></use></svg>
                  </div>
                  <div>
                    <h3 class="component-title" style="font-size: 13.5px; font-weight: 600; margin: 0 0 2px 0;">${i18n.t('sales.benefit_sso_title')}</h3>
                    <p class="component-subtitle" style="font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4;">${i18n.t('sales.benefit_sso_desc')}</p>
                  </div>
                </div>

                <div class="component-item" style="display: flex; gap: 12px; align-items: flex-start;">
                  <div class="component-avatar component-avatar--sm" style="background: var(--bg-hover, #f1f5f9); color: var(--text-primary); min-width: 32px; height: 32px;">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#group"></use></svg>
                  </div>
                  <div>
                    <h3 class="component-title" style="font-size: 13.5px; font-weight: 600; margin: 0 0 2px 0;">${i18n.t('sales.benefit_seats_title')}</h3>
                    <p class="component-subtitle" style="font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4;">${i18n.t('sales.benefit_seats_desc')}</p>
                  </div>
                </div>

                <div class="component-item" style="display: flex; gap: 12px; align-items: flex-start;">
                  <div class="component-avatar component-avatar--sm" style="background: var(--bg-hover, #f1f5f9); color: var(--text-primary); min-width: 32px; height: 32px;">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#verified"></use></svg>
                  </div>
                  <div>
                    <h3 class="component-title" style="font-size: 13.5px; font-weight: 600; margin: 0 0 2px 0;">${i18n.t('sales.benefit_support_title')}</h3>
                    <p class="component-subtitle" style="font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4;">${i18n.t('sales.benefit_support_desc')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="component-item__actions" style="margin-top: 8px;">
              <button type="button" class="component-button component-button--h40" data-ref="btn-back-to-pricing">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
                <span>${i18n.t('sales.btn_back_pricing')}</span>
              </button>
            </div>
          </div>

          <div class="component-card" data-ref="sales-form-card" style="padding: 28px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 16px; background: var(--bg-surface, #ffffff); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);">
            
            <div data-ref="sales-form-header" style="margin-bottom: 20px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span class="component-badge" data-ref="sales-step-counter">
                  ${i18n.t('sales.step_counter', { current: 1, total: 2 })}
                </span>
                <span class="component-subtitle" data-ref="sales-step-percent" style="font-size: 12px; font-weight: 600;">50%</span>
              </div>
              <div class="component-item__progress" style="background: var(--border-color, #e5e7eb); height: 4px; border-radius: 9999px; overflow: hidden;">
                <div class="component-item__progress-bar" data-ref="sales-progress-bar" style="background: var(--action-primary, #0f172a); width: 50%; height: 100%; transition: width 0.3s ease;"></div>
              </div>
            </div>

            <div data-ref="sales-step-1" style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <h2 class="component-title" style="font-size: 18px; margin: 0 0 4px 0;">${i18n.t('sales.step_1_title')}</h2>
                <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary); margin: 0;">${i18n.t('sales.step_1_subtitle')}</p>
              </div>

              <div class="component-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="component-item" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  <label class="component-label" for="field-sales-first-name" style="font-size: 12.5px; font-weight: 500;">
                    ${i18n.t('sales.first_name_label')} *
                  </label>
                  <input
                    type="text"
                    class="component-input"
                    id="field-sales-first-name"
                    data-ref="input-sales-first-name"
                    placeholder="${i18n.t('sales.first_name_placeholder')}"
                    value="${formState.firstName}"
                    style="width: 100%;"
                  />
                </div>

                <div class="component-item" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  <label class="component-label" for="field-sales-last-name" style="font-size: 12.5px; font-weight: 500;">
                    ${i18n.t('sales.last_name_label')} *
                  </label>
                  <input
                    type="text"
                    class="component-input"
                    id="field-sales-last-name"
                    data-ref="input-sales-last-name"
                    placeholder="${i18n.t('sales.last_name_placeholder')}"
                    value="${formState.lastName}"
                    style="width: 100%;"
                  />
                </div>
              </div>

              <div class="component-item" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                <label class="component-label" for="field-sales-work-email" style="font-size: 12.5px; font-weight: 500;">
                  ${i18n.t('sales.work_email_label')} *
                </label>
                <input
                  type="email"
                  class="component-input"
                  id="field-sales-work-email"
                  data-ref="input-sales-work-email"
                  placeholder="${i18n.t('sales.work_email_placeholder')}"
                  value="${formState.workEmail}"
                  style="width: 100%;"
                />
              </div>

              <div class="component-item" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                <label class="component-label" for="field-sales-hear-about" style="font-size: 12.5px; font-weight: 500;">
                  ${i18n.t('sales.hear_about_label')} *
                </label>
                <select
                  class="component-input"
                  id="field-sales-hear-about"
                  data-ref="select-sales-hear-about"
                  style="width: 100%;"
                >
                  <option value="">${i18n.t('sales.hear_about_select')}</option>
                  <option value="Google Search">${i18n.t('sales.hear_about_search')}</option>
                  <option value="Social Media">${i18n.t('sales.hear_about_social')}</option>
                  <option value="Colleague">${i18n.t('sales.hear_about_colleague')}</option>
                  <option value="Press / Blog">${i18n.t('sales.hear_about_press')}</option>
                  <option value="Event">${i18n.t('sales.hear_about_event')}</option>
                  <option value="Other">${i18n.t('sales.hear_about_other')}</option>
                </select>
              </div>

              <div style="margin-top: 8px;">
                <button type="button" class="component-button component-button--black component-button--h40 component-button--w-full" data-ref="btn-sales-next">
                  <span>${i18n.t('sales.btn_next')}</span>
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
                </button>
              </div>
            </div>

            <div data-ref="sales-step-2" style="display: none; flex-direction: column; gap: 16px;">
              <div>
                <h2 class="component-title" style="font-size: 18px; margin: 0 0 4px 0;">${i18n.t('sales.step_2_title')}</h2>
                <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary); margin: 0;">${i18n.t('sales.step_2_subtitle')}</p>
              </div>

              <div class="component-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="component-item" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  <label class="component-label" for="field-sales-company-name" style="font-size: 12.5px; font-weight: 500;">
                    ${i18n.t('sales.company_name_label')} *
                  </label>
                  <input
                    type="text"
                    class="component-input"
                    id="field-sales-company-name"
                    data-ref="input-sales-company-name"
                    placeholder="${i18n.t('sales.company_name_placeholder')}"
                    value="${formState.companyName}"
                    style="width: 100%;"
                  />
                </div>

                <div class="component-item" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  <label class="component-label" for="field-sales-company-size" style="font-size: 12.5px; font-weight: 500;">
                    ${i18n.t('sales.company_size_label')} *
                  </label>
                  <select
                    class="component-input"
                    id="field-sales-company-size"
                    data-ref="select-sales-company-size"
                    style="width: 100%;"
                  >
                    <option value="">${i18n.t('sales.company_size_select')}</option>
                    <option value="1-10">${i18n.t('sales.company_size_1_10')}</option>
                    <option value="11-50">${i18n.t('sales.company_size_11_50')}</option>
                    <option value="51-200">${i18n.t('sales.company_size_51_200')}</option>
                    <option value="201-1000">${i18n.t('sales.company_size_201_1000')}</option>
                    <option value="1000+">${i18n.t('sales.company_size_1000_plus')}</option>
                  </select>
                </div>
              </div>

              <div class="component-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="component-item" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  <label class="component-label" for="field-sales-country" style="font-size: 12.5px; font-weight: 500;">
                    ${i18n.t('sales.country_label')} *
                  </label>
                  <input
                    type="text"
                    class="component-input"
                    id="field-sales-country"
                    data-ref="input-sales-country"
                    placeholder="${i18n.t('sales.country_placeholder')}"
                    value="${formState.country}"
                    style="width: 100%;"
                  />
                </div>

                <div class="component-item" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  <label class="component-label" for="field-sales-role-level" style="font-size: 12.5px; font-weight: 500;">
                    ${i18n.t('sales.role_level_label')} *
                  </label>
                  <select
                    class="component-input"
                    id="field-sales-role-level"
                    data-ref="select-sales-role-level"
                    style="width: 100%;"
                  >
                    <option value="">${i18n.t('sales.role_level_select')}</option>
                    <option value="c_level">${i18n.t('sales.role_c_level')}</option>
                    <option value="vp">${i18n.t('sales.role_vp')}</option>
                    <option value="director">${i18n.t('sales.role_director')}</option>
                    <option value="manager">${i18n.t('sales.role_manager')}</option>
                    <option value="owner">${i18n.t('sales.role_owner')}</option>
                    <option value="team_member">${i18n.t('sales.role_team_member')}</option>
                    <option value="intern">${i18n.t('sales.role_intern')}</option>
                  </select>
                </div>
              </div>

              <div class="component-item" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                <label class="component-label" for="field-sales-phone" style="font-size: 12.5px; font-weight: 500;">
                  ${i18n.t('sales.phone_label')} *
                </label>
                <input
                  type="tel"
                  class="component-input"
                  id="field-sales-phone"
                  data-ref="input-sales-phone"
                  placeholder="${i18n.t('sales.phone_placeholder')}"
                  value="${formState.phoneNumber}"
                  style="width: 100%;"
                />
              </div>

              <div class="component-item" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                <label class="component-label" for="field-sales-notes" style="font-size: 12.5px; font-weight: 500;">
                  ${i18n.t('sales.notes_label')}
                </label>
                <textarea
                  class="component-input"
                  id="field-sales-notes"
                  data-ref="input-sales-notes"
                  rows="3"
                  placeholder="${i18n.t('sales.notes_placeholder')}"
                  style="width: 100%; resize: vertical;"
                >${formState.notes}</textarea>
              </div>

              <div style="display: flex; gap: 12px; margin-top: 8px;">
                <button type="button" class="component-button component-button--h40" data-ref="btn-sales-back" style="flex: 1;">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
                  <span>${i18n.t('sales.btn_back')}</span>
                </button>
                <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-sales-submit" style="flex: 2;">
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
                <button type="button" class="component-button component-button--h40" data-ref="btn-success-pricing">
                  <span>${i18n.t('sales.btn_back_pricing')}</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const step1El = container.querySelector<HTMLElement>('[data-ref="sales-step-1"]');
  const step2El = container.querySelector<HTMLElement>('[data-ref="sales-step-2"]');
  const successEl = container.querySelector<HTMLElement>('[data-ref="sales-success-state"]');
  const headerEl = container.querySelector<HTMLElement>('[data-ref="sales-form-header"]');
  const stepCounterEl = container.querySelector<HTMLElement>('[data-ref="sales-step-counter"]');
  const stepPercentEl = container.querySelector<HTMLElement>('[data-ref="sales-step-percent"]');
  const progressBarEl = container.querySelector<HTMLElement>('[data-ref="sales-progress-bar"]');

  const btnNext = container.querySelector<HTMLButtonElement>('[data-ref="btn-sales-next"]');
  const btnBack = container.querySelector<HTMLButtonElement>('[data-ref="btn-sales-back"]');
  const btnSubmit = container.querySelector<HTMLButtonElement>('[data-ref="btn-sales-submit"]');
  const btnBackToPricing = container.querySelector<HTMLButtonElement>('[data-ref="btn-back-to-pricing"]');
  const btnSuccessHome = container.querySelector<HTMLButtonElement>('[data-ref="btn-success-home"]');
  const btnSuccessPricing = container.querySelector<HTMLButtonElement>('[data-ref="btn-success-pricing"]');

  btnBackToPricing?.addEventListener('click', () => navigate('/pricing'));
  btnSuccessHome?.addEventListener('click', () => navigate('/'));
  btnSuccessPricing?.addEventListener('click', () => navigate('/pricing'));

  btnNext?.addEventListener('click', () => {
    const firstName = (container.querySelector<HTMLInputElement>('[data-ref="input-sales-first-name"]')?.value || '').trim();
    const lastName = (container.querySelector<HTMLInputElement>('[data-ref="input-sales-last-name"]')?.value || '').trim();
    const workEmail = (container.querySelector<HTMLInputElement>('[data-ref="input-sales-work-email"]')?.value || '').trim();
    const hearAbout = (container.querySelector<HTMLSelectElement>('[data-ref="select-sales-hear-about"]')?.value || '').trim();

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

    if (!hearAbout) {
      toast.error(i18n.t('sales.hear_about_label'));
      return;
    }

    formState.firstName = firstName;
    formState.lastName = lastName;
    formState.workEmail = workEmail;
    formState.hearAbout = hearAbout;

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
    const companyName = (container.querySelector<HTMLInputElement>('[data-ref="input-sales-company-name"]')?.value || '').trim();
    const companySize = (container.querySelector<HTMLSelectElement>('[data-ref="select-sales-company-size"]')?.value || '').trim();
    const country = (container.querySelector<HTMLInputElement>('[data-ref="input-sales-country"]')?.value || '').trim();
    const roleLevel = (container.querySelector<HTMLSelectElement>('[data-ref="select-sales-role-level"]')?.value || '').trim();
    const phoneNumber = (container.querySelector<HTMLInputElement>('[data-ref="input-sales-phone"]')?.value || '').trim();
    const notes = (container.querySelector<HTMLTextAreaElement>('[data-ref="input-sales-notes"]')?.value || '').trim();

    if (!companyName) {
      toast.error(i18n.t('sales.company_name_label'));
      return;
    }

    if (!companySize) {
      toast.error(i18n.t('sales.company_size_label'));
      return;
    }

    if (!country) {
      toast.error(i18n.t('sales.country_label'));
      return;
    }

    if (!roleLevel) {
      toast.error(i18n.t('sales.role_level_label'));
      return;
    }

    if (!phoneNumber) {
      toast.error(i18n.t('sales.phone_label'));
      return;
    }

    formState.companyName = companyName;
    formState.companySize = companySize;
    formState.country = country;
    formState.roleLevel = roleLevel;
    formState.phoneNumber = phoneNumber;
    formState.notes = notes;

    if (btnSubmit) btnSubmit.disabled = true;
    try {
      const res = await postApi<{ message: string; ok: boolean }>('/api/sales/contact', formState);
      if (res.ok) {
        if (headerEl) headerEl.style.display = 'none';
        if (step2El) step2El.style.display = 'none';
        if (successEl) successEl.style.display = 'flex';
        renderIcons(container);
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
