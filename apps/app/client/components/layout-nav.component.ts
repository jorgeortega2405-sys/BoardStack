import { createCheckoutView } from '../views/checkout.view.js';
import { createForgotPasswordView, createLoginView, createRegisterView, createResetPasswordView } from '../views/auth.view.js';
import { createHelpView, HelpSection } from '../views/help.view.js';
import { createHomeView } from '../views/home.view.js';
import { createPricingView } from '../views/pricing.view.js';
import {
  createSettingsAccessibilityView,
  createSettingsAccountView,
  createSettingsBillingView,
  createSettingsGuestView,
  createSettingsPurchasesView,
  createSettingsSecurityView,
} from '../views/settings.view.js';
import { currentUser, fetchCurrentUser, getApi } from '../services/api.service.js';
import { finishNavigationProgress, startNavigationProgress } from '../services/navigation-progress.service.js';
import { i18n, t } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { setupSheetDragToDismiss } from '../utils/dom.util.js';
import { setupUserMenu } from './layout-user-menu.component.js';
import { themeService } from '../services/theme.service.js';

interface RouteConfig {
  path: string;
  railId: 'help' | 'home' | 'login' | 'settings';
  title: string;
}

const ROUTES: Record<string, RouteConfig> = {
  '/': { path: '/', railId: 'home', title: 'Inicio' },
  '/account': { path: '/account', railId: 'login', title: 'Cuenta' },
  '/checkout': { path: '/checkout', railId: 'home', title: 'Checkout' },
  '/forgot-password': { path: '/forgot-password', railId: 'login', title: 'Recuperar contraseña' },
  '/help': { path: '/help', railId: 'help', title: 'Términos y condiciones' },
  '/help/cookies': { path: '/help/cookies', railId: 'help', title: 'Política de cookies' },
  '/help/privacy': { path: '/help/privacy', railId: 'help', title: 'Política de privacidad' },
  '/help/security': { path: '/help/security', railId: 'help', title: 'Política de seguridad' },
  '/help/terms': { path: '/help/terms', railId: 'help', title: 'Términos y condiciones' },
  '/login': { path: '/login', railId: 'login', title: 'Iniciar sesión' },
  '/pricing': { path: '/pricing', railId: 'home', title: 'Planes y Precios' },
  '/register': { path: '/register', railId: 'login', title: 'Crear una cuenta' },
  '/reset-password': { path: '/reset-password', railId: 'login', title: 'Restablecer contraseña' },
  '/settings': { path: '/settings/account', railId: 'login', title: 'Tu cuenta' },
  '/settings/accessibility': { path: '/settings/accessibility', railId: 'login', title: 'Accesibilidad' },
  '/settings/account': { path: '/settings/account', railId: 'login', title: 'Tu cuenta' },
  '/settings/billing': { path: '/settings/billing', railId: 'login', title: 'Facturación' },
  '/settings/guest': { path: '/settings/guest', railId: 'settings', title: 'Configuración' },
  '/settings/purchases': { path: '/settings/purchases', railId: 'login', title: 'Historial de compras' },
  '/settings/security': { path: '/settings/security', railId: 'login', title: 'Seguridad' },
};

class LayoutNavController {
  private activeAuthViewEl: HTMLElement | null = null;
  private appLayoutEl: HTMLElement | null = null;
  private collapseBtn: HTMLElement | null = null;
  private currentDrawerMode: 'general' | 'help' | 'settings' = 'general';
  private currentPath: string = '';
  private drawerBodyEl: HTMLElement | null = null;
  private drawerCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private drawerEl: HTMLElement | null = null;
  private drawerFooterEl: HTMLElement | null = null;
  private isDrawerClosing = false;
  private isDrawerOpen = false;
  private loadingPath: string = '';
  private mainWrapper: HTMLElement | null = null;
  private navigationSeq = 0;
  private sidebarEl: HTMLElement | null = null;
  private toggleBtn: HTMLElement | null = null;
  private viewContainerEl: HTMLElement | null = null;

  public async init(): Promise<void> {
    i18n.init();
    themeService.init();

    this.appLayoutEl = document.querySelector<HTMLElement>('[data-ref="app-layout"]');
    this.sidebarEl = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
    this.drawerEl = document.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
    this.drawerBodyEl = document.querySelector<HTMLElement>('[data-ref="drawer-body"]');
    this.drawerFooterEl = document.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
    this.toggleBtn = document.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]');
    this.collapseBtn = document.querySelector<HTMLElement>('[data-ref="btn-drawer-collapse"]');
    this.mainWrapper = document.querySelector<HTMLElement>('[data-ref="main-wrapper"]');
    this.viewContainerEl = document.querySelector<HTMLElement>('[data-ref="view-container"]');

