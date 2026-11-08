import { getDbPool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { logger } from './logger.service.js';

export async function getUserPermissions(
  userId: number,
  tier?: string,
  subStatus?: string,
  role?: string
): Promise<string[]> {
  const cacheKey = `user:permissions:${userId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as string[];
    }
  } catch (err) {
    logger.db.warn('Error al consultar permisos en Redis:', err);
  }

  const permissions = new Set<string>();
  const pool = getDbPool();

  let userRole = role || 'USER';
  let userTier = tier || 'free';
  let userStatus = subStatus || 'inactive';

  if (!tier || !subStatus || !role) {
    try {
      const [userRows] = await pool.query<any[]>(
        'SELECT role, subscription_tier, subscription_status FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      if (Array.isArray(userRows) && userRows.length > 0) {
        userRole = userRows[0].role || 'USER';
        userTier = userRows[0].subscription_tier || userTier;
        userStatus = userRows[0].subscription_status || userStatus;
      }
    } catch (err) {
      logger.db.warn('Error al consultar usuario para permisos:', err);
    }
  }

  if (userStatus === 'active') {
    try {
      const [subRows] = await pool.query<any[]>(
        'SELECT p.name FROM permissions p JOIN subscription_tier_permissions stp ON p.id = stp.permission_id WHERE stp.tier = ?',
        [userTier]
      );
      if (Array.isArray(subRows)) {
        for (const row of subRows) {
          if (row.name) {
            permissions.add(row.name);
          }
        }
      }
    } catch (err) {
      logger.db.warn('Error al consultar permisos de suscripción:', err);
    }
  }

  try {
    const [roleRows] = await pool.query<any[]>(
      'SELECT DISTINCT p.name FROM permissions p JOIN role_permissions rp ON p.id = rp.permission_id JOIN roles r ON r.id = rp.role_id WHERE r.name = ? OR r.id IN (SELECT role_id FROM user_roles WHERE user_id = ?)',
      [userRole, userId]
    );
    if (Array.isArray(roleRows)) {
      for (const row of roleRows) {
        if (row.name) {
          permissions.add(row.name);
        }
      }
    }
  } catch (err) {
    logger.db.warn('Error al consultar permisos de rol:', err);
  }

  try {
    const [orgMemberRows] = await pool.query<any[]>(
      'SELECT role FROM organization_members WHERE user_id = ? AND status = ? LIMIT 1',
      [userId, 'active']
    );
    if (Array.isArray(orgMemberRows) && orgMemberRows.length > 0) {
      const orgRole = orgMemberRows[0].role;
      if (orgRole === 'admin') {
        permissions.add('org:view');
        permissions.add('org:manage');
        permissions.add('members:view');
        permissions.add('members:invite');
        permissions.add('members:modify_role');
        permissions.add('members:remove');
        permissions.add('sso:view');
        permissions.add('sso:manage');
      } else if (orgRole === 'member') {
        permissions.add('org:view');
        permissions.add('members:view');
      }
    }
  } catch (err) {
    logger.db.warn('Error al consultar permisos de miembro de organización:', err);
  }

  try {
    const [orgOwnerRows] = await pool.query<any[]>(
      'SELECT id FROM organizations WHERE owner_id = ? LIMIT 1',
      [userId]
    );
    if (Array.isArray(orgOwnerRows) && orgOwnerRows.length > 0) {
      permissions.add('org:view');
      permissions.add('org:manage');
      permissions.add('members:view');
      permissions.add('members:invite');
      permissions.add('members:modify_role');
      permissions.add('members:remove');
      permissions.add('sso:view');
      permissions.add('sso:manage');
    }
  } catch (err) {
    logger.db.warn('Error al consultar propiedad de organización:', err);
  }

  const permsList = Array.from(permissions);
  try {
    await redis.setex(cacheKey, 300, JSON.stringify(permsList));
  } catch (err) {
    logger.db.warn('Error al guardar permisos en Redis:', err);
  }

  return permsList;
}

export async function invalidateUserPermissions(userId: number): Promise<void> {
  try {
    await redis.del(`user:permissions:${userId}`, `cache:user:perms:${userId}`);
  } catch (err) {
    logger.db.warn('Error al invalidar permisos en Redis:', err);
  }
}

export const permissionService = {
  getUserPermissions,
  invalidateUserPermissions,
};
