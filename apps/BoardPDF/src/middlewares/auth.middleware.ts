import { getMultiAccountSession } from '../services/auth.service.js';
import { SessionAccount, UserPayload } from '../types/auth.types.js';
import type { NextFunction, Request, Response } from 'express';

export function getCurrentUser(req: Request): UserPayload | null {
  if ((req as any).user) {
    return (req as any).user;
  }
  const session = getMultiAccountSession(req);
  if (!session) return null;

  const active = session.accounts.find((a) => a.id === session.activeId) || session.accounts[0] || null;
  if (active) {
    (req as any).user = active;
  }
  return active;
}

export function getLinkedAccounts(req: Request): SessionAccount[] {
  const session = getMultiAccountSession(req);
  return session ? session.accounts : [];
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    return;
  }
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  getCurrentUser(req);
  next();
}

export function requirePermission(_permission: string) {
  return async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next();
  };
}
