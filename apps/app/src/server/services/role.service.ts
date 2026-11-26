import { config } from '../config/env.config.js';
import { corePool } from '../config/database.config.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

interface PermissionRow extends RowDataPacket {
  category: string;
  code: string;
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
  is_global: number;
  level: number;
  name: string;
  slug: string;
  updated_at: string;
}

async function getAppIdBySlug(appSlug: string = config.appSlug): Promise<number | null> {
  const cleanSlug = appSlug.trim().toLowerCase();
  const [rows] = await corePool.execute<RowDataPacket[]>(
    'SELECT id FROM apps WHERE slug = ? AND is_active = TRUE LIMIT 1',
    [cleanSlug]
  );
  return rows.length > 0 ? Number(rows[0].id) : null;
}

async function getUserRoles(userId: number, appSlug: string = config.appSlug): Promise<string[]> {
  const cleanSlug = appSlug.trim().toLowerCase();
  const [rows] = await corePool.execute<RowDataPacket[]>(
    `SELECT slug FROM (
       SELECT r.slug, r.level
       FROM roles r
       INNER JOIN user_global_roles ugr ON ugr.role_id = r.id
       WHERE ugr.user_id = ?
       UNION
       SELECT r.slug, r.level
       FROM roles r
       INNER JOIN user_app_roles uar ON uar.role_id = r.id
       INNER JOIN apps a ON a.id = uar.app_id
       WHERE uar.user_id = ? AND a.slug = ? AND a.is_active = TRUE
     ) combined
     ORDER BY level DESC, slug ASC`,
    [userId, userId, cleanSlug]
  );
  return rows.map((row) => String(row.slug));
}

async function getUserPermissions(userId: number, appSlug: string = config.appSlug): Promise<string[]> {
  const cleanSlug = appSlug.trim().toLowerCase();
  const appId = await getAppIdBySlug(cleanSlug);

  const [globalRoleRows] = await corePool.execute<RowDataPacket[]>(
    `SELECT r.slug
     FROM roles r
     INNER JOIN user_global_roles ugr ON ugr.role_id = r.id
     WHERE ugr.user_id = ?`,
    [userId]
  );

  const isSuperAdmin = globalRoleRows.some(
    (row) => String(row.slug).toLowerCase() === 'superadministrator'
  );

  const permissionSet = new Set<string>();

  if (isSuperAdmin) {
    const [allPerms] = await corePool.execute<RowDataPacket[]>(
      'SELECT code FROM permissions ORDER BY code ASC'
    );
    for (const row of allPerms) {
      permissionSet.add(String(row.code));
    }
    return Array.from(permissionSet);
  }

  const [globalPermRows] = await corePool.execute<RowDataPacket[]>(
    `SELECT DISTINCT p.code
     FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     INNER JOIN user_global_roles ugr ON ugr.role_id = rp.role_id
     WHERE ugr.user_id = ?`,
    [userId]
  );
  for (const row of globalPermRows) {
    permissionSet.add(String(row.code));
  }

  if (appId !== null) {
    const [appPermRows] = await corePool.execute<RowDataPacket[]>(
      `SELECT DISTINCT p.code
       FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       INNER JOIN user_app_roles uar ON uar.role_id = rp.role_id
       WHERE uar.user_id = ? AND uar.app_id = ?`,
      [userId, appId]
    );
    for (const row of appPermRows) {
      permissionSet.add(String(row.code));
    }

    const [overrideRows] = await corePool.execute<RowDataPacket[]>(
      `SELECT p.code, uap.effect
       FROM user_app_permissions uap
       INNER JOIN permissions p ON p.id = uap.permission_id
       WHERE uap.user_id = ? AND uap.app_id = ?`,
      [userId, appId]
    );
    for (const row of overrideRows) {
      const code = String(row.code);
      if (row.effect === 'deny') {
        permissionSet.delete(code);
      } else {
        permissionSet.add(code);
      }
    }
  }

  return Array.from(permissionSet).sort();
}

async function getUserRolesAndPermissions(
  userId: number,
  appSlug: string = config.appSlug
): Promise<{ permissions: string[]; roles: string[] }> {
  const [roles, permissions] = await Promise.all([
    getUserRoles(userId, appSlug),
    getUserPermissions(userId, appSlug),
  ]);
  return { permissions, roles };
}

