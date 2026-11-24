import authRoutes from './routes/auth.routes.js';
import { cleanupExpiredRoomsAndFiles } from './services/room.service.js';
import compression from 'compression';
import { config } from './config/env.config.js';
import cookieParser from 'cookie-parser';
import { csrfProtectionMiddleware } from './middlewares/csrf.middleware.js';
import { errorHandlerMiddleware, httpLoggerMiddleware } from './middlewares/logger.middleware.js';
import { escapeHtml } from './utils/html.util.js';
import express, { Request, Response } from 'express';
import fs from 'fs';
import { getLinkedAccounts, getValidatedCurrentUser } from './middlewares/auth.middleware.js';
import http from 'http';
import { initS3Bucket } from './services/s3.service.js';
import { logger } from './utils/logger.js';
import net from 'net';
import organizationRoutes from './routes/organization.routes.js';
import path from 'path';
import { pool, testDatabaseConnection } from './config/database.config.js';
import roomRoutes from './routes/room.routes.js';
import salesLeadRoutes from './routes/sales-lead.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import { testRedisConnection } from './config/redis.config.js';

const app = express();
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

async function runDatabaseHousekeeping(): Promise<void> {
  try {
    await pool.execute('DELETE FROM verification_codes WHERE expires_at < CURRENT_TIMESTAMP');
    await pool.execute('DELETE FROM password_resets WHERE expires_at < CURRENT_TIMESTAMP OR used = TRUE');
    await cleanupExpiredRoomsAndFiles();
  } catch (error) {
    logger.system.error('[Housekeeping] Error cleaning expired tokens:', error);
  }
}

setInterval(() => {
  void runDatabaseHousekeeping();
}, 3600000);

app.use('/api', authRoutes);
app.use('/api', organizationRoutes);
app.use('/api', roomRoutes);
app.use('/api', salesLeadRoutes);
app.use('/api', settingsRoutes);
app.use('/api', subscriptionRoutes);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    app: 'BoardStack',
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

const appRoot = fs.existsSync(path.resolve(process.cwd(), 'apps/app/public'))
  ? path.resolve(process.cwd(), 'apps/app')
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

interface RouteSeo {
  description: string;
  title: string;
}

