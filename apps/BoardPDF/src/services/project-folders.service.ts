import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDbPool } from '../config/database.config.js';
import { FOLDER_LIMITS } from '../config/subscription-plans.config.js';
import { logger } from './logger.service.js';

interface ProjectFolderRecord {
  color?: string | null;
  created_at: string;
  document_count?: number;
  file_count?: number;
  folder_type: 'project' | 'uploads' | 'upload_folder';
  id: string;
  name: string;
  parent_id?: string | null;
  updated_at: string;
  user_id?: number | null;
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'collaborative');

async function ensureUploadsFolder(userId: number | null): Promise<ProjectFolderRecord> {
  const pool = getDbPool();
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT id, user_id, parent_id, name, folder_type, color, created_at, updated_at FROM project_folders WHERE user_id <=> ? AND folder_type = ? LIMIT 1',
      [userId, 'uploads']
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0] as ProjectFolderRecord;
    }

    const newId = crypto.randomUUID();
    await pool.query(
      'INSERT INTO project_folders (id, user_id, parent_id, name, folder_type, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, NOW(), NOW())',
      [newId, userId, 'Subidos', 'uploads']
    );

    return {
      color: null,
      created_at: new Date().toISOString(),
      folder_type: 'uploads',
      id: newId,
      name: 'Subidos',
      parent_id: null,
      updated_at: new Date().toISOString(),
      user_id: userId,
    };
  } catch (err) {
    logger.db.error('Error al asegurar carpeta de subidos en MySQL', err);
    return {
      color: null,
      created_at: new Date().toISOString(),
      folder_type: 'uploads',
      id: 'default-uploads-uuid',
      name: 'Subidos',
      parent_id: null,
      updated_at: new Date().toISOString(),
      user_id: userId,
    };
  }
}

async function listProjectFolders(userId: number | null, parentId?: string | null, folderType?: 'project' | 'upload_folder'): Promise<{ folders: ProjectFolderRecord[]; uploadsFolder: ProjectFolderRecord }> {
  const uploadsFolder = await ensureUploadsFolder(userId);
  const pool = getDbPool();

  try {
    let query = 'SELECT id, user_id, parent_id, name, folder_type, color, created_at, updated_at FROM project_folders WHERE user_id <=> ?';
    const params: any[] = [userId];

    if (parentId !== undefined) {
      query += ' AND parent_id <=> ?';
      params.push(parentId);
    }

    if (folderType) {
      query += ' AND folder_type = ?';
      params.push(folderType);
    }

    query += ' ORDER BY created_at ASC';

    const [rows] = await pool.query<any[]>(query, params);
    const folderList = (Array.isArray(rows) ? rows : []) as ProjectFolderRecord[];

    const [docCounts] = await pool.query<any[]>(
      'SELECT folder_id, COUNT(*) AS count FROM collaborative_documents WHERE user_id <=> ? AND folder_id IS NOT NULL GROUP BY folder_id',
      [userId]
    );
    const docCountMap = new Map<string, number>();
    if (Array.isArray(docCounts)) {
      docCounts.forEach((r) => docCountMap.set(r.folder_id, Number(r.count) || 0));
    }

    const [fileCounts] = await pool.query<any[]>(
      'SELECT folder_id, COUNT(*) AS count FROM user_storage_assets WHERE user_id <=> ? AND folder_id IS NOT NULL GROUP BY folder_id',
      [userId]
    );
    const fileCountMap = new Map<string, number>();
    if (Array.isArray(fileCounts)) {
      fileCounts.forEach((r) => fileCountMap.set(r.folder_id, Number(r.count) || 0));
    }

    let rootUploadsCount = 0;
    try {
      const [rootCountRows] = await pool.query<any[]>(
        'SELECT COUNT(*) AS count FROM user_storage_assets WHERE user_id <=> ? AND (folder_id IS NULL OR folder_id = ?)',
        [userId, uploadsFolder.id]
      );
      if (Array.isArray(rootCountRows) && rootCountRows[0]) {
        rootUploadsCount = Number(rootCountRows[0].count) || 0;
      }
    } catch {
      rootUploadsCount = 0;
    }

    if (fs.existsSync(UPLOADS_DIR)) {
      try {
        const metaFiles = fs.readdirSync(UPLOADS_DIR).filter((f) => f.endsWith('.meta.json'));
        let diskUploadsCount = 0;
        for (const mf of metaFiles) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(UPLOADS_DIR, mf), 'utf-8'));
            if (!userId || data.userId === userId) {
              diskUploadsCount++;
            }
          } catch {}
        }
        rootUploadsCount = Math.max(rootUploadsCount, diskUploadsCount);
      } catch {}
    }

    uploadsFolder.file_count = rootUploadsCount;

    const enrichedFolders = folderList
      .filter((f) => f.folder_type !== 'uploads')
      .map((f) => ({
        ...f,
        document_count: docCountMap.get(f.id) || 0,
        file_count: fileCountMap.get(f.id) || 0,
      }));

    return {
      folders: enrichedFolders,
      uploadsFolder,
    };
  } catch (err) {
    logger.db.error('Error al listar carpetas de proyectos en MySQL', err);
    return {
      folders: [],
      uploadsFolder,
    };
  }
}

