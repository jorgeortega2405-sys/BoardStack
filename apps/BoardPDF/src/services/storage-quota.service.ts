import { getDbPool } from '../config/database.config.js';
import { isS3Configured, S3_BUCKET_NAME, s3Client } from '../config/s3.config.js';
import { logger } from './logger.service.js';
import { trackStorageEvent } from './telemetry.service.js';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import fs from 'fs';
import zlib from 'zlib';

const DEFAULT_STORAGE_LIMIT_BYTES = 5368709120;
const TEAM_STORAGE_LIMIT_BYTES = 536870912000;

interface StorageStats {
  limitBytes: number;
  percentage: number;
  remainingBytes: number;
  usedBytes: number;
}

interface UserAssetRecord {
  asset_type: 'document_json' | 'document_pdf' | 'upload_image' | 'upload_pdf';
  byte_size: number;
  created_at: string;
  document_id: string | null;
  file_name: string;
  file_path: string;
  id: string;
  is_cold: boolean;
  mime_type: string;
  s3_key: string | null;
  team_id: number | null;
  updated_at: string;
  user_id: number;
}

async function getUserStorageStats(userId: number, teamId?: number | null): Promise<StorageStats> {
  const pool = getDbPool();
  let usedBytes = 0;
  let limitBytes = teamId ? TEAM_STORAGE_LIMIT_BYTES : DEFAULT_STORAGE_LIMIT_BYTES;

  if (teamId) {
    const [rows] = await pool.query<any[]>(
      'SELECT storage_used_bytes, storage_limit_bytes FROM teams WHERE id = ?',
      [teamId]
    );
    const teamRow = rows?.[0];
    usedBytes = Number(teamRow?.storage_used_bytes) || 0;
    limitBytes = Number(teamRow?.storage_limit_bytes) || TEAM_STORAGE_LIMIT_BYTES;
  } else {
    const [rows] = await pool.query<any[]>(
      'SELECT storage_used_bytes, storage_limit_bytes FROM users WHERE id = ?',
      [userId]
    );
    const userRow = rows?.[0];
    usedBytes = Number(userRow?.storage_used_bytes) || 0;
    limitBytes = Number(userRow?.storage_limit_bytes) || DEFAULT_STORAGE_LIMIT_BYTES;
  }

  const remainingBytes = Math.max(0, limitBytes - usedBytes);
  const percentage = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 1000) / 10) : 0;

  return { limitBytes, percentage, remainingBytes, usedBytes };
}

async function canUserAllocateStorage(
  userId: number,
  additionalBytes: number,
  teamId?: number | null
): Promise<{ allowed: boolean; limitBytes: number; remainingBytes: number; usedBytes: number }> {
  const stats = await getUserStorageStats(userId, teamId);
  const allowed = stats.usedBytes + additionalBytes <= stats.limitBytes;
  return { allowed, ...stats };
}

