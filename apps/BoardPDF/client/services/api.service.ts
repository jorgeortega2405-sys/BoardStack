import { API_ROUTES } from '../config/api-routes.js';
import { User } from '../types/auth.types.js';
import { OneTimePaymentIntentResponse, SubscriptionIntentResponse } from '../types/subscription.types.js';
import { clearAllLocalDrafts } from '../utils/collab-local-draft.util.js';
import { wsService } from './websocket.service.js';
import { t } from './i18n.service.js';

let currentUser: User | null = null;
let linkedAccounts: User[] = [];
const authListeners = new Set<(user: User | null, accounts?: User[]) => void>();

function setAuthState(user: User | null, accounts: User[] = []): void {
  currentUser = user;
  linkedAccounts = accounts.length > 0 ? accounts : (user ? [user] : []);
  authListeners.forEach((fn) => {
    try {
      fn(currentUser, linkedAccounts);
    } catch {}
  });
}

function setCurrentUser(user: User | null): void {
  setAuthState(user, linkedAccounts);
}

function setLinkedAccounts(accounts: User[]): void {
  setAuthState(currentUser, accounts);
}

function clearUserState(): void {
  setAuthState(null, []);
}

function onAuthChange(callback: (user: User | null, accounts?: User[]) => void): () => void {
  authListeners.add(callback);
  return () => {
    authListeners.delete(callback);
  };
}

function hasPermission(permission: string): boolean {
  if (!currentUser || !Array.isArray(currentUser.permissions)) return false;
  return currentUser.permissions.includes(permission);
}

function hasSubscriptionFeature(feature: string): boolean {
  return hasPermission(`subscription:feature:${feature}`);
}

function getCsrfToken(): string {
  if (typeof document === 'undefined' || !document.cookie) return '';
  const match = document.cookie.match(/(?:^|;\s*)boardpdf_csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function ensureCsrfToken(forceRefresh = false): Promise<string> {
  let token = getCsrfToken();
  if ((!token || forceRefresh) && typeof window !== 'undefined') {
    try {
      await fetch('/api/health', { credentials: 'include' });
      token = getCsrfToken();
    } catch {}
  }
  return token;
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  return await fetch(url, init);
}

async function getApi(url: string): Promise<Response> {
  return timedFetch(url, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
    },
    method: 'GET',
  });
}

async function postApi(url: string, body?: unknown, customHeaders?: Record<string, string>): Promise<Response> {
  const token = await ensureCsrfToken();
  return timedFetch(url, {
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-csrf-token': token,
      ...(customHeaders || {}),
    },
    method: 'POST',
  });
}

async function patchApi(url: string, body?: unknown): Promise<Response> {
  const token = await ensureCsrfToken();
  return timedFetch(url, {
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    method: 'PATCH',
  });
}

async function putApi(url: string, body?: unknown): Promise<Response> {
  const token = await ensureCsrfToken();
  return timedFetch(url, {
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    method: 'PUT',
  });
}

async function deleteApi(url: string, body?: unknown): Promise<Response> {
  const token = await ensureCsrfToken();
  return timedFetch(url, {
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'x-csrf-token': token,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    method: 'DELETE',
  });
}

async function postFormApi(url: string, formData: FormData): Promise<Response> {
  const token = await ensureCsrfToken();
  return timedFetch(url, {
    body: formData,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'x-csrf-token': token,
    },
    method: 'POST',
  });
}

interface UploadProgressInfo {
  etaSeconds: number;
  loaded: number;
  percent: number;
  speedBytesPerSec: number;
  total: number;
}

async function postFormWithProgress(
  url: string,
  formData: FormData,
  onProgress?: (info: UploadProgressInfo) => void,
  signal?: AbortSignal
): Promise<Response> {
  const token = await ensureCsrfToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('x-csrf-token', token);

    const startTime = Date.now();

    if (xhr.upload && onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && e.total > 0) {
          const elapsedSec = Math.max(0.05, (Date.now() - startTime) / 1000);
          const speedBytesPerSec = e.loaded / elapsedSec;
          const remainingBytes = Math.max(0, e.total - e.loaded);
          const etaSeconds = speedBytesPerSec > 0 ? Math.round(remainingBytes / speedBytesPerSec) : 0;
          const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));

          onProgress({
            etaSeconds,
            loaded: e.loaded,
            percent,
            speedBytesPerSec,
            total: e.total,
          });
        }
      });
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new DOMException('Upload aborted', 'AbortError'));
      });
    }

    xhr.onload = () => {
      const headers = new Headers();
      const rawHeaders = xhr.getAllResponseHeaders().trim().split(/[\r\n]+/);
      rawHeaders.forEach((line) => {
        const parts = line.split(': ');
        const header = parts.shift();
        const value = parts.join(': ');
        if (header) headers.append(header, value);
      });

      const response = new Response(xhr.response || xhr.responseText, {
        headers,
        status: xhr.status,
        statusText: xhr.statusText,
      });

      resolve(response);
    };

    xhr.onerror = () => {
      reject(new TypeError('Network request failed'));
    };

    xhr.ontimeout = () => {
      reject(new TypeError('Network request timed out'));
    };

    xhr.send(formData);
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function checkAuthSession(): Promise<User | null> {
  try {
    const res = await getApi('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data && data.user) {
        setAuthState(data.user, data.accounts || []);
        return data.user;
      }
    }
  } catch {}
  setAuthState(null, []);
  return null;
}

