import { postApi, setAuthState } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { createBannerManager, setupPasswordToggle, withButtonLoading } from '../utils/dom.util.js';
import { validateEmail, validatePassword, validateUsername, validateVerificationCode } from '../utils/validators.util.js';

interface RegistrationFlowState {
  email?: string;
  password?: string;
  step?: number;
  username?: string;
}

const REG_STORAGE_KEY = 'boardpdf_reg_flow';

function getRegistrationState(): RegistrationFlowState {
  try {
    const raw = sessionStorage.getItem(REG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStage1Data(email: string, password: string): void {
  const current = getRegistrationState();
  const updated: RegistrationFlowState = {
    ...current,
    email: email.trim().toLowerCase(),
    password: String(password),
    step: 2,
  };
  sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify(updated));
}

function saveStage2Data(username: string): void {
  const current = getRegistrationState();
  const updated: RegistrationFlowState = {
    ...current,
    step: 3,
    username: username.trim(),
  };
  sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify(updated));
}

function clearRegistrationState(): void {
  sessionStorage.removeItem(REG_STORAGE_KEY);
}

class LoginViewController implements ViewController {
  private abortController: AbortController;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.abortController = new AbortController();
    this.container = container;
  }

  init(): void {
    this.bindEvents();
    renderIcons(this.container);
  }

  bindEvents(): void {
    const { signal } = this.abortController;

    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="login-email"]');
    const passwordInput = this.container.querySelector<HTMLInputElement>('[data-ref="login-password"]');
    const togglePasswordBtn = this.container.querySelector<HTMLElement>('[data-ref="toggle-login-password"]');
    const submitBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-login"]');
    const banners = createBannerManager(this.container, { errorRef: 'login-error' });

    setupPasswordToggle(togglePasswordBtn, passwordInput);

    const executeLogin = async () => {
      banners.hideAll();
      const email = emailInput?.value.trim() || '';
      const password = passwordInput?.value || '';

      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        banners.showError(emailValidation.error || 'Ingresa un correo válido.');
        return;
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        banners.showError(passwordValidation.error || 'Ingresa una contraseña válida.');
        return;
      }

      await withButtonLoading(submitBtn, 'Iniciando sesión...', async () => {
        try {
          const res = await postApi('/api/auth/login', { email, password });
          const data = await res.json();

          if (!res.ok) {
            banners.showError(data.error || 'Credenciales inválidas.');
            return;
          }

          setAuthState(data.user, data.accounts || []);
          showToast(`¡Bienvenido de nuevo, ${data.user.username}!`, 'success');
          navigate('/');
        } catch {
          banners.showError('Error de conexión al iniciar sesión.');
        }
      });
    };

    submitBtn?.addEventListener('click', executeLogin, { signal });

    const handleKeyEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void executeLogin();
      }
    };

    emailInput?.addEventListener('keydown', handleKeyEnter, { signal });
    passwordInput?.addEventListener('keydown', handleKeyEnter, { signal });

    const homeLink = this.container.querySelector<HTMLElement>('[data-ref="login-home-link"]');
    homeLink?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/');
    }, { signal });

    const forgotBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-forgot-password"]');
    forgotBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/forgot-password');
    }, { signal });

    const registerBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-to-register"]');
    registerBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/register');
    }, { signal });
  }

  destroy(): void {
    this.abortController.abort();
  }
}