async function assignUserRole(
  userId: number,
  roleSlug: string,
  assignedBy: number | null = null,
  appSlug: string = config.appSlug
): Promise<boolean> {
  const cleanRole = roleSlug.trim().toLowerCase();
  const [roles] = await corePool.execute<RoleRow[]>(
    'SELECT id, is_global FROM roles WHERE LOWER(slug) = ? LIMIT 1',
    [cleanRole]
  );
  if (roles.length === 0) {
    return false;
  }

  const role = roles[0];
  if (Boolean(role.is_global)) {
    const [result] = await corePool.execute<ResultSetHeader>(
      `INSERT INTO user_global_roles (user_id, role_id, assigned_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)`,
      [userId, role.id, assignedBy]
    );
    return result.affectedRows > 0;
  }

  const appId = await getAppIdBySlug(appSlug);
  if (appId === null) {
    return false;
  }

  await corePool.execute(
    `INSERT IGNORE INTO user_apps (user_id, app_id, status) VALUES (?, ?, 'active')`,
    [userId, appId]
  );

  const [result] = await corePool.execute<ResultSetHeader>(
    `INSERT INTO user_app_roles (user_id, app_id, role_id, assigned_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)`,
    [userId, appId, role.id, assignedBy]
  );
  return result.affectedRows > 0;
}

async function removeUserRole(
  userId: number,
  roleSlug: string,
  appSlug: string = config.appSlug
): Promise<boolean> {
  const cleanRole = roleSlug.trim().toLowerCase();
  const [roles] = await corePool.execute<RoleRow[]>(
    'SELECT id, is_global FROM roles WHERE LOWER(slug) = ? LIMIT 1',
    [cleanRole]
  );
  if (roles.length === 0) {
    return false;
  }

  const role = roles[0];
  if (Boolean(role.is_global)) {
    const [result] = await corePool.execute<ResultSetHeader>(
      'DELETE FROM user_global_roles WHERE user_id = ? AND role_id = ?',
      [userId, role.id]
    );
    return result.affectedRows > 0;
  }

  const appId = await getAppIdBySlug(appSlug);
  if (appId === null) {
    return false;
  }

  const [result] = await corePool.execute<ResultSetHeader>(
    'DELETE FROM user_app_roles WHERE user_id = ? AND app_id = ? AND role_id = ?',
    [userId, appId, role.id]
  );
  return result.affectedRows > 0;
}

async function hasRole(
  userId: number,
  roleName: string,
  appSlug: string = config.appSlug
): Promise<boolean> {
  const roles = await getUserRoles(userId, appSlug);
  const target = roleName.trim().toLowerCase();
  return roles.some((r) => {
    const norm = r.toLowerCase();
    return norm === target || (target === 'admin' && (norm === 'superadministrator' || norm === 'administrator'));
  });
}

async function hasPermission(
  userId: number,
  permissionCode: string,
  appSlug: string = config.appSlug
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, appSlug);
  return permissions.includes(permissionCode.trim());
}

async function ensureDefaultUserRole(
  userId: number,
  appSlug: string = config.appSlug
): Promise<void> {
  const appId = await getAppIdBySlug(appSlug);
  if (appId === null) {
    return;
  }

  await corePool.execute(
    `INSERT IGNORE INTO user_apps (user_id, app_id, status) VALUES (?, ?, 'active')`,
    [userId, appId]
  );

  await corePool.execute(
    `INSERT IGNORE INTO user_app_roles (user_id, app_id, role_id)
     SELECT ?, ?, id FROM roles WHERE is_default = TRUE LIMIT 1`,
    [userId, appId]
  );
}

async function getAllRoles(): Promise<RoleRow[]> {
  const [rows] = await corePool.execute<RoleRow[]>(
    'SELECT id, slug, name, description, level, is_default, is_global, created_at, updated_at FROM roles ORDER BY level ASC, id ASC'
  );
  return rows;
}

async function getAllPermissions(): Promise<PermissionRow[]> {
  const [rows] = await corePool.execute<PermissionRow[]>(
    'SELECT id, code, name, description, category, created_at FROM permissions ORDER BY category ASC, code ASC'
  );
  return rows;
}

export {
  assignUserRole,
  ensureDefaultUserRole,
  getAllPermissions,
  getAllRoles,
  getAppIdBySlug,
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