const ROUTE_SEO: Record<string, RouteSeo> = {
  '/': {
    description: 'BoardStack ofrece una interfaz modular de alta precisión con arquitectura basada en componentes y diseño avanzado.',
    title: 'BoardStack - Plataforma Creativa Modular',
  },
  '/checkout': {
    description: 'Finaliza tu suscripción en BoardStack con procesamiento seguro.',
    title: 'Completar Suscripción - BoardStack',
  },
  '/contact-sales': {
    description: 'Ponte en contacto con nuestro equipo de ventas para obtener el plan de suscripción Empresas a medida.',
    title: 'Hablar con Ventas - BoardStack Negocios',
  },
  '/forgot-password': {
    description: 'Restablece el acceso a tu cuenta de BoardStack de forma rápida y segura.',
    title: 'Recuperar Contraseña - BoardStack',
  },
  '/help': {
    description: 'Consulta los términos de servicio y políticas legales de BoardStack.',
    title: 'Ayuda y Términos - BoardStack',
  },
  '/help/cookies': {
    description: 'Información sobre el uso de cookies y tecnologías similares en BoardStack.',
    title: 'Política de Cookies - BoardStack',
  },
  '/help/privacy': {
    description: 'Conoce cómo recopilamos, usamos y protegemos tu información personal.',
    title: 'Política de Privacidad - BoardStack',
  },
  '/help/security': {
    description: 'Conoce nuestras medidas y protocolos de seguridad en BoardStack.',
    title: 'Política de Seguridad - BoardStack',
  },
  '/help/terms': {
    description: 'Términos y condiciones legales de uso de BoardStack.',
    title: 'Términos y Condiciones - BoardStack',
  },
  '/login': {
    description: 'Inicia sesión en tu cuenta de BoardStack para acceder a tu espacio de trabajo.',
    title: 'Iniciar Sesión - BoardStack',
  },
  '/pricing': {
    description: 'Conoce los planes y opciones de suscripción de BoardStack para creadores y desarrolladores.',
    title: 'Planes y Precios - BoardStack',
  },
  '/register': {
    description: 'Regístrate gratis en BoardStack y disfruta de una experiencia modular avanzada.',
    title: 'Crear una Cuenta - BoardStack',
  },
  '/reset-password': {
    description: 'Crea una nueva contraseña segura para tu cuenta en BoardStack.',
    title: 'Restablecer Contraseña - BoardStack',
  },
  '/room': {
    description: 'Sala de transferencia y colaboración en tiempo real.',
    title: 'Sala de Transferencia - BoardStack',
  },
  '/settings': {
    description: 'Administra tus preferencias de cuenta, tema visual, accesibilidad y seguridad.',
    title: 'Configuración - BoardStack',
  },
  '/organization': {
    description: 'Administra tu organización, configuración de SAML 2.0 y gestión de asientos empresariales.',
    title: 'Organización - BoardStack',
  },
  '/organization/details': {
    description: 'Configura el nombre público, slug y dominio corporativo de tu organización.',
    title: 'Detalles de la Organización - BoardStack',
  },
  '/organization/members': {
    description: 'Administra los miembros de tu equipo y los asientos de tu suscripción empresarial.',
    title: 'Gestionar Asientos y Equipo - BoardStack',
  },
  '/organization/saml': {
    description: 'Configura la integración de Single Sign-On (SSO) con SAML 2.0 para tu empresa.',
    title: 'Configuración SAML 2.0 y SSO - BoardStack',
  },
  '/settings/organization': {
    description: 'Administra tu organización, configuración de SAML 2.0 y gestión de asientos empresariales.',
    title: 'Organización - BoardStack',
  },
  '/settings/organization/details': {
    description: 'Configura el nombre público, slug y dominio corporativo de tu organización.',
    title: 'Detalles de la Organización - BoardStack',
  },
  '/settings/organization/members': {
    description: 'Administra los miembros de tu equipo y los asientos de tu suscripción empresarial.',
    title: 'Gestionar Asientos y Equipo - BoardStack',
  },
  '/settings/organization/saml': {
    description: 'Configura la integración de Single Sign-On (SSO) con SAML 2.0 para tu empresa.',
    title: 'Configuración SAML 2.0 y SSO - BoardStack',
  },
  '/settings/accessibility': {
    description: 'Personaliza el tema visual, modo alto contraste y movimiento reducido.',
    title: 'Accesibilidad - BoardStack',
  },
  '/settings/account': {
    description: 'Gestiona la información de tu perfil, correo electrónico y preferencias personales.',
    title: 'Tu Cuenta - BoardStack',
  },
  '/settings/billing': {
    description: 'Administra tus métodos de pago, historial de compras y suscripciones activas.',
    title: 'Facturación - BoardStack',
  },
  '/settings/guest': {
    description: 'Ajusta las preferencias locales de tu sesión en BoardStack.',
    title: 'Configuración de Invitado - BoardStack',
  },
  '/settings/purchases': {
    description: 'Consulta tus transacciones anteriores y recibos en BoardStack.',
    title: 'Historial de Compras - BoardStack',
  },
  '/settings/security': {
    description: 'Configura la seguridad de tu cuenta, autenticación de dos pasos y contraseñas.',
    title: 'Seguridad - BoardStack',
  },
};

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

  const indexData = getIndexTemplate();
  if (!indexData) {
    return res.status(404).send('BoardStack: index.html not found');
  }

  try {
    let html = indexData.content;
    const seo = ROUTE_SEO[normRoute] || ROUTE_SEO['/'];
    const appBaseUrl = config.appUrl.replace(/\/+$/, '');
    const localizedUrl = `${appBaseUrl}/${lang}${normRoute === '/' ? '' : normRoute}`;

    const user = await getValidatedCurrentUser(req, res);
    const accounts = user ? getLinkedAccounts(req) : [];
    const isAuth = ['/login', '/register', '/forgot-password', '/reset-password'].includes(normRoute);

    const htmlClasses: string[] = [];
    if (isAuth) {
      htmlClasses.push('is-auth-view');
    }

    const classAttr = htmlClasses.length > 0 ? ` class="${htmlClasses.join(' ')}"` : '';
    html = html.replace(/<html[^>]*>/i, `<html lang="${lang}"${classAttr} data-theme="light">`);

    html = html.replace(/<title>.*?<\/title>/i, `<title>${seo.title}</title>`);
    html = html.replace(/<meta\s+name="description"\s+content="[^"]*"/i, `<meta name="description" content="${seo.description}"`);
    html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"/i, `<link rel="canonical" href="${localizedUrl}"`);

    html = html.replace(/<meta\s+property="og:url"\s+content="[^"]*"/i, `<meta property="og:url" content="${localizedUrl}"`);
    html = html.replace(/<meta\s+property="og:title"\s+content="[^"]*"/i, `<meta property="og:title" content="${seo.title}"`);
    html = html.replace(/<meta\s+property="og:description"\s+content="[^"]*"/i, `<meta property="og:description" content="${seo.description}"`);
    html = html.replace(/<meta\s+property="og:locale"\s+content="[^"]*"/i, `<meta property="og:locale" content="${lang === 'es' ? 'es_ES' : `${lang}_${lang.toUpperCase()}`}"`);

    html = html.replace(/<meta\s+name="twitter:url"\s+content="[^"]*"/i, `<meta name="twitter:url" content="${localizedUrl}"`);
    html = html.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"/i, `<meta name="twitter:title" content="${seo.title}"`);
    html = html.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"/i, `<meta name="twitter:description" content="${seo.description}"`);

    const sessionPayload = user ? { accounts, user } : null;
    const sessionScript = `<script>window.__INITIAL_SESSION__ = ${JSON.stringify(sessionPayload).replace(/</g, '\\u003c')};</script>\n</head>`;
    html = html.replace('</head>', sessionScript);

    if (isAuth) {
      html = html.replace('class="component-nav"', 'class="component-nav is-hidden"');
      html = html.replace('class="component-wrapper component-wrapper--full"', 'class="component-wrapper component-wrapper--full is-hidden"');
    }

    if (user) {
      html = html.replace('class="component-rail__item" data-ref="rail-item-login"', 'class="component-rail__item is-hidden" data-ref="rail-item-login"');
      html = html.replace('class="component-rail__user-box is-hidden" data-ref="avatar-container"', 'class="component-rail__user-box" data-ref="avatar-container"');

      const avatarSrc = (user.avatar_url && user.avatar_url.trim() !== '')
        ? escapeHtml(user.avatar_url)
        : `/api/avatar?name=${encodeURIComponent(user.username || user.email || 'User')}&size=80`;

      const placeholderDataUri = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
      html = html.replace(`data-ref="avatar-img" src="${placeholderDataUri}"`, `data-ref="avatar-img" src="${avatarSrc}"`);
      html = html.replace(`data-ref="active-account-avatar" src="${placeholderDataUri}"`, `data-ref="active-account-avatar" src="${avatarSrc}"`);

      const tier = (user.subscription_tier === 'enterprise' || user.subscription_tier === 'pro') ? user.subscription_tier : 'free';
      html = html.replace('data-ref="btn-avatar"', `data-ref="btn-avatar" data-tier="${tier}"`);
      html = html.replace('data-ref="active-account-avatar-box"', `data-ref="active-account-avatar-box" data-tier="${tier}"`);

      const safeName = escapeHtml(user.username || '');
      const safeEmail = escapeHtml(user.email || '');
      html = html.replace('<span class="account-item__name" data-ref="active-account-name"></span>', `<span class="account-item__name" data-ref="active-account-name">${safeName}</span>`);
      html = html.replace('<span class="account-item__email" data-ref="active-account-email"></span>', `<span class="account-item__email" data-ref="active-account-email">${safeEmail}</span>`);
    } else {
      html = html.replace('class="component-rail__item" data-ref="rail-item-settings"', 'class="component-rail__item is-hidden" data-ref="rail-item-settings"');
    }

    res.type('html').send(html);
  } catch (err) {
    logger.system.error('Error serving index.html:', err);
    res.sendFile(indexData.path);
  }
});

