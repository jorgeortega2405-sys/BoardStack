import { appPool, corePool } from '../config/database.config.js';
import { getRedisClient } from '../config/redis.config.js';
import { hashBackupCode } from './two-factor.service.js';
import { normalizeSubscriptionTier } from '../utils/user.util.js';
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
  subscription_tier?: string;
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

async function getUserSubscriptionTier(userId: number): Promise<string> {
  const [rows] = await appPool.execute<RowDataPacket[]>(
    'SELECT subscription_tier FROM app_user_profiles WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return normalizeSubscriptionTier(rows[0]?.subscription_tier);
}

async function getUserSubscriptionTiers(userIds: number[]): Promise<Map<number, string>> {
  const tierMap = new Map<number, string>();
  const uniqueIds = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) {
    return tierMap;
  }

  const placeholders = uniqueIds.map(() => '?').join(', ');
  const [rows] = await appPool.execute<RowDataPacket[]>(
    `SELECT user_id, subscription_tier FROM app_user_profiles WHERE user_id IN (${placeholders})`,
    uniqueIds
  );

  for (const row of rows) {
    tierMap.set(Number(row.user_id), normalizeSubscriptionTier(row.subscription_tier));
  }
  return tierMap;
}

async function findUserByEmail(email: string): Promise<CoreUserRow | null> {
  const [rows] = await corePool.execute<CoreUserRow[]>(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  const row = rows[0] || null;
  if (!row) return null;
  row.subscription_tier = await getUserSubscriptionTier(Number(row.id));
  return row;
}

async function findUserById(id: number): Promise<CoreUserRow | null> {
  const [rows] = await corePool.execute<CoreUserRow[]>(
    'SELECT * FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  const row = rows[0] || null;
  if (!row) return null;
  row.subscription_tier = await getUserSubscriptionTier(Number(row.id));
  return row;
}

async function findUsersByIds(ids: number[]): Promise<CoreUserRow[]> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) {
    return [];
  }

  const placeholders = uniqueIds.map(() => '?').join(', ');
  const [[rows], tierMap] = await Promise.all([
    corePool.execute<CoreUserRow[]>(
      `SELECT * FROM users WHERE id IN (${placeholders})`,
      uniqueIds
    ),
    getUserSubscriptionTiers(uniqueIds),
  ]);

  return rows.map((row) => {
    row.subscription_tier = tierMap.get(Number(row.id)) || 'free';
    return row;
  });
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

async function revokeAdminSessions(userId: number): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(`admin:session_revoked:${userId}`, Date.now(), 'EX', 7 * 24 * 3600);
  } catch {}
}

async function getRevokedAtMap(userIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  const uniqueIds = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) {
    return result;
  }

  for (const id of uniqueIds) {
    result.set(id, 0);
  }

  try {
    const redis = getRedisClient();
    const keys: string[] = [];
    for (const id of uniqueIds) {
      keys.push(`user:session_revoked:${id}`, `admin:session_revoked:${id}`);
    }
    const values = await redis.mget(...keys);
    for (let i = 0; i < uniqueIds.length; i++) {
      const uid = uniqueIds[i];
      const userRevoked = Number(values[i * 2] || 0) || 0;
      const adminRevoked = Number(values[i * 2 + 1] || 0) || 0;
      result.set(uid, Math.max(userRevoked, adminRevoked));
    }
  } catch {}

  return result;
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
  findUsersByIds,
  getRevokedAtMap,
  getUser2FASecret,
  getUserPreferences,
  getUserSubscriptionTier,
  getUserSubscriptionTiers,
  revokeAdminSessions,
  revokeUserSessions,
  updateUserLastLogin,
  updateUserPreferences,
  verifyAndConsumeBackupCode
};

export type {
  CoreUserRow,
  UserPreferences
};
