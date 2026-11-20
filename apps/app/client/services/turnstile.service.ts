declare global {
  interface Window {
    turnstile?: {
      execute: (container?: string | HTMLElement, options?: any) => void;
      getResponse: (widgetId?: string) => string | undefined;
      remove: (widgetId?: string) => void;
      render: (
        container: string | HTMLElement,
        options: {
          action?: string;
          cData?: string;
          callback?: (token: string) => void;
          'error-callback'?: (error: any) => void;
          execution?: 'render' | 'execute';
          'expired-callback'?: () => void;
          sitekey: string;
          size?: 'compact' | 'flexible' | 'normal';
          theme?: 'auto' | 'light' | 'dark';
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

interface TurnstileConfig {
  enabled: boolean;
  siteKey: string;
}

let cachedConfig: TurnstileConfig | null = null;
let widgetId: string | null = null;
let currentToken: string | null = null;
let pendingResolvers: Array<(token: string) => void> = [];

async function fetchTurnstileConfig(): Promise<TurnstileConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  try {
    const res = await fetch('/api/auth/turnstile-config');
    if (res.ok) {
      const data = await res.json();
      cachedConfig = {
        enabled: Boolean(data.enabled),
        siteKey: data.siteKey || '',
      };
      return cachedConfig;
    }
  } catch {}

  cachedConfig = {
    enabled: false,
    siteKey: '',
  };
  return cachedConfig;
}

function getOrCreateTurnstileContainer(): HTMLElement {
  let el = document.querySelector<HTMLElement>('[data-ref="cf-turnstile-container"]');
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('data-ref', 'cf-turnstile-container');
    el.style.position = 'fixed';
    el.style.top = '-9999px';
    el.style.left = '-9999px';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '-1';
    document.body.appendChild(el);
  }
  return el;
}

async function waitForTurnstileApi(timeoutMs = 6000): Promise<boolean> {
  if (window.turnstile) {
    return true;
  }
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (window.turnstile) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function initInvisibleTurnstile(): Promise<void> {
  const config = await fetchTurnstileConfig();
  if (!config.enabled) {
    return;
  }

  const apiReady = await waitForTurnstileApi();
  if (!apiReady || !window.turnstile) {
    console.warn('[Turnstile] Cloudflare Turnstile API script not loaded or blocked.');
    return;
  }

  if (widgetId !== null) {
    return;
  }

  const container = getOrCreateTurnstileContainer();

  try {
    widgetId = window.turnstile.render(container, {
      callback: (token: string) => {
        currentToken = token;
        const resolvers = [...pendingResolvers];
        pendingResolvers = [];
        resolvers.forEach((r) => r(token));
      },
      'error-callback': (err: any) => {
        console.warn('[Turnstile] Challenge error:', err);
        currentToken = null;
      },
      'expired-callback': () => {
        currentToken = null;
        if (widgetId && window.turnstile) {
          window.turnstile.reset(widgetId);
        }
      },
      execution: 'execute',
      sitekey: config.siteKey,
      size: 'normal',
    });
  } catch (err) {
    console.warn('[Turnstile] Error rendering invisible widget:', err);
  }
}

async function getTurnstileToken(): Promise<string> {
  const config = await fetchTurnstileConfig();
  if (!config.enabled) {
    return '';
  }

  await initInvisibleTurnstile();

  if (currentToken) {
    const token = currentToken;
    currentToken = null;
    return token;
  }

  return new Promise<string>((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(currentToken || '');
      }
    }, 8000);

    pendingResolvers.push((token: string) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(token);
      }
    });

    if (widgetId && window.turnstile) {
      try {
        window.turnstile.execute(widgetId);
      } catch {}
    }
  });
}

function resetTurnstile(): void {
  currentToken = null;
  if (widgetId && window.turnstile) {
    try {
      window.turnstile.reset(widgetId);
    } catch (err) {
      console.warn('[Turnstile] Reset failed:', err);
    }
  }
}

export {
  getTurnstileToken,
  initInvisibleTurnstile,
  resetTurnstile
};

export type {
  TurnstileConfig
};