import { redis } from '../../config/redis.config.js';
import { logger } from '../../services/logger.service.js';
import { CollaborativeAiLockInfo } from './collaborative-pdf.types.js';
import crypto from 'crypto';

interface StoredAiLockRecord {
  expiresAt: number;
  lockedBy: string;
  lockedByUserId?: number;
  startedAt: string;
  token: string;
}

interface AcquireAiLockResult {
  acquired: boolean;
  lock: CollaborativeAiLockInfo;
  lockToken?: string;
}

const LOCK_KEY_PREFIX = 'collab:ai_lock:';
const LOCK_TTL_SECONDS = 180;
const inMemoryLocks = new Map<string, StoredAiLockRecord>();

function isRedisAvailable(): boolean {
  return redis.status === 'ready' || redis.status === 'connect';
}

function getLockKey(docId: string): string {
  return `${LOCK_KEY_PREFIX}${docId}`;
}

function toPublicLockInfo(record: StoredAiLockRecord | null): CollaborativeAiLockInfo {
  if (!record) {
    return { locked: false };
  }
  return {
    locked: true,
    lockedBy: record.lockedBy,
    lockedByUserId: record.lockedByUserId,
    startedAt: record.startedAt,
  };
}

function getValidInMemoryLock(docId: string): StoredAiLockRecord | null {
  const rec = inMemoryLocks.get(docId);
  if (!rec) return null;
  if (Date.now() >= rec.expiresAt) {
    inMemoryLocks.delete(docId);
    return null;
  }
  return rec;
}

async function getCollaborativeAiLock(docId: string): Promise<CollaborativeAiLockInfo> {
  if (!docId) return { locked: false };

  if (isRedisAvailable()) {
    try {
      const raw = await redis.get(getLockKey(docId));
      if (!raw) return { locked: false };
      const parsed = JSON.parse(raw) as StoredAiLockRecord;
      if (!parsed || typeof parsed !== 'object' || !parsed.startedAt) {
        return { locked: false };
      }
      return toPublicLockInfo(parsed);
    } catch (err) {
      logger.db.warn('Error leyendo bloqueo IA en Redis, evaluando respaldo en memoria', err);
    }
  }

  return toPublicLockInfo(getValidInMemoryLock(docId));
}

async function acquireCollaborativeAiLock(
  docId: string,
  userId?: number | null,
  username?: string | null
): Promise<AcquireAiLockResult> {
  const token = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const record: StoredAiLockRecord = {
    expiresAt: now + LOCK_TTL_SECONDS * 1000,
    lockedBy: (username || '').trim() || 'Usuario',
    lockedByUserId: typeof userId === 'number' ? userId : undefined,
    startedAt: new Date(now).toISOString(),
    token,
  };

  if (isRedisAvailable()) {
    try {
      const key = getLockKey(docId);
      const setRes = await redis.set(key, JSON.stringify(record), 'EX', LOCK_TTL_SECONDS, 'NX');
      if (setRes === 'OK') {
        return {
          acquired: true,
          lock: toPublicLockInfo(record),
          lockToken: token,
        };
      }
      const existing = await getCollaborativeAiLock(docId);
      return {
        acquired: false,
        lock: existing.locked ? existing : { locked: true, lockedBy: record.lockedBy, startedAt: record.startedAt },
      };
    } catch (err) {
      logger.db.warn('Error adquiriendo bloqueo IA en Redis, usando bloqueo en memoria', err);
    }
  }

  const existingMem = getValidInMemoryLock(docId);
  if (existingMem) {
    return {
      acquired: false,
      lock: toPublicLockInfo(existingMem),
    };
  }

  inMemoryLocks.set(docId, record);
  return {
    acquired: true,
    lock: toPublicLockInfo(record),
    lockToken: token,
  };
}

async function releaseCollaborativeAiLock(docId: string, lockToken?: string): Promise<boolean> {
  if (!docId) return false;

  if (isRedisAvailable()) {
    try {
      const key = getLockKey(docId);
      if (lockToken) {
        const lua = 'local val = redis.call("GET", KEYS[1]) if val and string.find(val, ARGV[1], 1, true) then return redis.call("DEL", KEYS[1]) end return 0';
        const deleted = await redis.eval(lua, 1, key, lockToken);
        return Number(deleted) > 0;
      }
      const deleted = await redis.del(key);
      return deleted > 0;
    } catch (err) {
      logger.db.warn('Error liberando bloqueo IA en Redis', err);
    }
  }

  const existingMem = inMemoryLocks.get(docId);
  if (!existingMem) return false;
  if (lockToken && existingMem.token !== lockToken) {
    return false;
  }
  inMemoryLocks.delete(docId);
  return true;
}

function clearAllInMemoryAiLocks(): void {
  inMemoryLocks.clear();
}

export { acquireCollaborativeAiLock, clearAllInMemoryAiLocks, getCollaborativeAiLock, releaseCollaborativeAiLock };
export type { AcquireAiLockResult };
