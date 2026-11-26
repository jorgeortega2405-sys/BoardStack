import { config } from '../config/env.config.js';
import { corePool, pool } from '../config/database.config.js';
import crypto from 'crypto';
import { getRedisClient } from '../config/redis.config.js';
import { getUserRolesAndPermissions } from './role.service.js';
import { hashBackupCode } from './two-factor.service.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { sanitizeUser } from '../utils/user.util.js';
import type { UserPayload } from '../types/auth.types.js';
import { verifyPassword } from './auth.service.js';

interface CoreUserRow extends RowDataPacket {
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
  status: 'active' | 'deleted' | 'suspended';
  two_factor_enabled: number;
  updated_at: string;
  username: string;
  uuid: string;
}

interface AppUserProfileRow extends RowDataPacket {
  ai_tokens_balance: number;
  cancel_at_period_end: number;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_period_end: string | null;
  subscription_status: string;
  subscription_tier: string;
  user_id: number;
}

interface UserRow extends CoreUserRow {
  ai_tokens_balance: number;
  cancel_at_period_end: number;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_period_end: string | null;
  subscription_status: string;
  subscription_tier: string;
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

const DEFAULT_STORAGE_LIMIT_BYTES = 5368709120;

async function ensureAppUserProfile(userId: number): Promise<void> {
  await pool.execute(
    'INSERT IGNORE INTO app_user_profiles (user_id) VALUES (?)',
    [userId]
  );
}

async function getAppUserProfile(userId: number): Promise<AppUserProfileRow | null> {
  const [rows] = await pool.execute<AppUserProfileRow[]>(
    'SELECT * FROM app_user_profiles WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

async function attachAppProfile(coreRow: CoreUserRow | null): Promise<UserRow | null> {
  if (!coreRow) return null;
  const profile = await getAppUserProfile(coreRow.id);
  return {
    ...coreRow,
    ai_tokens_balance: profile ? Number(profile.ai_tokens_balance) : 100,
    cancel_at_period_end: profile ? Number(profile.cancel_at_period_end) : 0,
    storage_limit_bytes: profile ? Number(profile.storage_limit_bytes) : DEFAULT_STORAGE_LIMIT_BYTES,
    storage_used_bytes: profile ? Number(profile.storage_used_bytes) : 0,
    stripe_customer_id: profile?.stripe_customer_id || null,
    stripe_subscription_id: profile?.stripe_subscription_id || null,
    subscription_period_end: profile?.subscription_period_end || null,
    subscription_status: profile?.subscription_status || 'inactive',
    subscription_tier: profile?.subscription_tier || 'free',
  };
}

async function hasUserAppMembership(userId: number, appSlug: string = config.appSlug): Promise<boolean> {
  const [rows] = await corePool.execute<RowDataPacket[]>(
    `SELECT ua.id
     FROM user_apps ua
     INNER JOIN apps a ON a.id = ua.app_id
     WHERE ua.user_id = ? AND a.slug = ? AND a.is_active = TRUE AND ua.status = 'active'
     LIMIT 1`,
    [userId, appSlug.trim().toLowerCase()]
  );
  return rows.length > 0;
}

async function ensureUserAppMembership(userId: number, appSlug: string = config.appSlug): Promise<void> {
  const cleanSlug = appSlug.trim().toLowerCase();
  const [appRows] = await corePool.execute<RowDataPacket[]>(
    'SELECT id FROM apps WHERE slug = ? AND is_active = TRUE LIMIT 1',
    [cleanSlug]
  );
  if (appRows.length > 0) {
    const appId = Number(appRows[0].id);
    await corePool.execute(
      `INSERT INTO user_apps (user_id, app_id, status)
       VALUES (?, ?, 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [userId, appId]
    );
    const [existingRoles] = await corePool.execute<RowDataPacket[]>(
      'SELECT role_id FROM user_app_roles WHERE user_id = ? AND app_id = ? LIMIT 1',
      [userId, appId]
    );
    if (existingRoles.length === 0) {
      await corePool.execute(
        `INSERT IGNORE INTO user_app_roles (user_id, app_id, role_id)
         SELECT ?, ?, id FROM roles WHERE is_default = TRUE LIMIT 1`,
        [userId, appId]
      );
    }
  }
  await ensureAppUserProfile(userId);
}

async function invalidateUserCache(userId: number): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(`user:cache:${userId}`);
  } catch {}
}

async function revokeUserSessions(userId: number): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(`user:session_revoked:${userId}`, Date.now(), 'EX', 7 * 24 * 3600);
  } catch {}
}

async function cacheUserData(user: UserPayload): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(
      `user:cache:${user.id}`,
      JSON.stringify({
        avatar_url: user.avatar_url,
        email: user.email,
        google_connected: user.google_connected,
        google_email: user.google_email,
        has_password: user.has_password,
        permissions: user.permissions,
        roles: user.roles,
        subscription_tier: user.subscription_tier,
        username: user.username,
      }),
      'EX',
      120
    );
  } catch {}
}

async function getCachedUserData(userId: number): Promise<any | null> {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(`user:cache:${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

async function assembleSanitizedUser(userRow: any): Promise<UserPayload> {
  const { permissions, roles } = await getUserRolesAndPermissions(userRow.id);
  return sanitizeUser({
    ...userRow,
    permissions,
    roles,
  });
}

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await corePool.execute<CoreUserRow[]>(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  return attachAppProfile(rows[0] || null);
}

async function findUserById(id: number): Promise<UserRow | null> {
  const [rows] = await corePool.execute<CoreUserRow[]>(
    'SELECT * FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return attachAppProfile(rows[0] || null);
}

async function findUserByGoogleId(googleId: string): Promise<UserRow | null> {
  const [rows] = await corePool.execute<CoreUserRow[]>(
    'SELECT * FROM users WHERE google_id = ? LIMIT 1',
    [googleId]
  );
  return attachAppProfile(rows[0] || null);
}

async function findUserDuplicates(
  email: string,
  username: string
): Promise<{ emailExists: boolean; usernameExists: boolean }> {
  const [rows] = await corePool.execute<CoreUserRow[]>(
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
  const cleanAppSlug = config.appSlug.trim().toLowerCase();

  const conn = await corePool.getConnection();
  let coreUserRow: CoreUserRow | null = null;
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users (uuid, username, email, password_hash, google_id, google_email, avatar_url, status, registration_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
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
      `INSERT IGNORE INTO user_apps (user_id, app_id, status)
       SELECT ?, id, 'active' FROM apps WHERE slug = ? AND is_active = TRUE LIMIT 1`,
      [newUserId, cleanAppSlug]
    );

    await conn.execute(
      `INSERT IGNORE INTO user_app_roles (user_id, app_id, role_id)
       SELECT ?, a.id, r.id
       FROM apps a
       CROSS JOIN roles r
       WHERE a.slug = ? AND r.is_default = TRUE
       LIMIT 1`,
      [newUserId, cleanAppSlug]
    );

    await conn.execute(
      `INSERT INTO user_preferences (user_id, theme, language, reduce_motion, high_contrast, extended_alerts)
       VALUES (?, 'light', 'es', FALSE, FALSE, FALSE)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [newUserId]
    );

    const [rows] = await conn.execute<CoreUserRow[]>(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [newUserId]
    );

    await conn.commit();
    coreUserRow = rows[0] || null;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  if (!coreUserRow) {
    throw new Error('Failed to retrieve newly created user.');
  }

  await ensureAppUserProfile(coreUserRow.id);
  const fullUser = await attachAppProfile(coreUserRow);
  if (!fullUser) {
    throw new Error('Failed to assemble newly created user.');
  }
  return fullUser;
}

async function updateUserPassword(
  userId: number,
  passwordHash: string
): Promise<void> {
  await corePool.execute(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, userId]
  );
  await revokeUserSessions(userId);
  await invalidateUserCache(userId);
}

async function linkGoogleAccount(
  userId: number,
  googleId: string,
  googleEmail: string
): Promise<void> {
  await corePool.execute(
    'UPDATE users SET google_id = ?, google_email = ? WHERE id = ?',
    [googleId, googleEmail.toLowerCase().trim(), userId]
  );
  await invalidateUserCache(userId);
}

async function unlinkGoogleAccount(userId: number): Promise<void> {
  await corePool.execute(
    'UPDATE users SET google_id = NULL, google_email = NULL WHERE id = ?',
    [userId]
  );
  await invalidateUserCache(userId);
}

async function updateUserLastLogin(
  userId: number,
  ip: string
): Promise<void> {
  await corePool.execute(
    'UPDATE users SET last_login_ip = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
    [ip, userId]
  );
  await corePool.execute(
    `UPDATE user_apps ua
     INNER JOIN apps a ON a.id = ua.app_id
     SET ua.last_seen_at = CURRENT_TIMESTAMP
     WHERE ua.user_id = ? AND a.slug = ?`,
    [userId, config.appSlug.trim().toLowerCase()]
  ).catch(() => {});
}

async function generateUniqueUsername(preferred: string): Promise<string> {
  let base = preferred.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  if (!base || base.length < 3) {
    base = 'user';
  }

  const [existingBase] = await corePool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE username = ? LIMIT 1',
    [base]
  );
  if (existingBase.length === 0) {
    return base;
  }

  while (true) {
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    const candidate = `${base.slice(0, 23)}_${randomSuffix}`;
    const [existingCandidate] = await corePool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [candidate]
    );
    if (existingCandidate.length === 0) {
      return candidate;
    }
  }
}

async function updateUsername(userId: number, newUsername: string): Promise<boolean> {
  const clean = newUsername.trim();
  const [existing] = await corePool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
    [clean, userId]
  );
  if (existing.length > 0) {
    return false;
  }
  await corePool.execute('UPDATE users SET username = ? WHERE id = ?', [clean, userId]);
  await invalidateUserCache(userId);
  return true;
}

async function updateUserEmail(userId: number, newEmail: string): Promise<boolean> {
  const clean = newEmail.toLowerCase().trim();
  const [existing] = await corePool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
    [clean, userId]
  );
  if (existing.length > 0) {
    return false;
  }
  await corePool.execute('UPDATE users SET email = ? WHERE id = ?', [clean, userId]);
  await invalidateUserCache(userId);
  return true;
}

async function updateUserAvatar(userId: number, avatarUrl: string | null): Promise<void> {
  await corePool.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
  await invalidateUserCache(userId);
}

async function deleteUserPermanently(userId: number): Promise<boolean> {
  await invalidateUserCache(userId);
  await pool.execute('DELETE FROM app_user_profiles WHERE user_id = ?', [userId]);
  const [result] = await corePool.execute<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId]);
  return result.affectedRows > 0;
}

async function getUserPreferences(userId: number): Promise<UserPreferences> {
  const user = await findUserById(userId);
  if (!user) {
    return { ...DEFAULT_PREFERENCES };
  }

  const [rows] = await corePool.execute<RowDataPacket[]>(
    'SELECT theme, language, reduce_motion, high_contrast, extended_alerts FROM user_preferences WHERE user_id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) {
    await corePool.execute(
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
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

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

async function enableUser2FA(userId: number, secret: string, backupCodes: string[]): Promise<boolean> {
  const hashedCodes = backupCodes.map(hashBackupCode);
  const [result] = await corePool.execute<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = 1, two_factor_secret = ?, two_factor_recovery_codes = ? WHERE id = ?',
    [secret, JSON.stringify(hashedCodes), userId]
  );
  await invalidateUserCache(userId);
  return result.affectedRows > 0;
}

async function disableUser2FA(userId: number): Promise<boolean> {
  const [result] = await corePool.execute<ResultSetHeader>(
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
  assembleSanitizedUser,
  cacheUserData,
  createUser,
  deleteUserPermanently,
  disableUser2FA,
  enableUser2FA,
  ensureAppUserProfile,
  ensureUserAppMembership,
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  findUserDuplicates,
  generateUniqueUsername,
  getAppUserProfile,
  getCachedUserData,
  getUser2FASecret,
  getUserPreferences,
  hasUserAppMembership,
  invalidateUserCache,
  linkGoogleAccount,
  revokeUserSessions,
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
  AppUserProfileRow,
  CoreUserRow,
  UserPreferences,
  UserRow
};
