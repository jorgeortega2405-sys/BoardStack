import { corePool } from '../config/database.config.js';
import { getRedisClient } from '../config/redis.config.js';
import { hashBackupCode } from './two-factor.service.js';
import type { RowDataPacket } from 'mysql2';

interface CoreUserRow extends RowDataPacket {
  avatar_url: string | null;
  created_at: string;
  email: string;
  id: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  password_hash: string | null;
  status: 'active' | 'deleted' | 'suspended';
  two_factor_enabled: number;
  two_factor_recovery_codes: string | null;
  two_factor_secret: string | null;
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

async function findUserByEmail(email: string): Promise<CoreUserRow | null> {
  const [rows] = await corePool.execute<CoreUserRow[]>(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  return rows[0] || null;
}

async function findUserById(id: number): Promise<CoreUserRow | null> {
  const [rows] = await corePool.execute<CoreUserRow[]>(
    'SELECT * FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function updateUserLastLogin(userId: number, ip: string): Promise<void> {
  await corePool.execute(
    'UPDATE users SET last_login_ip = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
    [ip, userId]
  );
}

async function revokeUserSessions(userId: number): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(`user:session_revoked:${userId}`, Date.now(), 'EX', 7 * 24 * 3600);
  } catch {}
}

async function getUser2FASecret(userId: number): Promise<{
  two_factor_enabled: boolean;
  two_factor_recovery_codes: string | null;
  two_factor_secret: string | null;
} | null> {
  const [rows] = await corePool.execute<RowDataPacket[]>(
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
  const conn = await corePool.getConnection();
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
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getUserPreferences(userId: number): Promise<UserPreferences> {
  const [rows] = await corePool.execute<RowDataPacket[]>(
    'SELECT theme, language, reduce_motion, high_contrast, extended_alerts FROM user_preferences WHERE user_id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) {
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

  await corePool.execute(
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

export {
  DEFAULT_PREFERENCES,
  findUserByEmail,
  findUserById,
  getUser2FASecret,
  getUserPreferences,
  revokeUserSessions,
  updateUserLastLogin,
  updateUserPreferences,
  verifyAndConsumeBackupCode
};

export type {
  CoreUserRow,
  UserPreferences
};
