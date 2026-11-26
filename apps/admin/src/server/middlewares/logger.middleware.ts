import { getClientIp } from '../utils/ip.util.js';
import { logger, sanitizeObject } from '../utils/logger.js';
import type { NextFunction, Request, Response } from 'express';

function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (/\.(svg|png|jpg|jpeg|gif|ico|css|js|map|woff|woff2|ttf)$/i.test(req.path)) {
    return next();
  }

  const start = Date.now();
  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const message = `${req.method} ${req.originalUrl || req.url} ${statusCode} (${duration}ms) - IP: ${ip} - UA: ${userAgent}`;

    if (statusCode >= 500) {
      logger.app.error(message, {
        body: sanitizeObject(req.body),
        duration,
        ip,
        method: req.method,
        query: sanitizeObject(req.query),
        statusCode,
        url: req.originalUrl,
      });
    } else if (statusCode >= 400) {
      logger.app.warn(message, {
        duration,
        ip,
        method: req.method,
        statusCode,
        url: req.originalUrl,
      });
    } else {
      logger.app.info(message);
    }
  });

  next();
}

function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = getClientIp(req);
  const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  const clientMessage = statusCode === 404
    ? 'Resource not found.'
    : 'An unexpected error occurred while processing the request. Please try again later.';

  logger.error(`[UnhandledError] ${req.method} ${req.originalUrl} (${statusCode}) - IP: ${ip}`, {
    error: err.message,
    ip,
    method: req.method,
    name: err.name,
    payload: sanitizeObject(req.body),
    query: sanitizeObject(req.query),
    stack: err.stack,
    url: req.originalUrl,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json({
    code: err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
    error: clientMessage,
    message: clientMessage,
    ok: false,
    success: false,
  });
}

export {
  errorHandlerMiddleware,
  httpLoggerMiddleware
};