app.use(errorHandlerMiddleware);

const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/ws/room')) {
    const proxySocket = net.connect(config.roomServer.port, config.roomServer.host, () => {
      let rawHeaders = '';
      if (req.rawHeaders && req.rawHeaders.length > 0) {
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          rawHeaders += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
        }
      } else {
        rawHeaders = Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}\r\n`)
          .join('');
      }

      proxySocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${rawHeaders}\r\n`);
      if (head && head.length > 0) {
        proxySocket.write(head);
      }
      socket.pipe(proxySocket);
      proxySocket.pipe(socket);
    });

    proxySocket.on('error', (err) => {
      logger.system.error('[WebSocket Proxy] Error connecting to room-server:', err);
      socket.destroy();
    });

    socket.on('error', () => {
      if (!proxySocket.destroyed) {
        proxySocket.destroy();
      }
    });

    proxySocket.on('close', () => {
      if (!socket.destroyed) {
        socket.destroy();
      }
    });

    socket.on('close', () => {
      if (!proxySocket.destroyed) {
        proxySocket.destroy();
      }
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, HOST, async () => {
  logger.system.info(`[BoardStack] Server listening on http://${HOST}:${PORT}`);
  void testDatabaseConnection();
  void testRedisConnection();
  void initS3Bucket();
  void runDatabaseHousekeeping();
});

const gracefulShutdown = (signal: string) => {
  logger.system.info(`[BoardStack] Signal ${signal} received. Closing HTTP server...`);
  server.close(() => {
    logger.system.info('[BoardStack] HTTP server closed gracefully.');
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