import type { AuthStateResponse, SessionAccount, UserPayload } from '../types/auth.types.js';

declare global {
  interface Window {
    __INITIAL_SESSION__?: {
      accounts?: SessionAccount[];
      user?: UserPayload | null;
    } | null;
  }
}

function getInitialUser(): { accounts: SessionAccount[]; user: UserPayload | null } {
  if (typeof window === 'undefined') {
    return { accounts: [], user: null };
  }

  if (window.__INITIAL_SESSION__ !== undefined) {
    if (window.__INITIAL_SESSION__ && window.__INITIAL_SESSION__.user) {
      const u = window.__INITIAL_SESSION__.user;
      const a = window.__INITIAL_SESSION__.accounts || [];
      try {
        localStorage.setItem('boardstack_cached_session', JSON.stringify({ accounts: a, user: u }));
      } catch {}
      return { accounts: a, user: u };
    }
    try {
      localStorage.removeItem('boardstack_cached_session');
    } catch {}
    return { accounts: [], user: null };
  }

  try {
    const raw = localStorage.getItem('boardstack_cached_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user) {
        return { accounts: parsed.accounts || [], user: parsed.user };
      }
    }
  } catch {}

  return { accounts: [], user: null };
}

const initialAuth = getInitialUser();
let currentUser: UserPayload | null = initialAuth.user;
let linkedAccounts: SessionAccount[] = initialAuth.accounts;

type AuthListener = (user: UserPayload | null, accounts: SessionAccount[]) => void;
const authListeners = new Set<AuthListener>();

function onAuthChange(callback: AuthListener): () => void {
  authListeners.add(callback);
  return () => {
    authListeners.delete(callback);
  };
}

function setAuthState(user: UserPayload | null, accounts: SessionAccount[]): void {
  currentUser = user;
  linkedAccounts = accounts;
  if (typeof window !== 'undefined') {
    if (user) {
      document.documentElement.classList.add('has-user-session');
      document.documentElement.classList.remove('no-user-session');
      try {
        localStorage.setItem('boardstack_cached_session', JSON.stringify({ accounts, user }));
      } catch {}
    } else {
      document.documentElement.classList.remove('has-user-session');
      document.documentElement.classList.add('no-user-session');
      try {
        localStorage.removeItem('boardstack_cached_session');
      } catch {}
    }
  }
  for (const listener of authListeners) {
    try {
      listener(currentUser, linkedAccounts);
    } catch (e) {
      console.error('[Auth] Error in listener:', e);
    }
  }
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

async function postApi<T = any>(url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  return parseApiResponse<T>(res);
}

async function getApi<T = any>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'GET',
  });
  return parseApiResponse<T>(res);
}

async function postFormApi<T = any>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(url, {
    body: formData,
    method: 'POST',
  });
  return parseApiResponse<T>(res);
}

async function deleteApi<T = any>(url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'DELETE',
  });
  return parseApiResponse<T>(res);
}

async function fetchCurrentUser(): Promise<AuthStateResponse> {
  try {
    const data = await getApi<AuthStateResponse>('/api/auth/me');
    setAuthState(data.user || null, data.accounts || []);
    return data;
  } catch (error) {
    console.error('[Auth] Failed to fetch current user:', error);
    setAuthState(null, []);
    return { accounts: [], user: null };
  }
}

async function switchAccountApi(userId: number): Promise<{ accounts: SessionAccount[]; error?: string; success: boolean; user: UserPayload | null }> {
  try {
    const data = await postApi('/api/auth/switch-account', { userId });
    if (data.ok && data.user) {
      setAuthState(data.user, data.accounts || []);
      return { accounts: data.accounts, success: true, user: data.user };
    }
    return { accounts: [], error: data.error || 'Failed to switch account', success: false, user: null };
  } catch (error) {
    return { accounts: [], error: 'Connection error', success: false, user: null };
  }
}

async function logoutApi(userId?: number): Promise<{ accounts: SessionAccount[]; remainingCount: number; success: boolean; switched: boolean; user: UserPayload | null }> {
  try {
    const data = await postApi('/api/auth/logout', { userId });
    setAuthState(data.user || null, data.accounts || []);
    return {
      accounts: data.accounts || [],
      remainingCount: data.remainingCount || 0,
      success: true,
      switched: Boolean(data.switched),
      user: data.user || null,
    };
  } catch (error) {
    return { accounts: [], remainingCount: 0, success: false, switched: false, user: null };
  }
}

async function logoutAllApi(): Promise<{ success: boolean }> {
  try {
    await postApi('/api/auth/logout-all');
    setAuthState(null, []);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

async function createSubscriptionIntentApi(
  billingType: 'one_time' | 'recurring',
  billingPeriod: '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly',
  planId: 'pro' = 'pro'
): Promise<{ amount?: number; clientSecret?: string; error?: string; ok?: boolean; paymentIntentId?: string; publishableKey?: string; success: boolean }> {
  try {
    const data = await postApi('/api/subscription/create-intent', {
      billingPeriod,
      billingType,
      planId,
    });
    return {
      ...data,
      success: Boolean(data.success ?? data.ok),
    };
  } catch (err: any) {
    return { error: err.message || 'Payment gateway connection error', success: false };
  }
}

async function confirmSubscriptionPaymentApi(
  paymentIntentId: string
): Promise<{ error?: string; ok?: boolean; periodEnd?: string; status?: string; success: boolean; tier?: string }> {
  try {
    const data = await postApi('/api/subscription/confirm', {
      paymentIntentId,
    });
    return {
      ...data,
      success: Boolean(data.success ?? data.ok),
    };
  } catch (err: any) {
    return { error: err.message || 'Payment confirmation error', success: false };
  }
}

async function getSubscriptionStatusApi(): Promise<{ billing_period?: string; billing_type?: string; is_active: boolean; period_end?: string | null; status: string; tier: string }> {
  try {
    const data = await getApi('/api/subscription/status');
    return data.subscription || { is_active: false, status: 'inactive', tier: 'free' };
  } catch {
    return { is_active: false, status: 'inactive', tier: 'free' };
  }
}

export {
  confirmSubscriptionPaymentApi,
  createSubscriptionIntentApi,
  currentUser,
  deleteApi,
  fetchCurrentUser,
  getApi,
  getSubscriptionStatusApi,
  linkedAccounts,
  logoutAllApi,
  logoutApi,
  onAuthChange,
  postApi,
  postFormApi,
  setAuthState,
  switchAccountApi
};

export type {
  AuthListener
};