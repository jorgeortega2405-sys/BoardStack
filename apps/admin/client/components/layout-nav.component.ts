import type { AccessibleAdminApp, AdminPageSummary } from '../types/admin.types.js';
import {
  accessibleApps,
  currentUser,
  fetchCurrentUser,
  getActiveApp,
  getApi,
  setActiveAppSlug,
} from '../services/api.service.js';
import { createAdminPageView } from '../views/admin-page.view.js';
import { createLoginView } from '../views/auth.view.js';
import { type DropdownController, escapeHtml, setupDropdown, setupSheetDragToDismiss } from '../utils/dom.util.js';
import { finishNavigationProgress, startNavigationProgress } from '../services/navigation-progress.service.js';
import { getRoleLabel, setupUserMenu } from './layout-user-menu.component.js';
import { i18n, t } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { themeService } from '../services/theme.service.js';
import { toast } from '../services/toast.service.js';

interface ResolvedPanelRoute {
  app: AccessibleAdminApp | null;
  isAuth: boolean;
  page: AdminPageSummary | null;
  path: string;
}

class LayoutNavController {
  private activeAuthViewEl: HTMLElement | null = null;
  private activeViewCleanup: (() => void) | null = null;
  private appDropdownController: DropdownController | null = null;
  private appLayoutEl: HTMLElement | null = null;
  private collapseBtn: HTMLElement | null = null;
  private currentPath = '';
  private drawerBodyEl: HTMLElement | null = null;
  private drawerCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private drawerEl: HTMLElement | null = null;
  private drawerFooterEl: HTMLElement | null = null;
  private hasUserCollapsedDesktopDrawer = false;
  private isDrawerClosing = false;
  private isDrawerOpen = false;
  private loadingPath = '';
  private mainWrapper: HTMLElement | null = null;
  private navigationSeq = 0;
  private railPagesEl: HTMLElement | null = null;
  private sidebarEl: HTMLElement | null = null;
  private toggleBtn: HTMLElement | null = null;
  private viewContainerEl: HTMLElement | null = null;

  public async init(): Promise<void> {
    i18n.init();
    themeService.init();

    this.appLayoutEl = document.querySelector<HTMLElement>('[data-ref="app-layout"]');
    this.sidebarEl = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
    this.railPagesEl = document.querySelector<HTMLElement>('[data-ref="rail-center-pages"]');
    this.drawerEl = document.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
    this.drawerBodyEl = document.querySelector<HTMLElement>('[data-ref="drawer-body"]');
    this.drawerFooterEl = document.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
    this.toggleBtn = document.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]');
    this.collapseBtn = document.querySelector<HTMLElement>('[data-ref="btn-drawer-collapse"]');
    this.mainWrapper = document.querySelector<HTMLElement>('[data-ref="main-wrapper"]');
    this.viewContainerEl = document.querySelector<HTMLElement>('[data-ref="view-container"]');

    setupUserMenu((path) => this.navigate(path));
    this.bindEvents();

    try {
      await fetchCurrentUser();
      if (currentUser) {
        const prefRes = await getApi<{ ok?: boolean; preferences?: { language?: string; theme?: string } }>('/api/settings/preferences');
        if (prefRes.ok && prefRes.preferences) {
          if (prefRes.preferences.theme) {
            themeService.setTheme(prefRes.preferences.theme as any);
          }
          if (prefRes.preferences.language) {
            i18n.setLanguage(prefRes.preferences.language, false);
          }
        }
      }
    } catch {}

    void this.navigate(window.location.pathname, false);

    i18n.onLanguageChange(() => {
      const resolved = this.resolveTargetRoute(this.currentPath, false);
      if (resolved.app && resolved.page) {
        this.renderRailPages(resolved.app, resolved.page.slug);
        this.renderDrawerContent(resolved.app, resolved.page.slug);
      }
      this.updateSeoMeta(resolved);
      i18n.translateDocument(this.appLayoutEl || document.body);
    });

