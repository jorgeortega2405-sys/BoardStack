import { currentUser, linkedAccounts, listMyTeamsApi, logoutAllApi, logoutApi, onAuthChange, switchAccountApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { showToast } from '../services/toast.service.js';
import { getActiveTeamId, onWorkspaceChange, resolveActiveWorkspace, setActiveTeamId } from '../services/workspace.service.js';
import { TeamInvitationRecord } from '../types/team.types.js';
import { getUserAvatarUrl } from '../utils/avatar.util.js';
import { applyAvatarTier } from '../utils/tier.util.js';
import { openCreateTeamModal } from './team-create-modal.component.js';

function setupUserMenu(sidebar: HTMLElement): () => void {
  const avatarContainer = sidebar.querySelector<HTMLElement>('[data-ref="avatar-container"]');
  const railItemLogin = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-login"]');
  const btnLogin = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-login"]');

  if (!avatarContainer || !railItemLogin) {
    return () => {};
  }

  avatarContainer.removeAttribute('style');

  const avatarBtn = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-avatar"]');
  const avatarImg = avatarContainer.querySelector<HTMLImageElement>('[data-ref="avatar-img"]');
  const avatarBackdrop = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu-backdrop"]');
  const avatarMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu"]');

  const panelMain = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-main-options"]');
  const panelSwitcher = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-account-switcher"]');
  const panelWorkspaceSwitcher = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-workspace-switcher"]');
  if (panelSwitcher) {
    panelSwitcher.removeAttribute('style');
    panelSwitcher.classList.add('is-hidden');
  }
  if (panelWorkspaceSwitcher) {
    panelWorkspaceSwitcher.classList.add('is-hidden');
  }

  const btnSwitchAccountMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-switch-account-menu"]');
  const btnSwitchWorkspaceMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-switch-workspace-menu"]');
  const btnBackToMainMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-back-to-main-menu"]');
  const btnBackFromWorkspace = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-back-from-workspace"]');
  const btnAddAccount = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-add-account"]');
  const btnMenuTeamSettings = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-team-settings"]');
  const btnMenuCreateTeam = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-create-team"]');
  const btnSwitcherCreateTeam = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-switcher-create-team"]');
  const btnSettings = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-settings"]');
  const btnPricing = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-pricing"]');
  const btnLogout = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout"]');
  const btnLogoutAll = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout-all"]');
  const accountSwitcherList = avatarContainer.querySelector<HTMLElement>('[data-ref="account-switcher-list"]');
  const workspaceSwitcherList = avatarContainer.querySelector<HTMLElement>('[data-ref="workspace-switcher-list"]');
  const workspacePendingList = avatarContainer.querySelector<HTMLElement>('[data-ref="workspace-pending-list"]');
  const workspacePendingBadge = avatarContainer.querySelector<HTMLElement>('[data-ref="workspace-pending-badge"]');

  const activeAvatar = avatarContainer.querySelector<HTMLImageElement>('[data-ref="active-account-avatar"]');
  const activeAvatarBox = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-avatar-box"]');
  const activeName = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-name"]');
  const activeEmail = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-email"]');
  const activeWorkspaceName = avatarContainer.querySelector<HTMLElement>('[data-ref="active-workspace-name"]');
  const activeWorkspaceMeta = avatarContainer.querySelector<HTMLElement>('[data-ref="active-workspace-meta"]');
  const activeWorkspaceIconUse = avatarContainer.querySelector<SVGUseElement>('[data-ref="active-workspace-icon"] use');
  const activeWorkspaceBox = avatarContainer.querySelector<HTMLElement>('[data-ref="active-workspace-avatar-box"]');

  let pendingInvitations: TeamInvitationRecord[] = [];

  const getRoleLabel = (role: string): string => {
    if (role === 'owner') return t('teams.role_owner');
    if (role === 'admin') return t('teams.role_admin');
    return t('teams.role_member');
  };

  const closeMenu = () => {
    if (avatarMenu) avatarMenu.classList.remove('is-open');
    if (avatarBackdrop) avatarBackdrop.classList.remove('is-open');
    if (panelMain) panelMain.classList.remove('is-hidden');
    if (panelSwitcher) panelSwitcher.classList.add('is-hidden');
    if (panelWorkspaceSwitcher) panelWorkspaceSwitcher.classList.add('is-hidden');
  };

  const switchWorkspaceTo = (teamId: number | null, label: string) => {
    const previous = getActiveTeamId();
    closeMenu();
    if (previous === teamId) return;
    setActiveTeamId(teamId);
    showToast(t('nav.workspace_switched', { name: label }), 'info');
    if (!teamId && window.location.pathname.includes('/settings/team')) {
      navigate('/settings/your-account');
      return;
    }
    navigate(`${window.location.pathname}${window.location.search}`);
  };

  const renderWorkspaceSwitcher = () => {
    if (!workspaceSwitcherList) return;
    workspaceSwitcherList.innerHTML = '';

    const activeTeam = resolveActiveWorkspace(currentUser);
    const isPersonalActive = !activeTeam;

    const makeWorkspaceItem = (options: {
      icon: string;
      isActive: boolean;
      name: string;
      onClick: () => void;
      ref: string;
      subtitle: string;
    }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `menu-item menu-item--bordered account-item${options.isActive ? ' account-item--active' : ''}`;
      btn.setAttribute('data-ref', options.ref);

      const iconBox = document.createElement('div');
      iconBox.className = 'account-item__avatar workspace-item__avatar';
      const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      iconSvg.setAttribute('class', 'component-icon workspace-item__icon');
      iconSvg.setAttribute('aria-hidden', 'true');
      const iconUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      iconUse.setAttribute('href', `/icons.svg#${options.icon}`);
      iconSvg.appendChild(iconUse);
      iconBox.appendChild(iconSvg);

      const info = document.createElement('div');
      info.className = 'account-item__info';
      const titleEl = document.createElement('span');
      titleEl.className = 'account-item__name';
      titleEl.textContent = options.name;
      const metaEl = document.createElement('span');
      metaEl.className = 'account-item__email';
      metaEl.textContent = options.subtitle;
      info.appendChild(titleEl);
      info.appendChild(metaEl);

      btn.appendChild(iconBox);
      btn.appendChild(info);

      if (options.isActive) {
        const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        checkSvg.setAttribute('class', 'component-icon account-item__check');
        checkSvg.setAttribute('aria-hidden', 'true');
        const checkUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        checkUse.setAttribute('href', '/icons.svg#check');
        checkSvg.appendChild(checkUse);
        btn.appendChild(checkSvg);
      } else {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          options.onClick();
        });
      }
      return btn;
    };

    workspaceSwitcherList.appendChild(
      makeWorkspaceItem({
        icon: 'person',
        isActive: isPersonalActive,
        name: t('nav.workspace_personal'),
        onClick: () => switchWorkspaceTo(null, t('nav.workspace_personal')),
        ref: 'workspace-item-personal',
        subtitle: t('teams.personal_subtitle'),
      })
    );

    const teams = Array.isArray(currentUser?.teams) ? currentUser.teams : [];
    for (const team of teams) {
      const isActive = activeTeam?.id === team.id;
      workspaceSwitcherList.appendChild(
        makeWorkspaceItem({
          icon: 'groups',
          isActive,
          name: team.name,
          onClick: () => switchWorkspaceTo(team.id, team.name),
          ref: `workspace-item-team-${team.id}`,
          subtitle: t('teams.team_subtitle', {
            limit: team.seat_limit,
            role: getRoleLabel(team.role),
            used: team.seats_used,
          }),
        })
      );
    }

    if (workspacePendingList) {
      workspacePendingList.innerHTML = '';
      if (pendingInvitations.length > 0) {
        workspacePendingList.classList.remove('is-hidden');
        const header = document.createElement('div');
        header.className = 'avatar-menu__section-header';
        const headerTitle = document.createElement('span');
        headerTitle.className = 'drawer-section__title';
        headerTitle.textContent = t('teams.pending_section_title');
        header.appendChild(headerTitle);
        workspacePendingList.appendChild(header);

        for (const inv of pendingInvitations) {
          const invBtn = document.createElement('button');
          invBtn.type = 'button';
          invBtn.className = 'menu-item menu-item--bordered workspace-pending-item';
          invBtn.setAttribute('data-ref', `workspace-pending-inv-${inv.id}`);

          const mailSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          mailSvg.setAttribute('class', 'component-icon menu-item__icon');
          mailSvg.setAttribute('aria-hidden', 'true');
          const mailUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
          mailUse.setAttribute('href', '/icons.svg#mail');
          mailSvg.appendChild(mailUse);

          const textSpan = document.createElement('span');
          textSpan.className = 'menu-item__text';
          textSpan.textContent = inv.team_name || t('nav.teams');

          invBtn.appendChild(mailSvg);
          invBtn.appendChild(textSpan);
          invBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeMenu();
            navigate(`/teams/invite?token=${encodeURIComponent(inv.token)}`);
          });
          workspacePendingList.appendChild(invBtn);
        }
      } else {
        workspacePendingList.classList.add('is-hidden');
      }
    }
  };

  const loadPendingInvites = async () => {
    if (!currentUser) {
      pendingInvitations = [];
      return;
    }
    const res = await listMyTeamsApi();
    if (res.success && Array.isArray(res.pendingInvitations)) {
      pendingInvitations = res.pendingInvitations;
    } else {
      pendingInvitations = [];
    }
    if (workspacePendingBadge) {
      const count = pendingInvitations.length || Number(currentUser.pending_invitations_count || 0);
      if (count > 0) {
        workspacePendingBadge.textContent = t('teams.badge_pending_invites', { count });
        workspacePendingBadge.classList.remove('is-hidden');
      } else {
        workspacePendingBadge.classList.add('is-hidden');
      }
    }
    renderWorkspaceSwitcher();
  };

  const renderWorkspaceHeader = () => {
    const activeTeam = resolveActiveWorkspace(currentUser);
    if (activeTeam) {
      if (activeWorkspaceName) activeWorkspaceName.textContent = activeTeam.name;
      if (activeWorkspaceMeta) {
        activeWorkspaceMeta.textContent = t('teams.team_subtitle', {
          limit: activeTeam.seat_limit,
          role: getRoleLabel(activeTeam.role),
          used: activeTeam.seats_used,
        });
      }
      if (activeWorkspaceIconUse) activeWorkspaceIconUse.setAttribute('href', '/icons.svg#groups');
      if (activeWorkspaceBox) activeWorkspaceBox.classList.add('workspace-item__avatar--team');
      btnMenuTeamSettings?.classList.remove('is-hidden');
    } else {
      if (activeWorkspaceName) activeWorkspaceName.textContent = t('nav.workspace_personal');
      if (activeWorkspaceMeta) activeWorkspaceMeta.textContent = t('teams.personal_subtitle');
      if (activeWorkspaceIconUse) activeWorkspaceIconUse.setAttribute('href', '/icons.svg#person');
      if (activeWorkspaceBox) activeWorkspaceBox.classList.remove('workspace-item__avatar--team');
      btnMenuTeamSettings?.classList.add('is-hidden');
    }

    const pendingCount = Number(currentUser?.pending_invitations_count || pendingInvitations.length || 0);
    if (workspacePendingBadge) {
      if (pendingCount > 0) {
        workspacePendingBadge.textContent = t('teams.badge_pending_invites', { count: pendingCount });
        workspacePendingBadge.classList.remove('is-hidden');
      } else {
        workspacePendingBadge.classList.add('is-hidden');
      }
    }
    renderWorkspaceSwitcher();
  };

  const renderAccountList = () => {
    if (!accountSwitcherList) return;
    accountSwitcherList.innerHTML = '';

    const accounts = linkedAccounts.length > 0 ? linkedAccounts : (currentUser ? [currentUser] : []);

    accounts.forEach((acc) => {
      const isCurrent = currentUser && String(currentUser.id) === String(acc.id);
      const accAvatarUrl = getUserAvatarUrl(acc, 80);

      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = `menu-item menu-item--bordered account-item${isCurrent ? ' account-item--active' : ''}`;
      itemBtn.setAttribute('data-ref', `account-item-${acc.id}`);

      const avatarBox = document.createElement('div');
      avatarBox.className = 'account-item__avatar';
      applyAvatarTier(avatarBox, acc.subscription_tier || 'free');

      const img = document.createElement('img');
      img.className = 'avatar-img';
      img.src = accAvatarUrl;
      img.alt = acc.username || 'User';

      avatarBox.appendChild(img);

      const infoBox = document.createElement('div');
      infoBox.className = 'account-item__info';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'account-item__name';
      nameSpan.textContent = acc.username || '';

      const emailSpan = document.createElement('span');
      emailSpan.className = 'account-item__email';
      emailSpan.textContent = acc.email || '';

      infoBox.appendChild(nameSpan);
      infoBox.appendChild(emailSpan);

      itemBtn.appendChild(avatarBox);
      itemBtn.appendChild(infoBox);

      if (isCurrent) {
        const checkIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        checkIcon.setAttribute('class', 'component-icon account-item__check');
        checkIcon.setAttribute('aria-hidden', 'true');
        const useEl = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        useEl.setAttribute('href', '/icons.svg#check');
        checkIcon.appendChild(useEl);
        itemBtn.appendChild(checkIcon);
      } else {
        itemBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          closeMenu();
          const res = await switchAccountApi(acc.id);
          if (res.success) {
            showToast(t('toasts.cuenta_cambiada_a'), 'info');
            navigate(window.location.pathname);
          } else {
            showToast(res.error || t('ui.no_se_pudo_cambiar_de_cuenta'), 'danger');
          }
        });
      }

      accountSwitcherList.appendChild(itemBtn);
    });

    if (btnAddAccount) {
      if (accounts.length >= 3) {
        btnAddAccount.classList.add('is-hidden');
      } else {
        btnAddAccount.classList.remove('is-hidden');
      }
    }
  };

  const updateUI = () => {
    const itemProjects = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-projects"]');
    if (currentUser) {
      itemProjects?.classList.remove('is-hidden');
      railItemLogin.classList.add('is-hidden');
      avatarContainer.classList.remove('is-hidden');

      const avatarUrl = getUserAvatarUrl(currentUser, 80);
      const tier = currentUser.subscription_tier || 'free';

      applyAvatarTier(avatarBtn, tier);
      applyAvatarTier(activeAvatarBox, tier);

      if (avatarImg) {
        avatarImg.src = avatarUrl;
        avatarImg.alt = currentUser.username || 'User';
      }
      if (activeAvatar) {
        activeAvatar.src = avatarUrl;
        activeAvatar.alt = currentUser.username || 'User';
      }
      if (activeName) {
        activeName.textContent = currentUser.username || '';
      }
      if (activeEmail) {
        activeEmail.textContent = currentUser.email || '';
      }

      renderAccountList();
      renderWorkspaceHeader();
      void loadPendingInvites();
    } else {
      itemProjects?.classList.add('is-hidden');
      avatarContainer.classList.add('is-hidden');
      railItemLogin.classList.remove('is-hidden');
      pendingInvitations = [];
      closeMenu();
    }
  };

  updateUI();

  const handleDocumentClick = (e: MouseEvent) => {
    if (!avatarMenu?.classList.contains('is-open')) return;
    const target = e.target as Node | null;
    if (target && !avatarContainer.contains(target)) {
      closeMenu();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && avatarMenu?.classList.contains('is-open')) {
      closeMenu();
    }
  };

  avatarBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = avatarMenu?.classList.contains('is-open');
    if (isOpen) {
      closeMenu();
    } else {
      if (avatarMenu) avatarMenu.classList.add('is-open');
      if (avatarBackdrop) avatarBackdrop.classList.add('is-open');
      if (panelMain) panelMain.classList.remove('is-hidden');
      if (panelSwitcher) panelSwitcher.classList.add('is-hidden');
      if (panelWorkspaceSwitcher) panelWorkspaceSwitcher.classList.add('is-hidden');
      renderWorkspaceHeader();
      renderIcons(avatarMenu || avatarContainer);
    }
  });

  avatarBackdrop?.addEventListener('click', (e) => {
    if (e.target === avatarBackdrop) {
      closeMenu();
    }
  });

  btnSwitchAccountMenu?.addEventListener('click', (e) => {
    e.preventDefault();
    if (panelMain) panelMain.classList.add('is-hidden');
    if (panelWorkspaceSwitcher) panelWorkspaceSwitcher.classList.add('is-hidden');
    if (panelSwitcher) panelSwitcher.classList.remove('is-hidden');
    renderAccountList();
    renderIcons(panelSwitcher || avatarContainer);
  });

  btnSwitchWorkspaceMenu?.addEventListener('click', (e) => {
    e.preventDefault();
    if (panelMain) panelMain.classList.add('is-hidden');
    if (panelSwitcher) panelSwitcher.classList.add('is-hidden');
    if (panelWorkspaceSwitcher) {
      panelWorkspaceSwitcher.classList.remove('is-hidden');
      translateElement(panelWorkspaceSwitcher);
    }
    renderWorkspaceSwitcher();
    renderIcons(panelWorkspaceSwitcher || avatarContainer);
  });

  btnBackToMainMenu?.addEventListener('click', (e) => {
    e.preventDefault();
    if (panelSwitcher) panelSwitcher.classList.add('is-hidden');
    if (panelMain) panelMain.classList.remove('is-hidden');
  });

  btnBackFromWorkspace?.addEventListener('click', (e) => {
    e.preventDefault();
    if (panelWorkspaceSwitcher) panelWorkspaceSwitcher.classList.add('is-hidden');
    if (panelMain) panelMain.classList.remove('is-hidden');
  });

  const handleOpenCreateTeam = (e: Event) => {
    e.preventDefault();
    closeMenu();
    openCreateTeamModal();
  };

  btnMenuCreateTeam?.addEventListener('click', handleOpenCreateTeam);
  btnSwitcherCreateTeam?.addEventListener('click', handleOpenCreateTeam);

  btnMenuTeamSettings?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    navigate('/settings/team');
  });

  btnAddAccount?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    if (linkedAccounts.length >= 3) {
      showToast(t('toasts.maximo_de_3_cuentas_alcanzado'), 'info');
      return;
    }
    navigate('/login');
  });

  btnSettings?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    navigate('/settings/your-account');
  });

  btnPricing?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    navigate('/pricing');
  });

  btnLogout?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeMenu();
    const res = await logoutApi();
    if (res.success) {
      if (res.switched && res.user) {
        showToast(t('toasts.has_cambiado_a_la_cuenta_de'), 'info');
        navigate(window.location.pathname);
      } else {
        showToast(t('toasts.sesion_cerrada_exitosamente'), 'info');
        navigate('/login');
      }
    }
  });

  btnLogoutAll?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeMenu();
    await logoutAllApi();
    showToast(t('toasts.se_han_cerrado_todas_las_sesiones'), 'info');
    navigate('/login');
  });

  btnLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeyDown);

  const unsubAuth = onAuthChange(() => {
    updateUI();
  });

  const unsubWorkspace = onWorkspaceChange(() => {
    renderWorkspaceHeader();
  });

  return () => {
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleKeyDown);
    unsubAuth();
    unsubWorkspace();
  };
}

export { setupUserMenu };
