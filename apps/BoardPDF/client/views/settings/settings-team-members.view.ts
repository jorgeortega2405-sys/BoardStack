import { navigate } from '../../app-router.js';
import { openModal } from '../../components/modal.component.js';
import { openInviteTeamMemberModal } from '../../components/team-invite-modal.component.js';
import { checkAuthSession, currentUser, escapeHtml, getActiveWorkspaceTeam, getCurrentTeamApi, hasTeamPermission, removeTeamMemberApi, revokeTeamInvitationApi, updateTeamMemberRoleApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { onWorkspaceChange } from '../../services/workspace.service.js';
import { ViewController } from '../../types/common.types.js';
import { TeamDetailResponse, TeamInvitationRecord, TeamMemberRecord, TeamRole } from '../../types/team.types.js';
import { getUserAvatarUrl } from '../../utils/avatar.util.js';
import { removeEmptyState, renderEmptyState } from '../../utils/dom.util.js';

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

  private bindEvents(): void {
    const signal = this.abortController?.signal;
    if (!signal) return;

    const btnBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-back-team"]');
    const btnInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-members-invite"]');
    const btnToggleRole = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-toggle-role"]');
    const btnRemoveMember = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-remove-member"]');
    const btnCopyInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-copy-invite"]');
    const btnRevokeInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-revoke-invite"]');
    const btnToggleSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-search"]');
    const searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="team-members-search-toolbar"]');
    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="team-members-search-input"]');
    const btnClearSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-search"]');
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="team-members-tbody"]');

    btnBack?.addEventListener(
      'click',
      () => {
        navigate('/settings/team');
      },
      { signal }
    );

    btnInvite?.addEventListener(
      'click',
      () => {
        openInviteTeamMemberModal({
          onInvited: async () => {
            await this.loadMembersData();
          },
        });
      },
      { signal }
    );

    btnToggleRole?.addEventListener(
      'click',
      () => {
        const entry = this.getSelectedEntry();
        if (entry?.member) {
          void this.handleToggleMemberRole(entry.member);
        }
      },
      { signal }
    );

    btnRemoveMember?.addEventListener(
      'click',
      () => {
        const entry = this.getSelectedEntry();
        if (entry?.member) {
          this.handleRemoveMemberPrompt(entry.member);
        }
      },
      { signal }
    );

    btnCopyInvite?.addEventListener(
      'click',
      () => {
        const entry = this.getSelectedEntry();
        if (entry?.invitation) {
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
        if (entry?.invitation) {
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
        this.selectedKey = this.selectedKey === key ? null : key;
        this.syncSelectedRowsDom();
        this.updateHeaderActions();
      },
      { signal }
    );
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

    if (this.selectedKey && !this.entries.some((entry) => entry.key === this.selectedKey)) {
      this.selectedKey = null;
    }

    if (summaryBadge) {
      summaryBadge.textContent = t('settings.team.members_summary_count', {
        members: res.members.length,
        pending: res.invitations.length,
      });
      summaryBadge.classList.remove('is-hidden');
    }

    btnInvite?.classList.toggle('is-hidden', !hasTeamPermission('team:members:invite'));
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
        title: isSearchEmpty ? t('settings.team.members_empty_title') : t('settings.team.members_empty_title'),
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
        const isSelected = entry.key === this.selectedKey;
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
          leadingHtml = `
            <div class="team-table-member">
              <img class="team-table-member__avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(entry.name)}" />
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

        return `
          <tr class="component-table__row component-cursor-pointer${isSelected ? ' is-selected' : ''}" data-entry-key="${escapeHtml(entry.key)}">
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
    const btnToggleRole = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-toggle-role"]');
    const btnToggleRoleText = this.container.querySelector<HTMLElement>('[data-ref="btn-row-toggle-role-text"]');
    const btnRemoveMember = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-remove-member"]');
    const btnCopyInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-copy-invite"]');
    const btnRevokeInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-revoke-invite"]');

    btnToggleRole?.classList.add('is-hidden');
    btnRemoveMember?.classList.add('is-hidden');
    btnCopyInvite?.classList.add('is-hidden');
    btnRevokeInvite?.classList.add('is-hidden');

    const entry = this.getSelectedEntry();
    if (!entry || !this.currentDetail) return;

    const canManageMembers = hasTeamPermission('team:members:manage');
    const canInvite = hasTeamPermission('team:members:invite');
    const actingUserId = Number(currentUser?.id || 0);

    if (entry.kind === 'member' && entry.member) {
      const isSelf = Number(entry.member.user_id) === actingUserId;
      const isOwner = entry.member.role === 'owner';
      if (canManageMembers && !isSelf && !isOwner) {
        if (btnToggleRole && btnToggleRoleText) {
          btnToggleRoleText.textContent =
            entry.member.role === 'admin' ? t('settings.team.btn_make_member') : t('settings.team.btn_make_admin');
          btnToggleRole.classList.remove('is-hidden');
        }
        btnRemoveMember?.classList.remove('is-hidden');
      }
      return;
    }

    if (entry.kind === 'invitation' && entry.invitation) {
      btnCopyInvite?.classList.remove('is-hidden');
      if (canInvite || canManageMembers) {
        btnRevokeInvite?.classList.remove('is-hidden');
      }
    }
  }

  private async handleToggleMemberRole(member: TeamMemberRecord): Promise<void> {
    const nextRole: 'admin' | 'member' = member.role === 'admin' ? 'member' : 'admin';
    const btnToggleRole = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-row-toggle-role"]');
    if (btnToggleRole) btnToggleRole.disabled = true;

    try {
      const res = await updateTeamMemberRoleApi(member.user_id, nextRole);
      if (this.isDestroyed) return;
      if (!res.success) {
        showToast(res.error || t('teams.errors.update_role'), 'error');
        return;
      }
      await checkAuthSession();
      await this.loadMembersData();
      showToast(t('settings.team.toast_role_updated'), 'success');
    } finally {
      if (btnToggleRole && !this.isDestroyed) btnToggleRole.disabled = false;
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
