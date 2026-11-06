import { getDbPool } from '../config/database.config.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { createProjectFolder, deleteProjectFolder, getProjectFolderById, listProjectFolders, moveDocToFolder, moveUploadToFolder, renameProjectFolder } from '../services/project-folders.service.js';
import { listCollaborativeDocuments } from '../tools/collaborative-pdf/collaborative-pdf.service.js';
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

export async function listProjectFoldersHandler(req: Request, res: Response): Promise<void> {
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

export async function getProjectFolderHandler(req: Request, res: Response): Promise<void> {
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

      if (fs.existsSync(UPLOADS_DIR)) {
        try {
          const metaFiles = fs.readdirSync(UPLOADS_DIR).filter((f) => f.endsWith('.meta.json'));
          for (const mf of metaFiles) {
            try {
              const parsed = JSON.parse(fs.readFileSync(path.join(UPLOADS_DIR, mf), 'utf-8'));
              if ((!user?.id || parsed.userId === user.id) && (!parsed.folderId || parsed.folderId === folder.id)) {
                files.push(parsed);
              }
            } catch {}
          }
        } catch {}
      }
      files.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (folder.folder_type === 'upload_folder') {
      if (fs.existsSync(UPLOADS_DIR)) {
        try {
          const metaFiles = fs.readdirSync(UPLOADS_DIR).filter((f) => f.endsWith('.meta.json'));
          for (const mf of metaFiles) {
            try {
              const parsed = JSON.parse(fs.readFileSync(path.join(UPLOADS_DIR, mf), 'utf-8'));
              if ((!user?.id || parsed.userId === user.id) && parsed.folderId === folder.id) {
                files.push(parsed);
              }
            } catch {}
          }
        } catch {}
      }
      files.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
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

export async function createProjectFolderHandler(req: Request, res: Response): Promise<void> {
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

export async function renameProjectFolderHandler(req: Request, res: Response): Promise<void> {
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

export async function deleteProjectFolderHandler(req: Request, res: Response): Promise<void> {
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

export async function moveDocFolderHandler(req: Request, res: Response): Promise<void> {
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

export async function moveUploadFolderHandler(req: Request, res: Response): Promise<void> {
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

export async function deleteUploadAssetHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Identificador de archivo no válido.', success: false });
      return;
    }

    const user = getCurrentUser(req);
    const pool = getDbPool();

    try {
      await pool.query('DELETE FROM user_storage_assets WHERE id = ? AND (user_id <=> ? OR user_id IS NULL)', [
        id,
        user?.id ?? null,
      ]);
    } catch {}

    if (fs.existsSync(UPLOADS_DIR)) {
      try {
        const metaFiles = fs.readdirSync(UPLOADS_DIR).filter((f) => f.endsWith('.meta.json'));
        for (const mf of metaFiles) {
          try {
            const metaPath = path.join(UPLOADS_DIR, mf);
            const data = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            if (data.id === id) {
              const actualFileName = mf.replace(/\.meta\.json$/, '');
              const actualFilePath = path.join(UPLOADS_DIR, actualFileName);
              if (fs.existsSync(actualFilePath)) fs.unlinkSync(actualFilePath);
              if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
              break;
            }
          } catch {}
        }
      } catch {}
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
