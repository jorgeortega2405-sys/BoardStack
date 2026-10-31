import { currentUser, linkedAccounts, logoutAllApi, logoutApi, onAuthChange, switchAccountApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { showToast } from '../services/toast.service.js';
import { applyAvatarTier } from '../utils/tier.util.js';

export function setupUserMenu(sidebar: HTMLElement): () => void {
  const avatarContainer = sidebar.querySelector<HTMLElement>('[data-ref="avatar-container"]');
  const railItemLogin = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-login"]');
  const btnLogin = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-login"]');

  if (!avatarContainer || !railItemLogin) {
    return () => {};
  }

  const avatarBtn = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-avatar"]');
  const avatarImg = avatarContainer.querySelector<HTMLImageElement>('[data-ref="avatar-img"]');
  const avatarBackdrop = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu-backdrop"]');
  const avatarMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu"]');

  const panelMain = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-main-options"]');
  const panelSwitcher = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-account-switcher"]');
  const btnSwitchAccountMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-switch-account-menu"]');
  const btnBackToMainMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-back-to-main-menu"]');
  const btnAddAccount = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-add-account"]');
  const btnSettings = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-settings"]');
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
    if (panelMain) panelMain.style.display = '';
    if (panelSwitcher) panelSwitcher.style.display = 'none';
  };

  const renderAccountList = () => {
    if (!accountSwitcherList) return;
    accountSwitcherList.innerHTML = '';

    const accounts = linkedAccounts.length > 0 ? linkedAccounts : (currentUser ? [currentUser] : []);

    accounts.forEach((acc) => {
      const isCurrent = currentUser && String(currentUser.id) === String(acc.id);
      const accAvatarUrl = acc.avatar_url || `/api/avatar?name=${encodeURIComponent(acc.username)}&size=80`;

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
      img.alt = acc.username;

      avatarBox.appendChild(img);

      const infoBox = document.createElement('div');
      infoBox.className = 'account-item__info';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'account-item__name';
      nameSpan.textContent = acc.username;

      const emailSpan = document.createElement('span');
      emailSpan.className = 'account-item__email';
      emailSpan.textContent = acc.email;

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
            showToast(`Cuenta cambiada a ${acc.username}`, 'info');
            navigate(window.location.pathname);
          } else {
            showToast(res.error || 'No se pudo cambiar de cuenta', 'danger');
          }
        });
      }

      accountSwitcherList.appendChild(itemBtn);
    });

    if (btnAddAccount) {
      if (accounts.length >= 3) {
        btnAddAccount.style.display = 'none';
      } else {
        btnAddAccount.style.display = 'flex';
      }
    }
  };

  const updateUI = () => {
    if (currentUser) {
      railItemLogin.style.display = 'none';
      avatarContainer.style.display = 'inline-flex';

      const avatarUrl = currentUser.avatar_url || `/api/avatar?name=${encodeURIComponent(currentUser.username)}&size=80`;
      const tier = currentUser.subscription_tier || 'free';

      applyAvatarTier(avatarBtn, tier);
      applyAvatarTier(activeAvatarBox, tier);

      if (avatarImg) {
        avatarImg.src = avatarUrl;
        avatarImg.alt = currentUser.username;
      }
      if (activeAvatar) {
        activeAvatar.src = avatarUrl;
        activeAvatar.alt = currentUser.username;
      }
      if (activeName) {
        activeName.textContent = currentUser.username;
      }
      if (activeEmail) {
        activeEmail.textContent = currentUser.email;
      }
      renderAccountList();
    } else {
      avatarContainer.style.display = 'none';
      railItemLogin.style.display = '';
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
      if (panelMain) panelMain.style.display = '';
      if (panelSwitcher) panelSwitcher.style.display = 'none';
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
    if (panelMain) panelMain.style.display = 'none';
    if (panelSwitcher) panelSwitcher.style.display = 'flex';
    renderAccountList();
    renderIcons(panelSwitcher || avatarContainer);
  });

  btnBackToMainMenu?.addEventListener('click', (e) => {
    e.preventDefault();
    if (panelSwitcher) panelSwitcher.style.display = 'none';
    if (panelMain) panelMain.style.display = '';
  });

  btnAddAccount?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    if (linkedAccounts.length >= 3) {
      showToast('Máximo de 3 cuentas alcanzado.', 'info');
      return;
    }
    navigate('/login');
  });

  btnSettings?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    navigate('/settings/your-account');
  });

  btnLogout?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeMenu();
    const res = await logoutApi();
    if (res.success) {
      if (res.switched && res.user) {
        showToast(`Has cambiado a la cuenta de ${res.user.username}`, 'info');
        navigate(window.location.pathname);
      } else {
        showToast('Sesión cerrada exitosamente.', 'info');
        navigate('/login');
      }
    }
  });

  btnLogoutAll?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeMenu();
    await logoutAllApi();
    showToast('Se han cerrado todas las sesiones.', 'info');
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
