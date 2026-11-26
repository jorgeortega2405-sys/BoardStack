import type { AccessibleAdminApp } from '../types/admin.types.js';
import type { AdminUserPayload, AuthStateResponse } from '../types/auth.types.js';

declare global {
  interface Window {
    __INITIAL_SESSION__?: {
      accessibleApps?: AccessibleAdminApp[];
      user?: AdminUserPayload | null;
    } | null;
  }
}

const SESSION_CACHE_KEY = 'boardstack_admin_cached_session';

function getInitialSession(): { accessibleApps: AccessibleAdminApp[]; user: AdminUserPayload | null } {
  if (typeof window === 'undefined') {
    return { accessibleApps: [], user: null };
  }

  if (window.__INITIAL_SESSION__ !== undefined) {
    if (window.__INITIAL_SESSION__ && window.__INITIAL_SESSION__.user) {
      const u = window.__INITIAL_SESSION__.user;
      const apps = window.__INITIAL_SESSION__.accessibleApps || [];
      try {
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ accessibleApps: apps, user: u }));
      } catch {}
      return { accessibleApps: apps, user: u };
    }
    try {
      localStorage.removeItem(SESSION_CACHE_KEY);
    } catch {}
    return { accessibleApps: [], user: null };
  }

  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user) {
        return { accessibleApps: parsed.accessibleApps || [], user: parsed.user };
      }
    }
  } catch {}

  return { accessibleApps: [], user: null };
}

const initialAuth = getInitialSession();
let currentUser: AdminUserPayload | null = initialAuth.user;
let accessibleApps: AccessibleAdminApp[] = initialAuth.accessibleApps;
let activeAppSlug: string = initialAuth.accessibleApps[0]?.slug || '';

type AuthListener = (user: AdminUserPayload | null, apps: AccessibleAdminApp[], activeSlug: string) => void;
const authListeners = new Set<AuthListener>();

function notifyListeners(): void {
  for (const listener of authListeners) {
    try {
      listener(currentUser, accessibleApps, activeAppSlug);
    } catch (e) {
      console.error('[AdminAuth] Error in listener:', e);
    }
  }
}

function onAuthChange(callback: AuthListener): () => void {
  authListeners.add(callback);
  return () => {
    authListeners.delete(callback);
  };
}

function setAuthState(user: AdminUserPayload | null, apps: AccessibleAdminApp[]): void {
  currentUser = user;
  accessibleApps = Array.isArray(apps) ? apps : [];
  if (!accessibleApps.some((a) => a.slug === activeAppSlug)) {
    activeAppSlug = accessibleApps[0]?.slug || '';
  }

  if (typeof window !== 'undefined') {
    if (user) {
      try {
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ accessibleApps, user }));
      } catch {}
    } else {
      try {
        localStorage.removeItem(SESSION_CACHE_KEY);
      } catch {}
    }
  }
  notifyListeners();
}

function setActiveAppSlug(slug: string, notify = true): void {
  if (!slug || activeAppSlug === slug) return;
  if (accessibleApps.some((a) => a.slug === slug)) {
    activeAppSlug = slug;
    if (notify) {
      notifyListeners();
    }
  }
}

function getActiveApp(): AccessibleAdminApp | null {
  return accessibleApps.find((a) => a.slug === activeAppSlug) || accessibleApps[0] || null;
}

async function parseApiResponse<T = any>(res: globalThis.Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      if (!res.ok && typeof data === 'object' && data !== null) {
        if (data.ok === undefined && data.success === undefined) {
          data.ok = false;
        }
      }
      return data;
    } catch {
      return {
        error: 'Failed to parse response.',
        ok: false,
        status: res.status,
        success: false,
      } as T;
    }
  }

  const text = await res.text();
  return {
    error: res.status >= 400 ? (text.slice(0, 150) || `Request failed (${res.status})`) : undefined,
    ok: res.ok,
    status: res.status,
    success: res.ok,
  } as T;
}

async function requestApi<T = any>(url: string, method: string, body?: any): Promise<T> {
  const isJson = body !== undefined && !(body instanceof FormData);
  const res = await fetch(url, {
    body: isJson ? JSON.stringify(body) : body,
    headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
    method,
  });
  return parseApiResponse<T>(res);
}

async function deleteApi<T = any>(url: string): Promise<T> {
  return requestApi<T>(url, 'DELETE');
}

async function getApi<T = any>(url: string): Promise<T> {
  return requestApi<T>(url, 'GET');
}

async function patchApi<T = any>(url: string, body?: any): Promise<T> {
  return requestApi<T>(url, 'PATCH', body);
}

async function postApi<T = any>(url: string, body?: any): Promise<T> {
  return requestApi<T>(url, 'POST', body);
}

async function fetchCurrentUser(): Promise<AuthStateResponse> {
  try {
    const data = await getApi<AuthStateResponse>('/api/auth/me');
    setAuthState(data.user || null, data.accessibleApps || []);
    return data;
  } catch (error) {
    console.error('[AdminAuth] Failed to fetch current user:', error);
    setAuthState(null, []);
    return { accessibleApps: [], user: null };
  }
}

async function logoutApi(): Promise<{ success: boolean }> {
  try {
    await postApi('/api/auth/logout');
    setAuthState(null, []);
    return { success: true };
  } catch {
    setAuthState(null, []);
    return { success: false };
  }
}

export {
  accessibleApps,
  activeAppSlug,
  currentUser,
  deleteApi,
  fetchCurrentUser,
  getActiveApp,
  getApi,
  logoutApi,
  onAuthChange,
  patchApi,
  postApi,
  setActiveAppSlug,
  setAuthState
};

export type {
  AuthListener
};