async function getProjectFolderById(id: string, userId: number | null): Promise<ProjectFolderRecord | null> {
  const pool = getDbPool();
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT id, user_id, parent_id, name, folder_type, color, created_at, updated_at FROM project_folders WHERE id = ? AND (user_id <=> ? OR user_id IS NULL) LIMIT 1',
      [id, userId]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    return rows[0] as ProjectFolderRecord;
  } catch (err) {
    logger.db.error('Error al obtener carpeta de proyectos por id', err);
    return null;
  }
}

async function createProjectFolder(payload: {
  color?: string | null;
  folderType?: 'project' | 'upload_folder';
  name: string;
  parentId?: string | null;
  userId: number | null;
  userPermissions?: string[];
}): Promise<ProjectFolderRecord> {
  const cleanName = (payload.name || '').trim();
  if (!cleanName) {
    throw new Error('El nombre de la carpeta no puede estar vacío.');
  }

  const pool = getDbPool();

  if (payload.userId) {
    const [countRows] = await pool.query<any[]>(
      'SELECT COUNT(*) AS total FROM project_folders WHERE user_id <=> ? AND folder_type != "uploads"',
      [payload.userId]
    );
    const currentCount = Number(countRows?.[0]?.total || 0);
    const perms = payload.userPermissions || [];
    const maxFolders = perms.includes('subscription:feature:business')
      ? FOLDER_LIMITS.business
      : perms.includes('subscription:feature:pro')
      ? FOLDER_LIMITS.pro
      : FOLDER_LIMITS.free;

    if (currentCount >= maxFolders) {
      throw new Error('Has alcanzado el límite máximo de carpetas permitido para tu plan actual.');
    }
  }

  const folderId = crypto.randomUUID();
  const folderType = payload.folderType || (payload.parentId ? 'upload_folder' : 'project');

  if (folderType === 'project' && payload.parentId) {
    throw new Error('No se pueden crear subcarpetas dentro de una carpeta de proyectos.');
  }

  if (folderType === 'upload_folder') {
    if (!payload.parentId) {
      const uploadsFolder = await ensureUploadsFolder(payload.userId);
      payload.parentId = uploadsFolder.id;
    } else {
      const parent = await getProjectFolderById(payload.parentId, payload.userId);
      if (!parent || parent.folder_type !== 'uploads') {
        throw new Error('Solo se permite un nivel de carpetas dentro de la carpeta de subidos.');
      }
    }
  }

  await pool.query(
    'INSERT INTO project_folders (id, user_id, parent_id, name, folder_type, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [folderId, payload.userId, payload.parentId || null, cleanName, folderType, payload.color || null]
  );

  return {
    color: payload.color || null,
    created_at: new Date().toISOString(),
    document_count: 0,
    file_count: 0,
    folder_type: folderType,
    id: folderId,
    name: cleanName,
    parent_id: payload.parentId || null,
    updated_at: new Date().toISOString(),
    user_id: payload.userId,
  };
}

