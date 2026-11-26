import type { AccessibleAdminApp } from '../types/admin.types.js';
import type {
  AdminSessionAccount,
  AdminSessionPayload,
  AdminSessionTokenAccount,
  AdminUserPayload,
} from '../types/auth.types.js';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.config.js';
import type { CoreUserRow } from './user.service.js';
import crypto from 'crypto';
import { findUsersByIds, getRevokedAtMap, updateUserLastLogin } from './user.service.js';
import { getUserAdminAccess } from './admin-access.service.js';
import {
  normalizeSubscriptionTier,
  sanitizeAdminSessionAccount,
  sanitizeAdminUser,
} from '../utils/user.util.js';
import type { Request, Response } from 'express';

const COOKIE_NAME = 'boardstack_admin_session';
const MAX_CONCURRENT_ACCOUNTS = 3;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function createAdminSessionToken(session: AdminSessionPayload): string {
  const now = Date.now();
  const sessionWithMeta: AdminSessionPayload = {
    accounts: session.accounts,
    activeId: session.activeId,
    exp: session.exp || now + SESSION_TTL_MS,
    iat: session.iat || now,
  };
  const payloadStr = JSON.stringify(sessionWithMeta);
  const payloadBase64 = Buffer.from(payloadStr, 'utf-8').toString('base64url');
  const signature = crypto.createHmac('sha256', config.sessionSecret).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

function verifyAdminSessionToken(token: string): AdminSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', config.sessionSecret).update(payloadBase64).digest('base64url');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return null;
    }

    const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const parsed = JSON.parse(payloadStr);

    if (parsed && typeof parsed === 'object') {
      if (parsed.exp && typeof parsed.exp === 'number' && Date.now() > parsed.exp) {
        return null;
      }

      if (Array.isArray(parsed.accounts) && typeof parsed.activeId === 'number') {
        const seenIds = new Set<number>();
        const normalizedAccounts: AdminSessionTokenAccount[] = [];
        for (const item of parsed.accounts) {
          if (!item || typeof item.id !== 'number' || !Number.isInteger(item.id) || item.id <= 0 || seenIds.has(item.id)) {
            continue;
          }
          seenIds.add(item.id);
          normalizedAccounts.push({
            avatar_url: typeof item.avatar_url === 'string' ? item.avatar_url : null,
            email: typeof item.email === 'string' ? item.email : undefined,
            iat: typeof item.iat === 'number' && item.iat > 0 ? item.iat : (typeof parsed.iat === 'number' ? parsed.iat : 0),
            id: Number(item.id),
            last_accessed: typeof item.last_accessed === 'number' ? item.last_accessed : 0,
            subscription_tier: item.subscription_tier ? normalizeSubscriptionTier(item.subscription_tier) : undefined,
            username: typeof item.username === 'string' ? item.username : undefined,
          });
        }
        if (normalizedAccounts.length === 0) {
          return null;
        }
        return {
          accounts: normalizedAccounts,
          activeId: Number(parsed.activeId),
          exp: parsed.exp,
          iat: parsed.iat,
        };
      }

      if (typeof parsed.userId === 'number' && Number.isInteger(parsed.userId) && parsed.userId > 0) {
        const legacyIat = typeof parsed.iat === 'number' ? parsed.iat : 0;
        return {
          accounts: [
            {
              iat: legacyIat,
              id: Number(parsed.userId),
              last_accessed: legacyIat || Date.now(),
            },
          ],
          activeId: Number(parsed.userId),
          exp: parsed.exp,
          iat: parsed.iat,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function invalidateRequestSessionCache(req: Request, payload?: AdminSessionPayload | null): void {
  if (payload !== undefined) {
    (req as any)._cachedAdminSessionPayload = payload;
  }
  (req as any)._cachedValidatedAdminSession = undefined;
  (req as any)._cachedValidatedAdminSessionFull = undefined;
}

function getAdminSessionPayload(req: Request): AdminSessionPayload | null {
  if ((req as any)._cachedAdminSessionPayload !== undefined) {
    return (req as any)._cachedAdminSessionPayload;
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    (req as any)._cachedAdminSessionPayload = null;
    return null;
  }

  const session = verifyAdminSessionToken(token);
  (req as any)._cachedAdminSessionPayload = session;
  return session;
}

function isSecureCookie(): boolean {
  return (
    config.nodeEnv === 'production' &&
    !config.appUrl.startsWith('http://localhost') &&
    !config.appUrl.startsWith('http://127.0.0.1')
  );
}

function setAdminSessionCookie(res: Response, session: AdminSessionPayload): void {
  if (res.headersSent) return;
  const token = createAdminSessionToken(session);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
    sameSite: 'lax',
    secure: isSecureCookie(),
  });
}

function clearAdminSessionCookie(res?: Response, req?: Request): void {
  if (req) {
    invalidateRequestSessionCache(req, null);
  }
  if (!res || res.headersSent) return;
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: isSecureCookie(),
  });
}

