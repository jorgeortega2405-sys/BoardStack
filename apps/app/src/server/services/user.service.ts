import crypto from 'crypto';
import { ensureDefaultUserRole } from './role.service.js';
import { getRedisClient } from '../config/redis.config.js';
import { hashBackupCode } from './two-factor.service.js';
import { pool } from '../config/database.config.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { verifyPassword } from './auth.service.js';

interface UserRow extends RowDataPacket {
  ai_tokens_balance: number;
  avatar_url: string | null;
  created_at: string;
  email: string;
  google_email: string | null;
  google_id: string | null;
  id: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  password_hash: string | null;
  registration_ip: string | null;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  subscription_status: string;
  subscription_tier: string;
  two_factor_enabled: number;
  updated_at: string;
  username: string;
  uuid: string;
}

interface UserPreferences {
  extended_alerts: boolean;
  high_contrast: boolean;
  language: string;
  reduce_motion: boolean;
  theme: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  extended_alerts: false,
  high_contrast: false,
  language: 'es',
  reduce_motion: false,
  theme: 'light',
};

async function invalidateUserCache(userId: number): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(`user:cache:${userId}`);
  } catch {}
}

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  return rows[0] || null;
}

async function findUserById(id: number): Promise<UserRow | null> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT * FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function findUserByGoogleId(googleId: string): Promise<UserRow | null> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT * FROM users WHERE google_id = ? LIMIT 1',
    [googleId]
  );
  return rows[0] || null;
}

async function findUserDuplicates(
  email: string,
  username: string
): Promise<{ emailExists: boolean; usernameExists: boolean }> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT email, username FROM users WHERE email = ? OR username = ? LIMIT 2',
    [email.toLowerCase().trim(), username.trim()]
  );

  let emailExists = false;
  let usernameExists = false;
  for (const row of rows) {
    if (row.email.toLowerCase() === email.toLowerCase().trim()) {
      emailExists = true;
    }
    if (row.username.toLowerCase() === username.trim().toLowerCase()) {
      usernameExists = true;
    }
  }

  return { emailExists, usernameExists };
}

async function createUser(params: {
  avatarUrl?: string | null;
  email: string;
  googleEmail?: string | null;
  googleId?: string | null;
  passwordHash?: string | null;
  registrationIp?: string | null;
  username: string;
}): Promise<UserRow> {
  const uuid = crypto.randomUUID();
  const cleanEmail = params.email.toLowerCase().trim();
  const cleanUsername = params.username.trim();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users (uuid, username, email, password_hash, google_id, google_email, avatar_url, registration_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        cleanUsername,
        cleanEmail,
        params.passwordHash || null,
        params.googleId || null,
        params.googleEmail || null,
        params.avatarUrl || null,
        params.registrationIp || null,
      ]
    );

    const newUserId = result.insertId;

    await conn.execute(
      `INSERT IGNORE INTO user_roles (user_id, role_id)
       SELECT ?, id FROM roles WHERE is_default = TRUE LIMIT 1`,
      [newUserId]
    );

    await conn.execute(
      `INSERT INTO user_preferences (user_id, theme, language, reduce_motion, high_contrast, extended_alerts)
       VALUES (?, 'light', 'es', FALSE, FALSE, FALSE)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [newUserId]
    );

    const [rows] = await conn.execute<UserRow[]>(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [newUserId]
    );

    await conn.commit();

    if (!rows[0]) {
      throw new Error('Failed to retrieve newly created user.');
    }
    return rows[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateUserPassword(
  userId: number,
  passwordHash: string
): Promise<void> {
  await pool.execute(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, userId]
  );
  await invalidateUserCache(userId);
}

async function linkGoogleAccount(
  userId: number,
  googleId: string,
  googleEmail: string
): Promise<void> {
  await pool.execute(
    'UPDATE users SET google_id = ?, google_email = ? WHERE id = ?',
    [googleId, googleEmail.toLowerCase().trim(), userId]
  );
  await invalidateUserCache(userId);
}

async function unlinkGoogleAccount(userId: number): Promise<void> {
  await pool.execute(
    'UPDATE users SET google_id = NULL, google_email = NULL WHERE id = ?',
    [userId]
  );
  await invalidateUserCache(userId);
}

async function updateUserLastLogin(
  userId: number,
  ip: string
): Promise<void> {
  await pool.execute(
    'UPDATE users SET last_login_ip = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
    [ip, userId]
  );
}

async function generateUniqueUsername(preferred: string): Promise<string> {
  let base = preferred.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  if (!base || base.length < 3) {
    base = 'user';
  }

  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT username FROM users WHERE username = ? OR username LIKE ? LIMIT 50',
    [base, `${base}%`]
  );

  const existingSet = new Set(existing.map((r) => String(r.username).toLowerCase()));
  if (!existingSet.has(base)) {
    return base;
  }

  let counter = 1;
  while (true) {
    const suffix = String(counter);
    const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
    counter++;
  }
}

async function updateUsername(userId: number, newUsername: string): Promise<boolean> {
  const clean = newUsername.trim();
  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
    [clean, userId]
  );
  if (existing.length > 0) {
    return false;
  }
  await pool.execute('UPDATE users SET username = ? WHERE id = ?', [clean, userId]);
  await invalidateUserCache(userId);
  return true;
}

async function updateUserEmail(userId: number, newEmail: string): Promise<boolean> {
  const clean = newEmail.toLowerCase().trim();
  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
    [clean, userId]
  );
  if (existing.length > 0) {
    return false;
  }
  await pool.execute('UPDATE users SET email = ? WHERE id = ?', [clean, userId]);
  await invalidateUserCache(userId);
  return true;
}

async function updateUserAvatar(userId: number, avatarUrl: string | null): Promise<void> {
  await pool.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
  await invalidateUserCache(userId);
}

async function deleteUserPermanently(userId: number): Promise<boolean> {
  await invalidateUserCache(userId);
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId]);
  return result.affectedRows > 0;
}

async function getUserPreferences(userId: number): Promise<UserPreferences> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT theme, language, reduce_motion, high_contrast, extended_alerts FROM user_preferences WHERE user_id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) {
    await pool.execute(
      `INSERT INTO user_preferences (user_id, theme, language, reduce_motion, high_contrast, extended_alerts)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [
        userId,
        DEFAULT_PREFERENCES.theme,
        DEFAULT_PREFERENCES.language,
        DEFAULT_PREFERENCES.reduce_motion,
        DEFAULT_PREFERENCES.high_contrast,
        DEFAULT_PREFERENCES.extended_alerts,
      ]
    );
    return { ...DEFAULT_PREFERENCES };
  }
  const row = rows[0];
  return {
    extended_alerts: Boolean(row.extended_alerts),
    high_contrast: Boolean(row.high_contrast),
    language: row.language || DEFAULT_PREFERENCES.language,
    reduce_motion: Boolean(row.reduce_motion),
    theme: row.theme || DEFAULT_PREFERENCES.theme,
  };
}

