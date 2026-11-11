import { API_ROUTES } from '../config/api-routes.js';
import { User } from '../types/auth.types.js';
import { OneTimePaymentIntentResponse, SubscriptionIntentResponse } from '../types/subscription.types.js';
import type { FolderSharingDetailsResponse, TeamBillingDetailsResponse, TeamDetailResponse, TeamInviteInspectResponse, TeamListResponse, TeamSeatPreviewResponse, TeamSeatUpdateResponse, TeamSummary } from '../types/team.types.js';
import { clearAllLocalDrafts } from '../utils/collab-local-draft.util.js';
import { t } from './i18n.service.js';
import { wsService } from './websocket.service.js';
import { getActiveTeamId, resolveActiveWorkspace, setActiveTeamId } from './workspace.service.js';

function getWorkspaceHeaders(): Record<string, string> {
  const teamId = getActiveTeamId();
  return teamId ? { 'X-Team-Id': String(teamId) } : {};
}

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

function getActiveWorkspaceTeam(): TeamSummary | null {
  return resolveActiveWorkspace(currentUser);
}

function hasPermission(permission: string): boolean {
  if (currentUser && Array.isArray(currentUser.permissions) && currentUser.permissions.includes(permission)) {
    return true;
  }
  const activeTeam = resolveActiveWorkspace(currentUser);
  if (activeTeam && Array.isArray(activeTeam.permissions) && activeTeam.permissions.includes(permission)) {
    return true;
  }
  return false;
}

function hasTeamPermission(permission: string): boolean {
  const activeTeam = resolveActiveWorkspace(currentUser);
  if (!activeTeam || !Array.isArray(activeTeam.permissions)) return false;
  return activeTeam.permissions.includes(permission);
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
      ...getWorkspaceHeaders(),
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
      ...getWorkspaceHeaders(),
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
      ...getWorkspaceHeaders(),
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
      ...getWorkspaceHeaders(),
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
      ...getWorkspaceHeaders(),
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
      ...getWorkspaceHeaders(),
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
    const activeTeamId = getActiveTeamId();
    if (activeTeamId) {
      xhr.setRequestHeader('X-Team-Id', String(activeTeamId));
    }

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
        resolveActiveWorkspace(data.user);
        return data.user;
      }
    }
  } catch {}
  setActiveTeamId(null);
  setAuthState(null, []);
  return null;
}

