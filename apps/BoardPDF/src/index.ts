import { checkDatabaseConnection, getDbPool } from './config/database.config.js';
import { config } from './config/env.config.js';
import { checkRedisConnection, redis } from './config/redis.config.js';
import { ensureBucketExists, isS3Configured, S3_BUCKET_NAME, s3Client } from './config/s3.config.js';
import { injectHtmlSeo, isSupportedLanguage, normalizeLanguageCode } from './config/seo.config.js';
import { csrfProtection } from './middlewares/csrf.middleware.js';
import { requestLogger } from './middlewares/request-logger.middleware.js';
import { originProtection, securityHeaders } from './middlewares/security-headers.middleware.js';
import aiTokenRoutes from './routes/ai-token.routes.js';
import authRoutes from './routes/auth.routes.js';
import downloadRoutes from './routes/download.routes.js';
import seoRoutes from './routes/seo.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import ssoRoutes from './routes/sso.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import toolsRoutes from './routes/tools.routes.js';
import { logger } from './services/logger.service.js';
import { startColdStorageCron } from './services/storage-quota.service.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';

let isShuttingDown = false;

function configureServerResilience(server: http.Server): void {
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.app.warn(`Señal ${signal} interceptada. Iniciando drenaje y apagado ordenado...`);

    const forceExitTimer = setTimeout(() => {
      logger.app.error('Timeout de Graceful Shutdown expirado (15s). Forzando cierre del proceso.');
      process.exit(1);
    }, 15000);
    forceExitTimer.unref();

    server.close(async () => {
      logger.app.info('Servidor HTTP cerrado. Procediendo a liberar conexiones de persistencia...');
      try {
        const pool = getDbPool();
        await pool.end();
        logger.db.info('Pool de MySQL drenado y finalizado correctamente.');
      } catch (err) {
        logger.db.error('Error cerrando el pool de MySQL:', err);
      }

      try {
        await redis.quit();
        logger.db.info('Conexión con Redis cerrada ordenadamente.');
      } catch (err) {
        logger.db.error('Error cerrando cliente Redis:', err);
      }

      logger.app.info('Apagado completado con éxito. Saliendo de Node.js (código 0).');
      process.exit(0);
    });

    if (typeof (server as any).closeIdleConnections === 'function') {
      (server as any).closeIdleConnections();
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (err: Error) => {
    logger.app.error('Excepción crítica no controlada. Saliendo para reinicio limpio:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.app.error('Rechazo de promesa no gestionado en proceso Node.js:', reason);
  });
}

async function setupClient(app: express.Express, server: http.Server): Promise<void> {
  if (config.nodeEnv !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      configFile: false,
      appType: 'spa',
      publicDir: path.resolve(process.cwd(), 'public'),
      resolve: {
        alias: {
          '@client': path.resolve(process.cwd(), 'client'),
        },
      },
      server: {
        middlewareMode: true,
        watch: {
          binaryInterval: 1000,
          ignored: [
            '**/.git/**',
            '**/board-wasm/**',
            '**/collab-server/**',
            '**/data/**',
            '**/dist/**',
            '**/logs/**',
            '**/node_modules/**',
            '**/public/uploads/**',
            '**/scripts/**',
            '**/target/**',
            '**/test/**',
            '**/tests/**',
          ],
          interval: 500,
          usePolling: true,
        },
        ws: { server },
      },
    });
    app.use(vite.middlewares);

    app.get('/', (req: Request, res: Response) => {
      const acceptLang = req.headers['accept-language'];
      let targetLang = 'es';
      if (acceptLang) {
        const langs = acceptLang.split(',').map((l) => l.split(';')[0].trim().toLowerCase());
        for (const al of langs) {
          const norm = normalizeLanguageCode(al);
          if (norm && isSupportedLanguage(norm)) {
            targetLang = norm;
            break;
          }
        }
      }
      res.redirect(302, `/${targetLang}`);
    });

    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || req.path.startsWith('/api')) {
        res.status(404).json({
          error: 'Endpoint de API no encontrado.',
          success: false,
        });
        return;
      }
      try {
        const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
        const baseUrl = config.baseUrl && !config.baseUrl.includes('localhost') ? config.baseUrl : `${proto}://${host}`;
        const transformed = await vite.transformIndexHtml(url, template);
        const html = injectHtmlSeo(transformed, req.path, baseUrl);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const clientDist = path.join(process.cwd(), 'dist/client');
    app.use(
      express.static(clientDist, {
        immutable: true,
        index: false,
        maxAge: '1y',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );

    app.get('/', (req: Request, res: Response) => {
      const acceptLang = req.headers['accept-language'];
      let targetLang = 'es';
      if (acceptLang) {
        const langs = acceptLang.split(',').map((l) => l.split(';')[0].trim().toLowerCase());
        for (const al of langs) {
          const norm = normalizeLanguageCode(al);
          if (norm && isSupportedLanguage(norm)) {
            targetLang = norm;
            break;
          }
        }
      }
      res.redirect(302, `/${targetLang}`);
    });

    app.get('*', (req: Request, res: Response) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || req.path.startsWith('/api')) {
        res.status(404).json({
          error: 'Endpoint de API no encontrado.',
          success: false,
        });
        return;
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      try {
        const template = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf-8');
        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
        const baseUrl = config.baseUrl && !config.baseUrl.includes('localhost') ? config.baseUrl : `${proto}://${host}`;
        const html = injectHtmlSeo(template, req.path, baseUrl);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch {
        res.sendFile(path.join(clientDist, 'index.html'));
      }
    });
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    logger.app.error('Error no controlado en middleware o ruta', err);
    if (res.headersSent) {
      return next(err);
    }
    const statusCode = typeof err.status === 'number' ? err.status : 500;
    res.status(statusCode).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  });
}

