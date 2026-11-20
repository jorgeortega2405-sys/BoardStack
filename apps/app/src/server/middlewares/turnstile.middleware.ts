import { config } from '../config/env.config.js';
import { getClientIp } from '../utils/ip.util.js';
import { logger } from '../utils/logger.js';
import type { NextFunction, Request, Response } from 'express';
import { verify2FALoginTicket } from '../services/two-factor.service.js';
import { verifyTurnstileToken } from '../services/turnstile.service.js';

async function requireTurnstile(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!config.turnstile.enabled) {
    return next();
  }

  if (req.body?.tempToken && req.body?.twoFactorCode) {
    const validUserId = verify2FALoginTicket(String(req.body.tempToken));
    if (validUserId) {
      return next();
    }
  }

  const token =
    req.body?.turnstileToken ||
    req.headers['cf-turnstile-response'] ||
    req.headers['x-turnstile-token'];

  const clientIp = getClientIp(req);
  const result = await verifyTurnstileToken(typeof token === 'string' ? token : '', clientIp);

  if (!result.success) {
    logger.auth.warn(`[Turnstile] Request blocked to ${req.originalUrl} from IP ${clientIp}: ${result.error}`);
    res.status(403).json({
      error: result.error || 'Security verification required.',
      ok: false,
    });
    return;
  }

  next();
}

export {
  requireTurnstile
};
