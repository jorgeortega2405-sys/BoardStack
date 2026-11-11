import { resolveLabelLimit } from '../config/subscription-plans.config.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getWorkspaceTeamId } from '../middlewares/workspace.middleware.js';
import { createUserLabel, deleteUserLabel, DocumentLabelError, getUserLabels, setDocumentLabels } from '../services/document-labels.service.js';
import { logger } from '../services/logger.service.js';
import { permissionService } from '../services/permission.service.js';
import type { Request, Response } from 'express';

async function resolveUserPermissions(req: Request, userId: number, fallbackPerms?: string[]): Promise<string[]> {
  const workspacePerms = Array.isArray((req as any).workspacePermissions) ? ((req as any).workspacePermissions as string[]) : [];
  const reqUserPerms = Array.isArray((req as any).userPermissions) ? ((req as any).userPermissions as string[]) : [];
  if (reqUserPerms.length > 0) {
    return Array.from(new Set([...reqUserPerms, ...workspacePerms]));
  }
  if (Array.isArray(fallbackPerms) && fallbackPerms.length > 0) {
    return Array.from(new Set([...fallbackPerms, ...workspacePerms]));
  }
  try {
    const dbPerms = await permissionService.getUserPermissions(userId);
    return Array.from(new Set([...dbPerms, ...workspacePerms]));
  } catch {
    return workspacePerms;
  }
}

function handleControllerError(res: Response, err: unknown, logContext: string): void {
  if (err instanceof DocumentLabelError) {
    res.status(err.statusCode).json({
      code: err.code,
      error: err.message,
      success: false,
    });
    return;
  }
  logger.app.error(logContext, err);
  res.status(500).json({
    error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    success: false,
  });
}

async function listLabelsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user || !user.id) {
      res.status(401).json({ error: 'No autenticado.', success: false });
      return;
    }

    const userId = Number(user.id);
    const teamId = getWorkspaceTeamId(req);
    const [labels, permissions] = await Promise.all([
      getUserLabels(userId, teamId),
      resolveUserPermissions(req, userId, user.permissions),
    ]);
    const customCount = labels.filter((l) => !l.is_default).length;
    const maxCustomLabels = resolveLabelLimit(permissions);

    res.json({
      customCount,
      labels,
      maxCustomLabels,
      success: true,
    });
  } catch (err) {
    handleControllerError(res, err, 'Error al listar etiquetas de usuario');
  }
}

async function createLabelHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user || !user.id) {
      res.status(401).json({ error: 'No autenticado.', success: false });
      return;
    }

    const userId = Number(user.id);
    const teamId = getWorkspaceTeamId(req);
    const permissions = await resolveUserPermissions(req, userId, user.permissions);
    const { color, name } = req.body || {};

    const result = await createUserLabel(userId, permissions, { color, name }, teamId);
    res.status(201).json({
      customCount: result.customCount,
      label: result.label,
      maxCustomLabels: result.maxCustomLabels,
      success: true,
    });
  } catch (err) {
    handleControllerError(res, err, 'Error al crear etiqueta personalizada');
  }
}

async function deleteLabelHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user || !user.id) {
      res.status(401).json({ error: 'No autenticado.', success: false });
      return;
    }

    const labelId = Number(req.params.id);
    if (!Number.isInteger(labelId) || labelId <= 0) {
      res.status(400).json({ code: 'INVALID_LABEL_ID', error: 'Identificador de etiqueta no válido.', success: false });
      return;
    }

    const userId = Number(user.id);
    const teamId = getWorkspaceTeamId(req);
    const permissions = await resolveUserPermissions(req, userId, user.permissions);
    const result = await deleteUserLabel(userId, labelId, permissions, teamId);

    res.json({
      customCount: result.customCount,
      maxCustomLabels: result.maxCustomLabels,
      success: true,
    });
  } catch (err) {
    handleControllerError(res, err, 'Error al eliminar etiqueta personalizada');
  }
}

async function updateDocumentLabelsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user || !user.id) {
      res.status(401).json({ error: 'No autenticado.', success: false });
      return;
    }

    const documentId = String(req.params.id || '').trim();
    if (!documentId) {
      res.status(400).json({ code: 'INVALID_DOCUMENT_ID', error: 'Identificador de documento no válido.', success: false });
      return;
    }

    const { labelIds } = req.body || {};
    if (!Array.isArray(labelIds)) {
      res.status(400).json({ code: 'INVALID_LABEL_IDS', error: 'Formato de etiquetas no válido.', success: false });
      return;
    }

    const teamId = getWorkspaceTeamId(req);
    const workspacePerms = Array.isArray((req as any).workspacePermissions) ? ((req as any).workspacePermissions as string[]) : [];
    const canManageTeamFolders = workspacePerms.includes('team:folders:manage');
    const labels = await setDocumentLabels(Number(user.id), documentId, labelIds, teamId, canManageTeamFolders);
    res.json({
      documentId,
      labels,
      success: true,
    });
  } catch (err) {
    handleControllerError(res, err, 'Error al asignar etiquetas a documento');
  }
}

export { createLabelHandler, deleteLabelHandler, listLabelsHandler, updateDocumentLabelsHandler };
