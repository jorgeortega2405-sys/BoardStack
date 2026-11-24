import { completeUserLogin } from '../services/auth.service.js';
import { config } from '../config/env.config.js';
import { create2FALoginTicket } from '../services/two-factor.service.js';
import { createSecurityActionTicket } from '../services/verification.service.js';
import {
  createUser,
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  generateUniqueUsername,
  linkGoogleAccount,
} from '../services/user.service.js';
import crypto from 'crypto';
import { escapeHtml } from '../utils/html.util.js';
import { getClientIp } from '../utils/ip.util.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';

interface GoogleAuthStatePayload {
  mode?: 'login' | 'verify';
  nonce: string;
  redirect: string;
  timestamp: number;
  userId?: number;
}

function isValidRedirect(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.includes('\\');
}

function sendGoogleVerifyPopupResponse(
  res: Response,
  payload: { code?: string; error?: string; ok: boolean; securityTicket?: string }
): void {
  const message = payload.ok
    ? 'Verification complete. You may close this window.'
    : payload.error || 'Google verification failed. You may close this window.';
  const serializedPayload = JSON.stringify({
    ...payload,
    ts: Date.now(),
    type: 'BOARDSTACK_GOOGLE_VERIFY',
  }).replace(/</g, '\\u003c');

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Google Verification</title>
  <link rel="stylesheet" href="/css/root.css" />
  <link rel="stylesheet" href="/css/components.css" />
</head>
<body>
  <div class="component-container component-container--auth" data-ref="google-verify-popup">
    <div class="component-card component-card--status" data-ref="google-verify-card">
      <p class="component-subtitle" data-ref="google-verify-status">${escapeHtml(message)}</p>
    </div>
  </div>
  <script>
    (function () {
      var data = ${serializedPayload};
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          var ch = new BroadcastChannel('boardstack_google_verify');
          ch.postMessage(data);
          ch.close();
        }
      } catch (e) {}
      try {
        localStorage.setItem('boardstack_google_verify_result', JSON.stringify(data));
      } catch (e) {}
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(data, window.location.origin);
        }
      } catch (e) {}
      try {
        window.close();
      } catch (e) {}
    })();
  </script>
