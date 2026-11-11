import { openModal } from '../../components/modal.component.js';
import { openInviteTeamMemberModal } from '../../components/team-invite-modal.component.js';
import { checkAuthSession, currentUser, escapeHtml, getActiveWorkspaceTeam, getCurrentTeamApi, removeTeamMemberApi, revokeTeamInvitationApi, updateTeamMemberRoleApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { onWorkspaceChange, setActiveTeamId } from '../../services/workspace.service.js';
import { ViewController } from '../../types/common.types.js';
import { TeamDetailResponse, TeamInvitationRecord, TeamMemberRecord, TeamRole } from '../../types/team.types.js';
import { getUserAvatarUrl } from '../../utils/avatar.util.js';
import { removeEmptyState, renderEmptyState, setupDropdown } from '../../utils/dom.util.js';
import { normalizeTier } from '../../utils/tier.util.js';

interface DirectoryEntry {
  dateIso: string;
  email: string;
  invitation?: TeamInvitationRecord;
  key: string;
  kind: 'invitation' | 'member';
  member?: TeamMemberRecord;
  name: string;
  role: TeamRole;
  status: 'active' | 'pending';
}

class TeamMembersController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentDetail: TeamDetailResponse | null = null;
  private entries: DirectoryEntry[] = [];
  private isDestroyed = false;
  private searchQuery = '';
  private selectedKey: string | null = null;
  private unsubWorkspace: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.bindEvents();
    this.ensureDefaultTeamSelection();
    this.unsubWorkspace = onWorkspaceChange(() => {
      if (!this.isDestroyed) {
        this.selectedKey = null;
        void this.loadMembersData();
      }
    });
    await this.loadMembersData();
  }

  destroy(): void {
    this.isDestroyed = true;
    this.abortController?.abort();
    this.abortController = null;
    if (this.unsubWorkspace) {
      this.unsubWorkspace();
      this.unsubWorkspace = null;
    }
  }

  private ensureDefaultTeamSelection(): void {
    if (getActiveWorkspaceTeam()) return;
    const teams = Array.isArray(currentUser?.teams) ? currentUser.teams : [];
    if (teams.length === 0) return;

    const requestedId = Number(new URLSearchParams(window.location.search).get('teamId') || 0);
    const preferred = teams.find((team) => Number(team.id) === requestedId) || teams[0];
    if (preferred) {
      setActiveTeamId(preferred.id);
    }
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;
    if (!signal) return;

    const btnInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-members-invite"]');
    const btnManageRole = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-manage-role"]');
    const btnRemoveMember = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-remove-member"]');
    const btnCopyInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-copy-invite"]');
    const btnRevokeInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-revoke-invite"]');
    const btnToggleSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-search"]');
    const searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="team-members-search-toolbar"]');
    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="team-members-search-input"]');
    const btnClearSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-search"]');
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="team-members-tbody"]');

    btnInvite?.addEventListener(
      'click',
      () => {
        if (!this.resolvePermissions().includes('team:members:invite')) return;
        openInviteTeamMemberModal({
          onInvited: async () => {
            await this.loadMembersData();
          },
        });
      },
      { signal }
    );

    btnManageRole?.addEventListener(
      'click',
      () => {
        const entry = this.getSelectedEntry();
        if (entry?.member && this.canManageMemberRole(entry.member)) {
          this.openManageMemberRoleModal(entry.member);
        }
      },
      { signal }
    );

    btnRemoveMember?.addEventListener(
      'click',
      () => {
        const entry = this.getSelectedEntry();
        if (entry?.member && this.canSelectEntry(entry)) {
          this.handleRemoveMemberPrompt(entry.member);
        }
      },
      { signal }
    );

    btnCopyInvite?.addEventListener(
      'click',
      () => {
        const entry = this.getSelectedEntry();
        if (entry?.invitation && this.canSelectEntry(entry)) {
          const inviteUrl = `${window.location.origin}/teams/invite?token=${encodeURIComponent(entry.invitation.token)}`;
          void this.copyText(inviteUrl, t('settings.team.toast_invite_link_copied'));
        }
      },
      { signal }
    );

    btnRevokeInvite?.addEventListener(
      'click',
      () => {
        const entry = this.getSelectedEntry();
        if (entry?.invitation && this.canSelectEntry(entry)) {
          this.handleRevokeInvitePrompt(entry.invitation);
        }
      },
      { signal }
    );

    btnToggleSearch?.addEventListener(
      'click',
      () => {
        if (!searchToolbar) return;
        const willOpen = searchToolbar.classList.contains('is-hidden');
        searchToolbar.classList.toggle('is-hidden', !willOpen);
        btnToggleSearch.classList.toggle('is-active', willOpen);
        if (willOpen) {
          searchInput?.focus();
        } else {
          this.clearSearchFilter();
        }
      },
      { signal }
    );

    searchInput?.addEventListener(
      'input',
      () => {
        this.searchQuery = searchInput.value.trim();
        btnClearSearch?.classList.toggle('is-hidden', this.searchQuery.length === 0);
        this.renderTable();
      },
      { signal }
    );

    btnClearSearch?.addEventListener(
      'click',
      () => {
        this.clearSearchFilter();
        searchInput?.focus();
      },
      { signal }
    );

    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Escape' && searchToolbar && !searchToolbar.classList.contains('is-hidden')) {
          searchToolbar.classList.add('is-hidden');
          btnToggleSearch?.classList.remove('is-active');
          this.clearSearchFilter();
        }
      },
      { signal }
    );

    tbody?.addEventListener(
      'click',
      (e) => {
        const row = (e.target as HTMLElement | null)?.closest<HTMLTableRowElement>('tr[data-entry-key]');
        if (!row) return;
        const key = row.getAttribute('data-entry-key');
        if (!key) return;
        const entry = this.entries.find((item) => item.key === key);
        if (!entry || !this.canSelectEntry(entry)) return;
        this.selectedKey = this.selectedKey === key ? null : key;
        this.syncSelectedRowsDom();
        this.updateHeaderActions();
      },
      { signal }
    );
  }

  private resolvePermissions(): string[] {
    if (Array.isArray(this.currentDetail?.permissions) && this.currentDetail.permissions.length > 0) {
      return this.currentDetail.permissions;
    }
    return getActiveWorkspaceTeam()?.permissions || [];
  }

  private canManageMemberRole(member: TeamMemberRecord): boolean {
    if (!this.currentDetail) return false;
    const perms = this.resolvePermissions();
    const actingUserId = Number(currentUser?.id || 0);
    const ownerId = Number(this.currentDetail.team.owner_id || 0);
    const isTeamOwner = actingUserId > 0 && actingUserId === ownerId;
    const isSelf = Number(member.user_id) === actingUserId;
    const isTargetOwner = ownerId > 0 && Number(member.user_id) === ownerId;
    return (
      perms.includes('team:members:manage') &&
      isTeamOwner &&
      !isSelf &&
      !isTargetOwner &&
      member.role !== 'owner'
    );
  }

  private canSelectEntry(entry: DirectoryEntry): boolean {
    if (!this.currentDetail) return false;
    const perms = this.resolvePermissions();
    const canManageMembers = perms.includes('team:members:manage');
    const canInvite = perms.includes('team:members:invite');
    const actingUserId = Number(currentUser?.id || 0);
    const ownerId = Number(this.currentDetail.team.owner_id || 0);
    const isTeamOwner = actingUserId > 0 && actingUserId === ownerId;

    if (entry.kind === 'member' && entry.member) {
      const isSelf = Number(entry.member.user_id) === actingUserId;
      const isTargetOwner = ownerId > 0 && Number(entry.member.user_id) === ownerId;
      if (!canManageMembers || isSelf || isTargetOwner || entry.member.role === 'owner') return false;
      if (!isTeamOwner && entry.member.role === 'admin') return false;
      return true;
    }

    if (entry.kind === 'invitation' && entry.invitation) {
      if (!canInvite && !canManageMembers) return false;
      if (!isTeamOwner && entry.invitation.role === 'admin') return false;
      return true;
    }

    return false;
  }

  private clearSearchFilter(): void {
    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="team-members-search-input"]');
    const btnClearSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-search"]');
    this.searchQuery = '';
    if (searchInput) searchInput.value = '';
    btnClearSearch?.classList.add('is-hidden');
    this.renderTable();
  }

  private async loadMembersData(): Promise<void> {
    const summaryBadge = this.container.querySelector<HTMLElement>('[data-ref="team-members-summary-badge"]');
    const btnInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-members-invite"]');

    const activeWorkspace = getActiveWorkspaceTeam();
    if (!activeWorkspace) {
      this.currentDetail = null;
      this.entries = [];
      this.selectedKey = null;
      summaryBadge?.classList.add('is-hidden');
      btnInvite?.classList.add('is-hidden');
      this.renderNoTeamState();
      this.updateHeaderActions();
      return;
    }

    const res = await getCurrentTeamApi();
    if (this.isDestroyed) return;

    if (!res.success || !res.team) {
      this.currentDetail = null;
      this.entries = [];
      this.selectedKey = null;
      summaryBadge?.classList.add('is-hidden');
      btnInvite?.classList.add('is-hidden');
      this.renderNoTeamState();
      this.updateHeaderActions();
      return;
    }

    this.currentDetail = res;
    this.entries = this.buildDirectoryEntries(res);

    if (this.selectedKey) {
      const stillValid = this.entries.find((entry) => entry.key === this.selectedKey);
      if (!stillValid || !this.canSelectEntry(stillValid)) {
        this.selectedKey = null;
      }
    }

    if (summaryBadge) {
      summaryBadge.textContent = t('settings.team.members_summary_count', {
        members: res.members.length,
        pending: res.invitations.length,
      });
      summaryBadge.classList.remove('is-hidden');
    }

    const canInvite = this.resolvePermissions().includes('team:members:invite');
    btnInvite?.classList.toggle('is-hidden', !canInvite);
    this.renderTable();
    this.updateHeaderActions();
  }

  private buildDirectoryEntries(detail: TeamDetailResponse): DirectoryEntry[] {
    const memberEntries: DirectoryEntry[] = detail.members.map((member) => ({
      dateIso: member.joined_at,
      email: member.email,
      key: `member-${member.user_id}`,
      kind: 'member',
      member,
      name: member.username || member.email,
      role: member.role,
      status: 'active',
    }));

    const invitationEntries: DirectoryEntry[] = detail.invitations.map((invitation) => ({
      dateIso: invitation.created_at,
      email: invitation.email,
      invitation,
      key: `invitation-${invitation.id}`,
      kind: 'invitation',
      name: invitation.email,
      role: invitation.role,
      status: 'pending',
    }));

    return [...memberEntries, ...invitationEntries];
  }

  private getFilteredEntries(): DirectoryEntry[] {
    const query = this.searchQuery.toLowerCase();
    if (!query) return this.entries;

    return this.entries.filter((entry) => {
      const roleLabel = this.resolveRoleLabel(entry.role).toLowerCase();
      const statusLabel = this.resolveStatusLabel(entry.status).toLowerCase();
      return (
        entry.name.toLowerCase().includes(query) ||
        entry.email.toLowerCase().includes(query) ||
        roleLabel.includes(query) ||
        statusLabel.includes(query)
      );
    });
  }

  private getSelectedEntry(): DirectoryEntry | null {
    if (!this.selectedKey) return null;
    return this.entries.find((entry) => entry.key === this.selectedKey) || null;
  }

  private resolveRoleLabel(role: TeamRole | string): string {
    if (role === 'owner') return t('settings.team.invite_role_owner');
    if (role === 'admin') return t('settings.team.invite_role_admin');
    return t('settings.team.invite_role_member');
  }

  private resolveStatusLabel(status: 'active' | 'pending'): string {
    return status === 'active' ? t('settings.team.status_active') : t('settings.team.status_pending');
  }

  private formatDate(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  private renderNoTeamState(): void {
    const tableEl = this.container.querySelector<HTMLElement>('[data-ref="team-members-table"]');
    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="team-members-table-wrapper"]');
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="team-members-tbody"]');

    if (tbody) tbody.innerHTML = '';
    tableEl?.classList.add('is-hidden');
    if (tableWrapper) {
      renderEmptyState({
        container: tableWrapper,
        dataRef: 'team-members-empty-state',
        desc: t('settings.team.empty_desc'),
        graphicType: 'subscriptions',
        isTable: true,
        title: t('settings.team.empty_title'),
      });
    }
  }

  private renderTable(): void {
    const tableEl = this.container.querySelector<HTMLElement>('[data-ref="team-members-table"]');
    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="team-members-table-wrapper"]');
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="team-members-tbody"]');
    if (!tbody || !tableWrapper) return;

    const filtered = this.getFilteredEntries();
    if (filtered.length === 0) {
      tbody.innerHTML = '';
      tableEl?.classList.add('is-hidden');
      const isSearchEmpty = this.searchQuery.length > 0;
      renderEmptyState({
        container: tableWrapper,
        dataRef: 'team-members-empty-state',
        desc: isSearchEmpty ? t('settings.team.members_search_no_results') : t('settings.team.members_empty_desc'),
        graphicType: isSearchEmpty ? 'search' : 'subscriptions',
        isTable: true,
        title: t('settings.team.members_empty_title'),
      });
      if (this.selectedKey) {
        this.selectedKey = null;
        this.updateHeaderActions();
      }
      return;
    }

    removeEmptyState(tableWrapper, 'team-members-empty-state');
    tableEl?.classList.remove('is-hidden');

    tbody.innerHTML = filtered
      .map((entry) => {
        const selectable = this.canSelectEntry(entry);
        const isSelected = selectable && entry.key === this.selectedKey;
        const roleLabel = this.resolveRoleLabel(entry.role);
        const statusLabel = this.resolveStatusLabel(entry.status);
        const statusBadgeClass = entry.status === 'active' ? 'component-badge--success' : 'component-badge--warning';
        const formattedDate = this.formatDate(entry.dateIso);

        let leadingHtml = '';
        if (entry.kind === 'member' && entry.member) {
          const avatarUrl = getUserAvatarUrl(
            {
              avatar_url: entry.member.avatar_url,
              email: entry.member.email,
              user_id: entry.member.user_id,
              username: entry.member.username,
            },
            64
          );
          const tier = normalizeTier(entry.member.subscription_tier);
          leadingHtml = `
            <div class="team-table-member">
              <div class="table-user-avatar table-user-avatar--${escapeHtml(tier)}" data-tier="${escapeHtml(tier)}">
                <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(entry.name)}" />
              </div>
              <span class="team-table-member__name">${escapeHtml(entry.name)}</span>
            </div>
          `;
        } else {
          leadingHtml = `
            <div class="team-table-member">
              <div class="team-table-member__icon">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#mail"></use></svg>
              </div>
              <span class="team-table-member__name">${escapeHtml(t('settings.team.invite_pending_label'))}</span>
            </div>
          `;
        }

        const rowClass = `component-table__row${selectable ? ' component-cursor-pointer' : ''}${isSelected ? ' is-selected' : ''}`;
        return `
          <tr class="${rowClass}" data-entry-key="${escapeHtml(entry.key)}">
            <td class="component-table__cell component-table__cell--pl20">${leadingHtml}</td>
            <td class="component-table__cell">${escapeHtml(entry.email)}</td>
            <td class="component-table__cell">
              <span class="component-badge component-badge--sm component-badge--neutral">${escapeHtml(roleLabel)}</span>
            </td>
            <td class="component-table__cell">
              <span class="component-badge component-badge--sm ${statusBadgeClass}">${escapeHtml(statusLabel)}</span>
            </td>
            <td class="component-table__cell component-table__cell--pr20">${escapeHtml(formattedDate)}</td>
          </tr>
        `;
      })
      .join('');
  }

  private syncSelectedRowsDom(): void {
    const rows = this.container.querySelectorAll<HTMLTableRowElement>('tr[data-entry-key]');
    rows.forEach((row) => {
      const key = row.getAttribute('data-entry-key');
      row.classList.toggle('is-selected', Boolean(key && key === this.selectedKey));
    });
  }

  private updateHeaderActions(): void {
    const btnManageRole = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-manage-role"]');
    const btnRemoveMember = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-remove-member"]');
    const btnCopyInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-copy-invite"]');
    const btnRevokeInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-revoke-invite"]');

    btnManageRole?.classList.add('is-hidden');
    btnRemoveMember?.classList.add('is-hidden');
    btnCopyInvite?.classList.add('is-hidden');
    btnRevokeInvite?.classList.add('is-hidden');

    const entry = this.getSelectedEntry();
    if (!entry || !this.currentDetail || !this.canSelectEntry(entry)) return;

    const perms = this.resolvePermissions();
    const canManageMembers = perms.includes('team:members:manage');
    const canInvite = perms.includes('team:members:invite');

    if (entry.kind === 'member' && entry.member) {
      btnManageRole?.classList.toggle('is-hidden', !this.canManageMemberRole(entry.member));
      btnRemoveMember?.classList.remove('is-hidden');
      return;
    }

    if (entry.kind === 'invitation' && entry.invitation) {
      btnCopyInvite?.classList.remove('is-hidden');
      if (canInvite || canManageMembers) {
        btnRevokeInvite?.classList.remove('is-hidden');
      }
    }
  }

  private openManageMemberRoleModal(member: TeamMemberRecord): void {
    if (!this.canManageMemberRole(member)) return;
    let selectedRole: 'admin' | 'member' = member.role === 'admin' ? 'admin' : 'member';
    let dropdownCtrl: { destroy: () => void } | null = null;

    const roleDisplay = selectedRole === 'admin'
      ? t('settings.team.invite_role_admin')
      : t('settings.team.invite_role_member');
    const roleIcon = selectedRole === 'admin' ? 'verified_user' : 'person';
    const roleDesc = selectedRole === 'admin'
      ? t('settings.team.invite_role_admin_desc')
      : t('settings.team.invite_role_member_desc');

    const bodyHtml = `
      <div class="team-role-modal" data-ref="team-role-modal-body">
        <span class="team-invite-modal__label">${escapeHtml(t('settings.team.modal_manage_role_label'))}</span>
        <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-member-role">
          <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-member-role" aria-label="${escapeHtml(t('settings.team.modal_manage_role_label'))}">
            <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-member-role">
              <svg class="component-icon dropdown-trigger__icon" data-ref="icon-selected-member-role" aria-hidden="true"><use href="/icons.svg#${roleIcon}"></use></svg>
              <span class="dropdown-trigger__text" data-ref="txt-selected-member-role">${escapeHtml(roleDisplay)}</span>
            </div>
            <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>
          <div class="dropdown-backdrop" data-ref="dropdown-backdrop-member-role">
            <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-member-role">
              <div class="menu-panel__drag-zone" data-ref="drag-zone-member-role" aria-hidden="true">
                <div class="menu-panel__drag-handle"></div>
              </div>
              <div class="menu-panel__list menu-panel__list--scrollable" data-ref="member-roles-list">
                <button type="button" class="menu-item ${selectedRole === 'member' ? 'is-selected is-active' : ''}" data-ref="member-role-option-member" data-value="member">
                  <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
                  <span class="menu-item__text">${escapeHtml(t('settings.team.invite_role_member'))}</span>
                  <svg class="component-icon menu-item__check ${selectedRole === 'member' ? '' : 'is-hidden'}" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                </button>
                <button type="button" class="menu-item ${selectedRole === 'admin' ? 'is-selected is-active' : ''}" data-ref="member-role-option-admin" data-value="admin">
                  <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#verified_user"></use></svg>
                  <span class="menu-item__text">${escapeHtml(t('settings.team.invite_role_admin'))}</span>
                  <svg class="component-icon menu-item__check ${selectedRole === 'admin' ? '' : 'is-hidden'}" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <p class="team-seats-field__hint" data-ref="member-role-desc">${escapeHtml(roleDesc)}</p>
      </div>
    `;

    const modal = openModal({
      bodyHtml,
      cancelText: t('settings.team.btn_cancel'),
      confirmClass: 'component-button--black',
      confirmText: t('settings.team.modal_manage_role_submit'),
      description: t('settings.team.modal_manage_role_desc', {
        name: member.username || member.email,
      }),
      onClose: () => {
        dropdownCtrl?.destroy();
        dropdownCtrl = null;
      },
      onConfirm: async (inst) => {
        inst.clearError();
        if (selectedRole === member.role) {
          return true;
        }
        inst.setConfirmLoading(true);
        const res = await updateTeamMemberRoleApi(member.user_id, selectedRole);
        if (this.isDestroyed) return false;
        if (!res.success) {
          inst.setConfirmLoading(false);
          inst.showError(res.error || t('teams.errors.update_role'));
          return false;
        }
        await checkAuthSession();
        await this.loadMembersData();
        inst.close();
        showToast(t('settings.team.toast_role_updated'), 'success');
        return true;
      },
      showCancel: true,
      showConfirm: true,
      size: 'sm',
      title: t('settings.team.modal_manage_role_title'),
    });

    renderIcons(modal.body);
    const wrapper = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-member-role"]');
    const trigger = modal.body.querySelector<HTMLElement>('[data-ref="btn-trigger-member-role"]');
    const backdrop = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-member-role"]');
    const menu = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-menu-member-role"]');
    const roleDescEl = modal.body.querySelector<HTMLElement>('[data-ref="member-role-desc"]');

    if (wrapper) {
      dropdownCtrl = setupDropdown(wrapper, {
        backdrop,
        isSelect: true,
        menu,
        onSelect: (val, item) => {
          selectedRole = val === 'admin' ? 'admin' : 'member';
          if (roleDescEl) {
            roleDescEl.textContent = selectedRole === 'admin'
              ? t('settings.team.invite_role_admin_desc')
              : t('settings.team.invite_role_member_desc');
          }
          const items = modal.body.querySelectorAll<HTMLElement>('[data-ref="member-roles-list"] .menu-item');
          items.forEach((it) => {
            const isMatch = it === item;
            it.classList.toggle('is-selected', isMatch);
            it.querySelector<HTMLElement>('.menu-item__check')?.classList.toggle('is-hidden', !isMatch);
          });
        },
        placement: 'bottom-start',
        trigger,
      });
    }
  }

  private handleRemoveMemberPrompt(member: TeamMemberRecord): void {
    openModal({
      cancelText: t('settings.team.btn_cancel'),
      confirmClass: 'component-button--danger',
      confirmText: t('settings.team.btn_remove_member'),
      description: t('settings.team.modal_remove_member_desc', {
        name: member.username || member.email,
      }),
      onConfirm: async (inst) => {
        inst.setConfirmLoading(true);
        const res = await removeTeamMemberApi(member.user_id);
        if (!res.success) {
          inst.setConfirmLoading(false);
          inst.showError(res.error || t('teams.errors.remove_member'));
          return false;
        }
        this.selectedKey = null;
        await checkAuthSession();
        await this.loadMembersData();
        inst.close();
        showToast(t('settings.team.toast_member_removed'), 'success');
        return true;
      },
      showCancel: true,
      showConfirm: true,
      size: 'sm',
      title: t('settings.team.modal_remove_member_title'),
    });
  }

  private handleRevokeInvitePrompt(invitation: TeamInvitationRecord): void {
    openModal({
      cancelText: t('settings.team.btn_cancel'),
      confirmClass: 'component-button--danger',
      confirmText: t('settings.team.btn_revoke_invite'),
      description: t('settings.team.modal_revoke_invite_desc', {
        email: invitation.email,
      }),
      onConfirm: async (inst) => {
        inst.setConfirmLoading(true);
        const res = await revokeTeamInvitationApi(invitation.id);
        if (!res.success) {
          inst.setConfirmLoading(false);
          inst.showError(res.error || t('teams.errors.revoke_invite'));
          return false;
        }
        this.selectedKey = null;
        await checkAuthSession();
        await this.loadMembersData();
        inst.close();
        showToast(t('settings.team.toast_invite_revoked'), 'success');
        return true;
      },
      showCancel: true,
      showConfirm: true,
      size: 'sm',
      title: t('settings.team.modal_revoke_invite_title'),
    });
  }

  private async copyText(text: string, successMessage: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(text);
      showToast(successMessage, 'success');
    } catch {
      showToast(t('teams.errors.copy_failed'), 'error');
    }
  }
}

async function createTeamMembersView(): Promise<HTMLElement> {
  const element = await loadTemplate('/views/settings/team-members.html');
  const controller = new TeamMembersController(element);
  (element as { __controller?: ViewController } & HTMLElement).__controller = {
    destroy: () => controller.destroy(),
  };
  await controller.init();
  return element;
}

export { createTeamMembersView };
