import { currentUser, linkedAccounts, logoutAllApi, logoutApi, onAuthChange, switchAccountApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { showToast } from '../services/toast.service.js';
import { getUserAvatarUrl } from '../utils/avatar.util.js';
import { applyAvatarTier } from '../utils/tier.util.js';
import { t } from '../services/i18n.service.js';

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
  if (panelSwitcher) {
    panelSwitcher.removeAttribute('style');
    panelSwitcher.classList.add('is-hidden');
  }

  const btnSwitchAccountMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-switch-account-menu"]');
  const btnBackToMainMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-back-to-main-menu"]');
  const btnAddAccount = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-add-account"]');
  const btnSettings = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-settings"]');
  const btnPricing = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-pricing"]');
  const btnLogout = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout"]');
  const btnLogoutAll = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout-all"]');
  const accountSwitcherList = avatarContainer.querySelector<HTMLElement>('[data-ref="account-switcher-list"]');

  const activeAvatar = avatarContainer.querySelector<HTMLImageElement>('[data-ref="active-account-avatar"]');
  const activeAvatarBox = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-avatar-box"]');
  const activeName = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-name"]');
  const activeEmail = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-email"]');

  const closeMenu = () => {
    if (avatarMenu) avatarMenu.classList.remove('is-open');
    if (avatarBackdrop) avatarBackdrop.classList.remove('is-open');
    if (panelMain) panelMain.classList.remove('is-hidden');
    if (panelSwitcher) panelSwitcher.classList.add('is-hidden');
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
    } else {
      itemProjects?.classList.add('is-hidden');
      avatarContainer.classList.add('is-hidden');
      railItemLogin.classList.remove('is-hidden');
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
    if (panelSwitcher) panelSwitcher.classList.remove('is-hidden');
    renderAccountList();
    renderIcons(panelSwitcher || avatarContainer);
  });

  btnBackToMainMenu?.addEventListener('click', (e) => {
    e.preventDefault();
    if (panelSwitcher) panelSwitcher.classList.add('is-hidden');
    if (panelMain) panelMain.classList.remove('is-hidden');
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

  return () => {
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleKeyDown);
    unsubAuth();
  };
}

export { setupUserMenu };
