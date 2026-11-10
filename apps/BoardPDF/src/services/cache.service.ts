import { redis } from '../config/redis.config.js';
import { logger } from './logger.service.js';

const CACHE_KEYS = {
  userBilling: (userId: string) => `cache:user:billing:${userId}`,
  userById: (userId: string) => `cache:user:id:${userId}`,
  userEmail: (email: string) => `cache:user:email:${email.toLowerCase().trim()}`,
  userLabels: (userId: string) => `cache:user:labels:${userId}`,
  userPerms: (userId: string) => `cache:user:perms:${userId}`,
  userPrefs: (userId: string) => `cache:user:prefs:${userId}`,
  userProfile: (userId: string) => `user:profile:${userId}`,
  userUsername: (username: string) => `cache:user:username:${username.toLowerCase().trim()}`,
};

const CACHE_TTL = {
  userBilling: 300,
  userById: 300,
  userEmail: 300,
  userLabels: 300,
  userPerms: 300,
  userPrefs: 600,
  userUsername: 300,
};

async function get<T>(key: string): Promise<T | null | undefined> {
  try {
    const raw = await redis.get(key);
    if (raw === null || raw === undefined) {
      return undefined;
    }
    if (raw === 'null' || raw === '__BOARDPDF_NULL__') {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.db.warn('Error al leer de caché Redis (fail-open)', {
      error: err instanceof Error ? err.message : String(err),
      key,
    });
    return undefined;
  }
}

async function set(key: string, value: unknown, ttlSeconds = 300): Promise<boolean> {
  try {
    const serialized = value === null || value === undefined ? 'null' : JSON.stringify(value);
    await redis.setex(key, ttlSeconds, serialized);
    return true;
  } catch (err) {
    logger.db.warn('Error al escribir en caché Redis (fail-open)', {
      error: err instanceof Error ? err.message : String(err),
      key,
    });
    return false;
  }
}

async function del(...keys: string[]): Promise<boolean> {
  const validKeys = keys.filter(Boolean);
  if (validKeys.length === 0) {
    return false;
  }
  try {
    await redis.del(...validKeys);
    return true;
  } catch (err) {
    logger.db.warn('Error al invalidar caché Redis (fail-open)', {
      error: err instanceof Error ? err.message : String(err),
      keys: validKeys,
    });
    return false;
  }
}

async function remember<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T | null>,
  nullTtlSeconds = 60
): Promise<T | null> {
  const cached = await get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const fresh = await fetcher();
  await set(key, fresh, fresh === null ? nullTtlSeconds : ttlSeconds);
  return fresh;
}

async function invalidateUser(
  userId: string,
  email?: string,
  username?: string
): Promise<void> {
  const keys = [
    CACHE_KEYS.userById(userId),
    CACHE_KEYS.userProfile(userId),
    `user:cache:${userId}`,
    CACHE_KEYS.userPerms(userId),
    `user:permissions:${userId}`,
    CACHE_KEYS.userBilling(userId),
    CACHE_KEYS.userLabels(userId),
  ];
  if (email) {
    keys.push(CACHE_KEYS.userEmail(email));
  }
  if (username) {
    keys.push(CACHE_KEYS.userUsername(username));
  }
  await del(...keys);
}

async function invalidateUserCache(
  userId: string,
  identifiers?: { email?: string; username?: string }
): Promise<void> {
  await invalidateUser(userId, identifiers?.email, identifiers?.username);
}

async function invalidateUserLabels(userId: string): Promise<void> {
  await del(CACHE_KEYS.userLabels(userId));
}

async function invalidateUserPrefs(userId: string): Promise<void> {
  await del(CACHE_KEYS.userPrefs(userId));
}

const cacheService = {
  CACHE_KEYS,
  CACHE_TTL,
  del,
  get,
  invalidateUser,
  invalidateUserCache,
  invalidateUserLabels,
  invalidateUserPrefs,
  remember,
  set,
};

export { CACHE_KEYS, CACHE_TTL, cacheService, del, get, invalidateUser, invalidateUserCache, invalidateUserLabels, invalidateUserPrefs, remember, set };
