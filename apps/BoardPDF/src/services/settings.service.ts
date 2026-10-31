import { getDbPool } from '../config/database.config.js';
import { isS3Configured, s3Client, S3_BUCKET_NAME } from '../config/s3.config.js';
import { validateEmail, validatePassword, validateUsername } from '../utils/validators.util.js';
import { hashPassword, verifyPassword } from './auth.service.js';
import { logger } from './logger.service.js';
import { sendEmailChangeCodeEmail } from './mail.service.js';
import { deleteUserPermanently as deleteUserPermanentlyInDb, findUserById, getUserPreferences as getUserPrefsFromDb, updateUserAvatar as updateUserAvatarInDb, updateUserEmail as updateUserEmailInDb, updateUserPassword as updateUserPasswordInDb, updateUserPreferences as updateUserPrefsInDb, updateUsername as updateUsernameInDb } from './user.service.js';
import { consumeEmailChangeAuthorization, consumePasswordChangeAuth, generateSixDigitCode, isEmailChangeAuthorized, saveEmailChangeCode, savePasswordChangeAuth, verifyEmailChangeCode } from './verification.service.js';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import path from 'path';

const AVATARS_DIR = path.resolve(process.cwd(), 'public/uploads/avatars');

export function detectMagicBytes(buffer: Buffer): { extension: string; mimeType: string } | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { extension: 'png', mimeType: 'image/png' };
  }

  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { extension: 'webp', mimeType: 'image/webp' };
  }

  return null;
}

export async function logUserAudit(
  userId: number,
  action: string,
  oldValue: string | null,
  newValue: string | null,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<void> {
  try {
    const pool = getDbPool();
    await pool.query<ResultSetHeader>(
      'INSERT INTO user_audit_logs (user_id, action, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, action, oldValue, newValue, ipAddress || null, userAgent ? userAgent.substring(0, 255) : null]
    );
    logger.security.info('Auditoría de usuario registrada', { action, newValue, oldValue, userId });
  } catch (error) {
    logger.db.error('Error al insertar registro de auditoría de usuario', error);
  }
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch {}
}

export async function updateAvatar(
  userId: number,
  file: Express.Multer.File,
  ip?: string | null,
  ua?: string | null
): Promise<{ avatar_url?: string; error?: string; success: boolean }> {
  if (!file) {
    return { error: 'No se ha subido ningún archivo.', success: false };
  }

  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) {
    if (file.path) {
      await safeUnlink(file.path);
    }
    return { error: 'La imagen supera el límite permitido de 2 MB.', success: false };
  }

  let buffer: Buffer | null = null;
  if (file.buffer) {
    buffer = file.buffer;
  } else if (file.path) {
    try {
      buffer = await fs.promises.readFile(file.path);
      await safeUnlink(file.path);
    } catch {}
  }

  if (!buffer) {
    return { error: 'No se pudo leer el archivo de imagen.', success: false };
  }

  const detected = detectMagicBytes(buffer);
  if (!detected) {
    return { error: 'Formato de imagen no compatible. Usa PNG, JPG o WEBP.', success: false };
  }

  const user = await findUserById(userId);
  if (!user) {
    return { error: 'Usuario no encontrado.', success: false };
  }

  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
  }

  const oldAvatarUrl = user.avatar_url;
  if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/avatars/')) {
    const oldFileName = path.basename(oldAvatarUrl);
    const oldFilePath = path.join(AVATARS_DIR, oldFileName);
    await safeUnlink(oldFilePath);

    if (isS3Configured()) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: `uploads/avatars/${oldFileName}`,
        }));
      } catch {}
    }
  }

  const newFileName = `avatar_${userId}_${Date.now()}.${detected.extension}`;
  const localTarget = path.join(AVATARS_DIR, newFileName);

  try {
    await fs.promises.writeFile(localTarget, buffer);
  } catch (err) {
    logger.app.error('Error al guardar archivo local de avatar', err);
    return { error: 'No se pudo guardar la imagen en el servidor.', success: false };
  }

  if (isS3Configured()) {
    try {
      await s3Client.send(new PutObjectCommand({
        Body: buffer,
        Bucket: S3_BUCKET_NAME,
        ContentType: detected.mimeType,
        Key: `uploads/avatars/${newFileName}`,
      }));
    } catch (s3Err) {
      logger.app.warn('Aviso al persistir avatar en bucket S3', s3Err);
    }
  }

  const newAvatarUrl = `/uploads/avatars/${newFileName}`;
  await updateUserAvatarInDb(userId, newAvatarUrl);
  await logUserAudit(userId, 'update_avatar', oldAvatarUrl || null, newAvatarUrl, ip, ua);

  return { avatar_url: newAvatarUrl, success: true };
}

