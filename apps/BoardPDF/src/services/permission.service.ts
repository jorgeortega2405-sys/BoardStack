import { getDbPool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { logger } from './logger.service.js';

async function getUserPermissions(
  userId: number,
  tier?: string,
  subStatus?: string
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
  permissions.add('tools:access');
  const pool = getDbPool();

  let userTier = tier || 'free';
  let userStatus = subStatus || 'inactive';

  if (!tier || !subStatus) {
    try {
      const [userRows] = await pool.query<any[]>(
        'SELECT subscription_tier, subscription_status FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      if (Array.isArray(userRows) && userRows.length > 0) {
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

  const permsList = Array.from(permissions);
  try {
    await redis.setex(cacheKey, 300, JSON.stringify(permsList));
  } catch (err) {
    logger.db.warn('Error al guardar permisos en Redis:', err);
  }

  return permsList;
}

async function invalidateUserPermissions(userId: number): Promise<void> {
  try {
    await redis.del(`user:permissions:${userId}`, `cache:user:perms:${userId}`);
  } catch (err) {
    logger.db.warn('Error al invalidar permisos en Redis:', err);
  }
}

const permissionService = {
  getUserPermissions,
  invalidateUserPermissions,
};

export { getUserPermissions, invalidateUserPermissions, permissionService };
