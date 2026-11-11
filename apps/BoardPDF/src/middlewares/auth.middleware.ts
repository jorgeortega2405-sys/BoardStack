import { getMultiAccountSession } from '../services/auth.service.js';
import { permissionService } from '../services/permission.service.js';
import { SessionAccount, UserPayload } from '../types/auth.types.js';
import { hydrateWorkspaceForRequest } from './workspace.middleware.js';
import type { NextFunction, Request, Response } from 'express';

function getCurrentUser(req: Request): UserPayload | null {
  if ((req as any).user) {
    return (req as any).user;
  }
  const session = getMultiAccountSession(req);
  if (!session) return null;

  const rawActive = session.accounts.find((a) => a.id === session.activeId) || session.accounts[0] || null;
  if (!rawActive) return null;

  const active: UserPayload = {
    ...rawActive,
    permissions: Array.isArray(rawActive.permissions) ? [...rawActive.permissions] : [],
  };
  (req as any).user = active;
  return active;
}

function getLinkedAccounts(req: Request): SessionAccount[] {
  const session = getMultiAccountSession(req);
  return session ? session.accounts : [];
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    return;
  }
  if (!user.permissions || !Array.isArray(user.permissions) || user.permissions.length === 0) {
    try {
      user.permissions = await permissionService.getUserPermissions(
        user.id,
        user.subscription_tier,
        user.subscription_status
      );
    } catch {}
  }

  const wsResult = await hydrateWorkspaceForRequest(req, user.id);
  (req as any)._workspaceHydrated = true;
  if (wsResult.error) {
    res.status(wsResult.statusCode || 403).json({ error: wsResult.error, success: false });
    return;
  }
  if (req.workspaceTeam && Array.isArray(req.workspacePermissions)) {
    user.permissions = req.workspacePermissions;
    (req as any).userPermissions = req.workspacePermissions;
  }
  next();
}

async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const user = getCurrentUser(req);
  if (user) {
    if (!user.permissions || !Array.isArray(user.permissions) || user.permissions.length === 0) {
      try {
        user.permissions = await permissionService.getUserPermissions(
          user.id,
          user.subscription_tier,
          user.subscription_status
        );
      } catch {}
    }
    const wsResult = await hydrateWorkspaceForRequest(req, user.id);
    (req as any)._workspaceHydrated = true;
    if (!wsResult.error && req.workspaceTeam && Array.isArray(req.workspacePermissions)) {
      user.permissions = req.workspacePermissions;
      (req as any).userPermissions = req.workspacePermissions;
    }
  }
  next();
}

function hasPermission(userOrPermissions: any, permission: string): boolean {
  if (!userOrPermissions) return false;
  if (Array.isArray(userOrPermissions)) {
    return userOrPermissions.includes(permission);
  }
  if (Array.isArray(userOrPermissions.permissions)) {
    return userOrPermissions.permissions.includes(permission);
  }
  return false;
}

function hasSubscriptionFeature(userOrPermissions: any, feature: string): boolean {
  const normalized = feature.startsWith('subscription:feature:') ? feature : `subscription:feature:${feature}`;
  return hasPermission(userOrPermissions, normalized);
}

function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }
    if (!(req as any)._workspaceHydrated) {
      const wsResult = await hydrateWorkspaceForRequest(req, user.id);
      (req as any)._workspaceHydrated = true;
      if (wsResult.error) {
        res.status(wsResult.statusCode || 403).json({ error: wsResult.error, success: false });
        return;
      }
      if (req.workspaceTeam && Array.isArray(req.workspacePermissions)) {
        user.permissions = req.workspacePermissions;
        (req as any).userPermissions = req.workspacePermissions;
      }
    }
    let permissions: string[] = (user as any).permissions || [];
    if (!permissions || permissions.length === 0) {
      permissions = await permissionService.getUserPermissions(
        user.id,
        user.subscription_tier,
        user.subscription_status
      );
      (user as any).permissions = permissions;
    }
    if (!permissions.includes(permission)) {
      res.status(403).json({ error: 'Acceso denegado: permisos insuficientes para esta operación.' });
      return;
    }
    next();
  };
}

function requireFeature(feature: string) {
  const normalized = feature.startsWith('subscription:feature:') ? feature : `subscription:feature:${feature}`;
  return requirePermission(normalized);
}

export { getCurrentUser, getLinkedAccounts, hasPermission, hasSubscriptionFeature, optionalAuth, requireAuth, requireFeature, requirePermission };