function persistPrunedAdminSession(
  res: Response | undefined,
  req: Request,
  accounts: AdminSessionTokenAccount[],
  activeId: number,
  baseSession: AdminSessionPayload
): AdminSessionPayload | null {
  if (accounts.length === 0) {
    clearAdminSessionCookie(res, req);
    return null;
  }

  const nextActiveId = accounts.some((a) => a.id === activeId) ? activeId : accounts[0].id;
  const updatedSession: AdminSessionPayload = {
    ...baseSession,
    accounts,
    activeId: nextActiveId,
  };
  invalidateRequestSessionCache(req, updatedSession);
  if (res) {
    setAdminSessionCookie(res, updatedSession);
  }
  return updatedSession;
}

function addAccountToAdminSession(
  res: Response,
  req: Request,
  user: AdminUserPayload
): AdminSessionPayload {
  const existingSession = getAdminSessionPayload(req);
  const now = Date.now();
  const userId = Number(user.id);

  const accountEntry: AdminSessionTokenAccount = {
    avatar_url: user.avatar_url ?? null,
    email: user.email,
    iat: now,
    id: userId,
    last_accessed: now,
    subscription_tier: normalizeSubscriptionTier(user.subscription_tier),
    username: user.username,
  };

  if (!existingSession) {
    const newSession: AdminSessionPayload = {
      accounts: [accountEntry],
      activeId: userId,
      exp: now + SESSION_TTL_MS,
      iat: now,
    };
    invalidateRequestSessionCache(req, newSession);
    setAdminSessionCookie(res, newSession);
    return newSession;
  }

  const accounts = [...existingSession.accounts];
  const existingIndex = accounts.findIndex((a) => a.id === userId);

  if (existingIndex >= 0) {
    accounts[existingIndex] = accountEntry;
  } else {
    if (accounts.length >= MAX_CONCURRENT_ACCOUNTS) {
      let oldestIdx = 0;
      for (let i = 1; i < accounts.length; i++) {
        if ((accounts[i].last_accessed || 0) < (accounts[oldestIdx].last_accessed || 0)) {
          oldestIdx = i;
        }
      }
      accounts.splice(oldestIdx, 1);
    }
    accounts.push(accountEntry);
  }

  const updatedSession: AdminSessionPayload = {
    accounts,
    activeId: userId,
    exp: now + SESSION_TTL_MS,
    iat: existingSession.iat || now,
  };

  invalidateRequestSessionCache(req, updatedSession);
  setAdminSessionCookie(res, updatedSession);
  return updatedSession;
}

function switchAccountInAdminSession(
  res: Response,
  req: Request,
  user: AdminUserPayload
): { session: AdminSessionPayload | null; success: boolean } {
  const session = getAdminSessionPayload(req);
  if (!session) {
    return { session: null, success: false };
  }

  const targetId = Number(user.id);
  const targetIndex = session.accounts.findIndex((a) => a.id === targetId);
  if (targetIndex < 0) {
    return { session, success: false };
  }

  const now = Date.now();
  const accounts = [...session.accounts];
  accounts[targetIndex] = {
    ...accounts[targetIndex],
    avatar_url: user.avatar_url ?? null,
    email: user.email,
    last_accessed: now,
    subscription_tier: normalizeSubscriptionTier(user.subscription_tier),
    username: user.username,
  };

  const updatedSession: AdminSessionPayload = {
    ...session,
    accounts,
    activeId: targetId,
    exp: now + SESSION_TTL_MS,
  };

  invalidateRequestSessionCache(req, updatedSession);
  setAdminSessionCookie(res, updatedSession);
  return { session: updatedSession, success: true };
}

