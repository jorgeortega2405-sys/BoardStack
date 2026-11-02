import { isS3Configured, S3_BUCKET_NAME, s3Client } from '../config/s3.config.js';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import fs from 'fs';
import { getDbPool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import zlib from 'zlib';

export const DEFAULT_STORAGE_LIMIT_BYTES = 5368709120;

export interface StorageStats {
  limitBytes: number;
  percentage: number;
  remainingBytes: number;
  usedBytes: number;
}

export interface UserAssetRecord {
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
  updated_at: string;
  user_id: number;
}

export async function getUserStorageStats(userId: number): Promise<StorageStats> {
  const pool = getDbPool();
  const [rows] = await pool.query<any[]>(
    'SELECT storage_used_bytes, storage_limit_bytes FROM users WHERE id = ?',
    [userId]
  );

  const userRow = rows?.[0];
  const usedBytes = Number(userRow?.storage_used_bytes) || 0;
  const limitBytes = Number(userRow?.storage_limit_bytes) || DEFAULT_STORAGE_LIMIT_BYTES;
  const remainingBytes = Math.max(0, limitBytes - usedBytes);
  const percentage = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 1000) / 10) : 0;

  return { limitBytes, percentage, remainingBytes, usedBytes };
}

export async function canUserAllocateStorage(
  userId: number,
  additionalBytes: number
): Promise<{ allowed: boolean; limitBytes: number; remainingBytes: number; usedBytes: number }> {
  const stats = await getUserStorageStats(userId);
  const allowed = stats.usedBytes + additionalBytes <= stats.limitBytes;
  return { allowed, ...stats };
}