export async function deleteAvatar(
  userId: number,
  ip?: string | null,
  ua?: string | null
): Promise<{ avatar_url: null; error?: string; success: boolean }> {
  const user = await findUserById(userId);
  if (!user) {
    return { avatar_url: null, error: 'Usuario no encontrado.', success: false };
  }

  const oldAvatarUrl = user.avatar_url;
  if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/avatars/')) {
    const oldFileName = path.basename(oldAvatarUrl);
    const oldFilePath = path.join(AVATARS_DIR, oldFileName);
    await safeUnlink(oldFilePath);

    if (isS3Configured()) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: `uploads/avatars/${oldFileName}`,
        }));
      } catch {}
    }
  }

  await updateUserAvatarInDb(userId, null);
  await logUserAudit(userId, 'delete_avatar', oldAvatarUrl || null, null, ip, ua);

  return { avatar_url: null, success: true };
}

export async function updateUsername(
  userId: number,
  newUsername: string,
  ip?: string | null,
  ua?: string | null
): Promise<{ error?: string; status?: number; success: boolean; username?: string }> {
  const validation = validateUsername(newUsername);
  if (!validation.valid) {
    return { error: validation.error, status: 400, success: false };
  }

  const cleanUsername = newUsername.trim();
  const user = await findUserById(userId);
  if (!user) {
    return { error: 'Usuario no encontrado.', status: 404, success: false };
  }

  const oldUsername = user.username;
  if (oldUsername.toLowerCase() === cleanUsername.toLowerCase()) {
    return { success: true, username: oldUsername };
  }

  const pool = getDbPool();
  const [existingRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
    [cleanUsername, userId]
  );

  if (existingRows.length > 0) {
    return { error: 'El nombre de usuario ya está en uso.', status: 409, success: false };
  }

  await updateUsernameInDb(userId, cleanUsername);
  await logUserAudit(userId, 'update_username', oldUsername, cleanUsername, ip, ua);

  return { success: true, username: cleanUsername };
}

export async function requestEmailChangeCode(
  userId: number,
  _ip?: string | null,
  _ua?: string | null
): Promise<{ alreadyAuthorized?: boolean; error?: string; status?: number; success: boolean }> {
  const user = await findUserById(userId);
  if (!user) {
    return { error: 'Usuario no encontrado.', status: 404, success: false };
  }

  const alreadyAuthorized = await isEmailChangeAuthorized(userId);
  if (alreadyAuthorized) {
    return { alreadyAuthorized: true, success: true };
  }

  const code = generateSixDigitCode();
  const ttlSeconds = 900;
  await saveEmailChangeCode(userId, user.email, code, ttlSeconds);

  try {
    await sendEmailChangeCodeEmail(user.email, user.username, code, 15);
    logger.security.info('Código de cambio de correo enviado al usuario', { email: user.email, userId });
  } catch (error) {
    logger.app.error('Error al enviar correo con código de cambio de email', error);
    return { error: 'No se pudo enviar el correo de verificación. Intenta más tarde.', status: 500, success: false };
  }

  return { alreadyAuthorized: false, success: true };
}

export async function verifyEmailChange(
  userId: number,
  code: string
): Promise<{ error?: string; status?: number; success: boolean; token?: string }> {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return { error: 'El código de verificación es obligatorio.', status: 400, success: false };
  }

  const result = await verifyEmailChangeCode(userId, code.trim());
  if (!result.success || !result.token) {
    return { error: result.error || 'Código incorrecto o expirado.', status: 400, success: false };
  }

  return { success: true, token: result.token };
}