</body>
</html>`);
}

function parseVerifiedState(state: unknown): GoogleAuthStatePayload | null {
  if (!state || typeof state !== 'string') return null;
  const [serialized, signature] = state.split('.');
  if (!serialized || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', config.sessionSecret).update(serialized).digest('hex');
  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    logger.auth.warn('[GoogleAuth] Invalid state signature');
    return null;
  }

  try {
    return JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8')) as GoogleAuthStatePayload;
  } catch {
    return null;
  }
}

async function initiateGoogleAuth(req: Request, res: Response): Promise<void> {
  const isVerifyMode = req.query.mode === 'verify';
  try {
    const activeUser = isVerifyMode ? getCurrentUser(req) : null;
    if (isVerifyMode && !activeUser) {
      sendGoogleVerifyPopupResponse(res, {
        code: 'SESSION_EXPIRED',
        error: 'Session expired. Please log in again.',
        ok: false,
      });
      return;
    }

    const redirect = isValidRedirect(req.query.redirect) ? req.query.redirect : '/';

    const statePayload: GoogleAuthStatePayload = {
      mode: isVerifyMode ? 'verify' : 'login',
      nonce: crypto.randomBytes(16).toString('hex'),
      redirect,
      timestamp: Date.now(),
      userId: isVerifyMode && activeUser ? activeUser.id : undefined,
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
    if (isVerifyMode && activeUser?.email) {
      authUrl.searchParams.set('login_hint', activeUser.email);
    }

    res.redirect(authUrl.toString());
  } catch (err) {
    logger.auth.error('[GoogleAuth] Error initiating Google OAuth:', err);
    if (isVerifyMode) {
      sendGoogleVerifyPopupResponse(res, {
        code: 'GOOGLE_FAILED',
        error: 'Unable to initiate Google verification.',
        ok: false,
      });
      return;
    }
    res.redirect('/login?error=google_failed');
  }
}

async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  let isVerifyMode = false;
  try {
    const { code, state } = req.query;
    const statePayload = parseVerifiedState(state);
    isVerifyMode = statePayload?.mode === 'verify';

    if (req.query.error) {
      logger.auth.warn(`[GoogleAuth] Google OAuth denied by user: ${req.query.error}`);
      if (isVerifyMode) {
        sendGoogleVerifyPopupResponse(res, {
          code: 'GOOGLE_CANCELLED',
          error: 'Google verification was cancelled.',
          ok: false,
        });
        return;
      }
      res.redirect('/login?error=google_denied');
      return;
    }

    if (!statePayload) {
      res.redirect('/login?error=invalid_state');
      return;
    }

    if (!code || typeof code !== 'string') {
      if (isVerifyMode) {
        sendGoogleVerifyPopupResponse(res, {
          code: 'INVALID_OAUTH',
          error: 'Invalid Google verification response.',
          ok: false,
        });
        return;
      }
      res.redirect('/login?error=invalid_oauth');
      return;
    }

    if (Date.now() - statePayload.timestamp > 15 * 60 * 1000) {
      if (isVerifyMode) {
        sendGoogleVerifyPopupResponse(res, {
          code: 'OAUTH_TIMEOUT',
          error: 'Google verification timed out. Please try again.',
          ok: false,
        });
        return;
      }
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
      logger.auth.error(`[GoogleAuth] Failed to exchange token: ${errText}`);
      if (isVerifyMode) {
        sendGoogleVerifyPopupResponse(res, {
          code: 'GOOGLE_FAILED',
          error: 'Failed to verify Google account.',
          ok: false,
        });
        return;
      }
      res.redirect('/login?error=google_token_failed');
      return;
    }

    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      if (isVerifyMode) {
        sendGoogleVerifyPopupResponse(res, {
          code: 'GOOGLE_FAILED',
          error: 'Failed to verify Google account.',
          ok: false,
        });
        return;
      }
      res.redirect('/login?error=google_token_failed');
      return;
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      if (isVerifyMode) {
        sendGoogleVerifyPopupResponse(res, {
          code: 'GOOGLE_FAILED',
          error: 'Unable to retrieve Google profile.',
          ok: false,
        });
        return;
      }
      res.redirect('/login?error=google_profile_failed');
      return;
    }

    const profile = (await profileRes.json()) as {
      email?: string;
      name?: string;
      picture?: string;
      sub?: string;
    };

    if (!profile.sub || !profile.email) {
      if (isVerifyMode) {
        sendGoogleVerifyPopupResponse(res, {
          code: 'GOOGLE_FAILED',
          error: 'Incomplete Google account information.',
          ok: false,
        });
        return;
      }
      res.redirect('/login?error=google_missing_info');
      return;
    }

    const googleId = String(profile.sub);
    const googleEmail = profile.email.toLowerCase().trim();

    if (isVerifyMode) {
      const targetUser = statePayload.userId ? await findUserById(statePayload.userId) : null;
      if (!targetUser) {
        sendGoogleVerifyPopupResponse(res, {
          code: 'USER_NOT_FOUND',
          error: 'User account not found.',
          ok: false,
        });
        return;
      }

      const matchesGoogleId = Boolean(targetUser.google_id && targetUser.google_id === googleId);
      const matchesPrimaryEmail = Boolean(!targetUser.google_id && targetUser.email.toLowerCase() === googleEmail);
      const matchesGoogleEmail = Boolean(targetUser.google_email && targetUser.google_email.toLowerCase() === googleEmail);

      if (!matchesGoogleId && !matchesPrimaryEmail && !matchesGoogleEmail) {
        sendGoogleVerifyPopupResponse(res, {
          code: 'ACCOUNT_MISMATCH',
          error: 'The selected Google account does not match your active account.',
          ok: false,
        });
        return;
      }

      if (matchesPrimaryEmail) {
        await linkGoogleAccount(targetUser.id, googleId, googleEmail);
      }

      const securityTicket = createSecurityActionTicket(targetUser.id);
      sendGoogleVerifyPopupResponse(res, { ok: true, securityTicket });
      return;
    }

    const clientIp = getClientIp(req);

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
      userRow = await createUser({
        avatarUrl: null,
        email: googleEmail,
        googleEmail,
        googleId,
        passwordHash: null,
        registrationIp: clientIp,
        username: uniqueUsername,
      });
    }

    if (userRow) {
      if (userRow.two_factor_enabled) {
        const ticket = create2FALoginTicket(userRow.id);
        logger.auth.info(`[GoogleAuth] 2FA required for user ID ${userRow.id} (${userRow.email}) from IP ${clientIp}`);
        res.redirect(`/login?requires2FA=true&tempToken=${encodeURIComponent(ticket)}`);
        return;
      }

      await completeUserLogin(res, req, userRow, clientIp);

      const target = isValidRedirect(statePayload.redirect) ? statePayload.redirect : '/';
      res.redirect(target);
      return;
    }

    res.redirect('/login?error=google_failed');
  } catch (err) {
    logger.auth.error('[GoogleAuth] Error in callback handler:', err);
    if (isVerifyMode) {
      sendGoogleVerifyPopupResponse(res, {
        code: 'GOOGLE_FAILED',
        error: 'Error completing Google verification.',
        ok: false,
      });
      return;
    }
    res.redirect('/login?error=google_failed');
  }
}

export {
  handleGoogleCallback,
  initiateGoogleAuth
};
