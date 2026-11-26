import type { AccessibleAdminApp } from '../types/admin.types.js';
import type { AdminSessionAccount, AdminUserPayload, AuthStateResponse } from '../types/auth.types.js';

declare global {
  interface Window {
    __INITIAL_SESSION__?: {
      accessibleApps?: AccessibleAdminApp[];
      accounts?: AdminSessionAccount[];
      user?: AdminUserPayload | null;
    } | null;
  }
}

const SESSION_CACHE_KEY = 'boardstack_admin_cached_session';

function getInitialSession(): {
  accessibleApps: AccessibleAdminApp[];
  accounts: AdminSessionAccount[];
  user: AdminUserPayload | null;
} {
  if (typeof window === 'undefined') {
    return { accessibleApps: [], accounts: [], user: null };
  }

  if (window.__INITIAL_SESSION__ !== undefined) {
    if (window.__INITIAL_SESSION__ && window.__INITIAL_SESSION__.user) {
      const u = window.__INITIAL_SESSION__.user;
      const apps = window.__INITIAL_SESSION__.accessibleApps || [];
      const accs = window.__INITIAL_SESSION__.accounts || [];
      try {
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ accessibleApps: apps, accounts: accs, user: u }));
      } catch {}
      return { accessibleApps: apps, accounts: accs, user: u };
    }
    try {
      localStorage.removeItem(SESSION_CACHE_KEY);
    } catch {}
    return { accessibleApps: [], accounts: [], user: null };
  }

  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user) {
        return {
          accessibleApps: parsed.accessibleApps || [],
          accounts: parsed.accounts || [],
          user: parsed.user,
        };
      }
    }
  } catch {}

  return { accessibleApps: [], accounts: [], user: null };
}

const initialAuth = getInitialSession();
let currentUser: AdminUserPayload | null = initialAuth.user;
let accessibleApps: AccessibleAdminApp[] = initialAuth.accessibleApps;
let linkedAccounts: AdminSessionAccount[] = initialAuth.accounts;
let activeAppSlug: string = initialAuth.accessibleApps[0]?.slug || '';

type AuthListener = (
  user: AdminUserPayload | null,
  apps: AccessibleAdminApp[],
  activeSlug: string,
  accounts: AdminSessionAccount[]
) => void;
const authListeners = new Set<AuthListener>();

function notifyListeners(): void {
  for (const listener of authListeners) {
    try {
      listener(currentUser, accessibleApps, activeAppSlug, linkedAccounts);
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

function setAuthState(
  user: AdminUserPayload | null,
  apps: AccessibleAdminApp[],
  accounts: AdminSessionAccount[] = []
): void {
  currentUser = user;
  accessibleApps = Array.isArray(apps) ? apps : [];
  linkedAccounts = Array.isArray(accounts) ? accounts : [];
  if (!accessibleApps.some((a) => a.slug === activeAppSlug)) {
    activeAppSlug = accessibleApps[0]?.slug || '';
  }

  if (typeof window !== 'undefined') {
    if (user) {
      try {
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ accessibleApps, accounts: linkedAccounts, user }));
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
    setAuthState(data.user || null, data.accessibleApps || [], data.accounts || []);
    return data;
  } catch (error) {
    console.error('[AdminAuth] Failed to fetch current user:', error);
    setAuthState(null, [], []);
    return { accessibleApps: [], accounts: [], user: null };
  }
}

async function switchAccountApi(userId: number): Promise<{
  accessibleApps: AccessibleAdminApp[];
  accounts: AdminSessionAccount[];
  error?: string;
  success: boolean;
  user: AdminUserPayload | null;
}> {
  try {
    const data = await postApi('/api/auth/switch-account', { userId });
    if (data.ok && data.user) {
      const nextApps = data.accessibleApps || [];
      const nextAccounts = data.accounts || [];
      setAuthState(data.user, nextApps, nextAccounts);
      return {
        accessibleApps: nextApps,
        accounts: nextAccounts,
        success: true,
        user: data.user,
      };
    }
    return {
      accessibleApps: [],
      accounts: [],
      error: data.error || 'Failed to switch account',
      success: false,
      user: null,
    };
  } catch {
    return {
      accessibleApps: [],
      accounts: [],
      error: 'Connection error',
      success: false,
      user: null,
    };
  }
}

async function logoutApi(userId?: number): Promise<{
  accessibleApps: AccessibleAdminApp[];
  accounts: AdminSessionAccount[];
  remainingCount: number;
  success: boolean;
  switched: boolean;
  user: AdminUserPayload | null;
}> {
  try {
    const data = await postApi('/api/auth/logout', userId !== undefined ? { userId } : {});
    if (data.ok === false) {
      return {
        accessibleApps,
        accounts: linkedAccounts,
        remainingCount: linkedAccounts.length,
        success: false,
        switched: false,
        user: currentUser,
      };
    }
    const nextApps = data.accessibleApps || [];
    const nextAccounts = data.accounts || [];
    const nextUser = data.user || null;
    setAuthState(nextUser, nextApps, nextAccounts);
    return {
      accessibleApps: nextApps,
      accounts: nextAccounts,
      remainingCount: Number(data.remainingCount || 0),
      success: true,
      switched: Boolean(data.switched),
      user: nextUser,
    };
  } catch {
    return {
      accessibleApps,
      accounts: linkedAccounts,
      remainingCount: linkedAccounts.length,
      success: false,
      switched: false,
      user: currentUser,
    };
  }
}

async function logoutAllApi(): Promise<{ success: boolean }> {
  try {
    const data = await postApi('/api/auth/logout-all');
    if (data.ok === false) {
      return { success: false };
    }
    setAuthState(null, [], []);
    return { success: true };
  } catch {
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
  linkedAccounts,
  logoutAllApi,
  logoutApi,
  onAuthChange,
  patchApi,
  postApi,
  setActiveAppSlug,
  setAuthState,
  switchAccountApi
};

export type {
  AuthListener
};