async function renameProjectFolder(id: string, newName: string, userId: number | null): Promise<ProjectFolderRecord> {
  const cleanName = (newName || '').trim();
  if (!cleanName) {
    throw new Error('El nombre de la carpeta no puede estar vacío.');
  }

  const folder = await getProjectFolderById(id, userId);
  if (!folder) {
    throw new Error('Carpeta no encontrada.');
  }

  if (folder.folder_type === 'uploads') {
    throw new Error('No se puede cambiar el nombre de la carpeta de subidos del sistema.');
  }

  const pool = getDbPool();
  await pool.query('UPDATE project_folders SET name = ?, updated_at = NOW() WHERE id = ? AND (user_id <=> ? OR user_id IS NULL)', [
    cleanName,
    id,
    userId,
  ]);

  folder.name = cleanName;
  folder.updated_at = new Date().toISOString();
  return folder;
}

async function deleteProjectFolder(id: string, userId: number | null): Promise<boolean> {
  const folder = await getProjectFolderById(id, userId);
  if (!folder) {
    return false;
  }

  if (folder.folder_type === 'uploads') {
    throw new Error('No se puede eliminar la carpeta de subidos del sistema.');
  }

  const pool = getDbPool();
  await pool.query('UPDATE collaborative_documents SET folder_id = NULL WHERE folder_id = ?', [id]);
  await pool.query('UPDATE user_storage_assets SET folder_id = NULL WHERE folder_id = ?', [id]);

  if (fs.existsSync(UPLOADS_DIR)) {
    try {
      const metaFiles = fs.readdirSync(UPLOADS_DIR).filter((f) => f.endsWith('.meta.json'));
      for (const mf of metaFiles) {
        try {
          const filePath = path.join(UPLOADS_DIR, mf);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (data.folderId === id) {
            data.folderId = null;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
          }
        } catch {}
      }
    } catch {}
  }

  await pool.query('DELETE FROM project_folders WHERE id = ? AND (user_id <=> ? OR user_id IS NULL)', [id, userId]);
  return true;
}

async function moveDocToFolder(docId: string, folderId: string | null, userId?: number | null): Promise<boolean> {
  const pool = getDbPool();
  if (folderId) {
    const targetFolder = await getProjectFolderById(folderId, userId ?? null);
    if (!targetFolder || targetFolder.folder_type !== 'project') {
      throw new Error('Carpeta de destino no válida para documentos PDF.');
    }
  }

  const [res] = await pool.query<any>(
    'UPDATE collaborative_documents SET folder_id = ?, updated_at = NOW() WHERE id = ? AND (user_id <=> ? OR user_id IS NULL)',
    [folderId || null, docId, userId ?? null]
  );
  return res && res.affectedRows > 0;
}

async function moveUploadToFolder(uploadId: string, folderId: string | null, userId?: number | null): Promise<boolean> {
  const pool = getDbPool();
  if (folderId) {
    const targetFolder = await getProjectFolderById(folderId, userId ?? null);
    if (!targetFolder || (targetFolder.folder_type !== 'uploads' && targetFolder.folder_type !== 'upload_folder')) {
      throw new Error('Carpeta de destino no válida para archivos subidos.');
    }
  }

  await pool.query(
    'UPDATE user_storage_assets SET folder_id = ?, updated_at = NOW() WHERE id = ? AND (user_id <=> ? OR user_id IS NULL)',
    [folderId || null, uploadId, userId ?? null]
  );

  if (fs.existsSync(UPLOADS_DIR)) {
    try {
      const metaFiles = fs.readdirSync(UPLOADS_DIR).filter((f) => f.endsWith('.meta.json'));
      for (const mf of metaFiles) {
        try {
          const filePath = path.join(UPLOADS_DIR, mf);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (data.id === uploadId) {
            data.folderId = folderId || null;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            break;
          }
        } catch {}
      }
    } catch {}
  }

  return true;
}

export { createProjectFolder, deleteProjectFolder, ensureUploadsFolder, getProjectFolderById, listProjectFolders, moveDocToFolder, moveUploadToFolder, renameProjectFolder };
export type { ProjectFolderRecord };
