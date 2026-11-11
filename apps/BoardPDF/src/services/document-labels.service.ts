import { getDbPool } from '../config/database.config.js';
import { resolveLabelLimit } from '../config/subscription-plans.config.js';
import { CACHE_KEYS, CACHE_TTL, cacheService } from './cache.service.js';
import { logger } from './logger.service.js';
import { trackAiCollabEvent } from './telemetry.service.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const PRESET_LABEL_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'] as const;
type LabelColor = (typeof PRESET_LABEL_COLORS)[number];

interface DocumentLabelRecord {
  color: LabelColor;
  created_at: string;
  id: number;
  is_default: boolean;
  name: string;
}

class DocumentLabelError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

const DEFAULT_PRESET_NAMES: Record<LabelColor, string> = {
  blue: 'preset:blue',
  gray: 'preset:gray',
  green: 'preset:green',
  orange: 'preset:orange',
  purple: 'preset:purple',
  red: 'preset:red',
  yellow: 'preset:yellow',
};

function normalizeLabelColor(rawColor?: string | null): LabelColor {
  const normalized = String(rawColor ?? 'red').trim().toLowerCase();
  if ((PRESET_LABEL_COLORS as readonly string[]).includes(normalized)) {
    return normalized as LabelColor;
  }
  throw new DocumentLabelError('INVALID_LABEL_COLOR', 'Color de etiqueta no válido.', 400);
}

function mapLabelRow(row: RowDataPacket): DocumentLabelRecord {
  const colorRaw = String(row.color || 'red').toLowerCase();
  const color = (PRESET_LABEL_COLORS as readonly string[]).includes(colorRaw)
    ? (colorRaw as LabelColor)
    : 'red';
  return {
    color,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    id: Number(row.id),
    is_default: Boolean(row.is_default),
    name: String(row.name || ''),
  };
}

async function queryUserLabelsFromDb(userId: number, teamId?: number | null): Promise<DocumentLabelRecord[]> {
  const pool = getDbPool();
  const whereClause = teamId ? 'team_id = ?' : 'user_id = ? AND team_id IS NULL';
  const whereParam = teamId || userId;
  const selectSql = `
    SELECT id, user_id, team_id, name, color, is_default, created_at
    FROM user_labels
    WHERE ${whereClause}
    ORDER BY is_default DESC, FIELD(color, 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'), created_at ASC, id ASC
  `;
  const [initialRows] = await pool.query<RowDataPacket[]>(selectSql, [whereParam]);
  const existingDefaults = (Array.isArray(initialRows) ? initialRows : []).filter((r) => Boolean(r.is_default));

  if (existingDefaults.length < PRESET_LABEL_COLORS.length) {
    const placeholders = PRESET_LABEL_COLORS.map(() => '(?, ?, ?, ?, TRUE)').join(', ');
    const insertParams: Array<number | string | null> = [];
    for (const color of PRESET_LABEL_COLORS) {
      insertParams.push(userId, teamId || null, DEFAULT_PRESET_NAMES[color], color);
    }
    await pool.query(
      `INSERT IGNORE INTO user_labels (user_id, team_id, name, color, is_default) VALUES ${placeholders}`,
      insertParams
    );
    const [refreshedRows] = await pool.query<RowDataPacket[]>(selectSql, [whereParam]);
    return (Array.isArray(refreshedRows) ? refreshedRows : []).map(mapLabelRow);
  }

  return (Array.isArray(initialRows) ? initialRows : []).map(mapLabelRow);
}

async function getUserLabels(userId: number, teamId?: number | null): Promise<DocumentLabelRecord[]> {
  const cacheKey = teamId ? CACHE_KEYS.teamLabels(teamId) : CACHE_KEYS.userLabels(String(userId));
  const cached = await cacheService.remember<DocumentLabelRecord[]>(
    cacheKey,
    CACHE_TTL.userLabels,
    () => queryUserLabelsFromDb(userId, teamId),
    30
  );
  return cached ?? [];
}

