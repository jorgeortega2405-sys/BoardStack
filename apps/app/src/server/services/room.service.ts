import { config } from '../config/env.config.js';
import crypto from 'crypto';
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
  owner_token: string | null;
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
  owner_token?: string | null;
  owner_username: string;
  password?: string | null;
  room_id: string;
  save_to_cloud?: boolean;
  slug?: string | null;
  upload_permission?: 'all' | 'owner_only' | 'specific';
}

interface UpdateRoomParams {
  clear_expiration?: boolean;
  clear_max_downloads?: boolean;
  clear_password?: boolean;
  clear_slug?: boolean;
  expires_at?: Date | null;
  is_persistent?: boolean;
  max_downloads?: number | null;
  password?: string | null;
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

function getEncryptionKey(): Buffer {
  const secret = config.sessionSecret || '';
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptRoomPassword(password: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decryptRoomPassword(encryptedPayload: string | null): string | null {
  if (!encryptedPayload) return null;
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) return null;
  try {
    const [ivHex, tagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

function verifyRoomPassword(plainPassword: string, encryptedPayload: string | null): boolean {
  if (!plainPassword || !encryptedPayload) return false;
  const decrypted = decryptRoomPassword(encryptedPayload);
  if (!decrypted) return false;
  if (plainPassword.length !== decrypted.length) return false;
  return crypto.timingSafeEqual(Buffer.from(plainPassword), Buffer.from(decrypted));
}

async function createRoomRecord(params: CreateRoomParams): Promise<void> {
  const requiresPassword = Boolean(params.password && params.password.trim());
  const formattedExpiresAt = params.expires_at ? params.expires_at.toISOString().slice(0, 19).replace('T', ' ') : null;
  const uploadPerm = params.upload_permission || 'all';
  const storedPassword = requiresPassword ? encryptRoomPassword(params.password!.trim()) : null;

  await pool.execute(
    `INSERT INTO rooms (
      room_id, code, slug, owner_id, owner_username, is_persistent,
      requires_password, password_hash, owner_token, save_to_cloud, upload_permission, max_downloads, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      slug = VALUES(slug),
      save_to_cloud = VALUES(save_to_cloud),
      upload_permission = VALUES(upload_permission),
      max_downloads = VALUES(max_downloads),
      owner_token = COALESCE(VALUES(owner_token), owner_token),
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
      storedPassword,
      params.owner_token || null,
      params.save_to_cloud ? 1 : 0,
      uploadPerm,
      params.max_downloads !== undefined && params.max_downloads !== null ? params.max_downloads : null,
      formattedExpiresAt,
    ]
  );
}

async function updateRoomRecord(roomId: string, params: UpdateRoomParams): Promise<DbRoom | null> {
  const current = await findRoomByIdentifier(roomId);
  if (!current) return null;

  let newSlug = current.slug;
  if (params.clear_slug) {
    newSlug = null;
  } else if (params.slug !== undefined) {
    newSlug = params.slug ? params.slug.trim().toLowerCase() : null;
  }

  let requiresPassword = current.requires_password;
  let passwordHash = current.password_hash;
  if (params.clear_password) {
    requiresPassword = 0;
    passwordHash = null;
  } else if (params.password !== undefined) {
    const trimmed = params.password ? params.password.trim() : '';
    if (trimmed.length > 0) {
      requiresPassword = 1;
      passwordHash = encryptRoomPassword(trimmed);
    } else {
      requiresPassword = 0;
      passwordHash = null;
    }
  }

  const saveToCloud = params.save_to_cloud !== undefined ? (params.save_to_cloud ? 1 : 0) : current.save_to_cloud;
  const isPersistent = saveToCloud ? 1 : (params.is_persistent !== undefined ? (params.is_persistent ? 1 : 0) : current.is_persistent);
  const uploadPerm = params.upload_permission !== undefined ? params.upload_permission : current.upload_permission;

  let maxDownloads = current.max_downloads;
  if (params.clear_max_downloads) {
    maxDownloads = null;
  } else if (params.max_downloads !== undefined) {
    maxDownloads = params.max_downloads && params.max_downloads > 0 ? params.max_downloads : null;
  }

  let formattedExpiresAt = current.expires_at;
  if (params.clear_expiration) {
    formattedExpiresAt = null;
  } else if (params.expires_at !== undefined) {
    formattedExpiresAt = params.expires_at ? params.expires_at.toISOString().slice(0, 19).replace('T', ' ') : null;
  }

  await pool.execute(
    `UPDATE rooms SET
      slug = ?,
      requires_password = ?,
      password_hash = ?,
      save_to_cloud = ?,
      is_persistent = ?,
      upload_permission = ?,
      max_downloads = ?,
      expires_at = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE room_id = ?`,
    [
      newSlug,
      requiresPassword,
      passwordHash,
      saveToCloud,
      isPersistent,
      uploadPerm,
      maxDownloads,
      formattedExpiresAt,
      current.room_id,
    ]
  );

  return findRoomByIdentifier(current.room_id);
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
      `UPDATE app_user_profiles SET storage_used_bytes = GREATEST(0, storage_used_bytes - ?) WHERE user_id = ?`,
      [totalBytesDeleted, ownerId]
    ).catch(() => {});
  }
  await pool.execute(`DELETE FROM room_files WHERE room_id = ?`, [roomId]);
  await pool.execute(`DELETE FROM rooms WHERE room_id = ?`, [roomId]);
}

async function cleanupExpiredRoomsAndFiles(): Promise<void> {
  try {
    const [expiredFileStats] = await pool.execute<RowDataPacket[]>(
      `SELECT rf.room_id, COALESCE(rf.user_id, r.owner_id) AS user_id, SUM(rf.size) AS freed_bytes
       FROM room_files rf
       LEFT JOIN rooms r ON rf.room_id = r.room_id
       WHERE rf.expires_at IS NOT NULL AND rf.expires_at <= NOW()
       GROUP BY rf.room_id, COALESCE(rf.user_id, r.owner_id)`
    );

    for (const row of expiredFileStats) {
      const freed = Number(row.freed_bytes || 0);
      const uid = row.user_id;
      if (uid && freed > 0) {
        await pool.execute(
          `UPDATE app_user_profiles SET storage_used_bytes = GREATEST(0, storage_used_bytes - ?) WHERE user_id = ?`,
          [freed, uid]
        ).catch(() => {});
      }
    }

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
  decryptRoomPassword,
  deleteRoomRecord,
  encryptRoomPassword,
  findRoomByIdentifier,
  getRoomFileById,
  getRoomFiles,
  incrementFileDownloadCount,
  saveRoomFileRecord,
  updateRoomRecord,
  verifyRoomPassword
};

export type {
  CreateRoomParams,
  DbRoom,
  DbRoomFile,
  SaveRoomFileParams,
  UpdateRoomParams
};