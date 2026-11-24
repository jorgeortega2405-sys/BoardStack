import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/database.config.js';

interface PermissionRow extends RowDataPacket {
  category: string;
  created_at: string;
  description: string | null;
  id: number;
  name: string;
}

interface RoleRow extends RowDataPacket {
  created_at: string;
  description: string | null;
  id: number;
  is_default: number;
  name: string;
  updated_at: string;
}

async function getUserRoles(userId: number): Promise<string[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.name
     FROM roles r
     INNER JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = ?
     ORDER BY r.name ASC`,
    [userId]
  );
  return rows.map((row) => String(row.name));
}

async function getUserPermissions(userId: number): Promise<string[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT p.name
     FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     INNER JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = ?
     ORDER BY p.name ASC`,
    [userId]
  );
  return rows.map((row) => String(row.name));
}

async function getUserRolesAndPermissions(userId: number): Promise<{ permissions: string[]; roles: string[] }> {
  const [roles, permissions] = await Promise.all([
    getUserRoles(userId),
    getUserPermissions(userId),
  ]);
  return { permissions, roles };
}

async function assignUserRole(
  userId: number,
  roleName: string,
  assignedBy: number | null = null
): Promise<boolean> {
  const [roles] = await pool.execute<RoleRow[]>(
    'SELECT id FROM roles WHERE UPPER(name) = ? LIMIT 1',
    [roleName.trim().toUpperCase()]
  );
  if (roles.length === 0) {
    return false;
  }
  const roleId = roles[0].id;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO user_roles (user_id, role_id, assigned_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)`,
    [userId, roleId, assignedBy]
  );
  return result.affectedRows > 0;
}

async function removeUserRole(userId: number, roleName: string): Promise<boolean> {
  const [roles] = await pool.execute<RoleRow[]>(
    'SELECT id FROM roles WHERE UPPER(name) = ? LIMIT 1',
    [roleName.trim().toUpperCase()]
  );
  if (roles.length === 0) {
    return false;
  }
  const roleId = roles[0].id;
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
    [userId, roleId]
  );
  return result.affectedRows > 0;
}

async function hasRole(userId: number, roleName: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  const target = roleName.trim().toUpperCase();
  return roles.some((r) => {
    const norm = r.toUpperCase();
    return norm === target || (target === 'ADMIN' && (norm === 'SUPER_ADMIN' || norm === 'PLATFORM_ADMIN'));
  });
}

async function hasPermission(userId: number, permissionName: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permissionName.trim());
}

async function ensureDefaultUserRole(userId: number): Promise<void> {
  await pool.execute(
    `INSERT IGNORE INTO user_roles (user_id, role_id)
     SELECT ?, id FROM roles WHERE is_default = TRUE LIMIT 1`,
    [userId]
  );
}

async function getAllRoles(): Promise<RoleRow[]> {
  const [rows] = await pool.execute<RoleRow[]>(
    'SELECT id, name, description, is_default, created_at, updated_at FROM roles ORDER BY id ASC'
  );
  return rows;
}

async function getAllPermissions(): Promise<PermissionRow[]> {
  const [rows] = await pool.execute<PermissionRow[]>(
    'SELECT id, name, description, category, created_at FROM permissions ORDER BY category ASC, name ASC'
  );
  return rows;
}

export {
  assignUserRole,
  ensureDefaultUserRole,
  getAllPermissions,
  getAllRoles,
  getUserPermissions,
  getUserRoles,
  getUserRolesAndPermissions,
  hasPermission,
  hasRole,
  removeUserRole
};

export type {
  PermissionRow,
  RoleRow
};