    i18n.translateDocument(this.appLayoutEl || document.body);
  }

  private resolveTargetRoute(rawCleanPath: string, showDeniedFeedback = true): ResolvedPanelRoute {
    const clean = (rawCleanPath || '/').replace(/\/+$/, '') || '/';

    if (!currentUser || accessibleApps.length === 0) {
      if (currentUser && accessibleApps.length === 0 && showDeniedFeedback && clean !== '/login') {
        toast.error(i18n.t('admin.access.no_apps'));
      }
      return {
        app: null,
        isAuth: true,
        page: null,
        path: '/login',
      };
    }

    const defaultApp = getActiveApp() || accessibleApps[0];
    const defaultPage = defaultApp.pages[0];

    if (clean === '/' || clean === '/login') {
      return {
        app: defaultApp,
        isAuth: false,
        page: defaultPage,
        path: `/${defaultApp.slug}/${defaultPage.slug}`,
      };
    }

    const segments = clean.replace(/^\/+/, '').split('/');
    const appSlug = segments[0]?.toLowerCase() || '';
    const pageSlug = segments[1]?.toLowerCase() || '';

    const matchedApp = accessibleApps.find((a) => a.slug.toLowerCase() === appSlug);
    if (!matchedApp) {
      if (showDeniedFeedback) {
        toast.warning(i18n.t('admin.access.page_denied'));
      }
      return {
        app: defaultApp,
        isAuth: false,
        page: defaultPage,
        path: `/${defaultApp.slug}/${defaultPage.slug}`,
      };
    }

    const matchedPage = pageSlug
      ? matchedApp.pages.find((p) => p.slug.toLowerCase() === pageSlug)
      : matchedApp.pages[0];

    if (!matchedPage) {
      if (showDeniedFeedback) {
        toast.warning(i18n.t('admin.access.page_denied'));
      }
      const fallbackPage = matchedApp.pages[0];
      return {
        app: matchedApp,
        isAuth: false,
        page: fallbackPage,
        path: `/${matchedApp.slug}/${fallbackPage.slug}`,
      };
    }

    return {
      app: matchedApp,
      isAuth: false,
      page: matchedPage,
      path: `/${matchedApp.slug}/${matchedPage.slug}`,
    };
  }

  private clearActiveView(): void {
    if (this.activeViewCleanup) {
      try {
        this.activeViewCleanup();
      } catch {}
      this.activeViewCleanup = null;
    }
    if (this.viewContainerEl) {
      this.viewContainerEl.innerHTML = '';
    }
  }

  private clearAuthViews(): void {
    if (this.activeAuthViewEl) {
      this.activeAuthViewEl.remove();
      this.activeAuthViewEl = null;
    }
    this.appLayoutEl?.querySelectorAll('.component-container--auth').forEach((el) => el.remove());
  }

  private bindEvents(): void {
    const drawerDragZone = this.drawerEl?.querySelector<HTMLElement>('[data-ref="drawer-drag-zone"]');
    const drawerBackdrop = document.querySelector<HTMLElement>('[data-ref="drawer-backdrop"]');

    if (drawerDragZone && this.drawerEl && drawerBackdrop) {
      setupSheetDragToDismiss(drawerDragZone, this.drawerEl, drawerBackdrop, () => this.setDrawerOpen(false));
    }

    drawerBackdrop?.addEventListener('click', (e: MouseEvent) => {
      if (e.target === drawerBackdrop) {
        this.setDrawerOpen(false);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && (drawerBackdrop?.classList.contains('is-open') || this.isDrawerClosing)) {
        if (this.drawerCloseTimer) {
          clearTimeout(this.drawerCloseTimer);
          this.drawerCloseTimer = null;
        }
        this.isDrawerClosing = false;
        this.drawerEl?.style.removeProperty('transform');
        this.drawerEl?.style.removeProperty('transition');
        this.drawerEl?.style.removeProperty('opacity');
        drawerBackdrop?.classList.remove('is-open');
        drawerBackdrop?.style.removeProperty('background-color');
        drawerBackdrop?.style.removeProperty('opacity');
        drawerBackdrop?.style.removeProperty('transition');
        if (document.querySelectorAll('.component-menu-backdrop.is-open, .dropdown-backdrop.is-open').length === 0) {
          document.body.classList.remove('dropdown-open');
        }
      }
    });

    this.toggleBtn?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      const nextState = !this.isDrawerOpen;
      if (window.innerWidth > 768) {
        this.hasUserCollapsedDesktopDrawer = !nextState;
      }
      this.setDrawerOpen(nextState);
    });

    this.collapseBtn?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      if (window.innerWidth > 768) {
        this.hasUserCollapsedDesktopDrawer = true;
      }
      this.setDrawerOpen(false);
    });

    this.mainWrapper?.addEventListener('click', () => {
      if (window.innerWidth <= 768 && this.isDrawerOpen) {
        this.setDrawerOpen(false);
      }
    });

    window.addEventListener('popstate', () => {
      void this.navigate(window.location.pathname, false);
    });

    document.addEventListener('click', (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        e.preventDefault();
        void this.navigate(href);
      }
    });
  }

  public async navigate(path: string, updateHistory = true): Promise<void> {
    const [rawPath, rawSearch] = (path || '/').split('?');
    const { lang: urlLang, cleanPath: strippedPath } = i18n.stripLanguage(rawPath);

    if (urlLang && urlLang !== i18n.getLanguage()) {
      i18n.setLanguage(urlLang, false);
    }

    const targetRoute = this.resolveTargetRoute(strippedPath, true);
    const localizedTarget = i18n.localizePath(targetRoute.path, i18n.getLanguage());
    const fullTarget = rawSearch ? `${localizedTarget}?${rawSearch}` : localizedTarget;
    const currentFullTarget = window.location.pathname + window.location.search;

    const isCurrentViewMounted = Boolean(
      (targetRoute.isAuth && this.activeAuthViewEl) ||
      (!targetRoute.isAuth && this.viewContainerEl && this.viewContainerEl.children.length > 0)
    );

    const isSameViewActive = this.loadingPath === targetRoute.path || (
      this.loadingPath === '' &&
      this.currentPath === targetRoute.path &&
      isCurrentViewMounted
    );

    if (isSameViewActive) {
      if (updateHistory && currentFullTarget !== fullTarget) {
        window.history.pushState({}, '', fullTarget);
      }
      if (window.innerWidth <= 768 && this.isDrawerOpen) {
        this.setDrawerOpen(false);
      }
      return;
    }

    const navId = ++this.navigationSeq;
    this.loadingPath = targetRoute.path;
    startNavigationProgress(this.mainWrapper);

    try {
      if (updateHistory || currentFullTarget !== fullTarget) {
        if (updateHistory) {
          window.history.pushState({}, '', fullTarget);
        } else {
          window.history.replaceState({}, '', fullTarget);
        }
      }
      this.currentPath = targetRoute.path;
      this.updateSeoMeta(targetRoute);

      if (targetRoute.isAuth || !targetRoute.app || !targetRoute.page) {
        document.documentElement.classList.add('is-auth-view');
        this.sidebarEl?.classList.add('is-hidden');
        this.mainWrapper?.classList.add('is-hidden');
        this.setDrawerOpen(false);
        this.clearAuthViews();

        const authView = await createLoginView((p) => this.navigate(p));
        if (navId !== this.navigationSeq) {
          return;
        }

        this.clearAuthViews();
        this.clearActiveView();

        if (this.appLayoutEl) {
          this.activeAuthViewEl = authView;
          this.appLayoutEl.appendChild(authView);
        }
        return;
      }

      document.documentElement.classList.remove('is-auth-view');
      this.clearAuthViews();
      this.sidebarEl?.classList.remove('is-hidden');
      this.mainWrapper?.classList.remove('is-hidden');

      setActiveAppSlug(targetRoute.app.slug, true);
      this.renderRailPages(targetRoute.app, targetRoute.page.slug);
      this.renderDrawerContent(targetRoute.app, targetRoute.page.slug);

      if (window.innerWidth > 768) {
        this.setDrawerOpen(!this.hasUserCollapsedDesktopDrawer);
      } else {
        this.setDrawerOpen(false);
      }

      const dotsBackdropEl = document.querySelector<HTMLElement>('[data-ref="view-backdrop-dots"]');
      dotsBackdropEl?.classList.remove('is-hidden');

      if (this.viewContainerEl) {
        this.clearActiveView();
        const nextView = await createAdminPageView(
          targetRoute.app,
          targetRoute.page,
          async () => {
            await fetchCurrentUser();
            toast.warning(i18n.t('admin.access.page_denied'));
            await this.navigate('/', false);
          }
        );

        if (navId !== this.navigationSeq) {
          nextView?.cleanup?.();
          return;
        }

        this.clearActiveView();
        if (nextView) {
          this.activeViewCleanup = nextView.cleanup || null;
          this.viewContainerEl.appendChild(nextView);
        }
      }
    } finally {
      if (navId === this.navigationSeq) {
        this.loadingPath = '';
        finishNavigationProgress(this.mainWrapper);
      }
    }
  }

  public setDrawerOpen(open: boolean): void {
    const drawerBackdrop = document.querySelector<HTMLElement>('[data-ref="drawer-backdrop"]');

    if (open) {
      if (this.drawerCloseTimer) {
        clearTimeout(this.drawerCloseTimer);
        this.drawerCloseTimer = null;
      }
      this.isDrawerClosing = false;
      this.isDrawerOpen = true;

      if (this.drawerEl) {
        this.drawerEl.style.removeProperty('transform');
        this.drawerEl.style.removeProperty('transition');
        this.drawerEl.style.removeProperty('opacity');
        this.drawerEl.classList.add('is-open');
      }
      if (window.innerWidth <= 768 && drawerBackdrop) {
        drawerBackdrop.style.removeProperty('background-color');
        drawerBackdrop.style.removeProperty('opacity');
        drawerBackdrop.style.removeProperty('transition');
        drawerBackdrop.classList.add('is-open');
        document.body.classList.add('dropdown-open');
      }
      this.toggleBtn?.classList.add('is-active');
      return;
    }

    this.isDrawerOpen = false;
    this.toggleBtn?.classList.remove('is-active');

    if (!this.drawerEl) return;

    const finalizeDrawerClose = () => {
      this.drawerCloseTimer = null;
      this.isDrawerClosing = false;
      this.drawerEl?.classList.remove('is-open');
      this.drawerEl?.style.removeProperty('transform');
      this.drawerEl?.style.removeProperty('transition');
      this.drawerEl?.style.removeProperty('opacity');
      if (drawerBackdrop) {
        drawerBackdrop.classList.remove('is-open');
        drawerBackdrop.style.removeProperty('background-color');
        drawerBackdrop.style.removeProperty('opacity');
        drawerBackdrop.style.removeProperty('transition');
      }
      if (document.querySelectorAll('.component-menu-backdrop.is-open, .dropdown-backdrop.is-open, .drawer-backdrop.is-open').length === 0) {
        document.body.classList.remove('dropdown-open');
      }
    };

    if (window.innerWidth <= 768 && (this.drawerEl.classList.contains('is-open') || drawerBackdrop?.classList.contains('is-open'))) {
      if (this.isDrawerClosing) return;
      if (this.drawerCloseTimer) {
        clearTimeout(this.drawerCloseTimer);
        this.drawerCloseTimer = null;
      }
      this.isDrawerClosing = true;
      this.drawerEl.style.setProperty('transition', 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)', 'important');
      this.drawerEl.style.setProperty('transform', 'translateY(100%)', 'important');
      if (drawerBackdrop) {
        drawerBackdrop.style.setProperty('transition', 'background-color 0.2s ease', 'important');
        drawerBackdrop.style.setProperty('background-color', 'transparent', 'important');
      }
      this.drawerCloseTimer = setTimeout(finalizeDrawerClose, 200);
    } else {
      if (this.drawerCloseTimer) {
        clearTimeout(this.drawerCloseTimer);
        this.drawerCloseTimer = null;
      }
      finalizeDrawerClose();
    }
  }

  private renderRailPages(app: AccessibleAdminApp, activePageSlug: string): void {
    if (!this.railPagesEl) return;
    let html = '';
    for (const page of app.pages) {
      const isActive = page.slug === activePageSlug;
      const title = i18n.t(page.titleKey);
      const targetUrl = `/${app.slug}/${page.slug}`;
      html += `
        <div class="component-rail__item${isActive ? ' is-active' : ''}" data-ref="rail-item-${escapeHtml(page.slug)}" data-rail-id="${escapeHtml(page.slug)}">
          <button type="button" class="component-button component-button--h40 component-button--icon-only component-rail__btn" data-ref="btn-rail-${escapeHtml(page.slug)}" data-route="${escapeHtml(targetUrl)}" data-tooltip="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${escapeHtml(page.icon)}"></use></svg>
          </button>
          <span class="component-rail__label">${escapeHtml(title)}</span>
        </div>
      `;
    }
    this.railPagesEl.innerHTML = html;
    this.railPagesEl.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((btn) => {
      btn.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        const target = btn.getAttribute('data-route');
        if (target) {
          void this.navigate(target);
        }
      });
    });
  }

  private renderDrawerContent(app: AccessibleAdminApp, activePageSlug: string): void {
    if (!this.drawerBodyEl) return;

    this.appDropdownController?.destroy();
    this.appDropdownController = null;

    let appOptionsHtml = '';
    for (const item of accessibleApps) {
      const isCurrentApp = item.slug === app.slug;
      appOptionsHtml += `
        <button type="button" class="component-menu__item menu-item${isCurrentApp ? ' is-active' : ''}" data-ref="option-app-${escapeHtml(item.slug)}" data-value="${escapeHtml(item.slug)}">
          <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#${escapeHtml(item.icon)}"></use></svg>
          <span class="component-menu__item-text menu-item__text">${escapeHtml(item.name)}</span>
        </button>
      `;
    }

    let pagesHtml = '';
    for (const page of app.pages) {
      const isAct = page.slug === activePageSlug;
      const pageTitle = i18n.t(page.titleKey);
      const targetUrl = `/${app.slug}/${page.slug}`;
      pagesHtml += `
        <button type="button" class="component-menu__item menu-item${isAct ? ' is-active' : ''}" data-ref="btn-nav-${escapeHtml(page.slug)}" data-route="${escapeHtml(targetUrl)}">
          <div class="component-menu__item-icon tool-item__mini-icon">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${escapeHtml(page.icon)}"></use></svg>
          </div>
          <span class="component-menu__item-text menu-item__text">${escapeHtml(pageTitle)}</span>
        </button>
      `;
    }

    this.drawerBodyEl.innerHTML = `
      <div class="component-drawer__group" data-ref="drawer-apps-group">
        <div class="component-drawer__title">${escapeHtml(t('drawer.app_switcher'))}</div>
        <div class="component-dropdown dropdown-wrapper" data-ref="dropdown-wrapper-admin-app">
          <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="btn-trigger-admin-app" aria-label="${escapeHtml(t('drawer.app_switcher'))}">
            <div class="component-dropdown__trigger-left dropdown-trigger__left">
              <svg class="component-icon component-dropdown__trigger-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#${escapeHtml(app.icon)}"></use></svg>
              <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="admin-app-selected-text">${escapeHtml(app.name)}</span>
            </div>
            <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>
          <div class="component-menu-backdrop dropdown-backdrop" data-ref="dropdown-backdrop-admin-app">
            <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-admin-app">
              <div class="component-menu__list menu-panel__list" data-ref="admin-app-options-list">
                ${appOptionsHtml}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="component-drawer__group" data-ref="drawer-pages-group">
        <div class="component-drawer__title">${escapeHtml(t('drawer.pages'))}</div>
        ${pagesHtml}
      </div>
    `;

    if (this.drawerFooterEl) {
      const roleLabel = getRoleLabel(app.roleSlug, app.roleName);
      this.drawerFooterEl.innerHTML = `
        <div class="component-drawer__group" data-ref="drawer-role-footer">
          <div class="component-menu__header menu-panel__header" data-ref="drawer-role-row">
            <span class="component-drawer__title" style="padding: 0;">${escapeHtml(t('drawer.active_role'))}</span>
            <span class="component-badge component-badge--sm component-badge--neutral" data-ref="drawer-role-badge">${escapeHtml(roleLabel)}</span>
          </div>
        </div>
      `;
      this.drawerFooterEl.classList.remove('is-hidden');
    }

    if (this.drawerEl) {
      renderIcons(this.drawerEl);
      const appDropdownEl = this.drawerEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-admin-app"]');
      this.appDropdownController = setupDropdown(appDropdownEl, {
        onSelect: (selectedAppSlug) => {
          const nextApp = accessibleApps.find((a) => a.slug === selectedAppSlug);
          if (nextApp && nextApp.pages.length > 0 && nextApp.slug !== app.slug) {
            setActiveAppSlug(nextApp.slug, true);
            void this.navigate(`/${nextApp.slug}/${nextApp.pages[0].slug}`);
          }
        },
      });

      this.drawerEl.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((btn) => {
        btn.addEventListener('click', (e: MouseEvent) => {
          e.preventDefault();
          const target = btn.getAttribute('data-route');
          if (target) {
            if (window.innerWidth <= 768) {
              this.setDrawerOpen(false);
            }
            void this.navigate(target);
          }
        });
      });
    }
  }

  private updateSeoMeta(targetRoute: ResolvedPanelRoute): void {
    const titlePart = targetRoute.isAuth
      ? t('seo.login_title')
      : (targetRoute.page ? t(targetRoute.page.titleKey) : t('seo.panel_title'));

    document.title = `${titlePart} - ${t('seo.title_suffix')}`;
    document.documentElement.lang = i18n.getLanguage();

    if (typeof window === 'undefined') return;

    const localizedPath = i18n.localizePath(targetRoute.path, i18n.getLanguage());
    const canonicalUrl = `${window.location.origin}${localizedPath}`;

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const desc = targetRoute.isAuth ? t('seo.login_description') : t('seo.panel_description');
    const metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = desc;
    }
  }
}

const layoutNav = new LayoutNavController();

export {
  LayoutNavController,
  layoutNav
};

export type {
  ResolvedPanelRoute
};
