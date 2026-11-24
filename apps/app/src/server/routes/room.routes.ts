import { asyncHandler } from '../middlewares/async.middleware.js';
import { config } from '../config/env.config.js';
import {
  createRoomRecord,
  decryptRoomPassword,
  deleteRoomRecord,
  findRoomByIdentifier,
  getRoomFileById,
  getRoomFiles,
  incrementFileDownloadCount,
  saveRoomFileRecord,
  verifyRoomPassword,
} from '../services/room.service.js';
import crypto from 'crypto';
import express, { Request, Response, Router } from 'express';
import fs from 'fs';
import { getS3Object, sanitizeAndUploadToS3 } from '../services/s3.service.js';
import { getStorageTierLabel, getStorageTierLimitBytes } from '../config/subscription-plans.config.js';
import { getValidatedCurrentUser, requireAuth } from '../middlewares/auth.middleware.js';
import { logger } from '../utils/logger.js';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { pool } from '../config/database.config.js';

const router = Router();

const tempUploadDir = path.join(os.tmpdir(), 'boardstack_uploads');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const upload = multer({
  dest: tempUploadDir,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, tempUploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      cb(null, `${uniqueSuffix}_${path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    },
  }),
});

async function broadcastToRoomServer(roomId: string, message: any): Promise<void> {
  try {
    const broadcastUrl = `http://${config.roomServer.host}:${config.roomServer.port}/api/rooms/${encodeURIComponent(roomId)}/broadcast`;
    await fetch(broadcastUrl, {
      body: JSON.stringify(message),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  } catch {}
}

async function createRoomHandler(req: Request, res: Response): Promise<void> {
  const user = await getValidatedCurrentUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.', ok: false });
    return;
  }

  const {
    custom_slug,
    expires_in_hours,
    is_persistent,
    max_downloads,
    password,
    save_to_cloud,
    upload_permission,
  } = req.body;

  const isPro = user.subscription_tier === 'pro' || user.subscription_tier === 'enterprise';
  const cleanSlug = typeof custom_slug === 'string' && custom_slug.trim() ? custom_slug.trim().toLowerCase() : null;
  if (cleanSlug && !isPro) {
    res.status(403).json({ error: 'Custom link is exclusive to BoardStack Pro.', ok: false, requires_pro: true });
    return;
  }

  const saveToCloud = Boolean(save_to_cloud);
  const isPersistent = saveToCloud ? true : Boolean(is_persistent);

  if ((saveToCloud || isPersistent) && !isPro) {
    res.status(403).json({ error: 'Cloud storage and persistent rooms are exclusive to BoardStack Pro.', ok: false, requires_pro: true });
    return;
  }

  const hours = expires_in_hours !== undefined && expires_in_hours !== null && String(expires_in_hours).trim() !== ''
    ? Number(expires_in_hours)
    : 1;

  if (hours !== 1 && !isPro) {
    res.status(403).json({ error: 'Programmable expiration beyond 1 hour is exclusive to BoardStack Pro.', ok: false, requires_pro: true });
    return;
  }

  const uploadPerm = (upload_permission === 'owner_only' || upload_permission === 'specific')
    ? upload_permission
    : 'all';

  const ownerToken = crypto.randomBytes(32).toString('hex');
  const rawPassword = typeof password === 'string' && password.trim() ? password.trim() : null;

  const roomServerUrl = `http://${config.roomServer.host}:${config.roomServer.port}/api/rooms/create`;
  const response = await fetch(roomServerUrl, {
    body: JSON.stringify({
      avatar_url: user.avatar_url || null,
      custom_slug: cleanSlug,
      expires_in_hours: hours > 0 ? hours : null,
      is_persistent: isPersistent,
      max_downloads: max_downloads ? Number(max_downloads) : null,
      owner_token: ownerToken,
      owner_username: user.username || user.email || 'Host',
      password: rawPassword,
      save_to_cloud: saveToCloud,
      upload_permission: uploadPerm,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as Record<string, any>;
    res.status(response.status).json(errorData);
    return;
  }

  const data = (await response.json()) as { code: string; room_id: string; slug?: string | null; [key: string]: any };
  const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600 * 1000) : null;

  try {
    await createRoomRecord({
      code: data.code,
      expires_at: expiresAt,
      is_persistent: isPersistent,
      max_downloads: max_downloads ? Number(max_downloads) : null,
      owner_id: user.id,
      owner_token: ownerToken,
      owner_username: user.username || user.email || 'Host',
      password: rawPassword,
      room_id: data.room_id,
      save_to_cloud: saveToCloud,
      slug: data.slug || null,
      upload_permission: uploadPerm,
    });
  } catch (err) {
    logger.app.error('Failed to save room record in database:', err);
  }

  res.json({
    ...data,
    expires_at: expiresAt ? Math.floor(expiresAt.getTime() / 1000) : null,
    is_persistent: isPersistent,
    max_downloads: max_downloads ? Number(max_downloads) : null,
    owner_token: ownerToken,
    save_to_cloud: saveToCloud,
    upload_permission: uploadPerm,
  });
}

async function resolveRoomHandler(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  if (!code) {
    res.status(400).json({ error: 'Room code or slug is required.', ok: false });
    return;
  }

  const clean = code.trim();
  const roomServerUrl = `http://${config.roomServer.host}:${config.roomServer.port}/api/rooms/resolve/${encodeURIComponent(clean)}`;
  const response = await fetch(roomServerUrl);

  const currentUser = await getValidatedCurrentUser(req, res);

  if (response.ok) {
    const data = await response.json().catch(() => ({})) as Record<string, any>;
    const dbRoom = await findRoomByIdentifier(data.room_id || clean);
    const isOwner = Boolean(
      (currentUser && dbRoom && dbRoom.owner_id && currentUser.id === dbRoom.owner_id) ||
      (currentUser && dbRoom && currentUser.username === dbRoom.owner_username)
    );
    if (isOwner && dbRoom?.owner_token) {
      data.owner_token = dbRoom.owner_token;
    }
    res.status(response.status).json(data);
    return;
  }

  if (response.status === 410) {
    res.status(410).json({ error: 'Room has expired.', expired: true, ok: false });
    return;
  }

  const dbRoom = await findRoomByIdentifier(clean);
  if (!dbRoom) {
    res.status(404).json({ error: 'Room not found.', ok: false });
    return;
  }

  if (dbRoom.expires_at && new Date(dbRoom.expires_at).getTime() <= Date.now()) {
    res.status(410).json({ error: 'Room has expired.', expired: true, ok: false });
    return;
  }

  const rawPassword = decryptRoomPassword(dbRoom.password_hash);
  const createUrl = `http://${config.roomServer.host}:${config.roomServer.port}/api/rooms/create`;
  await fetch(createUrl, {
    body: JSON.stringify({
      code: dbRoom.code,
      custom_slug: dbRoom.slug,
      expires_at: dbRoom.expires_at ? Math.floor(new Date(dbRoom.expires_at).getTime() / 1000) : null,
      is_persistent: Boolean(dbRoom.is_persistent),
      max_downloads: dbRoom.max_downloads,
      owner_token: dbRoom.owner_token,
      owner_username: dbRoom.owner_username,
      password: rawPassword,
      room_id: dbRoom.room_id,
      save_to_cloud: Boolean(dbRoom.save_to_cloud),
      upload_permission: dbRoom.upload_permission || 'all',
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  }).catch(() => {});

  const isOwner = Boolean(
    (currentUser && dbRoom.owner_id && currentUser.id === dbRoom.owner_id) ||
    (currentUser && currentUser.username === dbRoom.owner_username)
  );

  res.json({
    code: dbRoom.code,
    expires_at: dbRoom.expires_at ? Math.floor(new Date(dbRoom.expires_at).getTime() / 1000) : null,
    is_persistent: Boolean(dbRoom.is_persistent),
    max_downloads: dbRoom.max_downloads,
    ok: true,
    owner_token: isOwner ? dbRoom.owner_token : undefined,
    owner_username: dbRoom.owner_username,
    participant_count: 0,
    requires_password: Boolean(dbRoom.requires_password),
    room_id: dbRoom.room_id,
    save_to_cloud: Boolean(dbRoom.save_to_cloud),
    slug: dbRoom.slug,
    upload_permission: dbRoom.upload_permission || 'all',
  });
}

async function uploadRoomFileHandler(req: Request, res: Response): Promise<void> {
  const { roomId } = req.params;
  if (!roomId) {
    res.status(400).json({ error: 'Room ID is required.', ok: false });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.', ok: false });
    return;
  }

  const {
    file_id,
    folder_id,
    folder_name,
    max_downloads,
    relative_path,
    sender_avatar,
    sender_username,
  } = req.body;

  const actualFileId = file_id && typeof file_id === 'string' && file_id.trim()
    ? file_id.trim()
    : `file_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;

  const user = await getValidatedCurrentUser(req, res);
  const dbRoom = await findRoomByIdentifier(roomId);
  const actualRoomId = dbRoom ? dbRoom.room_id : roomId;

  if (dbRoom && dbRoom.upload_permission === 'owner_only') {
    const isRoomOwner = (user && dbRoom.owner_id && user.id === dbRoom.owner_id) ||
                        (user && user.username === dbRoom.owner_username);
    if (!isRoomOwner) {
      if (req.file?.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      res.status(403).json({ error: 'Only the room host is allowed to upload files.', ok: false });
      return;
    }
  }

  if (dbRoom && !dbRoom.save_to_cloud) {
    if (req.file?.path) {
      await fs.promises.unlink(req.file.path).catch(() => {});
    }
    res.status(400).json({ error: 'This room does not have cloud storage enabled.', ok: false });
    return;
  }

  const roomOwnerId = dbRoom?.owner_id || user?.id;
  if (roomOwnerId) {
    const [ownerRows] = await pool.execute<any[]>(
      `SELECT id, subscription_tier, storage_used_bytes FROM users WHERE id = ? LIMIT 1`,
      [roomOwnerId]
    );
    const ownerUser = ownerRows[0];
    const ownerTier = ownerUser?.subscription_tier || 'free';
    const tierStorageLimitBytes = getStorageTierLimitBytes(ownerTier);

    const currentStorage = Number(ownerUser?.storage_used_bytes || 0);
    if (currentStorage + req.file.size > tierStorageLimitBytes) {
      const quotaLabel = getStorageTierLabel(ownerTier);
      if (req.file?.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      res.status(400).json({
        error: `Storage quota exceeded for this room (${quotaLabel} limit).`,
        ok: false,
      });
      return;
    }
  }

  try {
    const fileBuffer = await fs.promises.readFile(req.file.path);
    const uploadResult = await sanitizeAndUploadToS3({
      allowedCategories: ['any'],
      body: fileBuffer,
      folder: `rooms/${actualRoomId}`,
      maxSizeBytes: 500 * 1024 * 1024,
      originalName: req.file.originalname,
      prefix: 'room',
    });

    if (roomOwnerId) {
      await pool.execute(
        `UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?`,
        [req.file.size, roomOwnerId]
      ).catch(() => {});
    }

    const roomExpiresAt = dbRoom && dbRoom.expires_at ? new Date(dbRoom.expires_at) : null;
    const fileMaxDownloads = max_downloads !== undefined && max_downloads !== null && String(max_downloads).trim() !== ''
      ? Number(max_downloads)
      : (dbRoom && dbRoom.max_downloads ? dbRoom.max_downloads : null);

    await saveRoomFileRecord({
      expires_at: roomExpiresAt,
      file_id: actualFileId,
      folder_id: folder_id || null,
      folder_name: folder_name || null,
      max_downloads: fileMaxDownloads,
      mime_type: uploadResult.sanitized.detectedMimeType,
      name: req.file.originalname,
      relative_path: relative_path || null,
      room_id: actualRoomId,
      s3_key: uploadResult.key,
      s3_url: uploadResult.url,
      sender_avatar: sender_avatar || (user ? user.avatar_url : null),
      sender_username: sender_username || (user ? user.username : 'User'),
      size: req.file.size,
      user_id: user ? user.id : null,
    });

    const filePayload = {
      download_count: 0,
      download_url: `/api/rooms/${encodeURIComponent(actualRoomId)}/files/${encodeURIComponent(actualFileId)}/download`,
      expires_at: roomExpiresAt ? Math.floor(roomExpiresAt.getTime() / 1000) : null,
      file_id: actualFileId,
      folder_id: folder_id || null,
      folder_name: folder_name || null,
      is_limit_reached: false,
      max_downloads: fileMaxDownloads,
      mime_type: uploadResult.sanitized.detectedMimeType,
      name: req.file.originalname,
      relative_path: relative_path || null,
      sender_avatar: sender_avatar || (user ? user.avatar_url : null),
      sender_username: sender_username || (user ? user.username : 'User'),
      size: req.file.size,
    };

    await broadcastToRoomServer(actualRoomId, {
      file: filePayload,
      type: 'cloud_file_added',
    });

    res.status(201).json({
      file: filePayload,
      ok: true,
    });
  } catch (err: any) {
    logger.app.error('Error uploading room file to S3:', err);
    res.status(400).json({
      error: err.message || 'File upload failed.',
      ok: false,
    });
  } finally {
    if (req.file?.path) {
      await fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
}

async function getRoomFilesHandler(req: Request, res: Response): Promise<void> {
  const { roomId } = req.params;
  if (!roomId) {
    res.status(400).json({ error: 'Room ID is required.', ok: false });
    return;
  }

  const dbRoom = await findRoomByIdentifier(roomId);
  const actualRoomId = dbRoom ? dbRoom.room_id : roomId;

  if (dbRoom && dbRoom.requires_password) {
    const user = await getValidatedCurrentUser(req, res);
    const isOwner = Boolean(
      (user && dbRoom.owner_id && user.id === dbRoom.owner_id) ||
      (user && user.username === dbRoom.owner_username)
    );

    if (!isOwner) {
      const providedPassword = req.headers['x-room-password'] || req.query.password;
      if (!providedPassword || !verifyRoomPassword(String(providedPassword), dbRoom.password_hash)) {
        res.status(401).json({ error: 'Room password required.', ok: false, requires_password: true });
        return;
      }
    }
  }

  const rawFiles = await getRoomFiles(actualRoomId);

  const files = rawFiles.map((f) => ({
    created_at: f.created_at,
    download_count: f.download_count,
    download_url: `/api/rooms/${encodeURIComponent(actualRoomId)}/files/${encodeURIComponent(f.file_id)}/download`,
    expires_at: f.expires_at ? Math.floor(new Date(f.expires_at).getTime() / 1000) : null,
    file_id: f.file_id,
    folder_id: f.folder_id,
    folder_name: f.folder_name,
    is_limit_reached: f.max_downloads !== null && f.download_count >= f.max_downloads,
    max_downloads: f.max_downloads,
    mime_type: f.mime_type,
    name: f.name,
    relative_path: f.relative_path,
    sender_avatar: f.sender_avatar,
    sender_username: f.sender_username,
    size: f.size,
  }));

  res.json({
    files,
    ok: true,
  });
}

async function downloadRoomFileHandler(req: Request, res: Response): Promise<void> {
  const { fileId, roomId } = req.params;
  if (!roomId || !fileId) {
    res.status(400).json({ error: 'Room ID and File ID are required.', ok: false });
    return;
  }

  const dbRoom = await findRoomByIdentifier(roomId);
  const actualRoomId = dbRoom ? dbRoom.room_id : roomId;

  if (dbRoom && dbRoom.requires_password) {
    const user = await getValidatedCurrentUser(req, res);
    const isOwner = Boolean(
      (user && dbRoom.owner_id && user.id === dbRoom.owner_id) ||
      (user && user.username === dbRoom.owner_username)
    );

    if (!isOwner) {
      const providedPassword = req.headers['x-room-password'] || req.query.password;
      if (!providedPassword || !verifyRoomPassword(String(providedPassword), dbRoom.password_hash)) {
        res.status(401).json({ error: 'Room password required.', ok: false, requires_password: true });
        return;
      }
    }
  }

  const file = await getRoomFileById(actualRoomId, fileId);
  if (!file) {
    res.status(404).json({ error: 'File not found.', ok: false });
    return;
  }

  if (file.expires_at && new Date(file.expires_at).getTime() <= Date.now()) {
    res.status(410).json({ error: 'File has expired.', expired: true, ok: false });
    return;
  }

  if (file.max_downloads !== null && file.download_count >= file.max_downloads) {
    res.status(410).json({
      error: 'Download limit reached for this file.',
      limit_reached: true,
      ok: false,
    });
    return;
  }

  const updatedCounts = await incrementFileDownloadCount(actualRoomId, fileId);
  const isLimitNowReached = updatedCounts.max_downloads !== null && updatedCounts.download_count >= updatedCounts.max_downloads;

  await broadcastToRoomServer(actualRoomId, {
    download_count: updatedCounts.download_count,
    file_id: fileId,
    is_limit_reached: isLimitNowReached,
    max_downloads: updatedCounts.max_downloads,
    type: 'file_downloaded',
  });

  try {
    const s3Response = await getS3Object(file.s3_key);
    if (!s3Response.Body) {
      res.status(404).json({ error: 'File data not found in storage.', ok: false });
      return;
    }

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', file.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`
    );

    const stream = s3Response.Body as any;
    stream.on('error', (err: any) => {
      logger.app.error(`Stream error for file ${file.file_id}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file.', ok: false });
      } else {
        res.end();
      }
    });

    req.on('close', () => {
      if (stream && typeof stream.destroy === 'function') {
        stream.destroy();
      }
    });

    stream.pipe(res);
  } catch (err: any) {
    logger.app.error(`Failed to stream file ${file.file_id} from S3:`, err);
    res.status(500).json({ error: 'Failed to retrieve file from storage.', ok: false });
  }
}

async function getMyRoomsHandler(req: Request, res: Response): Promise<void> {
  const user = await getValidatedCurrentUser(req, res);
  if (!user) {
    res.json({ ok: true, rooms: [] });
    return;
  }

  const [rows] = await pool.execute<any[]>(
    `SELECT 
       r.room_id,
       r.code,
       r.slug,
       r.is_persistent,
       r.requires_password,
       r.save_to_cloud,
       r.upload_permission,
       r.max_downloads,
       r.expires_at,
       r.created_at,
       COUNT(rf.id) AS files_count,
       COALESCE(SUM(rf.size), 0) AS storage_bytes,
       COALESCE(SUM(rf.download_count), 0) AS total_downloads
     FROM rooms r
     LEFT JOIN room_files rf ON r.room_id = rf.room_id
     WHERE (r.owner_id = ? OR r.owner_username = ?)
       AND (r.expires_at IS NULL OR r.expires_at > NOW())
     GROUP BY r.room_id, r.code, r.slug, r.is_persistent, r.requires_password, r.save_to_cloud, r.upload_permission, r.max_downloads, r.expires_at, r.created_at
     ORDER BY r.created_at DESC`,
    [user.id, user.username]
  );

  const rooms = rows.map((r) => ({
    code: r.code,
    created_at: r.created_at,
    expires_at: r.expires_at ? Math.floor(new Date(r.expires_at).getTime() / 1000) : null,
    files_count: Number(r.files_count || 0),
    is_persistent: Boolean(r.is_persistent),
    max_downloads: r.max_downloads,
    requires_password: Boolean(r.requires_password),
    room_id: r.room_id,
    save_to_cloud: Boolean(r.save_to_cloud),
    slug: r.slug,
    storage_bytes: Number(r.storage_bytes || 0),
    total_downloads: Number(r.total_downloads || 0),
    upload_permission: r.upload_permission || 'all',
  }));

  res.json({ ok: true, rooms });
}

async function deleteRoomHandler(req: Request, res: Response): Promise<void> {
  const user = await getValidatedCurrentUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.', ok: false });
    return;
  }

  const { roomId } = req.params;
  if (!roomId) {
    res.status(400).json({ error: 'Room ID is required.', ok: false });
    return;
  }

  const dbRoom = await findRoomByIdentifier(roomId);
  if (!dbRoom) {
    res.status(404).json({ error: 'Room not found.', ok: false });
    return;
  }

  const isOwner = (dbRoom.owner_id && user.id === dbRoom.owner_id) || (user.username === dbRoom.owner_username);
  if (!isOwner) {
    res.status(403).json({ error: 'Only the room host can delete this room.', ok: false });
    return;
  }

  await broadcastToRoomServer(dbRoom.room_id, {
    reason: 'Room deleted by owner.',
    type: 'room_closed',
  });

  await deleteRoomRecord(dbRoom.room_id);

  res.json({ ok: true });
}

router.post('/rooms/create', requireAuth, asyncHandler(createRoomHandler));
router.get('/rooms/my-rooms', requireAuth, asyncHandler(getMyRoomsHandler));
router.delete('/rooms/:roomId', requireAuth, asyncHandler(deleteRoomHandler));
router.get('/rooms/resolve/:code', asyncHandler(resolveRoomHandler));
router.post('/rooms/:roomId/files/upload', upload.single('file'), asyncHandler(uploadRoomFileHandler));
router.get('/rooms/:roomId/files', asyncHandler(getRoomFilesHandler));
router.get('/rooms/:roomId/files/:fileId/download', asyncHandler(downloadRoomFileHandler));

export default router;