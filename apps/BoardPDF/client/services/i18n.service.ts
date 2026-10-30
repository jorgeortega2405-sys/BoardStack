import { DEFAULT_LANGUAGE, detectBrowserLanguage, isSupportedLanguage, normalizeLanguageCode } from '../utils/languages.util.js';

let currentLanguage = DEFAULT_LANGUAGE;
let currentTranslations: Record<string, unknown> = {};

const FALLBACK_TRANSLATIONS: Record<string, unknown> = {
  app: {
    loading: 'Cargando...',
    name: 'BoardPDF',
    tagline: 'Sistema SPA Modular',
  },
  auth: {
    forgot_password: {
      email_label: 'Correo electrónico',
      loading: 'Enviando enlace...',
      login_link: 'Iniciar sesión',
      remembered: '¿Recordaste tu contraseña?',
      submit_btn: 'Continuar',
      subtitle: 'Ingresa tu correo electrónico para enviarte las instrucciones de recuperación',
      success_msg: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.',
      title: '¿Olvidaste tu contraseña?',
    },
    login: {
      add_account_btn: 'Agregar cuenta',
      add_account_loading: 'Agregando cuenta...',
      add_account_subtitle: 'Ingresa las credenciales de la cuenta que deseas agregar para alternar fácilmente',
      add_account_title: 'Agregar otra cuenta',
      create_account: 'Crear cuenta',
      desktop_email_btn: 'Usar correo electrónico',
      desktop_google_btn: 'Continuar con Google',
      desktop_handoff_btn: 'Abrir BoardPDF',
      desktop_handoff_subtitle: 'Hemos verificado tu sesión. Ya puedes volver a la aplicación de escritorio.',
      desktop_handoff_title: 'Conectando con BoardPDF...',
      desktop_handoff_web_link: 'Continuar en la versión web',
      desktop_manual_link: 'Ingresar directamente en la aplicación',
      desktop_subtitle: 'Elige cómo deseas acceder a tu cuenta',
      desktop_title: 'Iniciar sesión en BoardPDF',
      email_label: 'Correo electrónico',
      forgot_password: '¿Olvidaste la contraseña?',
      google_btn: 'Continuar con Google',
      hide_password: 'Ocultar contraseña',
      loading: 'Iniciando sesión...',
      no_account: '¿No tienes una cuenta?',
      password_label: 'Contraseña',
      show_password: 'Mostrar contraseña',
      sso_btn: 'Continuar con SSO',
      sso_btn_team: 'Continuar con SSO ({team})',
      submit_btn: 'Continuar',
      subtitle: 'Ingresa tus credenciales para acceder a tu cuenta',
      title: 'Bienvenido de vuelta',
      toggle_password: 'Alternar visibilidad',
    },
    login_2fa: {
      back_to_login: 'Volver a iniciar sesión',
      code_label: 'Código de verificación',
      code_required: 'Ingresa el código de verificación o código de respaldo.',
      loading: 'Verificando...',
      session_expired: 'La sesión de verificación ha expirado. Inicia sesión nuevamente.',
      submit_btn: 'Verificar',
      subtitle: 'Ingresa el código de 6 dígitos de tu aplicación de autenticación o usa un código de respaldo.',
      title: 'Verificación de dos pasos',
    },
    login_required: 'Inicia sesión para continuar.',
    register: {
      email_label: 'Correo electrónico',
      google_btn: 'Continuar con Google',
      have_account: '¿Ya tienes una cuenta?',
      loading: 'Comprobando...',
      login_link: 'Iniciar sesión',
      password_label: 'Contraseña (mínimo 8 caracteres)',
      submit_btn: 'Continuar',
      subtitle: 'Ingresa tu correo y contraseña para comenzar',
      title: 'Crear cuenta',
    },
    register_stage2: {
      back_btn: '← Volver al paso anterior',
      loading: 'Guardando...',
      random_username_aria: 'Generar nombre aleatorio',
      random_username_tooltip: 'Generar nombre aleatorio',
      submit_btn: 'Continuar',
      subtitle: 'Elige un nombre de usuario para tu perfil en BoardPDF',
      title: '¿Cómo te llamas?',
      username_label: 'Nombre de usuario',
    },
    register_stage3: {
      code_label: 'Código de 6 dígitos',
      code_sent: 'Código de verificación reenviado exitosamente.',
      loading: 'Verificando...',
      resend_btn: '¿No recibiste el código? Reenviar',
      resending: 'Reenviando...',
      restart_btn: '← Iniciar registro de nuevo',
      submit_btn: 'Verificar cuenta',
      subtitle: 'Hemos enviado un código de 6 dígitos a <strong class="text-highlight" data-ref="verify-target-email">{email}</strong>. Es válido durante 15 minutos.',
      title: 'Revisa tu correo',
    },
    reset_password: {
      confirm_password_label: 'Confirmar nueva contraseña',
      loading: 'Actualizando...',
      login_link: 'Iniciar sesión',
      new_password_label: 'Nueva contraseña (mínimo 8 caracteres)',
      remembered: '¿Recordaste tu contraseña?',
      submit_btn: 'Restablecer contraseña',
      subtitle: 'Elige una nueva contraseña segura para tu cuenta',
      success_msg: 'Contraseña actualizada correctamente. Redirigiendo...',
      title: 'Restablecer contraseña',
    },
  },
  common: {
    back: 'Volver',
    cancel: 'Cancelar',
    close: 'Cerrar',
    continue: 'Continuar',
    loading: 'Cargando...',
    save: 'Guardar',
  },
  error: {
    back_to_home: 'Volver al inicio',
    not_found_desc: 'La página que buscas no existe o ha sido movida.',
    not_found_title: 'Página no encontrada',
  },
  home: {
    badge: 'BoardPDF',
    badge_new: 'Nueva',
    card_desc: 'El sistema base se encuentra inicializado y listo para recibir nuevos módulos y componentes.',
    card_title: 'Página de Inicio',
    subtitle: 'Layout y arquitectura SPA modular con diseño enterprise.',
    title: 'Bienvenido a BoardPDF',
  },
  nav: {
    accounts: 'Cuentas',
    add_account: 'Agregar otra cuenta',
    go_home: 'Ir al inicio',
    help: 'Ayuda',
    home: 'Inicio',
    login: 'Acceder',
    logout: 'Cerrar sesión',
    logout_all: 'Cerrar todas las sesiones',
    profile: 'Perfil',
    settings: 'Configuración',
    toggle_theme: 'Cambiar tema',
    upcoming: 'Próximamente',
    upgrade: 'Actualizar plan',
  },
  upcoming: {
    back_home: 'Ir a Inicio',
    badge: 'Próximamente',
    card_desc: 'Esta sección está preparada para recibir nuevas características y funcionalidades.',
    card_title: 'En Construcción',
    subtitle: 'Estamos preparando nuevas funciones y módulos. Pronto estarán disponibles.',
    title: 'Próximamente',
  },
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}

