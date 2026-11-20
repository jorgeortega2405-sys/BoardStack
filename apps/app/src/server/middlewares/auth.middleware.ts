import { clearSessionCookie, getMultiAccountSession } from '../services/auth.service.js';
import { findUserById } from '../services/user.service.js';
import type { NextFunction, Request, Response } from 'express';
import type { SessionAccount } from '../types/auth.types.js';

function getCurrentUser(req: Request): SessionAccount | null {
  const session = getMultiAccountSession(req);
  if (!session || !Array.isArray(session.accounts) || session.accounts.length === 0) {
    return null;
  }
  const active = session.accounts.find((a) => a.id === session.activeId);
  return active || session.accounts[0] || null;
}

function getLinkedAccounts(req: Request): SessionAccount[] {
  const session = getMultiAccountSession(req);
  if (!session || !Array.isArray(session.accounts)) {
    return [];
  }
  return session.accounts;
}

async function getValidatedCurrentUser(req: Request, res?: Response): Promise<SessionAccount | null> {
  const user = getCurrentUser(req);
  if (!user || typeof user.id !== 'number') {
    return null;
  }
  const dbUser = await findUserById(user.id);
  if (!dbUser) {
    if (res) {
      clearSessionCookie(res);
    }
    return null;
  }
  return user;
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await getValidatedCurrentUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.', ok: false });
    return;
  }
  next();
}

function requirePermission(permissionName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = await getValidatedCurrentUser(req, res);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.', ok: false });
      return;
    }
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    if (!permissions.includes(permissionName)) {
      res.status(403).json({ error: 'Access denied: insufficient permissions.', ok: false });
      return;
    }
    next();
  };
}

function requireRole(roleName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = await getValidatedCurrentUser(req, res);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.', ok: false });
      return;
    }
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const normalizedTarget = roleName.trim().toUpperCase();
    const hasMatch = roles.some((r) => {
      const norm = String(r).trim().toUpperCase();
      return norm === normalizedTarget || (normalizedTarget === 'ADMIN' && (norm === 'SUPER_ADMIN' || norm === 'PLATFORM_ADMIN'));
    });
    if (!hasMatch) {
      res.status(403).json({ error: 'Access denied: insufficient role privileges.', ok: false });
      return;
    }
    next();
  };
}

export {
  getCurrentUser,
  getLinkedAccounts,
  getValidatedCurrentUser,
  requireAuth,
  requirePermission,
  requireRole
};
