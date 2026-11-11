import { acceptTeamInvitationApi, checkAuthSession, currentUser, inspectTeamInvitationApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { setActiveTeamId } from '../../services/workspace.service.js';
import { ViewController } from '../../types/common.types.js';
import { withButtonLoading } from '../../utils/dom.util.js';

class TeamInviteController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private token = '';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    translateElement(this.container);
    renderIcons(this.container);

    const params = new URLSearchParams(window.location.search);
    this.token = (params.get('token') || '').trim();

    this.bindEvents();
    await this.loadInvitation();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;
    const returnUrl = `/teams/invite?token=${encodeURIComponent(this.token)}`;
    const encodedRedirect = encodeURIComponent(returnUrl);

    const btnGoHome = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-invite-go-home"]');
    btnGoHome?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/');
    }, { signal });

    const btnCancel = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-invite-cancel"]');
    btnCancel?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/');
    }, { signal });

    const btnLogin = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-invite-login"]');
    btnLogin?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(`/login?redirect=${encodedRedirect}`);
    }, { signal });

    const btnRegister = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-invite-register"]');
    btnRegister?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(`/register?redirect=${encodedRedirect}`);
    }, { signal });

    const btnAccept = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-accept-invite"]');
    btnAccept?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!btnAccept || !this.token) return;
      const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="invite-error-banner"]');
      errorBanner?.classList.add('is-hidden');

      await withButtonLoading(btnAccept, async () => {
        const res = await acceptTeamInvitationApi(this.token);
        if (res.success && res.team) {
          setActiveTeamId(res.team.id);
          await checkAuthSession();
          showToast(t('teams.invite_page.accepted_toast', { team: res.team.name }), 'success');
          navigate('/projects');
          return;
        }
        if (errorBanner) {
          errorBanner.textContent = res.error || t('teams.errors.accept_invite');
          errorBanner.classList.remove('is-hidden');
        }
      });
    }, { signal });
  }

  private async loadInvitation(): Promise<void> {
    const loadingBox = this.container.querySelector<HTMLElement>('[data-ref="team-invite-loading"]');
    const invalidBox = this.container.querySelector<HTMLElement>('[data-ref="team-invite-invalid"]');
    const readyBox = this.container.querySelector<HTMLElement>('[data-ref="team-invite-ready"]');

    if (!this.token) {
      loadingBox?.classList.add('is-hidden');
      invalidBox?.classList.remove('is-hidden');
      return;
    }

    const res = await inspectTeamInvitationApi(this.token);
    loadingBox?.classList.add('is-hidden');

    if (!res.success || !res.invitation) {
      invalidBox?.classList.remove('is-hidden');
      return;
    }

    const inv = res.invitation;
    if (inv.status !== 'pending') {
      invalidBox?.classList.remove('is-hidden');
      const invalidDesc = this.container.querySelector<HTMLElement>('[data-ref="invite-invalid-desc"]');
      if (invalidDesc && inv.status === 'accepted') {
        invalidDesc.textContent = t('teams.invite_page.already_accepted');
      }
      return;
    }

    readyBox?.classList.remove('is-hidden');

    const subtitleEl = this.container.querySelector<HTMLElement>('[data-ref="invite-ready-subtitle"]');
    if (subtitleEl) {
      subtitleEl.textContent = t('teams.invite_page.subtitle', {
        inviter: inv.invited_by_name || 'BoardPDF',
        team: inv.team_name,
      });
    }

    const roleEl = this.container.querySelector<HTMLElement>('[data-ref="invite-meta-role"]');
    if (roleEl) {
      const roleLabel = inv.role === 'admin' ? t('teams.role_admin') : t('teams.role_member');
      roleEl.textContent = t('teams.invite_page.role_line', { role: roleLabel });
    }

    const emailEl = this.container.querySelector<HTMLElement>('[data-ref="invite-meta-email"]');
    if (emailEl) {
      emailEl.textContent = t('teams.invite_page.email_line', { email: inv.emailHint });
    }

    const expiresEl = this.container.querySelector<HTMLElement>('[data-ref="invite-meta-expires"]');
    if (expiresEl) {
      let formattedDate = inv.expires_at;
      try {
        formattedDate = new Date(inv.expires_at).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      } catch {}
      expiresEl.textContent = t('teams.invite_page.expires_line', { date: formattedDate });
    }

    const authNotice = this.container.querySelector<HTMLElement>('[data-ref="invite-auth-notice"]');
    const mismatchNotice = this.container.querySelector<HTMLElement>('[data-ref="invite-mismatch-notice"]');
    const btnAccept = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-accept-invite"]');
    const btnLogin = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-invite-login"]');
    const btnRegister = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-invite-register"]');

    if (!currentUser) {
      if (authNotice) {
        authNotice.textContent = t('teams.invite_page.auth_required_desc', { email: inv.emailHint });
        authNotice.classList.remove('is-hidden');
      }
      btnLogin?.classList.remove('is-hidden');
      btnRegister?.classList.remove('is-hidden');
    } else if (!inv.matchesCurrentUser) {
      if (mismatchNotice) {
        mismatchNotice.textContent = t('teams.invite_page.mismatch_warning', {
          currentEmail: currentUser.email,
          invitedEmail: inv.emailHint,
        });
        mismatchNotice.classList.remove('is-hidden');
      }
      btnLogin?.classList.remove('is-hidden');
    } else {
      btnAccept?.classList.remove('is-hidden');
    }

    renderIcons(this.container);
  }
}

async function createTeamInviteView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/teams/invite.html');
  const controller = new TeamInviteController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { TeamInviteController, createTeamInviteView };
