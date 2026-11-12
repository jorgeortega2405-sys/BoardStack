import { getDbPool } from '../config/database.config.js';
import { UserPayload } from '../types/auth.types.js';
import { cacheService } from './cache.service.js';
import { decryptAtRest, encryptAtRest } from './crypto.service.js';
import { logger } from './logger.service.js';
import { hashBackupCode } from './two-factor.service.js';
import fs from 'fs';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import path from 'path';

interface UserRecord extends RowDataPacket {
  ai_tokens_balance?: number;
  ai_tokens_reset_at?: Date;
  avatar_url?: string | null;
  created_at?: Date;
  email: string;
  google_email?: string | null;
  google_id?: string | null;
  id: number;
  last_login_at?: Date | null;
  last_login_ip?: string | null;
  password_hash?: string;
  registration_ip?: string | null;
  subscription_status?: string;
  subscription_tier?: string;
  two_factor_enabled?: boolean | number;
  two_factor_recovery_codes?: string | null;
  two_factor_secret?: string | null;
  updated_at?: Date;
  username: string;
}

interface UserPreferencesRecord extends RowDataPacket {
  language: string;
  theme: string;
  updated_at?: Date;
  user_id: number;
}

interface UserPreferences {
  language: string;
  theme: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'es',
  theme: 'system',
};

async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, password_hash, avatar_url, subscription_tier, two_factor_enabled, ai_tokens_balance, ai_tokens_reset_at, google_id, google_email FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, avatar_url, subscription_tier, two_factor_enabled, ai_tokens_balance, ai_tokens_reset_at FROM users WHERE username = ? LIMIT 1',
    [username.trim()]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

async function findUserById(id: number): Promise<UserRecord | null> {
  const cacheKey = cacheService.CACHE_KEYS.userProfile(String(id));
  try {
    const cached = await cacheService.get<UserRecord>(cacheKey);
    if (cached) {
      return cached;
    }
  } catch {}

  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, password_hash, avatar_url, subscription_tier, subscription_status, two_factor_enabled, ai_tokens_balance, ai_tokens_reset_at, created_at, google_id, google_email FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  try {
    await cacheService.set(cacheKey, user, 300);
  } catch {}
  return user;
}

async function findUserByGoogleId(googleId: string): Promise<UserRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, password_hash, avatar_url, subscription_tier, two_factor_enabled, ai_tokens_balance, ai_tokens_reset_at, created_at, google_id, google_email FROM users WHERE google_id = ? LIMIT 1',
    [googleId]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

async function linkGoogleAccount(userId: number, googleId: string, googleEmail: string): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET google_id = ?, google_email = ? WHERE id = ?',
    [googleId, googleEmail.toLowerCase().trim(), userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

async function unlinkGoogleAccount(userId: number): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET google_id = NULL, google_email = NULL WHERE id = ?',
    [userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

async function generateUniqueUsername(preferred: string): Promise<string> {
  const pool = getDbPool();
  let base = preferred.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  if (base.length < 3) base = `user_${base}`;
  let candidate = base;
  let counter = 1;
  while (true) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ? LIMIT 1', [candidate]);
    if (rows.length === 0) return candidate;
    candidate = `${base.slice(0, 15)}_${counter}`;
    counter++;
  }
}

async function invalidateUserProfileCache(userId: number): Promise<void> {
  try {
    await cacheService.invalidateUser(String(userId));
  } catch {}
}

async function findUserDuplicates(
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

async function createUser(data: {
  avatarUrl?: string | null;
  email: string;
  googleEmail?: string | null;
  googleId?: string | null;
  passwordHash?: string | null;
  registrationIp?: string | null;
  username: string;
}): Promise<UserPayload> {
  const pool = getDbPool();

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (
      username,
      email,
      password_hash,
      google_id,
      google_email,
      avatar_url,
      registration_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.username.trim(),
      data.email.toLowerCase().trim(),
      data.passwordHash || null,
      data.googleId || null,
      data.googleEmail || null,
      data.avatarUrl || null,
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
    google_connected: Boolean(data.googleId),
    google_email: data.googleEmail || null,
    has_password: Boolean(data.passwordHash),
    id: userId,
    subscription_tier: 'free',
    two_factor_enabled: false,
    username: data.username.trim(),
  };
}

async function updateUserLastLogin(userId: number, ip?: string | null): Promise<void> {
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

async function updateUserAvatar(userId: number, avatarUrl: string | null): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET avatar_url = ? WHERE id = ?',
    [avatarUrl, userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

async function updateUsername(userId: number, username: string): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET username = ? WHERE id = ?',
    [username.trim(), userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

async function updateUserEmail(userId: number, email: string): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET email = ? WHERE id = ?',
    [email.toLowerCase().trim(), userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

async function updateUserPassword(userId: number, passwordHash: string): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

async function getUser2FASecret(userId: number): Promise<{ two_factor_recovery_codes: string | null; two_factor_secret: string | null } | null> {
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

async function enableUser2FA(
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

async function disableUser2FA(userId: number): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, two_factor_recovery_codes = NULL WHERE id = ?',
    [userId]
  );
  await invalidateUserProfileCache(userId);
  return result.affectedRows > 0;
}

async function verifyAndConsumeBackupCode(userId: number, code: string): Promise<boolean> {
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

async function getUserPreferences(userId: number): Promise<UserPreferences> {
  const cacheKey = cacheService.CACHE_KEYS.userPrefs(String(userId));
  try {
    const cached = await cacheService.get<UserPreferences>(cacheKey);
    if (cached) {
      return cached;
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
      await cacheService.set(cacheKey, DEFAULT_PREFERENCES, 86400);
    } catch {}
    return DEFAULT_PREFERENCES;
  }

  const prefs: UserPreferences = {
    language: rows[0].language || DEFAULT_PREFERENCES.language,
    theme: rows[0].theme || DEFAULT_PREFERENCES.theme,
  };

  try {
    await cacheService.set(cacheKey, prefs, 86400);
  } catch {}

  return prefs;
}

async function updateUserPreferences(
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
    await cacheService.invalidateUserPrefs(String(userId));
  } catch {}

  return next;
}

async function deleteUserPermanently(userId: number): Promise<boolean> {
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
    await cacheService.del(`2fa:setup:${userId}`);
    await cacheService.invalidateUser(String(userId));
    await cacheService.invalidateUserPrefs(String(userId));
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

export { createUser, deleteUserPermanently, disableUser2FA, enableUser2FA, findUserByEmail, findUserByGoogleId, findUserById, findUserByUsername, findUserDuplicates, generateUniqueUsername, getUser2FASecret, getUserPreferences, invalidateUserProfileCache, linkGoogleAccount, unlinkGoogleAccount, updateUserAvatar, updateUserEmail, updateUserLastLogin, updateUserPassword, updateUserPreferences, updateUsername, verifyAndConsumeBackupCode };
export type { UserPreferences, UserPreferencesRecord, UserRecord };
