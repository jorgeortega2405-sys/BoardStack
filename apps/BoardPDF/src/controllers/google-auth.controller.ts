import { config } from '../config/env.config.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { addAccountToSession, updateActiveAccountInSession } from '../services/auth.service.js';
import { logger } from '../services/logger.service.js';
import { permissionService } from '../services/permission.service.js';
import { createUser, findUserByEmail, findUserByGoogleId, findUserById, generateUniqueUsername, linkGoogleAccount, unlinkGoogleAccount, updateUserLastLogin } from '../services/user.service.js';
import { sanitizeUser } from './auth.controller.js';
import crypto from 'crypto';
import type { Request, Response } from 'express';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export async function initiateGoogleAuth(req: Request, res: Response): Promise<void> {
  try {
    const action = req.query.action === 'connect' ? 'connect' : 'login';
    const redirect = typeof req.query.redirect === 'string' && req.query.redirect.startsWith('/') ? req.query.redirect : '/';
    const user = getCurrentUser(req);

    if (action === 'connect' && !user) {
      res.redirect('/login?error=session_expired');
      return;
    }

    const statePayload = {
      action,
      nonce: crypto.randomBytes(16).toString('hex'),
      redirect,
      timestamp: Date.now(),
      userId: user?.id || null,
    };
    const serialized = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', config.sessionSecret).update(serialized).digest('hex');
    const state = `${serialized}.${signature}`;

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', config.googleOAuth.clientId);
    authUrl.searchParams.set('redirect_uri', config.googleOAuth.callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('prompt', 'select_account');
    authUrl.searchParams.set('state', state);

    res.redirect(authUrl.toString());
  } catch (err) {
    logger.security.error('Error al iniciar Google OAuth', err);
    res.redirect('/login?error=google_failed');
  }
}

export async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  try {
    if (req.query.error) {
      logger.security.warn('Google OAuth denegado por el usuario', { error: req.query.error });
      res.redirect('/login?error=google_denied');
      return;
    }

    const { code, state } = req.query;
    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      res.redirect('/login?error=invalid_oauth');
      return;
    }

    const [serialized, signature] = state.split('.');
    if (!serialized || !signature) {
      res.redirect('/login?error=invalid_state');
      return;
    }

    const expectedSignature = crypto.createHmac('sha256', config.sessionSecret).update(serialized).digest('hex');
    if (signature !== expectedSignature) {
      logger.security.warn('Firma de estado Google OAuth inválida');
      res.redirect('/login?error=invalid_state');
      return;
    }

    let statePayload: { action: string; nonce: string; redirect: string; timestamp: number; userId: number | null };
    try {
      statePayload = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8'));
    } catch {
      res.redirect('/login?error=invalid_state');
      return;
    }

    if (Date.now() - statePayload.timestamp > 15 * 60 * 1000) {
      res.redirect('/login?error=oauth_timeout');
      return;
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      body: new URLSearchParams({
        client_id: config.googleOAuth.clientId,
        client_secret: config.googleOAuth.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.googleOAuth.callbackUrl,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      logger.security.error('Fallo al obtener token de Google', { error: errText });
      const failTarget = statePayload.action === 'connect' ? '/settings/your-account?error=google_token_failed' : '/login?error=google_token_failed';
      res.redirect(failTarget);
      return;
    }

    const tokens = await tokenRes.json() as { access_token?: string };
    if (!tokens.access_token) {
      res.redirect('/login?error=google_token_failed');
      return;
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      res.redirect('/login?error=google_profile_failed');
      return;
    }

    const profile = await profileRes.json() as {
      email?: string;
      name?: string;
      picture?: string;
      sub?: string;
    };

    if (!profile.sub || !profile.email) {
      res.redirect('/login?error=google_missing_info');
      return;
    }

    const googleId = String(profile.sub);
    const googleEmail = profile.email.toLowerCase().trim();
    const clientIp = getClientIp(req);

    if (statePayload.action === 'connect') {
      const current = getCurrentUser(req);
      const targetUserId = current?.id || statePayload.userId;
      if (!targetUserId) {
        res.redirect('/login?error=session_expired');
        return;
      }

      const existingOther = await findUserByGoogleId(googleId);
      if (existingOther && existingOther.id !== targetUserId) {
        res.redirect('/settings/your-account?error=google_already_linked');
        return;
      }

      await linkGoogleAccount(targetUserId, googleId, googleEmail);
      updateActiveAccountInSession(res, req, {
        google_connected: true,
        google_email: googleEmail,
      });
      logger.security.info('Cuenta de Google vinculada', { googleEmail, targetUserId });
      res.redirect('/settings/your-account?success=google_connected');
      return;
    }

    let userRow = await findUserByGoogleId(googleId);
    if (!userRow) {
      userRow = await findUserByEmail(googleEmail);
      if (userRow) {
        await linkGoogleAccount(userRow.id, googleId, googleEmail);
        userRow.google_id = googleId;
        userRow.google_email = googleEmail;
      }
    }

    if (!userRow) {
      const preferred = (profile.name || googleEmail.split('@')[0] || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20);
      const uniqueUsername = await generateUniqueUsername(preferred);
      await createUser({
        avatarUrl: null,
        email: googleEmail,
        googleEmail,
        googleId,
        passwordHash: null,
        registrationIp: clientIp,
        username: uniqueUsername,
      });
      userRow = await findUserByGoogleId(googleId);
    }

    if (userRow) {
      const permissions = await permissionService.getUserPermissions(
        userRow.id,
        userRow.subscription_tier,
        userRow.subscription_status
      );
      userRow.permissions = permissions;
      const user = sanitizeUser(userRow);
      void updateUserLastLogin(user.id, clientIp);
      await addAccountToSession(res, req, user);

      logger.security.info('Inicio de sesión exitoso con Google OAuth', { email: user.email, userId: user.id });
      const target = (typeof statePayload.redirect === 'string' && statePayload.redirect.startsWith('/')) ? statePayload.redirect : '/';
      res.redirect(target);
      return;
    }

    res.redirect('/login?error=google_failed');
  } catch (err) {
    logger.security.error('Error procesando callback de Google OAuth', err);
    res.redirect('/login?error=google_failed');
  }
}

export async function disconnectGoogleHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Debes iniciar sesión para realizar esta acción.', ok: false });
      return;
    }

    const fullUser = await findUserById(user.id);
    if (!fullUser || !fullUser.google_id) {
      res.status(400).json({ error: 'Tu cuenta no está vinculada con Google.', ok: false });
      return;
    }

    if (!fullUser.password_hash) {
      res.status(400).json({
        error: 'No puedes desconectar tu cuenta de Google porque no tienes una contraseña configurada. Para evitar perder el acceso a tu cuenta, crea una contraseña en la sección de Seguridad antes de desconectar Google.',
        ok: false,
      });
      return;
    }

    await unlinkGoogleAccount(user.id);
    updateActiveAccountInSession(res, req, {
      google_connected: false,
      google_email: null,
    });
    logger.security.info('Cuenta de Google desconectada', { userId: user.id });
    res.json({ message: 'Cuenta de Google desconectada exitosamente.', ok: true });
  } catch (err) {
    logger.security.error('Error al desconectar cuenta de Google', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}
