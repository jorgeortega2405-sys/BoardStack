import type { AdminUserPayload } from '../types/auth.types.js';
import { clearAdminSessionCookie, getAdminSessionPayload } from '../services/auth.service.js';
import { findUserById } from '../services/user.service.js';
import { getRedisClient } from '../config/redis.config.js';
import { getUserAdminAccess } from '../services/admin-access.service.js';
import type { NextFunction, Request, Response } from 'express';
import { sanitizeAdminUser } from '../utils/user.util.js';
import type { UserAdminAccess } from '../types/admin.types.js';

interface ValidatedAdminSession {
  access: UserAdminAccess;
  user: AdminUserPayload;
}

async function getValidatedAdminSession(
  req: Request,
  res?: Response
): Promise<ValidatedAdminSession | null> {
  if ((req as any)._cachedValidatedAdminSession !== undefined) {
    return (req as any)._cachedValidatedAdminSession;
  }

  const payload = getAdminSessionPayload(req);
  if (!payload || typeof payload.userId !== 'number') {
    (req as any)._cachedValidatedAdminSession = null;
    return null;
  }

  const dbUser = await findUserById(payload.userId);
  if (!dbUser || dbUser.status !== 'active') {
    if (res) {
      clearAdminSessionCookie(res);
    }
    (req as any)._cachedValidatedAdminSession = null;
    return null;
  }

  if (payload.iat) {
    try {
      const redis = getRedisClient();
      const revokedAt = await redis.get(`user:session_revoked:${dbUser.id}`);
      if (revokedAt && payload.iat < Number(revokedAt)) {
        if (res) {
          clearAdminSessionCookie(res);
        }
        (req as any)._cachedValidatedAdminSession = null;
        return null;
      }
    } catch {}
  }

  const access = await getUserAdminAccess(dbUser.id);
  if (!access.hasAccess) {
    if (res) {
      clearAdminSessionCookie(res);
    }
    (req as any)._cachedValidatedAdminSession = null;
    return null;
  }

  const session: ValidatedAdminSession = {
    access,
    user: sanitizeAdminUser(dbUser, access.isSuperAdmin),
  };
  (req as any)._cachedValidatedAdminSession = session;
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
