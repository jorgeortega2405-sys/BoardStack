import { DEFAULT_LANGUAGE, detectBrowserLanguage, isSupportedLanguage, normalizeLanguageCode } from '../utils/languages.util.js';

let currentLanguage = DEFAULT_LANGUAGE;
let currentTranslations: Record<string, unknown> = {};
let isLanguageBundleAvailable = true;

const FALLBACK_TRANSLATIONS: Record<string, unknown> = {};
const I18N_SELECTOR = '[data-i18n],[data-i18n-html],[data-i18n-placeholder],[data-i18n-tooltip],[data-i18n-aria],[data-i18n-title],[data-i18n-alt]';
const LEGAL_MODULES = ['privacy', 'terms', 'cookies', 'security'] as const;
const loadedLegalBundles = new Set<string>();
const memoryBundleCache = new Map<string, Record<string, unknown>>();
const pendingLegalBundles = new Map<string, Promise<void>>();

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

  return bundle;
}

async function ensureLegalTranslationsLoaded(lang?: string): Promise<void> {
  const norm = normalizeLanguageCode(lang || currentLanguage);
  if (loadedLegalBundles.has(norm)) {
    return;
  }
  const existingPending = pendingLegalBundles.get(norm);
  if (existingPending) {
    await existingPending;
    return;
  }

  const task = (async () => {
    const legalResults = await Promise.all(
      LEGAL_MODULES.map(async (mod) => {
        const data = await fetchJsonFile(`/translations/${encodeURIComponent(norm)}/${mod}.json`);
        return { data, mod };
      })
    );

    const targetBundle = norm === currentLanguage ? currentTranslations : (memoryBundleCache.get(norm) || {});
    if (!targetBundle.help || typeof targetBundle.help !== 'object') {
      targetBundle.help = {};
    }
    const helpObj = targetBundle.help as Record<string, unknown>;

    for (const { data, mod } of legalResults) {
      if (data) {
        targetBundle[mod] = data;
        helpObj[mod] = data;
      }
    }

    loadedLegalBundles.add(norm);
    memoryBundleCache.set(norm, targetBundle);
    try {
      sessionStorage.setItem(`boardpdf_i18n_${norm}`, JSON.stringify(targetBundle));
    } catch {}
  })().finally(() => {
    pendingLegalBundles.delete(norm);
  });

  pendingLegalBundles.set(norm, task);
  await task;
}

async function loadTranslationFile(code: string): Promise<void> {
  const norm = normalizeLanguageCode(code);
  const memCached = memoryBundleCache.get(norm);
  if (memCached && Object.keys(memCached).length > 0) {
    currentTranslations = memCached;
    isLanguageBundleAvailable = true;
    return;
  }

  let bundle = await fetchLanguageBundle(norm);
  if (!bundle && norm !== DEFAULT_LANGUAGE) {
    bundle = await fetchLanguageBundle(DEFAULT_LANGUAGE);
  }
  if (bundle) {
    const existingLegal = memoryBundleCache.get(norm);
    if (existingLegal) {
      for (const mod of LEGAL_MODULES) {
        if (existingLegal[mod]) {
          bundle[mod] = existingLegal[mod];
          if (bundle.help && typeof bundle.help === 'object') {
            (bundle.help as Record<string, unknown>)[mod] = existingLegal[mod];
          }
        }
      }
    }
    currentTranslations = bundle;
    memoryBundleCache.set(norm, bundle);
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
        currentTranslations = parsed as Record<string, unknown>;
        memoryBundleCache.set(currentLanguage, currentTranslations);
        if (parsed.privacy && parsed.terms && parsed.cookies && parsed.security) {
          loadedLegalBundles.add(currentLanguage);
        }
        isLanguageBundleAvailable = true;
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

function applyNodeTranslation(node: HTMLElement): void {
  const i18nKey = node.getAttribute('data-i18n');
  if (i18nKey) {
    const text = t(i18nKey);
    if (node.textContent !== text) {
      node.textContent = text;
    }
  }

  const htmlKey = node.getAttribute('data-i18n-html');
  if (htmlKey) {
    const html = t(htmlKey);
    if (node.innerHTML !== html) {
      node.innerHTML = html;
    }
  }

  const placeholderKey = node.getAttribute('data-i18n-placeholder');
  if (placeholderKey && 'placeholder' in node) {
    const placeholder = t(placeholderKey);
    if ((node as unknown as HTMLInputElement).placeholder !== placeholder) {
      (node as unknown as HTMLInputElement).placeholder = placeholder;
    }
  }

  const tooltipKey = node.getAttribute('data-i18n-tooltip');
  if (tooltipKey) {
    node.setAttribute('data-tooltip', t(tooltipKey));
  }

  const ariaKey = node.getAttribute('data-i18n-aria');
  if (ariaKey) {
    node.setAttribute('aria-label', t(ariaKey));
  }

  const titleKey = node.getAttribute('data-i18n-title');
  if (titleKey) {
    node.setAttribute('title', t(titleKey));
  }

  const altKey = node.getAttribute('data-i18n-alt');
  if (altKey) {
    node.setAttribute('alt', t(altKey));
  }
}

function translateElement<T extends HTMLElement>(element: T): T {
  if (element.matches?.(I18N_SELECTOR)) {
    applyNodeTranslation(element);
  }
  const nodes = element.querySelectorAll<HTMLElement>(I18N_SELECTOR);
  for (let i = 0; i < nodes.length; i++) {
    applyNodeTranslation(nodes[i]);
  }
  return element;
}

export { ensureLegalTranslationsLoaded, getCurrentLanguage, initI18n, isTranslationBundleAvailable, setLanguage, t, translateElement };
