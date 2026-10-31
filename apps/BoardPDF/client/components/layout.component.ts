import { getLocalizedPath, resolveRouteFromSlug } from '../config/seo.config.js';
import { TOOLS_REGISTRY } from '../config/tools.registry.js';
import { escapeHtml } from '../services/api.service.js';
import { getCurrentLanguage, t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { loadTemplate } from '../services/template.service.js';
import { getWorkflows } from '../services/workflow-storage.service.js';
import { hideElement, showElement } from '../utils/dom.util.js';
import { isSupportedLanguage } from '../utils/languages.util.js';
import { setupUserMenu } from './layout-user-menu.component.js';

export let isDrawerOpen = false;
export let currentDrawerMode: 'apps' | 'help' | 'settings' | 'workflows' = 'workflows';
let activeResizeObserver: ResizeObserver | null = null;
let activeMutationObserver: MutationObserver | null = null;
let drawerRemovalTimer: ReturnType<typeof setTimeout> | null = null;
let sidebarInitPromise: Promise<HTMLElement> | null = null;
let sidebarInstance: HTMLElement | null = null;

function getActiveHelpSection(raw: string): 'faq' | 'security' | 'privacy' | 'terms' | 'cookies' | null {
  const clean = (raw || '').split('?')[0].split('#')[0].toLowerCase().replace(/^\/[a-z]{2,3}(?:-[a-z]{2,4})?(?=\/|$)/i, '').replace(/^\/+|\/+$/g, '');
  if (!clean) return null;

  if (clean === 'help-faq' || clean === 'help/faq' || clean === 'faq' || clean === 'preguntas-frecuentes') {
    return 'faq';
  }
  if (clean === 'help-security' || clean === 'help/security' || clean === 'security' || clean === 'security-policy' || clean === 'seguridad' || clean === 'help') {
    return 'security';
  }
  if (clean === 'help-privacy' || clean === 'help/privacy' || clean === 'privacy' || clean === 'privacy-policy' || clean === 'privacidad') {
    return 'privacy';
  }
  if (clean === 'help-terms' || clean === 'help/terms' || clean === 'terms' || clean === 'terms-and-conditions' || clean === 'terminos') {
    return 'terms';
  }
  if (clean === 'help-cookies' || clean === 'help/cookies' || clean === 'cookies' || clean === 'cookie-policy') {
    return 'cookies';
  }

  const resolved = resolveRouteFromSlug(clean);
  if (resolved) {
    if (resolved.routeId === 'help-faq') return 'faq';
    if (resolved.routeId === 'help-security' || resolved.routeId === 'help') return 'security';
    if (resolved.routeId === 'help-privacy') return 'privacy';
    if (resolved.routeId === 'help-terms') return 'terms';
    if (resolved.routeId === 'help-cookies') return 'cookies';
  }

  return null;
}

export function hasDesignatedMenuItems(pathname: string): boolean {
  if (!pathname) return false;
  return getActiveHelpSection(pathname) !== null || pathname.includes('/workflows') || pathname.includes('/workflow/') || pathname.startsWith('/settings');
}

export function updateSidebarAuthState(_sidebar?: HTMLElement): void {}

export function updateSidebarActiveState(sidebar: HTMLElement, path = window.location.pathname): void {
  const cleanPath = (path || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const isHome = cleanPath === '/' || cleanPath === '' || (/^\/([a-z]{2,3})\/?$/i.test(cleanPath) && isSupportedLanguage(cleanPath.slice(1)));
  const isHelp = getActiveHelpSection(cleanPath) !== null;
  const isWorkflows = cleanPath.includes('/workflows') || cleanPath.includes('/workflow/');
  const isSettings = cleanPath.startsWith('/settings');
  const isAuth = cleanPath.startsWith('/login') || cleanPath.startsWith('/register') || cleanPath === '/forgot-password' || cleanPath === '/reset-password';

  const itemHome = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-home"]');
  const btnHome = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-home"]');
  const itemApps = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-apps"]');
  const btnApps = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-apps"]');
  const btnToggle = sidebar.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]');
  const railItemHelp = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-help"]');
  const btnRailHelp = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-help"]');
  const itemLogin = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-login"]');
  const btnRailLogin = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-login"]');

  itemHome?.classList.toggle('is-active', isHome && !isDrawerOpen);
  btnHome?.classList.toggle('is-active', isHome && !isDrawerOpen);
  itemApps?.classList.toggle('is-active', isDrawerOpen && currentDrawerMode === 'apps');
  btnApps?.classList.toggle('is-active', isDrawerOpen && currentDrawerMode === 'apps');
  btnToggle?.classList.toggle('is-active', (isDrawerOpen && currentDrawerMode === 'workflows') || (!isDrawerOpen && isWorkflows));
  railItemHelp?.classList.toggle('is-active', (isHelp && !isDrawerOpen) || (isDrawerOpen && currentDrawerMode === 'help'));
  btnRailHelp?.classList.toggle('is-active', (isHelp && !isDrawerOpen) || (isDrawerOpen && currentDrawerMode === 'help'));
  itemLogin?.classList.toggle('is-active', isAuth && !isDrawerOpen);
  btnRailLogin?.classList.toggle('is-active', isAuth && !isDrawerOpen);

  if (isDrawerOpen) {
    if (isSettings && currentDrawerMode !== 'settings') {
      currentDrawerMode = 'settings';
    } else if (isHelp && currentDrawerMode !== 'help') {
      currentDrawerMode = 'help';
    } else if (isWorkflows && currentDrawerMode !== 'workflows') {
      currentDrawerMode = 'workflows';
    }
    void updateDynamicDrawer(sidebar, cleanPath);
  }
}

function setupRailNavigation(sidebar: HTMLElement): void {
  const itemHome = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-home"]');
  const btnHome = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-home"]');
  const itemApps = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-apps"]');
  const btnApps = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-apps"]');
  const itemHelp = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-help"]');
  const btnRailHelp = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-help"]');
  const itemLogin = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-login"]');
  const btnRailLogin = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-login"]');

  const goHome = (e: Event) => {
    e.preventDefault();
    if (isDrawerOpen) {
      toggleDrawer(false);
    }
    navigate('/');
  };

  btnHome?.addEventListener('click', goHome);
  itemHome?.addEventListener('click', (e) => {
    if (e.target !== btnHome && !btnHome?.contains(e.target as Node)) {
      goHome(e);
    }
  });

  const toggleApps = (e: Event) => {
    e.preventDefault();
    if (isDrawerOpen && currentDrawerMode === 'apps') {
      toggleDrawer(false);
    } else {
      toggleDrawer(true, 'apps');
    }
  };

  btnApps?.addEventListener('click', toggleApps);
  itemApps?.addEventListener('click', (e) => {
    if (e.target !== btnApps && !btnApps?.contains(e.target as Node)) {
      toggleApps(e);
    }
  });

  const toggleHelp = (e: Event) => {
    e.preventDefault();
    if (isDrawerOpen && currentDrawerMode === 'help') {
      toggleDrawer(false);
    } else {
      toggleDrawer(true, 'help');
    }
  };

  btnRailHelp?.addEventListener('click', toggleHelp);
  itemHelp?.addEventListener('click', (e) => {
    if (e.target !== btnRailHelp && !btnRailHelp?.contains(e.target as Node)) {
      toggleHelp(e);
    }
  });

  const goLogin = (e: Event) => {
    e.preventDefault();
    if (isDrawerOpen) {
      toggleDrawer(false);
    }
    navigate('/login');
  };

  btnRailLogin?.addEventListener('click', goLogin);
  itemLogin?.addEventListener('click', (e) => {
    if (e.target !== btnRailLogin && !btnRailLogin?.contains(e.target as Node)) {
      goLogin(e);
    }
  });
}

function createDrawerElement(): HTMLElement {
  const drawer = document.createElement('div');
  drawer.className = 'layout-drawer';
  drawer.setAttribute('data-ref', 'layout-drawer');

  const drawerBody = document.createElement('div');
  drawerBody.className = 'layout-drawer__body';
  drawerBody.setAttribute('data-ref', 'drawer-body');
  drawer.appendChild(drawerBody);

  const drawerFooter = document.createElement('div');
  drawerFooter.className = 'layout-drawer__footer';
  drawerFooter.setAttribute('data-ref', 'drawer-footer');
  hideElement(drawerFooter);
  drawer.appendChild(drawerFooter);

  return drawer;
}

export async function populateDrawerContent(drawer: HTMLElement, activePath?: string): Promise<void> {
  const drawerBody = drawer.querySelector<HTMLElement>('[data-ref="drawer-body"]');
  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (!drawerBody) return;

  if (drawerFooter) {
    drawerFooter.innerHTML = '';
    hideElement(drawerFooter);
  }

  if (currentDrawerMode === 'settings') {
    renderSettingsDrawerContent(drawerBody, drawerFooter, activePath);
  } else if (currentDrawerMode === 'help') {
    renderHelpDrawerContent(drawerBody, drawerFooter, activePath);
  } else if (currentDrawerMode === 'apps') {
    renderAppsDrawerContent(drawerBody);
  } else {
    renderWorkflowsDrawerContent(drawerBody, drawerFooter, activePath);
  }

  renderIcons(drawerBody);
}

function renderWorkflowsDrawerContent(drawerBody: HTMLElement, drawerFooter: HTMLElement | null, activePath?: string): void {
  const rawPath = activePath || window.location.pathname;
  const currentPath = (rawPath || '').split('?')[0].split('#')[0].replace(/^\/[a-z]{2,3}(?:-[a-z]{2,4})?(?=\/|$)/i, '') || '/';

  const bindNavLink = (btn: HTMLElement | null, path: string) => {
    btn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      navigate(path);
    });
  };

  const workflows = getWorkflows();

  if (workflows.length === 0) {
    drawerBody.innerHTML = `
      <div class="drawer-section__header" data-ref="drawer-workflows-header" style="padding: 8px 8px 4px 8px;">
        <span class="drawer-section__title" data-ref="drawer-workflows-title" data-i18n="nav.workflows" style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${t('nav.workflows', 'Flujos de trabajo')}</span>
      </div>
      <div class="drawer-empty-state" data-ref="drawer-empty-workflows" style="padding: 32px 16px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
        <svg class="component-icon" style="width: 36px; height: 36px; color: var(--text-tertiary); opacity: 0.6;" aria-hidden="true"><use href="/icons.svg#account_tree"></use></svg>
        <span style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">${t('workflows.empty_title', 'No tienes flujos de trabajo')}</span>
        <span style="font-size: 12px; color: var(--text-tertiary);">${t('workflows.empty_subtitle', 'Crea combinaciones de herramientas automáticas')}</span>
      </div>
    `;
  } else {
    let html = `
      <div class="drawer-section__header" data-ref="drawer-workflows-header" style="padding: 8px 8px 4px 8px;">
        <span class="drawer-section__title" data-ref="drawer-workflows-title" data-i18n="nav.workflows" style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${t('nav.workflows', 'Flujos de trabajo')}</span>
      </div>
    `;
    for (const wf of workflows) {
      const isActive = currentPath === `/workflow/${wf.id}`;
      const escapedName = escapeHtml(wf.name);
      html += `
        <button type="button" class="menu-item ${isActive ? 'is-active' : ''}" data-ref="btn-nav-wf-${wf.id}" data-wf-id="${wf.id}" title="${escapedName}">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#account_tree"></use></svg>
          <span class="menu-item__text" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapedName}</span>
        </button>
      `;
    }
    drawerBody.innerHTML = html;

    workflows.forEach((wf) => {
      const btn = drawerBody.querySelector<HTMLElement>(`[data-ref="btn-nav-wf-${wf.id}"]`);
      bindNavLink(btn, `/workflow/${wf.id}`);
    });
  }

  if (drawerFooter) {
    drawerFooter.innerHTML = `
      <button type="button" class="menu-item menu-item--bordered" data-ref="btn-nav-create-workflow">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        <span class="menu-item__text" data-i18n="workflows.create_title">${t('workflows.create_title', 'Crear flujo de trabajo')}</span>
      </button>
    `;
    showElement(drawerFooter);
    translateElement(drawerFooter);
    bindNavLink(drawerFooter.querySelector('[data-ref="btn-nav-create-workflow"]'), '/workflows?new=1');
    renderIcons(drawerFooter);
  }

  translateElement(drawerBody);
}

