import type { AccessibleAdminApp, AdminViewElement, AppAdminUserItem } from '../types/admin.types.js';
import { copyToClipboard, escapeHtml, removeEmptyState, renderEmptyState } from '../utils/dom.util.js';
import { formatBytes, formatDate, formatDateTime, formatNumber } from '../utils/format.util.js';
import { getApi } from '../services/api.service.js';
import { getRoleLabel } from '../components/layout-user-menu.component.js';
import { getUserAvatarUrl, normalizeSubscriptionTier } from '../utils/avatar.util.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { toast } from '../services/toast.service.js';

interface UsersApiResponse {
  app?: AccessibleAdminApp;
  code?: string;
  error?: string;
  ok?: boolean;
  users?: AppAdminUserItem[];
}

function getPlanLabel(tier: string): string {
  const normalized = (tier || 'free').toLowerCase();
  const key = `admin.users.plan_${normalized}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : normalized.toUpperCase();
}

function getStatusLabel(status: string): string {
  const normalized = (status || 'active').toLowerCase();
  if (normalized === 'suspended') {
    return i18n.t('admin.users.status_suspended');
  }
  if (normalized === 'deleted') {
    return i18n.t('admin.users.status_deleted');
  }
  return i18n.t('admin.users.status_active');
}

async function createAppUsersView(
  app: AccessibleAdminApp,
  onAccessDenied: () => Promise<void>
): Promise<AdminViewElement | null> {
  const container = document.createElement('div') as AdminViewElement;
  container.className = 'component-layout--split-full';
  container.setAttribute('data-ref', 'app-users-layout');

  container.innerHTML = `
    <div class="component-top" data-ref="users-top">
      <div class="component-top__left" data-ref="users-top-left">
        <div class="component-top__title-box" data-ref="users-title-heading">
          <span class="component-top__title-text" data-ref="users-title">${escapeHtml(i18n.t('admin.users.title'))}</span>
          <span class="component-badge component-badge--sm is-hidden" data-ref="users-total-badge"></span>
          <span class="component-badge component-badge--sm is-hidden" data-ref="users-selected-badge"></span>
        </div>
      </div>
      <div class="component-top__right" data-ref="users-header-actions">
        <div class="component-group component-group--actions is-hidden" data-ref="users-selection-actions">
          <button type="button" class="component-button component-button--h40 component-button--black component-button--icon-only" data-ref="btn-copy-user-email" data-tooltip="${escapeHtml(i18n.t('admin.users.copy_email'))}" aria-label="${escapeHtml(i18n.t('admin.users.copy_email'))}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#mail"></use></svg>
          </button>
          <button type="button" class="component-button component-button--h40 component-button--secondary component-button--icon-only" data-ref="btn-copy-user-id" data-tooltip="${escapeHtml(i18n.t('admin.users.copy_id'))}" aria-label="${escapeHtml(i18n.t('admin.users.copy_id'))}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
          </button>
        </div>
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-refresh-users" data-tooltip="${escapeHtml(i18n.t('common.refresh'))}" aria-label="${escapeHtml(i18n.t('common.refresh'))}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg>
        </button>
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-toggle-users-search" data-tooltip="${escapeHtml(i18n.t('common.search'))}" aria-label="${escapeHtml(i18n.t('common.search'))}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--full" data-ref="users-bottom">
      <div class="component-floating-search is-hidden" data-ref="users-search-toolbar">
        <div class="component-floating-search__inner" data-ref="users-search-inner">
          <div class="component-search component-search--floating" data-ref="users-search-box">
            <div class="component-search__icon" data-ref="users-search-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
            </div>
            <div class="component-search__input-box" data-ref="users-search-input-box">
              <input class="component-search__input" data-ref="users-search-input" type="text" placeholder="${escapeHtml(i18n.t('admin.users.search_placeholder'))}" maxlength="100" autocomplete="off" />
            </div>
            <button type="button" class="component-button component-button--h34 component-button--icon-only is-hidden" data-ref="btn-clear-users-search" aria-label="${escapeHtml(i18n.t('common.clear_search'))}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
        </div>
      </div>

      <div class="component-table-wrapper component-table-wrapper--flush" data-ref="users-table-wrapper">
        <table class="component-table component-table--flush" data-ref="users-table">
          <thead class="component-table__head" data-ref="users-thead">
            <tr>
              <th data-ref="th-user">${escapeHtml(i18n.t('admin.users.col_user'))}</th>
              <th data-ref="th-role">${escapeHtml(i18n.t('admin.users.col_role'))}</th>
              <th data-ref="th-plan">${escapeHtml(i18n.t('admin.users.col_plan'))}</th>
              <th data-ref="th-status">${escapeHtml(i18n.t('admin.users.col_status'))}</th>
              <th data-ref="th-activity">${escapeHtml(i18n.t('admin.users.col_activity'))}</th>
              <th data-ref="th-storage">${escapeHtml(i18n.t('admin.users.col_storage'))}</th>
              <th data-ref="th-joined">${escapeHtml(i18n.t('admin.users.col_joined'))}</th>
            </tr>
          </thead>
          <tbody class="component-table__body" data-ref="users-tbody">
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = container.querySelector<HTMLElement>('[data-ref="users-tbody"]');
  const tableEl = container.querySelector<HTMLElement>('[data-ref="users-table"]');
  const tableWrapper = container.querySelector<HTMLElement>('[data-ref="users-table-wrapper"]');
  const searchInput = container.querySelector<HTMLInputElement>('[data-ref="users-search-input"]');
  const btnClearSearch = container.querySelector<HTMLElement>('[data-ref="btn-clear-users-search"]');
  const btnToggleSearch = container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-users-search"]');
  const btnRefresh = container.querySelector<HTMLButtonElement>('[data-ref="btn-refresh-users"]');
  const searchToolbar = container.querySelector<HTMLElement>('[data-ref="users-search-toolbar"]');
  const totalBadge = container.querySelector<HTMLElement>('[data-ref="users-total-badge"]');
  const selectedBadge = container.querySelector<HTMLElement>('[data-ref="users-selected-badge"]');
  const selectionActions = container.querySelector<HTMLElement>('[data-ref="users-selection-actions"]');
  const btnCopyEmail = container.querySelector<HTMLButtonElement>('[data-ref="btn-copy-user-email"]');
  const btnCopyId = container.querySelector<HTMLButtonElement>('[data-ref="btn-copy-user-id"]');

  let allUsers: AppAdminUserItem[] = [];
  let currentlyDisplayedUsers: AppAdminUserItem[] = [];
  let selectedUserId: number | null = null;
  let isDisposed = false;

  const updateTotalBadge = (count: number) => {
    if (!totalBadge) return;
    if (allUsers.length === 0) {
      totalBadge.classList.add('is-hidden');
      return;
    }
    totalBadge.textContent = count === 1
      ? i18n.t('admin.users.total_count_one')
      : i18n.t('admin.users.total_count', { count: formatNumber(count) });
    totalBadge.classList.remove('is-hidden');
  };

  const updateSelectionUI = () => {
    if (selectedUserId !== null) {
      if (selectedBadge) {
        selectedBadge.textContent = i18n.t('admin.users.selected_count', { count: 1 });
        selectedBadge.classList.remove('is-hidden');
      }
      selectionActions?.classList.remove('is-hidden');
      btnToggleSearch?.classList.add('is-hidden');
      btnRefresh?.classList.add('is-hidden');
    } else {
      selectedBadge?.classList.add('is-hidden');
      selectionActions?.classList.add('is-hidden');
      btnToggleSearch?.classList.remove('is-hidden');
      btnRefresh?.classList.remove('is-hidden');
    }
    renderIcons(container);
  };

  const filterUsers = (queryRaw: string): AppAdminUserItem[] => {
    const query = queryRaw.trim().toLowerCase();
    if (!query) {
      return allUsers;
    }
    return allUsers.filter((u) => {
      const roleLabel = getRoleLabel(u.roleSlug, u.roleName).toLowerCase();
      const planLabel = getPlanLabel(u.subscriptionTier).toLowerCase();
      const statusLabel = getStatusLabel(u.status).toLowerCase();
      return (
        u.username.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.roleSlug.toLowerCase().includes(query) ||
        roleLabel.includes(query) ||
        u.subscriptionTier.toLowerCase().includes(query) ||
        planLabel.includes(query) ||
        u.status.toLowerCase().includes(query) ||
        statusLabel.includes(query) ||
        String(u.id).includes(query)
      );
    });
  };

  const renderRows = (users: AppAdminUserItem[], isSearchResult = false) => {
    currentlyDisplayedUsers = users;
    updateTotalBadge(users.length);
    if (!tbody) return;

    if (users.length === 0) {
      tableEl?.classList.add('is-hidden');
      if (tableWrapper) {
        renderEmptyState({
          container: tableWrapper,
          dataRef: 'users-empty-state',
          desc: isSearchResult
            ? i18n.t('admin.users.search_no_results')
            : i18n.t('admin.users.empty_desc'),
          graphicType: isSearchResult ? 'search' : 'users',
          isTable: true,
          title: isSearchResult
            ? i18n.t('common.search')
            : i18n.t('admin.users.empty_title'),
        });
      }
      selectedUserId = null;
      updateSelectionUI();
      return;
    }

    tableEl?.classList.remove('is-hidden');
    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'users-empty-state');
    }

    if (selectedUserId !== null && !users.some((u) => u.id === selectedUserId)) {
      selectedUserId = null;
      updateSelectionUI();
    }

    tbody.innerHTML = '';
    users.forEach((u) => {
      const isSelected = selectedUserId === u.id;
      const row = document.createElement('tr');
      row.className = `component-table__row component-cursor-pointer${isSelected ? ' is-selected' : ''}`;
      row.setAttribute('data-ref', `user-row-${u.id}`);

      const avatarSrc = getUserAvatarUrl(
        { avatar_url: u.avatarUrl, email: u.email, id: u.id, username: u.username },
        64
      );
      const roleLabel = getRoleLabel(u.roleSlug, u.roleName);
      const planLabel = getPlanLabel(u.subscriptionTier);
      const statusLabel = getStatusLabel(u.status);
      const tier = normalizeSubscriptionTier(u.subscriptionTier);
      const activityText = i18n.t('admin.users.activity_summary', {
        files: formatNumber(u.filesCount),
        rooms: formatNumber(u.roomsCount),
      });
      const storageText = formatBytes(u.storageUsedBytes);
      const joinedFormatted = formatDate(u.joinedAt || u.createdAt);
      const lastLoginTooltip = u.lastLoginAt
        ? i18n.t('admin.users.last_login_tooltip', { date: formatDateTime(u.lastLoginAt) })
        : i18n.t('admin.users.last_login_none');

      row.innerHTML = `
        <td class="component-table__cell" data-ref="cell-user-${u.id}">
          <div class="component-table__user" data-ref="user-cell-box-${u.id}">
            <div class="component-avatar component-avatar--sm" data-ref="user-avatar-${u.id}" data-tier="${tier}">
              <img class="component-avatar__img" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(u.username)}" referrerpolicy="no-referrer" loading="lazy" />
            </div>
            <div class="component-table__user-meta">
              <span class="component-badge component-badge--sm" data-ref="text-username-${u.id}">${escapeHtml(u.username)}</span>
              <span class="component-badge component-badge--sm" data-ref="text-email-${u.id}">${escapeHtml(u.email)}</span>
            </div>
          </div>
        </td>
        <td class="component-table__cell" data-ref="cell-role-${u.id}">
          <span class="component-badge component-badge--sm" data-ref="text-role-${u.id}">${escapeHtml(roleLabel)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-plan-${u.id}">
          <span class="component-badge component-badge--sm" data-ref="text-plan-${u.id}">${escapeHtml(planLabel)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-status-${u.id}">
          <span class="component-badge component-badge--sm" data-ref="text-status-${u.id}">${escapeHtml(statusLabel)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-activity-${u.id}">
          <span class="component-badge component-badge--sm" data-ref="text-activity-${u.id}">${escapeHtml(activityText)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-storage-${u.id}">
          <span class="component-badge component-badge--sm" data-ref="text-storage-${u.id}">${escapeHtml(storageText)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-joined-${u.id}">
          <span class="component-badge component-badge--sm" data-ref="text-joined-${u.id}" data-tooltip="${escapeHtml(lastLoginTooltip)}">${escapeHtml(joinedFormatted)}</span>
        </td>
      `;

      row.addEventListener('click', () => {
        selectedUserId = selectedUserId === u.id ? null : u.id;
        updateSelectionUI();
        renderRows(currentlyDisplayedUsers, isSearchResult);
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
      renderRows(allUsers);
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
      if (selectedUserId !== null) {
        selectedUserId = null;
        updateSelectionUI();
        renderRows(currentlyDisplayedUsers, Boolean(searchInput?.value.trim()));
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
      renderRows(allUsers);
      searchInput.focus();
    }
  });

  btnCopyEmail?.addEventListener('click', (e) => {
    e.preventDefault();
    if (selectedUserId === null) return;
    const user = allUsers.find((u) => u.id === selectedUserId);
    if (user?.email) {
      void copyToClipboard(user.email);
    }
  });

  btnCopyId?.addEventListener('click', (e) => {
    e.preventDefault();
    if (selectedUserId === null) return;
    const user = allUsers.find((u) => u.id === selectedUserId);
    if (user) {
      void copyToClipboard(user.uuid || String(user.id));
    }
  });

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value;
    if (btnClearSearch) {
      btnClearSearch.classList.toggle('is-hidden', query.trim().length === 0);
    }
    const filtered = filterUsers(query);
    renderRows(filtered, query.trim().length > 0);
  });

  const loadUsers = async (showErrorToast = false): Promise<boolean> => {
    if (btnRefresh) {
      btnRefresh.disabled = true;
      btnRefresh.classList.add('is-loading');
    }

    try {
      const res = await getApi<UsersApiResponse>(`/api/admin/apps/${encodeURIComponent(app.slug)}/users`);
      if (isDisposed) {
        return true;
      }

      if (!res.ok) {
        if (res.code === 'PAGE_ACCESS_DENIED') {
          await onAccessDenied();
          return false;
        }
        if (showErrorToast) {
          toast.error(i18n.t('admin.users.load_error'));
        }
        allUsers = [];
        renderRows([]);
        return true;
      }

      allUsers = Array.isArray(res.users) ? res.users : [];
      const activeQuery = searchInput?.value || '';
      const hasQuery = activeQuery.trim().length > 0;
      renderRows(hasQuery ? filterUsers(activeQuery) : allUsers, hasQuery);
      return true;
    } catch {
      if (!isDisposed) {
        if (showErrorToast) {
          toast.error(i18n.t('admin.users.load_error'));
        }
        allUsers = [];
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
    void loadUsers(true);
  });

  container.cleanup = () => {
    isDisposed = true;
    document.removeEventListener('keydown', handleKeyDown);
  };

  renderIcons(container);
  const canRender = await loadUsers(true);
  if (!canRender || isDisposed) {
    container.cleanup?.();
    return null;
  }

  return container;
}

export {
  createAppUsersView
};
