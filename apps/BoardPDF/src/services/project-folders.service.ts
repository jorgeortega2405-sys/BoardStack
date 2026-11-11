import { getDbPool } from '../config/database.config.js';
import { FOLDER_LIMITS } from '../config/subscription-plans.config.js';
import { logger } from './logger.service.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface ProjectFolderMemberRecord {
  avatar_url: string | null;
  email: string;
  role: 'editor' | 'viewer';
  user_id: number;
  username: string;
}

interface ProjectFolderRecord {
  color?: string | null;
  created_at: string;
  document_count?: number;
  file_count?: number;
  folder_type: 'project' | 'uploads' | 'upload_folder';
  id: string;
  name: string;
  parent_id?: string | null;
  team_id?: number | null;
  updated_at: string;
  user_id?: number | null;
  user_role?: 'editor' | 'viewer';
  visibility?: 'restricted' | 'team';
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'collaborative');

async function isActiveTeamMember(teamId: number, userId: number | null): Promise<boolean> {
  if (!teamId || !userId) return false;
  const pool = getDbPool();
  const [rows] = await pool.query<any[]>(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1',
    [teamId, userId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

function resolveEffectiveFolderRole(
  folder: { folder_type: string; team_id?: number | null; user_id?: number | null; visibility?: string },
  userId: number | null,
  explicitRole: 'editor' | 'viewer' | null,
  teamPermissions: string[] = []
): 'editor' | 'viewer' | null {
  if (!folder.team_id) {
    return folder.user_id === userId || folder.user_id === null ? 'editor' : null;
  }
  if (!userId) return null;
  if (folder.folder_type === 'uploads') return 'editor';
  if (teamPermissions.includes('team:folders:manage')) return 'editor';
  if (folder.user_id !== null && Number(folder.user_id) === Number(userId)) return 'editor';
  if (folder.visibility !== 'restricted') return 'editor';
  return explicitRole || null;
}

async function ensureUploadsFolder(userId: number | null, teamId?: number | null): Promise<ProjectFolderRecord> {
  const pool = getDbPool();
  const effectiveTeamId = teamId || null;
  try {
    const [rows] = effectiveTeamId
      ? await pool.query<any[]>(
          'SELECT id, user_id, team_id, parent_id, name, folder_type, color, visibility, created_at, updated_at FROM project_folders WHERE team_id = ? AND folder_type = ? LIMIT 1',
          [effectiveTeamId, 'uploads']
        )
      : await pool.query<any[]>(
          'SELECT id, user_id, team_id, parent_id, name, folder_type, color, visibility, created_at, updated_at FROM project_folders WHERE user_id <=> ? AND team_id IS NULL AND folder_type = ? LIMIT 1',
          [userId, 'uploads']
        );

    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0] as ProjectFolderRecord;
    }

    const newId = crypto.randomUUID();
    await pool.query(
      'INSERT INTO project_folders (id, user_id, team_id, parent_id, name, folder_type, visibility, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?, NOW(), NOW())',
      [newId, userId, effectiveTeamId, 'Subidos', 'uploads', 'team']
    );

    return {
      color: null,
      created_at: new Date().toISOString(),
      folder_type: 'uploads',
      id: newId,
      name: 'Subidos',
      parent_id: null,
      team_id: effectiveTeamId,
      updated_at: new Date().toISOString(),
      user_id: userId,
      user_role: 'editor',
      visibility: 'team',
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
      team_id: effectiveTeamId,
      updated_at: new Date().toISOString(),
      user_id: userId,
      user_role: 'editor',
      visibility: 'team',
    };
  }
}

async function listProjectFolders(
  userId: number | null,
  parentId?: string | null,
  folderType?: 'project' | 'upload_folder',
  teamId?: number | null,
  teamPermissions: string[] = []
): Promise<{ folders: ProjectFolderRecord[]; uploadsFolder: ProjectFolderRecord }> {
  const effectiveTeamId = teamId || null;
  const uploadsFolder = await ensureUploadsFolder(userId, effectiveTeamId);
  const pool = getDbPool();

  try {
    let query = effectiveTeamId
      ? `SELECT pf.id, pf.user_id, pf.team_id, pf.parent_id, pf.name, pf.folder_type, pf.color, pf.visibility, pf.created_at, pf.updated_at, pfm.role AS explicit_role
         FROM project_folders pf
         LEFT JOIN project_folder_members pfm ON pfm.folder_id = pf.id AND pfm.user_id = ?
         WHERE pf.team_id = ?`
      : `SELECT id, user_id, team_id, parent_id, name, folder_type, color, visibility, created_at, updated_at
         FROM project_folders
         WHERE user_id <=> ? AND team_id IS NULL`;

    const params: any[] = effectiveTeamId ? [userId || 0, effectiveTeamId] : [userId];

    if (parentId !== undefined) {
      query += effectiveTeamId ? ' AND pf.parent_id <=> ?' : ' AND parent_id <=> ?';
      params.push(parentId);
    }

    if (folderType) {
      query += effectiveTeamId ? ' AND pf.folder_type = ?' : ' AND folder_type = ?';
      params.push(folderType);
    }

    query += effectiveTeamId ? ' ORDER BY pf.created_at ASC' : ' ORDER BY created_at ASC';

    const [rows] = await pool.query<any[]>(query, params);
    const rawFolders = (Array.isArray(rows) ? rows : []) as Array<ProjectFolderRecord & { explicit_role?: 'editor' | 'viewer' | null }>;
    const folderList: ProjectFolderRecord[] = [];
    for (const f of rawFolders) {
      const role = resolveEffectiveFolderRole(f, userId, f.explicit_role || null, teamPermissions);
      if (role) {
        folderList.push({
          color: f.color,
          created_at: f.created_at,
          folder_type: f.folder_type,
          id: f.id,
          name: f.name,
          parent_id: f.parent_id,
          team_id: f.team_id || null,
          updated_at: f.updated_at,
          user_id: f.user_id,
          user_role: role,
          visibility: (f.visibility as 'restricted' | 'team') || 'team',
        });
      }
    }

    const [docCounts] = effectiveTeamId
      ? await pool.query<any[]>(
          'SELECT folder_id, COUNT(*) AS count FROM collaborative_documents WHERE team_id = ? AND folder_id IS NOT NULL GROUP BY folder_id',
          [effectiveTeamId]
        )
      : await pool.query<any[]>(
          'SELECT folder_id, COUNT(*) AS count FROM collaborative_documents WHERE user_id <=> ? AND team_id IS NULL AND folder_id IS NOT NULL GROUP BY folder_id',
          [userId]
        );
    const docCountMap = new Map<string, number>();
    if (Array.isArray(docCounts)) {
      docCounts.forEach((r) => docCountMap.set(r.folder_id, Number(r.count) || 0));
    }

    const [fileCounts] = effectiveTeamId
      ? await pool.query<any[]>(
          'SELECT folder_id, COUNT(*) AS count FROM user_storage_assets WHERE team_id = ? AND folder_id IS NOT NULL GROUP BY folder_id',
          [effectiveTeamId]
        )
      : await pool.query<any[]>(
          'SELECT folder_id, COUNT(*) AS count FROM user_storage_assets WHERE user_id <=> ? AND team_id IS NULL AND folder_id IS NOT NULL GROUP BY folder_id',
          [userId]
        );
    const fileCountMap = new Map<string, number>();
    if (Array.isArray(fileCounts)) {
      fileCounts.forEach((r) => fileCountMap.set(r.folder_id, Number(r.count) || 0));
    }

    let rootUploadsCount = 0;
    try {
      const [rootCountRows] = effectiveTeamId
        ? await pool.query<any[]>(
            'SELECT COUNT(*) AS count FROM user_storage_assets WHERE team_id = ? AND (folder_id IS NULL OR folder_id = ?)',
            [effectiveTeamId, uploadsFolder.id]
          )
        : await pool.query<any[]>(
            'SELECT COUNT(*) AS count FROM user_storage_assets WHERE user_id <=> ? AND team_id IS NULL AND (folder_id IS NULL OR folder_id = ?)',
            [userId, uploadsFolder.id]
          );
      if (Array.isArray(rootCountRows) && rootCountRows[0]) {
        rootUploadsCount = Number(rootCountRows[0].count) || 0;
      }
    } catch {
      rootUploadsCount = 0;
    }

    if (!effectiveTeamId && fs.existsSync(UPLOADS_DIR)) {
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

async function getProjectFolderById(
  id: string,
  userId: number | null,
  teamId?: number | null,
  teamPermissions: string[] = []
): Promise<ProjectFolderRecord | null> {
  const pool = getDbPool();
  const effectiveTeamId = teamId || null;
  try {
    const [rows] = effectiveTeamId
      ? await pool.query<any[]>(
          `SELECT pf.id, pf.user_id, pf.team_id, pf.parent_id, pf.name, pf.folder_type, pf.color, pf.visibility, pf.created_at, pf.updated_at, pfm.role AS explicit_role
           FROM project_folders pf
           LEFT JOIN project_folder_members pfm ON pfm.folder_id = pf.id AND pfm.user_id = ?
           WHERE pf.id = ? AND pf.team_id = ?
           LIMIT 1`,
          [userId || 0, id, effectiveTeamId]
        )
      : await pool.query<any[]>(
          `SELECT id, user_id, team_id, parent_id, name, folder_type, color, visibility, created_at, updated_at
           FROM project_folders
           WHERE id = ? AND team_id IS NULL AND (user_id <=> ? OR user_id IS NULL)
           LIMIT 1`,
          [id, userId]
        );
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    const row = rows[0];
    const role = resolveEffectiveFolderRole(row, userId, row.explicit_role || null, teamPermissions);
    if (!role) return null;

    return {
      color: row.color,
      created_at: row.created_at,
      folder_type: row.folder_type,
      id: row.id,
      name: row.name,
      parent_id: row.parent_id,
      team_id: row.team_id || null,
      updated_at: row.updated_at,
      user_id: row.user_id,
      user_role: role,
      visibility: (row.visibility as 'restricted' | 'team') || 'team',
    };
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
  teamId?: number | null;
  teamPermissions?: string[];
  userId: number | null;
  userPermissions?: string[];
}): Promise<ProjectFolderRecord> {
  const cleanName = (payload.name || '').trim();
  if (!cleanName) {
    throw new Error('El nombre de la carpeta no puede estar vacío.');
  }

  const pool = getDbPool();
  const effectiveTeamId = payload.teamId || null;

  if (effectiveTeamId) {
    const [countRows] = await pool.query<any[]>(
      'SELECT COUNT(*) AS total FROM project_folders WHERE team_id = ? AND folder_type != "uploads"',
      [effectiveTeamId]
    );
    const currentCount = Number(countRows?.[0]?.total || 0);
    if (currentCount >= FOLDER_LIMITS.business) {
      throw new Error('Has alcanzado el límite máximo de carpetas permitido para tu plan actual.');
    }
  } else if (payload.userId) {
    const [countRows] = await pool.query<any[]>(
      'SELECT COUNT(*) AS total FROM project_folders WHERE user_id <=> ? AND team_id IS NULL AND folder_type != "uploads"',
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
      const uploadsFolder = await ensureUploadsFolder(payload.userId, effectiveTeamId);
      payload.parentId = uploadsFolder.id;
    } else {
      const parent = await getProjectFolderById(payload.parentId, payload.userId, effectiveTeamId, payload.teamPermissions || []);
      if (!parent || parent.folder_type !== 'uploads') {
        throw new Error('Solo se permite un nivel de carpetas dentro de la carpeta de subidos.');
      }
    }
  }

  await pool.query(
    'INSERT INTO project_folders (id, user_id, team_id, parent_id, name, folder_type, color, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [folderId, payload.userId, effectiveTeamId, payload.parentId || null, cleanName, folderType, payload.color || null, 'team']
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
    team_id: effectiveTeamId,
    updated_at: new Date().toISOString(),
    user_id: payload.userId,
    user_role: 'editor',
    visibility: 'team',
  };
}

async function renameProjectFolder(
  id: string,
  newName: string,
  userId: number | null,
  teamId?: number | null,
  teamPermissions: string[] = []
): Promise<ProjectFolderRecord> {
  const cleanName = (newName || '').trim();
  if (!cleanName) {
    throw new Error('El nombre de la carpeta no puede estar vacío.');
  }

  const effectiveTeamId = teamId || null;
  const folder = await getProjectFolderById(id, userId, effectiveTeamId, teamPermissions);
  if (!folder) {
    throw new Error('Carpeta no encontrada.');
  }
  if (folder.user_role !== 'editor') {
    throw new Error('No tienes permisos de edición sobre esta carpeta.');
  }

  if (folder.folder_type === 'uploads') {
    throw new Error('No se puede cambiar el nombre de la carpeta de subidos del sistema.');
  }

  const pool = getDbPool();
  if (effectiveTeamId) {
    await pool.query('UPDATE project_folders SET name = ?, updated_at = NOW() WHERE id = ? AND team_id = ?', [
      cleanName,
      id,
      effectiveTeamId,
    ]);
  } else {
    await pool.query('UPDATE project_folders SET name = ?, updated_at = NOW() WHERE id = ? AND team_id IS NULL AND (user_id <=> ? OR user_id IS NULL)', [
      cleanName,
      id,
      userId,
    ]);
  }

  folder.name = cleanName;
  folder.updated_at = new Date().toISOString();
  return folder;
}

async function deleteProjectFolder(
  id: string,
  userId: number | null,
  teamId?: number | null,
  teamPermissions: string[] = []
): Promise<boolean> {
  const effectiveTeamId = teamId || null;
  const folder = await getProjectFolderById(id, userId, effectiveTeamId, teamPermissions);
  if (!folder) {
    return false;
  }

  if (folder.folder_type === 'uploads') {
    throw new Error('No se puede eliminar la carpeta de subidos del sistema.');
  }

  if (effectiveTeamId && folder.user_id !== userId && !teamPermissions.includes('team:folders:manage')) {
    throw new Error('No tienes permisos para eliminar esta carpeta.');
  }

  const pool = getDbPool();
  await pool.query('UPDATE collaborative_documents SET folder_id = NULL WHERE folder_id = ?', [id]);
  await pool.query('UPDATE user_storage_assets SET folder_id = NULL WHERE folder_id = ?', [id]);
  await pool.query('DELETE FROM project_folder_members WHERE folder_id = ?', [id]);

  if (!effectiveTeamId && fs.existsSync(UPLOADS_DIR)) {
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

  if (effectiveTeamId) {
    await pool.query('DELETE FROM project_folders WHERE id = ? AND team_id = ?', [id, effectiveTeamId]);
  } else {
    await pool.query('DELETE FROM project_folders WHERE id = ? AND team_id IS NULL AND (user_id <=> ? OR user_id IS NULL)', [id, userId]);
  }
  return true;
}

async function moveDocToFolder(
  docId: string,
  folderId: string | null,
  userId?: number | null,
  teamId?: number | null,
  teamPermissions: string[] = []
): Promise<boolean> {
  const pool = getDbPool();
  const effectiveTeamId = teamId || null;
  if (folderId) {
    const targetFolder = await getProjectFolderById(folderId, userId ?? null, effectiveTeamId, teamPermissions);
    if (!targetFolder || targetFolder.folder_type !== 'project' || targetFolder.user_role !== 'editor') {
      throw new Error('Carpeta de destino no válida para documentos PDF.');
    }
  }

  const [res] = effectiveTeamId
    ? await pool.query<any>(
        'UPDATE collaborative_documents SET folder_id = ?, updated_at = NOW() WHERE id = ? AND team_id = ?',
        [folderId || null, docId, effectiveTeamId]
      )
    : await pool.query<any>(
        'UPDATE collaborative_documents SET folder_id = ?, updated_at = NOW() WHERE id = ? AND team_id IS NULL AND (user_id <=> ? OR user_id IS NULL)',
        [folderId || null, docId, userId ?? null]
      );
  return res && res.affectedRows > 0;
}

async function moveUploadToFolder(
  uploadId: string,
  folderId: string | null,
  userId?: number | null,
  teamId?: number | null,
  teamPermissions: string[] = []
): Promise<boolean> {
  const pool = getDbPool();
  const effectiveTeamId = teamId || null;
  if (folderId) {
    const targetFolder = await getProjectFolderById(folderId, userId ?? null, effectiveTeamId, teamPermissions);
    if (!targetFolder || (targetFolder.folder_type !== 'uploads' && targetFolder.folder_type !== 'upload_folder') || targetFolder.user_role !== 'editor') {
      throw new Error('Carpeta de destino no válida para archivos subidos.');
    }
  }

  if (effectiveTeamId) {
    await pool.query(
      'UPDATE user_storage_assets SET folder_id = ?, updated_at = NOW() WHERE id = ? AND team_id = ?',
      [folderId || null, uploadId, effectiveTeamId]
    );
  } else {
    await pool.query(
      'UPDATE user_storage_assets SET folder_id = ?, updated_at = NOW() WHERE id = ? AND team_id IS NULL AND (user_id <=> ? OR user_id IS NULL)',
      [folderId || null, uploadId, userId ?? null]
    );
  }

  if (!effectiveTeamId && fs.existsSync(UPLOADS_DIR)) {
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

async function getFolderSharingDetails(
  folderId: string,
  teamId: number,
  requesterUserId: number,
  teamPermissions: string[]
): Promise<{
  canManage: boolean;
  folder: ProjectFolderRecord;
  members: ProjectFolderMemberRecord[];
  visibility: 'restricted' | 'team';
}> {
  const folder = await getProjectFolderById(folderId, requesterUserId, teamId, teamPermissions);
  if (!folder || folder.folder_type === 'uploads') {
    throw new Error('Carpeta no encontrada.');
  }

  const canManage = folder.user_id === requesterUserId || teamPermissions.includes('team:folders:manage');
  const pool = getDbPool();
  const [rows] = await pool.query<any[]>(
    `SELECT pfm.user_id, pfm.role, u.username, u.email, u.avatar_url
     FROM project_folder_members pfm
     INNER JOIN users u ON u.id = pfm.user_id
     WHERE pfm.folder_id = ?
     ORDER BY u.username ASC`,
    [folderId]
  );

  const members: ProjectFolderMemberRecord[] = (rows || []).map((r) => ({
    avatar_url: r.avatar_url || null,
    email: r.email,
    role: r.role === 'viewer' ? 'viewer' : 'editor',
    user_id: Number(r.user_id),
    username: r.username,
  }));

  return {
    canManage,
    folder,
    members,
    visibility: folder.visibility || 'team',
  };
}

async function updateFolderVisibility(
  folderId: string,
  teamId: number,
  visibility: 'restricted' | 'team',
  requesterUserId: number,
  teamPermissions: string[]
): Promise<ProjectFolderRecord> {
  const folder = await getProjectFolderById(folderId, requesterUserId, teamId, teamPermissions);
  if (!folder || folder.folder_type === 'uploads') {
    throw new Error('Carpeta no encontrada.');
  }
  const canManage = folder.user_id === requesterUserId || teamPermissions.includes('team:folders:manage');
  if (!canManage) {
    throw new Error('No tienes permisos para cambiar el acceso de esta carpeta.');
  }

  const pool = getDbPool();
  await pool.query(
    'UPDATE project_folders SET visibility = ?, updated_at = NOW() WHERE id = ? AND team_id = ?',
    [visibility, folderId, teamId]
  );
  folder.visibility = visibility;
  return folder;
}

async function addOrUpdateFolderMember(
  folderId: string,
  teamId: number,
  targetUserId: number,
  role: 'editor' | 'viewer',
  requesterUserId: number,
  teamPermissions: string[]
): Promise<void> {
  const folder = await getProjectFolderById(folderId, requesterUserId, teamId, teamPermissions);
  if (!folder || folder.folder_type === 'uploads') {
    throw new Error('Carpeta no encontrada.');
  }
  const canManage = folder.user_id === requesterUserId || teamPermissions.includes('team:folders:manage');
  if (!canManage) {
    throw new Error('No tienes permisos para compartir esta carpeta.');
  }
  const memberExists = await isActiveTeamMember(teamId, targetUserId);
  if (!memberExists) {
    throw new Error('El usuario seleccionado no pertenece a este equipo.');
  }

  const pool = getDbPool();
  await pool.query(
    `INSERT INTO project_folder_members (folder_id, user_id, role, added_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE role = VALUES(role), updated_at = CURRENT_TIMESTAMP`,
    [folderId, targetUserId, role, requesterUserId]
  );
}

async function removeFolderMember(
  folderId: string,
  teamId: number,
  targetUserId: number,
  requesterUserId: number,
  teamPermissions: string[]
): Promise<void> {
  const folder = await getProjectFolderById(folderId, requesterUserId, teamId, teamPermissions);
  if (!folder || folder.folder_type === 'uploads') {
    throw new Error('Carpeta no encontrada.');
  }
  const canManage = folder.user_id === requesterUserId || teamPermissions.includes('team:folders:manage');
  if (!canManage) {
    throw new Error('No tienes permisos para modificar miembros de esta carpeta.');
  }

  const pool = getDbPool();
  await pool.query(
    'DELETE FROM project_folder_members WHERE folder_id = ? AND user_id = ?',
    [folderId, targetUserId]
  );
}

export {
  addOrUpdateFolderMember,
  createProjectFolder,
  deleteProjectFolder,
  ensureUploadsFolder,
  getFolderSharingDetails,
  getProjectFolderById,
  listProjectFolders,
  moveDocToFolder,
  moveUploadToFolder,
  removeFolderMember,
  renameProjectFolder,
  updateFolderVisibility,
};
export type { ProjectFolderMemberRecord, ProjectFolderRecord };
