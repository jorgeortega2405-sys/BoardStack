import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE } from '../utils/languages.util.js';
import es from './locales/es.json';

type TranslationKey = string;
type TranslationSchema = typeof es;

const LOCALES: Record<string, TranslationSchema> = {
  es,
};

const SUPPORTED_LANG_CODES = AVAILABLE_LANGUAGES.map((l) => l.code.toLowerCase());

class I18nService {
  private currentLang: string = DEFAULT_LANGUAGE;
  private listeners: Array<(lang: string) => void> = [];
  private initialized = false;

  public init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const fromUrl = this.getLangFromPath(typeof window !== 'undefined' ? window.location.pathname : '');
    if (fromUrl && SUPPORTED_LANG_CODES.includes(fromUrl)) {
      this.currentLang = fromUrl;
    } else {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('app_language') : null;
      if (saved && SUPPORTED_LANG_CODES.includes(saved.toLowerCase())) {
        this.currentLang = saved.toLowerCase();
      } else {
        this.currentLang = DEFAULT_LANGUAGE;
      }
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.currentLang;
    }
  }

  public getLanguage(): string {
    return this.currentLang;
  }

  public getSupportedLanguages(): string[] {
    return SUPPORTED_LANG_CODES;
  }

  public setLanguage(lang: string, syncUrl = true): void {
    const cleanLang = (lang || '').toLowerCase().trim();
    const targetLang = SUPPORTED_LANG_CODES.includes(cleanLang) ? cleanLang : DEFAULT_LANGUAGE;
    const prevLang = this.currentLang;
    this.currentLang = targetLang;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('app_language', targetLang);
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = targetLang;
    }

    if (syncUrl && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const { cleanPath } = this.stripLanguage(currentPath);
      const newPath = this.localizePath(cleanPath, targetLang);
      const fullTarget = window.location.search ? `${newPath}${window.location.search}` : newPath;
      if (fullTarget !== currentPath + window.location.search) {
        window.history.pushState({}, '', fullTarget);
      }
    }

    if (prevLang !== targetLang) {
      this.listeners.forEach((listener) => {
        try {
          listener(targetLang);
        } catch (err) {
          console.error('Error in i18n listener:', err);
        }
      });
    }
  }

  public onLanguageChange(callback: (lang: string) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public t(key: string, params?: Record<string, string | number>): string {
    if (!key || typeof key !== 'string') return '';
    const dict = LOCALES[this.currentLang] || LOCALES[DEFAULT_LANGUAGE];
    if (!dict) {
      return key;
    }

    const parts = key.split('.');
    let val: any = dict;
    for (const part of parts) {
      if (val && typeof val === 'object' && part in val) {
        val = val[part];
      } else {
        return key;
      }
    }

    if (typeof val !== 'string') {
      return key;
    }

    if (params) {
      let result = val;
      for (const [paramKey, paramVal] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      }
      return result;
    }

    return val;
  }

  public getLangFromPath(pathname: string): string | null {
    const clean = (pathname || '/').replace(/^\/+/, '');
    const segments = clean.split('/');
    if (segments.length > 0 && segments[0]) {
      const candidate = segments[0].toLowerCase();
      if (SUPPORTED_LANG_CODES.includes(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  public stripLanguage(path: string): { lang: string; cleanPath: string } {
    const raw = path || '/';
    const hasLeadingSlash = raw.startsWith('/');
    const clean = raw.replace(/^\/+/, '');
    const segments = clean.split('/');

    if (segments.length > 0 && segments[0]) {
      const candidate = segments[0].toLowerCase();
      if (SUPPORTED_LANG_CODES.includes(candidate)) {
        const remaining = segments.slice(1).join('/');
        return {
          lang: candidate,
          cleanPath: remaining ? (hasLeadingSlash ? `/${remaining}` : remaining) : '/',
        };
      }
    }

    return {
      lang: this.currentLang,
      cleanPath: raw || '/',
    };
  }

  public localizePath(cleanPath: string, lang = this.currentLang): string {
    const norm = (cleanPath || '/').replace(/\/+$/, '') || '/';
    const targetLang = (lang || this.currentLang).toLowerCase();
    if (norm === '/') {
      return `/${targetLang}`;
    }
    return `/${targetLang}${norm.startsWith('/') ? norm : `/${norm}`}`;
  }

  public translateDocument(root: HTMLElement = document.body): void {
    if (!root) return;

    root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = this.t(key);
      }
    });

    root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = this.t(key);
      }
    });

    root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.title = this.t(key);
      }
    });

    root.querySelectorAll<HTMLElement>('[data-i18n-tooltip]').forEach((el) => {
      const key = el.getAttribute('data-i18n-tooltip');
      if (key) {
        const text = this.t(key);
        el.setAttribute('data-tooltip', text);
        el.setAttribute('aria-label', text);
      }
    });
  }
}

const i18n = new I18nService();
const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);

export {
  I18nService,
  i18n,
  t
};

export type {
  TranslationKey,
  TranslationSchema
};
