import { getDbPool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { UserPayload } from '../types/auth.types.js';
import { decryptAtRest, encryptAtRest } from './crypto.service.js';
import { logger } from './logger.service.js';
import { hashBackupCode } from './two-factor.service.js';
import fs from 'fs';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import path from 'path';

export interface UserRecord extends RowDataPacket {
  avatar_url?: string | null;
  created_at?: Date;
  email: string;
  id: number;
  last_login_at?: Date | null;
  last_login_ip?: string | null;
  password_hash?: string;
  registration_ip?: string | null;
  role?: string;
  roles?: string[];
  subscription_tier?: string;
  two_factor_enabled?: boolean | number;
  two_factor_recovery_codes?: string | null;
  two_factor_secret?: string | null;
  updated_at?: Date;
  username: string;
}

export interface UserPreferencesRecord extends RowDataPacket {
  language: string;
  theme: string;
  updated_at?: Date;
  user_id: number;
}

export interface UserPreferences {
  language: string;
  theme: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'es',
  theme: 'system',
};

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, password_hash, avatar_url, role, subscription_tier, two_factor_enabled FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  user.roles = [user.role || 'USER'];
  return user;
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, avatar_url, role, subscription_tier, two_factor_enabled FROM users WHERE username = ? LIMIT 1',
    [username.trim()]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  user.roles = [user.role || 'USER'];
  return user;
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const cacheKey = `user:profile:${id}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as UserRecord;
    }
  } catch {}

  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, password_hash, avatar_url, role, subscription_tier, two_factor_enabled, created_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  user.roles = [user.role || 'USER'];
  try {
    await redis.setex(cacheKey, 300, JSON.stringify(user));
  } catch {}
  return user;
}

export async function invalidateUserProfileCache(userId: number): Promise<void> {
  try {
    await redis.del(`user:profile:${userId}`);
  } catch {}
}

export async function findUserDuplicates(
  email: string,
  username: string
): Promise<{ emailExists: boolean; usernameExists: boolean }> {
  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT email, username FROM users WHERE email = ? OR username = ? LIMIT 2',
    [email.toLowerCase().trim(), username.trim()]
  );

  const emailExists = rows.some((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  const usernameExists = rows.some((u) => u.username.toLowerCase() === username.toLowerCase().trim());

  return { emailExists, usernameExists };
}

export async function createUser(data: {
  avatarUrl?: string;
  email: string;
  passwordHash: string;
  registrationIp?: string | null;
  role?: string;
  username: string;
}): Promise<UserPayload> {
  const pool = getDbPool();
  const role = data.role || 'USER';

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (
      username,
      email,
      password_hash,
      avatar_url,
      role,
      registration_ip
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.username.trim(),
      data.email.toLowerCase().trim(),
      data.passwordHash,
      data.avatarUrl || null,
      role,
      data.registrationIp || null,
    ]
  );

  const userId = result.insertId;

  try {
    await pool.query(
      'INSERT INTO user_preferences (user_id, theme, language) VALUES (?, ?, ?)',
      [userId, 'system', 'es']
    );
  } catch (err) {
    logger.db.warn('No se pudieron crear las preferencias iniciales del usuario', err);
  }

  return {
    avatar_url: data.avatarUrl || null,
    email: data.email.toLowerCase().trim(),
    id: userId,
    role,
    roles: [role],
    subscription_tier: 'free',
    two_factor_enabled: false,
    username: data.username.trim(),
  };
}

export async function updateUserLastLogin(userId: number, ip?: string | null): Promise<void> {
  try {
    const pool = getDbPool();
    await pool.query(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
      [ip || null, userId]
    );
  } catch (err) {
    logger.db.warn('Error al actualizar último inicio de sesión', err);
  }
}

export async function updateUserAvatar(userId: number, avatarUrl: string | null): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET avatar_url = ? WHERE id = ?',
    [avatarUrl, userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

export async function updateUsername(userId: number, username: string): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET username = ? WHERE id = ?',
    [username.trim(), userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

export async function updateUserEmail(userId: number, email: string): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET email = ? WHERE id = ?',
    [email.toLowerCase().trim(), userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

export async function updateUserPassword(userId: number, passwordHash: string): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

export async function getUser2FASecret(userId: number): Promise<{ two_factor_recovery_codes: string | null; two_factor_secret: string | null } | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT two_factor_secret, two_factor_recovery_codes FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as { two_factor_recovery_codes: string | null; two_factor_secret: string | null };
  return {
    two_factor_recovery_codes: row.two_factor_recovery_codes ? decryptAtRest(row.two_factor_recovery_codes) : null,
    two_factor_secret: row.two_factor_secret ? decryptAtRest(row.two_factor_secret) : null,
  };
}

export async function enableUser2FA(
  userId: number,
  secret: string,
  backupCodes: string[]
): Promise<boolean> {
  const pool = getDbPool();
  const hashedCodes = backupCodes.map((code) => hashBackupCode(code));
  const encryptedSecret = encryptAtRest(secret);
  const encryptedCodes = encryptAtRest(JSON.stringify(hashedCodes));
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = TRUE, two_factor_secret = ?, two_factor_recovery_codes = ? WHERE id = ?',
    [encryptedSecret, encryptedCodes, userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

export async function disableUser2FA(userId: number): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, two_factor_recovery_codes = NULL WHERE id = ?',
    [userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

export async function verifyAndConsumeBackupCode(userId: number, code: string): Promise<boolean> {
  const twoFactorData = await getUser2FASecret(userId);
  if (!twoFactorData || !twoFactorData.two_factor_recovery_codes) {
    return false;
  }

  let codes: string[] = [];
  try {
    codes = JSON.parse(twoFactorData.two_factor_recovery_codes) as string[];
  } catch {
    return false;
  }

  const targetHash = hashBackupCode(code);
  const codeIndex = codes.indexOf(targetHash);
  if (codeIndex === -1) {
    return false;
  }

  codes.splice(codeIndex, 1);

  const encryptedCodes = encryptAtRest(JSON.stringify(codes));
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_recovery_codes = ? WHERE id = ?',
    [encryptedCodes, userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

export async function getUserPreferences(userId: number): Promise<UserPreferences> {
  const cacheKey = `user:prefs:${userId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as UserPreferences;
    }
  } catch {}

  const pool = getDbPool();
  const [rows] = await pool.query<UserPreferencesRecord[]>(
    'SELECT theme, language FROM user_preferences WHERE user_id = ? LIMIT 1',
    [userId]
  );

  if (rows.length === 0) {
    await pool.query(
      'INSERT INTO user_preferences (user_id, theme, language) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_id = user_id',
      [userId, DEFAULT_PREFERENCES.theme, DEFAULT_PREFERENCES.language]
    );
    try {
      await redis.setex(cacheKey, 86400, JSON.stringify(DEFAULT_PREFERENCES));
    } catch {}
    return DEFAULT_PREFERENCES;
  }

  const prefs: UserPreferences = {
    language: rows[0].language || DEFAULT_PREFERENCES.language,
    theme: rows[0].theme || DEFAULT_PREFERENCES.theme,
  };

  try {
    await redis.setex(cacheKey, 86400, JSON.stringify(prefs));
  } catch {}

  return prefs;
}