export async function updateEmail(
  userId: number,
  newEmail: string,
  ip?: string | null,
  ua?: string | null
): Promise<{ email?: string; error?: string; status?: number; success: boolean }> {
  const authValidation = await consumeEmailChangeAuthorization(userId);
  if (!authValidation.valid) {
    return {
      error: authValidation.error || 'La autorización de 5 minutos para cambiar de correo ha expirado.',
      status: 403,
      success: false,
    };
  }

  const validation = validateEmail(newEmail);
  if (!validation.valid) {
    return { error: validation.error, status: 400, success: false };
  }

  const cleanEmail = newEmail.toLowerCase().trim();
  const user = await findUserById(userId);
  if (!user) {
    return { error: 'Usuario no encontrado.', status: 404, success: false };
  }

  const oldEmail = user.email;
  if (oldEmail.toLowerCase() === cleanEmail) {
    return { email: oldEmail, success: true };
  }

  const pool = getDbPool();
  const [existingRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
    [cleanEmail, userId]
  );

  if (existingRows.length > 0) {
    return { error: 'El correo electrónico ya está registrado.', status: 409, success: false };
  }

  await updateUserEmailInDb(userId, cleanEmail);
  await logUserAudit(userId, 'update_email', oldEmail, cleanEmail, ip, ua);

  return { email: cleanEmail, success: true };
}

export async function getPasswordStatus(
  userId: number
): Promise<{ hasGoogle: boolean; hasPassword: boolean }> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) {
    return { hasGoogle: false, hasPassword: false };
  }
  return {
    hasGoogle: false,
    hasPassword: Boolean(rows[0].password_hash),
  };
}

export async function verifyCurrentPassword(
  userId: number,
  currentPassword: string
): Promise<{ error?: string; status?: number; success: boolean }> {
  if (!currentPassword || typeof currentPassword !== 'string' || !currentPassword.trim()) {
    return { error: 'Por favor ingresa tu contraseña actual.', status: 400, success: false };
  }

  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, password_hash FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (rows.length === 0) {
    return { error: 'Usuario no encontrado.', status: 404, success: false };
  }

  const user = rows[0];

  if (!user.password_hash) {
    return {
      error: 'Esta cuenta no tiene una contraseña configurada.',
      status: 400,
      success: false,
    };
  }

  const isMatch = await verifyPassword(currentPassword, user.password_hash);
  if (!isMatch) {
    logger.security.warn('Fallo de verificación de contraseña actual en settings', { userId });
    return { error: 'La contraseña actual es incorrecta.', status: 400, success: false };
  }

  await savePasswordChangeAuth(userId, 300);
  logger.security.info('Contraseña actual verificada exitosamente para cambio de contraseña', { userId });

  return { success: true };
}

export async function updateUserPasswordFromSettings(
  userId: number,
  newPassword: string,
  ip?: string | null,
  ua?: string | null
): Promise<{ error?: string; status?: number; success: boolean }> {
  const authValidation = await consumePasswordChangeAuth(userId);
  if (!authValidation.valid) {
    return {
      error: authValidation.error || 'La autorización de 5 minutos para cambiar la contraseña ha expirado. Por favor confirma tu contraseña actual de nuevo.',
      status: 403,
      success: false,
    };
  }

  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return { error: validation.error, status: 400, success: false };
  }

  const pool = getDbPool();
  const [userRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, password_hash FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (userRows.length === 0) {
    return { error: 'Usuario no encontrado.', status: 404, success: false };
  }

  if (userRows[0].password_hash) {
    const isSame = await verifyPassword(newPassword, userRows[0].password_hash);
    if (isSame) {
      return { error: 'La nueva contraseña no puede ser igual a la actual.', status: 400, success: false };
    }
  }

  const hashedPassword = await hashPassword(newPassword);
  await updateUserPasswordInDb(userId, hashedPassword);
  await logUserAudit(userId, 'change_password', null, null, ip, ua);
  logger.security.info('Contraseña actualizada exitosamente desde settings', { userId });

  return { success: true };
}

export async function getUserPreferences(userId: number) {
  return await getUserPrefsFromDb(userId);
}

export async function updateUserPreferences(userId: number, updates: Record<string, any>) {
  return await updateUserPrefsInDb(userId, updates);
}

export async function deleteUserAccount(userId: number): Promise<boolean> {
  return await deleteUserPermanentlyInDb(userId);
}
