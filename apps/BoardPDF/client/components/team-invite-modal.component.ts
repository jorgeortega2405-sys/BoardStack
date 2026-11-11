import { checkAuthSession, currentUser, escapeHtml, getActiveWorkspaceTeam, inviteTeamMemberApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ModalInstance } from '../types/common.types.js';
import { setupDropdown } from '../utils/dom.util.js';
import { openModal } from './modal.component.js';

function openInviteTeamMemberModal(options: {
  onInvited?: (result: { inviteUrl?: string }) => void | Promise<void>;
} = {}): ModalInstance | null {
  let selectedRole: 'admin' | 'member' = 'member';
  let dropdownCtrl: { destroy: () => void } | null = null;
  const activeTeam = getActiveWorkspaceTeam();
  const canAssignAdmin = Boolean(
    activeTeam &&
    currentUser &&
    Number(activeTeam.owner_id) === Number(currentUser.id) &&
    activeTeam.permissions.includes('team:members:invite')
  );

  const bodyHtml = `
    <div class="team-invite-modal" data-ref="team-invite-modal-body">
      <label class="field" data-ref="field-invite-email">
        <input class="field__input" data-ref="input-modal-invite-email" type="email" placeholder=" " maxlength="254" autocomplete="email" />
        <span class="field__label">${escapeHtml(t('settings.team.invite_email_label'))}</span>
      </label>

      <div class="team-invite-modal__role-section" data-ref="invite-role-section">
        <span class="team-invite-modal__label">${escapeHtml(t('settings.team.invite_role_label'))}</span>
        <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-invite-role">
          <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-invite-role" aria-label="${escapeHtml(t('settings.team.invite_role_label'))}">
            <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-invite-role">
              <svg class="component-icon dropdown-trigger__icon" data-ref="icon-selected-invite-role" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
              <span class="dropdown-trigger__text" data-ref="txt-selected-invite-role">${escapeHtml(t('settings.team.invite_role_member'))}</span>
            </div>
            <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>
          <div class="dropdown-backdrop" data-ref="dropdown-backdrop-invite-role">
            <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-invite-role">
              <div class="menu-panel__drag-zone" data-ref="drag-zone-invite-role" aria-hidden="true">
                <div class="menu-panel__drag-handle"></div>
              </div>
              <div class="menu-panel__list menu-panel__list--scrollable" data-ref="invite-roles-list">
                <button type="button" class="menu-item is-selected is-active" data-ref="invite-role-option-member" data-value="member">
                  <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
                  <span class="menu-item__text">${escapeHtml(t('settings.team.invite_role_member'))}</span>
                  <svg class="component-icon menu-item__check" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                </button>
                ${canAssignAdmin ? `
                  <button type="button" class="menu-item" data-ref="invite-role-option-admin" data-value="admin">
                    <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#verified_user"></use></svg>
                    <span class="menu-item__text">${escapeHtml(t('settings.team.invite_role_admin'))}</span>
                    <svg class="component-icon menu-item__check is-hidden" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
        <p class="team-seats-field__hint" data-ref="invite-role-desc">${escapeHtml(t('settings.team.invite_role_member_desc'))}</p>
      </div>
    </div>
  `;

  const modal = openModal({
    bodyHtml,
    cancelText: t('settings.team.btn_cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('settings.team.invite_modal_submit'),
    description: t('settings.team.invite_modal_desc'),
    onClose: () => {
      dropdownCtrl?.destroy();
      dropdownCtrl = null;
    },
    onConfirm: async (inst) => {
      inst.clearError();
      const emailInput = inst.body.querySelector<HTMLInputElement>('[data-ref="input-modal-invite-email"]');
      const email = (emailInput?.value || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        inst.showError(t('settings.team.validation_email_required'));
        emailInput?.focus();
        return false;
      }

      const safeRole: 'admin' | 'member' = canAssignAdmin && selectedRole === 'admin' ? 'admin' : 'member';
      inst.setConfirmLoading(true);
      const res = await inviteTeamMemberApi(email, safeRole);
      if (!res.success) {
        inst.setConfirmLoading(false);
        inst.showError(res.error || t('teams.errors.invite_member'));
        return false;
      }

      await checkAuthSession();
      if (res.inviteUrl) {
        try {
          await navigator.clipboard?.writeText(res.inviteUrl);
        } catch {}
      }
      if (typeof options.onInvited === 'function') {
        await options.onInvited({ inviteUrl: res.inviteUrl });
      }
      inst.close();
      showToast(t('settings.team.toast_invite_sent'), 'success');
      return true;
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('settings.team.invite_modal_title'),
  });

  renderIcons(modal.body);

  const wrapper = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-invite-role"]');
  const trigger = modal.body.querySelector<HTMLElement>('[data-ref="btn-trigger-invite-role"]');
  const backdrop = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-invite-role"]');
  const menu = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-menu-invite-role"]');
  const roleDescEl = modal.body.querySelector<HTMLElement>('[data-ref="invite-role-desc"]');
  const emailInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-invite-email"]');

  if (wrapper) {
    dropdownCtrl = setupDropdown(wrapper, {
      backdrop,
      isSelect: true,
      menu,
      onSelect: (val, item) => {
        selectedRole = canAssignAdmin && val === 'admin' ? 'admin' : 'member';
        if (roleDescEl) {
          roleDescEl.textContent = selectedRole === 'admin'
            ? t('settings.team.invite_role_admin_desc')
            : t('settings.team.invite_role_member_desc');
        }
        const items = modal.body.querySelectorAll<HTMLElement>('[data-ref="invite-roles-list"] .menu-item');
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

  emailInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      modal.confirmBtn?.click();
    }
  });

  setTimeout(() => emailInput?.focus(), 60);

  return modal;
}

export { openInviteTeamMemberModal };