async function switchAccountApi(userId: number | string): Promise<{ accounts?: User[]; error?: string; success: boolean; user?: User }> {
  try {
    const res = await postApi('/api/auth/switch-account', { userId });
    const data = await res.json();
    if (res.ok && data.success && data.user) {
      setAuthState(data.user, data.accounts || []);
      return { accounts: data.accounts, success: true, user: data.user };
    }
    return { error: data.error || t('ui.no_se_pudo_cambiar_de_cuenta'), success: false };
  } catch {
    return { error: t('ui.error_de_red_al_cambiar_de_cuenta'), success: false };
  }
}

function clearWalStorage(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('boardpdf_wal_')) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

async function logoutApi(userId?: number | string): Promise<{ accounts?: User[]; success: boolean; switched?: boolean; user?: User | null }> {
  try {
    const res = await postApi('/api/auth/logout', userId ? { userId } : {});
    if (res.ok) {
      const data = await res.json();
      if (data.switched && data.user) {
        setAuthState(data.user, data.accounts || []);
        return { accounts: data.accounts, success: true, switched: true, user: data.user };
      }
      clearWalStorage();
      clearAllLocalDrafts();
      wsService.disconnect();
      setAuthState(null, []);
      return { accounts: [], success: true, switched: false, user: null };
    }
  } catch {}
  clearWalStorage();
  clearAllLocalDrafts();
  wsService.disconnect();
  setAuthState(null, []);
  return { accounts: [], success: true, switched: false, user: null };
}

async function logoutAllApi(): Promise<boolean> {
  try {
    await postApi('/api/auth/logout-all');
  } catch {}
  clearWalStorage();
  clearAllLocalDrafts();
  wsService.disconnect();
  setAuthState(null, []);
  return true;
}

function updateUserSubscriptionTier(tier: string): void {
  if (currentUser) {
    currentUser.subscription_tier = tier;
    setAuthState(
      { ...currentUser, subscription_tier: tier },
      linkedAccounts.map((a) => (a.id === currentUser?.id ? { ...a, subscription_tier: tier } : a))
    );
  }
}

async function createCheckoutApi(planId: string, billingPeriod: string): Promise<{ error?: string; sessionId?: string; success: boolean; url?: string }> {
  try {
    const res = await postApi('/api/subscription/checkout', { billingPeriod, planId });
    return await res.json();
  } catch {
    return { error: t('ui.error_al_conectar_con_la_pasarela_de_pag'), success: false };
  }
}

async function createSubscriptionIntentApi(
  planId: string,
  billingPeriod: string = 'monthly'
): Promise<SubscriptionIntentResponse & { error?: string }> {
  try {
    const res = await postApi('/api/subscription/create-intent', { billingPeriod, planId });
    return await res.json();
  } catch {
    return {
      amount: 0,
      billingPeriod: billingPeriod as any,
      clientSecret: '',
      currency: 'USD',
      error: t('ui.error_al_conectar_con_la_pasarela_de_pag'),
      paymentIntentId: '',
      planId: planId as any,
      planName: '',
      publishableKey: '',
      subscriptionId: '',
      success: false,
    };
  }
}

async function confirmSubscriptionPaymentApi(
  subscriptionId: string,
  paymentIntentId?: string
): Promise<{ error?: string; message?: string; success: boolean; tier?: string }> {
  try {
    const res = await postApi('/api/subscription/confirm-intent', { paymentIntentId, subscriptionId });
    return await res.json();
  } catch {
    return { error: t('ui.error_al_confirmar_la_suscripcion'), success: false };
  }
}

async function createOneTimePaymentIntentApi(
  planId: string,
  duration: '1_month' | '12_months' = '1_month'
): Promise<OneTimePaymentIntentResponse & { error?: string }> {
  try {
    const res = await postApi('/api/subscription/create-one-time-intent', { duration, planId });
    return await res.json();
  } catch {
    return {
      amount: 0,
      billingType: 'one_time',
      clientSecret: '',
      currency: 'USD',
      duration,
      error: t('ui.error_al_conectar_con_la_pasarela_de_pag'),
      paymentIntentId: '',
      planId: planId as any,
      planName: '',
      publishableKey: '',
      success: false,
    };
  }
}