async function createUserLabel(
  userId: number,
  permissions: string[],
  input: { color?: string | null; name?: string | null },
  teamId?: number | null
): Promise<{ customCount: number; label: DocumentLabelRecord; maxCustomLabels: number }> {
  const cleanName = String(input.name ?? '').trim();
  if (!cleanName) {
    throw new DocumentLabelError('LABEL_NAME_REQUIRED', 'El nombre de la etiqueta es obligatorio.', 400);
  }
  if (cleanName.length > 60) {
    throw new DocumentLabelError('LABEL_NAME_TOO_LONG', 'El nombre de la etiqueta no debe superar 60 caracteres.', 400);
  }

  const color = input.color ? normalizeLabelColor(input.color) : 'red';
  const maxCustomLabels = resolveLabelLimit(permissions);
  const effectiveTeamId = teamId || null;

  const labels = await getUserLabels(userId, effectiveTeamId);
  const customCount = labels.filter((l) => !l.is_default).length;
  if (customCount >= maxCustomLabels) {
    throw new DocumentLabelError(
      'LABEL_LIMIT_REACHED',
      'Has alcanzado el límite máximo de etiquetas personalizadas para tu plan.',
      403
    );
  }

  const pool = getDbPool();
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO user_labels (user_id, team_id, name, color, is_default) VALUES (?, ?, ?, ?, FALSE)',
      [userId, effectiveTeamId, cleanName, color]
    );
    if (effectiveTeamId) {
      await cacheService.invalidateTeam(effectiveTeamId);
    } else {
      await cacheService.invalidateUserLabels(String(userId));
    }

    const [createdRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, user_id, team_id, name, color, is_default, created_at FROM user_labels WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    const label = mapLabelRow(createdRows[0]);

    trackAiCollabEvent({
      eventType: 'label_created',
      featureName: 'document-labels',
      metadata: { color, customCount: customCount + 1, maxCustomLabels, teamId: effectiveTeamId },
      status: 'success',
      userId,
    });

    return {
      customCount: customCount + 1,
      label,
      maxCustomLabels,
    };
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      throw new DocumentLabelError('LABEL_NAME_DUPLICATE', 'Ya existe una etiqueta con ese nombre.', 409);
    }
    throw err;
  }
}

async function deleteUserLabel(
  userId: number,
  labelId: number,
  permissions: string[],
  teamId?: number | null
): Promise<{ customCount: number; maxCustomLabels: number }> {
  const pool = getDbPool();
  const effectiveTeamId = teamId || null;
  const [rows] = effectiveTeamId
    ? await pool.query<RowDataPacket[]>(
        'SELECT id, is_default, color FROM user_labels WHERE id = ? AND team_id = ? LIMIT 1',
        [labelId, effectiveTeamId]
      )
    : await pool.query<RowDataPacket[]>(
        'SELECT id, is_default, color FROM user_labels WHERE id = ? AND user_id = ? AND team_id IS NULL LIMIT 1',
        [labelId, userId]
      );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new DocumentLabelError('LABEL_NOT_FOUND', 'Etiqueta no encontrada.', 404);
  }

  if (Boolean(rows[0].is_default)) {
    throw new DocumentLabelError('CANNOT_DELETE_DEFAULT_LABEL', 'No se pueden eliminar las etiquetas predeterminadas.', 400);
  }

  if (effectiveTeamId) {
    await pool.query('DELETE FROM user_labels WHERE id = ? AND team_id = ? AND is_default = FALSE', [labelId, effectiveTeamId]);
    await cacheService.invalidateTeam(effectiveTeamId);
  } else {
    await pool.query('DELETE FROM user_labels WHERE id = ? AND user_id = ? AND team_id IS NULL AND is_default = FALSE', [labelId, userId]);
    await cacheService.invalidateUserLabels(String(userId));
  }

  const updatedLabels = await getUserLabels(userId, effectiveTeamId);
  const customCount = updatedLabels.filter((l) => !l.is_default).length;
  const maxCustomLabels = resolveLabelLimit(permissions);

  trackAiCollabEvent({
    eventType: 'label_deleted',
    featureName: 'document-labels',
    metadata: { color: rows[0].color, labelId, teamId: effectiveTeamId },
    status: 'success',
    userId,
  });

  return {
    customCount,
    maxCustomLabels,
  };
}

