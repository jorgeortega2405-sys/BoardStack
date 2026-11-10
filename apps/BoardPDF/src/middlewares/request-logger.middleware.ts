import { logger } from '../services/logger.service.js';
import { trackHttpRequest, trackPdfProcessing, trackSecurityEvent } from '../services/telemetry.service.js';
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

const PDF_TOOL_ROUTE_PREFIX = '/api/tools/';

function resolveRoutePattern(req: Request, rawPath: string): string {
  const baseUrl = req.baseUrl || '';
  const routePath = typeof req.route?.path === 'string' ? req.route.path : '';
  if (baseUrl || routePath) {
    return `${baseUrl}${routePath}`.replace(/\/+/g, '/') || '/';
  }
  return rawPath.split('?')[0] || '/';
}

function resolveToolName(cleanPath: string): string | null {
  if (!cleanPath.startsWith(PDF_TOOL_ROUTE_PREFIX)) {
    return null;
  }
  const rest = cleanPath.slice(PDF_TOOL_ROUTE_PREFIX.length);
  const firstSegment = rest.split('/')[0]?.trim();
  if (!firstSegment) {
    return null;
  }
  return firstSegment.toLowerCase();
}

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime.bigint();
  const path = req.originalUrl || req.url;

  if (
    path.startsWith('/@') ||
    path.startsWith('/node_modules') ||
    path.startsWith('/client') ||
    path.match(/\.(css|js|map|svg|png|jpg|jpeg|webp|woff2|woff|ttf|ico)$/)
  ) {
    return next();
  }

  const requestId =
    (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].trim()) ||
    crypto.randomUUID();
  (req as any).requestId = requestId;

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startNs;
    const durationUs = Number(elapsedNs / 1000n);
    const duration = Math.round(durationUs / 1000);
    const statusCode = res.statusCode;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const cleanPath = path.split('?')[0] || '/';
    const routePattern = resolveRoutePattern(req, cleanPath);
    const authUser = (req as any).user as { id?: number; subscription_tier?: string } | undefined;
    const userId = authUser?.id ? Number(authUser.id) : null;
    const rawReqBytes = Number(req.headers['content-length'] || 0);
    const rawResBytes = Number(res.getHeader('content-length') || 0);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
    const countryCode = typeof req.headers['cf-ipcountry'] === 'string' ? req.headers['cf-ipcountry'] : '';

    if (statusCode >= 500) {
      logger.app.error(`HTTP ${req.method} ${path} respondio ${statusCode} (${duration}ms)`, { ip, statusCode });
    } else if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
      logger.security.warn(`HTTP ${req.method} ${path} bloqueado con ${statusCode} (${duration}ms)`, { ip, statusCode });
    } else if (path.startsWith('/api')) {
      logger.app.info(`HTTP ${req.method} ${path} ${statusCode} (${duration}ms)`, { ip, statusCode });
    }

    if (cleanPath.startsWith('/api/health')) {
      return;
    }

    trackHttpRequest({
      countryCode,
      durationUs,
      ip,
      latencyMs: duration,
      method: req.method,
      rawPath: cleanPath,
      requestBytes: Number.isFinite(rawReqBytes) ? rawReqBytes : 0,
      requestId,
      responseBytes: Number.isFinite(rawResBytes) ? rawResBytes : 0,
      routePattern,
      statusCode,
      subscriptionTier: authUser?.subscription_tier || (userId ? 'free' : 'anonymous'),
      userAgent,
      userId,
    });

    if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
      trackSecurityEvent({
        eventType: statusCode === 429 ? 'http_rate_limited' : 'http_access_denied',
        ip,
        metadata: { method: req.method, statusCode },
        outcome: 'blocked',
        reason: `HTTP_${statusCode}`,
        routePattern,
        severity: statusCode === 429 ? 'warn' : 'info',
        userAgent,
        userId,
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const toolName = resolveToolName(cleanPath);
      if (toolName) {
        const isSuccess = statusCode >= 200 && statusCode < 400;
        trackPdfProcessing({
          errorCode: isSuccess ? '' : `HTTP_${statusCode}`,
          fileCount: 1,
          inputBytes: Number.isFinite(rawReqBytes) ? rawReqBytes : 0,
          isAuthenticated: Boolean(userId),
          metadata: { method: req.method, routePattern, statusCode },
          operationId: requestId,
          outputBytes: Number.isFinite(rawResBytes) ? rawResBytes : 0,
          processingMs: duration,
          status: isSuccess ? 'success' : 'error',
          toolName,
          userId,
        });
      }
    }
  });

  next();
}

export { requestLogger };
