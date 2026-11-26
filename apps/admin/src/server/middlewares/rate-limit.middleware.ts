import { getAdminSessionPayload } from '../services/auth.service.js';
import { getClientIp } from '../utils/ip.util.js';
import { getRedisClient } from '../config/redis.config.js';
import { logger } from '../utils/logger.js';
import type { NextFunction, Request, Response } from 'express';

interface RateLimitOptions {
  keyGenerator?: (req: Request) => string;
  keyPrefix: string;
  maxRequests: number;
  message?: string;
  windowSeconds: number;
}

interface MemoryEntry {
  count: number;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 300000).unref();

function createRateLimiter(options: RateLimitOptions) {
  const {
    keyGenerator = (req: Request) => getClientIp(req),
    keyPrefix,
    maxRequests,
    message,
    windowSeconds,
  } = options;

  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const identifier = keyGenerator(req);
    const redisKey = `${keyPrefix}:${identifier}`;
    let count = 0;
    let ttlSeconds = windowSeconds;

    try {
      const redis = getRedisClient();
      const pipeline = redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.ttl(redisKey);
      const results = await pipeline.exec();
      if (results && results[0] && results[1]) {
        count = Number(results[0][1]) || 1;
        const currentTtl = Number(results[1][1]);
        if (currentTtl === -1 || count === 1) {
          await redis.expire(redisKey, windowSeconds);
          ttlSeconds = windowSeconds;
        } else {
          ttlSeconds = currentTtl > 0 ? currentTtl : windowSeconds;
        }
      }
    } catch (redisErr: any) {
      logger.system.warn(`Redis rate limit error, using memory fallback for key ${redisKey}: ${redisErr.message}`);

      const now = Date.now();
      const existing = memoryStore.get(redisKey);

      if (existing && existing.expiresAt > now) {
        existing.count += 1;
        count = existing.count;
        ttlSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      } else {
        count = 1;
        ttlSeconds = windowSeconds;
        memoryStore.set(redisKey, {
          count: 1,
          expiresAt: now + windowSeconds * 1000,
        });
      }
    }

    const remaining = Math.max(0, maxRequests - count);
    res.setHeader('RateLimit-Limit', maxRequests);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', ttlSeconds);

    if (count > maxRequests) {
      res.setHeader('Retry-After', ttlSeconds);
      const minutes = Math.ceil(ttlSeconds / 60);
      const timeDescription = minutes > 1 ? `${minutes} minutes` : `${ttlSeconds} seconds`;
      const finalMessage = message || `Too many requests. Please wait ${timeDescription} before trying again.`;

      logger.auth.warn(`[RateLimit] Blocked request from ${identifier} on ${req.method} ${req.originalUrl}. Count: ${count}/${maxRequests}.`);
      res.status(429).json({
        error: finalMessage,
        ok: false,
        retryAfterSeconds: ttlSeconds,
      });
      return;
    }

    next();
  };
}

const getUserOrIpKey = (req: Request): string => {
  const session = getAdminSessionPayload(req);
  return session ? `admin:${session.activeId}` : getClientIp(req);
};

const adminLoginRateLimiter = createRateLimiter({
  keyPrefix: 'rl:admin:login',
  maxRequests: 10,
  message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  windowSeconds: 900,
});

const adminGeneralRateLimiter = createRateLimiter({
  keyGenerator: getUserOrIpKey,
  keyPrefix: 'rl:admin:general',
  maxRequests: 120,
  windowSeconds: 60,
});

export {
  adminGeneralRateLimiter,
  adminLoginRateLimiter,
  createRateLimiter
};