function removeAccountFromAdminSession(
  res: Response,
  req: Request,
  userId?: number
): { remainingCount: number; removedId: number | null; session: AdminSessionPayload | null } {
  const session = getAdminSessionPayload(req);
  if (!session) {
    clearAdminSessionCookie(res, req);
    return { remainingCount: 0, removedId: null, session: null };
  }

  const idToRemove = userId !== undefined && !isNaN(Number(userId)) ? Number(userId) : session.activeId;
  const remaining = session.accounts.filter((a) => a.id !== idToRemove);

  if (remaining.length === 0) {
    clearAdminSessionCookie(res, req);
    return { remainingCount: 0, removedId: idToRemove, session: null };
  }

  let nextActiveId = session.activeId;
  if (nextActiveId === idToRemove || !remaining.some((a) => a.id === nextActiveId)) {
    const sorted = [...remaining].sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0));
    nextActiveId = sorted[0].id;
  }

  const updatedSession: AdminSessionPayload = {
    ...session,
    accounts: remaining,
    activeId: nextActiveId,
  };

  invalidateRequestSessionCache(req, updatedSession);
  setAdminSessionCookie(res, updatedSession);
  return {
    remainingCount: remaining.length,
    removedId: idToRemove,
    session: updatedSession,
  };
}

async function hydrateLinkedAdminAccounts(
  req: Request,
  res: Response | undefined,
  session: AdminSessionPayload,
  activeUser: AdminUserPayload,
  activeIsSuperAdmin: boolean
): Promise<AdminSessionAccount[]> {
  const allIds = session.accounts.map((a) => a.id);
  const otherIds = allIds.filter((id) => id !== activeUser.id);

  const [dbUsers, revokedAtMap] = otherIds.length > 0
    ? await Promise.all([findUsersByIds(otherIds), getRevokedAtMap(otherIds)])
    : [[], new Map<number, number>()];

  const dbUserById = new Map<number, CoreUserRow>();
  for (const row of dbUsers) {
    dbUserById.set(Number(row.id), row);
  }

  const validTokenAccounts: AdminSessionTokenAccount[] = [];
  const hydratedAccounts: AdminSessionAccount[] = [];
  let pruned = false;

  for (const entry of session.accounts) {
    if (entry.id === activeUser.id) {
      const normalizedTier = normalizeSubscriptionTier(activeUser.subscription_tier);
      validTokenAccounts.push({
        ...entry,
        avatar_url: activeUser.avatar_url ?? null,
        email: activeUser.email,
        subscription_tier: normalizedTier,
        username: activeUser.username,
      });
      hydratedAccounts.push(
        sanitizeAdminSessionAccount(activeUser, entry.last_accessed || Date.now(), activeIsSuperAdmin)
      );
      continue;
    }

    const dbUser = dbUserById.get(entry.id);
    if (!dbUser || dbUser.status !== 'active') {
      pruned = true;
      continue;
    }

    const revokedAt = revokedAtMap.get(entry.id) || 0;
    const entryIat = entry.iat || session.iat || 0;
    if (revokedAt > 0 && (!entryIat || entryIat < revokedAt)) {
      pruned = true;
      continue;
    }

    const access = await getUserAdminAccess(Number(dbUser.id));
    if (!access.hasAccess) {
      pruned = true;
      continue;
    }

    const normalizedTier = normalizeSubscriptionTier(dbUser.subscription_tier);
    validTokenAccounts.push({
      ...entry,
      avatar_url: dbUser.avatar_url ?? null,
      email: dbUser.email,
      subscription_tier: normalizedTier,
      username: dbUser.username,
    });
    hydratedAccounts.push(
      sanitizeAdminSessionAccount(dbUser, entry.last_accessed || Date.now(), access.isSuperAdmin)
    );
  }

  if (pruned) {
    persistPrunedAdminSession(res, req, validTokenAccounts, activeUser.id, session);
  }

  return hydratedAccounts;
}

async function completeAdminLogin(
  res: Response,
  req: Request,
  userRow: CoreUserRow,
  isSuperAdmin: boolean,
  accessibleApps: AccessibleAdminApp[],
  clientIp?: string
): Promise<{
  accessibleApps: AccessibleAdminApp[];
  accounts: AdminSessionAccount[];
  user: AdminUserPayload;
}> {
  if (clientIp) {
    void updateUserLastLogin(userRow.id, clientIp);
  }
  const user = sanitizeAdminUser(userRow, isSuperAdmin);
  const session = addAccountToAdminSession(res, req, user);
  const accounts = await hydrateLinkedAdminAccounts(req, res, session, user, isSuperAdmin);
  return {
    accessibleApps,
    accounts,
    user,
  };
}

export {
  COOKIE_NAME,
  MAX_CONCURRENT_ACCOUNTS,
  addAccountToAdminSession,
  clearAdminSessionCookie,
  completeAdminLogin,
  createAdminSessionToken,
  getAdminSessionPayload,
  hydrateLinkedAdminAccounts,
  persistPrunedAdminSession,
  removeAccountFromAdminSession,
  setAdminSessionCookie,
  switchAccountInAdminSession,
  verifyAdminSessionToken,
  verifyPassword
};
