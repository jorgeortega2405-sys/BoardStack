import { getDbPool } from '../config/database.config.js';
import { logger } from './logger.service.js';

export interface FileOperationRecord {
  fileSize?: number;
  filename: string;
  mimeType?: string;
  s3Bucket: string;
  s3Key: string;
  token: string;
  toolName?: string;
  ttlSeconds: number;
}

export async function recordFileOperation(record: FileOperationRecord): Promise<void> {
  try {
    const pool = getDbPool();
    const expiresAt = new Date(Date.now() + record.ttlSeconds * 1000);
    const query = `
      INSERT INTO file_operations (
        file_token, s3_key, s3_bucket, filename, mime_type, file_size, tool_name, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
      ON DUPLICATE KEY UPDATE
        s3_key = VALUES(s3_key),
        s3_bucket = VALUES(s3_bucket),
        filename = VALUES(filename),
        mime_type = VALUES(mime_type),
        file_size = VALUES(file_size),
        tool_name = VALUES(tool_name),
        status = 'active',
        expires_at = VALUES(expires_at)
    `;
    await pool.execute(query, [
      record.token,
      record.s3Key,
      record.s3Bucket,
      record.filename,
      record.mimeType || 'application/pdf',
      record.fileSize || 0,
      record.toolName || 'general',
      expiresAt,
    ]);
  } catch (err) {
    logger.db.warn('No se pudo registrar la operación de archivo en MySQL', err);
  }
}

export async function markFileOperationExpired(token: string): Promise<void> {
  try {
    const pool = getDbPool();
    const query = `
      UPDATE file_operations
      SET status = 'expired', deleted_at = CURRENT_TIMESTAMP
      WHERE file_token = ? AND status = 'active'
    `;
    await pool.execute(query, [token]);
  } catch (err) {
    logger.db.warn('No se pudo actualizar estado a expirado en MySQL', err);
  }
}

export async function markFileOperationDeleted(token: string): Promise<void> {
  try {
    const pool = getDbPool();
    const query = `
      UPDATE file_operations
      SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP
      WHERE file_token = ?
    `;
    await pool.execute(query, [token]);
  } catch (err) {
    logger.db.warn('No se pudo marcar archivo como eliminado en MySQL', err);
  }
}
