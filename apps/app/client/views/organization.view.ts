import { copyToClipboard, escapeHtml, removeEmptyState, renderEmptyState, setupDropdown } from '../utils/dom.util.js';
import { currentUser, deleteApi, getApi, postApi, putApi } from '../services/api.service.js';
import { formatDate } from '../utils/format.util.js';
import { getUserAvatarUrl } from '../utils/avatar.util.js';
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
  subscription_tier?: string | null;
  user_id?: number | null;
  username?: string | null;
}

function normalizeMemberTier(tier?: string | null): 'enterprise' | 'business' | 'pro' | 'free' {
  const normalized = String(tier || 'free').toLowerCase();
  if (normalized === 'enterprise' || normalized === 'business' || normalized === 'pro') {
    return normalized;
  }
  return 'free';
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
  const displayOrgName = (org.name || '').replace(/\s+Organization$/i, '').trim() || org.name;

  return `
    <div class="component-top" data-ref="org-top-bar">
      <div class="component-top__left" data-ref="org-top-left">
        <div class="component-top__title-box" data-ref="org-title-heading">
          <span class="component-top__title-text" data-ref="org-top-title">${escapeHtml(displayOrgName)}</span>
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
                <span class="component-badge component-badge--sm" data-ref="badge-enterprise-seats-managed">${i18n.t('organization.enterprise_managed_seats_badge')}</span>
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
  const displayOrgName = (org.name || '').replace(/\s+Organization$/i, '').trim() || org.name;
  return `
    <div class="component-top" data-ref="details-top-bar">
      <div class="component-top__left" data-ref="details-top-left">
        <div class="component-top__title-box" data-ref="details-title-heading">
          <span class="component-top__title-text" data-ref="details-top-title">${i18n.t('organization.general_title')}</span>
        </div>
      </div>
      <div class="component-top__right" data-ref="details-top-right">
        <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-save-details">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#save"></use></svg>
          <span>${i18n.t('organization.btn_save_changes')}</span>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--centered" data-ref="details-bottom-area">
      <div class="component-container component-container--narrow" data-ref="details-layout" style="margin: 0 auto; width: 100%; max-width: 680px; display: flex; flex-direction: column; gap: 16px;">
        <div class="component-header" data-ref="details-header">
          <h1 class="component-title" data-ref="details-title">${i18n.t('organization.general_title')}</h1>
          <p class="component-subtitle" data-ref="details-subtitle">${i18n.t('organization.general_desc')}</p>
        </div>

        <div class="component-card" data-ref="card-org-details" style="padding: 28px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 18px; background: var(--bg-surface, #ffffff); display: flex; flex-direction: column; gap: 16px;">
          <label class="field" data-ref="field-org-name">
            <input
              type="text"
              class="field__input"
              data-ref="input-org-name"
              value="${escapeHtml(displayOrgName)}"
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
              value="${escapeHtml(org.slug)}"
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
              value="${escapeHtml(org.domain || '')}"
              placeholder=" "
            />
            <span class="field__label">${i18n.t('organization.domain_label')}</span>
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderSamlHtml(org: OrgData, spAcsUrl: string, spEntityId: string): string {
  return `
    <div class="component-top" data-ref="saml-top-bar">
      <div class="component-top__left" data-ref="saml-top-left">
        <div class="component-top__title-box" data-ref="saml-title-heading">
          <span class="component-top__title-text" data-ref="saml-top-title">${i18n.t('organization.saml_title')}</span>
        </div>
      </div>
      <div class="component-top__right" data-ref="saml-top-right">
        <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-save-saml">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#save"></use></svg>
          <span>${i18n.t('organization.btn_save_changes')}</span>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--centered" data-ref="saml-bottom-area">
      <div class="component-container component-container--narrow" data-ref="saml-layout" style="margin: 0 auto; width: 100%; max-width: 680px; display: flex; flex-direction: column; gap: 16px;">
        <div class="component-header" data-ref="saml-header">
          <h1 class="component-title" data-ref="saml-title">${i18n.t('organization.saml_title')}</h1>
          <p class="component-subtitle" data-ref="saml-subtitle">${i18n.t('organization.saml_desc')}</p>
        </div>

        <div class="component-card" data-ref="card-saml-toggle" style="display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 18px; background: var(--bg-surface, #ffffff);">
          <div>
            <h3 class="component-title" style="font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">${i18n.t('organization.saml_enable')}</h3>
            <p class="component-subtitle" style="font-size: 12.5px; margin: 0;">${i18n.t('organization.saml_toggle_subtitle')}</p>
          </div>
          <label class="component-switch" data-ref="switch-saml-label">
            <input type="checkbox" data-ref="switch-saml-enabled" ${org.saml_enabled ? 'checked' : ''} />
            <span class="component-switch__slider"></span>
          </label>
        </div>

        <div class="component-card" data-ref="card-sp-fields" style="padding: 24px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 18px; background: var(--bg-surface, #ffffff); display: flex; flex-direction: column; gap: 14px;">
          <div class="component-card__header" style="gap: 4px; margin-bottom: 4px;">
            <h3 class="component-title" style="font-size: 15px; font-weight: 600; margin: 0;">${i18n.t('organization.saml_sp_title')}</h3>
            <p class="component-subtitle" style="font-size: 12.5px; margin: 0;">${i18n.t('organization.saml_desc')}</p>
          </div>

          <label class="field" data-ref="field-sp-acs">
            <input
              type="text"
              class="field__input field__input--has-action"
              data-ref="input-sp-acs"
              value="${escapeHtml(spAcsUrl)}"
              readonly
              placeholder=" "
              style="font-family: monospace;"
            />
            <span class="field__label">${i18n.t('organization.saml_sp_acs')}</span>
            <button type="button" class="field__action" data-ref="btn-copy-acs" data-copy="${escapeHtml(spAcsUrl)}" data-tooltip="${escapeHtml(i18n.t('common.copy'))}" aria-label="${escapeHtml(i18n.t('common.copy'))}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
            </button>
          </label>

          <label class="field" data-ref="field-sp-entity">
            <input
              type="text"
              class="field__input field__input--has-action"
              data-ref="input-sp-entity"
              value="${escapeHtml(spEntityId)}"
              readonly
              placeholder=" "
              style="font-family: monospace;"
            />
            <span class="field__label">${i18n.t('organization.saml_sp_entity_id')}</span>
            <button type="button" class="field__action" data-ref="btn-copy-entity" data-copy="${escapeHtml(spEntityId)}" data-tooltip="${escapeHtml(i18n.t('common.copy'))}" aria-label="${escapeHtml(i18n.t('common.copy'))}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
            </button>
          </label>
        </div>

        <div class="component-card" data-ref="card-idp-fields" style="padding: 24px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 18px; background: var(--bg-surface, #ffffff); display: flex; flex-direction: column; gap: 14px;">
          <div class="component-card__header" style="gap: 4px; margin-bottom: 4px;">
            <h3 class="component-title" style="font-size: 15px; font-weight: 600; margin: 0;">${i18n.t('organization.saml_idp_title')}</h3>
            <p class="component-subtitle" style="font-size: 12.5px; margin: 0;">${i18n.t('organization.saml_desc')}</p>
          </div>

          <label class="field" data-ref="field-idp-entry">
            <input
              type="text"
              class="field__input"
              data-ref="input-idp-entry"
              value="${escapeHtml(org.saml_entry_point || '')}"
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
              value="${escapeHtml(org.saml_issuer || '')}"
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
            >${escapeHtml(org.saml_cert || '')}</textarea>
            <span class="field__label">${i18n.t('organization.saml_idp_cert')}</span>
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderMembersHtml(org: OrgData, members: OrgMemberData[], canSelfBuySeats = false): string {
  const seatsLimit = org.seats_limit || 3;

  return `
    <div class="component-top" data-ref="members-top-bar">
      <div class="component-top__left" data-ref="members-top-left">
        <div class="component-top__title-box" data-ref="members-title-heading">
          <span class="component-top__title-text" data-ref="members-top-title">${i18n.t('organization.seats_title')}</span>
          <span class="component-badge component-badge--sm" data-ref="members-count-badge">${members.length} / ${seatsLimit}</span>
          <span class="component-badge component-badge--sm is-hidden" data-ref="members-selected-badge"></span>
        </div>
      </div>
      <div class="component-top__right" data-ref="members-top-right">
        <div class="component-group component-group--actions is-hidden" data-ref="members-selection-actions">
          <button type="button" class="component-button component-button--h40 component-button--secondary component-button--icon-only" data-ref="btn-member-copy-email" data-tooltip="${escapeHtml(i18n.t('organization.copy_email'))}" aria-label="${escapeHtml(i18n.t('organization.copy_email'))}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
          </button>
          <button type="button" class="component-button component-button--h40 component-button--danger component-button--icon-only is-hidden" data-ref="btn-member-remove" data-tooltip="${escapeHtml(i18n.t('organization.remove_member'))}" aria-label="${escapeHtml(i18n.t('organization.remove_member'))}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
        </div>
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-toggle-members-search" data-tooltip="${escapeHtml(i18n.t('common.search'))}" aria-label="${escapeHtml(i18n.t('common.search'))}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
        </button>
        ${canSelfBuySeats ? `
          <button type="button" class="component-button component-button--secondary component-button--h40" data-ref="btn-expand-seats">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add_shopping_cart"></use></svg>
            <span>${i18n.t('organization.buy_seats_btn')}</span>
          </button>
        ` : ''}
        <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-open-add-member">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          <span>${i18n.t('organization.add_member_btn')}</span>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--full" data-ref="members-bottom-area">
      <div class="component-floating-search is-hidden" data-ref="members-search-toolbar">
        <div class="component-floating-search__inner" data-ref="members-search-inner">
          <div class="component-search component-search--floating" data-ref="members-search-box">
            <div class="component-search__icon" data-ref="members-search-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
            </div>
            <div class="component-search__input-box" data-ref="members-search-input-box">
              <input
                type="text"
                class="component-search__input"
                data-ref="input-search-members"
                placeholder="${escapeHtml(i18n.t('organization.search_placeholder'))}"
                maxlength="100"
                autocomplete="off"
              />
            </div>
            <button type="button" class="component-button component-button--h34 component-button--icon-only is-hidden" data-ref="btn-clear-members-search" aria-label="${escapeHtml(i18n.t('common.clear_search'))}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
        </div>
      </div>

      <div class="component-table-wrapper component-table-wrapper--flush" data-ref="members-table-wrapper">
        <table class="component-table component-table--flush" data-ref="members-table">
          <thead class="component-table__head" data-ref="members-thead">
            <tr>
              <th data-ref="th-member">${i18n.t('organization.table_header_member')}</th>
              <th data-ref="th-role">${i18n.t('organization.table_header_role')}</th>
              <th data-ref="th-status">${i18n.t('organization.table_header_status')}</th>
              <th data-ref="th-joined">${i18n.t('organization.table_header_joined')}</th>
            </tr>
          </thead>
          <tbody class="component-table__body" data-ref="members-tbody">
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

    return container;
  }

  if (isSaml) {
    container.innerHTML = renderSamlHtml(org, spAcsUrl, spEntityId);
    renderIcons(container);

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
          saml_cert: samlCert,
          saml_enabled: samlEnabled,
          saml_entry_point: samlEntryPoint,
          saml_issuer: samlIssuer,
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

    const seatsLimit = org.seats_limit || 3;
    const countBadge = container.querySelector<HTMLElement>('[data-ref="members-count-badge"]');
    const selectedBadge = container.querySelector<HTMLElement>('[data-ref="members-selected-badge"]');
    const selectionActions = container.querySelector<HTMLElement>('[data-ref="members-selection-actions"]');
    const btnCopyEmail = container.querySelector<HTMLButtonElement>('[data-ref="btn-member-copy-email"]');
    const btnRemoveMember = container.querySelector<HTMLButtonElement>('[data-ref="btn-member-remove"]');
    const btnToggleSearch = container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-members-search"]');
    const btnExpandSeatsTop = container.querySelector<HTMLButtonElement>('[data-ref="btn-expand-seats"]');
    const btnOpenAdd = container.querySelector<HTMLButtonElement>('[data-ref="btn-open-add-member"]');
    const searchToolbar = container.querySelector<HTMLElement>('[data-ref="members-search-toolbar"]');
    const searchInner = container.querySelector<HTMLElement>('[data-ref="members-search-inner"]');
    const searchInput = container.querySelector<HTMLInputElement>('[data-ref="input-search-members"]');
    const btnClearSearch = container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-members-search"]');
    const tableWrapper = container.querySelector<HTMLElement>('[data-ref="members-table-wrapper"]');
    const tableEl = container.querySelector<HTMLElement>('[data-ref="members-table"]');
    const tbody = container.querySelector<HTMLElement>('[data-ref="members-tbody"]');

    let currentlyDisplayedMembers: OrgMemberData[] = membersList;
    let selectedMemberId: number | null = null;

    if (canSelfBuySeats) {
      setupExpandSeatsModal(container, org, () => navigate(`${baseBackPath}/members`));
    }

    const updateSelectionUI = (): void => {
      const selectedMember = selectedMemberId !== null
        ? membersList.find((m) => m.id === selectedMemberId) || null
        : null;

      if (selectedMember) {
        if (selectedBadge) {
          selectedBadge.textContent = i18n.t('organization.selected_count', { count: 1 });
          selectedBadge.classList.remove('is-hidden');
        }
        selectionActions?.classList.remove('is-hidden');
        if (selectedMember.role !== 'owner') {
          btnRemoveMember?.classList.remove('is-hidden');
        } else {
          btnRemoveMember?.classList.add('is-hidden');
        }
        btnToggleSearch?.classList.add('is-hidden');
        btnExpandSeatsTop?.classList.add('is-hidden');
        btnOpenAdd?.classList.add('is-hidden');
      } else {
        selectedBadge?.classList.add('is-hidden');
        selectionActions?.classList.add('is-hidden');
        btnRemoveMember?.classList.add('is-hidden');
        btnToggleSearch?.classList.remove('is-hidden');
        btnExpandSeatsTop?.classList.remove('is-hidden');
        btnOpenAdd?.classList.remove('is-hidden');
      }
      renderIcons(container);
    };

    const getMemberRoleLabel = (role: string): string => {
      if (role === 'owner') return i18n.t('organization.role_owner');
      if (role === 'admin') return i18n.t('organization.role_admin');
      return i18n.t('organization.role_member');
    };

    const filterMembers = (queryRaw: string): OrgMemberData[] => {
      const query = queryRaw.toLowerCase().trim();
      if (!query) return membersList;
      return membersList.filter((m) => {
        const displayName = (m.username || m.email.split('@')[0]).toLowerCase();
        const email = m.email.toLowerCase();
        const roleLabel = getMemberRoleLabel(m.role).toLowerCase();
        return displayName.includes(query) || email.includes(query) || roleLabel.includes(query);
      });
    };

    const renderMemberRows = (members: OrgMemberData[], isSearchResult = false): void => {
      currentlyDisplayedMembers = members;
      if (!tbody) return;

      if (members.length === 0) {
        tbody.innerHTML = '';
        tableEl?.classList.add('is-hidden');
        if (selectedMemberId !== null) {
          selectedMemberId = null;
          updateSelectionUI();
        }
        if (tableWrapper) {
          renderEmptyState({
            container: tableWrapper,
            dataRef: 'members-empty-state',
            desc: isSearchResult
              ? i18n.t('organization.search_no_results')
              : i18n.t('organization.empty_members'),
            graphicType: 'search',
            isTable: true,
            title: isSearchResult
              ? i18n.t('common.search')
              : i18n.t('organization.seats_title'),
          });
        }
        return;
      }

      tableEl?.classList.remove('is-hidden');
      if (tableWrapper) {
        removeEmptyState(tableWrapper, 'members-empty-state');
      }

      if (selectedMemberId !== null && !members.some((m) => m.id === selectedMemberId)) {
        selectedMemberId = null;
        updateSelectionUI();
      }

      tbody.innerHTML = '';
      members.forEach((m) => {
        const isSelected = selectedMemberId === m.id;
        const row = document.createElement('tr');
        row.className = `component-table__row component-cursor-pointer${isSelected ? ' is-selected' : ''}`;
        row.setAttribute('data-ref', `member-row-${m.id}`);

        const displayName = m.username || m.email.split('@')[0];
        const avatarSrc = getUserAvatarUrl(
          {
            avatar_url: m.avatar_url || null,
            email: m.email,
            id: m.user_id ?? m.id,
            username: displayName,
          },
          64
        );
        const tier = normalizeMemberTier(m.subscription_tier);
        const roleLabel = getMemberRoleLabel(m.role);
        const statusLabel = m.status === 'active'
          ? i18n.t('organization.status_active')
          : i18n.t('organization.status_invited');

        row.innerHTML = `
          <td class="component-table__cell" data-ref="cell-member-${m.id}">
            <div class="component-table__user" data-ref="member-cell-box-${m.id}">
              <div class="component-avatar component-avatar--sm" data-ref="member-avatar-${m.id}" data-tier="${tier}">
                <img class="component-avatar__img" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(displayName)}" referrerpolicy="no-referrer" loading="lazy" />
              </div>
              <div class="component-table__user-meta">
                <span class="component-badge component-badge--sm" data-ref="text-member-name-${m.id}">${escapeHtml(displayName)}</span>
                <span class="component-badge component-badge--sm" data-ref="text-member-email-${m.id}">${escapeHtml(m.email)}</span>
              </div>
            </div>
          </td>
          <td class="component-table__cell" data-ref="cell-role-${m.id}">
            <span class="component-badge component-badge--sm" data-ref="text-member-role-${m.id}">${escapeHtml(roleLabel)}</span>
          </td>
          <td class="component-table__cell" data-ref="cell-status-${m.id}">
            <span class="component-badge component-badge--sm" data-ref="text-member-status-${m.id}">${escapeHtml(statusLabel)}</span>
          </td>
          <td class="component-table__cell" data-ref="cell-joined-${m.id}">
            <span class="component-badge component-badge--sm" data-ref="text-member-joined-${m.id}">${escapeHtml(formatDate(m.joined_at))}</span>
          </td>
        `;

        row.addEventListener('click', () => {
          selectedMemberId = selectedMemberId === m.id ? null : m.id;
          updateSelectionUI();
          renderMemberRows(currentlyDisplayedMembers, isSearchResult);
        });

        tbody.appendChild(row);
      });

      renderIcons(tbody);
    };

    const hideSearchToolbar = (): void => {
      if (!searchToolbar) return;
      searchToolbar.classList.add('is-hidden');
      searchInput?.blur();
      if (searchInput && searchInput.value) {
        searchInput.value = '';
        btnClearSearch?.classList.add('is-hidden');
        renderMemberRows(membersList);
      }
    };

    btnToggleSearch?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!searchToolbar) return;
      const isClosed = searchToolbar.classList.contains('is-hidden');
      if (isClosed) {
        searchToolbar.classList.remove('is-hidden');
        if (searchInput) {
          setTimeout(() => searchInput.focus(), 50);
        }
      } else {
        hideSearchToolbar();
      }
    });

    searchInput?.addEventListener('input', () => {
      const val = searchInput.value || '';
      if (btnClearSearch) {
        btnClearSearch.classList.toggle('is-hidden', !val.trim());
      }
      renderMemberRows(filterMembers(val), Boolean(val.trim()));
    });

    btnClearSearch?.addEventListener('click', (e) => {
      e.preventDefault();
      if (searchInput) {
        searchInput.value = '';
        btnClearSearch.classList.add('is-hidden');
        renderMemberRows(membersList);
        searchInput.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (document.querySelector('.modal-backdrop.is-visible')) {
          return;
        }
        if (searchToolbar && !searchToolbar.classList.contains('is-hidden')) {
          e.preventDefault();
          hideSearchToolbar();
        } else if (selectedMemberId !== null) {
          selectedMemberId = null;
          updateSelectionUI();
          renderMemberRows(currentlyDisplayedMembers, Boolean(searchInput?.value.trim()));
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    const handleDocumentClick = (e: MouseEvent): void => {
      if (!searchToolbar || searchToolbar.classList.contains('is-hidden')) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (searchInner?.contains(target) || btnToggleSearch?.contains(target)) {
        return;
      }
      hideSearchToolbar();
    };
    document.addEventListener('click', handleDocumentClick);

    btnCopyEmail?.addEventListener('click', (e) => {
      e.preventDefault();
      const selected = membersList.find((m) => m.id === selectedMemberId);
      if (selected?.email) {
        void copyToClipboard(selected.email, i18n.t('room.link_copied'));
      }
    });

    btnRemoveMember?.addEventListener('click', () => {
      const selected = membersList.find((m) => m.id === selectedMemberId);
      if (!selected || selected.role === 'owner') return;

      const confirmModal = openModal({
        cancelText: i18n.t('common.cancel'),
        confirmClass: 'component-button--danger',
        confirmText: i18n.t('common.delete'),
        description: i18n.t('organization.remove_confirm'),
        onConfirm: async () => {
          confirmModal.setConfirmLoading(true);
          try {
            const res = await deleteApi<{ ok: boolean }>(`/api/organization/members/${selected.id}`);
            if (res.ok) {
              toast.success(i18n.t('organization.member_removed'));
              membersList = membersList.filter((m) => m.id !== selected.id);
              selectedMemberId = null;
              if (countBadge) {
                countBadge.textContent = `${membersList.length} / ${seatsLimit}`;
              }
              updateSelectionUI();
              const q = searchInput?.value || '';
              renderMemberRows(filterMembers(q), Boolean(q.trim()));
              return true;
            }
            toast.error(i18n.t('common.error'));
            return false;
          } catch (err: any) {
            toast.error(err.message || i18n.t('common.error'));
            return false;
          } finally {
            confirmModal.setConfirmLoading(false);
          }
        },
        size: 'sm',
        title: i18n.t('organization.remove_member'),
      });
    });

    renderMemberRows(membersList);

    (container as HTMLElement & { cleanup?: () => void }).cleanup = () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleDocumentClick);
    };
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

            <div class="component-dropdown dropdown-wrapper component-dropdown--full" data-ref="dropdown-modal-member-role">
              <input type="hidden" data-ref="select-modal-member-role" value="member" />
              <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="trigger-modal-member-role" aria-label="${i18n.t('organization.add_member_role')}">
                <div class="component-dropdown__trigger-left dropdown-trigger__left">
                  <svg class="component-icon component-dropdown__trigger-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#badge"></use></svg>
                  <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="text-modal-member-role">${i18n.t('organization.role_member')}</span>
                </div>
                <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </button>
              <div class="component-menu-backdrop dropdown-backdrop">
                <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto">
                  <div class="component-menu__list menu-panel__list">
                    <button type="button" class="component-menu__item menu-item is-active" data-ref="opt-member" data-value="member">
                      <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#badge"></use></svg>
                      <span class="component-menu__item-text menu-item__text">${i18n.t('organization.role_member')}</span>
                    </button>
                    <button type="button" class="component-menu__item menu-item" data-ref="opt-admin" data-value="admin">
                      <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#admin_panel_settings"></use></svg>
                      <span class="component-menu__item-text menu-item__text">${i18n.t('organization.role_admin')}</span>
                    </button>
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
            const textSpan = item.querySelector('.menu-item__text, .component-menu__item-text');
            if (textLabel) textLabel.textContent = textSpan?.textContent?.trim() || item.textContent?.trim() || val;
            roleDropdown.querySelectorAll('.component-menu__item, .menu-item').forEach((opt) => {
              opt.classList.toggle('is-active', opt.getAttribute('data-value') === val);
            });
            const triggerIcon = roleDropdown.querySelector<SVGUseElement>('.dropdown-trigger__icon use');
            if (triggerIcon) {
              triggerIcon.setAttribute('href', `/icons.svg#${val === 'admin' ? 'admin_panel_settings' : 'badge'}`);
            }
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