function renderHelpDrawerContent(drawerBody: HTMLElement, drawerFooter: HTMLElement | null, activePath?: string): void {
  const currentLang = getCurrentLanguage();
  const currentPath = activePath || window.location.pathname;

  const bindNavLink = (btn: HTMLElement | null, routeId: string, fallbackPath: string) => {
    btn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      navigate(getLocalizedPath(routeId, currentLang) || fallbackPath);
    });
  };

  drawerBody.innerHTML = `
    <div class="drawer-section__header" data-ref="drawer-help-header" style="padding: 8px 8px 4px 8px;">
      <span class="drawer-section__title" data-ref="drawer-help-title" data-i18n="nav.help" style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${t('nav.help', 'Ayuda')}</span>
    </div>
    <button type="button" class="menu-item" data-ref="btn-nav-help-security">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#shield"></use></svg>
      <span class="menu-item__text" data-i18n="help.nav_security">${t('help.nav_security', 'Política de seguridad')}</span>
    </button>
    <button type="button" class="menu-item" data-ref="btn-nav-help-privacy">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
      <span class="menu-item__text" data-i18n="help.nav_privacy">${t('help.nav_privacy', 'Política de privacidad')}</span>
    </button>
    <button type="button" class="menu-item" data-ref="btn-nav-help-terms">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#gavel"></use></svg>
      <span class="menu-item__text" data-i18n="help.nav_terms">${t('help.nav_terms', 'Términos y condiciones')}</span>
    </button>
    <button type="button" class="menu-item" data-ref="btn-nav-help-cookies">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#cookie"></use></svg>
      <span class="menu-item__text" data-i18n="help.nav_cookies">${t('help.nav_cookies', 'Política de cookies')}</span>
    </button>
  `;

  translateElement(drawerBody);

  const btnSecurity = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-help-security"]');
  const btnPrivacy = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-help-privacy"]');
  const btnTerms = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-help-terms"]');
  const btnCookies = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-help-cookies"]');

  const activeSection = getActiveHelpSection(currentPath);

  btnSecurity?.classList.toggle('is-active', activeSection === 'security');
  btnPrivacy?.classList.toggle('is-active', activeSection === 'privacy');
  btnTerms?.classList.toggle('is-active', activeSection === 'terms');
  btnCookies?.classList.toggle('is-active', activeSection === 'cookies');

  bindNavLink(btnSecurity, 'help-security', '/help/security');
  bindNavLink(btnPrivacy, 'help-privacy', '/help/privacy');
  bindNavLink(btnTerms, 'help-terms', '/help/terms');
  bindNavLink(btnCookies, 'help-cookies', '/help/cookies');

  if (drawerFooter) {
    drawerFooter.innerHTML = `
      <button type="button" class="menu-item ${activeSection === 'faq' ? 'is-active' : ''}" data-ref="btn-nav-help-faq" data-nav="faq">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#help"></use></svg>
        <span class="menu-item__text" data-i18n="help.nav_faq">${t('help.nav_faq', t('nav.faq', 'Preguntas frecuentes'))}</span>
      </button>
    `;
    showElement(drawerFooter);
    translateElement(drawerFooter);
    bindNavLink(drawerFooter.querySelector<HTMLElement>('[data-ref="btn-nav-help-faq"]'), 'help-faq', '/help/faq');
    renderIcons(drawerFooter);
  }
}

