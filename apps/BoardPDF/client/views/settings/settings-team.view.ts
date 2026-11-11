import { navigate } from '../../app-router.js';
import { openModal } from '../../components/modal.component.js';
import { openCreateTeamModal } from '../../components/team-create-modal.component.js';
import { openInviteTeamMemberModal } from '../../components/team-invite-modal.component.js';
import { openManageTeamSeatsModal } from '../../components/team-seats-modal.component.js';
import { checkAuthSession, getActiveWorkspaceTeam, getCurrentTeamApi, hasTeamPermission, leaveCurrentTeamApi, updateCurrentTeamApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { onWorkspaceChange, setActiveTeamId } from '../../services/workspace.service.js';
import { ViewController } from '../../types/common.types.js';
import { TeamDetailResponse, TeamRole } from '../../types/team.types.js';

class TeamSettingsController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentDetail: TeamDetailResponse | null = null;
  private isDestroyed = false;
  private unsubWorkspace: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.bindEvents();
    this.unsubWorkspace = onWorkspaceChange(() => {
      if (!this.isDestroyed) {
        void this.loadTeamData();
      }
    });
    await this.loadTeamData();
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

    const btnTopCreate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-create-team"]');
    const btnEmptyCreate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-empty-create-team"]');
    const btnOpenSeats = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-seats-modal"]');
    const btnViewMembers = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-view-members"]');
    const btnOpenInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-invite-modal"]');
    const btnEditName = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edit-team-name"]');
    const btnCancelName = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-team-name"]');
    const btnSaveName = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-save-team-name"]');
    const inputName = this.container.querySelector<HTMLInputElement>('[data-ref="input-team-name"]');
    const accordionHeaderSeats = this.container.querySelector<HTMLElement>('[data-ref="accordion-header-seats"]');
    const groupSeats = this.container.querySelector<HTMLElement>('[data-ref="group-team-seats"]');
    const btnLeaveTeam = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-leave-team"]');

    const openCreateModal = () => {
      openCreateTeamModal({
        onCreated: async () => {
          await this.loadTeamData();
        },
      });
    };

    btnTopCreate?.addEventListener('click', openCreateModal, { signal });
    btnEmptyCreate?.addEventListener('click', openCreateModal, { signal });

    btnOpenSeats?.addEventListener(
      'click',
      () => {
        if (!this.currentDetail) return;
        openManageTeamSeatsModal({
          detail: this.currentDetail,
          onUpdated: async () => {
            await this.loadTeamData();
          },
        });
      },
      { signal }
    );

    btnViewMembers?.addEventListener(
      'click',
      () => {
        navigate('/settings/team/members');
      },
      { signal }
    );

    btnOpenInvite?.addEventListener(
      'click',
      () => {
        openInviteTeamMemberModal({
          onInvited: async () => {
            await this.loadTeamData();
          },
        });
      },
      { signal }
    );

    accordionHeaderSeats?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        groupSeats?.classList.toggle('is-active');
      },
      { signal }
    );

    btnEditName?.addEventListener(
      'click',
      () => {
        this.toggleNameEditMode(true);
      },
      { signal }
    );

    btnCancelName?.addEventListener(
      'click',
      () => {
        this.toggleNameEditMode(false);
      },
      { signal }
    );

    btnSaveName?.addEventListener(
      'click',
      () => {
        void this.handleSaveTeamName();
      },
      { signal }
    );

    inputName?.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void this.handleSaveTeamName();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.toggleNameEditMode(false);
        }
      },
      { signal }
    );

    btnLeaveTeam?.addEventListener(
      'click',
      () => {
        this.handleLeaveTeamPrompt();
      },
      { signal }
    );
  }

  private resolveRoleLabel(role: TeamRole | string): string {
    if (role === 'owner') return t('settings.team.invite_role_owner');
    if (role === 'admin') return t('settings.team.invite_role_admin');
    return t('settings.team.invite_role_member');
  }

  private toggleNameEditMode(isEditing: boolean): void {
    const viewBox = this.container.querySelector<HTMLElement>('[data-ref="team-name-view-box"]');
    const editRow = this.container.querySelector<HTMLElement>('[data-ref="team-name-edit-row"]');
    const inputName = this.container.querySelector<HTMLInputElement>('[data-ref="input-team-name"]');

    viewBox?.classList.toggle('is-hidden', isEditing);
    editRow?.classList.toggle('is-hidden', !isEditing);

    if (isEditing && inputName) {
      inputName.value = this.currentDetail?.team.name || '';
      inputName.focus();
      inputName.select();
    }
  }

  private async loadTeamData(): Promise<void> {
    const activeWorkspace = getActiveWorkspaceTeam();
    if (!activeWorkspace) {
      this.currentDetail = null;
      this.renderEmptyStateView();
      return;
    }

    const res = await getCurrentTeamApi();
    if (this.isDestroyed) return;

    if (!res.success || !res.team) {
      this.currentDetail = null;
      this.renderEmptyStateView();
      return;
    }

    this.currentDetail = res;
    this.renderTeamDetails(res);
  }

  private renderEmptyStateView(): void {
    const displayTeamName = this.container.querySelector<HTMLElement>('[data-ref="display-team-name"]');
    const displayMyRole = this.container.querySelector<HTMLElement>('[data-ref="display-my-team-role"]');
    const btnEditName = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edit-team-name"]');
    const btnTopCreate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-create-team"]');
    const btnOpenSeats = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-seats-modal"]');
    const btnViewMembers = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-view-members"]');
    const btnOpenInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-invite-modal"]');
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="team-empty-state"]');
    const contentGroups = this.container.querySelector<HTMLElement>('[data-ref="team-content-groups"]');

    this.toggleNameEditMode(false);
    if (displayTeamName) {
      displayTeamName.setAttribute('data-i18n', 'settings.team.title');
      displayTeamName.textContent = t('settings.team.title');
    }
    if (displayMyRole) {
      displayMyRole.textContent = '';
      displayMyRole.classList.add('is-hidden');
    }
    btnEditName?.classList.add('is-hidden');
    btnTopCreate?.classList.remove('is-hidden');
    btnOpenSeats?.classList.add('is-hidden');
    btnViewMembers?.classList.add('is-hidden');
    btnOpenInvite?.classList.add('is-hidden');
    emptyState?.classList.remove('is-hidden');
    contentGroups?.classList.add('is-hidden');
  }

  private renderTeamDetails(detail: TeamDetailResponse): void {
    const canManageTeam = hasTeamPermission('team:settings:manage');
    const canManageBilling = hasTeamPermission('team:billing:manage');
    const canInvite = hasTeamPermission('team:members:invite');

    const displayTeamName = this.container.querySelector<HTMLElement>('[data-ref="display-team-name"]');
    const displayMyRole = this.container.querySelector<HTMLElement>('[data-ref="display-my-team-role"]');
    const btnEditName = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edit-team-name"]');
    const btnTopCreate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-create-team"]');
    const btnOpenSeats = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-seats-modal"]');
    const btnViewMembers = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-view-members"]');
    const btnOpenInvite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-invite-modal"]');
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="team-empty-state"]');
    const contentGroups = this.container.querySelector<HTMLElement>('[data-ref="team-content-groups"]');
    const dangerGroup = this.container.querySelector<HTMLElement>('[data-ref="group-team-danger"]');

    this.toggleNameEditMode(false);
    if (displayTeamName) {
      displayTeamName.removeAttribute('data-i18n');
      displayTeamName.textContent = detail.team.name;
    }
    if (displayMyRole) {
      displayMyRole.textContent = this.resolveRoleLabel(detail.role);
      displayMyRole.classList.remove('is-hidden');
    }

    btnEditName?.classList.toggle('is-hidden', !canManageTeam);
    btnTopCreate?.classList.add('is-hidden');
    btnOpenSeats?.classList.toggle('is-hidden', !canManageBilling);
    btnViewMembers?.classList.remove('is-hidden');
    btnOpenInvite?.classList.toggle('is-hidden', !canInvite);
    emptyState?.classList.add('is-hidden');
    contentGroups?.classList.remove('is-hidden');
    dangerGroup?.classList.toggle('is-hidden', detail.role === 'owner');

    this.renderSeatsSection(detail);
  }

  private renderSeatsSection(detail: TeamDetailResponse): void {
    const textUsed = this.container.querySelector<HTMLElement>('[data-ref="team-seats-text-used"]');
    const badgePercent = this.container.querySelector<HTMLElement>('[data-ref="team-seats-badge-percent"]');
    const barFill = this.container.querySelector<HTMLProgressElement>('[data-ref="team-seats-progress"]');
    const textAvailable = this.container.querySelector<HTMLElement>('[data-ref="team-seats-available-text"]');

    if (!textUsed || !barFill) return;

    const safeLimit = Math.max(1, Number(detail.seatLimit || detail.team.seat_limit || 1));
    const occupied = Math.max(0, Number(detail.seatsUsed || 0) + Number(detail.pendingCount || 0));
    const pct = Math.min(100, Math.round((occupied / safeLimit) * 1000) / 10);
    const available = Math.max(0, safeLimit - occupied);

    textUsed.textContent = t('settings.team.seats_used_format', {
      limit: safeLimit,
      used: occupied,
    });

    if (badgePercent) {
      badgePercent.textContent = `${pct}%`;
      if (pct >= 90) {
        badgePercent.className = 'component-badge component-badge--danger component-text--sm';
      } else if (pct >= 75) {
        badgePercent.className = 'component-badge component-badge--warning component-text--sm';
      } else {
        badgePercent.className = 'component-badge component-badge--neutral component-text--sm';
      }
    }

    barFill.max = 100;
    barFill.value = Math.min(100, pct);
    barFill.classList.remove('component-progress__bar--danger', 'component-progress__bar--warning', 'component-progress__bar--primary');
    if (pct >= 90) {
      barFill.classList.add('component-progress__bar--danger');
    } else if (pct >= 75) {
      barFill.classList.add('component-progress__bar--warning');
    } else {
      barFill.classList.add('component-progress__bar--primary');
    }

    if (textAvailable) {
      textAvailable.textContent = t('settings.team.seats_available_format', {
        active: detail.seatsUsed,
        available,
        pending: detail.pendingCount,
      });
    }
  }

  private async handleSaveTeamName(): Promise<void> {
    if (!this.currentDetail) return;
    const inputName = this.container.querySelector<HTMLInputElement>('[data-ref="input-team-name"]');
    const btnSave = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-save-team-name"]');
    const name = (inputName?.value || '').trim();

    if (name.length < 2) {
      showToast(t('settings.team.validation_name_required'), 'error');
      inputName?.focus();
      return;
    }

    if (btnSave) btnSave.disabled = true;
    try {
      const res = await updateCurrentTeamApi(name);
      if (this.isDestroyed) return;
      if (!res.success) {
        showToast(res.error || t('teams.errors.update_team'), 'error');
        return;
      }

      await checkAuthSession();
      this.toggleNameEditMode(false);
      await this.loadTeamData();
      showToast(t('settings.team.toast_profile_updated'), 'success');
    } finally {
      if (btnSave && !this.isDestroyed) btnSave.disabled = false;
    }
  }

  private handleLeaveTeamPrompt(): void {
    const teamName = this.currentDetail?.team.name || '';
    openModal({
      cancelText: t('settings.team.btn_cancel'),
      confirmClass: 'component-button--danger',
      confirmText: t('settings.team.btn_leave_team'),
      description: t('settings.team.modal_leave_team_desc', { name: teamName }),
      onConfirm: async (inst) => {
        inst.setConfirmLoading(true);
        const res = await leaveCurrentTeamApi();
        if (!res.success) {
          inst.setConfirmLoading(false);
          inst.showError(res.error || t('teams.errors.leave_team'));
          return false;
        }
        setActiveTeamId(null);
        await checkAuthSession();
        inst.close();
        showToast(t('settings.team.toast_left_team'), 'success');
        navigate('/settings/your-account');
        return true;
      },
      showCancel: true,
      showConfirm: true,
      size: 'sm',
      title: t('settings.team.modal_leave_team_title'),
    });
  }
}

async function createTeamSettingsView(): Promise<HTMLElement> {
  const element = await loadTemplate('/views/settings/team.html');
  const controller = new TeamSettingsController(element);
  (element as { __controller?: ViewController } & HTMLElement).__controller = {
    destroy: () => controller.destroy(),
  };
  await controller.init();
  return element;
}

export { createTeamSettingsView };