class RegisterViewController implements ViewController {
  private abortController: AbortController;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.abortController = new AbortController();
    this.container = container;
  }

  init(): void {
    this.bindEvents();
    renderIcons(this.container);
  }

  bindEvents(): void {
    const { signal } = this.abortController;

    const step1 = this.container.querySelector<HTMLElement>('[data-ref="register-step-1"]');
    const step2 = this.container.querySelector<HTMLElement>('[data-ref="register-step-2"]');
    const step3 = this.container.querySelector<HTMLElement>('[data-ref="register-step-3"]');

    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="register-email"]');
    const passwordInput = this.container.querySelector<HTMLInputElement>('[data-ref="register-password"]');
    const togglePasswordBtn = this.container.querySelector<HTMLElement>('[data-ref="toggle-register-password"]');
    const submitStage1Btn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-stage1"]');
    const bannersStage1 = createBannerManager(this.container, { errorRef: 'register-error-stage1' });

    const usernameInput = this.container.querySelector<HTMLInputElement>('[data-ref="register-username"]');
    const randomUsernameBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-random-username"]');
    const submitStage2Btn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-stage2"]');
    const btnBackStage1 = this.container.querySelector<HTMLElement>('[data-ref="btn-back-stage1"]');
    const bannersStage2 = createBannerManager(this.container, { errorRef: 'register-error-stage2' });

    const subtitleTextEl = this.container.querySelector<HTMLElement>('[data-ref="verify-subtitle-text"]');
    const codeInput = this.container.querySelector<HTMLInputElement>('[data-ref="register-code"]');
    const submitStage3Btn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-stage3"]');
    const resendCodeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-resend-code"]');
    const restartBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-restart-register"]');
    const bannersStage3 = createBannerManager(this.container, {
      errorRef: 'register-error-stage3',
      successRef: 'register-success-stage3',
    });

    setupPasswordToggle(togglePasswordBtn, passwordInput);

    const activateStage = (stageNum: number) => {
      bannersStage1.hideAll();
      bannersStage2.hideAll();
      bannersStage3.hideAll();

      if (step1) step1.style.display = stageNum === 1 ? 'block' : 'none';
      if (step2) step2.style.display = stageNum === 2 ? 'block' : 'none';
      if (step3) step3.style.display = stageNum === 3 ? 'block' : 'none';

      if (stageNum === 1) {
        requestAnimationFrame(() => emailInput?.focus());
      } else if (stageNum === 2) {
        requestAnimationFrame(() => usernameInput?.focus());
      } else if (stageNum === 3) {
        const state = getRegistrationState();
        if (subtitleTextEl) {
          subtitleTextEl.textContent = `Enviamos un código de verificación de 6 dígitos a ${state.email || ''}.`;
        }
        requestAnimationFrame(() => codeInput?.focus());
      }
    };

    const savedState = getRegistrationState();
    if (savedState.email && emailInput) emailInput.value = savedState.email;
    if (savedState.username && usernameInput) usernameInput.value = savedState.username;

    if (savedState.step === 3 && savedState.email && savedState.password && savedState.username) {
      activateStage(3);
    } else if (savedState.step === 2 && savedState.email && savedState.password) {
      activateStage(2);
    } else {
      activateStage(1);
    }

    const executeStage1 = async () => {
      bannersStage1.hideAll();
      const email = emailInput?.value.trim() || '';
      const password = passwordInput?.value || '';

      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        bannersStage1.showError(emailValidation.error || 'Ingresa un correo válido.');
        return;
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        bannersStage1.showError(passwordValidation.error || 'Ingresa una contraseña válida.');
        return;
      }

      await withButtonLoading(submitStage1Btn, 'Validando...', async () => {
        try {
          const res = await postApi('/api/auth/validate-stage-1', { email, password });
          const data = await res.json();

          if (!res.ok) {
            bannersStage1.showError(data.error || 'Error al validar datos.');
            return;
          }

          saveStage1Data(email, password);
          activateStage(2);
        } catch {
          bannersStage1.showError('Error de conexión al validar datos.');
        }
      });
    };

    submitStage1Btn?.addEventListener('click', executeStage1, { signal });

    const handleStage1Enter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void executeStage1();
      }
    };
    emailInput?.addEventListener('keydown', handleStage1Enter, { signal });
    passwordInput?.addEventListener('keydown', handleStage1Enter, { signal });

    randomUsernameBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const timestamp = Date.now().toString(36);
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const randomName = `user_${timestamp}_${randomSuffix}`;
      if (usernameInput) {
        usernameInput.value = randomName;
        usernameInput.focus();
      }
      bannersStage2.hideAll();
    }, { signal });

    const executeStage2 = async () => {
      bannersStage2.hideAll();
      const currentState = getRegistrationState();
      const username = usernameInput?.value.trim() || '';

      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        bannersStage2.showError(usernameValidation.error || 'Ingresa un nombre de usuario válido.');
        return;
      }

      await withButtonLoading(submitStage2Btn, 'Enviando código...', async () => {
        try {
          const res = await postApi('/api/auth/register-send-code', {
            email: currentState.email,
            password: currentState.password,
            username,
          });

          const data = await res.json();

          if (!res.ok) {
            bannersStage2.showError(data.error || 'Error al enviar código.');
            return;
          }

          saveStage2Data(username);
          activateStage(3);
        } catch {
          bannersStage2.showError('Error de conexión al enviar código.');
        }
      });
    };

    submitStage2Btn?.addEventListener('click', executeStage2, { signal });

    usernameInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void executeStage2();
      }
    }, { signal });

    btnBackStage1?.addEventListener('click', (e) => {
      e.preventDefault();
      activateStage(1);
    }, { signal });

    const executeStage3 = async () => {
      bannersStage3.hideAll();
      const currentState = getRegistrationState();
      const code = codeInput?.value.trim() || '';

      const codeValidation = validateVerificationCode(code);
      if (!codeValidation.valid) {
        bannersStage3.showError(codeValidation.error || 'Ingresa un código de 6 dígitos.');
        return;
      }

      await withButtonLoading(submitStage3Btn, 'Verificando...', async () => {
        try {
          const res = await postApi('/api/auth/register-verify', {
            code,
            email: currentState.email,
          });

          const data = await res.json();

          if (!res.ok) {
            bannersStage3.showError(data.error || 'Código incorrecto o expirado.');
            return;
          }

          setAuthState(data.user, data.accounts || []);
          clearRegistrationState();
          showToast(`¡Bienvenido a BoardPDF, ${data.user.username}!`, 'success');
          navigate('/');
        } catch {
          bannersStage3.showError('Error de conexión al verificar código.');
        }
      });
    };

    submitStage3Btn?.addEventListener('click', executeStage3, { signal });

    codeInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void executeStage3();
      }
    }, { signal });

    resendCodeBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      bannersStage3.hideAll();
      const currentState = getRegistrationState();

      await withButtonLoading(resendCodeBtn, 'Reenviando...', async () => {
        try {
          const res = await postApi('/api/auth/resend-code', {
            email: currentState.email,
          });
          const data = await res.json();

          if (!res.ok) {
            bannersStage3.showError(data.error || 'No se pudo reenviar el código.');
            return;
          }

          bannersStage3.showSuccess(data.message || 'Nuevo código enviado exitosamente.');
        } catch {
          bannersStage3.showError('Error de conexión al reenviar código.');
        }
      });
    }, { signal });

    restartBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      clearRegistrationState();
      activateStage(1);
    }, { signal });

    const homeLink = this.container.querySelector<HTMLElement>('[data-ref="register-home-link"]');
    homeLink?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/');
    }, { signal });

    const loginBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-to-login"]');
    loginBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/login');
    }, { signal });
  }

  destroy(): void {
    this.abortController.abort();
  }
}

