import { getTeamContextForUser } from '../services/team.service.js';
import { TeamSummary } from '../types/team.types.js';
import { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      workspacePermissions?: string[];
      workspaceTeam?: TeamSummary | null;
      workspaceTeamId?: number | null;
    }
  }
}

function extractRequestedTeamId(req: Request): number | null {
  const headerVal = req.headers['x-team-id'];
  const rawHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const queryVal = typeof req.query?.teamId === 'string' ? req.query.teamId : undefined;
  const raw = (rawHeader || queryVal || '').trim();
  if (!raw || raw.toLowerCase() === 'personal' || raw === '0') {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return -1;
  }
  return parsed;
}

async function hydrateWorkspaceForRequest(req: Request, userId: number): Promise<{ error?: string; statusCode?: number }> {
  const requestedTeamId = extractRequestedTeamId(req);
  if (requestedTeamId === null) {
    req.workspaceTeam = null;
    req.workspaceTeamId = null;
    req.workspacePermissions = [];
    return {};
  }
  if (requestedTeamId < 0) {
    return { error: 'Identificador de equipo no válido.', statusCode: 400 };
  }

  const team = await getTeamContextForUser(requestedTeamId, userId);
  if (!team || team.subscription_status !== 'active') {
    return {
      error: 'No tienes acceso a este equipo o su suscripción no se encuentra activa.',
      statusCode: 403,
    };
  }

  req.workspaceTeam = team;
  req.workspaceTeamId = team.id;
  req.workspacePermissions = team.permissions;
  return {};
}

function getWorkspaceTeam(req: Request): TeamSummary | null {
  return req.workspaceTeam || null;
}

function getWorkspaceTeamId(req: Request): number | null {
  return req.workspaceTeamId || null;
}

function requireTeamWorkspace(req: Request, res: Response, next: NextFunction): void {
  if (!req.workspaceTeam || !req.workspaceTeamId) {
    res.status(400).json({
      code: 'TEAM_CONTEXT_REQUIRED',
      error: 'Esta acción requiere seleccionar un espacio de equipo activo.',
      success: false,
    });
    return;
  }
  next();
}

function requireTeamPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.workspaceTeam || !req.workspaceTeamId) {
      res.status(400).json({
        code: 'TEAM_CONTEXT_REQUIRED',
        error: 'Esta acción requiere seleccionar un espacio de equipo activo.',
        success: false,
      });
      return;
    }
    const perms = Array.isArray(req.workspacePermissions) ? req.workspacePermissions : [];
    if (!perms.includes(permission)) {
      res.status(403).json({
        code: 'TEAM_FORBIDDEN',
        error: 'No cuentas con permisos suficientes en este equipo.',
        success: false,
      });
      return;
    }
    next();
  };
}

export { extractRequestedTeamId, getWorkspaceTeam, getWorkspaceTeamId, hydrateWorkspaceForRequest, requireTeamPermission, requireTeamWorkspace };
