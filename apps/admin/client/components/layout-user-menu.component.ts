import {
  currentUser,
  fetchCurrentUser,
  linkedAccounts,
  logoutAllApi,
  logoutApi,
  onAuthChange,
  postApi,
  switchAccountApi,
} from '../services/api.service.js';
import { getUserAvatarUrl, normalizeSubscriptionTier } from '../utils/avatar.util.js';
import { i18n } from '../i18n/i18n.service.js';
import { setupSheetDragToDismiss } from '../utils/dom.util.js';
import { themeService } from '../services/theme.service.js';
import { toast } from '../services/toast.service.js';

interface UserMenuNavigateOptions {
  force?: boolean;
  showDeniedFeedback?: boolean;
}

function getRoleLabel(roleSlug: string, fallbackName: string): string {
  const key = `admin.roles.${roleSlug}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : fallbackName;
}

function setupUserMenu(
  onNavigate: (path: string, options?: UserMenuNavigateOptions) => void,
  onAccountSessionChange?: () => Promise<void> | void
): () => void {
  const avatarContainer = document.querySelector<HTMLElement>('[data-ref="avatar-container"]');
  if (!avatarContainer) {
    return () => {};
  }

  const avatarBtn = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-avatar"]');
  const avatarImg = avatarContainer.querySelector<HTMLImageElement>('[data-ref="avatar-img"]');
  const avatarBackdrop = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu-backdrop"]');
  const avatarMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu"]');
  const avatarDragZone = avatarMenu?.querySelector<HTMLElement>('[data-ref="avatar-menu-drag-zone"], .component-menu__drag-zone, .modal-card__drag-zone');

  const panelMain = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-main-options"]');
  const panelSwitcher = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-account-switcher"]');

  const btnSwitchAccountMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-switch-account-menu"]');
  const btnBackToMainMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-back-to-main-menu"]');
  const btnAddAccount = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-add-account"]');
  const accountSwitcherList = avatarContainer.querySelector<HTMLElement>('[data-ref="account-switcher-list"]');

  const activeAvatarBox = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-avatar-box"]');
  const activeAvatar = avatarContainer.querySelector<HTMLImageElement>('[data-ref="active-account-avatar"]');
  const activeName = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-name"]');
  const activeEmail = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-email"]');

  const btnTheme = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-theme"]');
  const themeToggleIcon = avatarContainer.querySelector<SVGUseElement>('[data-ref="theme-toggle-icon"] use');
  const themeToggleLabel = avatarContainer.querySelector<HTMLElement>('[data-ref="theme-toggle-label"]');
  const btnLogout = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout"]');
  const btnLogoutAll = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout-all"]');

  let isMenuClosing = false;
  let closeMenuTimer: ReturnType<typeof setTimeout> | null = null;

  const closeMenu = (immediate = false) => {
    if (!avatarMenu || !avatarMenu.classList.contains('is-open')) return;
    if (isMenuClosing && !immediate) return;
    if (closeMenuTimer) {
      clearTimeout(closeMenuTimer);
      closeMenuTimer = null;
    }
    if (immediate) {
      isMenuClosing = false;
      avatarMenu.classList.remove('is-open');
      avatarMenu.style.removeProperty('transform');
      avatarMenu.style.removeProperty('transition');
      avatarMenu.style.removeProperty('opacity');
      if (avatarBackdrop) {
        avatarBackdrop.classList.remove('is-open');
        avatarBackdrop.style.removeProperty('background-color');
        avatarBackdrop.style.removeProperty('opacity');
        avatarBackdrop.style.removeProperty('transition');
      }
      if (panelMain) panelMain.classList.remove('is-hidden');
      if (panelSwitcher) panelSwitcher.classList.add('is-hidden');
      if (document.querySelectorAll('.component-menu-backdrop.is-open, .dropdown-backdrop.is-open, .drawer-backdrop.is-open').length === 0) {
        document.body.classList.remove('dropdown-open');
      }
      return;
    }
    isMenuClosing = true;
    if (window.innerWidth <= 768) {
      avatarMenu.style.setProperty('transition', 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)', 'important');
      avatarMenu.style.setProperty('transform', 'translateY(100%)', 'important');
      if (avatarBackdrop) {
        avatarBackdrop.style.setProperty('transition', 'background-color 0.2s ease', 'important');
        avatarBackdrop.style.setProperty('background-color', 'transparent', 'important');
      }
    } else {
      avatarMenu.style.setProperty('transition', 'opacity 0.18s ease, transform 0.18s ease', 'important');
      avatarMenu.style.setProperty('opacity', '0', 'important');
      avatarMenu.style.setProperty('transform', 'scale(0.96) translateY(-4px)', 'important');
    }
    closeMenuTimer = setTimeout(() => {
      closeMenuTimer = null;
      isMenuClosing = false;
      avatarMenu.classList.remove('is-open');
      avatarMenu.style.removeProperty('transform');
      avatarMenu.style.removeProperty('transition');
      avatarMenu.style.removeProperty('opacity');
      if (avatarBackdrop) {
        avatarBackdrop.classList.remove('is-open');
        avatarBackdrop.style.removeProperty('background-color');
        avatarBackdrop.style.removeProperty('opacity');
        avatarBackdrop.style.removeProperty('transition');
      }
      if (panelMain) panelMain.classList.remove('is-hidden');
      if (panelSwitcher) panelSwitcher.classList.add('is-hidden');
      if (document.querySelectorAll('.component-menu-backdrop.is-open, .dropdown-backdrop.is-open, .drawer-backdrop.is-open').length === 0) {
        document.body.classList.remove('dropdown-open');
      }
    }, 200);
  };

  let avatarDragCleanup: (() => void) | null = null;
  if (avatarDragZone && avatarMenu && avatarBackdrop) {
    avatarDragCleanup = setupSheetDragToDismiss(avatarDragZone, avatarMenu, avatarBackdrop, () => closeMenu());
  }

  const updateThemeButton = () => {
    const resolved = themeService.getResolvedTheme();
    const isDark = resolved === 'dark';
    if (themeToggleIcon) {
      themeToggleIcon.setAttribute('href', isDark ? '/icons.svg#light_mode' : '/icons.svg#dark_mode');
    }
    if (themeToggleLabel) {
      themeToggleLabel.textContent = i18n.t(isDark ? 'admin.menu.theme_light' : 'admin.menu.theme_dark');
    }
  };

  const renderAccountList = () => {
    if (!accountSwitcherList) return;
    accountSwitcherList.innerHTML = '';

    const accounts = linkedAccounts.length > 0 ? linkedAccounts : (currentUser ? [currentUser] : []);

    accounts.forEach((acc) => {
      const isCurrent = Boolean(currentUser && String(currentUser.id) === String(acc.id));
      const accAvatarUrl = getUserAvatarUrl(acc, 80);
      const accTier = normalizeSubscriptionTier(acc.subscription_tier);

      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = `component-menu__item component-menu__item--bordered menu-item menu-item--bordered account-item${isCurrent ? ' account-item--active' : ''}`;
      itemBtn.setAttribute('data-ref', `account-item-${acc.id}`);

      const avatarBox = document.createElement('div');
      avatarBox.className = 'component-avatar component-avatar--sm';
      avatarBox.setAttribute('data-tier', accTier);

      const img = document.createElement('img');
      img.className = 'component-avatar__img';
      img.src = accAvatarUrl;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';

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
          closeMenu(true);
          const res = await switchAccountApi(acc.id);
          if (res.success) {
            if (onAccountSessionChange) {
              await onAccountSessionChange();
            }
            onNavigate(window.location.pathname, { force: true, showDeniedFeedback: false });
          } else {
            toast.error(res.error || i18n.t('admin.auth.switch_account_error'));
            await fetchCurrentUser();
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
    updateThemeButton();
    if (currentUser) {
      avatarContainer.classList.remove('is-hidden');
      const avatarUrl = getUserAvatarUrl(currentUser, 80);

      if (avatarImg) {
        if (avatarImg.getAttribute('src') !== avatarUrl) {
          avatarImg.src = avatarUrl;
        }
        avatarImg.alt = '';
      }
      if (activeAvatar) {
        if (activeAvatar.getAttribute('src') !== avatarUrl) {
          activeAvatar.src = avatarUrl;
        }
        activeAvatar.alt = '';
      }
      if (activeName && activeName.textContent !== (currentUser.username || '')) {
        activeName.textContent = currentUser.username || '';
      }
      if (activeEmail && activeEmail.textContent !== (currentUser.email || '')) {
        activeEmail.textContent = currentUser.email || '';
      }

      const tier = normalizeSubscriptionTier(currentUser.subscription_tier);
      if (avatarBtn && avatarBtn.getAttribute('data-tier') !== tier) {
        avatarBtn.setAttribute('data-tier', tier);
      }
      if (activeAvatarBox && activeAvatarBox.getAttribute('data-tier') !== tier) {
        activeAvatarBox.setAttribute('data-tier', tier);
      }

      renderAccountList();
    } else {
      if (avatarBtn) {
        avatarBtn.removeAttribute('data-tier');
      }
      if (activeAvatarBox) {
        activeAvatarBox.removeAttribute('data-tier');
      }
      avatarContainer.classList.add('is-hidden');
      closeMenu(true);
    }
  };

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
    const isOpen = avatarMenu?.classList.contains('is-open') && !isMenuClosing;
    if (isOpen) {
      closeMenu();
    } else {
      if (closeMenuTimer) {
        clearTimeout(closeMenuTimer);
        closeMenuTimer = null;
      }
      isMenuClosing = false;
      if (avatarMenu) {
        avatarMenu.style.removeProperty('transform');
        avatarMenu.style.removeProperty('transition');
        avatarMenu.style.removeProperty('opacity');
        avatarMenu.classList.add('is-open');
      }
      if (avatarBackdrop) {
        avatarBackdrop.style.removeProperty('background-color');
        avatarBackdrop.style.removeProperty('opacity');
        avatarBackdrop.style.removeProperty('transition');
        avatarBackdrop.classList.add('is-open');
      }
      document.body.classList.add('dropdown-open');
      if (panelMain) panelMain.classList.remove('is-hidden');
      if (panelSwitcher) panelSwitcher.classList.add('is-hidden');
      updateUI();
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
  });

  btnBackToMainMenu?.addEventListener('click', (e) => {
    e.preventDefault();
    if (panelSwitcher) panelSwitcher.classList.add('is-hidden');
    if (panelMain) panelMain.classList.remove('is-hidden');
  });

  btnAddAccount?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu(true);
    if (linkedAccounts.length >= 3) {
      toast.info(i18n.t('nav.max_accounts_reached'));
      return;
    }
    onNavigate('/login');
  });

  btnTheme?.addEventListener('click', async (e) => {
    e.preventDefault();
    const currentResolved = themeService.getResolvedTheme();
    const nextTheme = currentResolved === 'dark' ? 'light' : 'dark';
    themeService.setTheme(nextTheme);
    updateThemeButton();
    try {
      await postApi('/api/settings/preferences', { theme: nextTheme });
    } catch {}
  });

  btnLogout?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeMenu(true);
    const res = await logoutApi();
    if (res.success) {
      if (res.switched && res.user) {
        if (onAccountSessionChange) {
          await onAccountSessionChange();
        }
        onNavigate(window.location.pathname, { force: true, showDeniedFeedback: false });
      } else {
        onNavigate('/login', { force: true, showDeniedFeedback: false });
      }
    } else {
      toast.error(i18n.t('common.error'));
    }
  });

  btnLogoutAll?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeMenu(true);
    const res = await logoutAllApi();
    if (res.success) {
      onNavigate('/login', { force: true, showDeniedFeedback: false });
    } else {
      toast.error(i18n.t('common.error'));
    }
  });

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeyDown);

  const unsubAuth = onAuthChange(() => {
    updateUI();
  });

  const unsubTheme = themeService.onThemeChange(() => {
    updateThemeButton();
  });

  updateUI();

  return () => {
    if (avatarDragCleanup) {
      avatarDragCleanup();
    }
    document.body.classList.remove('dropdown-open');
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleKeyDown);
    unsubAuth();
    unsubTheme();
  };
}

export {
  getRoleLabel,
  setupUserMenu
};

export type {
  UserMenuNavigateOptions
};