class ForgotPasswordViewController implements ViewController {
  private abortController: AbortController;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.abortController = new AbortController();
    this.container = container;
  }

  init(): void {
    this.bindEvents();
    renderIcons(this.container);
  }

  bindEvents(): void {
    const { signal } = this.abortController;

    const homeLink = this.container.querySelector<HTMLElement>('[data-ref="forgot-home-link"]');
    homeLink?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/');
    }, { signal });

    const loginBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-forgot-to-login"]');
    loginBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/login');
    }, { signal });
  }

  destroy(): void {
    this.abortController.abort();
  }
}

class ResetPasswordViewController implements ViewController {
  private abortController: AbortController;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.abortController = new AbortController();
    this.container = container;
  }

  init(): void {
    this.bindEvents();
    renderIcons(this.container);
  }

  bindEvents(): void {
    const { signal } = this.abortController;

    const passwordInput = this.container.querySelector<HTMLInputElement>('[data-ref="reset-password"]');
    const togglePasswordBtn = this.container.querySelector<HTMLElement>('[data-ref="toggle-reset-password"]');
    setupPasswordToggle(togglePasswordBtn, passwordInput);

    const confirmPasswordInput = this.container.querySelector<HTMLInputElement>('[data-ref="reset-password-confirm"]');
    const toggleConfirmPasswordBtn = this.container.querySelector<HTMLElement>('[data-ref="toggle-reset-password-confirm"]');
    setupPasswordToggle(toggleConfirmPasswordBtn, confirmPasswordInput);

    const homeLink = this.container.querySelector<HTMLElement>('[data-ref="reset-home-link"]');
    homeLink?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/');
    }, { signal });

    const loginBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-reset-to-login"]');
    loginBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/login');
    }, { signal });
  }

  destroy(): void {
    this.abortController.abort();
  }
}

export async function createLoginView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/auth/login.html');
  const controller = new LoginViewController(container);
  controller.init();
  (container as unknown as { __controller: ViewController }).__controller = controller;
  return container;
}

export async function createRegisterView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/auth/register.html');
  const controller = new RegisterViewController(container);
  controller.init();
  (container as unknown as { __controller: ViewController }).__controller = controller;
  return container;
}

export async function createForgotPasswordView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/auth/forgot-password.html');
  const controller = new ForgotPasswordViewController(container);
  controller.init();
  (container as unknown as { __controller: ViewController }).__controller = controller;
  return container;
}

export async function createResetPasswordView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/auth/reset-password.html');
  const controller = new ResetPasswordViewController(container);
  controller.init();
  (container as unknown as { __controller: ViewController }).__controller = controller;
  return container;
}
