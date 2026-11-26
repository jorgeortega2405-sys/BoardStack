import type { AdminSessionAccount, AdminSessionTokenAccount, AdminUserPayload } from '../types/auth.types.js';
import {
  clearAdminSessionCookie,
  getAdminSessionPayload,
  hydrateLinkedAdminAccounts,
  persistPrunedAdminSession,
} from '../services/auth.service.js';
import { type CoreUserRow, findUserById, getRevokedAtMap } from '../services/user.service.js';
import { getUserAdminAccess } from '../services/admin-access.service.js';
import type { NextFunction, Request, Response } from 'express';
import { sanitizeAdminUser } from '../utils/user.util.js';
import type { UserAdminAccess } from '../types/admin.types.js';

interface ValidatedAdminSession {
  access: UserAdminAccess;
  accounts: AdminSessionAccount[];
  user: AdminUserPayload;
}

async function getValidatedAdminSession(
  req: Request,
  res?: Response,
  options?: { includeAccounts?: boolean }
): Promise<ValidatedAdminSession | null> {
  const includeAccounts = Boolean(options?.includeAccounts);
  if (includeAccounts && (req as any)._cachedValidatedAdminSessionFull !== undefined) {
    return (req as any)._cachedValidatedAdminSessionFull;
  }
  if (!includeAccounts && (req as any)._cachedValidatedAdminSession !== undefined) {
    return (req as any)._cachedValidatedAdminSession;
  }

  const payload = getAdminSessionPayload(req);
  if (!payload || !Array.isArray(payload.accounts) || payload.accounts.length === 0) {
    (req as any)._cachedValidatedAdminSession = null;
    (req as any)._cachedValidatedAdminSessionFull = null;
    return null;
  }

  const activeEntry = payload.accounts.find((a) => a.id === payload.activeId);
  const otherEntries = payload.accounts
    .filter((a) => a.id !== payload.activeId)
    .sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0));
  const orderedCandidates = activeEntry ? [activeEntry, ...otherEntries] : otherEntries;

  const invalidIds = new Set<number>();
  let matchedEntry: AdminSessionTokenAccount | null = null;
  let matchedDbUser: CoreUserRow | null = null;
  let matchedAccess: UserAdminAccess | null = null;

  for (const candidate of orderedCandidates) {
    const dbUser = await findUserById(candidate.id);
    if (!dbUser || dbUser.status !== 'active') {
      invalidIds.add(candidate.id);
      continue;
    }

    const revokedAtMap = await getRevokedAtMap([Number(dbUser.id)]);
    const revokedAt = revokedAtMap.get(Number(dbUser.id)) || 0;
    const candidateIat = candidate.iat || payload.iat || 0;
    if (revokedAt > 0 && (!candidateIat || candidateIat < revokedAt)) {
      invalidIds.add(candidate.id);
      continue;
    }

    const access = await getUserAdminAccess(Number(dbUser.id));
    if (!access.hasAccess) {
      invalidIds.add(candidate.id);
      continue;
    }

    matchedEntry = candidate;
    matchedDbUser = dbUser;
    matchedAccess = access;
    break;
  }

  if (!matchedEntry || !matchedDbUser || !matchedAccess) {
    clearAdminSessionCookie(res, req);
    (req as any)._cachedValidatedAdminSession = null;
    (req as any)._cachedValidatedAdminSessionFull = null;
    return null;
  }

  let currentPayload = payload;
  if (invalidIds.size > 0 || payload.activeId !== matchedEntry.id) {
    const remainingTokenAccounts = payload.accounts.filter((a) => !invalidIds.has(a.id));
    const persisted = persistPrunedAdminSession(
      res,
      req,
      remainingTokenAccounts,
      matchedEntry.id,
      payload
    );
    if (!persisted) {
      (req as any)._cachedValidatedAdminSession = null;
      (req as any)._cachedValidatedAdminSessionFull = null;
      return null;
    }
    currentPayload = persisted;
  }

  const user = sanitizeAdminUser(matchedDbUser, matchedAccess.isSuperAdmin);
  const accounts = includeAccounts
    ? await hydrateLinkedAdminAccounts(req, res, currentPayload, user, matchedAccess.isSuperAdmin)
    : [];

  const session: ValidatedAdminSession = {
    access: matchedAccess,
    accounts,
    user,
  };

  if (includeAccounts) {
    (req as any)._cachedValidatedAdminSessionFull = session;
    (req as any)._cachedValidatedAdminSession = session;
  } else {
    (req as any)._cachedValidatedAdminSession = session;
  }
  return session;
}

async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await getValidatedAdminSession(req, res);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.', ok: false });
    return;
  }
  (req as any).adminSession = session;
  next();
}

function getAdminRequestSession(req: Request): ValidatedAdminSession | null {
  return ((req as any).adminSession as ValidatedAdminSession | undefined) || null;
}

export {
  getAdminRequestSession,
  getValidatedAdminSession,
  requireAdminAuth
};

export type {
  ValidatedAdminSession
};