async function startServer(): Promise<void> {
  void checkDatabaseConnection();
  void checkRedisConnection();
  void ensureBucketExists();
  const app = express();
  app.set('trust proxy', 1);
  app.use(originProtection());
  app.use(securityHeaders());
  const server = http.createServer(app);

  app.use(compression({
    level: 6,
    threshold: 512,
  }));
  const publicDir = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(
      express.static(publicDir, {
        etag: true,
        lastModified: true,
        maxAge: '1d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.endsWith('.html')) {
            if (config.nodeEnv !== 'production') {
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            } else {
              res.setHeader('Cache-Control', 'no-cache, must-revalidate');
            }
          } else if (filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            if (config.nodeEnv !== 'production') {
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            } else {
              res.setHeader('Cache-Control', 'no-cache, must-revalidate');
            }
          } else if (filePath.endsWith('.json')) {
            if (config.nodeEnv !== 'production') {
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            } else {
              res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
            }
          } else if (filePath.endsWith('.svg') || filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.webp') || filePath.endsWith('.woff2')) {
            res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
          }
        },
      })
    );
  }

  app.use(express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(csrfProtection);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      name: 'BoardPDF',
      status: 'ok',
      uptime: process.uptime(),
    });
  });

  app.get('/api/health/liveness', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get('/api/health/readiness', async (_req: Request, res: Response) => {
    if (isShuttingDown) {
      res.status(503).json({
        message: 'Servidor en proceso de apagado.',
        status: 'terminating',
      });
      return;
    }

    const dependencies = {
      database: false,
      redis: false,
      s3: true,
    };

    try {
      const pool = getDbPool();
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      dependencies.database = true;
    } catch (err) {
      logger.db.error('Fallo en healthcheck de MySQL:', err);
    }

    try {
      if (redis.status === 'ready' || redis.status === 'connect') {
        const pong = await redis.ping();
        dependencies.redis = pong === 'PONG';
      }
    } catch (err) {
      logger.db.error('Fallo en healthcheck de Redis:', err);
    }

    const isReady = dependencies.database && dependencies.redis;
    const httpStatus = isReady ? 200 : 503;

    res.status(httpStatus).json({
      dependencies,
      status: isReady ? 'ready' : 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', aiTokenRoutes);
  app.use('/api', authRoutes);
  app.use('/api', downloadRoutes);
  app.use('/api', settingsRoutes);
  app.use('/api', ssoRoutes);
  app.use('/api', subscriptionRoutes);
  app.use('/api', toolsRoutes);
  app.use(seoRoutes);

  app.get('/uploads/collaborative/:filename', async (req: Request, res: Response) => {
    const filename = path.basename(req.params.filename);
    const s3Key = `uploads/collaborative/${filename}`;

    if (isS3Configured()) {
      try {
        const s3Res = await s3Client.send(
          new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key,
          })
        );
        if (s3Res.Body) {
          const ext = path.extname(filename).toLowerCase();
          let mime = s3Res.ContentType || 'application/octet-stream';
          if (ext === '.png') mime = 'image/png';
          else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
          else if (ext === '.webp') mime = 'image/webp';
          else if (ext === '.svg') mime = 'image/svg+xml';
          else if (ext === '.pdf') mime = 'application/pdf';

          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
          if (s3Res.ETag) res.setHeader('ETag', s3Res.ETag);
          (s3Res.Body as any).pipe(res);
          return;
        }
      } catch (err: any) {
        if (err?.name !== 'NoSuchKey') {
          logger.app.warn('Aviso al recuperar archivo de S3', err);
        }
      }
    }

    const localPath = path.resolve(process.cwd(), 'public', 'uploads', 'collaborative', filename);
    if (fs.existsSync(localPath)) {
      res.sendFile(localPath);
      return;
    }

    res.status(404).end();
  });

  await setupClient(app, server);

  const port = config.port;
  configureServerResilience(server);
  server.listen(port, () => {
    logger.app.info(`Servidor BoardPDF iniciado en http://localhost:${port}`);
    startColdStorageCron();
  });
}

void startServer();

