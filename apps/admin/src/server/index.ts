import adminRoutes from './routes/admin.routes.js';
import { appPool, corePool, testDatabaseConnection } from './config/database.config.js';
import authRoutes from './routes/auth.routes.js';
import compression from 'compression';
import { config } from './config/env.config.js';
import cookieParser from 'cookie-parser';
import { csrfProtectionMiddleware } from './middlewares/csrf.middleware.js';
import { errorHandlerMiddleware, httpLoggerMiddleware } from './middlewares/logger.middleware.js';
import { escapeHtml } from './utils/html.util.js';
import express, { Request, Response } from 'express';
import fs from 'fs';
import { getRedisClient, testRedisConnection } from './config/redis.config.js';
import { getValidatedAdminSession } from './middlewares/auth.middleware.js';
import http from 'http';
import { initS3Bucket } from './services/s3.service.js';
import { logger } from './utils/logger.js';
import { normalizeSubscriptionTier } from './utils/user.util.js';
import path from 'path';

const app = express();
app.set('trust proxy', 1);
const PORT = config.port;
const HOST = config.host;

app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(httpLoggerMiddleware);
app.use(csrfProtectionMiddleware);

app.use('/api', authRoutes);
app.use('/api', adminRoutes);

app.get('/api/health', async (_req: Request, res: Response) => {
  let dbOk = false;
  let redisOk = false;
  try {
    await corePool.query('SELECT 1');
    await appPool.query('SELECT 1');
    dbOk = true;
  } catch {}
  try {
    const redis = getRedisClient();
    if (redis && (await redis.ping()) === 'PONG') {
      redisOk = true;
    }
  } catch {}

  const isHealthy = dbOk && redisOk;
  res.status(isHealthy ? 200 : 503).json({
    app: 'BoardStack Admin',
    checks: {
      database: dbOk ? 'ok' : 'unreachable',
      redis: redisOk ? 'ok' : 'unreachable',
    },
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

const appRoot = fs.existsSync(path.resolve(process.cwd(), 'apps/admin/public'))
  ? path.resolve(process.cwd(), 'apps/admin')
  : process.cwd();

const clientDistPath = path.resolve(appRoot, 'dist/client');
const publicPath = path.resolve(appRoot, 'public');

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath, { index: false }));
}
app.use(express.static(publicPath, { index: false }));

const SUPPORTED_LANGS = [
  'es', 'en', 'de', 'fr', 'it', 'pt', 'ca', 'gl', 'eu', 'nl', 'pl',
  'ru', 'ja', 'zh', 'ko', 'ar', 'hi', 'tr', 'sv', 'da', 'fi', 'cs', 'el', 'id', 'uk'
];
const DEFAULT_LANG = 'es';

function detectLanguage(req: Request): string {
  const cookieLang = req.cookies?.app_language?.toLowerCase();
  if (cookieLang && SUPPORTED_LANGS.includes(cookieLang)) {
    return cookieLang;
  }

  const acceptLang = req.headers['accept-language'];
  if (acceptLang) {
    const preferred = acceptLang
      .split(',')
      .map((part) => {
        const [code, qVal] = part.trim().split(';q=');
        return {
          code: code.trim().slice(0, 2).toLowerCase(),
          q: qVal ? parseFloat(qVal) : 1.0,
        };
      })
      .sort((a, b) => b.q - a.q);

    for (const { code } of preferred) {
      if (SUPPORTED_LANGS.includes(code)) {
        return code;
      }
    }
  }

  return DEFAULT_LANG;
}

let cachedIndexHtml: string | null = null;
let cachedIndexPath: string | null = null;

function getIndexTemplate(): { content: string; path: string } | null {
  const prodIndex = path.join(clientDistPath, 'index.html');
  const rootIndex = path.resolve(appRoot, 'index.html');
  const resolvedPath = fs.existsSync(prodIndex) ? prodIndex : (fs.existsSync(rootIndex) ? rootIndex : null);

  if (!resolvedPath) {
    return null;
  }

  if (process.env.NODE_ENV === 'production' && cachedIndexPath === resolvedPath && cachedIndexHtml !== null) {
    return { content: cachedIndexHtml, path: resolvedPath };
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  if (process.env.NODE_ENV === 'production') {
    cachedIndexHtml = content;
    cachedIndexPath = resolvedPath;
  }
  return { content, path: resolvedPath };
}

app.get('*', async (req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found.', ok: false });
  }

  if (/\.[a-zA-Z0-9]{2,5}$/.test(req.path)) {
    return res.status(404).send('Not found');
  }

  const cleanPath = req.path.replace(/\/+$/, '') || '/';
  const segments = cleanPath.replace(/^\/+/, '').split('/');
  const firstSegment = segments[0]?.toLowerCase();

  if (!firstSegment || !SUPPORTED_LANGS.includes(firstSegment)) {
    const detectedLang = detectLanguage(req);
    const targetPath = cleanPath === '/' ? `/${detectedLang}` : `/${detectedLang}${cleanPath}`;
    const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    return res.redirect(302, `${targetPath}${queryString}`);
  }

  const lang = firstSegment;
  const remainingRoute = '/' + segments.slice(1).join('/');
  const normRoute = remainingRoute.replace(/\/+$/, '') || '/';

  const session = await getValidatedAdminSession(req, res, { includeAccounts: true });

  if (!session && normRoute !== '/login') {
    return res.redirect(302, `/${lang}/login`);
  }

  if (session && normRoute === '/') {
    const firstApp = session.access.accessibleApps[0];
    const firstPage = firstApp?.pages[0];
    if (firstApp && firstPage) {
      return res.redirect(302, `/${lang}/${firstApp.slug}/${firstPage.slug}`);
    }
  }

  const indexData = getIndexTemplate();
  if (!indexData) {
    return res.status(404).send('BoardStack Admin: index.html not found');
  }

  try {
    let html = indexData.content;
    const isAuth = normRoute === '/login';
    const appBaseUrl = config.appUrl.replace(/\/+$/, '');
    const localizedUrl = `${appBaseUrl}/${lang}${normRoute === '/' ? '' : normRoute}`;
    const seoTitle = isAuth ? 'Iniciar Sesión - BoardStack Admin' : 'Panel de Administración - BoardStack Admin';
    const seoDescription = 'Panel de administración centralizado de BoardStack.';

    const htmlClasses: string[] = [];
    if (isAuth) {
      htmlClasses.push('is-auth-view');
    }

    const classAttr = htmlClasses.length > 0 ? ` class="${htmlClasses.join(' ')}"` : '';
    html = html.replace(/<html[^>]*>/i, `<html lang="${lang}"${classAttr} data-theme="light">`);

    html = html.replace(/<title>.*?<\/title>/i, `<title>${seoTitle}</title>`);
    html = html.replace(/<meta\s+name="description"\s+content="[^"]*"/i, `<meta name="description" content="${seoDescription}"`);
    html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"/i, `<link rel="canonical" href="${localizedUrl}"`);

    const sessionPayload = session
      ? {
          accessibleApps: session.access.accessibleApps,
          accounts: session.accounts,
          user: session.user,
        }
      : null;
    const sessionScript = `<script>window.__INITIAL_SESSION__ = ${JSON.stringify(sessionPayload).replace(/</g, '\\u003c')};</script>\n</head>`;
    html = html.replace('</head>', sessionScript);

    if (isAuth) {
      html = html.replace('class="component-nav"', 'class="component-nav is-hidden"');
      html = html.replace('class="component-wrapper component-wrapper--full"', 'class="component-wrapper component-wrapper--full is-hidden"');
    }

    if (session) {
      const user = session.user;
      html = html.replace('class="component-rail__user-box is-hidden" data-ref="avatar-container"', 'class="component-rail__user-box" data-ref="avatar-container"');

      const avatarSrc = (user.avatar_url && user.avatar_url.trim() !== '')
        ? escapeHtml(user.avatar_url)
        : `/api/avatar?name=${encodeURIComponent(user.username || user.email || 'Admin')}&size=80`;

      const placeholderDataUri = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
      html = html.replace(`data-ref="avatar-img" src="${placeholderDataUri}"`, `data-ref="avatar-img" src="${avatarSrc}"`);
      html = html.replace(`data-ref="active-account-avatar" src="${placeholderDataUri}"`, `data-ref="active-account-avatar" src="${avatarSrc}"`);

      const tier = normalizeSubscriptionTier(user.subscription_tier);
      html = html.replace('data-ref="btn-avatar"', `data-ref="btn-avatar" data-tier="${tier}"`);
      html = html.replace('data-ref="active-account-avatar-box"', `data-ref="active-account-avatar-box" data-tier="${tier}"`);

      const safeName = escapeHtml(user.username || '');
      const safeEmail = escapeHtml(user.email || '');
      html = html.replace('<span class="account-item__name" data-ref="active-account-name"></span>', `<span class="account-item__name" data-ref="active-account-name">${safeName}</span>`);
      html = html.replace('<span class="account-item__email" data-ref="active-account-email"></span>', `<span class="account-item__email" data-ref="active-account-email">${safeEmail}</span>`);
    }

    res.type('html').send(html);
  } catch (err) {
    logger.system.error('Error serving index.html:', err);
    res.sendFile(indexData.path);
  }
});

app.use(errorHandlerMiddleware);

const server = http.createServer(app);

server.listen(PORT, HOST, async () => {
  logger.system.info(`[BoardStack Admin] Server listening on http://${HOST}:${PORT}`);
  void testDatabaseConnection();
  void testRedisConnection();
  void initS3Bucket();
});

const gracefulShutdown = (signal: string) => {
  logger.system.info(`[BoardStack Admin] Signal ${signal} received. Closing HTTP server...`);
  server.close(async () => {
    logger.system.info('[BoardStack Admin] HTTP server closed gracefully.');
    try {
      await corePool.end();
      await appPool.end();
    } catch {}
    try {
      const redis = getRedisClient();
      await redis?.quit();
    } catch {}
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err: Error) => {
  logger.error(`[Process] Uncaught Exception: ${err.message}`, {
    name: err.name,
    stack: err.stack,
  });
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('[Process] Unhandled Rejection:', {
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason,
  });
});

export default app;
