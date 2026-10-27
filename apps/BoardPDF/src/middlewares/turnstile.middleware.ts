import { config } from '../config/env.config.js';
import { logger } from '../services/logger.service.js';
import { verifyTurnstileToken } from '../services/turnstile.service.js';
import { getClientIp } from './rate-limit.middleware.js';
import type { NextFunction, Request, Response } from 'express';

export interface TurnstileMiddlewareOptions {
  bypassWhenDisabled?: boolean;
}

export function requireTurnstile(options: TurnstileMiddlewareOptions = {}) {
  return async function turnstileMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (options.bypassWhenDisabled && !config.turnstile.enabled) {
      return next();
    }

    const headerToken = req.headers['x-turnstile-token'] || req.headers['cf-turnstile-response'];
    const bodyToken =
      req.body && typeof req.body === 'object'
        ? req.body.turnstileToken || req.body['cf-turnstile-response']
        : undefined;
    const rawToken = headerToken || bodyToken;
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

    if (!token) {
      logger.security.warn('Petición bloqueada: token de Turnstile ausente o inválido', {
        ip: getClientIp(req),
        method: req.method,
        path: req.path,
      });
      res.status(400).json({
        error: 'La verificación de seguridad Turnstile es requerida.',
        success: false,
      });
      return;
    }

    const ip = getClientIp(req);
    const result = await verifyTurnstileToken(token, ip);

    if (!result.success) {
      logger.security.warn('Petición bloqueada: token de Turnstile rechazado', {
        errorCodes: result.errorCodes,
        ip,
        path: req.path,
      });
      res.status(400).json({
        error: result.error || 'La verificación de seguridad ha fallado. Por favor intenta de nuevo.',
        success: false,
      });
      return;
    }

    next();
  };
}