async function switchAccountApi(userId: number | string): Promise<{ accounts?: User[]; error?: string; success: boolean; user?: User }> {
  try {
    const res = await postApi('/api/auth/switch-account', { userId });
    const data = await res.json();
    if (res.ok && data.success && data.user) {
      setAuthState(data.user, data.accounts || []);
      resolveActiveWorkspace(data.user);
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
        resolveActiveWorkspace(data.user);
        return { accounts: data.accounts, success: true, switched: true, user: data.user };
      }
      clearWalStorage();
      clearAllLocalDrafts();
      wsService.disconnect();
      setActiveTeamId(null);
      setAuthState(null, []);
      return { accounts: [], success: true, switched: false, user: null };
    }
  } catch {}
  clearWalStorage();
  clearAllLocalDrafts();
  wsService.disconnect();
  setActiveTeamId(null);
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
  setActiveTeamId(null);
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
  billingPeriod: string = 'monthly',
  teamOptions?: { scope?: 'personal' | 'team'; seats?: number; teamId?: number; teamName?: string }
): Promise<SubscriptionIntentResponse & { error?: string }> {
  try {
    const res = await postApi('/api/subscription/create-intent', {
      billingPeriod,
      planId,
      ...(teamOptions || {}),
    });
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
): Promise<{ error?: string; message?: string; seats?: number; success: boolean; teamId?: number | null; tier?: string }> {
  try {
    const res = await postApi('/api/subscription/confirm-intent', { paymentIntentId, subscriptionId });
    return await res.json();
  } catch {
    return { error: t('ui.error_al_confirmar_la_suscripcion'), success: false };
  }
}

async function createOneTimePaymentIntentApi(
  planId: string,
  duration: '1_month' | '12_months' = '1_month',
  teamOptions?: { scope?: 'personal' | 'team'; seats?: number; teamId?: number; teamName?: string }
): Promise<OneTimePaymentIntentResponse & { error?: string }> {
  try {
    const res = await postApi('/api/subscription/create-one-time-intent', {
      duration,
      planId,
      ...(teamOptions || {}),
    });
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
): Promise<{ error?: string; periodEnd?: string; planId?: string; seats?: number; success: boolean; teamId?: number | null }> {
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

async function listMyTeamsApi(): Promise<TeamListResponse> {
  try {
    const res = await getApi(API_ROUTES.teams.base);
    return await res.json();
  } catch {
    return { error: t('teams.errors.load_teams'), success: false, teams: [] };
  }
}

async function createTeamApi(name: string): Promise<{ error?: string; success: boolean; team?: TeamSummary }> {
  try {
    const res = await postApi(API_ROUTES.teams.base, { name });
    return await res.json();
  } catch {
    return { error: t('teams.errors.create_team'), success: false };
  }
}

async function inspectTeamInvitationApi(token: string): Promise<TeamInviteInspectResponse> {
  try {
    const res = await getApi(API_ROUTES.teams.invitationsInspect(token));
    return await res.json();
  } catch {
    return { error: t('teams.errors.inspect_invite'), success: false };
  }
}

async function acceptTeamInvitationApi(token: string): Promise<{ error?: string; message?: string; success: boolean; team?: TeamSummary }> {
  try {
    const res = await postApi(API_ROUTES.teams.invitationsAccept, { token });
    return await res.json();
  } catch {
    return { error: t('teams.errors.accept_invite'), success: false };
  }
}

async function getCurrentTeamApi(): Promise<TeamDetailResponse> {
  try {
    const res = await getApi(API_ROUTES.teams.current);
    return await res.json();
  } catch {
    return {
      error: t('teams.errors.load_current'),
      invitations: [],
      members: [],
      pendingCount: 0,
      permissions: [],
      role: 'member',
      seatLimit: 0,
      seatsAvailable: 0,
      seatsUsed: 0,
      success: false,
      team: null as unknown as TeamSummary,
    };
  }
}

async function updateCurrentTeamApi(name: string): Promise<{ error?: string; message?: string; success: boolean; team?: TeamSummary }> {
  try {
    const res = await patchApi(API_ROUTES.teams.current, { name });
    return await res.json();
  } catch {
    return { error: t('teams.errors.update_team'), success: false };
  }
}

async function searchCurrentTeamMembersApi(query = ''): Promise<{ error?: string; members: any[]; success: boolean }> {
  try {
    const res = await getApi(API_ROUTES.teams.currentMembersSearch(query));
    return await res.json();
  } catch {
    return { error: t('teams.errors.search_members'), members: [], success: false };
  }
}

async function inviteTeamMemberApi(
  email: string,
  role: 'admin' | 'member'
): Promise<{ emailSent?: boolean; error?: string; invitation?: any; inviteUrl?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.teams.currentInvitations, { email, role });
    return await res.json();
  } catch {
    return { error: t('teams.errors.invite_member'), success: false };
  }
}

async function revokeTeamInvitationApi(invitationId: number | string): Promise<{ error?: string; message?: string; success: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.teams.currentInvitationRevoke(invitationId));
    return await res.json();
  } catch {
    return { error: t('teams.errors.revoke_invite'), success: false };
  }
}

async function updateTeamMemberRoleApi(userId: number | string, role: 'admin' | 'member'): Promise<{ error?: string; message?: string; success: boolean }> {
  try {
    const res = await patchApi(API_ROUTES.teams.currentMemberRole(userId), { role });
    return await res.json();
  } catch {
    return { error: t('teams.errors.update_role'), success: false };
  }
}

async function removeTeamMemberApi(userId: number | string): Promise<{ error?: string; message?: string; success: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.teams.currentMemberDelete(userId));
    return await res.json();
  } catch {
    return { error: t('teams.errors.remove_member'), success: false };
  }
}

async function leaveCurrentTeamApi(): Promise<{ error?: string; message?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.teams.currentLeave);
    return await res.json();
  } catch {
    return { error: t('teams.errors.leave_team'), success: false };
  }
}

async function getTeamBillingDetailsApi(): Promise<TeamBillingDetailsResponse> {
  try {
    const res = await getApi(API_ROUTES.teams.currentBilling);
    return await res.json();
  } catch {
    return {
      billing: { hasSubscription: false, success: false, tier: 'business' },
      error: t('teams.errors.load_billing'),
      purchases: [],
      success: false,
    };
  }
}

async function previewTeamSeatsApi(seats: number): Promise<TeamSeatPreviewResponse> {
  try {
    const res = await postApi(API_ROUTES.teams.currentSeatsPreview, { seats });
    return await res.json();
  } catch {
    return { error: t('teams.errors.preview_seats'), success: false };
  }
}

async function updateTeamSeatsApi(seats: number): Promise<TeamSeatUpdateResponse> {
  try {
    const res = await postApi(API_ROUTES.teams.currentSeats, { seats });
    return await res.json();
  } catch {
    return { error: t('teams.errors.update_seats'), success: false };
  }
}

