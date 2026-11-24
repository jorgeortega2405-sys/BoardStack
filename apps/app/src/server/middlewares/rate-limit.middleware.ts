import { getClientIp } from '../utils/ip.util.js';
import { getCurrentUser } from './auth.middleware.js';
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

      logger.auth.warn(`[RateLimit] Blocked request from IP ${identifier} on ${req.method} ${req.originalUrl}. Count: ${count}/${maxRequests}. Window: ${windowSeconds}s.`);

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

const authLoginRateLimiter = createRateLimiter({
  keyPrefix: 'rl:auth:login',
  maxRequests: 5,
  message: 'Too many failed login attempts. For security, please wait 15 minutes before trying again.',
  windowSeconds: 900,
});

const authRegisterStage1RateLimiter = createRateLimiter({
  keyPrefix: 'rl:auth:reg-stage1',
  maxRequests: 10,
  message: 'Too many registration attempts. Please wait 15 minutes.',
  windowSeconds: 900,
});

const authRegisterSendCodeRateLimiter = createRateLimiter({
  keyPrefix: 'rl:auth:send-code',
  maxRequests: 5,
  message: 'Verification code request limit reached. Please wait 15 minutes.',
  windowSeconds: 900,
});

const authRegisterVerifyRateLimiter = createRateLimiter({
  keyPrefix: 'rl:auth:verify-code',
  maxRequests: 5,
  message: 'Too many incorrect verification attempts. Please wait 10 minutes.',
  windowSeconds: 600,
});

const authResendCodeRateLimiter = createRateLimiter({
  keyPrefix: 'rl:auth:resend-code',
  maxRequests: 3,
  message: 'Resend code limit reached. Please wait 10 minutes.',
  windowSeconds: 600,
});

const authForgotPasswordRateLimiter = createRateLimiter({
  keyPrefix: 'rl:auth:forgot-pwd',
  maxRequests: 4,
  message: 'Too many password reset requests. Please wait 15 minutes.',
  windowSeconds: 900,
});

const authResetPasswordRateLimiter = createRateLimiter({
  keyPrefix: 'rl:auth:reset-pwd',
  maxRequests: 5,
  message: 'Too many password reset attempts. Please wait 15 minutes.',
  windowSeconds: 900,
});

const generalAuthRateLimiter = createRateLimiter({
  keyPrefix: 'rl:auth:general',
  maxRequests: 60,
  windowSeconds: 60,
});

const getUserOrIpKey = (req: Request): string => {
  const user = getCurrentUser(req);
  return user ? `user:${user.id}` : getClientIp(req);
};

const settingsPreferencesRateLimiter = createRateLimiter({
  keyGenerator: getUserOrIpKey,
  keyPrefix: 'rl:settings:prefs',
  maxRequests: 30,
  message: 'Too many preference updates. Please slow down and try again shortly.',
  windowSeconds: 60,
});

const settingsAvatarRateLimiter = createRateLimiter({
  keyGenerator: getUserOrIpKey,
  keyPrefix: 'rl:settings:avatar',
  maxRequests: 10,
  message: 'Too many avatar upload attempts. Please wait 10 minutes before uploading again.',
  windowSeconds: 600,
});

const settingsPasswordVerifyRateLimiter = createRateLimiter({
  keyGenerator: getUserOrIpKey,
  keyPrefix: 'rl:settings:pwd-verify',
  maxRequests: 5,
  message: 'Too many password verification attempts. For security, please wait 15 minutes.',
  windowSeconds: 900,
});

const settingsSecurityRateLimiter = createRateLimiter({
  keyGenerator: getUserOrIpKey,
  keyPrefix: 'rl:settings:security',
  maxRequests: 10,
  message: 'Too many security action attempts. Please wait 10 minutes before trying again.',
  windowSeconds: 600,
});

const settingsGeneralRateLimiter = createRateLimiter({
  keyGenerator: getUserOrIpKey,
  keyPrefix: 'rl:settings:general',
  maxRequests: 40,
  message: 'Too many settings requests. Please wait a moment before trying again.',
  windowSeconds: 60,
});

const salesLeadRateLimiter = createRateLimiter({
  keyPrefix: 'rl:sales:contact',
  maxRequests: 5,
  message: 'Too many contact inquiries submitted. Please wait 15 minutes before submitting again.',
  windowSeconds: 900,
});

const subscriptionRateLimiter = createRateLimiter({
  keyGenerator: getUserOrIpKey,
  keyPrefix: 'rl:sub:actions',
  maxRequests: 10,
  message: 'Too many subscription requests. Please wait a few minutes before trying again.',
  windowSeconds: 600,
});

export {
  authForgotPasswordRateLimiter,
  authLoginRateLimiter,
  authRegisterSendCodeRateLimiter,
  authRegisterStage1RateLimiter,
  authRegisterVerifyRateLimiter,
  authResendCodeRateLimiter,
  authResetPasswordRateLimiter,
  createRateLimiter,
  generalAuthRateLimiter,
  salesLeadRateLimiter,
  settingsAvatarRateLimiter,
  settingsGeneralRateLimiter,
  settingsPasswordVerifyRateLimiter,
  settingsPreferencesRateLimiter,
  settingsSecurityRateLimiter,
  subscriptionRateLimiter
};
