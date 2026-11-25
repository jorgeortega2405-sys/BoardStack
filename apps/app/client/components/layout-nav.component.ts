import { createAboutView } from '../views/about.view.js';
import { createCheckoutView } from '../views/checkout.view.js';
import { createContactSalesView } from '../views/contact-sales.view.js';
import { createContactView } from '../views/contact.view.js';
import { createFeaturesView } from '../views/features.view.js';
import { createForgotPasswordView, createLoginView, createRegisterView, createResetPasswordView } from '../views/auth.view.js';
import { createHelpView, HelpSection } from '../views/help.view.js';
import { createHomeView } from '../views/home.view.js';
import { createOrganizationView } from '../views/organization.view.js';
import { createPricingView } from '../views/pricing.view.js';
import { createRoomView } from '../views/room.view.js';
import {
  createSettingsAccessibilityView,
  createSettingsAccountView,
  createSettingsBillingView,
  createSettingsGuestView,
  createSettingsOrganizationView,
  createSettingsPurchasesView,
  createSettingsSecurityView,
} from '../views/settings.view.js';
import { currentUser, deleteApi, fetchCurrentUser, getApi, postApi } from '../services/api.service.js';
import { escapeHtml, setupDropdown, setupSheetDragToDismiss } from '../utils/dom.util.js';
import { finishNavigationProgress, startNavigationProgress } from '../services/navigation-progress.service.js';
import { formatBytes } from '../utils/format.util.js';
import { i18n, t } from '../i18n/i18n.service.js';
import { openCustomModal, openModal } from './modal.component.js';
import { renderIcons } from '../services/icon.service.js';
import { setupUserMenu } from './layout-user-menu.component.js';
import { themeService } from '../services/theme.service.js';
import { toast } from '../services/toast.service.js';

interface RouteConfig {
  path: string;
  railId: 'help' | 'home' | 'login' | 'settings';
  title: string;
}

