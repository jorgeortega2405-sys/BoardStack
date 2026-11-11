import { getDbPool } from '../config/database.config.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { createProjectFolder, deleteProjectFolder, getProjectFolderById, listProjectFolders, moveDocToFolder, moveUploadToFolder, renameProjectFolder } from '../services/project-folders.service.js';
import { reclaimUserAsset } from '../services/storage-quota.service.js';
import { listCollaborativeDocuments } from '../tools/design-pdf/design-pdf.service.js';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'collaborative');

const KNOWN_SAFE_MESSAGES = new Set([
  'Carpeta de destino no válida para archivos subidos.',
  'Carpeta de destino no válida para documentos PDF.',
  'Carpeta no encontrada.',
  'Debes proporcionar un nombre para la carpeta.',
  'Debes proporcionar un nombre válido.',
  'El nombre de la carpeta no puede estar vacío.',
  'Has alcanzado el límite máximo de carpetas permitido para tu plan actual.',
  'Identificador de archivo no válido.',
  'Identificador de carpeta no válido.',
  'Identificador de documento no válido.',
  'La carpeta no existe o no se pudo eliminar.',
  'La carpeta solicitada no existe.',
  'No se puede cambiar el nombre de la carpeta de subidos del sistema.',
  'No se puede eliminar la carpeta de subidos del sistema.',
  'No se pueden crear subcarpetas dentro de una carpeta de proyectos.',
  'Solo se permite un nivel de carpetas dentro de la carpeta de subidos.',
]);

function getSafeErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && KNOWN_SAFE_MESSAGES.has(err.message)) {
    return err.message;
  }
  return fallback;
}

async function listProjectFoldersHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const parentIdParam = req.query.parentId as string | undefined;
    const parentId = parentIdParam === 'null' || parentIdParam === 'root' ? null : parentIdParam;
    const folderType = req.query.folderType as 'project' | 'upload_folder' | undefined;

    const { folders, uploadsFolder } = await listProjectFolders(user?.id ?? null, parentId, folderType);

    res.json({
      folders,
      success: true,
      uploadsFolder,
    });
  } catch (err) {
    logger.app.error('Error al listar carpetas de proyectos', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

async function getProjectFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Identificador de carpeta no válido.', success: false });
      return;
    }

    const user = getCurrentUser(req);
    const folder = await getProjectFolderById(id, user?.id ?? null);
    if (!folder) {
      res.status(404).json({ error: 'La carpeta solicitada no existe.', success: false });
      return;
    }

    let documents: any[] = [];
    let files: any[] = [];
    let subfolders: any[] = [];

    if (folder.folder_type === 'project') {
      documents = await listCollaborativeDocuments(user?.id ?? null, folder.id);
    } else if (folder.folder_type === 'uploads') {
      const sub = await listProjectFolders(user?.id ?? null, folder.id, 'upload_folder');
      subfolders = sub.folders;

      if (user?.id) {
        const pool = getDbPool();
        const [assetRows] = await pool.query<any[]>(
          'SELECT id, file_name, s3_key, mime_type, byte_size, asset_type, folder_id, created_at FROM user_storage_assets WHERE user_id = ? AND asset_type IN ("upload_image", "upload_pdf") AND (folder_id IS NULL OR folder_id = ?) ORDER BY created_at DESC',
          [user.id, folder.id]
        );
        files = (Array.isArray(assetRows) ? assetRows : []).map((r) => ({
          createdAt: new Date(r.created_at).toISOString(),
          folderId: r.folder_id || null,
          id: r.id,
          mimeType: r.mime_type,
          name: r.file_name,
          pageCount: 1,
          size: Number(r.byte_size) || 0,
          type: r.asset_type === 'upload_pdf' ? 'pdf' : 'image',
          url: `/uploads/collaborative/${path.basename(r.s3_key || r.file_name)}`,
          userId: user.id,
        }));
      }
    } else if (folder.folder_type === 'upload_folder') {
      if (user?.id) {
        const pool = getDbPool();
        const [assetRows] = await pool.query<any[]>(
          'SELECT id, file_name, s3_key, mime_type, byte_size, asset_type, folder_id, created_at FROM user_storage_assets WHERE user_id = ? AND asset_type IN ("upload_image", "upload_pdf") AND folder_id = ? ORDER BY created_at DESC',
          [user.id, folder.id]
        );
        files = (Array.isArray(assetRows) ? assetRows : []).map((r) => ({
          createdAt: new Date(r.created_at).toISOString(),
          folderId: r.folder_id || null,
          id: r.id,
          mimeType: r.mime_type,
          name: r.file_name,
          pageCount: 1,
          size: Number(r.byte_size) || 0,
          type: r.asset_type === 'upload_pdf' ? 'pdf' : 'image',
          url: `/uploads/collaborative/${path.basename(r.s3_key || r.file_name)}`,
          userId: user.id,
        }));
      }
    }

    res.json({
      documents,
      files,
      folder,
      subfolders,
      success: true,
    });
  } catch (err) {
    logger.app.error('Error al obtener detalle de carpeta de proyectos', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

async function createProjectFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const { color, folderType, name, parentId } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Debes proporcionar un nombre para la carpeta.', success: false });
      return;
    }

    const folder = await createProjectFolder({
      color: typeof color === 'string' ? color : null,
      folderType: folderType === 'upload_folder' ? 'upload_folder' : 'project',
      name: name.trim(),
      parentId: parentId || null,
      userId: user?.id ?? null,
      userPermissions: user?.permissions || [],
    });

    res.json({ folder, success: true });
  } catch (err: any) {
    logger.app.error('Error al crear carpeta de proyectos', err);
    res.status(400).json({
      error: getSafeErrorMessage(err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.'),
      success: false,
    });
  }
}

