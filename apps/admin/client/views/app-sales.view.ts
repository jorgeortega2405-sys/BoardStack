import type {
  AccessibleAdminApp,
  AdminViewElement,
  EnterpriseContractItem,
  EnterpriseLeadDetail,
  EnterpriseLeadItem,
  EnterpriseLeadMatchedUser,
  ProvisionEnterpriseResponse,
} from '../types/admin.types.js';
import { copyToClipboard, escapeHtml, removeEmptyState, renderEmptyState } from '../utils/dom.util.js';
import { deleteApi, getApi, patchApi, postApi } from '../services/api.service.js';
import { formatBytes, formatDate, formatDateTime, formatNumber } from '../utils/format.util.js';
import { getUserAvatarUrl } from '../utils/avatar.util.js';
import { i18n } from '../i18n/i18n.service.js';
import { openDialog } from '../components/dialog.component.js';
import { renderIcons } from '../services/icon.service.js';
import { toast } from '../services/toast.service.js';

interface LeadsApiResponse {
  app?: AccessibleAdminApp;
  canManage?: boolean;
  code?: string;
  error?: string;
  leads?: EnterpriseLeadItem[];
  ok?: boolean;
}

interface LeadDetailApiResponse {
  code?: string;
  detail?: EnterpriseLeadDetail;
  error?: string;
  ok?: boolean;
}

interface LookupUserApiResponse {
  code?: string;
  error?: string;
  found?: boolean;
  ok?: boolean;
  user?: EnterpriseLeadMatchedUser | null;
}

interface StatusUpdateApiResponse {
  code?: string;
  error?: string;
  ok?: boolean;
  status?: EnterpriseLeadItem['status'];
}

interface ProvisionApiResponse {
  code?: string;
  error?: string;
  ok?: boolean;
  provisioned?: ProvisionEnterpriseResponse;
}

interface ContractUploadApiResponse {
  code?: string;
  contract?: EnterpriseContractItem;
  error?: string;
  ok?: boolean;
}

interface ContractDeleteApiResponse {
  code?: string;
  deleted?: boolean;
  error?: string;
  ok?: boolean;
}

const BYTES_PER_GB = 1024 * 1024 * 1024;
const BYTES_PER_TB = BYTES_PER_GB * 1024;
const MAX_CONTRACT_FILE_BYTES = 20 * 1024 * 1024;

const ROLE_KEY_MAP: Record<string, string> = {
  'c-level': 'admin.sales.role_c_level',
  director: 'admin.sales.role_director',
  intern: 'admin.sales.role_intern',
  manager: 'admin.sales.role_manager',
  owner: 'admin.sales.role_owner',
  'team-member': 'admin.sales.role_team_member',
  vp: 'admin.sales.role_vp',
};

