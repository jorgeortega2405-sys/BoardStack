import { openModal } from '../../components/modal.component.js';
import { deleteApi, getApi, postApi, putApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';
import { applyAvatarTier, renderUserAvatarHtml } from '../../utils/avatar.util.js';

interface MemberItem {
  avatar_url?: string | null;
  email: string;
  id: number;
  joined_at: string;
  role: 'admin' | 'member' | 'owner';
  status: string;
  subscription_tier?: string;
  user_id: number;
  username: string;
}

export class OrganizationMembersController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private members: MemberItem[] = [];
  private searchQuery = '';
  private selectedMemberId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.bindEvents();
    renderIcons(this.container);
    translateElement(this.container);
    await this.loadMembers();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  bindEvents(): void {
    const signal = this.abortController?.signal;
    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-members"]');
    const btnGoInvitations = this.container.querySelector<HTMLElement>('[data-ref="btn-go-invitations"]');
    const btnOpenInvite = this.container.querySelector<HTMLElement>('[data-ref="btn-open-invite"]');
    const btnManageRole = this.container.querySelector<HTMLElement>('[data-ref="btn-action-manage-role"]');
    const btnDeleteMember = this.container.querySelector<HTMLElement>('[data-ref="btn-action-delete-member"]');

    searchInput?.addEventListener('input', () => {
      this.searchQuery = (searchInput.value || '').trim().toLowerCase();
      this.renderMembersList();
    }, { signal });

    btnGoInvitations?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/organization/invitations');
    }, { signal });

    btnOpenInvite?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openInviteModal();
    }, { signal });

    btnManageRole?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openManageRoleModal();
    }, { signal });

    btnDeleteMember?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openDeleteMemberModal();
    }, { signal });
  }

  private openInviteModal(): void {
    const modalBody = document.createElement('div');
    modalBody.style.cssText = 'display: flex; flex-direction: column; gap: 14px; padding: 4px 0;';
    modalBody.innerHTML = `
      <p style="margin: 0; font-size: 13.5px; color: var(--text-secondary); line-height: 1.5;">
        Envía una invitación a un usuario para que se una a tu organización empresarial con acceso a las herramientas asignadas.
      </p>

      <label class="field" data-ref="field-modal-invite-email">
        <input class="field__input" data-ref="input-modal-invite-email" type="email" placeholder=" " autocomplete="email" />
        <span class="field__label">Correo electrónico</span>
      </label>

      <label class="field" data-ref="field-modal-invite-role">
        <select class="field__input field__select" data-ref="select-modal-invite-role">
          <option value="member">Miembro</option>
          <option value="admin">Administrador</option>
        </select>
        <span class="field__label">Rol organizacional</span>
      </label>
    `;

    openModal({
      bodyHtml: modalBody,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--black',
      confirmText: 'Enviar invitación',
      onConfirm: async (modal) => {
        const emailInput = modalBody.querySelector<HTMLInputElement>('[data-ref="input-modal-invite-email"]');
        const roleSelect = modalBody.querySelector<HTMLSelectElement>('[data-ref="select-modal-invite-role"]');
        const email = (emailInput?.value || '').trim();
        const role = (roleSelect?.value || 'member') as 'admin' | 'member';

        if (!email || !email.includes('@')) {
          modal.showError(t('org.members.invalid_email', 'Ingresa un correo electrónico válido.'));
          return;
        }

        modal.setConfirmLoading(true);
        try {
          const response = await postApi('/api/organization/members/invite', { email, role });
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            modal.setConfirmLoading(false);
            modal.showError(data.error || t('common.error_occurred', 'Error al enviar la invitación.'));
            return;
          }

          modal.close();
          showToast(t('org.members.invite_sent', 'Invitación enviada exitosamente.'), 'success');
          await this.loadMembers();
        } catch {
          modal.setConfirmLoading(false);
          modal.showError(t('common.network_error', 'Error de conexión con el servidor.'));
        }
      },
      title: 'Invitar nuevo miembro',
    });
  }

  private openManageRoleModal(): void {
    const member = this.members.find((m) => m.id === this.selectedMemberId);
    if (!member) return;

    if (member.role === 'owner') {
      showToast('No es posible modificar el rol del propietario.', 'info');
      return;
    }

    const modalBody = document.createElement('div');
    modalBody.style.cssText = 'display: flex; flex-direction: column; gap: 16px; padding: 4px 0;';
    modalBody.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background-color: var(--bg-hover); border-radius: 12px;">
        ${renderUserAvatarHtml(member, { dataRef: 'modal-role-avatar' })}
        <div style="display: flex; flex-direction: column; min-width: 0;">
          <span style="font-weight: 600; color: var(--text-primary);">${member.username}</span>
          <span style="font-size: 13px; color: var(--text-secondary);">${member.email}</span>
        </div>
      </div>

      <label class="field" data-ref="field-modal-role">
        <select class="field__input field__select" data-ref="select-modal-role">
          <option value="member" ${member.role === 'member' ? 'selected' : ''}>Miembro</option>
          <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
        <span class="field__label">Rol organizacional</span>
      </label>
    `;

    applyAvatarTier(modalBody.querySelector<HTMLElement>('[data-ref="modal-role-avatar"]'), member.subscription_tier || 'free');

    openModal({
      bodyHtml: modalBody,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--black',
      confirmText: 'Guardar cambios',
      description: 'Modifica los permisos y capacidades del integrante en la organización.',
      onConfirm: async (modal) => {
        const roleSelect = modalBody.querySelector<HTMLSelectElement>('[data-ref="select-modal-role"]');
        const newRole = (roleSelect?.value || 'member') as 'admin' | 'member';
        modal.setConfirmLoading(true);

        const success = await this.handleRoleChange(member.id, newRole);
        if (success) {
          modal.close();
        } else {
          modal.setConfirmLoading(false);
        }
      },
      title: 'Gestionar rol de miembro',
    });
  }

  private openDeleteMemberModal(): void {
    const member = this.members.find((m) => m.id === this.selectedMemberId);
    if (!member) return;

    if (member.role === 'owner') {
      showToast('No es posible eliminar al propietario de la organización.', 'info');
      return;
    }

    openModal({
      cancelText: 'Cancelar',
      confirmClass: 'component-button--danger',
      confirmText: 'Eliminar miembro',
      description: `¿Estás seguro de que deseas eliminar a ${member.username} de la organización? Perderá acceso inmediato a los recursos compartidos.`,
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        await this.handleRemoveMember(member.id, member.username);
        modal.close();
      },
      title: 'Eliminar integrante',
    });
  }

  private async loadMembers(): Promise<void> {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="members-error"]');
    try {
      const response = await getApi('/api/organization/members');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorBanner) {
          errorBanner.textContent = errorData.error || t('common.error_load_data', 'Error al cargar miembros.');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      const data = await response.json();
      this.members = Array.isArray(data.members) ? data.members : [];
      this.renderMembersList();
    } catch {
      if (errorBanner) {
        errorBanner.textContent = t('common.network_error', 'Error de conexión con el servidor.');
        errorBanner.classList.remove('is-hidden');
      }
    }
  }

  private renderMembersList(): void {
    const container = this.container.querySelector<HTMLElement>('[data-ref="members-container"]');
    if (!container) return;

    const filtered = this.members.filter((m) => {
      if (!this.searchQuery) return true;
      const u = (m.username || '').toLowerCase();
      const e = (m.email || '').toLowerCase();
      return u.includes(this.searchQuery) || e.includes(this.searchQuery);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr data-ref="members-empty">
          <td class="component-table__cell" colspan="4" style="color: var(--text-secondary); padding: 32px 16px; text-align: center;" data-i18n="org.members.no_results">
            ${t('org.members.no_results', 'No se encontraron miembros coincidentes.')}
          </td>
        </tr>
      `;
      this.updateSelectionState();
      return;
    }

    let html = '';
    filtered.forEach((member) => {
      const isOwner = member.role === 'owner';
      const roleText = member.role === 'owner' ? 'Propietario' : member.role === 'admin' ? 'Administrador' : 'Miembro';
      const dateText = member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '-';
      const isSelected = this.selectedMemberId === member.id;

      html += `
        <tr class="component-table__row component-cursor-pointer${isSelected ? ' is-selected' : ''}" data-ref="member-item-${member.id}" data-member-id="${member.id}">
          <td class="component-table__cell" style="padding-left: 20px;">
            <div style="align-items: center; display: flex; gap: 12px;">
              ${renderUserAvatarHtml(member, { dataRef: `avatar-member-${member.id}` })}
              <span style="color: var(--text-primary); font-weight: 600;" data-ref="member-name-${member.id}">${member.username}</span>
            </div>
          </td>
          <td class="component-table__cell">
            <span style="color: var(--text-secondary);">${member.email}</span>
          </td>
          <td class="component-table__cell">
            <span class="component-badge component-badge--sm ${isOwner ? 'component-badge--primary' : 'component-badge--info'}" data-ref="member-badge-${member.id}">${roleText}</span>
          </td>
          <td class="component-table__cell" style="padding-right: 20px;">
            <span style="color: var(--text-secondary);">${dateText}</span>
          </td>
        </tr>
      `;
    });

    container.innerHTML = html;
    renderIcons(container);

    filtered.forEach((member) => {
      const avatarBox = container.querySelector<HTMLElement>(`[data-ref="avatar-member-${member.id}"]`);
      applyAvatarTier(avatarBox, member.subscription_tier || 'free');

      const row = container.querySelector<HTMLElement>(`[data-ref="member-item-${member.id}"]`);
      row?.addEventListener('click', () => {
        if (this.selectedMemberId === member.id) {
          this.selectedMemberId = null;
        } else {
          this.selectedMemberId = member.id;
        }
        this.renderMembersList();
      });
    });

    this.updateSelectionState();
  }

  private updateSelectionState(): void {
    const btnManageRole = this.container.querySelector<HTMLElement>('[data-ref="btn-action-manage-role"]');
    const btnDeleteMember = this.container.querySelector<HTMLElement>('[data-ref="btn-action-delete-member"]');

    if (!this.selectedMemberId) {
      btnManageRole?.classList.add('is-hidden');
      btnDeleteMember?.classList.add('is-hidden');
      return;
    }

    const member = this.members.find((m) => m.id === this.selectedMemberId);
    if (!member) {
      this.selectedMemberId = null;
      btnManageRole?.classList.add('is-hidden');
      btnDeleteMember?.classList.add('is-hidden');
      return;
    }

    if (member.role === 'owner') {
      btnManageRole?.classList.add('is-hidden');
      btnDeleteMember?.classList.add('is-hidden');
    } else {
      btnManageRole?.classList.remove('is-hidden');
      btnDeleteMember?.classList.remove('is-hidden');
    }
  }

  private async handleRoleChange(memberId: number, role: 'admin' | 'member'): Promise<boolean> {
    try {
      const response = await putApi(`/api/organization/members/${memberId}/role`, { role });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showToast(data.error || t('common.error_occurred', 'Error al cambiar rol.'), 'danger');
        return false;
      }

      showToast(t('org.members.role_updated', 'Rol actualizado exitosamente.'), 'success');
      await this.loadMembers();
      return true;
    } catch {
      showToast(t('common.network_error', 'Error de conexión con el servidor.'), 'danger');
      return false;
    }
  }

  private async handleRemoveMember(memberId: number, username: string): Promise<void> {
    try {
      const response = await deleteApi(`/api/organization/members/${memberId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showToast(data.error || t('common.error_occurred', 'Error al eliminar miembro.'), 'danger');
        return;
      }

      showToast(`Se ha eliminado a ${username} de la organización.`, 'info');
      this.selectedMemberId = null;
      await this.loadMembers();
    } catch {
      showToast(t('common.network_error', 'Error de conexión con el servidor.'), 'danger');
    }
  }
}

export async function createOrgMembersView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/organization/members.html');
  const controller = new OrganizationMembersController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
