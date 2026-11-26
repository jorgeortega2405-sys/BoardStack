import {
  clearAdminSessionCookie,
  completeAdminLogin,
  verifyPassword,
} from '../services/auth.service.js';
import {
  consume2FALoginTicket,
  create2FALoginTicket,
  verify2FALoginTicket,
  verifyTotpCode,
} from '../services/two-factor.service.js';
import {
  findUserByEmail,
  findUserById,
  getUser2FASecret,
  getUserPreferences,
  updateUserPreferences,
  verifyAndConsumeBackupCode,
} from '../services/user.service.js';
import { getAdminRequestSession, getValidatedAdminSession } from '../middlewares/auth.middleware.js';
import { getClientIp } from '../utils/ip.util.js';
import { getUserAdminAccess } from '../services/admin-access.service.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';
import { sanitizeAdminUser } from '../utils/user.util.js';

async function login(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const { email, password, tempToken, twoFactorCode } = req.body || {};

    if (tempToken && twoFactorCode) {
      const userId = verify2FALoginTicket(String(tempToken));
      if (!userId) {
        logger.auth.warn(`[AdminLogin2FA] Invalid or expired 2FA ticket from IP ${clientIp}`);
        res.status(401).json({ error: 'Two-factor session expired. Please log in again.', ok: false });
        return;
      }

      const userRow = await findUserById(userId);
      if (!userRow || userRow.status !== 'active') {
        res.status(403).json({ error: 'This account is inactive or unavailable.', ok: false });
        return;
      }

      const access = await getUserAdminAccess(userRow.id);
      if (!access.hasAccess) {
        logger.auth.warn(`[AdminLogin2FA] Access denied for user ID ${userRow.id} (${userRow.email}) from IP ${clientIp}`);
        res.status(403).json({
          code: 'ADMIN_ACCESS_DENIED',
          error: 'You do not have permission to access the administration panel.',
          ok: false,
        });
        return;
      }

      const twoFactorData = await getUser2FASecret(userRow.id);
      const cleanCode = String(twoFactorCode).trim();
      let is2faValid = false;

      if (/^\d{6}$/.test(cleanCode) && twoFactorData?.two_factor_secret) {
        if (verifyTotpCode(cleanCode, twoFactorData.two_factor_secret, 2)) {
          is2faValid = true;
        }
      }

      if (!is2faValid) {
        const backupConsumed = await verifyAndConsumeBackupCode(userRow.id, cleanCode);
        if (backupConsumed) {
          is2faValid = true;
        }
      }

      if (!is2faValid) {
        logger.auth.warn(`[AdminLogin2FA] Invalid 2FA code for user ID ${userRow.id} from IP ${clientIp}`);
        res.status(401).json({ error: 'Invalid two-factor authentication code or backup code.', ok: false });
        return;
      }

      consume2FALoginTicket(String(tempToken));
      logger.auth.info(`[AdminLogin2FA] Successful admin login for user ID ${userRow.id} (${userRow.email}) from IP ${clientIp}`);

      const result = await completeAdminLogin(res, userRow, access.isSuperAdmin, access.accessibleApps, clientIp);
      res.status(200).json({
        accessibleApps: result.accessibleApps,
        message: 'Login successful.',
        ok: true,
        user: result.user,
      });
      return;
    }

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.', ok: false });
      return;
    }

    if (email.trim().length > 254 || password.length > 128) {
      res.status(401).json({ error: 'Invalid credentials.', ok: false });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const userRow = await findUserByEmail(trimmedEmail);

    if (!userRow || !userRow.password_hash) {
      logger.auth.warn(`[AdminLogin] Failed login attempt for ${trimmedEmail} from IP ${clientIp}`);
      res.status(401).json({ error: 'Invalid credentials.', ok: false });
      return;
    }

    const isMatch = await verifyPassword(password, userRow.password_hash);
    if (!isMatch) {
      logger.auth.warn(`[AdminLogin] Invalid password for user ID ${userRow.id} (${trimmedEmail}) from IP ${clientIp}`);
      res.status(401).json({ error: 'Invalid credentials.', ok: false });
      return;
    }

    if (userRow.status !== 'active') {
      logger.auth.warn(`[AdminLogin] Suspended account attempt for user ID ${userRow.id} (${trimmedEmail}) from IP ${clientIp}`);
      res.status(403).json({ error: 'This account is suspended or inactive.', ok: false });
      return;
    }

    const access = await getUserAdminAccess(userRow.id);
    if (!access.hasAccess) {
      logger.auth.warn(`[AdminLogin] Denied admin panel entry for user ID ${userRow.id} (${trimmedEmail}) from IP ${clientIp}`);
      res.status(403).json({
        code: 'ADMIN_ACCESS_DENIED',
        error: 'You do not have permission to access the administration panel.',
        ok: false,
      });
      return;
    }

    if (userRow.two_factor_enabled) {
      const ticket = create2FALoginTicket(userRow.id);
      logger.auth.info(`[AdminLogin] 2FA required for user ID ${userRow.id} (${trimmedEmail}) from IP ${clientIp}`);
      res.status(200).json({
        message: 'Two-factor authentication code required.',
        ok: true,
        requires2FA: true,
        tempToken: ticket,
      });
      return;
    }

    logger.auth.info(`[AdminLogin] Successful admin login for user ID ${userRow.id} (${trimmedEmail}) from IP ${clientIp}`);
    const result = await completeAdminLogin(res, userRow, access.isSuperAdmin, access.accessibleApps, clientIp);

    res.status(200).json({
      accessibleApps: result.accessibleApps,
      message: 'Login successful.',
      ok: true,
      user: result.user,
    });
  } catch (error) {
    logger.auth.error('[AdminLogin] Error in login:', error);
    res.status(500).json({ error: 'Error logging in. Please try again later.', ok: false });
  }
}

async function me(req: Request, res: Response): Promise<void> {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const session = await getValidatedAdminSession(req, res);
    if (!session) {
      res.status(200).json({
        accessibleApps: [],
        ok: true,
        user: null,
      });
      return;
    }

    res.status(200).json({
      accessibleApps: session.access.accessibleApps,
      ok: true,
      user: sanitizeAdminUser(session.user, session.access.isSuperAdmin),
    });
  } catch (error) {
    logger.auth.error('[AdminMe] Error retrieving current session:', error);
    res.status(500).json({ error: 'Error retrieving current session.', ok: false });
  }
}

async function logout(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  clearAdminSessionCookie(res);
  logger.auth.info(`[AdminLogout] Admin session cleared from IP ${clientIp}`);
  res.status(200).json({
    accessibleApps: [],
    ok: true,
    user: null,
  });
}

async function getPreferences(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      res.status(401).json({ error: 'Authentication required.', ok: false });
      return;
    }
    const preferences = await getUserPreferences(session.user.id);
    res.status(200).json({ ok: true, preferences });
  } catch (error) {
    logger.app.error('[AdminSettings] Error fetching preferences:', error);
    res.status(500).json({ error: 'Error fetching preferences.', ok: false });
  }
}

async function updatePreferences(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      res.status(401).json({ error: 'Authentication required.', ok: false });
      return;
    }
    const preferences = await updateUserPreferences(session.user.id, req.body || {});
    res.status(200).json({
      message: 'Preferences updated successfully.',
      ok: true,
      preferences,
    });
  } catch (error) {
    logger.app.error('[AdminSettings] Error updating preferences:', error);
    res.status(500).json({ error: 'Error saving preferences.', ok: false });
  }
}

export {
  getPreferences,
  login,
  logout,
  me,
  updatePreferences
};