async function confirmTeamSeatUpgradeIntentApi(
  paymentIntentId: string
): Promise<{ error?: string; message?: string; seatLimit?: number; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.teams.currentSeatsConfirmIntent, { paymentIntentId });
    return await res.json();
  } catch {
    return { error: t('teams.errors.confirm_seats'), success: false };
  }
}

async function updateTeamRenewalApi(
  cancelAtPeriodEnd: boolean
): Promise<{ cancel_at_period_end?: boolean; current_period_end?: string | null; error?: string; message?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.teams.currentBillingRenewal, { cancelAtPeriodEnd });
    return await res.json();
  } catch {
    return { error: t('teams.errors.update_renewal'), success: false };
  }
}

async function cancelTeamSubscriptionImmediateApi(): Promise<{ error?: string; message?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.teams.currentBillingCancel);
    return await res.json();
  } catch {
    return { error: t('teams.errors.cancel_subscription'), success: false };
  }
}

async function getFolderMembersApi(folderId: string): Promise<FolderSharingDetailsResponse> {
  try {
    const res = await getApi(API_ROUTES.projectFolders.members(folderId));
    return await res.json();
  } catch {
    return { error: t('projects.sharing_load_error'), success: false };
  }
}

async function updateFolderVisibilityApi(
  folderId: string,
  visibility: 'restricted' | 'team'
): Promise<{ error?: string; folder?: any; success: boolean }> {
  try {
    const res = await patchApi(API_ROUTES.projectFolders.visibility(folderId), { visibility });
    return await res.json();
  } catch {
    return { error: t('projects.sharing_update_error'), success: false };
  }
}

async function addFolderMemberApi(
  folderId: string,
  userId: number | string,
  role: 'editor' | 'viewer'
): Promise<FolderSharingDetailsResponse> {
  try {
    const res = await postApi(API_ROUTES.projectFolders.members(folderId), { role, userId });
    return await res.json();
  } catch {
    return { error: t('projects.sharing_member_add_error'), success: false };
  }
}

async function removeFolderMemberApi(folderId: string, userId: number | string): Promise<FolderSharingDetailsResponse> {
  try {
    const res = await deleteApi(API_ROUTES.projectFolders.memberDelete(folderId, userId));
    return await res.json();
  } catch {
    return { error: t('projects.sharing_member_remove_error'), success: false };
  }
}

async function updateDocTeamAccessApi(
  docId: string,
  teamAccess: 'editor' | 'viewer' | 'none'
): Promise<{ document?: any; error?: string; success: boolean; team_access?: 'editor' | 'viewer' | 'none' }> {
  try {
    const res = await patchApi(API_ROUTES.collaborativeDocs.teamAccess(docId), { teamAccess });
    return await res.json();
  } catch {
    return { error: t('collaborative.team_access_update_error'), success: false };
  }
}

export { acceptTeamInvitationApi, addFolderMemberApi, cancelSubscriptionImmediateApi, cancelTeamSubscriptionImmediateApi, checkAuthSession, clearUserState, confirmOneTimePaymentApi, confirmSubscriptionPaymentApi, confirmTeamSeatUpgradeIntentApi, createCheckoutApi, createOneTimePaymentIntentApi, createSubscriptionIntentApi, createTeamApi, currentUser, deleteApi, downloadInvoiceApi, ensureCsrfToken, escapeHtml, estimateAiTokens, fetchAiTokenBalance, getActiveWorkspaceTeam, getApi, getBillingDetailsApi, getCsrfToken, getCurrentTeamApi, getFolderMembersApi, getPurchaseHistoryApi, getTeamBillingDetailsApi, getWorkspaceHeaders, hasPermission, hasSubscriptionFeature, hasTeamPermission, inspectTeamInvitationApi, inviteTeamMemberApi, leaveCurrentTeamApi, linkedAccounts, listMyTeamsApi, logoutAllApi, logoutApi, onAuthChange, patchApi, postApi, postFormApi, postFormWithProgress, previewTeamSeatsApi, putApi, removeFolderMemberApi, removeTeamMemberApi, revokeTeamInvitationApi, searchCurrentTeamMembersApi, setAuthState, setCurrentUser, setLinkedAccounts, switchAccountApi, updateAutoRenewalApi, updateCurrentTeamApi, updateDocTeamAccessApi, updateFolderVisibilityApi, updateTeamMemberRoleApi, updateTeamRenewalApi, updateTeamSeatsApi, updateUserAiTokens, updateUserSubscriptionTier, verifySubscriptionSessionApi };
export type { UploadProgressInfo };