export async function recordUserAsset(params: {
  assetType: 'document_json' | 'document_pdf' | 'upload_image' | 'upload_pdf';
  byteSize: number;
  documentId?: string | null;
  fileName: string;
  filePath: string;
  mimeType: string;
  s3Key?: string | null;
  userId: number;
}): Promise<string> {
  const pool = getDbPool();
  const id = `ast_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO user_storage_assets 
       (id, user_id, document_id, file_name, file_path, s3_key, mime_type, byte_size, asset_type, is_cold) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [
        id,
        params.userId,
        params.documentId || null,
        params.fileName,
        params.filePath,
        params.s3Key || null,
        params.mimeType,
        params.byteSize,
        params.assetType,
      ]
    );

    await conn.query(
      'UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?',
      [params.byteSize, params.userId]
    );

    await conn.commit();
    return id;
  } catch (err) {
    await conn.rollback();
    logger.db.error('Error al registrar asset de almacenamiento de usuario', err);
    throw err;
  } finally {
    conn.release();
  }
}

export async function reclaimDocumentStorage(
  documentId: string,
  userId?: number | null
): Promise<{ reclaimedBytes: number }> {
  const pool = getDbPool();
  let targetUserId = userId;

  if (!targetUserId) {
    const [docRows] = await pool.query<any[]>(
      'SELECT user_id FROM collaborative_documents WHERE id = ?',
      [documentId]
    );
    targetUserId = docRows?.[0]?.user_id ? Number(docRows[0].user_id) : null;
  }

  const [assets] = await pool.query<any[]>(
    'SELECT id, file_path, s3_key, byte_size FROM user_storage_assets WHERE document_id = ?',
    [documentId]
  );

  let totalReclaimed = 0;

  for (const asset of assets || []) {
    totalReclaimed += Number(asset.byte_size) || 0;

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

    await conn.query('DELETE FROM user_storage_assets WHERE document_id = ?', [documentId]);

    if (targetUserId && totalReclaimed > 0) {
      await conn.query(
        'UPDATE users SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) - ?) WHERE id = ?',
        [totalReclaimed, targetUserId]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    logger.db.error('Error al liberar almacenamiento de documento en base de datos', err);
  } finally {
    conn.release();
  }

  return { reclaimedBytes: totalReclaimed };
}

export async function reclaimUserAsset(assetId: string, userId: number): Promise<boolean> {
  const pool = getDbPool();
  const [rows] = await pool.query<any[]>(
    'SELECT id, file_path, s3_key, byte_size FROM user_storage_assets WHERE id = ? AND user_id = ?',
    [assetId, userId]
  );

  const asset = rows?.[0];
  if (!asset) return false;

  const byteSize = Number(asset.byte_size) || 0;

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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_storage_assets WHERE id = ? AND user_id = ?', [assetId, userId]);
    if (byteSize > 0) {
      await conn.query(
        'UPDATE users SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) - ?) WHERE id = ?',
        [byteSize, userId]
      );
    }
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    logger.db.error('Error al descontar asset de almacenamiento en BD', err);
    return false;
  } finally {
    conn.release();
  }
}

export async function reconcileUserStorage(userId: number): Promise<number> {
  const pool = getDbPool();
  const [rows] = await pool.query<any[]>(
    'SELECT COALESCE(SUM(byte_size), 0) AS total_bytes FROM user_storage_assets WHERE user_id = ?',
    [userId]
  );

  const accurateTotal = Number(rows?.[0]?.total_bytes) || 0;
  await pool.query('UPDATE users SET storage_used_bytes = ? WHERE id = ?', [accurateTotal, userId]);
  return accurateTotal;
}

export async function syncDocumentStorage(
  documentId: string,
  userId: number,
  jsonBytes: number,
  pdfBytes = 0
): Promise<void> {
  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

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
       (id, user_id, document_id, file_name, file_path, s3_key, mime_type, byte_size, asset_type, is_cold)
       VALUES (?, ?, ?, ?, ?, NULL, 'application/json', ?, 'document_json', FALSE)
       ON DUPLICATE KEY UPDATE byte_size = VALUES(byte_size), updated_at = NOW()`,
      [jsonId, userId, documentId, `${documentId}.json`, `data/collaborative-docs/${documentId}.json`, jsonBytes]
    );

    if (pdfBytes > 0) {
      const pdfId = `doc_pdf_${documentId}`;
      await conn.query(
        `INSERT INTO user_storage_assets 
         (id, user_id, document_id, file_name, file_path, s3_key, mime_type, byte_size, asset_type, is_cold)
         VALUES (?, ?, ?, ?, ?, NULL, 'application/pdf', ?, 'document_pdf', FALSE)
         ON DUPLICATE KEY UPDATE byte_size = VALUES(byte_size), updated_at = NOW()`,
        [pdfId, userId, documentId, `${documentId}.pdf`, `data/collaborative-docs/${documentId}.pdf`, pdfBytes]
      );
    }

    if (delta !== 0) {
      await conn.query(
        'UPDATE users SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) + ?) WHERE id = ?',
        [delta, userId]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    logger.db.warn(`No se pudo sincronizar cuota de almacenamiento para documento ${documentId}`, err);
  } finally {
    conn.release();
  }
}

export async function compressColdDocuments(daysThreshold = 45): Promise<{ archivedDocs: number; freedBytes: number }> {
  const pool = getDbPool();
  const [docs] = await pool.query<any[]>(
    `SELECT d.id, d.user_id, d.content_json, d.pdf_filename 
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

        if (doc.user_id && savedBytes > 0) {
          await conn.query(
            'UPDATE users SET storage_used_bytes = GREATEST(0, CAST(storage_used_bytes AS SIGNED) - ?) WHERE id = ?',
            [savedBytes, doc.user_id]
          );
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

export function startColdStorageCron(): void {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const result = await compressColdDocuments(45);
      if (result.archivedDocs > 0) {
        logger.app.info(`Almacenamiento en frío: ${result.archivedDocs} documentos archivados, ${result.freedBytes} bytes liberados`);
      }
    } catch (err) {
      logger.app.warn('Error en tarea programada de almacenamiento en frío', err);
    }
  }, ONE_DAY_MS);
}
