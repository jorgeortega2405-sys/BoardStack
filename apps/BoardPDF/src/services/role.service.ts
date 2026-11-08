import { getDbPool } from '../config/database.config.js';
import { cacheService } from './cache.service.js';
import { logger } from './logger.service.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface RoleRecord {
  category: string;
  created_at?: Date;
  description: string | null;
  display_name: string;
  id: number;
  name: string;
  updated_at?: Date;
}

export async function getAllRoles(): Promise<RoleRecord[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, display_name, description, category, created_at, updated_at FROM roles ORDER BY category ASC, name ASC'
    );
    return rows as RoleRecord[];
  } catch (err) {
    logger.db.warn('Error al obtener lista de roles', err);
    return [];
  }
}

export async function getUserRoleNames(userId: number, fallbackRole = 'USER'): Promise<string[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY r.id ASC',
      [userId]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => String(r.name));
    }
  } catch (err) {
    logger.db.warn('Error al consultar nombres de roles de usuario', err);
  }
  return [fallbackRole || 'USER'];
}

export async function getUserRoles(userId: number): Promise<RoleRecord[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT r.id, r.name, r.display_name, r.description, r.category, r.created_at, r.updated_at FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY r.name ASC',
      [userId]
    );
    return rows as RoleRecord[];
  } catch (err) {
    logger.db.warn('Error al consultar roles de usuario', err);
    return [];
  }
}

export async function assignRoleToUser(userId: number, roleName: string): Promise<boolean> {
  try {
    const pool = getDbPool();
    const [roleRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM roles WHERE name = ? LIMIT 1',
      [roleName.trim()]
    );
    if (!Array.isArray(roleRows) || roleRows.length === 0) {
      return false;
    }
    const roleId = roleRows[0].id;
    await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userId, roleId]
    );
    await cacheService.invalidateUser(String(userId));
    await cacheService.invalidateRolePermsCache(roleName);
    return true;
  } catch (err) {
    logger.db.warn('Error al asignar rol a usuario', err);
    return false;
  }
}

export async function removeRoleFromUser(userId: number, roleName: string): Promise<boolean> {
  try {
    const pool = getDbPool();
    const [roleRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM roles WHERE name = ? LIMIT 1',
      [roleName.trim()]
    );
    if (!Array.isArray(roleRows) || roleRows.length === 0) {
      return false;
    }
    const roleId = roleRows[0].id;
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
      [userId, roleId]
    );
    await cacheService.invalidateUser(String(userId));
    await cacheService.invalidateRolePermsCache(roleName);
    return result.affectedRows > 0;
  } catch (err) {
    logger.db.warn('Error al remover rol de usuario', err);
    return false;
  }
}
