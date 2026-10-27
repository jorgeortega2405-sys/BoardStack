interface TurnstileRenderParameters {
  action?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  cData?: string;
  callback?: (token: string) => void;
  'error-callback'?: (errorCode: string) => void;
  'expired-callback'?: () => void;
  sitekey: string;
  size?: 'normal' | 'flexible' | 'compact';
  theme?: 'light' | 'dark' | 'auto';
}

interface TurnstileApi {
  getResponse: (widgetId?: string) => string | undefined;
  remove: (widgetId?: string) => void;
  render: (container: string | HTMLElement, params: TurnstileRenderParameters) => string;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileRenderOptions {
  action?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  cData?: string;
  onCallback?: (token: string) => void;
  onError?: (errorCode: string) => void;
  onExpired?: () => void;
  size?: 'normal' | 'flexible' | 'compact';
  theme?: 'light' | 'dark' | 'auto';
}

let turnstileScriptPromise: Promise<void> | null = null;
const activeWidgets = new Map<HTMLElement, string>();

export function getTurnstileSiteKey(): string {
  const envKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY;
  if (typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  return '';
}

export function isTurnstileEnabled(): boolean {
  return Boolean(getTurnstileSiteKey());
}

export function loadTurnstileScript(): Promise<void> {
  if (typeof window.turnstile !== 'undefined') {
    return Promise.resolve();
  }
  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }
  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      if (typeof window.turnstile !== 'undefined') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Fallo al cargar Cloudflare Turnstile')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Fallo al cargar Cloudflare Turnstile'));
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

export async function renderTurnstile(
  container: HTMLElement,
  options: TurnstileRenderOptions = {}
): Promise<string | null> {
  const siteKey = getTurnstileSiteKey();
  if (!siteKey) {
    return null;
  }

  await loadTurnstileScript();

  if (!window.turnstile) {
    return null;
  }

  const existingWidgetId = activeWidgets.get(container);
  if (existingWidgetId) {
    try {
      window.turnstile.remove(existingWidgetId);
    } catch {}
    activeWidgets.delete(container);
  }

  container.innerHTML = '';

  const widgetId = window.turnstile.render(container, {
    action: options.action,
    appearance: options.appearance || 'interaction-only',
    cData: options.cData,
    callback: options.onCallback,
    'error-callback': options.onError,
    'expired-callback': options.onExpired,
    sitekey: siteKey,
    size: options.size || 'normal',
    theme: options.theme || 'auto',
  });

  activeWidgets.set(container, widgetId);
  return widgetId;
}

export function resetTurnstile(widgetIdOrContainer?: HTMLElement | string): void {
  if (!window.turnstile) return;
  if (!widgetIdOrContainer) {
    window.turnstile.reset();
    return;
  }
  if (typeof widgetIdOrContainer === 'string') {
    window.turnstile.reset(widgetIdOrContainer);
    return;
  }
  const widgetId = activeWidgets.get(widgetIdOrContainer);
  if (widgetId) {
    window.turnstile.reset(widgetId);
  }
}

export function removeTurnstile(widgetIdOrContainer?: HTMLElement | string): void {
  if (!window.turnstile) return;
  if (!widgetIdOrContainer) {
    window.turnstile.remove();
    activeWidgets.clear();
    return;
  }
  if (typeof widgetIdOrContainer === 'string') {
    window.turnstile.remove(widgetIdOrContainer);
    for (const [el, id] of activeWidgets.entries()) {
      if (id === widgetIdOrContainer) {
        activeWidgets.delete(el);
        break;
      }
    }
    return;
  }
  const widgetId = activeWidgets.get(widgetIdOrContainer);
  if (widgetId) {
    window.turnstile.remove(widgetId);
    activeWidgets.delete(widgetIdOrContainer);
  }
}

export function getTurnstileResponse(widgetIdOrContainer?: HTMLElement | string): string | null {
  if (!window.turnstile) return null;
  if (!widgetIdOrContainer) {
    return window.turnstile.getResponse() || null;
  }
  if (typeof widgetIdOrContainer === 'string') {
    return window.turnstile.getResponse(widgetIdOrContainer) || null;
  }
  const widgetId = activeWidgets.get(widgetIdOrContainer);
  return widgetId ? window.turnstile.getResponse(widgetId) || null : null;
}
