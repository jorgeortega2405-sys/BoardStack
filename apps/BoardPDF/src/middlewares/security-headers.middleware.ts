import { config } from '../config/env.config.js';
import { logger } from '../services/logger.service.js';
import type { NextFunction, Request, Response } from 'express';

function buildContentSecurityPolicy(): string {
  const isDev = config.nodeEnv !== 'production';
  const scriptDirectives = [
    "'self'",
    "'unsafe-inline'",
    'https://challenges.cloudflare.com',
    'https://accounts.google.com',
    'https://apis.google.com',
    'https://www.dropbox.com',
    'https://js.stripe.com',
  ];
  if (isDev) {
    scriptDirectives.push("'unsafe-eval'");
  }

  const connectDirectives = [
    "'self'",
    'https://challenges.cloudflare.com',
    'https://accounts.google.com',
    'https://*.googleapis.com',
    'https://*.google.com',
    'https://*.dropboxapi.com',
    'https://*.dropbox.com',
    'https://api.stripe.com',
    'http://localhost:*',
    'https://localhost:*',
    'ws://localhost:*',
    'wss://localhost:*',
    'http://127.0.0.1:*',
    'https://127.0.0.1:*',
    'ws://127.0.0.1:*',
    'wss://127.0.0.1:*',
  ];
  if (isDev) {
    connectDirectives.push('ws:', 'wss:');
  } else {
    connectDirectives.push('wss://boardpdf.com', 'wss://www.boardpdf.com');
  }

  const directives: Record<string, string[]> = {
    'base-uri': ["'self'"],
    'connect-src': connectDirectives,
    'default-src': ["'self'"],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://*.gstatic.com', 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', 'data:', 'blob:'],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'frame-src': [
      "'self'",
      'https://challenges.cloudflare.com',
      'https://accounts.google.com',
      'https://docs.google.com',
      'https://drive.google.com',
      'https://www.dropbox.com',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
    ],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'object-src': ["'self'", 'blob:'],
    'script-src': scriptDirectives,
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'worker-src': ["'self'", 'blob:'],
  };

  return Object.entries(directives)
    .map(([key, vals]) => `${key} ${vals.join(' ')}`)
    .join('; ');
}

function securityHeaders() {
  const cspHeader = buildContentSecurityPolicy();

  return function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('Content-Security-Policy', cspHeader);
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || config.nodeEnv === 'production';
    if (isSecure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
  };
}

function originProtection() {
  return function originProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!config.originProtection.enforceCloudflare) {
      return next();
    }

    const cfRay = req.headers['cf-ray'];
    const cfConnectingIp = req.headers['cf-connecting-ip'];

    if (!cfRay || !cfConnectingIp) {
      logger.security.warn('Acceso directo bloqueado: petición no canalizada a través de Cloudflare', {
        headers: req.headers,
        ip: req.ip,
        path: req.path,
      });
      res.status(403).json({
        error: 'Acceso directo al servidor de origen denegado.',
        success: false,
      });
      return;
    }

    if (config.originProtection.secret) {
      const secretHeader = req.headers['x-origin-verify-secret'];
      if (!secretHeader || secretHeader !== config.originProtection.secret) {
        logger.security.warn('Acceso bloqueado: secreto de verificación de origen inválido o ausente', {
          ip: req.ip,
          path: req.path,
        });
        res.status(403).json({
          error: 'Acceso directo al servidor de origen denegado.',
          success: false,
        });
        return;
      }
    }

    next();
  };
}

export { buildContentSecurityPolicy, originProtection, securityHeaders };
