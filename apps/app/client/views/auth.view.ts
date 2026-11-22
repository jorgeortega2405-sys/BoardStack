import { getTurnstileToken, resetTurnstile } from '../services/turnstile.service.js';
import { i18n } from '../i18n/i18n.service.js';
import { postApi, setAuthState } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';

function setupPasswordToggle(toggleBtn: HTMLElement | null, input: HTMLInputElement | null): void {
  if (!toggleBtn || !input) return;
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (input.type === 'password') {
      input.type = 'text';
    } else {
      input.type = 'password';
    }
  });
}

function setButtonLoading(btn: HTMLElement | null, isLoading: boolean): void {
  if (!btn) return;
  const buttonEl = btn as HTMLButtonElement;
  if (isLoading) {
    if (!btn.hasAttribute('data-original-html')) {
      btn.setAttribute('data-original-html', btn.innerHTML);
    }
    btn.classList.add('is-loading');
    buttonEl.disabled = true;
    btn.innerHTML = `<span class="component-spinner" data-ref="btn-spinner" aria-hidden="true"></span>`;
  } else {
    const orig = btn.getAttribute('data-original-html');
    if (orig !== null) {
      btn.innerHTML = orig;
      btn.removeAttribute('data-original-html');
    }
    btn.classList.remove('is-loading');
    buttonEl.disabled = false;
  }
}

function generateRandomUsername(): string {
  const adjectives = ['creative', 'bright', 'swift', 'zen', 'cosmic', 'smart', 'amber', 'silver', 'nova', 'solar'];
  const nouns = ['aurora', 'fox', 'lynx', 'pixel', 'wave', 'coder', 'stream', 'pulse', 'orbit', 'spark'];
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(Math.random() * 90) + 10;
  return `${randomAdj}_${randomNoun}${randomNum}`;
}

