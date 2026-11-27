import type { AccessibleAdminApp, AdminPageSummary, UserAdminAccess } from '../types/admin.types.js';
import { corePool } from '../config/database.config.js';
import type { RowDataPacket } from 'mysql2';
import { SUPER_ADMIN_ROLE } from '../config/roles.config.js';

interface AppRow extends RowDataPacket {
  base_url: string | null;
  description: string | null;
  icon: string;
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

interface AppPageRow extends RowDataPacket {
  app_id: number;
  icon: string;
  required_permission: string;
  slug: string;
  sort_order: number;
  title_key: string;
}

interface UserGlobalRoleRow extends RowDataPacket {
  level: number;
  name: string;
  role_id: number;
  slug: string;
}

interface UserAppRoleRow extends RowDataPacket {
  app_id: number;
  level: number;
  name: string;
  role_id: number;
  slug: string;
}

interface RolePermissionRow extends RowDataPacket {
  code: string;
  role_id: number;
}

interface UserAppOverrideRow extends RowDataPacket {
  app_id: number;
  code: string;
  effect: 'allow' | 'deny';
}

interface UserAppMembershipRow extends RowDataPacket {
  app_id: number;
  status: 'active' | 'removed' | 'suspended';
}

async function getUserAdminAccess(userId: number): Promise<UserAdminAccess> {
  const [
    [appsRows],
    [pageRows],
    [globalRoleRows],
    [appRoleRows],
    [appMembershipRows],
    [overrideRows],
    [allPermissionRows],
  ] = await Promise.all([
    corePool.execute<AppRow[]>(
      'SELECT id, slug, name, description, icon, base_url, sort_order FROM apps WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC'
    ),
    corePool.execute<AppPageRow[]>(
      `SELECT ap.app_id, ap.slug, ap.title_key, ap.icon, ap.sort_order, p.code AS required_permission
       FROM app_pages ap
       INNER JOIN permissions p ON p.id = ap.required_permission_id
       WHERE ap.is_active = TRUE
       ORDER BY ap.sort_order ASC, ap.id ASC`
    ),
    corePool.execute<UserGlobalRoleRow[]>(
      `SELECT r.id AS role_id, r.slug, r.name, r.level
       FROM user_global_roles ugr
       INNER JOIN roles r ON r.id = ugr.role_id
       WHERE ugr.user_id = ?
       ORDER BY r.level DESC, r.id ASC`,
      [userId]
    ),
    corePool.execute<UserAppRoleRow[]>(
      `SELECT uar.app_id, r.id AS role_id, r.slug, r.name, r.level
       FROM user_app_roles uar
       INNER JOIN roles r ON r.id = uar.role_id
       WHERE uar.user_id = ?
       ORDER BY r.level DESC, r.id ASC`,
      [userId]
    ),
    corePool.execute<UserAppMembershipRow[]>(
      'SELECT app_id, status FROM user_apps WHERE user_id = ?',
      [userId]
    ),
    corePool.execute<UserAppOverrideRow[]>(
      `SELECT uap.app_id, p.code, uap.effect
       FROM user_app_permissions uap
       INNER JOIN permissions p ON p.id = uap.permission_id
       WHERE uap.user_id = ?`,
      [userId]
    ),
    corePool.execute<RowDataPacket[]>(
      'SELECT code FROM permissions ORDER BY code ASC'
    ),
  ]);

  const superAdminRoleRow = globalRoleRows.find(
    (r) => String(r.slug).trim().toUpperCase() === SUPER_ADMIN_ROLE.slug
  );
  const isSuperAdmin = Boolean(superAdminRoleRow);
  const allPermissionCodes = allPermissionRows.map((row) => String(row.code));

  const roleIds = Array.from(
    new Set([
      ...globalRoleRows.map((r) => Number(r.role_id)),
      ...appRoleRows.map((r) => Number(r.role_id)),
    ])
  );

  const rolePermissionsMap = new Map<number, string[]>();
  if (roleIds.length > 0 && !isSuperAdmin) {
    const placeholders = roleIds.map(() => '?').join(', ');
    const [rpRows] = await corePool.execute<RolePermissionRow[]>(
      `SELECT rp.role_id, p.code
       FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id IN (${placeholders})`,
      roleIds
    );
    for (const row of rpRows) {
      const roleId = Number(row.role_id);
      const list = rolePermissionsMap.get(roleId) || [];
      list.push(String(row.code));
      rolePermissionsMap.set(roleId, list);
    }
  }

  const membershipStatusMap = new Map<number, string>();
  for (const row of appMembershipRows) {
    membershipStatusMap.set(Number(row.app_id), String(row.status));
  }

  const pagesByAppId = new Map<number, AdminPageSummary[]>();
  for (const page of pageRows) {
    const appId = Number(page.app_id);
    const list = pagesByAppId.get(appId) || [];
    list.push({
      icon: String(page.icon || 'dashboard'),
      requiredPermission: String(page.required_permission),
      slug: String(page.slug),
      sortOrder: Number(page.sort_order),
      titleKey: String(page.title_key),
    });
    pagesByAppId.set(appId, list);
  }

  const accessibleApps: AccessibleAdminApp[] = [];

  for (const app of appsRows) {
    const appId = Number(app.id);
    const appPages = pagesByAppId.get(appId) || [];
    if (appPages.length === 0) {
      continue;
    }

    const membershipStatus = membershipStatusMap.get(appId);
    if (!isSuperAdmin && membershipStatus && membershipStatus !== 'active') {
      continue;
    }

    if (isSuperAdmin) {
      accessibleApps.push({
        baseUrl: app.base_url || null,
        description: app.description || null,
        icon: String(app.icon || 'apps'),
        id: appId,
        name: String(app.name),
        pages: appPages,
        permissions: allPermissionCodes,
        roleName: superAdminRoleRow ? String(superAdminRoleRow.name) : SUPER_ADMIN_ROLE.name,
        roleSlug: superAdminRoleRow ? String(superAdminRoleRow.slug).trim().toUpperCase() : SUPER_ADMIN_ROLE.slug,
        slug: String(app.slug),
      });
      continue;
    }

    const rolesForApp = appRoleRows.filter((r) => Number(r.app_id) === appId);
    const combinedRoles = [...rolesForApp, ...globalRoleRows].sort((a, b) => Number(b.level) - Number(a.level));

    const permissionSet = new Set<string>();
    for (const r of combinedRoles) {
      const perms = rolePermissionsMap.get(Number(r.role_id)) || [];
      for (const p of perms) {
        permissionSet.add(p);
      }
    }

    const overridesForApp = overrideRows.filter((o) => Number(o.app_id) === appId);
    for (const override of overridesForApp) {
      if (override.effect === 'deny') {
        permissionSet.delete(String(override.code));
      } else {
        permissionSet.add(String(override.code));
      }
    }

    const authorizedPages = appPages.filter((page) => permissionSet.has(page.requiredPermission));
    if (authorizedPages.length === 0) {
      continue;
    }

    const primaryRole = combinedRoles[0];
    accessibleApps.push({
      baseUrl: app.base_url || null,
      description: app.description || null,
      icon: String(app.icon || 'apps'),
      id: appId,
      name: String(app.name),
      pages: authorizedPages,
      permissions: Array.from(permissionSet).sort(),
      roleName: primaryRole ? String(primaryRole.name) : 'Custom',
      roleSlug: primaryRole ? String(primaryRole.slug).trim().toUpperCase() : 'custom',
      slug: String(app.slug),
    });
  }

  return {
    accessibleApps,
    hasAccess: accessibleApps.length > 0,
    isSuperAdmin,
  };
}

async function getUserAdminPageAccess(
  userId: number,
  appSlug: string,
  pageSlug: string
): Promise<{
  access: UserAdminAccess;
  allowed: boolean;
  app: AccessibleAdminApp | null;
  page: AdminPageSummary | null;
}> {
  const access = await getUserAdminAccess(userId);
  const normApp = appSlug.trim().toLowerCase();
  const normPage = pageSlug.trim().toLowerCase();
  const matchedApp = access.accessibleApps.find((a) => a.slug.toLowerCase() === normApp) || null;
  const matchedPage = matchedApp ? (matchedApp.pages.find((p) => p.slug.toLowerCase() === normPage) || null) : null;

  return {
    access,
    allowed: Boolean(matchedApp && matchedPage),
    app: matchedApp,
    page: matchedPage,
  };
}

export {
  getUserAdminAccess,
  getUserAdminPageAccess
};
