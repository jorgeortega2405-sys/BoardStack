import type { NextFunction, Request, Response } from 'express';

function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  const secFetchSite = req.headers['sec-fetch-site'];

  if (secFetchSite === 'cross-site') {
    res.status(403).json({ error: 'Cross-origin request blocked.', ok: false });
    return;
  }

  if (!origin && !referer) {
    res.status(403).json({ error: 'Cross-origin request blocked: missing verification headers.', ok: false });
    return;
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        res.status(403).json({ error: 'Cross-origin request blocked.', ok: false });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Invalid origin header.', ok: false });
      return;
    }
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost !== host) {
        res.status(403).json({ error: 'Cross-origin referer blocked.', ok: false });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Invalid referer header.', ok: false });
      return;
    }
  }

  next();
}

export {
  csrfProtectionMiddleware
};