async function recordUserAsset(params: {
  assetType: 'document_json' | 'document_pdf' | 'upload_image' | 'upload_pdf';
  byteSize: number;
  documentId?: string | null;
  fileName: string;
  filePath: string;
  folderId?: string | null;
  mimeType: string;
  s3Key?: string | null;
  teamId?: number | null;
  userId: number;
}): Promise<string> {
  const pool = getDbPool();
  const id = `ast_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const effectiveTeamId = params.teamId || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO user_storage_assets 
       (id, user_id, team_id, document_id, folder_id, file_name, file_path, s3_key, mime_type, byte_size, asset_type, is_cold) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [
        id,
        params.userId,
        effectiveTeamId,
        params.documentId || null,
        params.folderId || null,
        params.fileName,
        params.filePath,
        params.s3Key || null,
        params.mimeType,
        params.byteSize,
        params.assetType,
      ]
    );

    if (effectiveTeamId) {
      await conn.query(
        'UPDATE teams SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?',
        [params.byteSize, effectiveTeamId]
      );
    } else {
      await conn.query(
        'UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?',
        [params.byteSize, params.userId]
      );
    }

    await conn.commit();
    trackStorageEvent({
      bytesDelta: params.byteSize,
      eventType: 'user_asset_recorded',
      fileCount: 1,
      fileId: id,
      metadata: { assetType: params.assetType, documentId: params.documentId || null, mimeType: params.mimeType, teamId: effectiveTeamId },
      objectKey: params.s3Key || params.filePath,
      status: 'completed',
      storageTier: params.s3Key ? 's3_hot' : 'virtual_doc',
      userId: params.userId,
    });
    return id;
  } catch (err) {
    await conn.rollback();
    logger.db.error('Error al registrar asset de almacenamiento de usuario', err);
    throw err;
  } finally {
    conn.release();
  }
}

async function reclaimDocumentStorage(
  documentId: string,
  userId?: number | null
): Promise<{ reclaimedBytes: number }> {
  const pool = getDbPool();
  let targetUserId = userId;
  let targetTeamId: number | null = null;

  const [docRows] = await pool.query<any[]>(
    'SELECT user_id, team_id FROM collaborative_documents WHERE id = ?',
    [documentId]
  );
  if (docRows?.[0]) {
    if (!targetUserId) {
      targetUserId = docRows[0].user_id ? Number(docRows[0].user_id) : null;
    }
    targetTeamId = docRows[0].team_id ? Number(docRows[0].team_id) : null;
  }

  const [assets] = await pool.query<any[]>(
    'SELECT id, file_path, s3_key, byte_size, team_id FROM user_storage_assets WHERE document_id = ?',
    [documentId]
  );

  let totalReclaimed = 0;

  for (const asset of assets || []) {
    totalReclaimed += Number(asset.byte_size) || 0;
    if (!targetTeamId && asset.team_id) {
      targetTeamId = Number(asset.team_id);
    }

    if (asset.file_path && fs.existsSync(asset.file_path)) {
      try {
        fs.unlinkSync(asset.file_path);
      } catch (unlinkErr) {
        logger.app.warn(`No se pudo eliminar archivo físico de asset: ${asset.file_path}`, unlinkErr);
      }
    }

    if (asset.s3_key && isS3Configured()) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: asset.s3_key,
          })
        );
      } catch (s3Err) {
        logger.app.warn(`No se pudo eliminar asset de S3: ${asset.s3_key}`, s3Err);
      }
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [delAssetsRes] = await conn.query<any>('DELETE FROM user_storage_assets WHERE document_id = ?', [documentId]);

    if (totalReclaimed > 0 && delAssetsRes && delAssetsRes.affectedRows > 0) {
      if (targetTeamId) {
        await conn.query(
          'UPDATE teams SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) - ?) WHERE id = ?',
          [totalReclaimed, targetTeamId]
        );
      } else if (targetUserId) {
        await conn.query(
          'UPDATE users SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) - ?) WHERE id = ?',
          [totalReclaimed, targetUserId]
        );
      }
    }

    await conn.commit();
    if (totalReclaimed > 0) {
      trackStorageEvent({
        bytesDelta: -totalReclaimed,
        eventType: 'document_storage_reclaimed',
        fileCount: assets?.length || 0,
        fileId: documentId,
        status: 'completed',
        storageTier: 's3_hot',
        userId: targetUserId ?? null,
      });
    }
  } catch (err) {
    await conn.rollback();
    logger.db.error('Error al liberar almacenamiento de documento en base de datos', err);
  } finally {
    conn.release();
  }

  return { reclaimedBytes: totalReclaimed };
}

async function reclaimUserAsset(
  assetId: string,
  userId: number,
  teamId?: number | null,
  canManageTeamAssets = false
): Promise<boolean> {
  const pool = getDbPool();
  const [rows] = teamId
    ? await pool.query<any[]>(
        'SELECT id, user_id, file_path, s3_key, byte_size, team_id FROM user_storage_assets WHERE id = ? AND team_id = ? LIMIT 1',
        [assetId, teamId]
      )
    : await pool.query<any[]>(
        'SELECT id, user_id, file_path, s3_key, byte_size, team_id FROM user_storage_assets WHERE id = ? AND user_id = ? AND team_id IS NULL LIMIT 1',
        [assetId, userId]
      );

  const asset = rows?.[0];
  if (!asset) return false;

  const byteSize = Number(asset.byte_size) || 0;
  const assetTeamId = asset.team_id ? Number(asset.team_id) : null;
  if (assetTeamId && Number(asset.user_id) !== Number(userId) && !canManageTeamAssets) {
    return false;
  }

  const conn = await pool.getConnection();
  let deleted = false;
  try {
    await conn.beginTransaction();
    const [delRes] = assetTeamId
      ? await conn.query<any>(
          'DELETE FROM user_storage_assets WHERE id = ? AND team_id = ? AND (user_id = ? OR ? = 1)',
          [assetId, assetTeamId, userId, canManageTeamAssets ? 1 : 0]
        )
      : await conn.query<any>(
          'DELETE FROM user_storage_assets WHERE id = ? AND user_id = ? AND team_id IS NULL',
          [assetId, userId]
        );

    if (!delRes || delRes.affectedRows <= 0) {
      await conn.rollback();
      return false;
    }

    if (byteSize > 0) {
      if (assetTeamId) {
        await conn.query(
          'UPDATE teams SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) - ?) WHERE id = ?',
          [byteSize, assetTeamId]
        );
      } else {
        await conn.query(
          'UPDATE users SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) - ?) WHERE id = ?',
          [byteSize, userId]
        );
      }
    }
    await conn.commit();
    deleted = true;
  } catch (err) {
    await conn.rollback();
    logger.db.error('Error al descontar asset de almacenamiento en BD', err);
    return false;
  } finally {
    conn.release();
  }

  if (deleted) {
    if (asset.file_path && fs.existsSync(asset.file_path)) {
      try {
        fs.unlinkSync(asset.file_path);
      } catch (err) {
        logger.app.warn(`No se pudo eliminar archivo de asset ${asset.file_path}`, err);
      }
    }

    if (asset.s3_key && isS3Configured()) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: asset.s3_key,
          })
        );
      } catch (s3Err) {
        logger.app.warn(`No se pudo eliminar asset de S3: ${asset.s3_key}`, s3Err);
      }
    }

    trackStorageEvent({
      bytesDelta: -byteSize,
      eventType: 'user_asset_reclaimed',
      fileCount: 1,
      fileId: assetId,
      objectKey: asset.s3_key || asset.file_path || '',
      status: 'completed',
      storageTier: asset.s3_key ? 's3_hot' : 'virtual_doc',
      userId,
    });
  }

  return deleted;
}

async function reconcileUserStorage(userId: number, teamId?: number | null): Promise<number> {
  const pool = getDbPool();
  if (teamId) {
    const [rows] = await pool.query<any[]>(
      'SELECT COALESCE(SUM(byte_size), 0) AS total_bytes FROM user_storage_assets WHERE team_id = ?',
      [teamId]
    );
    const accurateTotal = Number(rows?.[0]?.total_bytes) || 0;
    await pool.query('UPDATE teams SET storage_used_bytes = ? WHERE id = ?', [accurateTotal, teamId]);
    return accurateTotal;
  }

  const [rows] = await pool.query<any[]>(
    'SELECT COALESCE(SUM(byte_size), 0) AS total_bytes FROM user_storage_assets WHERE user_id = ? AND team_id IS NULL',
    [userId]
  );

  const accurateTotal = Number(rows?.[0]?.total_bytes) || 0;
  await pool.query('UPDATE users SET storage_used_bytes = ? WHERE id = ?', [accurateTotal, userId]);
  return accurateTotal;
}

async function syncDocumentStorage(
  documentId: string,
  userId: number,
  jsonBytes: number,
  pdfBytes = 0,
  teamId?: number | null
): Promise<void> {
  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let effectiveTeamId = teamId;
    if (effectiveTeamId === undefined) {
      const [docRows] = await conn.query<any[]>(
        'SELECT team_id FROM collaborative_documents WHERE id = ? LIMIT 1',
        [documentId]
      );
      effectiveTeamId = docRows?.[0]?.team_id ? Number(docRows[0].team_id) : null;
    }

    const [existing] = await conn.query<any[]>(
      'SELECT id, byte_size, asset_type FROM user_storage_assets WHERE document_id = ? AND asset_type IN ("document_json", "document_pdf")',
      [documentId]
    );

    let oldTotal = 0;
    for (const row of existing || []) {
      oldTotal += Number(row.byte_size) || 0;
    }

    const newTotal = jsonBytes + pdfBytes;
    const delta = newTotal - oldTotal;

    const jsonId = `doc_json_${documentId}`;
    await conn.query(
      `INSERT INTO user_storage_assets 
       (id, user_id, team_id, document_id, file_name, file_path, s3_key, mime_type, byte_size, asset_type, is_cold)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'application/json', ?, 'document_json', FALSE)
       ON DUPLICATE KEY UPDATE team_id = VALUES(team_id), byte_size = VALUES(byte_size), updated_at = NOW()`,
      [jsonId, userId, effectiveTeamId || null, documentId, `${documentId}.json`, `data/collaborative-docs/${documentId}.json`, jsonBytes]
    );

    if (pdfBytes > 0) {
      const pdfId = `doc_pdf_${documentId}`;
      await conn.query(
        `INSERT INTO user_storage_assets 
         (id, user_id, team_id, document_id, file_name, file_path, s3_key, mime_type, byte_size, asset_type, is_cold)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 'application/pdf', ?, 'document_pdf', FALSE)
         ON DUPLICATE KEY UPDATE team_id = VALUES(team_id), byte_size = VALUES(byte_size), updated_at = NOW()`,
        [pdfId, userId, effectiveTeamId || null, documentId, `${documentId}.pdf`, `data/collaborative-docs/${documentId}.pdf`, pdfBytes]
      );
    }

    if (delta !== 0) {
      if (effectiveTeamId) {
        await conn.query(
          'UPDATE teams SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) + ?) WHERE id = ?',
          [delta, effectiveTeamId]
        );
      } else {
        await conn.query(
          'UPDATE users SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) + ?) WHERE id = ?',
          [delta, userId]
        );
      }
    }

    await conn.commit();
    if (delta !== 0) {
      trackStorageEvent({
        bytesDelta: delta,
        eventType: 'document_storage_synced',
        fileCount: pdfBytes > 0 ? 2 : 1,
        fileId: documentId,
        status: 'completed',
        storageTier: 'virtual_doc',
        userId,
      });
    }
  } catch (err) {
    await conn.rollback();
    logger.db.warn(`No se pudo sincronizar cuota de almacenamiento para documento ${documentId}`, err);
  } finally {
    conn.release();
  }
}

async function compressColdDocuments(daysThreshold = 45): Promise<{ archivedDocs: number; freedBytes: number }> {
  const pool = getDbPool();
  const [docs] = await pool.query<any[]>(
    `SELECT d.id, d.user_id, d.team_id, d.content_json, d.pdf_filename 
       FROM collaborative_documents d
      WHERE d.updated_at < NOW() - INTERVAL ? DAY
        AND d.id NOT IN (SELECT DISTINCT document_id FROM user_storage_assets WHERE is_cold = TRUE AND document_id IS NOT NULL)
      LIMIT 100`,
    [daysThreshold]
  );

  let archivedDocs = 0;
  let freedBytes = 0;

  for (const doc of docs || []) {
    try {
      const rawJson = typeof doc.content_json === 'string' ? doc.content_json : JSON.stringify(doc.content_json);
      const originalSize = Buffer.byteLength(rawJson, 'utf-8');
      const compressed = zlib.gzipSync(rawJson, { level: 9 });
      const compressedSize = compressed.length;
      const savedBytes = Math.max(0, originalSize - compressedSize);

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.query(
          `UPDATE user_storage_assets 
              SET is_cold = TRUE, byte_size = ? 
            WHERE document_id = ? AND asset_type = 'document_json'`,
          [compressedSize, doc.id]
        );

        if (savedBytes > 0) {
          if (doc.team_id) {
            await conn.query(
              'UPDATE teams SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) - ?) WHERE id = ?',
              [savedBytes, doc.team_id]
            );
          } else if (doc.user_id) {
            await conn.query(
              'UPDATE users SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) - ?) WHERE id = ?',
              [savedBytes, doc.user_id]
            );
          }
        }

        await conn.commit();
        archivedDocs++;
        freedBytes += savedBytes;
      } catch (txErr) {
        await conn.rollback();
        logger.db.error(`Error al archivar documento frío ${doc.id}`, txErr);
      } finally {
        conn.release();
      }
    } catch (compressErr) {
      logger.app.warn(`No se pudo comprimir en frío documento ${doc.id}`, compressErr);
    }
  }

  return { archivedDocs, freedBytes };
}

function startColdStorageCron(): void {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const result = await compressColdDocuments(45);
      if (result.archivedDocs > 0) {
        logger.app.info(`Almacenamiento en frío: ${result.archivedDocs} documentos archivados, ${result.freedBytes} bytes liberados`);
        trackStorageEvent({
          bytesDelta: -result.freedBytes,
          eventType: 'cold_archive_run',
          fileCount: result.archivedDocs,
          status: 'completed',
          storageTier: 's3_cold_compressed',
        });
      }
    } catch (err) {
      logger.app.warn('Error en tarea programada de almacenamiento en frío', err);
    }
  }, ONE_DAY_MS);
}

export { DEFAULT_STORAGE_LIMIT_BYTES, canUserAllocateStorage, compressColdDocuments, getUserStorageStats, reclaimDocumentStorage, reclaimUserAsset, reconcileUserStorage, recordUserAsset, startColdStorageCron, syncDocumentStorage };
export type { StorageStats, UserAssetRecord };
