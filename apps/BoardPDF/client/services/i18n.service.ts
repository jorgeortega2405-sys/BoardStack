import { DEFAULT_LANGUAGE, detectBrowserLanguage, isSupportedLanguage, normalizeLanguageCode } from '../utils/languages.util.js';

let currentLanguage = DEFAULT_LANGUAGE;
let currentTranslations: Record<string, unknown> = {};
let isLanguageBundleAvailable = true;

const FALLBACK_TRANSLATIONS: Record<string, unknown> = {};

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

function t(
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

function getCurrentLanguage(): string {
  return currentLanguage;
}

function isTranslationBundleAvailable(): boolean {
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

async function initI18n(initialLang?: string): Promise<string> {
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

async function setLanguage(code: string): Promise<void> {
  if (!code) return;
  const norm = normalizeLanguageCode(code);
  currentLanguage = norm;
  localStorage.setItem('boardpdf_language', norm);
  document.documentElement.lang = norm;

  await loadTranslationFile(norm);
}

function translateElement<T extends HTMLElement>(element: T): T {
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

export { getCurrentLanguage, initI18n, isTranslationBundleAvailable, setLanguage, t, translateElement };