    setupUserMenu((path) => this.navigate(path));
    this.bindEvents();

    void this.navigate(window.location.pathname, false);

    try {
      await fetchCurrentUser();
      if (currentUser) {
        const prefRes = await getApi<{ ok?: boolean; preferences?: { theme?: string; language?: string } }>('/api/settings/preferences');
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

    i18n.onLanguageChange(() => {
      this.renderDrawerContent();
      const currentRoute = this.resolveRoute(this.currentPath);
      this.updateSeoMeta(currentRoute);
      i18n.translateDocument(this.appLayoutEl || document.body);
    });

    i18n.translateDocument(this.appLayoutEl || document.body);
  }

  private resolveRoute(rawPath: string): RouteConfig {
    const { cleanPath } = i18n.stripLanguage(rawPath);
    const clean = (cleanPath || '/').replace(/\/+$/, '') || '/';
    return ROUTES[clean] || ROUTES['/'];
  }

  private isAuthRoute(path: string): boolean {
    return path === '/login' || path === '/register' || path === '/forgot-password' || path === '/reset-password';
  }

  private clearAuthViews(): void {
    if (this.activeAuthViewEl) {
      this.activeAuthViewEl.remove();
      this.activeAuthViewEl = null;
    }
    this.appLayoutEl?.querySelectorAll('.component-container--auth, [data-ref="auth-layout"]').forEach((el) => el.remove());
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
        if (document.querySelectorAll('.component-menu-backdrop.is-open, .dropdown-backdrop.is-open, .modal-backdrop.is-open').length === 0) {
          document.body.classList.remove('dropdown-open');
        }
      }
    });

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        this.toggleDrawer();
      });
    }

    if (this.collapseBtn) {
      this.collapseBtn.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        this.setDrawerOpen(false);
      });
    }

    if (this.mainWrapper) {
      this.mainWrapper.addEventListener('click', () => {
        if (window.innerWidth <= 768 && this.isDrawerOpen) {
          this.setDrawerOpen(false);
        }
      });
    }

    const railHome = document.querySelector<HTMLElement>('[data-ref="rail-item-home"]');
    const railHelp = document.querySelector<HTMLElement>('[data-ref="rail-item-help"]');
    const railSettings = document.querySelector<HTMLElement>('[data-ref="rail-item-settings"]');
    const railLogin = document.querySelector<HTMLElement>('[data-ref="rail-item-login"]');

    railHome?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      this.currentDrawerMode = 'general';
      this.setDrawerOpen(false);
      void this.navigate('/');
    });

    railHelp?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      this.currentDrawerMode = 'help';
      this.setDrawerOpen(true);
      if (!this.currentPath.startsWith('/help')) {
        void this.navigate('/help/terms');
      }
    });

    railSettings?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      this.currentDrawerMode = 'settings';
      this.setDrawerOpen(true);
      if (!this.currentPath.startsWith('/settings')) {
        void this.navigate('/settings/guest');
      }
    });

    railLogin?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      if (window.innerWidth <= 768 && this.isDrawerOpen) {
        this.setDrawerOpen(false);
      }
      void this.navigate('/login');
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

    let cleanPath = (strippedPath || '/').replace(/\/+$/, '') || '/';
    if (cleanPath === '/settings') {
      cleanPath = currentUser ? '/settings/account' : '/settings/guest';
    }

    if (cleanPath.startsWith('/settings/') && cleanPath !== '/settings/guest' && !currentUser) {
      cleanPath = '/login';
    }

    if (cleanPath === '/checkout' && !currentUser) {
      cleanPath = '/login';
    }

    const targetRoute = this.resolveRoute(cleanPath);

    const localizedTarget = i18n.localizePath(targetRoute.path, i18n.getLanguage());
    const fullTarget = rawSearch ? `${localizedTarget}?${rawSearch}` : localizedTarget;
    const currentFullTarget = window.location.pathname + window.location.search;

    const isCurrentViewMounted = Boolean(
      (this.isAuthRoute(targetRoute.path) && this.activeAuthViewEl) ||
      (!this.isAuthRoute(targetRoute.path) && this.viewContainerEl && this.viewContainerEl.children.length > 0)
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
      if (updateHistory && currentFullTarget !== fullTarget) {
        window.history.pushState({}, '', fullTarget);
      }
      this.currentPath = targetRoute.path;

      if (this.currentPath.startsWith('/help')) {
        this.currentDrawerMode = 'help';
      } else if (this.currentPath.startsWith('/settings')) {
        this.currentDrawerMode = 'settings';
      } else {
        this.currentDrawerMode = 'general';
      }

      if (this.currentDrawerMode === 'general') {
        this.setDrawerOpen(false);
      } else if (window.innerWidth > 768) {
        this.setDrawerOpen(true);
      } else if (this.isDrawerOpen) {
        this.setDrawerOpen(false);
      }

      this.updateSeoMeta(targetRoute);

      if (this.isAuthRoute(targetRoute.path)) {
        document.documentElement.classList.add('is-auth-view');
        if (this.sidebarEl) this.sidebarEl.classList.add('is-hidden');
        if (this.mainWrapper) this.mainWrapper.classList.add('is-hidden');

        this.clearAuthViews();

        let authView: HTMLElement | null = null;
        if (targetRoute.path === '/login') {
          authView = await createLoginView((p) => this.navigate(p));
        } else if (targetRoute.path === '/register') {
          authView = await createRegisterView((p) => this.navigate(p));
        } else if (targetRoute.path === '/forgot-password') {
          authView = await createForgotPasswordView((p) => this.navigate(p));
        } else if (targetRoute.path === '/reset-password') {
          authView = await createResetPasswordView((p) => this.navigate(p));
        }

        if (navId !== this.navigationSeq) {
          return;
        }

        this.clearAuthViews();
        if (this.viewContainerEl) {
          this.viewContainerEl.innerHTML = '';
        }

        if (authView && this.appLayoutEl) {
          this.activeAuthViewEl = authView;
          this.appLayoutEl.appendChild(authView);
        }
      } else {
        document.documentElement.classList.remove('is-auth-view');
        this.clearAuthViews();

        if (this.sidebarEl) this.sidebarEl.classList.remove('is-hidden');
        if (this.mainWrapper) this.mainWrapper.classList.remove('is-hidden');

        this.updateRailActiveState(targetRoute.railId);
        this.renderDrawerContent();

        if (this.viewContainerEl) {
          this.viewContainerEl.innerHTML = '';
          let nextView: HTMLElement | null = null;
          if (targetRoute.path === '/') {
            nextView = await createHomeView((p) => this.navigate(p));
          } else if (targetRoute.path.startsWith('/settings')) {
            if (targetRoute.path === '/settings/account') {
              nextView = await createSettingsAccountView((p) => this.navigate(p));
            } else if (targetRoute.path === '/settings/security') {
              nextView = await createSettingsSecurityView((p) => this.navigate(p));
            } else if (targetRoute.path === '/settings/accessibility') {
              nextView = await createSettingsAccessibilityView((p) => this.navigate(p));
            } else if (targetRoute.path === '/settings/billing') {
              nextView = await createSettingsBillingView((p) => this.navigate(p));
            } else if (targetRoute.path === '/settings/purchases') {
              nextView = await createSettingsPurchasesView((p) => this.navigate(p));
            } else if (targetRoute.path === '/settings/guest') {
              nextView = await createSettingsGuestView((p) => this.navigate(p));
            }
          } else if (targetRoute.path === '/pricing') {
            nextView = await createPricingView((p) => this.navigate(p));
          } else if (targetRoute.path === '/checkout') {
            nextView = await createCheckoutView((p) => this.navigate(p));
          } else if (targetRoute.path.startsWith('/help')) {
            let section: HelpSection = 'terms';
            if (targetRoute.path === '/help/privacy') {
              section = 'privacy';
            } else if (targetRoute.path === '/help/cookies') {
              section = 'cookies';
            } else if (targetRoute.path === '/help/security') {
              section = 'security';
            }
            nextView = await createHelpView(section, (p) => this.navigate(p));
          }

          if (navId !== this.navigationSeq) {
            return;
          }

          this.viewContainerEl.innerHTML = '';
          if (nextView) {
            this.viewContainerEl.appendChild(nextView);
          }
        }
      }
    } finally {
      if (navId === this.navigationSeq) {
        this.loadingPath = '';
        finishNavigationProgress(this.mainWrapper);
      }
    }
  }

  private updateRailActiveState(activeId: 'help' | 'home' | 'login' | 'settings'): void {
    const railItems = document.querySelectorAll<HTMLElement>('.component-rail__item');
    railItems.forEach((item) => {
      const id = item.getAttribute('data-rail-id');
      if (id === activeId) {
        item.classList.add('is-active');
      } else {
        item.classList.remove('is-active');
      }
    });
  }

  public toggleDrawer(): void {
    if (this.currentDrawerMode === 'general') {
      this.setDrawerOpen(false);
      return;
    }
    this.setDrawerOpen(!this.isDrawerOpen);
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
        this.renderDrawerContent();
        this.drawerEl.classList.add('is-open');
      }
      if (window.innerWidth <= 768) {
        if (drawerBackdrop) {
          drawerBackdrop.style.removeProperty('background-color');
          drawerBackdrop.style.removeProperty('opacity');
          drawerBackdrop.style.removeProperty('transition');
          drawerBackdrop.classList.add('is-open');
        }
        document.body.classList.add('dropdown-open');
      }
      if (this.toggleBtn) {
        this.toggleBtn.classList.add('is-active');
      }
      return;
    }

    this.isDrawerOpen = false;
    if (this.toggleBtn) {
      this.toggleBtn.classList.remove('is-active');
    }

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
      if (document.querySelectorAll('.component-menu-backdrop.is-open, .dropdown-backdrop.is-open, .drawer-backdrop.is-open, .modal-backdrop.is-open').length === 0) {
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

  private renderDrawerNavButton(params: { href: string; icon: string; isActive: boolean; name: string; ref: string }): string {
    return `
      <button type="button" class="component-menu__item menu-item${params.isActive ? ' is-active' : ''}" data-ref="${params.ref}" data-route="${params.href}">
        <div class="component-menu__item-icon tool-item__mini-icon">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${params.icon}"></use></svg>
        </div>
        <span class="component-menu__item-text menu-item__text">${params.name}</span>
      </button>
    `;
  }

  private renderDrawerContent(): void {
    if (!this.drawerBodyEl) return;

    if (this.currentDrawerMode === 'settings') {
      if (currentUser) {
        let bodyHtml = `<div class="component-drawer__group" data-ref="drawer-settings-group">`;
        bodyHtml += `<div class="component-drawer__title">${t('drawer.general_settings')}</div>`;

        const settingsPages = [
          { href: '/settings/account', icon: 'person', name: t('drawer.account') },
          { href: '/settings/security', icon: 'lock', name: t('drawer.security') },
          { href: '/settings/accessibility', icon: 'tune', name: t('drawer.accessibility') },
        ];

        for (const p of settingsPages) {
          bodyHtml += this.renderDrawerNavButton({
            href: p.href,
            icon: p.icon,
            isActive: this.currentPath === p.href,
            name: p.name,
            ref: `btn-nav-${p.icon}`,
          });
        }
        bodyHtml += `</div>`;
        this.drawerBodyEl.innerHTML = bodyHtml;

        if (this.drawerFooterEl) {
          let footerHtml = `<div class="component-drawer__group" data-ref="drawer-settings-footer-group">`;
          const footerPages = [
            { href: '/settings/billing', icon: 'credit_card', name: t('drawer.billing') },
            { href: '/settings/purchases', icon: 'receipt_long', name: t('drawer.purchases') },
          ];

          for (const fp of footerPages) {
            footerHtml += this.renderDrawerNavButton({
              href: fp.href,
              icon: fp.icon,
              isActive: this.currentPath === fp.href,
              name: fp.name,
              ref: `btn-nav-${fp.icon}`,
            });
          }
          footerHtml += `</div>`;
          this.drawerFooterEl.innerHTML = footerHtml;
          this.drawerFooterEl.classList.remove('is-hidden');
        }
      } else {
        let bodyHtml = `<div class="component-drawer__group" data-ref="drawer-settings-guest-group">`;
        bodyHtml += `<div class="component-drawer__title">${t('drawer.guest')}</div>`;
        bodyHtml += this.renderDrawerNavButton({
          href: '/settings/guest',
          icon: 'tune',
          isActive: true,
          name: t('drawer.settings'),
          ref: 'btn-nav-guest',
        });
        bodyHtml += this.renderDrawerNavButton({
          href: '/login',
          icon: 'login',
          isActive: false,
          name: t('drawer.login'),
          ref: 'btn-nav-guest-login',
        });
        bodyHtml += `</div>`;
        this.drawerBodyEl.innerHTML = bodyHtml;

        if (this.drawerFooterEl) {
          this.drawerFooterEl.innerHTML = '';
          this.drawerFooterEl.classList.add('is-hidden');
        }
      }
    } else if (this.currentDrawerMode === 'help' || this.currentPath.startsWith('/help')) {
      if (this.drawerFooterEl) {
        this.drawerFooterEl.innerHTML = '';
        this.drawerFooterEl.classList.add('is-hidden');
      }

      const helpPages = [
        { href: '/help/terms', icon: 'gavel', name: t('drawer.terms') },
        { href: '/help/privacy', icon: 'lock', name: t('drawer.privacy') },
        { href: '/help/cookies', icon: 'cookie', name: t('drawer.cookies') },
        { href: '/help/security', icon: 'shield', name: t('drawer.security_policy') },
      ];

      let html = `<div class="component-drawer__group" data-ref="drawer-help-group">`;
      html += `<div class="component-drawer__title">${t('drawer.legal_policies')}</div>`;

      for (const p of helpPages) {
        const isActive = this.currentPath === p.href || (p.href === '/help/terms' && this.currentPath === '/help');
        html += this.renderDrawerNavButton({
          href: p.href,
          icon: p.icon,
          isActive,
          name: p.name,
          ref: `btn-nav-${p.icon}`,
        });
      }
      html += `</div>`;
      this.drawerBodyEl.innerHTML = html;
    } else {
      if (this.drawerFooterEl) {
        this.drawerFooterEl.innerHTML = '';
        this.drawerFooterEl.classList.add('is-hidden');
      }

      let html = `<div class="component-drawer__group" data-ref="drawer-main-group">`;
      html += `<div class="component-drawer__title">${t('drawer.navigation')}</div>`;
      html += this.renderDrawerNavButton({
        href: '/',
        icon: 'home',
        isActive: this.currentPath === '/',
        name: t('drawer.home'),
        ref: 'btn-nav-home',
      });
      html += `</div>`;
      this.drawerBodyEl.innerHTML = html;
    }

    if (this.drawerEl) {
      renderIcons(this.drawerEl);
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

  private updateSeoMeta(targetRoute: RouteConfig): void {
    const localizedTitle = this.getLocalizedTitle(targetRoute.path);
    document.title = `${localizedTitle} - ${t('seo.title_suffix')}`;
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

    let altEs = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="es"]');
    if (!altEs) {
      altEs = document.createElement('link');
      altEs.rel = 'alternate';
      altEs.hreflang = 'es';
      document.head.appendChild(altEs);
    }
    altEs.href = `${window.location.origin}${i18n.localizePath(targetRoute.path, 'es')}`;

    let altDefault = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="x-default"]');
    if (!altDefault) {
      altDefault = document.createElement('link');
      altDefault.rel = 'alternate';
      altDefault.hreflang = 'x-default';
      document.head.appendChild(altDefault);
    }
    altDefault.href = `${window.location.origin}${i18n.localizePath(targetRoute.path, 'es')}`;

    const desc = this.getLocalizedDescription(targetRoute.path);
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = desc;
    }
    let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.content = `${localizedTitle} - ${t('seo.title_suffix')}`;
    }
    let ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.content = desc;
    }
    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.content = canonicalUrl;
    }
  }

  private getLocalizedTitle(path: string): string {
    switch (path) {
      case '/': return t('seo.home_title');
      case '/settings/account': return t('seo.account_title');
      case '/settings/security': return t('seo.security_title');
      case '/settings/accessibility': return t('seo.accessibility_title');
      case '/settings/billing': return t('seo.billing_title');
      case '/settings/purchases': return t('seo.purchases_title');
      case '/settings/guest': return t('seo.settings_title');
      case '/pricing': return t('seo.pricing_title');
      case '/checkout': return t('checkout.title');
      case '/login': return t('seo.login_title');
      case '/register': return t('seo.register_title');
      case '/forgot-password': return t('seo.forgot_password_title');
      case '/reset-password': return t('seo.reset_password_title');
      case '/help':
      case '/help/terms': return t('seo.terms_title');
      case '/help/privacy': return t('seo.privacy_title');
      case '/help/cookies': return t('seo.cookies_title');
      case '/help/security': return t('seo.security_policy_title');
      default: return 'BoardStack';
    }
  }

  private getLocalizedDescription(path: string): string {
    switch (path) {
      case '/': return t('seo.home_description');
      case '/pricing': return t('seo.pricing_description');
      case '/login': return t('seo.login_description');
      case '/register': return t('seo.register_description');
      case '/settings/account': return t('seo.account_description');
      case '/settings/security': return t('seo.security_description');
      case '/settings/accessibility': return t('seo.accessibility_description');
      case '/settings/billing': return t('seo.billing_description');
      case '/settings/purchases': return t('seo.purchases_description');
      default: return t('seo.home_description');
    }
  }
}

const layoutNav = new LayoutNavController();

export {
  LayoutNavController,
  layoutNav,
};

export type {
  RouteConfig,
};