function renderSettingsDrawerContent(drawerBody: HTMLElement, drawerFooter: HTMLElement | null, activePath?: string): void {
  const currentPath = activePath || window.location.pathname;

  const bindNavLink = (btn: HTMLElement | null, path: string) => {
    btn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      navigate(path);
    });
  };

  drawerBody.innerHTML = `
    <div class="drawer-section__header" data-ref="drawer-settings-header" style="padding: 8px 8px 4px 8px;">
      <span class="drawer-section__title" data-ref="drawer-settings-title" data-i18n="nav.settings" style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${t('nav.settings', 'Configuración')}</span>
    </div>
    <button type="button" class="menu-item" data-ref="btn-nav-settings-account">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
      <span class="menu-item__text" data-i18n="nav.your_account">${t('nav.your_account', 'Tu cuenta')}</span>
    </button>
    <button type="button" class="menu-item" data-ref="btn-nav-settings-security">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
      <span class="menu-item__text" data-i18n="nav.security">${t('nav.security', 'Seguridad')}</span>
    </button>
    <button type="button" class="menu-item" data-ref="btn-nav-settings-billing">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#credit_card"></use></svg>
      <span class="menu-item__text" data-i18n="nav.billing">${t('nav.billing', 'Facturación')}</span>
    </button>
    <button type="button" class="menu-item" data-ref="btn-nav-settings-purchases">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#receipt_long"></use></svg>
      <span class="menu-item__text" data-i18n="nav.purchases">${t('nav.purchases', 'Historial de compras')}</span>
    </button>
  `;

  translateElement(drawerBody);

  const btnAccount = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-account"]');
  const btnSecurity = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-security"]');
  const btnBilling = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-billing"]');
  const btnPurchases = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-purchases"]');

  if (currentPath === '/settings' || currentPath === '/settings/your-account') {
    btnAccount?.classList.add('is-active');
  } else if (currentPath === '/settings/security') {
    btnSecurity?.classList.add('is-active');
  } else if (currentPath === '/settings/billing') {
    btnBilling?.classList.add('is-active');
  } else if (currentPath === '/settings/purchases' || currentPath === '/settings/purchase-history') {
    btnPurchases?.classList.add('is-active');
  }

  bindNavLink(btnAccount, '/settings/your-account');
  bindNavLink(btnSecurity, '/settings/security');
  bindNavLink(btnBilling, '/settings/billing');
  bindNavLink(btnPurchases, '/settings/purchases');

  if (drawerFooter) {
    drawerFooter.innerHTML = '';
    hideElement(drawerFooter);
  }

  renderIcons(drawerBody);
}

