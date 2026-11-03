import { deleteApi, getApi, postApi, putApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';

interface MemberItem {
  email: string;
  id: number;
  joined_at: string;
  role: 'admin' | 'member' | 'owner';
  status: string;
  user_id: number;
  username: string;
}

interface InvitationItem {
  created_at: string;
  email: string;
  expires_at: string;
  id: number;
  role: 'admin' | 'member';
  status: string;
}

export class OrganizationMembersController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private invitations: InvitationItem[] = [];
  private members: MemberItem[] = [];
  private searchQuery = '';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.bindEvents();
    renderIcons(this.container);
    translateElement(this.container);
    await this.loadMembersAndInvitations();
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
    const btnOpenInvite = this.container.querySelector<HTMLElement>('[data-ref="btn-open-invite"]');
    const btnCancelInvite = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-invite"]');
    const btnSubmitInvite = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-invite"]');
    const inviteGroup = this.container.querySelector<HTMLElement>('[data-ref="group-invite-form"]');

    searchInput?.addEventListener('input', () => {
      this.searchQuery = (searchInput.value || '').trim().toLowerCase();
      this.renderMembersList();
    }, { signal });

    btnOpenInvite?.addEventListener('click', (e) => {
      e.preventDefault();
      if (inviteGroup) {
        inviteGroup.classList.toggle('is-hidden');
        if (!inviteGroup.classList.contains('is-hidden')) {
          const emailInput = inviteGroup.querySelector<HTMLInputElement>('[data-ref="input-invite-email"]');
          emailInput?.focus();
        }
      }
    }, { signal });

    btnCancelInvite?.addEventListener('click', (e) => {
      e.preventDefault();
      if (inviteGroup) {
        inviteGroup.classList.add('is-hidden');
        this.clearInviteForm();
      }
    }, { signal });

    btnSubmitInvite?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.handleInviteSubmit();
    }, { signal });
  }

  private clearInviteForm(): void {
    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-invite-email"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="invite-error"]');
    const successBanner = this.container.querySelector<HTMLElement>('[data-ref="invite-success"]');
    if (emailInput) emailInput.value = '';
    if (errorBanner) {
      errorBanner.textContent = '';
      errorBanner.classList.add('is-hidden');
    }
    if (successBanner) {
      successBanner.textContent = '';
      successBanner.classList.add('is-hidden');
    }
  }

  private async handleInviteSubmit(): Promise<void> {
    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-invite-email"]');
    const roleSelect = this.container.querySelector<HTMLSelectElement>('[data-ref="select-invite-role"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="invite-error"]');
    const successBanner = this.container.querySelector<HTMLElement>('[data-ref="invite-success"]');
    const inviteGroup = this.container.querySelector<HTMLElement>('[data-ref="group-invite-form"]');

    if (errorBanner) errorBanner.classList.add('is-hidden');
    if (successBanner) successBanner.classList.add('is-hidden');

    const email = (emailInput?.value || '').trim();
    const role = (roleSelect?.value || 'member') as 'admin' | 'member';

    if (!email || !email.includes('@')) {
      if (errorBanner) {
        errorBanner.textContent = t('org.members.invalid_email', 'Ingresa un correo electrónico válido.');
        errorBanner.classList.remove('is-hidden');
      }
      return;
    }

    try {
      const response = await postApi('/api/organization/members/invite', { email, role });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (errorBanner) {
          errorBanner.textContent = data.error || t('common.error_occurred', 'Error al enviar la invitación.');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      showToast(t('org.members.invite_sent', 'Invitación enviada exitosamente.'), 'success');
      this.clearInviteForm();
      inviteGroup?.classList.add('is-hidden');
      await this.loadMembersAndInvitations();
    } catch {
      if (errorBanner) {
        errorBanner.textContent = t('common.network_error', 'Error de conexión con el servidor.');
        errorBanner.classList.remove('is-hidden');
      }
    }
  }

  private async loadMembersAndInvitations(): Promise<void> {
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
      this.invitations = Array.isArray(data.invitations) ? data.invitations : [];

      this.renderMembersList();
      this.renderInvitationsList();
    } catch {
      if (errorBanner) {
        errorBanner.textContent = t('common.network_error', 'Error de conexión con el servidor.');
        errorBanner.classList.remove('is-hidden');
      }
    }
  }

  private renderMembersList(): void {
    const container = this.container.querySelector<HTMLElement>('[data-ref="members-container"]');
    const countDesc = this.container.querySelector<HTMLElement>('[data-ref="members-count-desc"]');
    if (!container) return;

    const filtered = this.members.filter((m) => {
      if (!this.searchQuery) return true;
      const u = (m.username || '').toLowerCase();
      const e = (m.email || '').toLowerCase();
      return u.includes(this.searchQuery) || e.includes(this.searchQuery);
    });

    if (countDesc) {
      countDesc.textContent = `${this.members.length} ${this.members.length === 1 ? 'miembro' : 'miembros'}`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="settings-item" data-ref="members-empty">
          <div class="settings-item__text">
            <p class="settings-item__desc" data-i18n="org.members.no_results">${t('org.members.no_results', 'No se encontraron miembros coincidentes.')}</p>
          </div>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach((member) => {
      const isOwner = member.role === 'owner';
      const roleText = member.role === 'owner' ? 'Propietario' : member.role === 'admin' ? 'Administrador' : 'Miembro';
      const dateText = member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '-';

      html += `
        <div class="settings-item" data-ref="member-item-${member.id}">
          <div class="settings-item__content">
            <div class="settings-item__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
            </div>
            <div class="settings-item__text">
              <div class="settings-item__info">
                <h3 class="settings-item__title" data-ref="member-name-${member.id}">${member.username}</h3>
                <span class="component-badge component-badge--sm ${isOwner ? 'component-badge--primary' : 'component-badge--info'}" data-ref="member-badge-${member.id}">${roleText}</span>
              </div>
              <p class="settings-item__desc">${member.email} • Unido el ${dateText}</p>
            </div>
          </div>
          <div class="settings-item__actions">
            ${
              isOwner
                ? ''
                : `
              <label class="field" data-ref="field-role-${member.id}">
                <select class="field__input field__select" data-ref="select-member-role-${member.id}" data-member-id="${member.id}">
                  <option value="member" ${member.role === 'member' ? 'selected' : ''}>Miembro</option>
                  <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Administrador</option>
                </select>
              </label>
              <button type="button" class="component-button component-button--h34 component-button--danger" data-ref="btn-remove-member-${member.id}" data-member-id="${member.id}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                <span>Eliminar</span>
              </button>
            `
            }
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    renderIcons(container);

    filtered.forEach((member) => {
      if (member.role === 'owner') return;

      const roleSelect = container.querySelector<HTMLSelectElement>(`[data-ref="select-member-role-${member.id}"]`);
      roleSelect?.addEventListener('change', async () => {
        const newRole = roleSelect.value as 'admin' | 'member';
        await this.handleRoleChange(member.id, newRole);
      });

      const removeBtn = container.querySelector<HTMLElement>(`[data-ref="btn-remove-member-${member.id}"]`);
      removeBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleRemoveMember(member.id, member.username);
      });
    });
  }

  private renderInvitationsList(): void {
    const container = this.container.querySelector<HTMLElement>('[data-ref="invitations-container"]');
    const countDesc = this.container.querySelector<HTMLElement>('[data-ref="invitations-count-desc"]');
    if (!container) return;

    if (countDesc) {
      countDesc.textContent = `${this.invitations.length} ${this.invitations.length === 1 ? 'invitación' : 'invitaciones'}`;
    }

    if (this.invitations.length === 0) {
      container.innerHTML = `
        <div class="settings-item" data-ref="invitations-empty">
          <div class="settings-item__text">
            <p class="settings-item__desc" data-i18n="org.members.no_invitations">${t('org.members.no_invitations', 'No hay invitaciones pendientes.')}</p>
          </div>
        </div>
      `;
      return;
    }

    let html = '';
    this.invitations.forEach((invitation) => {
      const expDate = invitation.expires_at ? new Date(invitation.expires_at).toLocaleDateString() : '-';
      const roleText = invitation.role === 'admin' ? 'Administrador' : 'Miembro';

      html += `
        <div class="settings-item" data-ref="invitation-item-${invitation.id}">
          <div class="settings-item__content">
            <div class="settings-item__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#mail"></use></svg>
            </div>
            <div class="settings-item__text">
              <div class="settings-item__info">
                <h3 class="settings-item__title">${invitation.email}</h3>
                <span class="component-badge component-badge--sm component-badge--warning">${invitation.status}</span>
              </div>
              <p class="settings-item__desc">Rol propuesto: ${roleText} • Expira: ${expDate}</p>
            </div>
          </div>
          <div class="settings-item__actions">
            <button type="button" class="component-button component-button--h34" data-ref="btn-revoke-invitation-${invitation.id}" data-invitation-id="${invitation.id}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
              <span>Revocar</span>
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    renderIcons(container);

    this.invitations.forEach((invitation) => {
      const revokeBtn = container.querySelector<HTMLElement>(`[data-ref="btn-revoke-invitation-${invitation.id}"]`);
      revokeBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleRevokeInvitation(invitation.id);
      });
    });
  }

  private async handleRoleChange(memberId: number, role: 'admin' | 'member'): Promise<void> {
    try {
      const response = await putApi(`/api/organization/members/${memberId}/role`, { role });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showToast(data.error || t('common.error_occurred', 'Error al cambiar rol.'), 'danger');
        await this.loadMembersAndInvitations();
        return;
      }

      showToast(t('org.members.role_updated', 'Rol actualizado exitosamente.'), 'success');
      await this.loadMembersAndInvitations();
    } catch {
      showToast(t('common.network_error', 'Error de conexión con el servidor.'), 'danger');
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
      await this.loadMembersAndInvitations();
    } catch {
      showToast(t('common.network_error', 'Error de conexión con el servidor.'), 'danger');
    }
  }

  private async handleRevokeInvitation(invitationId: number): Promise<void> {
    try {
      const response = await deleteApi(`/api/organization/invitations/${invitationId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showToast(data.error || t('common.error_occurred', 'Error al revocar invitación.'), 'danger');
        return;
      }

      showToast(t('org.members.invitation_revoked', 'Invitación revocada.'), 'info');
      await this.loadMembersAndInvitations();
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
