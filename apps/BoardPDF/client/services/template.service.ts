import { t, translateElement } from './i18n.service.js';
import { renderIcons } from './icon.service.js';

const parsedTemplateCache = new Map<string, HTMLElement>();
const templateCache = new Map<string, string>();
const templatePending = new Map<string, Promise<string>>();

function cacheParsedTemplate(url: string, html: string): HTMLElement | null {
  const existing = parsedTemplateCache.get(url);
  if (existing) {
    return existing;
  }
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const element = template.content.firstElementChild as HTMLElement | null;
  if (element) {
    renderIcons(element);
    parsedTemplateCache.set(url, element);
  }
  return element;
}

function preloadTemplates(urls: string[]): void {
  for (const url of urls) {
    if (!templateCache.has(url) && !templatePending.has(url)) {
      const pending = fetch(url)
        .then((res) => (res.ok ? res.text() : ''))
        .then((text) => {
          if (text) {
            templateCache.set(url, text);
            cacheParsedTemplate(url, text);
          }
          templatePending.delete(url);
          return text;
        })
        .catch(() => {
          templatePending.delete(url);
          return '';
        });
      templatePending.set(url, pending);
    }
  }
}

async function loadTemplate(url: string): Promise<HTMLElement> {
  let cachedElement = parsedTemplateCache.get(url) || null;
  if (!cachedElement) {
    let html = templateCache.get(url);
    if (!html) {
      let pending = templatePending.get(url);
      if (!pending) {
        pending = fetch(url)
          .then((res) => {
            if (!res.ok) {
              throw new Error(t('ui.error_al_cargar_la_plantilla'));
            }
            return res.text();
          })
          .then((text) => {
            templateCache.set(url, text);
            templatePending.delete(url);
            return text;
          })
          .catch((err) => {
            templatePending.delete(url);
            throw err;
          });
        templatePending.set(url, pending);
      }
      html = await pending;
    }

    cachedElement = cacheParsedTemplate(url, html);
    if (!cachedElement) {
      throw new Error(`Plantilla vacía o inválida: ${url}`);
    }
  }

  const clone = document.importNode(cachedElement, true) as HTMLElement;
  return translateElement(clone);
}

export { loadTemplate, preloadTemplates };
