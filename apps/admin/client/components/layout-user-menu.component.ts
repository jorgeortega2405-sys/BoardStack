import { currentUser, getActiveApp, logoutApi, onAuthChange, postApi } from '../services/api.service.js';
import { getUserAvatarUrl } from '../utils/avatar.util.js';
import { i18n } from '../i18n/i18n.service.js';
import { setupSheetDragToDismiss } from '../utils/dom.util.js';
import { themeService } from '../services/theme.service.js';

function getRoleLabel(roleSlug: string, fallbackName: string): string {
  const key = `admin.roles.${roleSlug}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : fallbackName;
}

function setupUserMenu(onNavigate: (path: string) => void): () => void {
  const avatarContainer = document.querySelector<HTMLElement>('[data-ref="avatar-container"]');
  if (!avatarContainer) {
    return () => {};
  }

  const avatarBtn = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-avatar"]');
  const avatarImg = avatarContainer.querySelector<HTMLImageElement>('[data-ref="avatar-img"]');
  const avatarBackdrop = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu-backdrop"]');
  const avatarMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu"]');
  const avatarDragZone = avatarMenu?.querySelector<HTMLElement>('[data-ref="avatar-menu-drag-zone"], .component-menu__drag-zone, .modal-card__drag-zone');

  const activeAvatar = avatarContainer.querySelector<HTMLImageElement>('[data-ref="active-account-avatar"]');
  const activeName = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-name"]');
  const activeEmail = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-email"]');
  const activeRole = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-role"]');

  const btnTheme = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-theme"]');
  const themeToggleIcon = avatarContainer.querySelector<SVGUseElement>('[data-ref="theme-toggle-icon"] use');
  const themeToggleLabel = avatarContainer.querySelector<HTMLElement>('[data-ref="theme-toggle-label"]');
  const btnLogout = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout"]');

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

  const updateUI = () => {
    updateThemeButton();
    if (currentUser) {
      avatarContainer.classList.remove('is-hidden');
      const avatarUrl = getUserAvatarUrl(currentUser, 80);

      if (avatarImg && avatarImg.getAttribute('src') !== avatarUrl) {
        avatarImg.src = avatarUrl;
      }
      if (activeAvatar && activeAvatar.getAttribute('src') !== avatarUrl) {
        activeAvatar.src = avatarUrl;
      }
      if (activeName) {
        activeName.textContent = currentUser.username || '';
      }
      if (activeEmail) {
        activeEmail.textContent = currentUser.email || '';
      }

      const activeApp = getActiveApp();
      if (activeRole) {
        if (activeApp) {
          activeRole.textContent = getRoleLabel(activeApp.roleSlug, activeApp.roleName);
          activeRole.classList.remove('is-hidden');
        } else {
          activeRole.textContent = '';
          activeRole.classList.add('is-hidden');
        }
      }
    } else {
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
      updateUI();
    }
  });

  avatarBackdrop?.addEventListener('click', (e) => {
    if (e.target === avatarBackdrop) {
      closeMenu();
    }
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
    await logoutApi();
    onNavigate('/login');
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
