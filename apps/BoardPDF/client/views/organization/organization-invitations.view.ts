import { openModal } from '../../components/modal.component.js';
import { deleteApi, getApi, postApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';
import { applyAvatarTier, renderUserAvatarHtml } from '../../utils/avatar.util.js';

interface InvitationItem {
  avatar_url?: string | null;
  created_at: string;
  email: string;
  expires_at: string;
  id: number;
  role: 'admin' | 'member';
  status: string;
  subscription_tier?: string;
}

export class OrganizationInvitationsController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private invitations: InvitationItem[] = [];
  private searchQuery = '';
  private selectedInvitationId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.bindEvents();
    renderIcons(this.container);
    translateElement(this.container);
    await this.loadInvitations();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  bindEvents(): void {
    const signal = this.abortController?.signal;
    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-invitations"]');
    const btnGoMembers = this.container.querySelector<HTMLElement>('[data-ref="btn-go-members"]');
    const btnOpenInvite = this.container.querySelector<HTMLElement>('[data-ref="btn-open-invite"]');
    const btnRevoke = this.container.querySelector<HTMLElement>('[data-ref="btn-action-revoke-invitation"]');

    searchInput?.addEventListener('input', () => {
      this.searchQuery = (searchInput.value || '').trim().toLowerCase();
      this.renderInvitationsList();
    }, { signal });

    btnGoMembers?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/organization/members');
    }, { signal });

    btnOpenInvite?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openInviteModal();
    }, { signal });

    btnRevoke?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openRevokeInvitationModal();
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
          await this.loadInvitations();
        } catch {
          modal.setConfirmLoading(false);
          modal.showError(t('common.network_error', 'Error de conexión con el servidor.'));
        }
      },
      title: 'Invitar nuevo miembro',
    });
  }

  private openRevokeInvitationModal(): void {
    const invitation = this.invitations.find((inv) => inv.id === this.selectedInvitationId);
    if (!invitation) return;

    openModal({
      cancelText: 'Cancelar',
      confirmClass: 'component-button--danger',
      confirmText: 'Revocar invitación',
      description: `¿Estás seguro de que deseas revocar la invitación pendiente enviada a ${invitation.email}? El enlace enviado dejará de ser válido.`,
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        await this.handleRevokeInvitation(invitation.id);
        modal.close();
      },
      title: 'Revocar invitación',
    });
  }

  private async loadInvitations(): Promise<void> {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="invitations-error"]');
    try {
      const response = await getApi('/api/organization/members');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorBanner) {
          errorBanner.textContent = errorData.error || t('common.error_load_data', 'Error al cargar invitaciones.');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      const data = await response.json();
      this.invitations = Array.isArray(data.invitations) ? data.invitations : [];
      this.renderInvitationsList();
    } catch {
      if (errorBanner) {
        errorBanner.textContent = t('common.network_error', 'Error de conexión con el servidor.');
        errorBanner.classList.remove('is-hidden');
      }
    }
  }

  private renderInvitationsList(): void {
    const container = this.container.querySelector<HTMLElement>('[data-ref="invitations-container"]');
    if (!container) return;

    const filtered = this.invitations.filter((inv) => {
      if (!this.searchQuery) return true;
      const e = (inv.email || '').toLowerCase();
      return e.includes(this.searchQuery);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr data-ref="invitations-empty">
          <td class="component-table__cell" colspan="4" style="color: var(--text-secondary); padding: 32px 16px; text-align: center;" data-i18n="org.members.no_invitations">
            ${t('org.members.no_invitations', 'No hay invitaciones pendientes.')}
          </td>
        </tr>
      `;
      this.updateSelectionState();
      return;
    }

    let html = '';
    filtered.forEach((invitation) => {
      const expDate = invitation.expires_at ? new Date(invitation.expires_at).toLocaleDateString() : '-';
      const roleText = invitation.role === 'admin' ? 'Administrador' : 'Miembro';
      const isSelected = this.selectedInvitationId === invitation.id;

      html += `
        <tr class="component-table__row component-cursor-pointer${isSelected ? ' is-selected' : ''}" data-ref="invitation-item-${invitation.id}" data-invitation-id="${invitation.id}">
          <td class="component-table__cell" style="padding-left: 20px;">
            <div style="align-items: center; display: flex; gap: 12px;">
              ${renderUserAvatarHtml(invitation, { dataRef: `avatar-inv-${invitation.id}` })}
              <span style="color: var(--text-primary); font-weight: 600;">${invitation.email}</span>
            </div>
          </td>
          <td class="component-table__cell">
            <span class="component-badge component-badge--sm component-badge--neutral">${roleText}</span>
          </td>
          <td class="component-table__cell">
            <span class="component-badge component-badge--sm component-badge--warning">${invitation.status}</span>
          </td>
          <td class="component-table__cell" style="padding-right: 20px;">
            <span style="color: var(--text-secondary);">${expDate}</span>
          </td>
        </tr>
      `;
    });

    container.innerHTML = html;
    renderIcons(container);

    filtered.forEach((invitation) => {
      const avatarBox = container.querySelector<HTMLElement>(`[data-ref="avatar-inv-${invitation.id}"]`);
      applyAvatarTier(avatarBox, invitation.subscription_tier || 'free');

      const row = container.querySelector<HTMLElement>(`[data-ref="invitation-item-${invitation.id}"]`);
      row?.addEventListener('click', () => {
        if (this.selectedInvitationId === invitation.id) {
          this.selectedInvitationId = null;
        } else {
          this.selectedInvitationId = invitation.id;
        }
        this.renderInvitationsList();
      });
    });

    this.updateSelectionState();
  }

  private updateSelectionState(): void {
    const btnRevoke = this.container.querySelector<HTMLElement>('[data-ref="btn-action-revoke-invitation"]');

    if (!this.selectedInvitationId) {
      btnRevoke?.classList.add('is-hidden');
      return;
    }

    const invitation = this.invitations.find((inv) => inv.id === this.selectedInvitationId);
    if (!invitation) {
      this.selectedInvitationId = null;
      btnRevoke?.classList.add('is-hidden');
      return;
    }

    btnRevoke?.classList.remove('is-hidden');
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
      this.selectedInvitationId = null;
      await this.loadInvitations();
    } catch {
      showToast(t('common.network_error', 'Error de conexión con el servidor.'), 'danger');
    }
  }
}

export async function createOrgInvitationsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/organization/invitations.html');
  const controller = new OrganizationInvitationsController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
