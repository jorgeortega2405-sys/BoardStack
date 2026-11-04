import { getApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { ViewController } from '../../types/common.types.js';

export class OrganizationDashboardController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.bindEvents();
    renderIcons(this.container);
    translateElement(this.container);
    await this.loadData();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  bindEvents(): void {
    const signal = this.abortController?.signal;
    const btnsMembers = this.container.querySelectorAll<HTMLElement>('[data-ref="btn-go-members"]');
    const btnsSso = this.container.querySelectorAll<HTMLElement>('[data-ref="btn-go-sso"]');

    btnsMembers.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        navigate('/organization/members');
      }, { signal });
    });

    btnsSso.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        navigate('/organization/sso');
      }, { signal });
    });

    const statMembers = this.container.querySelector<HTMLElement>('[data-ref="stat-members"]');
    const statInvitations = this.container.querySelector<HTMLElement>('[data-ref="stat-invitations"]');
    const statSso = this.container.querySelector<HTMLElement>('[data-ref="stat-sso"]');

    statMembers?.addEventListener('click', () => navigate('/organization/members'), { signal });
    statInvitations?.addEventListener('click', () => navigate('/organization/invitations'), { signal });
    statSso?.addEventListener('click', () => navigate('/organization/sso'), { signal });
  }

  private async loadData(): Promise<void> {
    const nameEl = this.container.querySelector<HTMLElement>('[data-ref="display-org-name"]');
    const domainEl = this.container.querySelector<HTMLElement>('[data-ref="display-org-domain"]');
    const membersVal = this.container.querySelector<HTMLElement>('[data-ref="stat-members-val"]');
    const invitationsVal = this.container.querySelector<HTMLElement>('[data-ref="stat-invitations-val"]');
    const ssoVal = this.container.querySelector<HTMLElement>('[data-ref="stat-sso-val"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="org-dashboard-error"]');

    try {
      const response = await getApi('/api/organization');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || t('common.error_load_data', 'Error al cargar información de la organización');
        if (errorBanner) {
          errorBanner.textContent = message;
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      const data = await response.json();
      const org = data.organization || {};
      const stats = data.stats || {};

      if (nameEl) {
        nameEl.textContent = org.name || 'Mi Organización';
      }
      if (domainEl) {
        domainEl.textContent = org.domain ? `${org.domain} (${org.slug})` : org.slug || '-';
      }
      if (membersVal) {
        membersVal.textContent = String(stats.members_count ?? 1);
      }
      if (invitationsVal) {
        invitationsVal.textContent = String(stats.active_invitations_count ?? 0);
      }
      if (ssoVal) {
        ssoVal.textContent = stats.sso_enabled ? t('common.enabled', 'Habilitado') : t('common.disabled', 'Deshabilitado');
      }
    } catch {
      if (errorBanner) {
        errorBanner.textContent = t('common.network_error', 'Error de conexión con el servidor.');
        errorBanner.classList.remove('is-hidden');
      }
    }
  }
}

export async function createOrgDashboardView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/organization/dashboard.html');
  const controller = new OrganizationDashboardController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
