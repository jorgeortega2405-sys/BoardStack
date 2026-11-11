import { checkAuthSession, escapeHtml, inviteTeamMemberApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { ModalInstance } from '../types/common.types.js';
import { openModal } from './modal.component.js';

function openInviteTeamMemberModal(options: {
  onInvited?: (result: { inviteUrl?: string }) => void | Promise<void>;
} = {}): ModalInstance | null {
  let selectedRole: 'admin' | 'member' = 'member';

  const bodyHtml = `
    <div class="team-invite-modal" data-ref="team-invite-modal-body">
      <label class="field" data-ref="field-invite-email">
        <input class="field__input" data-ref="input-modal-invite-email" type="email" placeholder=" " maxlength="254" autocomplete="email" />
        <span class="field__label">${escapeHtml(t('settings.team.invite_email_label'))}</span>
      </label>

      <div class="team-invite-modal__role-section" data-ref="invite-role-section">
        <span class="team-invite-modal__label">${escapeHtml(t('settings.team.invite_role_label'))}</span>
        <div class="team-invite-modal__roles" data-ref="invite-role-options">
          <button type="button" class="team-folder-share__vis-card is-selected" data-ref="btn-invite-role-member">
            <div class="team-folder-share__vis-head">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
              <span>${escapeHtml(t('settings.team.invite_role_member'))}</span>
            </div>
            <span class="team-folder-share__vis-desc">${escapeHtml(t('settings.team.invite_role_member_desc'))}</span>
          </button>
          <button type="button" class="team-folder-share__vis-card" data-ref="btn-invite-role-admin">
            <div class="team-folder-share__vis-head">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#verified_user"></use></svg>
              <span>${escapeHtml(t('settings.team.invite_role_admin'))}</span>
            </div>
            <span class="team-folder-share__vis-desc">${escapeHtml(t('settings.team.invite_role_admin_desc'))}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const modal = openModal({
    bodyHtml,
    cancelText: t('settings.team.btn_cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('settings.team.invite_modal_submit'),
    description: t('settings.team.invite_modal_desc'),
    onConfirm: async (inst) => {
      inst.clearError();
      const emailInput = inst.body.querySelector<HTMLInputElement>('[data-ref="input-modal-invite-email"]');
      const email = (emailInput?.value || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        inst.showError(t('settings.team.validation_email_required'));
        emailInput?.focus();
        return false;
      }

      inst.setConfirmLoading(true);
      const res = await inviteTeamMemberApi(email, selectedRole);
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

  const btnRoleMember = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-invite-role-member"]');
  const btnRoleAdmin = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-invite-role-admin"]');
  const emailInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-invite-email"]');

  const syncRoleButtons = () => {
    btnRoleMember?.classList.toggle('is-selected', selectedRole === 'member');
    btnRoleAdmin?.classList.toggle('is-selected', selectedRole === 'admin');
  };

  btnRoleMember?.addEventListener('click', (e) => {
    e.preventDefault();
    selectedRole = 'member';
    syncRoleButtons();
  });

  btnRoleAdmin?.addEventListener('click', (e) => {
    e.preventDefault();
    selectedRole = 'admin';
    syncRoleButtons();
  });

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
