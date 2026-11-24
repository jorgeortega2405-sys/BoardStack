import { deleteFromS3 } from './s3.service.js';
import { logger } from '../utils/logger.js';
import { pool } from '../config/database.config.js';
import type { RowDataPacket } from 'mysql2';

interface DbRoom extends RowDataPacket {
  code: string;
  created_at: string;
  expires_at: string | null;
  id: number;
  is_persistent: number;
  max_downloads: number | null;
  owner_id: number | null;
  owner_username: string;
  password_hash: string | null;
  requires_password: number;
  room_id: string;
  save_to_cloud: number;
  slug: string | null;
  updated_at: string;
  upload_permission: 'all' | 'owner_only' | 'specific';
}

interface DbRoomFile extends RowDataPacket {
  created_at: string;
  download_count: number;
  expires_at: string | null;
  file_id: string;
  folder_id: string | null;
  folder_name: string | null;
  id: number;
  max_downloads: number | null;
  mime_type: string;
  name: string;
  relative_path: string | null;
  room_id: string;
  s3_key: string;
  s3_url: string;
  sender_avatar: string | null;
  sender_username: string;
  size: number;
  updated_at: string;
  user_id: number | null;
}

interface CreateRoomParams {
  code: string;
  expires_at?: Date | null;
  is_persistent: boolean;
  max_downloads?: number | null;
  owner_id?: number | null;
  owner_username: string;
  password?: string | null;
  room_id: string;
  save_to_cloud?: boolean;
  slug?: string | null;
  upload_permission?: 'all' | 'owner_only' | 'specific';
}

interface SaveRoomFileParams {
  expires_at?: Date | null;
  file_id: string;
  folder_id?: string | null;
  folder_name?: string | null;
  max_downloads?: number | null;
  mime_type: string;
  name: string;
  relative_path?: string | null;
  room_id: string;
  s3_key: string;
  s3_url: string;
  sender_avatar?: string | null;
  sender_username: string;
  size: number;
  user_id?: number | null;
}

async function createRoomRecord(params: CreateRoomParams): Promise<void> {
  const requiresPassword = Boolean(params.password && params.password.trim());
  const formattedExpiresAt = params.expires_at ? params.expires_at.toISOString().slice(0, 19).replace('T', ' ') : null;
  const uploadPerm = params.upload_permission || 'all';

  await pool.execute(
    `INSERT INTO rooms (
      room_id, code, slug, owner_id, owner_username, is_persistent,
      requires_password, password_hash, save_to_cloud, upload_permission, max_downloads, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      slug = VALUES(slug),
      save_to_cloud = VALUES(save_to_cloud),
      upload_permission = VALUES(upload_permission),
      max_downloads = VALUES(max_downloads),
      expires_at = VALUES(expires_at),
      updated_at = CURRENT_TIMESTAMP`,
    [
      params.room_id,
      params.code,
      params.slug || null,
      params.owner_id || null,
      params.owner_username,
      params.is_persistent ? 1 : 0,
      requiresPassword ? 1 : 0,
      params.password || null,
      params.save_to_cloud ? 1 : 0,
      uploadPerm,
      params.max_downloads !== undefined && params.max_downloads !== null ? params.max_downloads : null,
      formattedExpiresAt,
    ]
  );
}

async function findRoomByIdentifier(identifier: string): Promise<DbRoom | null> {
  const clean = identifier.trim();
  const [rows] = await pool.execute<DbRoom[]>(
    `SELECT * FROM rooms WHERE room_id = ? OR slug = ? OR code = ? LIMIT 1`,
    [clean, clean.toLowerCase(), clean.toUpperCase()]
  );
  return rows[0] || null;
}

async function saveRoomFileRecord(params: SaveRoomFileParams): Promise<void> {
  const formattedExpiresAt = params.expires_at ? params.expires_at.toISOString().slice(0, 19).replace('T', ' ') : null;

  await pool.execute(
    `INSERT INTO room_files (
      room_id, file_id, user_id, name, size, mime_type, s3_key, s3_url,
      max_downloads, folder_id, folder_name, relative_path, sender_username,
      sender_avatar, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      size = VALUES(size),
      mime_type = VALUES(mime_type),
      s3_key = VALUES(s3_key),
      s3_url = VALUES(s3_url),
      max_downloads = VALUES(max_downloads),
      updated_at = CURRENT_TIMESTAMP`,
    [
      params.room_id,
      params.file_id,
      params.user_id || null,
      params.name,
      params.size,
      params.mime_type,
      params.s3_key,
      params.s3_url,
      params.max_downloads !== undefined && params.max_downloads !== null ? params.max_downloads : null,
      params.folder_id || null,
      params.folder_name || null,
      params.relative_path || null,
      params.sender_username,
      params.sender_avatar || null,
      formattedExpiresAt,
    ]
  );
}