export function t(
  key: string,
  paramsOrFallback?: Record<string, number | string> | string,
  explicitFallback?: string
): string {
  let params: Record<string, number | string> = {};
  let fallback: string | undefined = explicitFallback;

  if (typeof paramsOrFallback === 'string') {
    fallback = paramsOrFallback;
  } else if (paramsOrFallback && typeof paramsOrFallback === 'object') {
    params = paramsOrFallback;
  }

  let val = getNestedValue(currentTranslations, key);
  if (val === undefined || val === null) {
    val = getNestedValue(FALLBACK_TRANSLATIONS, key);
  }

  if (val === undefined || val === null) {
    return fallback !== undefined ? fallback : key;
  }

  let text = String(val);
  for (const [paramKey, paramVal] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
  }

  return text;
}

export function getCurrentLanguage(): string {
  return currentLanguage;
}

const LEGAL_MODULES = ['privacy', 'terms', 'cookies', 'security'] as const;

async function fetchJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(filePath);
    if (res.ok) {
      return (await res.json()) as Record<string, unknown>;
    }
  } catch {}
  return null;
}

async function fetchLanguageBundle(norm: string): Promise<Record<string, unknown> | null> {
  const generalData = await fetchJsonFile(`/translations/${encodeURIComponent(norm)}/general.json`);
  if (!generalData) {
    return await fetchJsonFile(`/translations/${encodeURIComponent(norm)}.json`);
  }

  const bundle: Record<string, unknown> = { ...generalData };
  if (!bundle.help || typeof bundle.help !== 'object') {
    bundle.help = {};
  }
  const helpObj = bundle.help as Record<string, unknown>;

  const legalResults = await Promise.all(
    LEGAL_MODULES.map(async (mod) => {
      const data = await fetchJsonFile(`/translations/${encodeURIComponent(norm)}/${mod}.json`);
      return { data, mod };
    })
  );

  for (const { data, mod } of legalResults) {
    if (data) {
      bundle[mod] = data;
      helpObj[mod] = data;
    }
  }

  return bundle;
}