class LoginViewController {
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
    const googleBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-google-login"]');
    const forgotBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-forgot-password"]');
    const registerBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-to-register"]');
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

    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      if (err === 'google_denied') {
        showError(i18n.t('auth.google_denied'));
      } else if (err === 'google_failed' || err === 'google_token_failed') {
        showError(i18n.t('auth.google_failed'));
      } else if (err === 'session_expired') {
        showError(i18n.t('auth.session_expired'));
      }
    }

    const requires2FA = params.get('requires2FA');
    const tokenFromUrl = params.get('tempToken');
    if (requires2FA === 'true' && tokenFromUrl) {
      showTwoFaStep(tokenFromUrl);
    }

    forgotBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.onNavigate('/forgot-password');
    });

    registerBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.onNavigate('/register');
    });

    googleBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      setButtonLoading(googleBtn, true);
      window.location.href = '/api/auth/google';
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
        const turnstileToken = await getTurnstileToken();
        const res = await postApi('/api/auth/login', { email, password, turnstileToken });
        if (res.requires2FA && res.tempToken) {
          showTwoFaStep(res.tempToken);
          return;
        }

        if (res.ok && res.user) {
          setAuthState(res.user, res.accounts || []);
          this.onNavigate('/');
        } else {
          resetTurnstile();
          showError(res.error || i18n.t('auth.invalid_credentials'));
        }
      } catch (e) {
        resetTurnstile();
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
        const turnstileToken = await getTurnstileToken();
        const res = await postApi('/api/auth/login', {
          tempToken: this.currentTempToken,
          turnstileToken,
          twoFactorCode: code,
        });

        if (res.ok && res.user) {
          setAuthState(res.user, res.accounts || []);
          this.onNavigate('/');
        } else {
          showTwoFaError(res.error || i18n.t('auth.two_factor_invalid'));
        }
      } catch (e) {
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

class RegisterViewController {
  private container: HTMLElement;
  private onNavigate: (path: string) => void;

  private currentEmail = '';
  private currentPassword = '';
  private currentUsername = '';
  private registrationTicket = '';

  constructor(container: HTMLElement, onNavigate: (path: string) => void) {
    this.container = container;
    this.onNavigate = onNavigate;
  }

  public init(): void {
    const step1 = this.container.querySelector<HTMLElement>('[data-ref="register-step-1"]');
    const step2 = this.container.querySelector<HTMLElement>('[data-ref="register-step-2"]');
    const step3 = this.container.querySelector<HTMLElement>('[data-ref="register-step-3"]');

    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="register-email"]');
    const passwordInput = this.container.querySelector<HTMLInputElement>('[data-ref="register-password"]');
    const togglePasswordBtn = this.container.querySelector<HTMLElement>('[data-ref="toggle-register-password"]');
    const submitStage1 = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-stage1"]');
    const googleBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-google-register"]');
    const toLoginBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-to-login"]');
    const errorStage1 = this.container.querySelector<HTMLElement>('[data-ref="register-error-stage1"]');

    const usernameInput = this.container.querySelector<HTMLInputElement>('[data-ref="register-username"]');
    const randomUsernameBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-random-username"]');
    const submitStage2 = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-stage2"]');
    const backStage1 = this.container.querySelector<HTMLElement>('[data-ref="btn-back-stage1"]');
    const errorStage2 = this.container.querySelector<HTMLElement>('[data-ref="register-error-stage2"]');

    const codeInput = this.container.querySelector<HTMLInputElement>('[data-ref="register-code"]');
    const submitStage3 = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-stage3"]');
    const resendBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-resend-code"]');
    const restartBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-restart-register"]');
    const errorStage3 = this.container.querySelector<HTMLElement>('[data-ref="register-error-stage3"]');
    const successStage3 = this.container.querySelector<HTMLElement>('[data-ref="register-success-stage3"]');
    const verifySubtitle = this.container.querySelector<HTMLElement>('[data-ref="verify-subtitle-text"]');

    setupPasswordToggle(togglePasswordBtn, passwordInput);

    toLoginBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.onNavigate('/login');
    });

    googleBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      setButtonLoading(googleBtn, true);
      window.location.href = '/api/auth/google';
    });

    const handleStage1Submit = async () => {
      if (submitStage1?.classList.contains('is-loading')) return;
      errorStage1?.classList.add('is-hidden');

      const email = emailInput?.value.trim() || '';
      const password = passwordInput?.value || '';

      if (!email || !password) {
        if (errorStage1) {
          errorStage1.textContent = i18n.t('auth.enter_email_and_password');
          errorStage1.classList.remove('is-hidden');
        }
        return;
      }

      setButtonLoading(submitStage1 ?? null, true);
      try {
        const turnstileToken = await getTurnstileToken();
        const res = await postApi('/api/auth/validate-stage-1', { email, password, turnstileToken });
        if (res.ok) {
          this.currentEmail = email;
          this.currentPassword = password;
          this.registrationTicket = res.registrationTicket || '';
          step1?.classList.add('is-hidden');
          step2?.classList.remove('is-hidden');
          if (!usernameInput?.value) {
            usernameInput!.value = email.split('@')[0].slice(0, 20);
          }
        } else {
          resetTurnstile();
          if (errorStage1) {
            errorStage1.textContent = res.error || i18n.t('auth.invalid_data');
            errorStage1.classList.remove('is-hidden');
          }
        }
      } catch (err) {
        resetTurnstile();
        if (errorStage1) {
          errorStage1.textContent = i18n.t('auth.connection_error');
          errorStage1.classList.remove('is-hidden');
        }
      } finally {
        setButtonLoading(submitStage1 ?? null, false);
      }
    };

    submitStage1?.addEventListener('click', (e) => {
      e.preventDefault();
      void handleStage1Submit();
    });

    passwordInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleStage1Submit();
      }
    });

    randomUsernameBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (usernameInput) {
        usernameInput.value = generateRandomUsername();
      }
    });

    backStage1?.addEventListener('click', (e) => {
      e.preventDefault();
      step2?.classList.add('is-hidden');
      step1?.classList.remove('is-hidden');
    });

    submitStage2?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (submitStage2.classList.contains('is-loading')) return;
      errorStage2?.classList.add('is-hidden');

      const username = usernameInput?.value.trim() || '';
      if (!username) {
        if (errorStage2) {
          errorStage2.textContent = i18n.t('auth.enter_username');
          errorStage2.classList.remove('is-hidden');
        }
        return;
      }

      this.currentUsername = username;
      setButtonLoading(submitStage2, true);
      try {
        const res = await postApi('/api/auth/register-send-code', {
          email: this.currentEmail,
          password: this.currentPassword,
          registrationTicket: this.registrationTicket,
          username: this.currentUsername,
        });

        if (res.ok) {
          if (verifySubtitle) {
            verifySubtitle.textContent = i18n.t('auth.sent_code_to', { email: this.currentEmail });
          }
          step2?.classList.add('is-hidden');
          step3?.classList.remove('is-hidden');
        } else {
          if (errorStage2) {
            errorStage2.textContent = res.error || i18n.t('auth.error_sending_code');
            errorStage2.classList.remove('is-hidden');
          }
        }
      } catch {
        if (errorStage2) {
          errorStage2.textContent = i18n.t('auth.connection_error');
          errorStage2.classList.remove('is-hidden');
        }
      } finally {
        setButtonLoading(submitStage2, false);
      }
    });

    resendBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (resendBtn.classList.contains('is-loading')) return;
      errorStage3?.classList.add('is-hidden');
      successStage3?.classList.add('is-hidden');

      setButtonLoading(resendBtn, true);
      try {
        const res = await postApi('/api/auth/resend-code', {
          email: this.currentEmail,
          registrationTicket: this.registrationTicket,
        });
        if (res.ok) {
          if (successStage3) {
            successStage3.textContent = i18n.t('auth.new_code_sent');
            successStage3.classList.remove('is-hidden');
          }
        } else {
          if (errorStage3) {
            errorStage3.textContent = res.error || i18n.t('auth.error_resending_code');
            errorStage3.classList.remove('is-hidden');
          }
        }
      } catch {
        if (errorStage3) {
          errorStage3.textContent = i18n.t('auth.connection_error');
          errorStage3.classList.remove('is-hidden');
        }
      } finally {
        setButtonLoading(resendBtn, false);
      }
    });

    restartBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      step3?.classList.add('is-hidden');
      step2?.classList.add('is-hidden');
      step1?.classList.remove('is-hidden');
    });

    submitStage3?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (submitStage3.classList.contains('is-loading')) return;
      errorStage3?.classList.add('is-hidden');
      successStage3?.classList.add('is-hidden');

      const code = codeInput?.value.trim() || '';
      if (!code) {
        if (errorStage3) {
          errorStage3.textContent = i18n.t('auth.enter_six_digit_code');
          errorStage3.classList.remove('is-hidden');
        }
        return;
      }

      setButtonLoading(submitStage3, true);
      try {
        const res = await postApi('/api/auth/register-verify', {
          code,
          email: this.currentEmail,
        });

        if (res.ok && res.user) {
          setAuthState(res.user, res.accounts || []);
          this.onNavigate('/');
        } else {
          if (errorStage3) {
            errorStage3.textContent = res.error || i18n.t('auth.code_invalid_or_expired');
            errorStage3.classList.remove('is-hidden');
          }
        }
      } catch {
        if (errorStage3) {
          errorStage3.textContent = i18n.t('auth.connection_error');
          errorStage3.classList.remove('is-hidden');
        }
      } finally {
        setButtonLoading(submitStage3, false);
      }
    });
  }
}