function renderAppsDrawerContent(drawerBody: HTMLElement): void {
  const categoriesConfig = [
    { id: 'organize', name: t('home.cat_organize') || 'Ordenar PDF' },
    { id: 'optimize', name: t('home.cat_optimize') || 'Optimizar PDF' },
    { id: 'convert-to-pdf', name: t('home.cat_convert_to_pdf') || 'Convertir a PDF' },
    { id: 'convert-from-pdf', name: t('home.cat_convert_from_pdf') || t('home.cat_convert') || 'Convertir desde PDF' },
    { id: 'edit', name: t('home.cat_edit') || 'Editar PDF' },
    { id: 'security', name: t('home.cat_security') || 'Seguridad de PDF' },
    { id: 'pdf-intelligence', name: t('home.cat_pdf_intelligence') || 'PDF Intelligence' },
  ];

  let html = `
    <div class="drawer-tools-list" data-ref="drawer-tools-list" style="display: flex; flex-direction: column; gap: 2px;">
  `;

  for (const cat of categoriesConfig) {
    const tools = TOOLS_REGISTRY.filter((item) => item.category === cat.id);
    if (tools.length === 0) continue;

    html += `
      <div class="drawer-category-group" data-ref="group-${cat.id}" style="margin-bottom: 8px;">
        <div class="drawer-category-title" data-ref="title-${cat.id}" style="padding: 10px 8px 4px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);">
          ${cat.name}
        </div>
    `;

    const currentLang = getCurrentLanguage();
    for (const tool of tools) {
      const toolName = t(tool.nameKey);
      const toolDesc = t(tool.descKey);
      const searchHaystack = `${toolName} ${toolDesc} ${cat.name}`.toLowerCase();
      const toolPath = getLocalizedPath(tool.id, currentLang);

      html += `
        <button type="button" class="menu-item drawer-tool-item" data-ref="drawer-tool-${tool.id}" data-tool-path="${toolPath}" data-search="${searchHaystack}">
          <span class="menu-item__icon tool-item__mini-icon">
            ${tool.customSvg || `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${tool.icon}"></use></svg>`}
          </span>
          <span class="menu-item__text" style="font-size: 13px; font-weight: 500;">${toolName}</span>
        </button>
      `;
    }

    html += `</div>`;
  }

  html += `</div>`;
  drawerBody.innerHTML = html;

  const toolButtons = drawerBody.querySelectorAll<HTMLButtonElement>('.drawer-tool-item');
  toolButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const path = btn.getAttribute('data-tool-path');
      if (path) {
        if (window.innerWidth <= 1024) {
          toggleDrawer(false);
        }
        navigate(path);
      }
    });
  });
}

async function openDynamicDrawer(sidebar: HTMLElement, activePath?: string): Promise<void> {
  let drawer = sidebar.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
  if (!drawer) {
    drawer = createDrawerElement();
    sidebar.appendChild(drawer);
  }
  await populateDrawerContent(drawer, activePath);
  drawer.classList.add('is-open');
}

function closeDynamicDrawer(): void {
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const drawer = sidebar?.querySelector<HTMLElement>('[data-ref="layout-drawer"]');

  if (sidebar) {
    updateSidebarActiveState(sidebar);
  }

  if (drawer) {
    drawer.classList.remove('is-open');
    if (drawerRemovalTimer) {
      clearTimeout(drawerRemovalTimer);
    }
    drawerRemovalTimer = setTimeout(() => {
      drawer?.remove();
      drawerRemovalTimer = null;
    }, 280);
  }
}

export function toggleDrawer(forceState?: boolean, mode?: 'apps' | 'help' | 'settings' | 'workflows'): void {
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const currentPath = window.location.pathname;
  const cleanPath = (currentPath || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const isWorkflows = cleanPath.includes('/workflows') || cleanPath.includes('/workflow/');
  const isSettings = cleanPath.startsWith('/settings');
  const isHelp = getActiveHelpSection(cleanPath) !== null;
  const targetMode = mode || (isSettings ? 'settings' : (isHelp ? 'help' : (isWorkflows ? 'workflows' : 'workflows')));

  if (forceState === undefined) {
    if (isDrawerOpen && currentDrawerMode === targetMode) {
      isDrawerOpen = false;
    } else {
      isDrawerOpen = true;
      currentDrawerMode = targetMode;
    }
  } else {
    isDrawerOpen = forceState;
    if (mode) {
      currentDrawerMode = mode;
    } else if (forceState) {
      currentDrawerMode = targetMode;
    }
  }

  if (sidebar) {
    updateSidebarActiveState(sidebar, cleanPath);
  }

  if (isDrawerOpen) {
    if (drawerRemovalTimer) {
      clearTimeout(drawerRemovalTimer);
      drawerRemovalTimer = null;
    }
    if (sidebar) {
      void openDynamicDrawer(sidebar, cleanPath);
    }
  } else {
    closeDynamicDrawer();
  }
}

export async function updateDynamicDrawer(sidebar?: HTMLElement, activePath?: string): Promise<void> {
  const sb = sidebar || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!sb) return;
  const drawer = sb.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
  if (drawer && isDrawerOpen) {
    await populateDrawerContent(drawer, activePath);
  }
}

function setupDrawerContent(sidebar: HTMLElement): void {
  const btnToggle = sidebar.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]');
  btnToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    if (isDrawerOpen) {
      toggleDrawer(false);
    } else {
      const currentPath = window.location.pathname;
      const mode = currentPath.startsWith('/settings')
        ? 'settings'
        : getActiveHelpSection(currentPath) !== null
          ? 'help'
          : 'workflows';
      toggleDrawer(true, mode);
    }

  });

  isDrawerOpen = false;
  btnToggle?.classList.remove('is-active');
  const existingDrawer = sidebar.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
  existingDrawer?.remove();
}

export async function createSidebar(): Promise<HTMLElement> {
  if (sidebarInstance) {
    updateSidebarActiveState(sidebarInstance, window.location.pathname);
    return sidebarInstance;
  }
  if (sidebarInitPromise) {
    return sidebarInitPromise;
  }

  sidebarInitPromise = (async () => {
    const sidebar = await loadTemplate('/views/components/sidebar.html');
    translateElement(sidebar);
    setupRailNavigation(sidebar);
    setupDrawerContent(sidebar);
    setupUserMenu(sidebar);
    updateSidebarActiveState(sidebar, window.location.pathname);
    renderIcons(sidebar);
    sidebarInstance = sidebar;

    window.addEventListener('workflow:changed', () => {
      if (sidebarInstance && isDrawerOpen && currentDrawerMode === 'workflows') {
        void updateDynamicDrawer(sidebarInstance);
      }
    });

    return sidebar;
  })();

  return sidebarInitPromise;
}

export async function ensureSidebarMounted(layoutContent: HTMLElement): Promise<HTMLElement> {
  const sidebar = await createSidebar();
  if (sidebar.parentElement !== layoutContent) {
    layoutContent.prepend(sidebar);
  }
  return sidebar;
}

export function setupLayoutScrollSync(): void {
  const layoutContent = document.querySelector<HTMLElement>('.layout-content:has(.layout-nav)');
  if (activeResizeObserver) {
    activeResizeObserver.disconnect();
    activeResizeObserver = null;
  }
  if (activeMutationObserver) {
    activeMutationObserver.disconnect();
    activeMutationObserver = null;
  }
  if (!layoutContent) return;

  const scrollableBody = layoutContent.querySelector<HTMLElement>(
    '.view-scrollable, .home-scrollable, .layout-body--scrollable, .layout-scrollable'
  );
  if (!scrollableBody) {
    layoutContent.style.removeProperty('--layout-scroll-height');
    return;
  }

  const updateScrollHeight = () => {
    const maxScroll = Math.max(0, Math.ceil(scrollableBody.scrollHeight - scrollableBody.clientHeight));
    if (maxScroll <= 0) {
      layoutContent.style.removeProperty('--layout-scroll-height');
      return;
    }
    const neededHeight = layoutContent.clientHeight + maxScroll;
    layoutContent.style.setProperty('--layout-scroll-height', `${neededHeight}px`);
  };

  updateScrollHeight();

  activeResizeObserver = new ResizeObserver(() => {
    updateScrollHeight();
  });

  activeResizeObserver.observe(scrollableBody);
  activeResizeObserver.observe(layoutContent);
  for (const child of scrollableBody.children) {
    activeResizeObserver.observe(child);
  }

  activeMutationObserver = new MutationObserver(() => {
    updateScrollHeight();
  });
  activeMutationObserver.observe(scrollableBody, {
    attributeFilter: ['class', 'style', 'hidden'],
    attributes: true,
    childList: true,
    subtree: true,
  });
}