async function updateUserPreferences(
  userId: number,
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getUserPreferences(userId);
  const next: UserPreferences = {
    extended_alerts: updates.extended_alerts !== undefined ? Boolean(updates.extended_alerts) : current.extended_alerts,
    high_contrast: updates.high_contrast !== undefined ? Boolean(updates.high_contrast) : current.high_contrast,
    language: updates.language !== undefined ? String(updates.language).trim() : current.language,
    reduce_motion: updates.reduce_motion !== undefined ? Boolean(updates.reduce_motion) : current.reduce_motion,
    theme: updates.theme !== undefined ? String(updates.theme).toLowerCase() : current.theme,
  };

  await pool.execute(
    `INSERT INTO user_preferences (user_id, theme, language, reduce_motion, high_contrast, extended_alerts)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       theme = VALUES(theme),
       language = VALUES(language),
       reduce_motion = VALUES(reduce_motion),
       high_contrast = VALUES(high_contrast),
       extended_alerts = VALUES(extended_alerts)`,
    [
      userId,
      next.theme,
      next.language,
      next.reduce_motion,
      next.high_contrast,
      next.extended_alerts,
    ]
  );

  return next;
}

async function enableUser2FA(userId: number, secret: string, backupCodes: string[]): Promise<boolean> {
  const hashedCodes = backupCodes.map(hashBackupCode);
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = 1, two_factor_secret = ?, two_factor_recovery_codes = ? WHERE id = ?',
    [secret, JSON.stringify(hashedCodes), userId]
  );
  await invalidateUserCache(userId);
  return result.affectedRows > 0;
}

async function disableUser2FA(userId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_recovery_codes = NULL WHERE id = ?',
    [userId]
  );
  await invalidateUserCache(userId);
  return result.affectedRows > 0;
}

async function getUser2FASecret(userId: number): Promise<{
  two_factor_enabled: boolean;
  two_factor_recovery_codes: string | null;
  two_factor_secret: string | null;
} | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT two_factor_enabled, two_factor_secret, two_factor_recovery_codes FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) return null;
  return {
    two_factor_enabled: Boolean(rows[0].two_factor_enabled),
    two_factor_recovery_codes: rows[0].two_factor_recovery_codes || null,
    two_factor_secret: rows[0].two_factor_secret || null,
  };
}

async function verifyAndConsumeBackupCode(userId: number, inputCode: string): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT two_factor_recovery_codes FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );

    if (rows.length === 0 || !rows[0].two_factor_recovery_codes) {
      await conn.rollback();
      return false;
    }

    let codes: string[] = [];
    try {
      codes = JSON.parse(rows[0].two_factor_recovery_codes);
    } catch {
      await conn.rollback();
      return false;
    }

    const hashed = hashBackupCode(inputCode);
    const index = codes.indexOf(hashed);
    if (index === -1) {
      await conn.rollback();
      return false;
    }

    codes.splice(index, 1);
    await conn.execute(
      'UPDATE users SET two_factor_recovery_codes = ? WHERE id = ?',
      [JSON.stringify(codes), userId]
    );

    await conn.commit();
    await invalidateUserCache(userId);
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function verifyCurrentPassword(
  userId: number,
  password: string
): Promise<{ error?: string; hasPassword: boolean; success: boolean }> {
  const user = await findUserById(userId);
  if (!user) {
    return { error: 'User not found.', hasPassword: false, success: false };
  }
  if (!user.password_hash) {
    return { hasPassword: false, success: true };
  }
  const isMatch = await verifyPassword(password, user.password_hash);
  if (!isMatch) {
    return { error: 'Incorrect current password.', hasPassword: true, success: false };
  }
  return { hasPassword: true, success: true };
}

export {
  DEFAULT_PREFERENCES,
  createUser,
  deleteUserPermanently,
  disableUser2FA,
  enableUser2FA,
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  findUserDuplicates,
  generateUniqueUsername,
  getUser2FASecret,
  getUserPreferences,
  invalidateUserCache,
  linkGoogleAccount,
  unlinkGoogleAccount,
  updateUserAvatar,
  updateUserEmail,
  updateUserLastLogin,
  updateUserPassword,
  updateUserPreferences,
  updateUsername,
  verifyAndConsumeBackupCode,
  verifyCurrentPassword
};

export type {
  UserPreferences,
  UserRow
};