class ForgotPasswordViewController {
  private container: HTMLElement;
  private onNavigate: (path: string) => void;

  constructor(container: HTMLElement, onNavigate: (path: string) => void) {
    this.container = container;
    this.onNavigate = onNavigate;
  }

  public init(): void {
    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="forgot-email"]');
    const submitBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-forgot"]');
    const toLoginBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-forgot-to-login"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="forgot-error"]');
    const successBanner = this.container.querySelector<HTMLElement>('[data-ref="forgot-success"]');

    toLoginBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.onNavigate('/login');
    });

    submitBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (submitBtn.classList.contains('is-loading')) return;
      errorBanner?.classList.add('is-hidden');
      successBanner?.classList.add('is-hidden');

      const email = emailInput?.value.trim() || '';
      if (!email) {
        if (errorBanner) {
          errorBanner.textContent = i18n.t('auth.enter_email');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      setButtonLoading(submitBtn, true);
      try {
        const turnstileToken = await getTurnstileToken();
        const res = await postApi('/api/auth/forgot-password', { email, turnstileToken });
        if (res.ok) {
          if (successBanner) {
            successBanner.textContent = res.message || i18n.t('auth.reset_link_sent');
            successBanner.classList.remove('is-hidden');
          }
        } else {
          resetTurnstile();
          if (errorBanner) {
            errorBanner.textContent = res.error || i18n.t('auth.error_processing_request');
            errorBanner.classList.remove('is-hidden');
          }
        }
      } catch (err) {
        resetTurnstile();
        if (errorBanner) {
          errorBanner.textContent = i18n.t('auth.connection_error');
          errorBanner.classList.remove('is-hidden');
        }
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  }
}

class ResetPasswordViewController {
  private container: HTMLElement;
  private onNavigate: (path: string) => void;

  constructor(container: HTMLElement, onNavigate: (path: string) => void) {
    this.container = container;
    this.onNavigate = onNavigate;
  }

  public init(): void {
    const passwordInput = this.container.querySelector<HTMLInputElement>('[data-ref="reset-password"]');
    const togglePasswordBtn = this.container.querySelector<HTMLElement>('[data-ref="toggle-reset-password"]');
    const confirmPasswordInput = this.container.querySelector<HTMLInputElement>('[data-ref="reset-password-confirm"]');
    const toggleConfirmPasswordBtn = this.container.querySelector<HTMLElement>('[data-ref="toggle-reset-password-confirm"]');
    const submitBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-reset"]');
    const toLoginBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-reset-to-login"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="reset-error"]');
    const successBanner = this.container.querySelector<HTMLElement>('[data-ref="reset-success"]');

    setupPasswordToggle(togglePasswordBtn, passwordInput);
    setupPasswordToggle(toggleConfirmPasswordBtn, confirmPasswordInput);

    toLoginBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.onNavigate('/login');
    });

    submitBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (submitBtn.classList.contains('is-loading')) return;
      errorBanner?.classList.add('is-hidden');
      successBanner?.classList.add('is-hidden');

      const params = new URLSearchParams(window.location.search);
      const email = params.get('email') || '';
      const token = params.get('token') || '';

      const newPassword = passwordInput?.value || '';
      const confirmPassword = confirmPasswordInput?.value || '';

      if (!email || !token) {
        if (errorBanner) {
          errorBanner.textContent = i18n.t('auth.invalid_reset_link');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      if (newPassword.length < 8) {
        if (errorBanner) {
          errorBanner.textContent = i18n.t('auth.password_min_length');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      if (newPassword !== confirmPassword) {
        if (errorBanner) {
          errorBanner.textContent = i18n.t('auth.passwords_dont_match');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      setButtonLoading(submitBtn, true);
      try {
        const turnstileToken = await getTurnstileToken();
        const res = await postApi('/api/auth/reset-password', {
          confirmPassword,
          email,
          newPassword,
          token,
          turnstileToken,
        });

        if (res.ok) {
          if (successBanner) {
            successBanner.textContent = res.message || i18n.t('auth.password_updated_success');
            successBanner.classList.remove('is-hidden');
          }
        } else {
          resetTurnstile();
          if (errorBanner) {
            errorBanner.textContent = res.error || i18n.t('auth.error_resetting_password');
            errorBanner.classList.remove('is-hidden');
          }
        }
      } catch (err) {
        resetTurnstile();
        if (errorBanner) {
          errorBanner.textContent = i18n.t('auth.connection_error');
          errorBanner.classList.remove('is-hidden');
        }
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  }
}

async function createLoginView(onNavigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--auth';
  container.setAttribute('data-ref', 'login-wrapper');
  container.innerHTML = `
    <a class="component-brand" data-ref="login-home-link" href="/" aria-label="${i18n.t('nav.home')}" title="BoardStack">
      <img class="component-brand__img" data-ref="logo-img" alt="BoardStack" src="/logo.svg" />
    </a>
    <div class="component-card component-card--auth" data-ref="login-card">
      <div data-ref="login-step-main">
        <div class="component-card__header" data-ref="login-header">
          <h1 class="component-card__title" data-ref="login-title">${i18n.t('auth.login_title')}</h1>
          <p class="component-card__subtitle" data-ref="login-subtitle">${i18n.t('auth.login_subtitle')}</p>
        </div>
        <div class="component-card__body" data-ref="login-form">
          <label class="field" data-ref="field-login-email">
            <input class="field__input" data-ref="login-email" type="email" maxlength="254" placeholder=" " autocomplete="email" />
            <span class="field__label" data-ref="label-login-email">${i18n.t('auth.email')}</span>
          </label>
          <label class="field" data-ref="field-login-password">
            <input class="field__input field__input--has-action" data-ref="login-password" type="password" maxlength="128" placeholder=" " autocomplete="current-password" />
            <span class="field__label" data-ref="label-login-password">${i18n.t('auth.password')}</span>
            <button type="button" class="field__action" data-ref="toggle-login-password" aria-label="${i18n.t('auth.cancel_password_toggle')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
            </button>
          </label>
          <div class="component-link-row" data-ref="login-forgot-row">
            <a class="component-link" data-ref="btn-forgot-password" href="/forgot-password">${i18n.t('auth.forgot_password')}</a>
          </div>
          <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-submit-login">
            ${i18n.t('auth.submit_login')}
          </button>
          <button type="button" class="component-button component-button--h55 component-button--w-full" data-ref="btn-google-login">
            <svg class="component-icon component-icon--colored" data-ref="google-icon" width="20" height="20" aria-hidden="true"><use href="/icons.svg#google_colored"></use></svg>
            <span class="component-button__text" data-ref="google-btn-text">${i18n.t('auth.continue_google')}</span>
          </button>
          <div class="component-banner component-banner--danger is-hidden" data-ref="login-error"></div>
          <p class="component-note" data-ref="login-footer">
            <span>${i18n.t('auth.no_account')}</span>
            <a class="component-link component-link--primary" data-ref="btn-to-register" href="/register">${i18n.t('auth.create_account')}</a>
          </p>
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
  const controller = new LoginViewController(container, onNavigate);
  controller.init();
  return container;
}

async function createRegisterView(onNavigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--auth';
  container.setAttribute('data-ref', 'register-wrapper');
  container.innerHTML = `
    <a class="component-brand" data-ref="register-home-link" href="/" aria-label="${i18n.t('nav.home')}" title="BoardStack">
      <img class="component-brand__img" data-ref="logo-img" alt="BoardStack" src="/logo.svg" />
    </a>
    <div class="component-card component-card--auth" data-ref="register-card">
      <div data-ref="register-step-1">
        <div class="component-card__header" data-ref="register-header-1">
          <h1 class="component-card__title" data-ref="register-title-1">${i18n.t('auth.step1_title')}</h1>
          <p class="component-card__subtitle" data-ref="register-subtitle-1">${i18n.t('auth.step1_subtitle')}</p>
        </div>
        <div class="component-card__body" data-ref="register-form-1">
          <label class="field" data-ref="field-register-email">
            <input class="field__input" data-ref="register-email" type="email" maxlength="254" placeholder=" " autocomplete="email" />
            <span class="field__label" data-ref="label-register-email">${i18n.t('auth.email')}</span>
          </label>
          <label class="field" data-ref="field-register-password">
            <input class="field__input field__input--has-action" data-ref="register-password" type="password" maxlength="128" placeholder=" " autocomplete="new-password" />
            <span class="field__label" data-ref="label-register-password">${i18n.t('auth.password')}</span>
            <button type="button" class="field__action" data-ref="toggle-register-password" aria-label="${i18n.t('auth.cancel_password_toggle')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
            </button>
          </label>
          <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-submit-stage1">
            ${i18n.t('auth.continue')}
          </button>
          <button type="button" class="component-button component-button--h55 component-button--w-full" data-ref="btn-google-register">
            <svg class="component-icon component-icon--colored" data-ref="google-icon" width="20" height="20" aria-hidden="true"><use href="/icons.svg#google_colored"></use></svg>
            <span class="component-button__text" data-ref="google-btn-text">${i18n.t('auth.continue_google')}</span>
          </button>
          <div class="component-banner component-banner--danger is-hidden" data-ref="register-error-stage1"></div>
          <p class="component-note" data-ref="register-footer-1">
            <span>${i18n.t('auth.have_account')}</span>
            <a class="component-link component-link--primary" data-ref="btn-to-login" href="/login">${i18n.t('auth.login_title')}</a>
          </p>
        </div>
      </div>
      <div class="is-hidden" data-ref="register-step-2">
        <div class="component-card__header" data-ref="register-header-2">
          <h1 class="component-card__title" data-ref="register-title-2">${i18n.t('auth.step2_title')}</h1>
          <p class="component-card__subtitle" data-ref="register-subtitle-2">${i18n.t('auth.step2_subtitle')}</p>
        </div>
        <div class="component-card__body" data-ref="register-form-2">
          <label class="field" data-ref="field-register-username">
            <input class="field__input field__input--has-action" data-ref="register-username" type="text" maxlength="30" placeholder=" " autocomplete="username" />
            <span class="field__label" data-ref="label-register-username">${i18n.t('auth.username')}</span>
            <button type="button" class="field__action" data-ref="btn-random-username" aria-label="${i18n.t('auth.random_username')}" title="${i18n.t('auth.random_username')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_fix_high"></use></svg>
            </button>
          </label>
          <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-submit-stage2">
            ${i18n.t('auth.send_verification_code')}
          </button>
          <div class="component-banner component-banner--danger is-hidden" data-ref="register-error-stage2"></div>
          <div class="component-link-row" data-ref="stage2-back-row">
            <a class="component-link" data-ref="btn-back-stage1" href="/register">${i18n.t('auth.back_stage1')}</a>
          </div>
        </div>
      </div>
      <div class="is-hidden" data-ref="register-step-3">
        <div class="component-card__header" data-ref="register-header-3">
          <h1 class="component-card__title" data-ref="register-title-3">${i18n.t('auth.step3_title')}</h1>
          <p class="component-card__subtitle" data-ref="register-subtitle-3">
            <span data-ref="verify-subtitle-text">${i18n.t('auth.step3_subtitle')}</span>
          </p>
        </div>
        <div class="component-card__body" data-ref="register-form-3">
          <label class="field" data-ref="field-register-code">
            <input class="field__input field__input--code" data-ref="register-code" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder=" " autocomplete="one-time-code" />
            <span class="field__label" data-ref="label-register-code">${i18n.t('auth.digit_code')}</span>
          </label>
          <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-submit-stage3">
            ${i18n.t('auth.complete_registration')}
          </button>
          <button type="button" class="component-button component-button--h40 component-button--secondary component-button--w-full" data-ref="btn-resend-code">
            ${i18n.t('auth.resend_code')}
          </button>
          <div class="component-banner component-banner--danger is-hidden" data-ref="register-error-stage3"></div>
          <div class="component-banner component-banner--success is-hidden" data-ref="register-success-stage3"></div>
          <div class="component-link-row" data-ref="stage3-back-row">
            <a class="component-link" data-ref="btn-restart-register" href="/register">${i18n.t('auth.restart_registration')}</a>
          </div>
        </div>
      </div>
    </div>
  `;
  renderIcons(container);
  const controller = new RegisterViewController(container, onNavigate);
  controller.init();
  return container;
}

async function createForgotPasswordView(onNavigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--auth';
  container.setAttribute('data-ref', 'forgot-wrapper');
  container.innerHTML = `
    <a class="component-brand" data-ref="forgot-home-link" href="/" aria-label="${i18n.t('nav.home')}" title="BoardStack">
      <img class="component-brand__img" data-ref="logo-img" alt="BoardStack" src="/logo.svg" />
    </a>
    <div class="component-card component-card--auth" data-ref="forgot-card">
      <div data-ref="forgot-step-main">
        <div class="component-card__header" data-ref="forgot-header">
          <h1 class="component-card__title" data-ref="forgot-title">${i18n.t('auth.forgot_title')}</h1>
          <p class="component-card__subtitle" data-ref="forgot-subtitle">${i18n.t('auth.forgot_password_desc')}</p>
        </div>
        <div class="component-card__body" data-ref="forgot-form">
          <label class="field" data-ref="field-forgot-email">
            <input class="field__input" data-ref="forgot-email" type="email" maxlength="254" placeholder=" " autocomplete="email" />
            <span class="field__label" data-ref="label-forgot-email">${i18n.t('auth.email')}</span>
          </label>
          <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-submit-forgot">
            ${i18n.t('auth.submit_forgot')}
          </button>
          <div class="component-banner component-banner--danger is-hidden" data-ref="forgot-error"></div>
          <div class="component-banner component-banner--success is-hidden" data-ref="forgot-success"></div>
          <p class="component-note" data-ref="forgot-footer">
            <span>${i18n.t('auth.remember_password')}</span>
            <a class="component-link component-link--primary" data-ref="btn-forgot-to-login" href="/login">${i18n.t('auth.login_title')}</a>
          </p>
        </div>
      </div>
    </div>
  `;
  renderIcons(container);
  const controller = new ForgotPasswordViewController(container, onNavigate);
  controller.init();
  return container;
}

async function createResetPasswordView(onNavigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--auth';
  container.setAttribute('data-ref', 'reset-wrapper');
  container.innerHTML = `
    <a class="component-brand" data-ref="reset-home-link" href="/" aria-label="${i18n.t('nav.home')}" title="BoardStack">
      <img class="component-brand__img" data-ref="logo-img" alt="BoardStack" src="/logo.svg" />
    </a>
    <div class="component-card component-card--auth" data-ref="reset-card">
      <div data-ref="reset-step-main">
        <div class="component-card__header" data-ref="reset-header">
          <h1 class="component-card__title" data-ref="reset-title">${i18n.t('auth.reset_title')}</h1>
          <p class="component-card__subtitle" data-ref="reset-subtitle">${i18n.t('auth.reset_password_desc')}</p>
        </div>
        <div class="component-card__body" data-ref="reset-form">
          <label class="field" data-ref="field-reset-password">
            <input class="field__input field__input--has-action" data-ref="reset-password" type="password" maxlength="128" placeholder=" " autocomplete="new-password" />
            <span class="field__label" data-ref="label-reset-password">${i18n.t('auth.new_password')}</span>
            <button type="button" class="field__action" data-ref="toggle-reset-password" aria-label="${i18n.t('auth.cancel_password_toggle')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
            </button>
          </label>
          <label class="field" data-ref="field-reset-password-confirm">
            <input class="field__input field__input--has-action" data-ref="reset-password-confirm" type="password" maxlength="128" placeholder=" " autocomplete="new-password" />
            <span class="field__label" data-ref="label-reset-password-confirm">${i18n.t('auth.new_password_confirm')}</span>
            <button type="button" class="field__action" data-ref="toggle-reset-password-confirm" aria-label="${i18n.t('auth.cancel_password_toggle')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
            </button>
          </label>
          <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-submit-reset">
            ${i18n.t('auth.submit_reset')}
          </button>
          <div class="component-banner component-banner--danger is-hidden" data-ref="reset-error"></div>
          <div class="component-banner component-banner--success is-hidden" data-ref="reset-success"></div>
          <p class="component-note" data-ref="reset-footer">
            <span>${i18n.t('auth.ready_to_login')}</span>
            <a class="component-link component-link--primary" data-ref="btn-reset-to-login" href="/login">${i18n.t('auth.login_title')}</a>
          </p>
        </div>
      </div>
    </div>
  `;
  renderIcons(container);
  const controller = new ResetPasswordViewController(container, onNavigate);
  controller.init();
  return container;
}

export {
  ForgotPasswordViewController,
  LoginViewController,
  RegisterViewController,
  ResetPasswordViewController,
  createForgotPasswordView,
  createLoginView,
  createRegisterView,
  createResetPasswordView
};