async function renameProjectFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!id || !name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Debes proporcionar un nombre válido.', success: false });
      return;
    }

    const user = getCurrentUser(req);
    const folder = await renameProjectFolder(id, name.trim(), user?.id ?? null);
    res.json({ folder, success: true });
  } catch (err: any) {
    logger.app.error('Error al renombrar carpeta de proyectos', err);
    res.status(400).json({
      error: getSafeErrorMessage(err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.'),
      success: false,
    });
  }
}

async function deleteProjectFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Identificador de carpeta no válido.', success: false });
      return;
    }

    const user = getCurrentUser(req);
    const deleted = await deleteProjectFolder(id, user?.id ?? null);
    if (!deleted) {
      res.status(404).json({ error: 'La carpeta no existe o no se pudo eliminar.', success: false });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.app.error('Error al eliminar carpeta de proyectos', err);
    res.status(400).json({
      error: getSafeErrorMessage(err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.'),
      success: false,
    });
  }
}

async function moveDocFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { folderId } = req.body;
    if (!id) {
      res.status(400).json({ error: 'Identificador de documento no válido.', success: false });
      return;
    }

    const user = getCurrentUser(req);
    const moved = await moveDocToFolder(id, folderId || null, user?.id ?? null);
    res.json({ moved, success: true });
  } catch (err: any) {
    logger.app.error('Error al mover documento a carpeta', err);
    res.status(400).json({
      error: getSafeErrorMessage(err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.'),
      success: false,
    });
  }
}

async function moveUploadFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { folderId } = req.body;
    if (!id) {
      res.status(400).json({ error: 'Identificador de archivo no válido.', success: false });
      return;
    }

    const user = getCurrentUser(req);
    const moved = await moveUploadToFolder(id, folderId || null, user?.id ?? null);
    res.json({ moved, success: true });
  } catch (err: any) {
    logger.app.error('Error al mover archivo a carpeta', err);
    res.status(400).json({
      error: getSafeErrorMessage(err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.'),
      success: false,
    });
  }
}

async function deleteUploadAssetHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Identificador de archivo no válido.', success: false });
      return;
    }

    const user = getCurrentUser(req);
    if (user?.id) {
      await reclaimUserAsset(id, Number(user.id));
    }

    res.json({ success: true });
  } catch (err) {
    logger.app.error('Error al eliminar archivo subido', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { createProjectFolderHandler, deleteProjectFolderHandler, deleteUploadAssetHandler, getProjectFolderHandler, listProjectFoldersHandler, moveDocFolderHandler, moveUploadFolderHandler, renameProjectFolderHandler };
