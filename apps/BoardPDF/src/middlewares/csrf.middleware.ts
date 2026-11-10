import { config } from '../config/env.config.js';
import { logger } from '../services/logger.service.js';
import { trackSecurityEvent } from '../services/telemetry.service.js';
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const CSRF_COOKIE_NAME = 'boardpdf_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  let token = req.cookies[CSRF_COOKIE_NAME];
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
    });
  }

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (
    req.path === '/api/subscription/webhook' ||
    req.originalUrl.startsWith('/api/subscription/webhook') ||
    req.path === '/api/sso/saml/acs' ||
    req.originalUrl.startsWith('/api/sso/saml/acs')
  ) {
    return next();
  }

  const clientToken = req.headers[CSRF_HEADER_NAME] || (req.body && typeof req.body === 'object' ? req.body._csrf : undefined);
  if (!clientToken || clientToken !== token) {
    logger.security.warn('Petición bloqueada por fallo o ausencia de token CSRF', {
      method: req.method,
      path: req.path,
    });
    trackSecurityEvent({
      eventType: 'csrf_blocked',
      ip: req.ip || req.socket.remoteAddress || '',
      metadata: { method: req.method },
      outcome: 'blocked',
      reason: 'invalid_or_missing_csrf_token',
      routePattern: req.originalUrl || req.path,
      severity: 'warn',
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
      userId: (req as any).user?.id ? Number((req as any).user.id) : null,
    });
    res.status(403).json({
      error: 'Token CSRF inválido o ausente.',
      success: false,
    });
    return;
  }

  next();
}

export { csrfProtection };