export async function updateUserPreferences(
  userId: number,
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getUserPreferences(userId);
  const next: UserPreferences = {
    language: updates.language !== undefined ? String(updates.language).trim() : current.language,
    theme: updates.theme !== undefined ? String(updates.theme).toLowerCase() : current.theme,
  };

  const pool = getDbPool();
  await pool.query(
    `INSERT INTO user_preferences (user_id, theme, language)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       theme = VALUES(theme),
       language = VALUES(language)`,
    [userId, next.theme, next.language]
  );

  try {
    await redis.del(`user:prefs:${userId}`);
  } catch {}

  return next;
}

export async function deleteUserPermanently(userId: number): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user) {
    return false;
  }

  if (user.avatar_url && user.avatar_url.startsWith('/uploads/avatars/')) {
    try {
      const fileName = path.basename(user.avatar_url);
      const localPath = path.join(process.cwd(), 'public', 'uploads', 'avatars', fileName);
      if (fs.existsSync(localPath)) {
        await fs.promises.unlink(localPath);
      }
    } catch (err) {
      logger.app.warn('No se pudo eliminar archivo local de avatar', err);
    }
  }

  try {
    await redis.del(`2fa:setup:${userId}`);
    await redis.del(`user:profile:${userId}`);
    await redis.del(`user:prefs:${userId}`);
  } catch {}

  const pool = getDbPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM user_audit_logs WHERE user_id = ?', [userId]);
    const [result] = await connection.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId]);

    await connection.commit();
    logger.security.info('Usuario eliminado permanentemente de la base de datos', { userId });
    return result.affectedRows > 0;
  } catch (err) {
    await connection.rollback();
    logger.db.error('Error en transacción al eliminar usuario', err);
    throw err;
  } finally {
    connection.release();
  }
}
