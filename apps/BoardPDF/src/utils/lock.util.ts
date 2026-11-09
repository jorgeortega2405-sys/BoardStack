import { randomBytes } from 'crypto';
import { redis } from '../config/redis.config.js';

async function acquireLock(key: string, ttlSeconds = 15): Promise<string | null> {
  const token = randomBytes(16).toString('hex') + Date.now().toString(36);
  try {
    const result = await redis.set(key, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK' ? token : null;
  } catch {
    return token;
  }
}

async function releaseLock(key: string, token: string): Promise<void> {
  const lua = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
  try {
    await redis.eval(lua, 1, key, token);
  } catch {}
}

async function withLock<T>(
  key: string,
  ttlSeconds: number,
  action: () => Promise<T>,
  conflictMessage = 'Hay una operación en proceso. Por favor espera un momento.'
): Promise<T> {
  const token = await acquireLock(key, ttlSeconds);
  if (!token) {
    throw new Error(conflictMessage);
  }
  try {
    return await action();
  } finally {
    await releaseLock(key, token);
  }
}

export { acquireLock, releaseLock, withLock };
