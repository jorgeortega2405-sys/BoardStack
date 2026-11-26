import { copyToClipboard, setupDropdown } from '../utils/dom.util.js';
import { currentUser, deleteApi, getApi, postApi, putApi } from '../services/api.service.js';
import { formatDate } from '../utils/format.util.js';
import { i18n } from '../i18n/i18n.service.js';
import { openModal } from '../components/modal.component.js';
import { renderIcons } from '../services/icon.service.js';
import { toast } from '../services/toast.service.js';

interface OrgData {
  created_at: string;
  domain: string | null;
  id: number;
  name: string;
  owner_id: number;
  saml_cert: string | null;
  saml_enabled: boolean;
  saml_entry_point: string | null;
  saml_issuer: string | null;
  seats_limit: number;
  slug: string;
  updated_at: string;
  uuid: string;
}

interface OrgMemberData {
  avatar_url?: string | null;
  email: string;
  id: number;
  joined_at: string;
  role: string;
  status: string;
  username?: string | null;
}

interface OrgApiResponse {
  isOwner: boolean;
  membersCount: number;
  ok: boolean;
  org: OrgData;
  spAcsUrl: string;
  spEntityId: string;
}

function renderOverviewHtml(
  org: OrgData,
  membersCount: number,
  canSelfBuySeats = false,
  isEnterpriseOwner = false
): string {
  const seatsLimit = org.seats_limit || 3;
  const availableSeats = Math.max(0, seatsLimit - membersCount);

  return `
    <div class="component-top" data-ref="org-top-bar">
      <div class="component-top__left" data-ref="org-top-left">
        <div class="component-top__title-box" data-ref="org-title-heading">
          <span class="component-top__title-text" data-ref="org-top-title">${org.name}</span>
        </div>
      </div>
      <div class="component-top__right" data-ref="org-top-right">
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-nav-members" title="${i18n.t('organization.nav_manage_seats')}" aria-label="${i18n.t('organization.nav_manage_seats')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#group"></use></svg>
        </button>
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-nav-saml" title="${i18n.t('organization.nav_saml_sso')}" aria-label="${i18n.t('organization.nav_saml_sso')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#security"></use></svg>
        </button>
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-nav-details" title="${i18n.t('organization.nav_details')}" aria-label="${i18n.t('organization.nav_details')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#settings"></use></svg>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--page" data-ref="org-bottom-area">
      <div class="component-grid" data-ref="org-metrics-grid" style="display: flex; flex-wrap: wrap; gap: 12px; width: 100%; align-items: flex-start; justify-content: flex-start;">
        
        <div class="component-card component-card--metric-h" data-ref="metric-card-seats">
          <div class="component-card__icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#group"></use></svg>
          </div>
          <div class="component-card__content">
            <span class="component-card__label">${i18n.t('organization.metric_seats')}</span>
            <div class="component-card__value">${membersCount} / ${seatsLimit}</div>
            <span class="component-card__subtext">${i18n.t('organization.seats_available', { count: availableSeats })}</span>
            ${canSelfBuySeats ? `
              <div style="margin-top: 10px;">
                <button type="button" class="component-button component-button--secondary component-button--h34" data-ref="btn-expand-seats">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add_shopping_cart"></use></svg>
                  <span>${i18n.t('organization.buy_seats_btn')}</span>
                </button>
              </div>
            ` : (isEnterpriseOwner ? `
              <div style="margin-top: 10px;">
                <span class="component-badge component-badge--sm component-badge--neutral" data-ref="badge-enterprise-seats-managed">${i18n.t('organization.enterprise_managed_seats_badge')}</span>
              </div>
            ` : '')}
          </div>
        </div>

        <div class="component-card component-card--metric-h" data-ref="metric-card-members">
          <div class="component-card__icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
          </div>
          <div class="component-card__content">
            <span class="component-card__label">${i18n.t('organization.metric_members')}</span>
            <div class="component-card__value">${membersCount}</div>
            <span class="component-card__subtext">${i18n.t('organization.status_active')}</span>
          </div>
        </div>

        <div class="component-card component-card--metric-h" data-ref="metric-card-sso">
          <div class="component-card__icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#security"></use></svg>
          </div>
          <div class="component-card__content">
            <span class="component-card__label">${i18n.t('organization.metric_sso')}</span>
            <div class="component-card__value">${org.saml_enabled ? i18n.t('organization.metric_sso_active') : i18n.t('organization.metric_sso_inactive')}</div>
            <span class="component-card__subtext">${org.saml_entry_point ? org.saml_entry_point.replace(/^https?:\/\//, '').split('/')[0] : i18n.t('organization.metric_domain_none')}</span>
          </div>
        </div>

        <div class="component-card component-card--metric-h" data-ref="metric-card-domain">
          <div class="component-card__icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#language"></use></svg>
          </div>
          <div class="component-card__content">
            <span class="component-card__label">${i18n.t('organization.metric_domain')}</span>
            <div class="component-card__value">${org.domain ? '@' + org.domain : i18n.t('organization.metric_domain_none')}</div>
            <span class="component-card__subtext">${i18n.t('organization.slug_label')}: /org/${org.slug}</span>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderDetailsHtml(org: OrgData): string {
  return `
    <div class="component-top" data-ref="details-top-bar">
      <div class="component-top__left" data-ref="details-top-left">
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-back-to-org" title="${i18n.t('common.back')}" aria-label="${i18n.t('common.back')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
        </button>
        <div class="component-top__title-box" data-ref="details-title-heading">
          <span class="component-top__title-text" data-ref="details-top-title">${i18n.t('organization.general_title')}</span>
        </div>
      </div>
      <div class="component-top__right" data-ref="details-top-right">
        <button type="button" class="component-button component-button--black component-button--h34" data-ref="btn-save-details">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#save"></use></svg>
          <span>${i18n.t('organization.btn_save_changes')}</span>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--centered" data-ref="details-bottom-area">
      <div class="component-container component-container--narrow" data-ref="details-layout" style="margin: 0 auto; width: 100%; max-width: 680px;">
        
        <div class="component-card" data-ref="card-org-details" style="padding: 28px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 18px; background: var(--bg-surface, #ffffff); display: flex; flex-direction: column; gap: 16px;">
          
          <div class="component-header" style="margin-bottom: 4px; text-align: left; align-items: flex-start; padding: 0; background: transparent; border: none;">
            <h2 class="component-title" data-ref="details-title" style="font-size: 18px; font-weight: 700; margin: 0 0 4px 0;">${i18n.t('organization.general_title')}</h2>
            <p class="component-subtitle" data-ref="details-subtitle" style="font-size: 13px; margin: 0;">${i18n.t('organization.general_desc')}</p>
          </div>

          <label class="field" data-ref="field-org-name">
            <input
              type="text"
              class="field__input"
              data-ref="input-org-name"
              value="${org.name}"
              placeholder=" "
              required
            />
            <span class="field__label">${i18n.t('organization.name_label')}</span>
          </label>

          <label class="field" data-ref="field-org-slug">
            <input
              type="text"
              class="field__input"
              data-ref="input-org-slug"
              value="${org.slug}"
              placeholder=" "
              required
              style="font-family: monospace;"
            />
            <span class="field__label">${i18n.t('organization.slug_label')}</span>
          </label>

          <label class="field" data-ref="field-org-domain">
            <input
              type="text"
              class="field__input"
              data-ref="input-org-domain"
              value="${org.domain || ''}"
              placeholder=" "
            />
            <span class="field__label">${i18n.t('organization.domain_label')}</span>
          </label>

          <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
            <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-save-details-bottom">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#save"></use></svg>
              <span>${i18n.t('organization.btn_save_changes')}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  `;
}

function renderSamlHtml(org: OrgData, spAcsUrl: string, spEntityId: string): string {
  return `
    <div class="component-top" data-ref="saml-top-bar">
      <div class="component-top__left" data-ref="saml-top-left">
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-back-to-org" title="${i18n.t('common.back')}" aria-label="${i18n.t('common.back')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
        </button>
        <div class="component-top__title-box" data-ref="saml-title-heading">
          <span class="component-top__title-text" data-ref="saml-top-title">${i18n.t('organization.saml_title')}</span>
        </div>
      </div>
      <div class="component-top__right" data-ref="saml-top-right">
        <button type="button" class="component-button component-button--black component-button--h34" data-ref="btn-save-saml">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#save"></use></svg>
          <span>${i18n.t('organization.btn_save_changes')}</span>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--centered" data-ref="saml-bottom-area">
      <div class="component-container component-container--narrow" data-ref="saml-layout" style="margin: 0 auto; width: 100%; max-width: 680px; display: flex; flex-direction: column; gap: 16px;">
        
        <div class="component-card" data-ref="card-saml-toggle" style="display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 18px; background: var(--bg-surface, #ffffff);">
          <div>
            <h3 class="component-title" style="font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">${i18n.t('organization.saml_enable')}</h3>
            <p class="component-subtitle" style="font-size: 12.5px; margin: 0;">SAML 2.0 / Single Sign-On (SSO)</p>
          </div>
          <label class="component-switch" data-ref="switch-saml-label">
            <input type="checkbox" data-ref="switch-saml-enabled" ${org.saml_enabled ? 'checked' : ''} />
            <span class="component-switch__slider"></span>
          </label>
        </div>

        <div class="component-card" data-ref="card-sp-fields" style="padding: 24px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 18px; background: var(--bg-surface, #ffffff); display: flex; flex-direction: column; gap: 14px;">
          <div class="component-header" style="margin-bottom: 4px; text-align: left; align-items: flex-start; padding: 0; background: transparent; border: none;">
            <h3 class="component-title" style="font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Service Provider (SP) - BoardStack</h3>
            <p class="component-subtitle" style="font-size: 12.5px; margin: 0;">${i18n.t('organization.saml_desc')}</p>
          </div>

          <label class="field" data-ref="field-sp-acs">
            <input
              type="text"
              class="field__input field__input--has-action"
              data-ref="input-sp-acs"
              value="${spAcsUrl}"
              readonly
              placeholder=" "
              style="font-family: monospace;"
            />
            <span class="field__label">${i18n.t('organization.saml_sp_acs')}</span>
            <button type="button" class="field__action" data-ref="btn-copy-acs" data-copy="${spAcsUrl}" title="${i18n.t('room.link_copied')}" aria-label="Copy">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
            </button>
          </label>

          <label class="field" data-ref="field-sp-entity">
            <input
              type="text"
              class="field__input field__input--has-action"
              data-ref="input-sp-entity"
              value="${spEntityId}"
              readonly
              placeholder=" "
              style="font-family: monospace;"
            />
            <span class="field__label">${i18n.t('organization.saml_sp_entity_id')}</span>
            <button type="button" class="field__action" data-ref="btn-copy-entity" data-copy="${spEntityId}" title="${i18n.t('room.link_copied')}" aria-label="Copy">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
            </button>
          </label>
        </div>

        <div class="component-card" data-ref="card-idp-fields" style="padding: 24px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 18px; background: var(--bg-surface, #ffffff); display: flex; flex-direction: column; gap: 14px;">
          <div class="component-header" style="margin-bottom: 4px; text-align: left; align-items: flex-start; padding: 0; background: transparent; border: none;">
            <h3 class="component-title" style="font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Identity Provider (IdP)</h3>
            <p class="component-subtitle" style="font-size: 12.5px; margin: 0;">${i18n.t('organization.saml_desc')}</p>
          </div>

          <label class="field" data-ref="field-idp-entry">
            <input
              type="text"
              class="field__input"
              data-ref="input-idp-entry"
              value="${org.saml_entry_point || ''}"
              placeholder=" "
              style="font-family: monospace;"
            />
            <span class="field__label">${i18n.t('organization.saml_idp_entry_point')}</span>
          </label>

          <label class="field" data-ref="field-idp-issuer">
            <input
              type="text"
              class="field__input"
              data-ref="input-idp-issuer"
              value="${org.saml_issuer || ''}"
              placeholder=" "
              style="font-family: monospace;"
            />
            <span class="field__label">${i18n.t('organization.saml_idp_issuer')}</span>
          </label>

          <label class="field field--textarea" data-ref="field-idp-cert">
            <textarea
              class="field__textarea"
              data-ref="input-idp-cert"
              rows="5"
              placeholder=" "
              style="font-family: monospace; font-size: 12px; line-height: 1.4;"
            >${org.saml_cert || ''}</textarea>
            <span class="field__label">${i18n.t('organization.saml_idp_cert')}</span>
          </label>

          <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
            <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-save-saml-bottom">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#save"></use></svg>
              <span>${i18n.t('organization.btn_save_changes')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderMembersHtml(org: OrgData, members: OrgMemberData[], canSelfBuySeats = false): string {
  const seatsLimit = org.seats_limit || 3;

  const rowsHtml = members.map((m) => `
    <tr class="component-table__row" data-ref="member-row-${m.id}" data-member-id="${m.id}" data-search-target="${(m.username || '') + ' ' + m.email}">
      <td class="component-table__cell component-table__cell--pl20">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="component-avatar component-avatar--sm" data-ref="member-avatar">
            ${m.avatar_url ? `<img class="component-avatar__img" src="${m.avatar_url}" alt="${m.username || m.email}" />` : `<span>${(m.username || m.email).charAt(0).toUpperCase()}</span>`}
          </div>
          <div>
            <div style="font-weight: 600; font-size: 13.5px;">${m.username || m.email.split('@')[0]}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${m.email}</div>
          </div>
        </div>
      </td>
      <td class="component-table__cell">
        <span class="component-badge">${m.role === 'owner' ? i18n.t('organization.role_owner') : (m.role === 'admin' ? i18n.t('organization.role_admin') : i18n.t('organization.role_member'))}</span>
      </td>
      <td class="component-table__cell">
        <span class="component-badge ${m.status === 'active' ? 'component-badge--success' : 'component-badge--warning'}">${m.status === 'active' ? i18n.t('organization.status_active') : i18n.t('organization.status_invited')}</span>
      </td>
      <td class="component-table__cell" style="font-size: 12.5px; color: var(--text-secondary);">
        ${formatDate(m.joined_at)}
      </td>
      <td class="component-table__cell component-table__cell--pr20" style="text-align: right;">
        ${m.role !== 'owner' ? `
          <button type="button" class="component-button component-button--h34" data-ref="btn-remove-member" data-member-id="${m.id}" title="${i18n.t('organization.remove_member')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');

  return `
    <div class="component-top" data-ref="members-top-bar">
      <div class="component-top__left" data-ref="members-top-left">
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-back-to-org" title="${i18n.t('common.back')}" aria-label="${i18n.t('common.back')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
        </button>
        <div class="component-top__title-box" data-ref="members-title-heading">
          <span class="component-top__title-text" data-ref="members-top-title">${i18n.t('organization.seats_title')}</span>
          <span class="component-badge" data-ref="members-count-badge">${members.length} / ${seatsLimit}</span>
        </div>
      </div>
      <div class="component-top__right" data-ref="members-top-right">
        <div class="component-search" data-ref="members-search-box" style="width: 240px;">
          <div class="component-search__icon">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          </div>
          <div class="component-search__input-box">
            <input
              type="text"
              class="component-search__input"
              data-ref="input-search-members"
              placeholder="${i18n.t('organization.search_placeholder')}"
            />
          </div>
        </div>
        ${canSelfBuySeats ? `
          <button type="button" class="component-button component-button--secondary component-button--h34" data-ref="btn-expand-seats">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add_shopping_cart"></use></svg>
            <span>${i18n.t('organization.buy_seats_btn')}</span>
          </button>
        ` : ''}
        <button type="button" class="component-button component-button--black component-button--h34" data-ref="btn-open-add-member">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          <span>${i18n.t('organization.add_member_btn')}</span>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--full" data-ref="members-bottom-area">
      <div class="component-table-wrapper component-table-wrapper--flush" data-ref="members-table-wrapper">
        <table class="component-table component-table--flush" data-ref="members-table">
          <thead class="component-table__head" data-ref="members-thead">
            <tr>
              <th class="component-table__cell--pl20">${i18n.t('organization.table_header_member')}</th>
              <th>${i18n.t('organization.table_header_role')}</th>
              <th>${i18n.t('organization.table_header_status')}</th>
              <th>${i18n.t('organization.table_header_joined')}</th>
              <th class="component-table__cell--pr20" style="text-align: right;">${i18n.t('organization.table_header_actions')}</th>
            </tr>
          </thead>
          <tbody class="component-table__body" data-ref="members-tbody">
            ${rowsHtml || `<tr><td colspan="5" style="text-align: center; padding: 48px; color: var(--text-secondary);">${i18n.t('organization.empty_members')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function setupExpandSeatsModal(
  container: HTMLElement,
  org: OrgData,
  onUpdated: (newSeats: number) => void
): void {
  const expandBtns = container.querySelectorAll<HTMLButtonElement>('[data-ref="btn-expand-seats"]');
  expandBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      let targetSeats = Math.max(org.seats_limit || 3, 3);
      const minSeats = Math.max(org.seats_limit || 3, 3);
      const maxSeats = 50;

      const modal = openModal({
        bodyHtml: `
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: var(--bg-hover, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px;">
              <div>
                <div style="font-size: 12px; color: var(--text-secondary);">${i18n.t('organization.seats_current_label')}</div>
                <div style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${org.seats_limit || 3} ${i18n.t('organization.metric_seats')}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; color: var(--text-secondary);">${i18n.t('organization.seats_new_label')}</div>
                <span class="component-badge component-badge--success" data-ref="modal-expand-seats-badge" style="font-size: 14px; font-weight: 700;">${targetSeats}</span>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label class="component-label" for="field-modal-expand-range" style="font-size: 13px; font-weight: 600;">${i18n.t('organization.seats_new_label')}</label>
                <span data-ref="modal-expand-extra-diff" style="font-size: 12px; font-weight: 600; color: var(--action-primary, #111827);">+0 ${i18n.t('organization.metric_seats')}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <button type="button" class="component-button component-button--secondary component-button--h34" data-ref="btn-modal-seats-minus" aria-label="${i18n.t('pricing.business_seats_minus')}" style="min-width: 34px; padding: 0;">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#remove"></use></svg>
                </button>
                <input
                  type="range"
                  id="field-modal-expand-range"
                  data-ref="input-modal-expand-range"
                  min="${minSeats}"
                  max="${maxSeats}"
                  step="1"
                  value="${targetSeats}"
                  style="flex: 1; accent-color: var(--action-primary, #111827); cursor: pointer;"
                />
                <button type="button" class="component-button component-button--secondary component-button--h34" data-ref="btn-modal-seats-plus" aria-label="${i18n.t('pricing.business_seats_plus')}" style="min-width: 34px; padding: 0;">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                </button>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; background: var(--bg-surface, #ffffff);">
              <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
                <span style="color: var(--text-secondary);">${i18n.t('organization.seats_price_rate_monthly')}</span>
                <span data-ref="modal-expand-monthly-price" style="font-weight: 600;">$29.00 / mes</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
                <span style="color: var(--text-secondary);">${i18n.t('organization.seats_price_rate_yearly')}</span>
                <span data-ref="modal-expand-yearly-price" style="font-weight: 600;">$24.00 / mes ($288/año)</span>
              </div>
            </div>
          </div>
        `,
        cancelText: i18n.t('organization.modal_btn_cancel'),
        confirmText: i18n.t('organization.btn_confirm_expand_seats'),
        description: i18n.t('organization.modal_expand_seats_desc'),
        onConfirm: async () => {
          if (targetSeats === (org.seats_limit || 3)) {
            modal.close();
            return;
          }

          try {
            const res = await putApi<{ ok: boolean; seatsLimit: number }>('/api/organization/seats', {
              seats: targetSeats,
            });
            if (res.ok) {
              toast.success(i18n.t('organization.seats_updated_success'));
              modal.close();
              onUpdated(targetSeats);
            } else {
              toast.error(i18n.t('organization.seats_update_error'));
            }
          } catch (err: any) {
            toast.error(err.message || i18n.t('organization.seats_update_error'));
          }
        },
        title: i18n.t('organization.modal_expand_seats_title'),
      });

      renderIcons(document.body);

      const badge = document.querySelector<HTMLElement>('[data-ref="modal-expand-seats-badge"]');
      const diffEl = document.querySelector<HTMLElement>('[data-ref="modal-expand-extra-diff"]');
      const rangeInput = document.querySelector<HTMLInputElement>('[data-ref="input-modal-expand-range"]');
      const minusBtn = document.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-minus"]');
      const plusBtn = document.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-plus"]');
      const monthlyPriceEl = document.querySelector<HTMLElement>('[data-ref="modal-expand-monthly-price"]');
      const yearlyPriceEl = document.querySelector<HTMLElement>('[data-ref="modal-expand-yearly-price"]');

      const updateModalCalc = () => {
        if (badge) badge.textContent = String(targetSeats);
        if (rangeInput) rangeInput.value = String(targetSeats);
        const extraFromCurrent = Math.max(0, targetSeats - (org.seats_limit || 3));
        if (diffEl) {
          diffEl.textContent = i18n.t('organization.seats_extra_diff', { count: extraFromCurrent });
        }
        const extraFromBase = Math.max(0, targetSeats - 3);
        const totalMonthly = (29.00 + (extraFromBase * 6.00)).toFixed(2);
        const totalYearlyMo = (24.00 + (extraFromBase * 5.00)).toFixed(2);
        const totalYearlyBilled = ((24.00 + (extraFromBase * 5.00)) * 12).toFixed(2);

        if (monthlyPriceEl) monthlyPriceEl.textContent = `$${totalMonthly} / mes`;
        if (yearlyPriceEl) yearlyPriceEl.textContent = `$${totalYearlyMo} / mes ($${totalYearlyBilled}/año)`;
      };

      updateModalCalc();

      minusBtn?.addEventListener('click', () => {
        if (targetSeats > minSeats) {
          targetSeats -= 1;
          updateModalCalc();
        }
      });

      plusBtn?.addEventListener('click', () => {
        if (targetSeats < maxSeats) {
          targetSeats += 1;
          updateModalCalc();
        }
      });

      rangeInput?.addEventListener('input', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        if (!isNaN(val)) {
          targetSeats = Math.min(maxSeats, Math.max(minSeats, val));
          updateModalCalc();
        }
      });
    });
  });
}

async function createOrganizationView(
  navigate: (path: string) => void,
  currentSubpath = '/organization'
): Promise<HTMLElement> {
  const isDetails = currentSubpath === '/organization/details' || currentSubpath === '/settings/organization/details';
  const isSaml = currentSubpath === '/organization/saml' || currentSubpath === '/settings/organization/saml';
  const isMembers = currentSubpath === '/organization/members' || currentSubpath === '/settings/organization/members';

  const container = document.createElement('div');
  container.className = isMembers ? 'component-layout--split-full' : 'component-layout--split-centered';
  container.setAttribute('data-ref', 'organization-layout');

  if (!currentUser) {
    navigate('/login');
    return container;
  }

  if (currentUser.subscription_tier !== 'enterprise' && currentUser.subscription_tier !== 'business') {
    container.innerHTML = `
      <div class="component-container component-container--narrow" data-ref="enterprise-gate" style="margin: 40px auto; text-align: center;">
        <div class="component-avatar component-avatar--status" style="margin: 0 auto 16px auto;">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
        </div>
        <h2 class="component-title" style="margin-bottom: 8px;">${i18n.t('organization.requires_enterprise')}</h2>
        <p class="component-subtitle" style="margin-bottom: 24px;">${i18n.t('organization.subtitle')}</p>
        <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-explore-enterprise">
          ${i18n.t('organization.explore_enterprise')}
        </button>
      </div>
    `;
    renderIcons(container);
    container.querySelector('[data-ref="btn-explore-enterprise"]')?.addEventListener('click', () => {
      navigate('/pricing');
    });
    return container;
  }

  let orgData: OrgApiResponse | null = null;
  try {
    orgData = await getApi<OrgApiResponse>('/api/organization');
  } catch (err: any) {
    toast.error(err.message || i18n.t('common.error'));
  }

  if (!orgData || !orgData.ok || !orgData.org) {
    container.innerHTML = `
      <div class="component-container component-container--narrow" style="margin: 40px auto; text-align: center;">
        <p class="component-subtitle">${i18n.t('common.error')}</p>
      </div>
    `;
    return container;
  }

  const { isOwner, membersCount, org, spAcsUrl, spEntityId } = orgData;
  const canSelfBuySeats = isOwner && currentUser.subscription_tier === 'business';
  const isEnterpriseOwner = isOwner && currentUser.subscription_tier === 'enterprise';

  const baseBackPath = currentSubpath.startsWith('/settings') ? '/settings/organization' : '/organization';

  if (isDetails) {
    container.innerHTML = renderDetailsHtml(org);
    renderIcons(container);

    container.querySelector('[data-ref="btn-back-to-org"]')?.addEventListener('click', () => {
      navigate(baseBackPath);
    });

    const handleSaveDetails = async (btnEl: HTMLButtonElement | null) => {
      const name = (container.querySelector<HTMLInputElement>('[data-ref="input-org-name"]')?.value || '').trim();
      const slug = (container.querySelector<HTMLInputElement>('[data-ref="input-org-slug"]')?.value || '').trim();
      const domain = (container.querySelector<HTMLInputElement>('[data-ref="input-org-domain"]')?.value || '').trim();

      if (!name) {
        toast.error(i18n.t('organization.name_label'));
        return;
      }

      if (btnEl) btnEl.disabled = true;
      try {
        const res = await putApi<{ ok: boolean; org: OrgData }>('/api/organization', { domain, name, slug });
        if (res.ok) {
          toast.success(i18n.t('organization.org_saved'));
          navigate(baseBackPath);
        } else {
          toast.error(i18n.t('common.error'));
        }
      } catch (err: any) {
        toast.error(err.message || i18n.t('common.error'));
      } finally {
        if (btnEl) btnEl.disabled = false;
      }
    };

    const btnSave = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-details"]');
    btnSave?.addEventListener('click', () => handleSaveDetails(btnSave));

    const btnSaveBottom = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-details-bottom"]');
    btnSaveBottom?.addEventListener('click', () => handleSaveDetails(btnSaveBottom));

    return container;
  }

  if (isSaml) {
    container.innerHTML = renderSamlHtml(org, spAcsUrl, spEntityId);
    renderIcons(container);

    container.querySelector('[data-ref="btn-back-to-org"]')?.addEventListener('click', () => {
      navigate(baseBackPath);
    });

    container.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = btn.getAttribute('data-copy') || '';
        if (text) {
          void copyToClipboard(text, i18n.t('room.link_copied'));
        }
      });
    });

    const handleSaveSaml = async (btnEl: HTMLButtonElement | null) => {
      const samlEnabled = container.querySelector<HTMLInputElement>('[data-ref="switch-saml-enabled"]')?.checked ?? false;
      const samlEntryPoint = (container.querySelector<HTMLInputElement>('[data-ref="input-idp-entry"]')?.value || '').trim();
      const samlIssuer = (container.querySelector<HTMLInputElement>('[data-ref="input-idp-issuer"]')?.value || '').trim();
      const samlCert = (container.querySelector<HTMLTextAreaElement>('[data-ref="input-idp-cert"]')?.value || '').trim();

      if (btnEl) btnEl.disabled = true;
      try {
        const res = await putApi<{ ok: boolean; org: OrgData }>('/api/organization', {
          samlCert,
          samlEnabled,
          samlEntryPoint,
          samlIssuer,
        });
        if (res.ok) {
          toast.success(i18n.t('organization.saml_saved'));
          navigate(baseBackPath);
        } else {
          toast.error(i18n.t('common.error'));
        }
      } catch (err: any) {
        toast.error(err.message || i18n.t('common.error'));
      } finally {
        if (btnEl) btnEl.disabled = false;
      }
    };

    const btnSave = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-saml"]');
    btnSave?.addEventListener('click', () => handleSaveSaml(btnSave));

    const btnSaveBottom = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-saml-bottom"]');
    btnSaveBottom?.addEventListener('click', () => handleSaveSaml(btnSaveBottom));

    return container;
  }

  if (isMembers) {
    let membersList: OrgMemberData[] = [];
    try {
      const res = await getApi<{ members: OrgMemberData[]; ok: boolean }>('/api/organization/members');
      if (res.ok && Array.isArray(res.members)) {
        membersList = res.members;
      }
    } catch {}

    container.innerHTML = renderMembersHtml(org, membersList, canSelfBuySeats);
    renderIcons(container);

    container.querySelector('[data-ref="btn-back-to-org"]')?.addEventListener('click', () => {
      navigate(baseBackPath);
    });

    if (canSelfBuySeats) {
      setupExpandSeatsModal(container, org, () => navigate(`${baseBackPath}/members`));
    }

    const searchInput = container.querySelector<HTMLInputElement>('[data-ref="input-search-members"]');
    searchInput?.addEventListener('input', () => {
      const q = (searchInput.value || '').toLowerCase().trim();
      const rows = container.querySelectorAll<HTMLElement>('[data-search-target]');
      rows.forEach((r) => {
        const target = (r.getAttribute('data-search-target') || '').toLowerCase();
        if (!q || target.includes(q)) {
          r.style.display = '';
        } else {
          r.style.display = 'none';
        }
      });
    });

    const setupRemoveButtons = () => {
      container.querySelectorAll<HTMLButtonElement>('[data-ref="btn-remove-member"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const memberId = btn.getAttribute('data-member-id');
          if (!memberId) return;

          const confirmed = window.confirm(i18n.t('organization.remove_confirm'));
          if (!confirmed) return;

          btn.disabled = true;
          try {
            const res = await deleteApi<{ ok: boolean }>(`/api/organization/members/${memberId}`);
            if (res.ok) {
              toast.success(i18n.t('organization.member_removed'));
              navigate(`${baseBackPath}/members`);
            } else {
              toast.error(i18n.t('common.error'));
            }
          } catch (err: any) {
            toast.error(err.message || i18n.t('common.error'));
          } finally {
            btn.disabled = false;
          }
        });
      });
    };
    setupRemoveButtons();

    const btnOpenAdd = container.querySelector<HTMLButtonElement>('[data-ref="btn-open-add-member"]');
    btnOpenAdd?.addEventListener('click', () => {
      const modal = openModal({
        bodyHtml: `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <label class="field" data-ref="field-modal-member-email">
              <input
                type="email"
                class="field__input"
                data-ref="input-modal-member-email"
                placeholder=" "
                required
              />
              <span class="field__label">${i18n.t('organization.add_member_email')}</span>
            </label>

            <div class="component-dropdown component-dropdown--field" data-ref="dropdown-modal-member-role">
              <input type="hidden" data-ref="select-modal-member-role" value="member" />
              <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="trigger-modal-member-role" style="height: 55px; border-radius: 16px;">
                <div class="component-dropdown__trigger-left dropdown-trigger__left" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px;">
                  <span style="font-size: 11px; color: var(--text-secondary); line-height: 1;">${i18n.t('organization.add_member_role')}</span>
                  <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="text-modal-member-role" style="font-size: 14px; font-weight: 500;">${i18n.t('organization.role_member')}</span>
                </div>
                <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </button>
              <div class="component-menu-backdrop dropdown-backdrop">
                <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto">
                  <div class="component-menu__list menu-panel__list">
                    <div class="component-menu__item menu-panel__item is-selected" data-action="select-item" data-value="member" data-label="${i18n.t('organization.role_member')}">
                      <span>${i18n.t('organization.role_member')}</span>
                    </div>
                    <div class="component-menu__item menu-panel__item" data-action="select-item" data-value="admin" data-label="${i18n.t('organization.role_admin')}">
                      <span>${i18n.t('organization.role_admin')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
        cancelText: i18n.t('organization.modal_btn_cancel'),
        confirmText: i18n.t('organization.modal_btn_add'),
        description: i18n.t('organization.modal_add_desc'),
        onConfirm: async () => {
          const emailInput = document.querySelector<HTMLInputElement>('[data-ref="input-modal-member-email"]');
          const roleInput = document.querySelector<HTMLInputElement>('[data-ref="select-modal-member-role"]');
          const email = (emailInput?.value || '').trim();
          const role = roleInput?.value || 'member';

          if (!email || !email.includes('@')) {
            toast.error(i18n.t('organization.add_member_email'));
            return;
          }

          try {
            const res = await postApi<{ member: OrgMemberData; ok: boolean }>('/api/organization/members', { email, role });
            if (res.ok) {
              toast.success(i18n.t('organization.member_added'));
              modal.close();
              navigate(`${baseBackPath}/members`);
            } else {
              toast.error(i18n.t('common.error'));
            }
          } catch (err: any) {
            toast.error(err.message || i18n.t('common.error'));
          }
        },
        title: i18n.t('organization.modal_add_title'),
      });
      renderIcons(document.body);

      const roleDropdown = modal.backdrop.querySelector<HTMLElement>('[data-ref="dropdown-modal-member-role"]');
      if (roleDropdown) {
        setupDropdown(roleDropdown, {
          onSelect: (val: string, item: HTMLElement) => {
            const hiddenInput = modal.backdrop.querySelector<HTMLInputElement>('[data-ref="select-modal-member-role"]');
            const textLabel = modal.backdrop.querySelector<HTMLElement>('[data-ref="text-modal-member-role"]');
            if (hiddenInput) hiddenInput.value = val;
            if (textLabel) textLabel.textContent = item.textContent?.trim() || val;
          },
        });
      }
    });

    return container;
  }

  container.innerHTML = renderOverviewHtml(org, membersCount, canSelfBuySeats, isEnterpriseOwner);
  renderIcons(container);
  if (canSelfBuySeats) {
    setupExpandSeatsModal(container, org, () => navigate(baseBackPath));
  }

  container.querySelector('[data-ref="btn-nav-members"]')?.addEventListener('click', () => {
    navigate(`${baseBackPath}/members`);
  });
  container.querySelector('[data-ref="btn-nav-saml"]')?.addEventListener('click', () => {
    navigate(`${baseBackPath}/saml`);
  });
  container.querySelector('[data-ref="btn-nav-details"]')?.addEventListener('click', () => {
    navigate(`${baseBackPath}/details`);
  });

  const cardSeats = container.querySelector<HTMLElement>('[data-ref="metric-card-seats"]');
  if (cardSeats) {
    cardSeats.style.cursor = 'pointer';
    cardSeats.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-ref="btn-expand-seats"]')) return;
      navigate(`${baseBackPath}/members`);
    });
  }

  const cardMembers = container.querySelector<HTMLElement>('[data-ref="metric-card-members"]');
  if (cardMembers) {
    cardMembers.style.cursor = 'pointer';
    cardMembers.addEventListener('click', () => {
      navigate(`${baseBackPath}/members`);
    });
  }

  const cardSso = container.querySelector<HTMLElement>('[data-ref="metric-card-sso"]');
  if (cardSso) {
    cardSso.style.cursor = 'pointer';
    cardSso.addEventListener('click', () => {
      navigate(`${baseBackPath}/saml`);
    });
  }

  const cardDomain = container.querySelector<HTMLElement>('[data-ref="metric-card-domain"]');
  if (cardDomain) {
    cardDomain.style.cursor = 'pointer';
    cardDomain.addEventListener('click', () => {
      navigate(`${baseBackPath}/details`);
    });
  }

  return container;
}

export {
  createOrganizationView
};