function getPlanLabel(tier: string): string {
  const normalized = (tier || 'free').toLowerCase();
  const key = `admin.users.plan_${normalized}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : normalized.toUpperCase();
}

function getPlanBadgeClass(tier: string): string {
  const normalized = (tier || 'free').toLowerCase();
  if (normalized === 'enterprise') {
    return 'component-badge--success';
  }
  if (normalized === 'free') {
    return 'component-badge--neutral';
  }
  return '';
}

function getLeadStatusInfo(status: string): { badgeClass: string; label: string } {
  const normalized = (status || 'pending').toLowerCase();
  if (normalized === 'approved') {
    return {
      badgeClass: 'component-badge--success',
      label: i18n.t('admin.sales.status_approved'),
    };
  }
  if (normalized === 'rejected') {
    return {
      badgeClass: 'component-badge--destructive',
      label: i18n.t('admin.sales.status_rejected'),
    };
  }
  if (normalized === 'contacted') {
    return {
      badgeClass: '',
      label: i18n.t('admin.sales.status_contacted'),
    };
  }
  return {
    badgeClass: 'component-badge--warning',
    label: i18n.t('admin.sales.status_pending'),
  };
}

function getRoleLevelLabel(roleLevel: string): string {
  const normalized = (roleLevel || '').trim().toLowerCase();
  const mappedKey = ROLE_KEY_MAP[normalized];
  if (mappedKey) {
    return i18n.t(mappedKey);
  }
  return roleLevel || '';
}

function buildMailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildLeadMailtoHref(lead: EnterpriseLeadItem): string {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim();
  const subject = i18n.t('admin.sales.email_default_subject', { company: lead.companyName });
  const body = i18n.t('admin.sales.email_default_body', {
    company: lead.companyName,
    name: lead.firstName || fullName,
  });
  return buildMailtoHref(lead.workEmail, subject, body);
}

function buildContractDownloadUrl(appSlug: string, contractId: number, mode: 'download' | 'view'): string {
  const base = `/api/admin/apps/${encodeURIComponent(appSlug)}/sales/contracts/${contractId}/download`;
  return mode === 'view' ? `${base}?mode=view` : base;
}

function getContractErrorText(res: { code?: string; error?: string }): string {
  const code = res.code || '';
  if (
    code === 'DANGEROUS_BINARY_DETECTED' ||
    code === 'MALICIOUS_SCRIPT_DETECTED' ||
    code === 'MALICIOUS_DOCUMENT_ACTION'
  ) {
    return i18n.t('admin.sales.contract_error_security');
  }
  if (
    code === 'MIME_NOT_ALLOWED' ||
    code === 'CATEGORY_NOT_ALLOWED' ||
    code === 'UNSUPPORTED_OR_CORRUPT_FILE'
  ) {
    return i18n.t('admin.sales.contract_error_type');
  }
  if (code === 'FILE_TOO_LARGE') {
    return i18n.t('admin.sales.contract_error_size');
  }
  return res.error || i18n.t('admin.sales.contract_upload_error');
}

async function createAppSalesView(
  app: AccessibleAdminApp,
  onAccessDenied: () => Promise<void>
): Promise<AdminViewElement | null> {
  const container = document.createElement('div') as AdminViewElement;
  container.className = 'component-layout--split-full';
  container.setAttribute('data-ref', 'app-sales-layout');

  container.innerHTML = `
    <div class="component-top" data-ref="sales-top">
      <div class="component-top__left" data-ref="sales-top-left">
        <div class="component-top__title-box" data-ref="sales-title-heading">
          <span class="component-top__title-text" data-ref="sales-title">${escapeHtml(i18n.t('admin.sales.title'))}</span>
          <span class="component-badge component-badge--neutral component-badge--sm is-hidden" data-ref="sales-total-badge"></span>
          <span class="component-badge component-badge--neutral component-badge--sm is-hidden" data-ref="sales-selected-badge"></span>
        </div>
      </div>
      <div class="component-top__right" data-ref="sales-header-actions">
        <div class="component-group component-group--actions is-hidden" data-ref="sales-selection-actions">
          <button type="button" class="component-button component-button--h36 component-button--secondary" data-ref="btn-lead-view-detail">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
            <span>${escapeHtml(i18n.t('admin.sales.action_view_detail'))}</span>
          </button>
          <a class="component-button component-button--h36 component-button--secondary" data-ref="btn-lead-contact-mail" href="#" target="_blank" rel="noopener noreferrer">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#mail"></use></svg>
            <span>${escapeHtml(i18n.t('admin.sales.action_contact_email'))}</span>
          </a>
          <button type="button" class="component-button component-button--h36 component-button--black is-hidden" data-ref="btn-lead-assign-enterprise">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#rocket_launch"></use></svg>
            <span>${escapeHtml(i18n.t('admin.sales.action_assign_enterprise'))}</span>
          </button>
          <button type="button" class="component-button component-button--h36 component-button--secondary component-button--icon-only" data-ref="btn-lead-copy-email" data-tooltip="${escapeHtml(i18n.t('admin.sales.action_copy_email'))}" aria-label="${escapeHtml(i18n.t('admin.sales.action_copy_email'))}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
          </button>
          <button type="button" class="component-button component-button--h36 component-button--secondary component-button--icon-only" data-ref="btn-clear-lead-selection" data-tooltip="${escapeHtml(i18n.t('admin.sales.action_deselect'))}" aria-label="${escapeHtml(i18n.t('admin.sales.action_deselect'))}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <button type="button" class="component-button component-button--h36 component-button--black is-hidden" data-ref="btn-open-direct-provision">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#business_center"></use></svg>
          <span>${escapeHtml(i18n.t('admin.sales.action_assign_enterprise'))}</span>
        </button>
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-refresh-sales" data-tooltip="${escapeHtml(i18n.t('common.refresh'))}" aria-label="${escapeHtml(i18n.t('common.refresh'))}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg>
        </button>
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-toggle-sales-search" data-tooltip="${escapeHtml(i18n.t('common.search'))}" aria-label="${escapeHtml(i18n.t('common.search'))}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--full" data-ref="sales-bottom">
      <div class="component-floating-search is-hidden" data-ref="sales-search-toolbar">
        <div class="component-floating-search__inner" data-ref="sales-search-inner">
          <div class="component-search component-search--floating" data-ref="sales-search-box">
            <div class="component-search__icon" data-ref="sales-search-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
            </div>
            <div class="component-search__input-box" data-ref="sales-search-input-box">
              <input class="component-search__input" data-ref="sales-search-input" type="text" placeholder="${escapeHtml(i18n.t('admin.sales.search_placeholder'))}" maxlength="120" autocomplete="off" />
            </div>
            <button type="button" class="component-button component-button--h34 component-button--icon-only is-hidden" data-ref="btn-clear-sales-search" aria-label="${escapeHtml(i18n.t('common.clear_search'))}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
        </div>
      </div>

      <div class="component-table-wrapper component-table-wrapper--flush" data-ref="sales-table-wrapper">
        <table class="component-table component-table--flush" data-ref="sales-table">
          <thead class="component-table__head" data-ref="sales-thead">
            <tr>
              <th class="component-table__cell--pl20" data-ref="th-contact">${escapeHtml(i18n.t('admin.sales.col_contact'))}</th>
              <th data-ref="th-company">${escapeHtml(i18n.t('admin.sales.col_company'))}</th>
              <th data-ref="th-account">${escapeHtml(i18n.t('admin.sales.col_account'))}</th>
              <th data-ref="th-status">${escapeHtml(i18n.t('admin.sales.col_status'))}</th>
              <th data-ref="th-location-role">${escapeHtml(i18n.t('admin.sales.col_location_role'))}</th>
              <th data-ref="th-contracts">${escapeHtml(i18n.t('admin.sales.col_contracts'))}</th>
              <th class="component-table__cell--pr20" data-ref="th-date">${escapeHtml(i18n.t('admin.sales.col_date'))}</th>
            </tr>
          </thead>
          <tbody class="component-table__body" data-ref="sales-tbody">
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = container.querySelector<HTMLElement>('[data-ref="sales-tbody"]');
  const tableEl = container.querySelector<HTMLElement>('[data-ref="sales-table"]');
  const tableWrapper = container.querySelector<HTMLElement>('[data-ref="sales-table-wrapper"]');
  const searchInput = container.querySelector<HTMLInputElement>('[data-ref="sales-search-input"]');
  const btnClearSearch = container.querySelector<HTMLElement>('[data-ref="btn-clear-sales-search"]');
  const btnToggleSearch = container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-sales-search"]');
  const btnRefresh = container.querySelector<HTMLButtonElement>('[data-ref="btn-refresh-sales"]');
  const btnOpenDirectProvision = container.querySelector<HTMLButtonElement>('[data-ref="btn-open-direct-provision"]');
  const searchToolbar = container.querySelector<HTMLElement>('[data-ref="sales-search-toolbar"]');
  const totalBadge = container.querySelector<HTMLElement>('[data-ref="sales-total-badge"]');
  const selectedBadge = container.querySelector<HTMLElement>('[data-ref="sales-selected-badge"]');
  const selectionActions = container.querySelector<HTMLElement>('[data-ref="sales-selection-actions"]');
  const btnViewDetail = container.querySelector<HTMLButtonElement>('[data-ref="btn-lead-view-detail"]');
  const btnContactMail = container.querySelector<HTMLAnchorElement>('[data-ref="btn-lead-contact-mail"]');
  const btnAssignEnterprise = container.querySelector<HTMLButtonElement>('[data-ref="btn-lead-assign-enterprise"]');
  const btnCopyEmail = container.querySelector<HTMLButtonElement>('[data-ref="btn-lead-copy-email"]');
  const btnClearSelection = container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-lead-selection"]');

  let allLeads: EnterpriseLeadItem[] = [];
  let currentlyDisplayedLeads: EnterpriseLeadItem[] = [];
  let selectedLeadId: number | null = null;
  let canManage = false;
  let isDisposed = false;

  const getSelectedLead = (): EnterpriseLeadItem | null => {
    if (selectedLeadId === null) return null;
    return allLeads.find((l) => l.id === selectedLeadId) || null;
  };

  const updateTotalBadge = (count: number) => {
    if (!totalBadge) return;
    if (allLeads.length === 0) {
      totalBadge.classList.add('is-hidden');
      return;
    }
    totalBadge.textContent = count === 1
      ? i18n.t('admin.sales.total_count_one')
      : i18n.t('admin.sales.total_count', { count: formatNumber(count) });
    totalBadge.classList.remove('is-hidden');
  };

  const updateSelectionUI = () => {
    const selectedLead = getSelectedLead();
    const hasSelection = selectedLead !== null;
    if (hasSelection) {
      if (selectedBadge) {
        selectedBadge.textContent = i18n.t('admin.sales.selected_count', { count: 1 });
        selectedBadge.classList.remove('is-hidden');
      }
      if (btnContactMail) {
        btnContactMail.href = buildLeadMailtoHref(selectedLead);
      }
      selectionActions?.classList.remove('is-hidden');
      btnAssignEnterprise?.classList.toggle('is-hidden', !canManage);
      btnOpenDirectProvision?.classList.add('is-hidden');
      btnToggleSearch?.classList.add('is-hidden');
      btnRefresh?.classList.add('is-hidden');
    } else {
      if (btnContactMail) {
        btnContactMail.href = '#';
      }
      selectedBadge?.classList.add('is-hidden');
      selectionActions?.classList.add('is-hidden');
      btnOpenDirectProvision?.classList.toggle('is-hidden', !canManage);
      btnToggleSearch?.classList.remove('is-hidden');
      btnRefresh?.classList.remove('is-hidden');
    }
    renderIcons(container);
  };

  const filterLeads = (queryRaw: string): EnterpriseLeadItem[] => {
    const query = queryRaw.trim().toLowerCase();
    if (!query) {
      return allLeads;
    }
    return allLeads.filter((l) => {
      const fullName = `${l.firstName} ${l.lastName}`.toLowerCase();
      const statusLabel = getLeadStatusInfo(l.status).label.toLowerCase();
      const roleLabel = getRoleLevelLabel(l.roleLevel).toLowerCase();
      const matchedUsername = (l.matchedUser?.username || '').toLowerCase();
      return (
        fullName.includes(query) ||
        l.workEmail.toLowerCase().includes(query) ||
        l.companyName.toLowerCase().includes(query) ||
        l.country.toLowerCase().includes(query) ||
        l.status.toLowerCase().includes(query) ||
        statusLabel.includes(query) ||
        roleLabel.includes(query) ||
        matchedUsername.includes(query) ||
        String(l.id).includes(query)
      );
    });
  };

  const formatAccountBannerText = (user: EnterpriseLeadMatchedUser): string => {
    const tierLabel = getPlanLabel(user.subscriptionTier);
    if (user.organizationName && user.seatsLimit !== null) {
      return i18n.t('admin.sales.account_found_org', {
        org: user.organizationName,
        seats: formatNumber(user.seatsLimit),
        tier: tierLabel,
        username: user.username,
      });
    }
    return i18n.t('admin.sales.account_found', {
      storage: formatBytes(user.storageLimitBytes),
      tier: tierLabel,
      username: user.username,
    });
  };

  const openProvisionDialog = (lead?: EnterpriseLeadItem) => {
    let matchedUser: EnterpriseLeadMatchedUser | null = lead?.matchedUser || null;
    const initialEmail = lead?.workEmail || '';
    const initialOrgName = matchedUser?.organizationName || lead?.companyName || '';
    const initialDomain = matchedUser?.organizationDomain || '';
    const initialSeats = matchedUser?.seatsLimit && matchedUser.seatsLimit > 0 ? matchedUser.seatsLimit : 25;

    let initialStorageVal = 1;
    let initialStorageUnit: 'gb' | 'tb' = 'tb';
    if (matchedUser && matchedUser.subscriptionTier === 'enterprise' && matchedUser.storageLimitBytes >= BYTES_PER_GB) {
      if (matchedUser.storageLimitBytes >= BYTES_PER_TB && matchedUser.storageLimitBytes % BYTES_PER_TB === 0) {
        initialStorageVal = Math.max(1, Math.round(matchedUser.storageLimitBytes / BYTES_PER_TB));
        initialStorageUnit = 'tb';
      } else {
        initialStorageVal = Math.max(1, Math.round(matchedUser.storageLimitBytes / BYTES_PER_GB));
        initialStorageUnit = 'gb';
      }
    }

    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'component-form-grid';
    bodyWrapper.innerHTML = `
      <div class="component-kv-item--full component-form-row" data-ref="provision-lookup-row">
        <div class="field" data-ref="field-provision-email">
          <input class="field__input" data-ref="input-provision-email" type="email" value="${escapeHtml(initialEmail)}" placeholder=" " autocomplete="off" aria-label="${escapeHtml(i18n.t('admin.sales.provision_email_label'))}" />
          <span class="field__label">${escapeHtml(i18n.t('admin.sales.provision_email_label'))}</span>
        </div>
        <button type="button" class="component-button component-button--h36 component-button--secondary" data-ref="btn-provision-lookup">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <span>${escapeHtml(i18n.t('admin.sales.btn_lookup_user'))}</span>
        </button>
      </div>

      <div class="component-kv-item--full" data-ref="provision-account-banner-wrap">
        <div class="component-banner ${matchedUser ? 'component-banner--info' : 'component-banner--warning'}${initialEmail ? '' : ' is-hidden'}" data-ref="provision-account-banner">${matchedUser ? escapeHtml(formatAccountBannerText(matchedUser)) : (initialEmail ? escapeHtml(i18n.t('admin.sales.account_not_registered')) : '')}</div>
      </div>

      <div class="field" data-ref="field-provision-org-name">
        <input class="field__input" data-ref="input-provision-org-name" type="text" value="${escapeHtml(initialOrgName)}" placeholder=" " maxlength="100" autocomplete="off" aria-label="${escapeHtml(i18n.t('admin.sales.provision_org_name_label'))}" />
        <span class="field__label">${escapeHtml(i18n.t('admin.sales.provision_org_name_label'))}</span>
      </div>

      <div class="field" data-ref="field-provision-domain">
        <input class="field__input" data-ref="input-provision-domain" type="text" value="${escapeHtml(initialDomain)}" placeholder=" " maxlength="100" autocomplete="off" aria-label="${escapeHtml(i18n.t('admin.sales.provision_domain_label'))}" />
        <span class="field__label">${escapeHtml(i18n.t('admin.sales.provision_domain_label'))}</span>
      </div>

      <div class="field" data-ref="field-provision-seats">
        <input class="field__input" data-ref="input-provision-seats" type="number" min="1" max="100000" step="1" value="${escapeHtml(String(initialSeats))}" placeholder=" " aria-label="${escapeHtml(i18n.t('admin.sales.provision_seats_label'))}" />
        <span class="field__label">${escapeHtml(i18n.t('admin.sales.provision_seats_label'))}</span>
      </div>

      <div class="field" data-ref="field-provision-duration">
        <input class="field__input" data-ref="input-provision-duration" type="number" min="1" max="120" step="1" value="12" placeholder=" " aria-label="${escapeHtml(i18n.t('admin.sales.provision_duration_label'))}" />
        <span class="field__label">${escapeHtml(i18n.t('admin.sales.provision_duration_label'))}</span>
      </div>

      <div class="field" data-ref="field-provision-storage-val">
        <input class="field__input" data-ref="input-provision-storage-val" type="number" min="1" max="100000" step="1" value="${escapeHtml(String(initialStorageVal))}" placeholder=" " aria-label="${escapeHtml(i18n.t('admin.sales.provision_storage_val_label'))}" />
        <span class="field__label">${escapeHtml(i18n.t('admin.sales.provision_storage_val_label'))}</span>
      </div>

      <div class="component-field-group" data-ref="group-provision-storage-unit">
        <span class="component-field-group__label">${escapeHtml(i18n.t('admin.sales.provision_storage_unit_label'))}</span>
        <select class="component-select-field" data-ref="select-provision-storage-unit" aria-label="${escapeHtml(i18n.t('admin.sales.provision_storage_unit_label'))}">
          <option value="gb"${initialStorageUnit === 'gb' ? ' selected' : ''}>${escapeHtml(i18n.t('admin.sales.provision_storage_unit_gb'))}</option>
          <option value="tb"${initialStorageUnit === 'tb' ? ' selected' : ''}>${escapeHtml(i18n.t('admin.sales.provision_storage_unit_tb'))}</option>
        </select>
      </div>

      <div class="component-field-group" data-ref="group-provision-period">
        <span class="component-field-group__label">${escapeHtml(i18n.t('admin.sales.provision_period_label'))}</span>
        <select class="component-select-field" data-ref="select-provision-period" aria-label="${escapeHtml(i18n.t('admin.sales.provision_period_label'))}">
          <option value="yearly" selected>${escapeHtml(i18n.t('admin.sales.provision_period_yearly'))}</option>
          <option value="monthly">${escapeHtml(i18n.t('admin.sales.provision_period_monthly'))}</option>
          <option value="custom">${escapeHtml(i18n.t('admin.sales.provision_period_custom'))}</option>
        </select>
      </div>

      <div class="field" data-ref="field-provision-amount">
        <input class="field__input" data-ref="input-provision-amount" type="number" min="0" step="0.01" value="" placeholder=" " aria-label="${escapeHtml(i18n.t('admin.sales.provision_amount_label'))}" />
        <span class="field__label">${escapeHtml(i18n.t('admin.sales.provision_amount_label'))}</span>
      </div>

      <div class="component-section-heading component-kv-item--full" data-ref="provision-contract-heading">
        <h3 class="component-section-heading__title">${escapeHtml(i18n.t('admin.sales.provision_contract_section'))}</h3>
      </div>

      <div class="field component-kv-item--full" data-ref="field-provision-contract-title">
        <input class="field__input" data-ref="input-provision-contract-title" type="text" value="" placeholder=" " maxlength="180" autocomplete="off" aria-label="${escapeHtml(i18n.t('admin.sales.contract_upload_title_label'))}" />
        <span class="field__label">${escapeHtml(i18n.t('admin.sales.contract_upload_title_label'))}</span>
      </div>

      <div class="component-form-row component-kv-item--full" data-ref="provision-contract-drop-row">
        <label class="component-file-drop" data-ref="provision-contract-drop">
          <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp" data-ref="input-provision-contract-file" hidden />
          <span class="component-file-drop__icon" aria-hidden="true">
            <svg class="component-icon"><use href="/icons.svg#upload_file"></use></svg>
          </span>
          <span class="component-file-drop__body">
            <span class="component-file-drop__text" data-ref="provision-contract-file-text">${escapeHtml(i18n.t('admin.sales.contract_choose_file'))}</span>
            <span class="component-file-drop__sub">${escapeHtml(i18n.t('admin.sales.provision_contract_optional_hint'))}</span>
          </span>
        </label>
        <button type="button" class="component-button component-button--h36 component-button--secondary component-button--icon-only is-hidden" data-ref="btn-provision-contract-clear" data-tooltip="${escapeHtml(i18n.t('admin.sales.contract_clear_file'))}" aria-label="${escapeHtml(i18n.t('admin.sales.contract_clear_file'))}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
    `;

    const emailInput = bodyWrapper.querySelector<HTMLInputElement>('[data-ref="input-provision-email"]');
    const btnLookup = bodyWrapper.querySelector<HTMLButtonElement>('[data-ref="btn-provision-lookup"]');
    const bannerEl = bodyWrapper.querySelector<HTMLElement>('[data-ref="provision-account-banner"]');
    const orgNameInput = bodyWrapper.querySelector<HTMLInputElement>('[data-ref="input-provision-org-name"]');
    const domainInput = bodyWrapper.querySelector<HTMLInputElement>('[data-ref="input-provision-domain"]');
    const seatsInput = bodyWrapper.querySelector<HTMLInputElement>('[data-ref="input-provision-seats"]');
    const durationInput = bodyWrapper.querySelector<HTMLInputElement>('[data-ref="input-provision-duration"]');
    const storageValInput = bodyWrapper.querySelector<HTMLInputElement>('[data-ref="input-provision-storage-val"]');
    const storageUnitSelect = bodyWrapper.querySelector<HTMLSelectElement>('[data-ref="select-provision-storage-unit"]');
    const periodSelect = bodyWrapper.querySelector<HTMLSelectElement>('[data-ref="select-provision-period"]');
    const amountInput = bodyWrapper.querySelector<HTMLInputElement>('[data-ref="input-provision-amount"]');
    const contractTitleInput = bodyWrapper.querySelector<HTMLInputElement>('[data-ref="input-provision-contract-title"]');
    const contractFileInput = bodyWrapper.querySelector<HTMLInputElement>('[data-ref="input-provision-contract-file"]');
    const contractDropLabel = bodyWrapper.querySelector<HTMLElement>('[data-ref="provision-contract-drop"]');
    const contractFileText = bodyWrapper.querySelector<HTMLElement>('[data-ref="provision-contract-file-text"]');
    const btnContractClear = bodyWrapper.querySelector<HTMLButtonElement>('[data-ref="btn-provision-contract-clear"]');

    const syncProvisionContractFileUI = () => {
      const chosen = contractFileInput?.files?.[0] || null;
      if (!chosen) {
        contractDropLabel?.classList.remove('component-file-drop--selected');
        btnContractClear?.classList.add('is-hidden');
        if (contractFileText) {
          contractFileText.textContent = i18n.t('admin.sales.contract_choose_file');
        }
        return;
      }
      if (chosen.size > MAX_CONTRACT_FILE_BYTES) {
        if (contractFileInput) contractFileInput.value = '';
        contractDropLabel?.classList.remove('component-file-drop--selected');
        btnContractClear?.classList.add('is-hidden');
        if (contractFileText) {
          contractFileText.textContent = i18n.t('admin.sales.contract_choose_file');
        }
        toast.error(i18n.t('admin.sales.contract_error_size'));
        return;
      }
      contractDropLabel?.classList.add('component-file-drop--selected');
      btnContractClear?.classList.remove('is-hidden');
      if (contractFileText) {
        contractFileText.textContent = i18n.t('admin.sales.contract_file_selected', {
          name: chosen.name,
          size: formatBytes(chosen.size),
        });
      }
    };

    contractFileInput?.addEventListener('change', syncProvisionContractFileUI);
    btnContractClear?.addEventListener('click', (e) => {
      e.preventDefault();
      if (contractFileInput) {
        contractFileInput.value = '';
      }
      syncProvisionContractFileUI();
    });

    btnLookup?.addEventListener('click', async (e) => {
      e.preventDefault();
      const targetEmail = emailInput?.value.trim().toLowerCase() || '';
      if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        if (bannerEl) {
          bannerEl.className = 'component-banner component-banner--warning';
          bannerEl.textContent = i18n.t('admin.sales.lookup_empty_email');
        }
        return;
      }

      btnLookup.disabled = true;
      btnLookup.classList.add('is-loading');
      try {
        const res = await getApi<LookupUserApiResponse>(
          `/api/admin/apps/${encodeURIComponent(app.slug)}/sales/lookup-user?email=${encodeURIComponent(targetEmail)}`
        );
        if (!res.ok || !res.found || !res.user) {
          matchedUser = null;
          if (bannerEl) {
            bannerEl.className = 'component-banner component-banner--warning';
            bannerEl.textContent = i18n.t('admin.sales.lookup_not_found');
          }
          return;
        }

        matchedUser = res.user;
        if (bannerEl) {
          bannerEl.className = 'component-banner component-banner--info';
          bannerEl.textContent = formatAccountBannerText(res.user);
        }
        if (orgNameInput && !orgNameInput.value.trim() && res.user.organizationName) {
          orgNameInput.value = res.user.organizationName;
        }
        if (domainInput && !domainInput.value.trim() && res.user.organizationDomain) {
          domainInput.value = res.user.organizationDomain;
        }
        if (seatsInput && res.user.seatsLimit && res.user.seatsLimit > 0) {
          seatsInput.value = String(res.user.seatsLimit);
        }
      } catch {
        if (bannerEl) {
          bannerEl.className = 'component-banner component-banner--danger';
          bannerEl.textContent = i18n.t('common.error');
        }
      } finally {
        btnLookup.disabled = false;
        btnLookup.classList.remove('is-loading');
      }
    });

    openDialog({
      bodyHtml: bodyWrapper,
      confirmText: i18n.t('admin.sales.provision_submit'),
      description: i18n.t('admin.sales.provision_desc'),
      size: 'lg',
      title: i18n.t('admin.sales.provision_title'),
      onConfirm: async (instance) => {
        instance.clearError();
        const userEmail = emailInput?.value.trim().toLowerCase() || '';
        const organizationName = orgNameInput?.value.trim() || '';
        const organizationDomain = domainInput?.value.trim() || '';
        const seatsLimit = Number(seatsInput?.value || 0);
        const storageVal = Number(storageValInput?.value || 0);
        const storageUnit = storageUnitSelect?.value === 'gb' ? 'gb' : 'tb';
        const durationMonths = Number(durationInput?.value || 0);
        const billingPeriod = (periodSelect?.value || 'yearly') as 'custom' | 'monthly' | 'yearly';
        const rawAmount = amountInput?.value.trim() || '';
        const contractAmount = rawAmount ? Number(rawAmount) : 0;

        if (
          !userEmail ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail) ||
          !organizationName ||
          !Number.isFinite(seatsLimit) ||
          seatsLimit < 1 ||
          seatsLimit > 100000 ||
          !Number.isFinite(storageVal) ||
          storageVal < 1 ||
          !Number.isFinite(durationMonths) ||
          durationMonths < 1 ||
          durationMonths > 120 ||
          !Number.isFinite(contractAmount) ||
          contractAmount < 0
        ) {
          instance.showError(i18n.t('admin.sales.provision_validation_error'));
          return false;
        }

        const storageLimitBytes = Math.round(
          storageVal * (storageUnit === 'tb' ? BYTES_PER_TB : BYTES_PER_GB)
        );

        instance.setConfirmLoading(true);
        try {
          const res = await postApi<ProvisionApiResponse>(
            `/api/admin/apps/${encodeURIComponent(app.slug)}/sales/provision-enterprise`,
            {
              billingPeriod,
              contractAmount,
              currency: 'USD',
              durationMonths,
              leadId: lead?.id || null,
              organizationDomain: organizationDomain || null,
              organizationName,
              seatsLimit,
              storageLimitBytes,
              userEmail,
            }
          );

          if (!res.ok || !res.provisioned) {
            if (res.code === 'ACCOUNT_NOT_FOUND') {
              instance.showError(i18n.t('admin.sales.error_account_not_found'));
            } else {
              instance.showError(res.error || i18n.t('common.error'));
            }
            return false;
          }

          toast.success(
            i18n.t('admin.sales.provision_success', {
              seats: formatNumber(res.provisioned.seatsLimit),
              storage: formatBytes(res.provisioned.storageLimitBytes),
            })
          );

          const selectedContractFile = contractFileInput?.files?.[0] || null;
          if (selectedContractFile) {
            const formData = new FormData();
            formData.append('file', selectedContractFile);
            formData.append('userEmail', userEmail);
            formData.append('organizationId', String(res.provisioned.organizationId));
            if (lead?.id) {
              formData.append('leadId', String(lead.id));
            }
            const contractTitle = contractTitleInput?.value.trim() || '';
            if (contractTitle) {
              formData.append('title', contractTitle);
            }
            try {
              const uploadRes = await postApi<ContractUploadApiResponse>(
                `/api/admin/apps/${encodeURIComponent(app.slug)}/sales/contracts`,
                formData
              );
              if (!uploadRes.ok) {
                toast.error(
                  i18n.t('admin.sales.provision_contract_upload_failed', {
                    reason: getContractErrorText(uploadRes),
                  })
                );
              } else {
                toast.success(i18n.t('admin.sales.contract_uploaded_success'));
              }
            } catch {
              toast.error(
                i18n.t('admin.sales.provision_contract_upload_failed', {
                  reason: i18n.t('admin.sales.contract_upload_error'),
                })
              );
            }
          }

          await loadLeads(false);
          return true;
        } catch {
          instance.showError(i18n.t('common.error'));
          return false;
        } finally {
          instance.setConfirmLoading(false);
        }
      },
    });
  };

  const openLeadDetailDialog = async (leadId: number) => {
    const bodyEl = document.createElement('div');
    bodyEl.innerHTML = `<p class="component-note-inline" data-ref="lead-detail-loading">${escapeHtml(i18n.t('admin.sales.detail_loading'))}</p>`;

    const footerExtraHtml = `
      <a class="component-button component-button--h36 component-button--secondary is-hidden" data-ref="btn-detail-contact-mail" href="#" target="_blank" rel="noopener noreferrer">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#mail"></use></svg>
        <span>${escapeHtml(i18n.t('admin.sales.action_contact_email'))}</span>
      </a>
      ${canManage ? `
        <button type="button" class="component-button component-button--h36 component-button--black" data-ref="btn-detail-provision" disabled>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#rocket_launch"></use></svg>
          <span>${escapeHtml(i18n.t('admin.sales.action_assign_enterprise'))}</span>
        </button>
      ` : ''}
    `;

    const dialog = openDialog({
      bodyHtml: bodyEl,
      cancelText: i18n.t('common.close'),
      footerExtraHtml,
      showCancel: true,
      showConfirm: false,
      size: 'lg',
      title: i18n.t('admin.sales.detail_title'),
    });

    try {
      const res = await getApi<LeadDetailApiResponse>(
        `/api/admin/apps/${encodeURIComponent(app.slug)}/sales/leads/${leadId}`
      );
      if (!res.ok || !res.detail) {
        if (res.code === 'PAGE_ACCESS_DENIED') {
          dialog.close();
          await onAccessDenied();
          return;
        }
        bodyEl.innerHTML = `<div class="component-banner component-banner--danger">${escapeHtml(res.error || i18n.t('common.error'))}</div>`;
        return;
      }

      const { contracts, lead } = res.detail;
      let currentContracts: EnterpriseContractItem[] = Array.isArray(contracts) ? [...contracts] : [];
      const fullName = `${lead.firstName} ${lead.lastName}`.trim();
      const accountText = lead.matchedUser
        ? formatAccountBannerText(lead.matchedUser)
        : i18n.t('admin.sales.account_not_registered');

      bodyEl.innerHTML = `
        <div class="component-kv-grid" data-ref="lead-detail-kv-grid">
          <div class="component-kv-item">
            <span class="component-kv-item__label">${escapeHtml(i18n.t('admin.sales.col_contact'))}</span>
            <span class="component-kv-item__value">${escapeHtml(fullName)}</span>
          </div>
          <div class="component-kv-item">
            <span class="component-kv-item__label">${escapeHtml(i18n.t('admin.sales.detail_email'))}</span>
            <span class="component-kv-item__value">${escapeHtml(lead.workEmail)}</span>
          </div>
          <div class="component-kv-item">
            <span class="component-kv-item__label">${escapeHtml(i18n.t('admin.sales.detail_company'))}</span>
            <span class="component-kv-item__value">${escapeHtml(lead.companyName)} (${escapeHtml(i18n.t('admin.sales.company_size_suffix', { size: lead.companySize }))})</span>
          </div>
          <div class="component-kv-item">
            <span class="component-kv-item__label">${escapeHtml(i18n.t('admin.sales.detail_phone'))}</span>
            <span class="component-kv-item__value">${escapeHtml(lead.phoneNumber)}</span>
          </div>
          <div class="component-kv-item">
            <span class="component-kv-item__label">${escapeHtml(i18n.t('admin.sales.detail_country'))}</span>
            <span class="component-kv-item__value">${escapeHtml(lead.country)}</span>
          </div>
          <div class="component-kv-item">
            <span class="component-kv-item__label">${escapeHtml(i18n.t('admin.sales.detail_role'))}</span>
            <span class="component-kv-item__value">${escapeHtml(getRoleLevelLabel(lead.roleLevel))}</span>
          </div>
          <div class="component-kv-item">
            <span class="component-kv-item__label">${escapeHtml(i18n.t('admin.sales.detail_hear_about'))}</span>
            <span class="component-kv-item__value">${escapeHtml(lead.hearAbout)}</span>
          </div>
          <div class="component-kv-item">
            <span class="component-kv-item__label">${escapeHtml(i18n.t('admin.sales.detail_created_at'))}</span>
            <span class="component-kv-item__value">${escapeHtml(formatDateTime(lead.createdAt))}</span>
          </div>
          <div class="component-kv-item component-kv-item--full">
            <span class="component-kv-item__label">${escapeHtml(i18n.t('admin.sales.detail_account_label'))}</span>
            <span class="component-kv-item__value">${escapeHtml(accountText)}</span>
          </div>
          <div class="component-kv-item component-kv-item--full">
            <span class="component-kv-item__label">${escapeHtml(i18n.t('admin.sales.detail_notes'))}</span>
            <span class="component-kv-item__value">${escapeHtml(lead.notes || i18n.t('admin.sales.detail_notes_empty'))}</span>
          </div>
        </div>

        ${canManage ? `
          <div class="component-field-group" data-ref="lead-detail-status-group">
            <span class="component-field-group__label">${escapeHtml(i18n.t('admin.sales.detail_status_label'))}</span>
            <div class="component-form-row">
              <select class="component-select-field" data-ref="select-detail-lead-status" aria-label="${escapeHtml(i18n.t('admin.sales.detail_status_label'))}">
                <option value="pending"${lead.status === 'pending' ? ' selected' : ''}>${escapeHtml(i18n.t('admin.sales.status_pending'))}</option>
                <option value="contacted"${lead.status === 'contacted' ? ' selected' : ''}>${escapeHtml(i18n.t('admin.sales.status_contacted'))}</option>
                <option value="approved"${lead.status === 'approved' ? ' selected' : ''}>${escapeHtml(i18n.t('admin.sales.status_approved'))}</option>
                <option value="rejected"${lead.status === 'rejected' ? ' selected' : ''}>${escapeHtml(i18n.t('admin.sales.status_rejected'))}</option>
              </select>
              <button type="button" class="component-button component-button--h36 component-button--secondary" data-ref="btn-save-lead-status">
                <span>${escapeHtml(i18n.t('admin.sales.btn_save_status'))}</span>
              </button>
            </div>
          </div>
        ` : ''}

        <div class="component-section-heading">
          <h3 class="component-section-heading__title">${escapeHtml(i18n.t('admin.sales.contract_section_title'))}</h3>
        </div>
        <div class="component-contract-list" data-ref="lead-detail-contracts"></div>

        ${canManage ? `
          <div class="component-form-grid" data-ref="lead-detail-contract-upload-box">
            <div class="field component-kv-item--full" data-ref="field-detail-contract-title">
              <input class="field__input" data-ref="input-detail-contract-title" type="text" value="" placeholder=" " maxlength="180" autocomplete="off" aria-label="${escapeHtml(i18n.t('admin.sales.contract_upload_title_label'))}" />
              <span class="field__label">${escapeHtml(i18n.t('admin.sales.contract_upload_title_label'))}</span>
            </div>
            <div class="component-form-row component-kv-item--full" data-ref="detail-contract-drop-row">
              <label class="component-file-drop" data-ref="detail-contract-drop">
                <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp" data-ref="input-detail-contract-file" hidden />
                <span class="component-file-drop__icon" aria-hidden="true">
                  <svg class="component-icon"><use href="/icons.svg#upload_file"></use></svg>
                </span>
                <span class="component-file-drop__body">
                  <span class="component-file-drop__text" data-ref="detail-contract-file-text">${escapeHtml(i18n.t('admin.sales.contract_choose_file'))}</span>
                  <span class="component-file-drop__sub">${escapeHtml(i18n.t('admin.sales.contract_file_hint'))}</span>
                </span>
              </label>
              <button type="button" class="component-button component-button--h36 component-button--secondary component-button--icon-only is-hidden" data-ref="btn-detail-contract-clear" data-tooltip="${escapeHtml(i18n.t('admin.sales.contract_clear_file'))}" aria-label="${escapeHtml(i18n.t('admin.sales.contract_clear_file'))}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
              </button>
              <button type="button" class="component-button component-button--h36 component-button--black" data-ref="btn-detail-contract-upload">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
                <span>${escapeHtml(i18n.t('admin.sales.contract_upload_btn'))}</span>
              </button>
            </div>
          </div>
        ` : ''}
      `;

      const contractsListEl = bodyEl.querySelector<HTMLElement>('[data-ref="lead-detail-contracts"]');
      const renderDetailContracts = () => {
        if (!contractsListEl) return;
        if (currentContracts.length === 0) {
          contractsListEl.innerHTML = `<p class="component-note-inline" data-ref="lead-detail-contracts-empty">${escapeHtml(i18n.t('admin.sales.contract_empty'))}</p>`;
          return;
        }

        contractsListEl.innerHTML = currentContracts
          .map((c) => {
            const canViewInline = c.mimeType === 'application/pdf' || c.mimeType.startsWith('image/');
            const iconName = c.mimeType === 'application/pdf' ? 'picture_as_pdf' : 'description';
            return `
              <div class="component-contract-item" data-ref="contract-item-${c.id}">
                <div class="component-contract-item__info">
                  <span class="component-contract-item__icon" aria-hidden="true">
                    <svg class="component-icon"><use href="/icons.svg#${iconName}"></use></svg>
                  </span>
                  <div class="component-contract-item__meta">
                    <span class="component-contract-item__title">${escapeHtml(c.title)}</span>
                    <span class="component-contract-item__sub">${escapeHtml(c.originalFilename)} · ${escapeHtml(formatBytes(c.fileSizeBytes))} · ${escapeHtml(formatDateTime(c.createdAt))}</span>
                  </div>
                </div>
                <div class="component-contract-item__actions">
                  ${canViewInline ? `
                    <a class="component-button component-button--h34 component-button--secondary" href="${escapeHtml(buildContractDownloadUrl(app.slug, c.id, 'view'))}" target="_blank" rel="noopener noreferrer" data-ref="btn-contract-view-${c.id}">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
                      <span>${escapeHtml(i18n.t('admin.sales.contract_view'))}</span>
                    </a>
                  ` : ''}
                  <a class="component-button component-button--h34 component-button--secondary" href="${escapeHtml(buildContractDownloadUrl(app.slug, c.id, 'download'))}" download="${escapeHtml(c.originalFilename)}" data-ref="btn-contract-download-${c.id}">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                    <span>${escapeHtml(i18n.t('admin.sales.contract_download'))}</span>
                  </a>
                  ${canManage ? `
                    <button type="button" class="component-button component-button--h34 component-button--secondary component-button--icon-only" data-ref="btn-contract-delete-${c.id}" data-tooltip="${escapeHtml(i18n.t('admin.sales.contract_delete'))}" aria-label="${escapeHtml(i18n.t('admin.sales.contract_delete'))}">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          })
          .join('');

        renderIcons(contractsListEl);

        if (canManage) {
          currentContracts.forEach((c) => {
            const btnDel = contractsListEl.querySelector<HTMLButtonElement>(`[data-ref="btn-contract-delete-${c.id}"]`);
            btnDel?.addEventListener('click', (e) => {
              e.preventDefault();
              openDialog({
                confirmClass: 'component-button--danger',
                confirmText: i18n.t('admin.sales.contract_delete_confirm_btn'),
                description: i18n.t('admin.sales.contract_delete_confirm_desc', { title: c.title }),
                size: 'md',
                title: i18n.t('admin.sales.contract_delete_confirm_title'),
                onConfirm: async (confirmInstance) => {
                  confirmInstance.setConfirmLoading(true);
                  try {
                    const delRes = await deleteApi<ContractDeleteApiResponse>(
                      `/api/admin/apps/${encodeURIComponent(app.slug)}/sales/contracts/${c.id}`
                    );
                    if (!delRes.ok) {
                      confirmInstance.showError(delRes.error || i18n.t('common.error'));
                      return false;
                    }
                    currentContracts = currentContracts.filter((item) => item.id !== c.id);
                    renderDetailContracts();
                    toast.success(i18n.t('admin.sales.contract_deleted_success'));
                    void loadLeads(false);
                    return true;
                  } catch {
                    confirmInstance.showError(i18n.t('common.error'));
                    return false;
                  } finally {
                    confirmInstance.setConfirmLoading(false);
                  }
                },
              });
            });
          });
        }
      };

      renderDetailContracts();
      renderIcons(bodyEl);

      const detailContractTitleInput = bodyEl.querySelector<HTMLInputElement>('[data-ref="input-detail-contract-title"]');
      const detailContractFileInput = bodyEl.querySelector<HTMLInputElement>('[data-ref="input-detail-contract-file"]');
      const detailContractDrop = bodyEl.querySelector<HTMLElement>('[data-ref="detail-contract-drop"]');
      const detailContractFileText = bodyEl.querySelector<HTMLElement>('[data-ref="detail-contract-file-text"]');
      const btnDetailContractClear = bodyEl.querySelector<HTMLButtonElement>('[data-ref="btn-detail-contract-clear"]');
      const btnDetailContractUpload = bodyEl.querySelector<HTMLButtonElement>('[data-ref="btn-detail-contract-upload"]');

      const syncDetailContractFileUI = () => {
        const chosen = detailContractFileInput?.files?.[0] || null;
        if (!chosen) {
          detailContractDrop?.classList.remove('component-file-drop--selected');
          btnDetailContractClear?.classList.add('is-hidden');
          if (detailContractFileText) {
            detailContractFileText.textContent = i18n.t('admin.sales.contract_choose_file');
          }
          return;
        }
        if (chosen.size > MAX_CONTRACT_FILE_BYTES) {
          if (detailContractFileInput) detailContractFileInput.value = '';
          detailContractDrop?.classList.remove('component-file-drop--selected');
          btnDetailContractClear?.classList.add('is-hidden');
          if (detailContractFileText) {
            detailContractFileText.textContent = i18n.t('admin.sales.contract_choose_file');
          }
          toast.error(i18n.t('admin.sales.contract_error_size'));
          return;
        }
        detailContractDrop?.classList.add('component-file-drop--selected');
        btnDetailContractClear?.classList.remove('is-hidden');
        if (detailContractFileText) {
          detailContractFileText.textContent = i18n.t('admin.sales.contract_file_selected', {
            name: chosen.name,
            size: formatBytes(chosen.size),
          });
        }
      };

      detailContractFileInput?.addEventListener('change', syncDetailContractFileUI);
      btnDetailContractClear?.addEventListener('click', (e) => {
        e.preventDefault();
        if (detailContractFileInput) {
          detailContractFileInput.value = '';
        }
        syncDetailContractFileUI();
      });

      btnDetailContractUpload?.addEventListener('click', async (e) => {
        e.preventDefault();
        const chosen = detailContractFileInput?.files?.[0] || null;
        if (!chosen) {
          toast.error(i18n.t('admin.sales.contract_file_required'));
          return;
        }
        if (chosen.size > MAX_CONTRACT_FILE_BYTES) {
          toast.error(i18n.t('admin.sales.contract_error_size'));
          return;
        }

        const formData = new FormData();
        formData.append('file', chosen);
        formData.append('leadId', String(lead.id));
        if (lead.matchedUser?.email || lead.workEmail) {
          formData.append('userEmail', lead.matchedUser?.email || lead.workEmail);
        }
        if (lead.matchedUser?.organizationId) {
          formData.append('organizationId', String(lead.matchedUser.organizationId));
        }
        const title = detailContractTitleInput?.value.trim() || '';
        if (title) {
          formData.append('title', title);
        }

        btnDetailContractUpload.disabled = true;
        btnDetailContractUpload.classList.add('is-loading');
        try {
          const uploadRes = await postApi<ContractUploadApiResponse>(
            `/api/admin/apps/${encodeURIComponent(app.slug)}/sales/contracts`,
            formData
          );
          if (!uploadRes.ok || !uploadRes.contract) {
            toast.error(getContractErrorText(uploadRes));
            return;
          }

          currentContracts = [uploadRes.contract, ...currentContracts];
          if (detailContractTitleInput) detailContractTitleInput.value = '';
          if (detailContractFileInput) detailContractFileInput.value = '';
          syncDetailContractFileUI();
          renderDetailContracts();
          toast.success(i18n.t('admin.sales.contract_uploaded_success'));
          void loadLeads(false);
        } catch {
          toast.error(i18n.t('admin.sales.contract_upload_error'));
        } finally {
          btnDetailContractUpload.disabled = false;
          btnDetailContractUpload.classList.remove('is-loading');
        }
      });

      const statusSelect = bodyEl.querySelector<HTMLSelectElement>('[data-ref="select-detail-lead-status"]');
      const btnSaveStatus = bodyEl.querySelector<HTMLButtonElement>('[data-ref="btn-save-lead-status"]');
      btnSaveStatus?.addEventListener('click', async (e) => {
        e.preventDefault();
        const nextStatus = statusSelect?.value as EnterpriseLeadItem['status'] | undefined;
        if (!nextStatus) return;

        btnSaveStatus.disabled = true;
        try {
          const updateRes = await patchApi<StatusUpdateApiResponse>(
            `/api/admin/apps/${encodeURIComponent(app.slug)}/sales/leads/${lead.id}/status`,
            { status: nextStatus }
          );
          if (!updateRes.ok) {
            toast.error(updateRes.error || i18n.t('common.error'));
            return;
          }
          toast.success(i18n.t('admin.sales.status_updated'));
          await loadLeads(false);
        } catch {
          toast.error(i18n.t('common.error'));
        } finally {
          btnSaveStatus.disabled = false;
        }
      });

      const btnDetailContactMail = dialog.backdrop.querySelector<HTMLAnchorElement>('[data-ref="btn-detail-contact-mail"]');
      const btnDetailProvision = dialog.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-detail-provision"]');

      if (btnDetailContactMail) {
        btnDetailContactMail.href = buildLeadMailtoHref(lead);
        btnDetailContactMail.classList.remove('is-hidden');
      }

      if (btnDetailProvision) {
        btnDetailProvision.disabled = false;
        btnDetailProvision.addEventListener('click', (e) => {
          e.preventDefault();
          dialog.close();
          openProvisionDialog(lead);
        });
      }
    } catch {
      bodyEl.innerHTML = `<div class="component-banner component-banner--danger">${escapeHtml(i18n.t('common.error'))}</div>`;
    }
  };

  const renderRows = (leads: EnterpriseLeadItem[], isSearchResult = false) => {
    currentlyDisplayedLeads = leads;
    updateTotalBadge(leads.length);
    if (!tbody) return;

    if (leads.length === 0) {
      tableEl?.classList.add('is-hidden');
      if (tableWrapper) {
        renderEmptyState({
          container: tableWrapper,
          dataRef: 'sales-empty-state',
          desc: isSearchResult
            ? i18n.t('admin.sales.search_no_results')
            : i18n.t('admin.sales.empty_desc'),
          graphicType: isSearchResult ? 'search' : 'users',
          isTable: true,
          title: isSearchResult
            ? i18n.t('common.search')
            : i18n.t('admin.sales.empty_title'),
        });
      }
      selectedLeadId = null;
      updateSelectionUI();
      return;
    }

    tableEl?.classList.remove('is-hidden');
    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'sales-empty-state');
    }

    if (selectedLeadId !== null && !leads.some((l) => l.id === selectedLeadId)) {
      selectedLeadId = null;
      updateSelectionUI();
    }

    tbody.innerHTML = '';
    leads.forEach((lead) => {
      const isSelected = selectedLeadId === lead.id;
      const row = document.createElement('tr');
      row.className = `component-table__row component-cursor-pointer${isSelected ? ' is-selected' : ''}`;
      row.setAttribute('data-ref', `lead-row-${lead.id}`);

      const fullName = `${lead.firstName} ${lead.lastName}`.trim();
      const avatarSrc = getUserAvatarUrl(
        {
          avatar_url: null,
          email: lead.matchedUser?.email || lead.workEmail,
          id: lead.matchedUser?.id || lead.id,
          username: lead.matchedUser?.username || fullName,
        },
        64
      );
      const statusInfo = getLeadStatusInfo(lead.status);
      const roleText = getRoleLevelLabel(lead.roleLevel);
      const sizeText = i18n.t('admin.sales.company_size_suffix', { size: lead.companySize });

      const accountCellHtml = lead.matchedUser
        ? `
          <div class="component-table__user-meta">
            <div>
              <span class="component-badge component-badge--sm ${getPlanBadgeClass(lead.matchedUser.subscriptionTier)}" data-ref="lead-plan-${lead.id}">${escapeHtml(getPlanLabel(lead.matchedUser.subscriptionTier))}</span>
            </div>
            <span class="component-table__user-email" data-ref="lead-account-meta-${lead.id}">${escapeHtml(lead.matchedUser.username)} · ${escapeHtml(formatBytes(lead.matchedUser.storageLimitBytes))}</span>
          </div>
        `
        : `<span class="component-badge component-badge--sm component-badge--neutral" data-ref="lead-no-account-${lead.id}">${escapeHtml(i18n.t('admin.sales.account_not_registered'))}</span>`;

      row.innerHTML = `
        <td class="component-table__cell component-table__cell--pl20" data-ref="cell-contact-${lead.id}">
          <div class="component-table__user" data-ref="lead-contact-box-${lead.id}">
            <img class="component-table__user-avatar" data-ref="lead-avatar-${lead.id}" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(fullName)}" loading="lazy" />
            <div class="component-table__user-meta">
              <span class="component-table__user-name" data-ref="lead-name-${lead.id}">${escapeHtml(fullName)}</span>
              <span class="component-table__user-email" data-ref="lead-email-${lead.id}">${escapeHtml(lead.workEmail)}</span>
            </div>
          </div>
        </td>
        <td class="component-table__cell" data-ref="cell-company-${lead.id}">
          <div class="component-table__user-meta">
            <span class="component-table__user-name" data-ref="lead-company-name-${lead.id}">${escapeHtml(lead.companyName)}</span>
            <span class="component-table__user-email" data-ref="lead-company-size-${lead.id}">${escapeHtml(sizeText)}</span>
          </div>
        </td>
        <td class="component-table__cell" data-ref="cell-account-${lead.id}">
          ${accountCellHtml}
        </td>
        <td class="component-table__cell" data-ref="cell-status-${lead.id}">
          <span class="component-badge component-badge--sm ${statusInfo.badgeClass}" data-ref="lead-status-${lead.id}">${escapeHtml(statusInfo.label)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-location-${lead.id}">
          <div class="component-table__user-meta">
            <span class="component-table__user-name" data-ref="lead-country-${lead.id}">${escapeHtml(lead.country)}</span>
            <span class="component-table__user-email" data-ref="lead-role-${lead.id}">${escapeHtml(roleText)}</span>
          </div>
        </td>
        <td class="component-table__cell" data-ref="cell-contracts-${lead.id}">
          <span class="component-badge component-badge--sm component-badge--neutral" data-ref="lead-contracts-${lead.id}">${escapeHtml(i18n.t('admin.sales.contracts_count', { count: formatNumber(lead.contractsCount) }))}</span>
        </td>
        <td class="component-table__cell component-table__cell--pr20" data-ref="cell-date-${lead.id}">
          <span class="component-badge component-badge--sm component-badge--neutral" data-ref="lead-date-${lead.id}" data-tooltip="${escapeHtml(formatDateTime(lead.createdAt))}">${escapeHtml(formatDate(lead.createdAt))}</span>
        </td>
      `;

      row.addEventListener('click', () => {
        selectedLeadId = selectedLeadId === lead.id ? null : lead.id;
        updateSelectionUI();
        renderRows(currentlyDisplayedLeads, isSearchResult);
      });

      row.addEventListener('dblclick', () => {
        void openLeadDetailDialog(lead.id);
      });

      tbody.appendChild(row);
    });

    renderIcons(tbody);
  };

  const hideSearchToolbar = () => {
    if (!searchToolbar) return;
    searchToolbar.classList.add('is-hidden');
    if (searchInput && searchInput.value) {
      searchInput.value = '';
      btnClearSearch?.classList.add('is-hidden');
      renderRows(allLeads);
    }
  };

  btnToggleSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!searchToolbar) return;
    const isClosed = searchToolbar.classList.contains('is-hidden');
    searchToolbar.classList.toggle('is-hidden', !isClosed);
    if (isClosed && searchInput) {
      setTimeout(() => searchInput.focus(), 50);
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (document.querySelector('[data-ref="dialog-backdrop"]')) {
        return;
      }
      if (selectedLeadId !== null) {
        selectedLeadId = null;
        updateSelectionUI();
        renderRows(currentlyDisplayedLeads, Boolean(searchInput?.value.trim()));
      } else if (searchToolbar && !searchToolbar.classList.contains('is-hidden')) {
        hideSearchToolbar();
      }
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  btnClearSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    if (searchInput) {
      searchInput.value = '';
      btnClearSearch.classList.add('is-hidden');
      renderRows(allLeads);
      searchInput.focus();
    }
  });

  btnClearSelection?.addEventListener('click', (e) => {
    e.preventDefault();
    selectedLeadId = null;
    updateSelectionUI();
    renderRows(currentlyDisplayedLeads, Boolean(searchInput?.value.trim()));
  });

  btnCopyEmail?.addEventListener('click', (e) => {
    e.preventDefault();
    const lead = getSelectedLead();
    if (lead?.workEmail) {
      void copyToClipboard(lead.workEmail);
    }
  });

  btnViewDetail?.addEventListener('click', (e) => {
    e.preventDefault();
    const lead = getSelectedLead();
    if (lead) {
      void openLeadDetailDialog(lead.id);
    }
  });

  btnAssignEnterprise?.addEventListener('click', (e) => {
    e.preventDefault();
    const lead = getSelectedLead();
    if (lead) {
      openProvisionDialog(lead);
    }
  });

  btnOpenDirectProvision?.addEventListener('click', (e) => {
    e.preventDefault();
    openProvisionDialog();
  });

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value;
    if (btnClearSearch) {
      btnClearSearch.classList.toggle('is-hidden', query.trim().length === 0);
    }
    const filtered = filterLeads(query);
    renderRows(filtered, query.trim().length > 0);
  });

  const loadLeads = async (showErrorToast = false): Promise<boolean> => {
    if (btnRefresh) {
      btnRefresh.disabled = true;
      btnRefresh.classList.add('is-loading');
    }

    try {
      const res = await getApi<LeadsApiResponse>(`/api/admin/apps/${encodeURIComponent(app.slug)}/sales/leads`);
      if (isDisposed) {
        return true;
      }

      if (!res.ok) {
        if (res.code === 'PAGE_ACCESS_DENIED') {
          await onAccessDenied();
          return false;
        }
        if (showErrorToast) {
          toast.error(i18n.t('admin.sales.load_error'));
        }
        allLeads = [];
        renderRows([]);
        return true;
      }

      canManage = Boolean(res.canManage);
      allLeads = Array.isArray(res.leads) ? res.leads : [];
      updateSelectionUI();
      const activeQuery = searchInput?.value || '';
      const hasQuery = activeQuery.trim().length > 0;
      renderRows(hasQuery ? filterLeads(activeQuery) : allLeads, hasQuery);
      return true;
    } catch {
      if (!isDisposed) {
        if (showErrorToast) {
          toast.error(i18n.t('admin.sales.load_error'));
        }
        allLeads = [];
        renderRows([]);
      }
      return true;
    } finally {
      if (!isDisposed && btnRefresh) {
        btnRefresh.disabled = false;
        btnRefresh.classList.remove('is-loading');
      }
    }
  };

  btnRefresh?.addEventListener('click', (e) => {
    e.preventDefault();
    void loadLeads(true);
  });

  container.cleanup = () => {
    isDisposed = true;
    document.removeEventListener('keydown', handleKeyDown);
  };

  renderIcons(container);
  const canRender = await loadLeads(true);
  if (!canRender || isDisposed) {
    container.cleanup?.();
    return null;
  }

  return container;
}

export {
  createAppSalesView
};
