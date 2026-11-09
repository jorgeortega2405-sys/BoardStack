import { DEFAULT_LANGUAGE, detectBrowserLanguage, isSupportedLanguage, normalizeLanguageCode } from '../utils/languages.util.js';

let currentLanguage = DEFAULT_LANGUAGE;
let currentTranslations: Record<string, unknown> = {};
let isLanguageBundleAvailable = true;

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
  collaborative: {
    back_to_projects: 'Volver a Mis Documentos',
    doc_not_found: 'El documento no existe o fue eliminado.',
    doc_saved_cloud: 'Documento guardado en la nube',
    elements: 'Elementos',
    empty_uploads_desc: 'Sube imágenes o documentos PDF para usarlos aquí',
    empty_uploads_title: 'Sin archivos subidos',
    guest_login_btn: 'Iniciar sesión',
    guest_uploads_desc: 'Inicia sesión para subir fotos, imágenes y documentos directamente a tu almacenamiento en la nube.',
    guest_uploads_title: 'Archivos en la nube',
    image_pasted: 'Imagen pegada y subida a la nube.',
    login_required_ai_bg: 'Inicia sesión para eliminar fondos con IA.',
    login_required_design: 'Debes iniciar sesión para crear y diseñar documentos PDF.',
    login_required_duplicate: 'Inicia sesión para duplicar este documento en tu cuenta.',
    login_required_share: 'Inicia sesión para invitar miembros y cambiar permisos.',
    login_required_upload: 'Debes iniciar sesión para subir archivos a la nube.',
    restricted_desc: 'Solo las personas invitadas por el creador del diseño pueden acceder a este enlace.',
    restricted_title: 'Acceso restringido',
    storage_quota_exceeded: 'Has alcanzado el límite de almacenamiento disponible (5 GB).',
    tools: 'Herramientas',
    untitled_doc: 'Documento sin título',
    upload_btn: 'Subir archivos',
    upload_btn_text: 'Subir archivos',
    upload_failed: 'No se pudo subir la imagen a la nube.',
    upload_in_progress: 'Subiendo archivos...',
    upload_tab_all: 'Todos',
    upload_tab_images: 'Imágenes',
    upload_tab_pdfs: 'PDFs',
    uploads: 'Subidos',
    write: 'Escribir',
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
    design_pdf_badge: 'Estudio de Diseño y Colaboración en Tiempo Real',
    design_pdf_cta: 'Diseñar PDF',
    design_pdf_desc: 'Crea desde cero, añade textos, fotos, tablas y formas con guardado automático en la nube. Colabora en tiempo real con tu equipo o comparte con enlaces públicos sin límites.',
    design_pdf_title: 'Diseña documentos PDF profesionales en la nube',
    subtitle: 'Layout y arquitectura SPA modular con diseño enterprise.',
    title: 'Bienvenido a BoardPDF',
    trust_desc: 'BoardPDF es tu aplicación web para gestionar y editar archivos PDF fácilmente. Disfruta de todas las herramientas para trabajar de forma eficiente con tus documentos digitales mientras mantienes tus datos seguros.',
    trust_encryption: 'Cifrado de 256 bits',
    trust_security_info: 'Seguridad de la Información',
    trust_standard: 'Estándar Internacional',
    trust_title: 'El software PDF en el que confían millones de usuarios',
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
    pricing: 'Precios',
    profile: 'Perfil',
    settings: 'Configuración',
    toggle_theme: 'Cambiar tema',
    upcoming: 'Próximamente',
    upgrade: 'Actualizar plan',
  },
  footer: {
    link_pricing: 'Precios',
  },
  pricing: {
    billing_monthly: 'Mensual',
    billing_yearly: 'Anual',
    disclaimer_age_1: 'Debes tener al menos 18 años de edad y contar con la debida capacidad jurídica y autorización para contratar una suscripción de pago. Las tarifas mostradas no incluyen los tributos ni impuestos locales aplicables, los cuales se calcularán y detallarán de forma transparente al momento de procesar la transacción. Para más detalles sobre nuestras garantías y privacidad, revisa la',
    disclaimer_age_2: '.',
    disclaimer_geo_1: 'La disponibilidad de funciones avanzadas, ventajas premium y motores de procesamiento puede variar según tu país, territorio o región geográfica de residencia, así como de las normativas de telecomunicaciones y servicios digitales en la nube aplicables. Te recomendamos revisar detalladamente nuestros',
    disclaimer_geo_2: 'y las condiciones aplicables antes de contratar.',
    disclaimer_privacy_link: 'Política de privacidad',
    disclaimer_terms_link: 'Términos del servicio',
    notice_badge: 'Aviso legal y condiciones',
    notice_geo_title: 'Disponibilidad geográfica y regulaciones',
    notice_legal_title: 'Requisitos legales, tarifas y privacidad',
    notice_title: 'Disponibilidad del servicio y condiciones de contratación',
    subtitle: 'Elige el plan ideal para optimizar tu productividad y desbloquear el máximo poder documental de BoardPDF',
    title: 'Planes y precios',
  },
  settings: {
    billing: {
      btn_cancel_subscription: 'Cancelar suscripción',
      btn_change_plan: 'Cambiar de plan',
      btn_confirm_cancel_sub: 'Confirmar cancelación',
      btn_explore_plans: 'Explorar planes',
      btn_reactivate_sub: 'Reactivar suscripción',
      cancel_sub_desc: 'Cancela la renovación automática de tu suscripción. Conservarás todos tus beneficios premium hasta el final del período facturado.',
      cancel_sub_title: 'Cancelar suscripción',
      modal_cancel_sub_desc: 'Tu suscripción no se renovará al concluir el período actual. Mantendrás todas tus funciones premium hasta el {date} y después no se realizará ningún cobro.',
      modal_cancel_sub_title: '¿Cancelar suscripción?',
      reactivate_sub_desc: 'Tu suscripción finalizará el {date}. Puedes reactivarla en cualquier momento para seguir disfrutando de todas las funciones sin interrupciones.',
      reactivate_sub_title: 'Reactivar suscripción',
      status_active: 'Activo',
      status_cancel_scheduled: 'Cancelación programada',
      toast_subscription_cancelled: 'Tu suscripción no se renovará. Mantendrás tu plan hasta el término del ciclo.',
      toast_subscription_reactivated: 'Suscripción reactivada exitosamente.',
    },
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
  if (!isLanguageBundleAvailable) {
    return key;
  }
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

export function isTranslationBundleAvailable(): boolean {
  return isLanguageBundleAvailable;
}

const LEGAL_MODULES = ['privacy', 'terms', 'cookies', 'security'] as const;

async function fetchJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(filePath);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && (!contentType || contentType.includes('application/json'))) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        return data as Record<string, unknown>;
      }
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
    isLanguageBundleAvailable = true;
    try {
      sessionStorage.setItem(`boardpdf_i18n_${norm}`, JSON.stringify(currentTranslations));
    } catch {}
    return;
  }

  if (norm === DEFAULT_LANGUAGE) {
    currentTranslations = FALLBACK_TRANSLATIONS;
    isLanguageBundleAvailable = true;
    return;
  }

  isLanguageBundleAvailable = false;
  currentTranslations = {};
  try {
    sessionStorage.removeItem(`boardpdf_i18n_${norm}`);
  } catch {}
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
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        currentTranslations = parsed;
        isLanguageBundleAvailable = true;
        void loadTranslationFile(currentLanguage);
        return currentLanguage;
      }
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
