import { config } from '../config/env.config.js';
import { MultiAccountSessionPayload, SessionAccount, UserPayload } from '../types/auth.types.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response } from 'express';

export const COOKIE_NAME = 'boardpdf_session';
export const MAX_CONCURRENT_ACCOUNTS = 3;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createMultiAccountToken(session: MultiAccountSessionPayload): string {
  const now = Date.now();
  const sessionWithMeta: MultiAccountSessionPayload = {
    ...session,
    exp: session.exp || now + SESSION_TTL_MS,
    iat: session.iat || now,
  };
  const payloadStr = JSON.stringify(sessionWithMeta);
  const payloadBase64 = Buffer.from(payloadStr, 'utf-8').toString('base64url');
  const signature = crypto.createHmac('sha256', config.sessionSecret).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

export function verifyMultiAccountToken(token: string): MultiAccountSessionPayload | null {
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
        return parsed as MultiAccountSessionPayload;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function getMultiAccountSession(req: Request): MultiAccountSessionPayload | null {
  if ((req as any)._cachedMultiAccountSession) {
    return (req as any)._cachedMultiAccountSession;
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  const session = verifyMultiAccountToken(token);
  if (session) {
    (req as any)._cachedMultiAccountSession = session;
  }
  return session;
}

export function setMultiAccountCookie(res: Response, session: MultiAccountSessionPayload): void {
  if (res.headersSent) return;
  const token = createMultiAccountToken(session);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  });
}

export function clearSessionCookie(res: Response): void {
  if (res.headersSent) return;
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  });
}

export async function addAccountToSession(
  res: Response,
  req: Request,
  user: UserPayload
): Promise<MultiAccountSessionPayload> {
  const existingSession = getMultiAccountSession(req);
  const now = Date.now();

  const accountEntry: SessionAccount = {
    avatar_url: user.avatar_url ?? null,
    email: user.email,
    id: user.id,
    last_accessed: now,
    role: user.role || 'USER',
    roles: user.roles || (user.role ? [user.role] : ['USER']),
    subscription_tier: user.subscription_tier || 'free',
    username: user.username,
  };

  if (!existingSession) {
    const newSession: MultiAccountSessionPayload = {
      accounts: [accountEntry],
      activeId: user.id,
      exp: now + SESSION_TTL_MS,
      iat: now,
    };
    (req as any)._cachedMultiAccountSession = newSession;
    setMultiAccountCookie(res, newSession);
    return newSession;
  }

  const accounts = [...existingSession.accounts];
  const existingIndex = accounts.findIndex((a) => a.id === user.id);

  if (existingIndex >= 0) {
    accounts[existingIndex] = {
      ...accounts[existingIndex],
      ...accountEntry,
      last_accessed: now,
    };
  } else {
    if (accounts.length >= MAX_CONCURRENT_ACCOUNTS) {
      accounts.sort((a, b) => (a.last_accessed || 0) - (b.last_accessed || 0));
      accounts.shift();
    }
    accounts.push(accountEntry);
  }

  const updatedSession: MultiAccountSessionPayload = {
    ...existingSession,
    accounts,
    activeId: user.id,
    exp: now + SESSION_TTL_MS,
  };

  (req as any)._cachedMultiAccountSession = updatedSession;
  setMultiAccountCookie(res, updatedSession);
  return updatedSession;
}

export async function switchAccountInSession(
  res: Response,
  req: Request,
  targetUserId: number
): Promise<{ accounts: SessionAccount[]; activeUser: SessionAccount | null; success: boolean }> {
  const session = getMultiAccountSession(req);
  if (!session) {
    return { accounts: [], activeUser: null, success: false };
  }

  const target = session.accounts.find((a) => a.id === targetUserId);
  if (!target) {
    return { accounts: session.accounts, activeUser: null, success: false };
  }

  target.last_accessed = Date.now();
  session.activeId = targetUserId;
  (req as any)._cachedMultiAccountSession = session;
  setMultiAccountCookie(res, session);

  return { accounts: session.accounts, activeUser: target, success: true };
}

export async function removeAccountFromSession(
  res: Response,
  req: Request,
  userId?: number
): Promise<{ accounts: SessionAccount[]; activeUser: SessionAccount | null; remainingCount: number }> {
  const session = getMultiAccountSession(req);
  if (!session) {
    clearSessionCookie(res);
    return { accounts: [], activeUser: null, remainingCount: 0 };
  }

  const idToRemove = userId ?? session.activeId;
  session.accounts = session.accounts.filter((a) => a.id !== idToRemove);

  if (session.accounts.length === 0) {
    clearSessionCookie(res);
    (req as any)._cachedMultiAccountSession = null;
    return { accounts: [], activeUser: null, remainingCount: 0 };
  }

  if (session.activeId === idToRemove) {
    session.accounts.sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0));
    session.activeId = session.accounts[0].id;
  }

  (req as any)._cachedMultiAccountSession = session;
  setMultiAccountCookie(res, session);
  const activeUser = session.accounts.find((a) => a.id === session.activeId) || session.accounts[0];
  return { accounts: session.accounts, activeUser, remainingCount: session.accounts.length };
}
