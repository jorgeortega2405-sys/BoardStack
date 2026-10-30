import { getDbPool } from '../config/database.config.js';
import { UserPayload } from '../types/auth.types.js';
import { logger } from './logger.service.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

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
  subscription_tier?: string;
  two_factor_enabled?: boolean | number;
  two_factor_recovery_codes?: string | null;
  two_factor_secret?: string | null;
  updated_at?: Date;
  username: string;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, password_hash, avatar_url, role, subscription_tier, two_factor_enabled FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, avatar_url, role, subscription_tier, two_factor_enabled FROM users WHERE username = ? LIMIT 1',
    [username.trim()]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, avatar_url, role, subscription_tier, two_factor_enabled, created_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) return null;
  return rows[0];
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