async function loadTranslationFile(code: string): Promise<void> {
  const norm = normalizeLanguageCode(code);
  const bundle = await fetchLanguageBundle(norm);
  if (bundle) {
    currentTranslations = bundle;
    try {
      sessionStorage.setItem(`boardpdf_i18n_${norm}`, JSON.stringify(currentTranslations));
    } catch {}
    return;
  }

  if (norm !== DEFAULT_LANGUAGE) {
    const fallbackBundle = await fetchLanguageBundle(DEFAULT_LANGUAGE);
    if (fallbackBundle) {
      currentTranslations = fallbackBundle;
      try {
        sessionStorage.setItem(`boardpdf_i18n_${DEFAULT_LANGUAGE}`, JSON.stringify(currentTranslations));
      } catch {}
      return;
    }
  }

  currentTranslations = FALLBACK_TRANSLATIONS;
}

export async function initI18n(initialLang?: string): Promise<string> {
  const pathMatch = window.location.pathname.match(/^\/([a-z]{2})(?:\/|$)/i);
  const pathLang = pathMatch && isSupportedLanguage(pathMatch[1]) ? pathMatch[1] : null;
  const savedLang = localStorage.getItem('boardpdf_language');
  const browserLang = detectBrowserLanguage();

  const chosen = normalizeLanguageCode(initialLang || pathLang || savedLang || browserLang || DEFAULT_LANGUAGE);
  currentLanguage = chosen;
  localStorage.setItem('boardpdf_language', chosen);
  document.documentElement.lang = chosen;

  try {
    const cached = sessionStorage.getItem(`boardpdf_i18n_${currentLanguage}`);
    if (cached) {
      currentTranslations = JSON.parse(cached);
      void loadTranslationFile(currentLanguage);
      return currentLanguage;
    }
  } catch {}
  await loadTranslationFile(currentLanguage);
  return currentLanguage;
}

export async function setLanguage(code: string): Promise<void> {
  if (!code) return;
  const norm = normalizeLanguageCode(code);
  currentLanguage = norm;
  localStorage.setItem('boardpdf_language', norm);
  document.documentElement.lang = norm;

  await loadTranslationFile(norm);
}

export function translateElement<T extends HTMLElement>(element: T): T {
  const nodesWithI18n = element.querySelectorAll<HTMLElement>('[data-i18n]');
  nodesWithI18n.forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (key) {
      node.textContent = t(key);
    }
  });

  const htmlNodes = element.querySelectorAll<HTMLElement>('[data-i18n-html]');
  htmlNodes.forEach((node) => {
    const key = node.getAttribute('data-i18n-html');
    if (key) {
      node.innerHTML = t(key);
    }
  });

  const placeholders = element.querySelectorAll<HTMLElement>('[data-i18n-placeholder]');
  placeholders.forEach((node) => {
    const key = node.getAttribute('data-i18n-placeholder');
    if (key && 'placeholder' in node) {
      (node as unknown as HTMLInputElement).placeholder = t(key);
    }
  });

  const tooltips = element.querySelectorAll<HTMLElement>('[data-i18n-tooltip]');
  tooltips.forEach((node) => {
    const key = node.getAttribute('data-i18n-tooltip');
    if (key) {
      node.setAttribute('data-tooltip', t(key));
    }
  });

  const arias = element.querySelectorAll<HTMLElement>('[data-i18n-aria]');
  arias.forEach((node) => {
    const key = node.getAttribute('data-i18n-aria');
    if (key) {
      node.setAttribute('aria-label', t(key));
    }
  });

  if (element.hasAttribute('data-i18n')) {
    const key = element.getAttribute('data-i18n');
    if (key) {
      element.textContent = t(key);
    }
  }

  return element;
}
