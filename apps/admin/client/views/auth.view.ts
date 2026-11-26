import type { AccessibleAdminApp } from '../types/admin.types.js';
import { accessibleApps, currentUser, getApi, postApi, setAuthState } from '../services/api.service.js';
import type { AdminSessionAccount, AdminUserPayload } from '../types/auth.types.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { setButtonLoading, setupPasswordToggle } from '../utils/dom.util.js';
import { themeService } from '../services/theme.service.js';

interface LoginResponse {
  accessibleApps?: AccessibleAdminApp[];
  accounts?: AdminSessionAccount[];
  code?: string;
  error?: string;
  message?: string;
  ok?: boolean;
  requires2FA?: boolean;
  tempToken?: string;
  user?: AdminUserPayload;
}

class AdminLoginViewController {
  private container: HTMLElement;
  private onNavigate: (path: string) => void;
  private currentTempToken: string | null = null;

  constructor(container: HTMLElement, onNavigate: (path: string) => void) {
    this.container = container;
    this.onNavigate = onNavigate;
  }

  public init(): void {
    const mainStep = this.container.querySelector<HTMLElement>('[data-ref="login-step-main"]');
    const twoFaStep = this.container.querySelector<HTMLElement>('[data-ref="login-step-2fa"]');
    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="login-email"]');
    const passwordInput = this.container.querySelector<HTMLInputElement>('[data-ref="login-password"]');
    const togglePasswordBtn = this.container.querySelector<HTMLElement>('[data-ref="toggle-login-password"]');
    const submitBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-login"]');
    const backToPanelBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-back-to-panel"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="login-error"]');

    const twoFaCodeInput = this.container.querySelector<HTMLInputElement>('[data-ref="login-2fa-code"]');
    const submitTwoFaBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-2fa"]');
    const backToCredsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-back-to-credentials"]');
    const twoFaErrorBanner = this.container.querySelector<HTMLElement>('[data-ref="login-2fa-error"]');

    setupPasswordToggle(togglePasswordBtn, passwordInput);

    const showError = (msg: string) => {
      if (errorBanner) {
        errorBanner.textContent = msg;
        errorBanner.classList.remove('is-hidden');
      }
    };

    const hideError = () => {
      if (errorBanner) {
        errorBanner.textContent = '';
        errorBanner.classList.add('is-hidden');
      }
    };

    const showTwoFaError = (msg: string) => {
      if (twoFaErrorBanner) {
        twoFaErrorBanner.textContent = msg;
        twoFaErrorBanner.classList.remove('is-hidden');
      }
    };

    const hideTwoFaError = () => {
      if (twoFaErrorBanner) {
        twoFaErrorBanner.textContent = '';
        twoFaErrorBanner.classList.add('is-hidden');
      }
    };

    const showTwoFaStep = (tempToken: string) => {
      this.currentTempToken = tempToken;
      hideError();
      hideTwoFaError();
      mainStep?.classList.add('is-hidden');
      twoFaStep?.classList.remove('is-hidden');
      if (twoFaCodeInput) {
        twoFaCodeInput.value = '';
        setTimeout(() => twoFaCodeInput.focus(), 50);
      }
    };

    const showMainStep = () => {
      this.currentTempToken = null;
      hideError();
      hideTwoFaError();
      twoFaStep?.classList.add('is-hidden');
      mainStep?.classList.remove('is-hidden');
      if (passwordInput) {
        passwordInput.value = '';
      }
    };

    const handleSuccessfulLogin = async (res: LoginResponse) => {
      const apps = res.accessibleApps || [];
      if (!res.user || apps.length === 0 || !apps[0].pages || apps[0].pages.length === 0) {
        showError(i18n.t('admin.auth.access_denied'));
        return;
      }
      setAuthState(res.user, apps, res.accounts || []);
      try {
        const prefRes = await getApi<{ ok?: boolean; preferences?: { language?: string; theme?: string } }>('/api/settings/preferences');
        if (prefRes.ok && prefRes.preferences) {
          if (prefRes.preferences.theme) {
            themeService.setTheme(prefRes.preferences.theme as any);
          }
          if (prefRes.preferences.language) {
            i18n.setLanguage(prefRes.preferences.language, false);
          }
        }
      } catch {}
      this.onNavigate(`/${apps[0].slug}/${apps[0].pages[0].slug}`);
    };

    const resolveLoginErrorMessage = (res: LoginResponse): string => {
      if (res.code === 'ADMIN_ACCESS_DENIED') {
        return i18n.t('admin.auth.access_denied');
      }
      return res.error || i18n.t('auth.invalid_credentials');
    };

    backToPanelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.onNavigate('/');
    });

    backToCredsBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      showMainStep();
    });

    const doLogin = async () => {
      if (submitBtn?.classList.contains('is-loading')) return;
      hideError();
      const email = emailInput?.value.trim() || '';
      const password = passwordInput?.value || '';

      if (!email || !password) {
        showError(i18n.t('auth.email_and_password_required'));
        return;
      }

      setButtonLoading(submitBtn, true);
      try {
        const res = await postApi<LoginResponse>('/api/auth/login', { email, password });
        if (res.requires2FA && res.tempToken) {
          showTwoFaStep(res.tempToken);
          return;
        }

        if (res.ok && res.user) {
          await handleSuccessfulLogin(res);
        } else {
          showError(resolveLoginErrorMessage(res));
        }
      } catch {
        showError(i18n.t('auth.connection_error'));
      } finally {
        setButtonLoading(submitBtn, false);
      }
    };

    const doSubmit2FA = async () => {
      if (submitTwoFaBtn?.classList.contains('is-loading')) return;
      hideTwoFaError();
      const code = twoFaCodeInput?.value.trim() || '';
      if (!code) {
        showTwoFaError(i18n.t('auth.two_factor_code_required'));
        return;
      }

      if (!this.currentTempToken) {
        showMainStep();
        showError(i18n.t('auth.session_expired'));
        return;
      }

      setButtonLoading(submitTwoFaBtn, true);
      try {
        const res = await postApi<LoginResponse>('/api/auth/login', {
          tempToken: this.currentTempToken,
          twoFactorCode: code,
        });

        if (res.ok && res.user) {
          await handleSuccessfulLogin(res);
        } else if (res.code === 'ADMIN_ACCESS_DENIED') {
          showMainStep();
          showError(i18n.t('admin.auth.access_denied'));
        } else {
          showTwoFaError(res.error || i18n.t('auth.two_factor_invalid'));
        }
      } catch {
        showTwoFaError(i18n.t('auth.connection_error'));
      } finally {
        setButtonLoading(submitTwoFaBtn, false);
      }
    };

    submitBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      void doLogin();
    });

    passwordInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void doLogin();
      }
    });

    submitTwoFaBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      void doSubmit2FA();
    });

    twoFaCodeInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void doSubmit2FA();
      }
    });
  }
}

async function createLoginView(onNavigate: (path: string) => void): Promise<HTMLElement> {
  const hasExistingSession = Boolean(currentUser && accessibleApps.length > 0);
  const container = document.createElement('div');
  container.className = 'component-container component-container--auth';
  container.setAttribute('data-ref', 'login-wrapper');
  container.innerHTML = `
    <a class="component-brand" data-ref="login-brand" href="/" aria-label="${i18n.t('admin.auth.brand_title')}">
      <img class="component-brand__img" data-ref="logo-img" alt="${i18n.t('admin.auth.brand_title')}" src="/logo.svg" />
    </a>
    <div class="component-card component-card--auth" data-ref="login-card">
      <div data-ref="login-step-main">
        <div class="component-card__header" data-ref="login-header">
          <h1 class="component-card__title" data-ref="login-title">${i18n.t('admin.auth.login_title')}</h1>
          <p class="component-card__subtitle" data-ref="login-subtitle">${i18n.t('admin.auth.login_subtitle')}</p>
        </div>
        <div class="component-card__body" data-ref="login-form">
          <label class="field" data-ref="field-login-email">
            <input class="field__input" data-ref="login-email" type="email" maxlength="254" placeholder=" " autocomplete="email" />
            <span class="field__label" data-ref="label-login-email">${i18n.t('auth.email')}</span>
          </label>
          <label class="field" data-ref="field-login-password">
            <input class="field__input field__input--has-action" data-ref="login-password" type="password" maxlength="128" placeholder=" " autocomplete="current-password" />
            <span class="field__label" data-ref="label-login-password">${i18n.t('auth.password')}</span>
            <button type="button" class="field__action" data-ref="toggle-login-password" aria-label="${i18n.t('auth.toggle_password')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
            </button>
          </label>
          <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-submit-login">
            ${i18n.t('auth.submit_login')}
          </button>
          ${hasExistingSession ? `
            <button type="button" class="component-button component-button--h55 component-button--w-full" data-ref="btn-back-to-panel">
              ${i18n.t('admin.auth.back_to_panel')}
            </button>
          ` : ''}
          <div class="component-banner component-banner--danger is-hidden" data-ref="login-error"></div>
        </div>
      </div>
      <div class="is-hidden" data-ref="login-step-2fa">
        <div class="component-card__header" data-ref="login-2fa-header">
          <h1 class="component-card__title" data-ref="login-2fa-title">${i18n.t('auth.two_factor_title')}</h1>
          <p class="component-card__subtitle" data-ref="login-2fa-subtitle">${i18n.t('auth.two_factor_subtitle')}</p>
        </div>
        <div class="component-card__body" data-ref="login-2fa-form">
          <label class="field" data-ref="field-login-2fa-code">
            <input class="field__input" data-ref="login-2fa-code" type="text" maxlength="20" placeholder=" " autocomplete="one-time-code" />
            <span class="field__label" data-ref="label-login-2fa-code">${i18n.t('auth.two_factor_code_placeholder')}</span>
          </label>
          <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-submit-2fa">
            ${i18n.t('auth.verify_and_login')}
          </button>
          <button type="button" class="component-button component-button--h55 component-button--w-full" data-ref="btn-back-to-credentials">
            ${i18n.t('auth.back_to_login')}
          </button>
          <div class="component-banner component-banner--danger is-hidden" data-ref="login-2fa-error"></div>
        </div>
      </div>
    </div>
  `;
  renderIcons(container);
  const controller = new AdminLoginViewController(container, onNavigate);
  controller.init();
  return container;
}

export {
  AdminLoginViewController,
  createLoginView
};