const ROUTES: Record<string, RouteConfig> = {
  '/': { path: '/', railId: 'home', title: 'Inicio' },
  '/about': { path: '/about', railId: 'home', title: 'Sobre nosotros' },
  '/account': { path: '/account', railId: 'login', title: 'Cuenta' },
  '/checkout': { path: '/checkout', railId: 'home', title: 'Checkout' },
  '/contact': { path: '/contact', railId: 'home', title: 'Contacto' },
  '/contact-sales': { path: '/contact-sales', railId: 'home', title: 'Hablar con ventas' },
  '/features': { path: '/features', railId: 'home', title: 'Características' },
  '/forgot-password': { path: '/forgot-password', railId: 'login', title: 'Recuperar contraseña' },
  '/help': { path: '/help', railId: 'help', title: 'Preguntas frecuentes' },
  '/help/cookies': { path: '/help/cookies', railId: 'help', title: 'Política de cookies' },
  '/help/privacy': { path: '/help/privacy', railId: 'help', title: 'Política de privacidad' },
  '/help/security': { path: '/help/security', railId: 'help', title: 'Política de seguridad' },
  '/help/terms': { path: '/help/terms', railId: 'help', title: 'Términos y condiciones' },
  '/login': { path: '/login', railId: 'login', title: 'Iniciar sesión' },
  '/organization': { path: '/organization', railId: 'login', title: 'Organización' },
  '/organization/details': { path: '/organization/details', railId: 'login', title: 'Detalles de la organización' },
  '/organization/members': { path: '/organization/members', railId: 'login', title: 'Gestionar asientos' },
  '/organization/saml': { path: '/organization/saml', railId: 'login', title: 'Configuración SAML 2.0 y SSO' },
  '/pricing': { path: '/pricing', railId: 'home', title: 'Planes y Precios' },
  '/register': { path: '/register', railId: 'login', title: 'Crear una cuenta' },
  '/reset-password': { path: '/reset-password', railId: 'login', title: 'Restablecer contraseña' },
  '/settings': { path: '/settings/account', railId: 'login', title: 'Tu cuenta' },
  '/settings/accessibility': { path: '/settings/accessibility', railId: 'login', title: 'Accesibilidad' },
  '/settings/account': { path: '/settings/account', railId: 'login', title: 'Tu cuenta' },
  '/settings/billing': { path: '/settings/billing', railId: 'login', title: 'Facturación' },
  '/settings/guest': { path: '/settings/guest', railId: 'settings', title: 'Configuración' },
  '/settings/organization': { path: '/settings/organization', railId: 'login', title: 'Organización' },
  '/settings/organization/details': { path: '/settings/organization/details', railId: 'login', title: 'Detalles de la organización' },
  '/settings/organization/members': { path: '/settings/organization/members', railId: 'login', title: 'Gestionar asientos' },
  '/settings/organization/saml': { path: '/settings/organization/saml', railId: 'login', title: 'Configuración SAML 2.0 y SSO' },
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

    void this.navigate(window.location.pathname, false);

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
    if (clean.startsWith('/room/') || clean.startsWith('/r/')) {
      return { path: clean, railId: 'home', title: i18n.t('room.title') };
    }
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
    const railCreateRoom = document.querySelector<HTMLElement>('[data-ref="rail-item-create-room"]');
    const railHelp = document.querySelector<HTMLElement>('[data-ref="rail-item-help"]');
    const railSettings = document.querySelector<HTMLElement>('[data-ref="rail-item-settings"]');
    const railLogin = document.querySelector<HTMLElement>('[data-ref="rail-item-login"]');

    railHome?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      this.currentDrawerMode = 'general';
      this.setDrawerOpen(false);
      void this.navigate('/');
    });

    railCreateRoom?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      if (!currentUser) {
        if (window.innerWidth <= 768 && this.isDrawerOpen) {
          this.setDrawerOpen(false);
        }
        void this.navigate('/login');
        return;
      }

      const isPro = currentUser?.subscription_tier === 'pro' || currentUser?.subscription_tier === 'business' || currentUser?.subscription_tier === 'enterprise';

      const modalInstance = openCustomModal({
        contentHtml: `
          <div class="modal-container" data-ref="modal-container">
            <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="${i18n.t('common.close')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
            <div class="modal-card modal-card--split-config" data-ref="modal-card">
              <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
                <div class="modal-card__drag-handle"></div>
              </div>

              <div class="component-sidebar" data-ref="modal-sidebar">
                <div class="component-sidebar__top">
                  <div class="component-header">
                    <h2 class="component-title" style="font-size: 18px; font-weight: 600; line-height: 1.3;">${i18n.t('room.create_modal_title')}</h2>
                    <p class="component-subtitle" style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.4;">${i18n.t('room.create_modal_desc')}</p>
                  </div>
                  <div class="component-menu component-menu--padded" data-ref="modal-categories-menu">
                    <button type="button" class="component-menu__item is-active" data-ref="tab-general" data-tab="general">
                      <span class="component-menu__item-icon">
                        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
                      </span>
                      <span class="component-menu__item-text">${i18n.t('room.cat_general')}</span>
                    </button>
                    <button type="button" class="component-menu__item" data-ref="tab-security" data-tab="security">
                      <span class="component-menu__item-icon">
                        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
                      </span>
                      <span class="component-menu__item-text">${i18n.t('room.cat_security')}</span>
                    </button>
                    <button type="button" class="component-menu__item" data-ref="tab-storage" data-tab="storage">
                      <span class="component-menu__item-icon">
                        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
                      </span>
                      <span class="component-menu__item-text">${i18n.t('room.cat_storage')}</span>
                    </button>
                    <button type="button" class="component-menu__item" data-ref="tab-limits" data-tab="limits">
                      <span class="component-menu__item-icon">
                        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#speed"></use></svg>
                      </span>
                      <span class="component-menu__item-text">${i18n.t('room.cat_limits')}</span>
                    </button>
                  </div>
                </div>
                <div class="component-sidebar__bottom">
                  <button type="button" class="component-button component-button--black" style="width: 100%; height: 38px; font-weight: 500;" data-ref="btn-confirm-create-room">
                    ${i18n.t('room.btn_create_room')}
                  </button>
                  <button type="button" class="component-button component-button--outline" style="width: 100%; height: 38px; font-weight: 500;" data-ref="btn-cancel-create-room">
                    ${i18n.t('common.cancel')}
                  </button>
                </div>
              </div>

              <div class="component-container--content" data-ref="modal-panes-container">
                <div class="component-pane" data-ref="pane-general" data-pane="general">
                  <div class="component-header">
                    <h3 class="component-title" style="font-size: 17px; font-weight: 600; line-height: 1.3;">${i18n.t('room.cat_general')}</h3>
                    <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary);">${i18n.t('room.cat_general_desc')}</p>
                  </div>
                  <div class="component-group" style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="component-item" data-ref="item-custom-slug-toggle">
                      <div class="component-item__text">
                        <p class="component-item__title">
                          ${i18n.t('room.slug_toggle_title')}
                          <span class="component-badge component-badge--sm" style="margin-left: 6px;">PRO</span>
                        </p>
                        <p class="component-item__desc">${i18n.t('room.slug_toggle_desc')}</p>
                      </div>
                      <div class="component-item__actions">
                        <label class="component-switch" data-ref="switch-custom-slug-label">
                          <input type="checkbox" data-ref="switch-custom-slug" ${!isPro ? 'disabled' : ''} />
                          <span class="component-switch__slider"></span>
                        </label>
                      </div>
                    </div>

                    <div class="component-item component-item--stacked is-hidden" data-ref="item-custom-slug">
                      <div class="component-item__text">
                        <label class="component-item__title" for="field-custom-slug-input">${i18n.t('room.slug_label')}</label>
                        <p class="component-item__desc">${i18n.t('room.slug_desc')}</p>
                      </div>
                      <input
                        type="text"
                        id="field-custom-slug-input"
                        class="field__input--simple"
                        style="width: 100%; height: 38px; font-size: 13.5px;"
                        data-ref="input-custom-slug"
                        placeholder="${!isPro ? i18n.t('room.pro_feature_notice') : i18n.t('room.slug_placeholder')}"
                        autocomplete="off"
                        spellcheck="false"
                        maxlength="40"
                        ${!isPro ? 'disabled' : ''}
                      />
                    </div>

                    <hr class="component-divider" />

                    <div class="component-item" data-ref="item-persistent-room">
                      <div class="component-item__text">
                        <p class="component-item__title">
                          ${i18n.t('room.persistent_title')}
                          <span class="component-badge component-badge--sm" style="margin-left: 6px;">PRO</span>
                        </p>
                        <p class="component-item__desc">${i18n.t('room.persistent_desc')}</p>
                      </div>
                      <div class="component-item__actions">
                        <label class="component-switch" data-ref="switch-persistent-label">
                          <input type="checkbox" data-ref="switch-persistent" ${!isPro ? 'disabled' : ''} />
                          <span class="component-switch__slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="component-pane is-hidden" data-ref="pane-security" data-pane="security">
                  <div class="component-header">
                    <h3 class="component-title" style="font-size: 17px; font-weight: 600; line-height: 1.3;">${i18n.t('room.cat_security')}</h3>
                    <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary);">${i18n.t('room.cat_security_desc')}</p>
                  </div>
                  <div class="component-group" style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="component-item" data-ref="item-password-protect">
                      <div class="component-item__text">
                        <p class="component-item__title">${i18n.t('room.password_protect_title')}</p>
                        <p class="component-item__desc">${i18n.t('room.password_protect_desc')}</p>
                      </div>
                      <div class="component-item__actions">
                        <label class="component-switch" data-ref="switch-password-label">
                          <input type="checkbox" data-ref="switch-password" />
                          <span class="component-switch__slider"></span>
                        </label>
                      </div>
                    </div>

                    <div class="component-item component-item--stacked is-hidden" data-ref="item-room-password">
                      <div class="component-item__text">
                        <label class="component-item__title" for="field-room-password-input">${i18n.t('room.password_label')}</label>
                      </div>
                      <input
                        type="password"
                        id="field-room-password-input"
                        class="field__input--simple"
                        style="width: 100%; height: 38px; font-size: 13.5px;"
                        data-ref="input-room-password"
                        placeholder="${i18n.t('room.password_placeholder')}"
                        autocomplete="new-password"
                        maxlength="50"
                      />
                    </div>

                    <hr class="component-divider" />

                    <div class="component-item component-item--stacked" data-ref="item-upload-permissions">
                      <div class="component-item__text">
                        <h4 class="component-item__title">${i18n.t('room.upload_perm_title')}</h4>
                        <p class="component-item__desc">${i18n.t('room.upload_perm_desc')}</p>
                      </div>
                      <div class="component-dropdown dropdown-wrapper" data-ref="dropdown-wrapper-upload-perm">
                        <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="btn-trigger-upload-perm" aria-label="${i18n.t('room.upload_perm_title')}">
                          <div class="component-dropdown__trigger-left dropdown-trigger__left">
                            <svg class="component-icon component-dropdown__trigger-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#groups"></use></svg>
                            <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="upload-perm-selected-text">${i18n.t('room.upload_perm_all')}</span>
                          </div>
                          <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                        </button>
                        <div class="component-menu-backdrop dropdown-backdrop" data-ref="dropdown-backdrop-upload-perm">
                          <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-upload-perm">
                            <div class="component-menu__list menu-panel__list">
                              <button type="button" class="component-menu__item menu-item is-active" data-ref="option-perm-all" data-value="all">
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#groups"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.upload_perm_all')}</span>
                              </button>
                              <button type="button" class="component-menu__item menu-item" data-ref="option-perm-owner" data-value="owner_only">
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.upload_perm_owner_only')}</span>
                              </button>
                              <button type="button" class="component-menu__item menu-item" data-ref="option-perm-specific" data-value="specific">
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#key"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.upload_perm_specific')}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="component-pane is-hidden" data-ref="pane-storage" data-pane="storage">
                  <div class="component-header">
                    <h3 class="component-title" style="font-size: 17px; font-weight: 600; line-height: 1.3;">${i18n.t('room.cat_storage')}</h3>
                    <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary);">${i18n.t('room.cat_storage_desc')}</p>
                  </div>
                  <div class="component-group" style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="component-item" data-ref="item-cloud-storage">
                      <div class="component-item__text">
                        <p class="component-item__title">
                          ${i18n.t('room.cloud_storage_title')}
                          <span class="component-badge component-badge--sm" style="margin-left: 6px;">PRO</span>
                        </p>
                        <p class="component-item__desc">${i18n.t('room.cloud_storage_desc')}</p>
                      </div>
                      <div class="component-item__actions">
                        <label class="component-switch" data-ref="switch-cloud-label">
                          <input type="checkbox" data-ref="switch-cloud" ${!isPro ? 'disabled' : ''} />
                          <span class="component-switch__slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div class="component-banner" data-ref="banner-cloud-info" style="margin-top: 12px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;">
                    <p class="component-item__title" style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0;">${i18n.t('room.cloud_offline_ready')}</p>
                    <p class="component-item__desc" style="font-size: 12.5px; line-height: 1.45; margin: 0; color: var(--text-secondary);">${i18n.t('room.cloud_storage_desc')}</p>
                  </div>
                </div>

                <div class="component-pane is-hidden" data-ref="pane-limits" data-pane="limits">
                  <div class="component-header">
                    <h3 class="component-title" style="font-size: 17px; font-weight: 600; line-height: 1.3;">${i18n.t('room.cat_limits')}</h3>
                    <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary);">${i18n.t('room.cat_limits_desc')}</p>
                  </div>
                  <div class="component-group" style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="component-item component-item--stacked" data-ref="item-expiration">
                      <div class="component-item__text">
                        <h4 class="component-item__title">${i18n.t('room.expiration_title')}</h4>
                        <p class="component-item__desc">${i18n.t('room.expiration_desc')}</p>
                      </div>
                      <div class="component-dropdown dropdown-wrapper" data-ref="dropdown-wrapper-expiration">
                        <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="btn-trigger-expiration" aria-label="${i18n.t('room.expiration_title')}">
                          <div class="component-dropdown__trigger-left dropdown-trigger__left">
                            <svg class="component-icon component-dropdown__trigger-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                            <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="expiration-selected-text">${isPro ? i18n.t('room.expiration_24h') : i18n.t('room.expiration_1h')}</span>
                          </div>
                          <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                        </button>
                        <div class="component-menu-backdrop dropdown-backdrop" data-ref="dropdown-backdrop-expiration">
                          <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-expiration">
                            <div class="component-menu__list menu-panel__list">
                              <button type="button" class="component-menu__item menu-item ${!isPro ? 'is-active' : ''}" data-ref="option-exp-1" data-value="1">
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.expiration_1h')}</span>
                              </button>
                              <button type="button" class="component-menu__item menu-item ${isPro ? 'is-active' : 'is-disabled'}" data-ref="option-exp-24" data-value="24" ${!isPro ? 'disabled' : ''}>
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.expiration_24h')}${!isPro ? ' (PRO)' : ''}</span>
                              </button>
                              <button type="button" class="component-menu__item menu-item ${!isPro ? 'is-disabled' : ''}" data-ref="option-exp-168" data-value="168" ${!isPro ? 'disabled' : ''}>
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.expiration_7d')}${!isPro ? ' (PRO)' : ''}</span>
                              </button>
                              <button type="button" class="component-menu__item menu-item ${!isPro ? 'is-disabled' : ''}" data-ref="option-exp-720" data-value="720" ${!isPro ? 'disabled' : ''}>
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.expiration_30d')}${!isPro ? ' (PRO)' : ''}</span>
                              </button>
                              <button type="button" class="component-menu__item menu-item ${!isPro ? 'is-disabled' : ''}" data-ref="option-exp-0" data-value="0" ${!isPro ? 'disabled' : ''}>
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.expiration_never')}${!isPro ? ' (PRO)' : ''}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <hr class="component-divider" />

                    <div class="component-item component-item--stacked" data-ref="item-download-limit">
                      <div class="component-item__text">
                        <h4 class="component-item__title">${i18n.t('room.download_limit_title')}</h4>
                        <p class="component-item__desc">${i18n.t('room.download_limit_desc')}</p>
                      </div>
                      <div class="component-dropdown dropdown-wrapper" data-ref="dropdown-wrapper-download-limit">
                        <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="btn-trigger-download-limit" aria-label="${i18n.t('room.download_limit_title')}">
                          <div class="component-dropdown__trigger-left dropdown-trigger__left">
                            <svg class="component-icon component-dropdown__trigger-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                            <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="download-limit-selected-text">${i18n.t('room.download_limit_unlimited')}</span>
                          </div>
                          <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                        </button>
                        <div class="component-menu-backdrop dropdown-backdrop" data-ref="dropdown-backdrop-download-limit">
                          <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-download-limit">
                            <div class="component-menu__list menu-panel__list">
                              <button type="button" class="component-menu__item menu-item is-active" data-ref="option-limit-0" data-value="0">
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.download_limit_unlimited')}</span>
                              </button>
                              <button type="button" class="component-menu__item menu-item" data-ref="option-limit-1" data-value="1">
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.download_limit_1')}</span>
                              </button>
                              <button type="button" class="component-menu__item menu-item" data-ref="option-limit-5" data-value="5">
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.download_limit_5')}</span>
                              </button>
                              <button type="button" class="component-menu__item menu-item" data-ref="option-limit-10" data-value="10">
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.download_limit_10')}</span>
                              </button>
                              <button type="button" class="component-menu__item menu-item" data-ref="option-limit-custom" data-value="custom">
                                <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
                                <span class="component-menu__item-text menu-item__text">${i18n.t('room.download_limit_custom')}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="is-hidden" data-ref="box-custom-download-limit" style="margin-top: 8px;">
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          class="field__input--simple"
                          style="width: 100%; height: 38px; font-size: 13.5px;"
                          data-ref="input-custom-download-limit"
                          placeholder="${i18n.t('room.download_limit_placeholder')}"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
      });

      const modalEl = modalInstance.backdrop;
      const tabBtns = modalEl.querySelectorAll<HTMLButtonElement>('[data-tab]');
      const panes = modalEl.querySelectorAll<HTMLElement>('[data-pane]');
      const btnCancelEl = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-create-room"]');
      const btnConfirmEl = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-confirm-create-room"]');

      tabBtns.forEach((tabBtn) => {
        tabBtn.addEventListener('click', () => {
          const targetTab = tabBtn.getAttribute('data-tab');
          if (!targetTab) return;

          tabBtns.forEach((b) => b.classList.remove('is-active'));
          tabBtn.classList.add('is-active');

          panes.forEach((pane) => {
            if (pane.getAttribute('data-pane') === targetTab) {
              pane.classList.remove('is-hidden');
            } else {
              pane.classList.add('is-hidden');
            }
          });
        });
      });

      btnCancelEl?.addEventListener('click', () => {
        modalInstance.close();
      });

      const switchCustomSlugEl = modalEl.querySelector<HTMLInputElement>('[data-ref="switch-custom-slug"]');
      const itemCustomSlugEl = modalEl.querySelector<HTMLElement>('[data-ref="item-custom-slug"]');
      const inputCustomSlugEl = modalEl.querySelector<HTMLInputElement>('[data-ref="input-custom-slug"]');
      const switchCloudEl = modalEl.querySelector<HTMLInputElement>('[data-ref="switch-cloud"]');
      const switchPersistentEl = modalEl.querySelector<HTMLInputElement>('[data-ref="switch-persistent"]');
      const switchPasswordEl = modalEl.querySelector<HTMLInputElement>('[data-ref="switch-password"]');
      const itemPasswordEl = modalEl.querySelector<HTMLElement>('[data-ref="item-room-password"]');
      const inputPasswordEl = modalEl.querySelector<HTMLInputElement>('[data-ref="input-room-password"]');
      const boxCustomDownloadLimitEl = modalEl.querySelector<HTMLElement>('[data-ref="box-custom-download-limit"]');
      const inputCustomLimitEl = modalEl.querySelector<HTMLInputElement>('[data-ref="input-custom-download-limit"]');

      let uploadPermissionVal = 'all';
      let expiresInHoursVal = isPro ? 24 : 1;
      let downloadLimitMode = '0';

      const uploadPermWrapper = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-upload-perm"]');
      setupDropdown(uploadPermWrapper, {
        onSelect: (val) => {
          uploadPermissionVal = val;
          uploadPermWrapper?.querySelectorAll('.component-menu__item, .menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === val);
          });
        },
      });

      const expirationWrapper = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-expiration"]');
      setupDropdown(expirationWrapper, {
        onSelect: (val) => {
          expiresInHoursVal = Number(val);
          expirationWrapper?.querySelectorAll('.component-menu__item, .menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === val);
          });
        },
      });

      const downloadLimitWrapper = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-download-limit"]');
      setupDropdown(downloadLimitWrapper, {
        onSelect: (val) => {
          downloadLimitMode = val;
          downloadLimitWrapper?.querySelectorAll('.component-menu__item, .menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === val);
          });
          if (val === 'custom') {
            boxCustomDownloadLimitEl?.classList.remove('is-hidden');
            inputCustomLimitEl?.focus();
          } else {
            boxCustomDownloadLimitEl?.classList.add('is-hidden');
            if (inputCustomLimitEl) inputCustomLimitEl.value = '';
          }
        },
      });

      if (!isPro) {
        modalEl.querySelector<HTMLElement>('[data-ref="item-custom-slug-toggle"]')?.addEventListener('click', () => {
          toast.info(i18n.t('room.pro_feature_notice'));
        });
        modalEl.querySelector<HTMLElement>('[data-ref="item-custom-slug"]')?.addEventListener('click', () => {
          toast.info(i18n.t('room.pro_feature_notice'));
        });
        modalEl.querySelector<HTMLElement>('[data-ref="item-persistent-room"]')?.addEventListener('click', (e: MouseEvent) => {
          e.preventDefault();
          toast.info(i18n.t('room.pro_feature_notice'));
        });
        modalEl.querySelector<HTMLElement>('[data-ref="item-cloud-storage"]')?.addEventListener('click', (e: MouseEvent) => {
          e.preventDefault();
          toast.info(i18n.t('room.pro_feature_notice'));
        });
      } else {
        modalEl.querySelector<HTMLElement>('[data-ref="item-custom-slug-toggle"]')?.addEventListener('click', (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest('.component-switch') || target.tagName === 'INPUT') return;
          if (switchCustomSlugEl && !switchCustomSlugEl.disabled) {
            switchCustomSlugEl.checked = !switchCustomSlugEl.checked;
            switchCustomSlugEl.dispatchEvent(new Event('change'));
          }
        });
        modalEl.querySelector<HTMLElement>('[data-ref="item-persistent-room"]')?.addEventListener('click', (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest('.component-switch') || target.tagName === 'INPUT') return;
          if (switchPersistentEl && !switchPersistentEl.disabled) {
            switchPersistentEl.checked = !switchPersistentEl.checked;
            switchPersistentEl.dispatchEvent(new Event('change'));
          }
        });
        modalEl.querySelector<HTMLElement>('[data-ref="item-cloud-storage"]')?.addEventListener('click', (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest('.component-switch') || target.tagName === 'INPUT') return;
          if (switchCloudEl) {
            switchCloudEl.checked = !switchCloudEl.checked;
            switchCloudEl.dispatchEvent(new Event('change'));
          }
        });
      }

      switchCustomSlugEl?.addEventListener('change', () => {
        if (switchCustomSlugEl.checked) {
          itemCustomSlugEl?.classList.remove('is-hidden');
          inputCustomSlugEl?.focus();
        } else {
          itemCustomSlugEl?.classList.add('is-hidden');
          if (inputCustomSlugEl) inputCustomSlugEl.value = '';
        }
      });

      modalEl.querySelector<HTMLElement>('[data-ref="item-password-protect"]')?.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.component-switch') || target.tagName === 'INPUT') return;
        if (switchPasswordEl) {
          switchPasswordEl.checked = !switchPasswordEl.checked;
          switchPasswordEl.dispatchEvent(new Event('change'));
        }
      });

      switchCloudEl?.addEventListener('change', () => {
        if (switchCloudEl.checked) {
          if (switchPersistentEl) {
            switchPersistentEl.checked = true;
            switchPersistentEl.disabled = true;
          }
        } else {
          if (switchPersistentEl) {
            switchPersistentEl.disabled = false;
          }
        }
      });

      switchPersistentEl?.addEventListener('change', () => {
        if (!switchPersistentEl.checked && switchCloudEl) {
          switchCloudEl.checked = false;
        }
      });

      switchPasswordEl?.addEventListener('change', () => {
        if (switchPasswordEl.checked) {
          itemPasswordEl?.classList.remove('is-hidden');
          inputPasswordEl?.focus();
        } else {
          itemPasswordEl?.classList.add('is-hidden');
          if (inputPasswordEl) inputPasswordEl.value = '';
        }
      });

      btnConfirmEl?.addEventListener('click', async () => {
        const slugVal = (switchCustomSlugEl?.checked && inputCustomSlugEl) ? inputCustomSlugEl.value.trim().toLowerCase() : '';
        const saveToCloudVal = switchCloudEl?.checked || false;
        const isPersistentVal = saveToCloudVal ? true : (switchPersistentEl?.checked || false);
        const passwordVal = switchPasswordEl?.checked ? (inputPasswordEl?.value.trim() || '') : '';
        let maxDownloadsVal: number | null = null;
        if (downloadLimitMode === 'custom') {
          const customNum = Number(inputCustomLimitEl?.value || 0);
          maxDownloadsVal = customNum > 0 ? customNum : null;
        } else {
          const limitNum = Number(downloadLimitMode);
          maxDownloadsVal = limitNum > 0 ? limitNum : null;
        }

        if (slugVal) {
          const isValidSlug = /^[a-z0-9-]+$/.test(slugVal) && slugVal.length >= 3 && slugVal.length <= 40;
          if (!isValidSlug) {
            toast.error(i18n.t('room.slug_invalid'));
            return;
          }
        }

        if (!isPro && (slugVal || saveToCloudVal || isPersistentVal || (expiresInHoursVal > 0 && expiresInHoursVal !== 1))) {
          toast.info(i18n.t('room.pro_feature_notice'));
          return;
        }

        btnConfirmEl.disabled = true;

        try {
          const res = await postApi<{
            code?: string;
            error?: string;
            expires_at?: number;
            has_password?: boolean;
            is_persistent?: boolean;
            max_downloads?: number;
            ok: boolean;
            room_id?: string;
            save_to_cloud?: boolean;
            slug?: string;
            upload_permission?: string;
          }>('/api/rooms/create', {
            custom_slug: slugVal || null,
            expires_in_hours: expiresInHoursVal > 0 ? expiresInHoursVal : null,
            is_persistent: isPersistentVal,
            max_downloads: maxDownloadsVal,
            password: passwordVal || null,
            save_to_cloud: saveToCloudVal,
            upload_permission: uploadPermissionVal,
          });

          if (res.ok && res.room_id) {
            sessionStorage.setItem(`room_owner_${res.room_id}`, 'true');
            if (res.slug) {
              sessionStorage.setItem(`room_owner_${res.slug}`, 'true');
            }
            if (passwordVal) {
              sessionStorage.setItem(`room_password_${res.room_id}`, passwordVal);
              if (res.slug) {
                sessionStorage.setItem(`room_password_${res.slug}`, passwordVal);
              }
            }
            if (saveToCloudVal) {
              sessionStorage.setItem(`room_save_to_cloud_${res.room_id}`, 'true');
              if (res.slug) {
                sessionStorage.setItem(`room_save_to_cloud_${res.slug}`, 'true');
              }
            }
            sessionStorage.setItem(`room_upload_permission_${res.room_id}`, uploadPermissionVal);
            if (res.slug) {
              sessionStorage.setItem(`room_upload_permission_${res.slug}`, uploadPermissionVal);
            }
            modalInstance.close();
            const targetUrl = res.slug ? `/room/${res.slug}` : `/room/${res.room_id}`;
            void this.navigate(targetUrl);
          } else {
            btnConfirmEl.disabled = false;
            if (res.error && res.error.includes('already in use')) {
              toast.error(i18n.t('room.slug_in_use'));
            } else {
              toast.error(i18n.t('room.error_creating'));
            }
          }
        } catch {
          btnConfirmEl.disabled = false;
          toast.error(i18n.t('room.error_creating'));
        }
      });
    });

    railHelp?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      this.currentDrawerMode = 'help';
      this.setDrawerOpen(true);
      if (!this.currentPath.startsWith('/help')) {
        void this.navigate('/help');
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
          let nextView: DocumentFragment | HTMLElement | null = null;
          if (targetRoute.path === '/') {
            nextView = await createHomeView((p) => this.navigate(p));
          } else if (targetRoute.path === '/features') {
            nextView = await createFeaturesView((p) => this.navigate(p));
          } else if (targetRoute.path === '/about') {
            nextView = await createAboutView((p) => this.navigate(p));
          } else if (targetRoute.path === '/contact') {
            nextView = await createContactView((p) => this.navigate(p));
          } else if (targetRoute.path.startsWith('/room/') || targetRoute.path.startsWith('/r/')) {
            const roomId = targetRoute.path.replace(/^\/(?:room|r)\//, '').split('/')[0];
            nextView = await createRoomView(roomId, (p) => this.navigate(p));
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
            } else if (targetRoute.path.startsWith('/settings/organization')) {
              nextView = await createOrganizationView((p) => this.navigate(p), targetRoute.path);
            }
          } else if (targetRoute.path.startsWith('/organization')) {
            nextView = await createOrganizationView((p) => this.navigate(p), targetRoute.path);
          } else if (targetRoute.path === '/pricing') {
            nextView = await createPricingView((p) => this.navigate(p));
          } else if (targetRoute.path === '/checkout') {
            nextView = await createCheckoutView((p) => this.navigate(p));
          } else if (targetRoute.path === '/contact-sales') {
            nextView = await createContactSalesView((p) => this.navigate(p));
          } else if (targetRoute.path.startsWith('/help')) {
            let section: HelpSection = 'faq';
            if (targetRoute.path === '/help/terms') {
              section = 'terms';
            } else if (targetRoute.path === '/help/privacy') {
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

          if (targetRoute.path.startsWith('/room/') || targetRoute.path.startsWith('/r/')) {
            this.viewContainerEl.classList.add('component-view--room');
          } else {
            this.viewContainerEl.classList.remove('component-view--room');
          }

          const dotsBackdropEl = document.querySelector<HTMLElement>('[data-ref="view-backdrop-dots"]');
          if (dotsBackdropEl) {
            const showDots = targetRoute.path === '/' || targetRoute.path === '/features' || targetRoute.path === '/about' || targetRoute.path === '/contact' || targetRoute.path === '/contact-sales' || targetRoute.path === '/pricing' || targetRoute.path === '/checkout' || targetRoute.path.startsWith('/help');
            dotsBackdropEl.classList.toggle('is-hidden', !showDots);
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
        { href: '/help', icon: 'help', name: t('drawer.faq') },
        { href: '/help/terms', icon: 'gavel', name: t('drawer.terms') },
        { href: '/help/privacy', icon: 'lock', name: t('drawer.privacy') },
        { href: '/help/cookies', icon: 'cookie', name: t('drawer.cookies') },
        { href: '/help/security', icon: 'shield', name: t('drawer.security_policy') },
      ];

      let html = `<div class="component-drawer__group" data-ref="drawer-help-group">`;
      html += `<div class="component-drawer__title">${t('drawer.legal_policies')}</div>`;

      for (const p of helpPages) {
        const isActive = this.currentPath === p.href;
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

      let html = '';
      if (currentUser) {
        html += `<div class="component-drawer__group" data-ref="drawer-rooms-group">`;
        html += `<div class="component-drawer__title">${t('drawer.my_rooms')}</div>`;
        html += `<div data-ref="drawer-rooms-list" style="display: flex; flex-direction: column; gap: 6px;"></div>`;
        html += `</div>`;
      }

      this.drawerBodyEl.innerHTML = html;

      if (currentUser) {
        void this.populateDrawerRooms();
      }
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

  private async populateDrawerRooms(): Promise<void> {
    if (!currentUser || !this.drawerBodyEl) return;
    const roomsListEl = this.drawerBodyEl.querySelector<HTMLElement>('[data-ref="drawer-rooms-list"]');
    const roomsGroupEl = this.drawerBodyEl.querySelector<HTMLElement>('[data-ref="drawer-rooms-group"]');
    if (!roomsListEl || !roomsGroupEl) return;

    try {
      const res = await getApi<{
        ok: boolean;
        rooms: Array<{
          code: string;
          created_at: string;
          expires_at: number | null;
          files_count: number;
          is_persistent: boolean;
          max_downloads: number | null;
          requires_password: boolean;
          room_id: string;
          save_to_cloud: boolean;
          slug: string | null;
          storage_bytes: number;
          total_downloads: number;
          upload_permission: string;
        }>;
      }>('/api/rooms/my-rooms');

      if (res && res.ok && Array.isArray(res.rooms) && res.rooms.length > 0) {
        let roomsHtml = '';
        for (const room of res.rooms) {
          const targetUrl = `/room/${room.slug || room.code}`;
          const isAct = this.currentPath === targetUrl || (room.slug ? this.currentPath === `/r/${room.slug}` : false);
          const roomLabel = room.slug ? `/r/${room.slug}` : room.code;
          const filesCount = Number(room.files_count || 0);
          const storageBytes = Number(room.storage_bytes || 0);
          const totalDownloads = Number(room.total_downloads || 0);

          roomsHtml += `
            <div class="component-card component-card--flat${isAct ? ' is-active' : ''}" data-ref="card-room-${room.code}" data-route="${targetUrl}" style="padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 12px; cursor: pointer; background: var(--bg-surface); display: flex; flex-direction: column; gap: 6px; box-sizing: border-box; width: 100%; transition: background-color var(--sl-transition-fast), border-color var(--sl-transition-fast);">
              <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                  <span class="component-item__title" style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">
                    ${escapeHtml(roomLabel)}
                  </span>
                  ${room.is_persistent ? `<span class="component-badge component-badge--sm" style="font-size: 10px; padding: 2px 6px; flex-shrink: 0;">${i18n.t('room.persistent_badge')}</span>` : ''}
                </div>
                <button type="button" class="component-button component-button--icon" data-action="delete-room" data-room-id="${room.room_id}" aria-label="${i18n.t('common.delete')}" style="width: 26px; height: 26px; min-width: 26px; padding: 0; flex-shrink: 0; color: var(--text-secondary); border-radius: 8px;">
                  <svg class="component-icon" aria-hidden="true" style="width: 15px; height: 15px;"><use href="/icons.svg#delete"></use></svg>
                </button>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <span>${filesCount} ${i18n.t('room.files_count', { count: filesCount })}</span>
                <span>•</span>
                <span>${formatBytes(storageBytes)}</span>
                <span>•</span>
                <span>${i18n.t('room.downloads_count_unlimited', { count: totalDownloads })}</span>
              </div>
            </div>
          `;
        }
        roomsListEl.innerHTML = roomsHtml;
        if (this.drawerEl) {
          renderIcons(roomsListEl);
          roomsListEl.querySelectorAll<HTMLElement>('[data-route]').forEach((card) => {
            card.addEventListener('click', (e: MouseEvent) => {
              if ((e.target as HTMLElement).closest('[data-action="delete-room"]')) {
                return;
              }
              const target = card.getAttribute('data-route');
              if (target) {
                if (window.innerWidth <= 768) {
                  this.setDrawerOpen(false);
                }
                void this.navigate(target);
              }
            });
          });

          roomsListEl.querySelectorAll<HTMLButtonElement>('[data-action="delete-room"]').forEach((delBtn) => {
            delBtn.addEventListener('click', (e: MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              const roomId = delBtn.getAttribute('data-room-id');
              if (!roomId) return;

              openModal({
                cancelText: i18n.t('common.cancel'),
                confirmClass: 'component-button--destructive',
                confirmText: i18n.t('room.delete_permanently'),
                description: i18n.t('room.room_card_delete_confirm'),
                onConfirm: async () => {
                  try {
                    await deleteApi(`/api/rooms/${encodeURIComponent(roomId)}`);
                    toast.success(i18n.t('room.room_card_deleted'));
                    await this.populateDrawerRooms();
                  } catch {
                    toast.error(i18n.t('common.error'));
                  }
                },
                showCancel: true,
                showConfirm: true,
                size: 'sm',
                title: i18n.t('room.delete_room_confirm_title'),
              });
            });
          });
        }
      } else {
        roomsGroupEl.remove();
      }
    } catch {
      roomsGroupEl.remove();
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
      case '/about': return t('seo.about_title');
      case '/contact': return t('seo.contact_title');
      case '/features': return t('seo.features_title');
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
      case '/help': return t('seo.faq_title');
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
      case '/about': return t('seo.about_description');
      case '/contact': return t('seo.contact_description');
      case '/features': return t('seo.features_description');
      case '/help': return t('seo.faq_description');
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