async function getRoomFiles(roomId: string): Promise<DbRoomFile[]> {
  const [rows] = await pool.execute<DbRoomFile[]>(
    `SELECT * FROM room_files
     WHERE room_id = ? AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at ASC`,
    [roomId]
  );
  return rows;
}

async function getRoomFileById(roomId: string, fileId: string): Promise<DbRoomFile | null> {
  const [rows] = await pool.execute<DbRoomFile[]>(
    `SELECT * FROM room_files WHERE room_id = ? AND file_id = ? LIMIT 1`,
    [roomId, fileId]
  );
  return rows[0] || null;
}

async function incrementFileDownloadCount(roomId: string, fileId: string): Promise<{ download_count: number; max_downloads: number | null }> {
  await pool.execute(
    `UPDATE room_files SET download_count = download_count + 1 WHERE room_id = ? AND file_id = ?`,
    [roomId, fileId]
  );
  const updated = await getRoomFileById(roomId, fileId);
  return {
    download_count: updated ? updated.download_count : 1,
    max_downloads: updated ? updated.max_downloads : null,
  };
}

async function deleteRoomRecord(roomId: string): Promise<void> {
  const [files] = await pool.execute<DbRoomFile[]>(
    `SELECT * FROM room_files WHERE room_id = ?`,
    [roomId]
  );
  let totalBytesDeleted = 0;
  let ownerId: number | null = null;
  const [roomRows] = await pool.execute<DbRoom[]>(
    `SELECT owner_id FROM rooms WHERE room_id = ? LIMIT 1`,
    [roomId]
  );
  if (roomRows[0] && roomRows[0].owner_id) {
    ownerId = roomRows[0].owner_id;
  }
  for (const f of files) {
    if (f.s3_key) {
      await deleteFromS3(f.s3_key);
      totalBytesDeleted += Number(f.size || 0);
      if (f.user_id && !ownerId) {
        ownerId = f.user_id;
      }
    }
  }
  if (ownerId && totalBytesDeleted > 0) {
    await pool.execute(
      `UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes - ?) WHERE id = ?`,
      [totalBytesDeleted, ownerId]
    ).catch(() => {});
  }
  await pool.execute(`DELETE FROM room_files WHERE room_id = ?`, [roomId]);
  await pool.execute(`DELETE FROM rooms WHERE room_id = ?`, [roomId]);
}

async function cleanupExpiredRoomsAndFiles(): Promise<void> {
  try {
    const [expiredFiles] = await pool.execute<DbRoomFile[]>(
      `SELECT * FROM room_files WHERE expires_at IS NOT NULL AND expires_at <= NOW()`
    );
    for (const f of expiredFiles) {
      if (f.s3_key) {
        await deleteFromS3(f.s3_key);
      }
    }
    if (expiredFiles.length > 0) {
      await pool.execute(`DELETE FROM room_files WHERE expires_at IS NOT NULL AND expires_at <= NOW()`);
      logger.app.info(`Cleaned up ${expiredFiles.length} expired room files from S3 and database`);
    }

    const [expiredRooms] = await pool.execute<DbRoom[]>(
      `SELECT * FROM rooms WHERE expires_at IS NOT NULL AND expires_at <= NOW()`
    );
    for (const r of expiredRooms) {
      await deleteRoomRecord(r.room_id);
    }
    if (expiredRooms.length > 0) {
      logger.app.info(`Cleaned up ${expiredRooms.length} expired rooms`);
    }
  } catch (error) {
    logger.app.error('Error cleaning up expired rooms and files:', error);
  }
}

export {
  cleanupExpiredRoomsAndFiles,
  createRoomRecord,
  deleteRoomRecord,
  findRoomByIdentifier,
  getRoomFileById,
  getRoomFiles,
  incrementFileDownloadCount,
  saveRoomFileRecord
};

export type {
  CreateRoomParams,
  DbRoom,
  DbRoomFile,
  SaveRoomFileParams
};
