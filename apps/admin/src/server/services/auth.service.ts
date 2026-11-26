import type { AccessibleAdminApp } from '../types/admin.types.js';
import type { AdminSessionPayload, AdminUserPayload } from '../types/auth.types.js';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.config.js';
import type { CoreUserRow } from './user.service.js';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { sanitizeAdminUser } from '../utils/user.util.js';
import { updateUserLastLogin } from './user.service.js';

const COOKIE_NAME = 'boardstack_admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function createAdminSessionToken(session: AdminSessionPayload): string {
  const now = Date.now();
  const sessionWithMeta: AdminSessionPayload = {
    exp: session.exp || now + SESSION_TTL_MS,
    iat: session.iat || now,
    userId: session.userId,
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
      if (typeof parsed.userId === 'number') {
        return parsed as AdminSessionPayload;
      }
    }
    return null;
  } catch {
    return null;
  }
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

function setAdminSessionCookie(res: Response, userId: number): void {
  if (res.headersSent) return;
  const now = Date.now();
  const payload: AdminSessionPayload = {
    exp: now + SESSION_TTL_MS,
    iat: now,
    userId,
  };
  const token = createAdminSessionToken(payload);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
    sameSite: 'lax',
    secure: isSecureCookie(),
  });
}

function clearAdminSessionCookie(res: Response): void {
  if (res.headersSent) return;
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: isSecureCookie(),
  });
}

async function completeAdminLogin(
  res: Response,
  userRow: CoreUserRow,
  isSuperAdmin: boolean,
  accessibleApps: AccessibleAdminApp[],
  clientIp?: string
): Promise<{
  accessibleApps: AccessibleAdminApp[];
  user: AdminUserPayload;
}> {
  if (clientIp) {
    void updateUserLastLogin(userRow.id, clientIp);
  }
  setAdminSessionCookie(res, userRow.id);
  return {
    accessibleApps,
    user: sanitizeAdminUser(userRow, isSuperAdmin),
  };
}

export {
  COOKIE_NAME,
  clearAdminSessionCookie,
  completeAdminLogin,
  createAdminSessionToken,
  getAdminSessionPayload,
  setAdminSessionCookie,
  verifyAdminSessionToken,
  verifyPassword
};