async function confirmOneTimePaymentApi(
  paymentIntentId: string
): Promise<{ error?: string; periodEnd?: string; planId?: string; success: boolean }> {
  try {
    const res = await postApi('/api/subscription/confirm-one-time-intent', { paymentIntentId });
    return await res.json();
  } catch {
    return { error: t('ui.error_al_confirmar_el_pago_unico'), success: false };
  }
}

async function verifySubscriptionSessionApi(sessionId: string): Promise<{ error?: string; message?: string; purchase?: any; success: boolean; tier?: string }> {
  try {
    const res = await getApi(`/api/subscription/verify-session?session_id=${encodeURIComponent(sessionId)}`);
    return await res.json();
  } catch {
    return { error: t('ui.error_al_verificar_sesion_de_pago'), success: false };
  }
}

async function getBillingDetailsApi(): Promise<any> {
  try {
    const res = await getApi('/api/subscription/billing');
    return await res.json();
  } catch {
    return { hasSubscription: false, success: false, tier: 'free' };
  }
}

async function getPurchaseHistoryApi(): Promise<{ purchases: any[]; success: boolean }> {
  try {
    const res = await getApi('/api/subscription/purchases');
    return await res.json();
  } catch {
    return { purchases: [], success: false };
  }
}

async function downloadInvoiceApi(purchaseId: number | string): Promise<{ blob?: Blob; error?: string; filename?: string; success: boolean }> {
  try {
    const res = await getApi(`/api/subscription/purchases/${encodeURIComponent(purchaseId)}/invoice`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { error: data?.error || t('ui.no_se_pudo_descargar_la_factura'), success: false };
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `Factura-BoardPDF-${purchaseId}.pdf`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename=["']?([^"';]+)["']?/);
      if (match && match[1]) filename = match[1];
    }
    return { blob, filename, success: true };
  } catch {
    return { error: t('ui.error_de_red_al_intentar_descargar_la_fa'), success: false };
  }
}

async function updateAutoRenewalApi(cancelAtPeriodEnd: boolean): Promise<any> {
  try {
    const res = await postApi('/api/subscription/renewal', { cancelAtPeriodEnd });
    return await res.json();
  } catch {
    return { error: 'Error de red al actualizar renovación', success: false };
  }
}

async function cancelSubscriptionImmediateApi(): Promise<any> {
  try {
    const res = await postApi('/api/subscription/cancel-immediate', {});
    return await res.json();
  } catch {
    return { error: t('ui.error_de_red_al_cancelar_suscripcion'), success: false };
  }
}

function updateUserAiTokens(balance: number): void {
  if (currentUser) {
    currentUser.ai_tokens_balance = balance;
    setAuthState(
      { ...currentUser, ai_tokens_balance: balance },
      linkedAccounts.map((a) => (a.id === currentUser?.id ? { ...a, ai_tokens_balance: balance } : a))
    );
  }
}

async function fetchAiTokenBalance(): Promise<{ balance: number; limit: number; resetAt: string } | null> {
  try {
    const res = await getApi(API_ROUTES.tokens.balance);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data) {
      if (currentUser && typeof json.data.balance === 'number') {
        updateUserAiTokens(json.data.balance);
      }
      return json.data;
    }
    return null;
  } catch {
    return null;
  }
}

async function estimateAiTokens(
  toolId: string,
  pageCount: number,
  fileSizeBytes: number
): Promise<{ canAfford: boolean; cost: number; currentBalance: number; pageCount: number; remainingAfter: number } | null> {
  try {
    const res = await postApi(API_ROUTES.tokens.estimate, { fileSizeBytes, pageCount, toolId });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export { cancelSubscriptionImmediateApi, checkAuthSession, clearUserState, confirmOneTimePaymentApi, confirmSubscriptionPaymentApi, createCheckoutApi, createOneTimePaymentIntentApi, createSubscriptionIntentApi, currentUser, deleteApi, downloadInvoiceApi, ensureCsrfToken, escapeHtml, estimateAiTokens, fetchAiTokenBalance, getApi, getBillingDetailsApi, getCsrfToken, getPurchaseHistoryApi, hasPermission, hasSubscriptionFeature, linkedAccounts, logoutAllApi, logoutApi, onAuthChange, patchApi, postApi, postFormApi, postFormWithProgress, putApi, setAuthState, setCurrentUser, setLinkedAccounts, switchAccountApi, updateAutoRenewalApi, updateUserAiTokens, updateUserSubscriptionTier, verifySubscriptionSessionApi };
export type { UploadProgressInfo };