async function getLabelsForDocumentIds(
  userId: number,
  docIds: string[],
  teamId?: number | null
): Promise<Map<string, DocumentLabelRecord[]>> {
  const result = new Map<string, DocumentLabelRecord[]>();
  const cleanIds = Array.from(new Set(docIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
  if ((!userId && !teamId) || cleanIds.length === 0) {
    return result;
  }

  try {
    const pool = getDbPool();
    const placeholders = cleanIds.map(() => '?').join(', ');
    const scopeClause = teamId ? 'ul.team_id = ?' : 'ul.user_id = ? AND ul.team_id IS NULL';
    const scopeParam = teamId || userId;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cdl.document_id, ul.id, ul.name, ul.color, ul.is_default, ul.created_at
       FROM collaborative_document_labels cdl
       INNER JOIN user_labels ul ON ul.id = cdl.label_id
       WHERE ${scopeClause} AND cdl.document_id IN (${placeholders})
       ORDER BY ul.is_default DESC, FIELD(ul.color, 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'), ul.created_at ASC, ul.id ASC`,
      [scopeParam, ...cleanIds]
    );

    for (const row of Array.isArray(rows) ? rows : []) {
      const docId = String(row.document_id);
      const existing = result.get(docId) ?? [];
      existing.push(mapLabelRow(row));
      result.set(docId, existing);
    }
  } catch (err) {
    logger.db.warn('No se pudieron cargar etiquetas de documentos desde MySQL', err);
  }

  return result;
}

async function setDocumentLabels(
  userId: number,
  documentId: string,
  rawLabelIds: unknown[],
  teamId?: number | null,
  canManageTeamFolders = false
): Promise<DocumentLabelRecord[]> {
  const pool = getDbPool();
  const effectiveTeamId = teamId || null;
  const [docRows] = effectiveTeamId
    ? await pool.query<RowDataPacket[]>(
        `SELECT cd.id
         FROM collaborative_documents cd
         LEFT JOIN collaborative_document_members cdm ON cdm.document_id = cd.id AND cdm.user_id = ?
         INNER JOIN team_members tm ON tm.team_id = cd.team_id AND tm.user_id = ? AND tm.status = 'active'
         LEFT JOIN project_folders pf ON pf.id = cd.folder_id
         LEFT JOIN project_folder_members pfm ON pfm.folder_id = cd.folder_id AND pfm.user_id = ?
         WHERE cd.id = ?
           AND cd.team_id = ?
           AND (
             ? = 1
             OR cd.user_id = ?
             OR cdm.role IN ('editor', 'owner')
             OR (
               cd.team_access = 'editor'
               AND (pf.id IS NULL OR pf.visibility != 'restricted' OR pf.user_id = ? OR pfm.role = 'editor')
             )
           )
         LIMIT 1`,
        [userId, userId, userId, documentId, effectiveTeamId, canManageTeamFolders ? 1 : 0, userId, userId]
      )
    : await pool.query<RowDataPacket[]>(
        `SELECT cd.id
         FROM collaborative_documents cd
         LEFT JOIN collaborative_document_members cdm ON cdm.document_id = cd.id AND cdm.user_id = ?
         WHERE cd.id = ? AND cd.team_id IS NULL AND (cd.user_id = ? OR cdm.role IN ('editor', 'owner'))
         LIMIT 1`,
        [userId, documentId, userId]
      );

  if (!Array.isArray(docRows) || docRows.length === 0) {
    throw new DocumentLabelError('DOCUMENT_NOT_FOUND', 'Documento no encontrado o sin acceso.', 404);
  }

  const labelIds = Array.from(
    new Set(
      (Array.isArray(rawLabelIds) ? rawLabelIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  await getUserLabels(userId, effectiveTeamId);

  if (labelIds.length > 0) {
    const placeholders = labelIds.map(() => '?').join(', ');
    const [validRows] = effectiveTeamId
      ? await pool.query<RowDataPacket[]>(
          `SELECT id FROM user_labels WHERE team_id = ? AND id IN (${placeholders})`,
          [effectiveTeamId, ...labelIds]
        )
      : await pool.query<RowDataPacket[]>(
          `SELECT id FROM user_labels WHERE user_id = ? AND team_id IS NULL AND id IN (${placeholders})`,
          [userId, ...labelIds]
        );
    if (!Array.isArray(validRows) || validRows.length !== labelIds.length) {
      throw new DocumentLabelError('INVALID_LABEL_IDS', 'Una o más etiquetas seleccionadas no son válidas.', 400);
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (effectiveTeamId) {
      await conn.query(
        `DELETE cdl
         FROM collaborative_document_labels cdl
         INNER JOIN user_labels ul ON ul.id = cdl.label_id
         WHERE cdl.document_id = ? AND ul.team_id = ?`,
        [documentId, effectiveTeamId]
      );
    } else {
      await conn.query(
        `DELETE cdl
         FROM collaborative_document_labels cdl
         INNER JOIN user_labels ul ON ul.id = cdl.label_id
         WHERE cdl.document_id = ? AND ul.user_id = ? AND ul.team_id IS NULL`,
        [documentId, userId]
      );
    }

    if (labelIds.length > 0) {
      const valueTuples = labelIds.map(() => '(?, ?, ?)').join(', ');
      const insertParams: Array<number | string> = [];
      for (const labelId of labelIds) {
        insertParams.push(documentId, labelId, userId);
      }
      await conn.query(
        `INSERT INTO collaborative_document_labels (document_id, label_id, assigned_by) VALUES ${valueTuples}`,
        insertParams
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  trackAiCollabEvent({
    documentId,
    eventType: 'document_labels_updated',
    featureName: 'document-labels',
    metadata: { labelCount: labelIds.length, labelIds, teamId: effectiveTeamId },
    status: 'success',
    userId,
  });

  const labelMap = await getLabelsForDocumentIds(userId, [documentId], effectiveTeamId);
  return labelMap.get(documentId) ?? [];
}

export {
  DocumentLabelError,
  PRESET_LABEL_COLORS,
  createUserLabel,
  deleteUserLabel,
  getLabelsForDocumentIds,
  getUserLabels,
  setDocumentLabels,
};
export type { DocumentLabelRecord, LabelColor };
