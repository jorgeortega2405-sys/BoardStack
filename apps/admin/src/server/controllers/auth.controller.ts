import {
  clearAdminSessionCookie,
  completeAdminLogin,
  getAdminSessionPayload,
  hydrateLinkedAdminAccounts,
  removeAccountFromAdminSession,
  switchAccountInAdminSession,
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
  getRevokedAtMap,
  getUser2FASecret,
  getUserPreferences,
  revokeAdminSessions,
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

      const result = await completeAdminLogin(res, req, userRow, access.isSuperAdmin, access.accessibleApps, clientIp);
      res.status(200).json({
        accessibleApps: result.accessibleApps,
        accounts: result.accounts,
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
    const result = await completeAdminLogin(res, req, userRow, access.isSuperAdmin, access.accessibleApps, clientIp);

    res.status(200).json({
      accessibleApps: result.accessibleApps,
      accounts: result.accounts,
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
    const session = await getValidatedAdminSession(req, res, { includeAccounts: true });
    if (!session) {
      res.status(200).json({
        accessibleApps: [],
        accounts: [],
        ok: true,
        user: null,
      });
      return;
    }

    res.status(200).json({
      accessibleApps: session.access.accessibleApps,
      accounts: session.accounts,
      ok: true,
      user: session.user,
    });
  } catch (error) {
    logger.auth.error('[AdminMe] Error retrieving current session:', error);
    res.status(500).json({ error: 'Error retrieving current session.', ok: false });
  }
}

async function switchAccount(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const targetUserId = Number(req.body?.userId);
    if (!targetUserId || !Number.isInteger(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ error: 'Invalid user identifier.', ok: false });
      return;
    }

    const payload = getAdminSessionPayload(req);
    if (!payload || !Array.isArray(payload.accounts) || payload.accounts.length === 0) {
      res.status(401).json({ error: 'Authentication required.', ok: false });
      return;
    }

    const targetEntry = payload.accounts.find((a) => a.id === targetUserId);
    if (!targetEntry) {
      res.status(400).json({ error: 'The requested account is not linked to this session.', ok: false });
      return;
    }

    const dbUser = await findUserById(targetUserId);
    if (!dbUser || dbUser.status !== 'active') {
      removeAccountFromAdminSession(res, req, targetUserId);
      res.status(403).json({ error: 'This account is inactive or unavailable.', ok: false });
      return;
    }

    const revokedAtMap = await getRevokedAtMap([targetUserId]);
    const revokedAt = revokedAtMap.get(targetUserId) || 0;
    const entryIat = targetEntry.iat || payload.iat || 0;
    if (revokedAt > 0 && (!entryIat || entryIat < revokedAt)) {
      removeAccountFromAdminSession(res, req, targetUserId);
      res.status(401).json({ error: 'The selected account session has expired.', ok: false });
      return;
    }

    const access = await getUserAdminAccess(Number(dbUser.id));
    if (!access.hasAccess) {
      removeAccountFromAdminSession(res, req, targetUserId);
      res.status(403).json({
        code: 'ADMIN_ACCESS_DENIED',
        error: 'You do not have permission to access the administration panel.',
        ok: false,
      });
      return;
    }

    const user = sanitizeAdminUser(dbUser, access.isSuperAdmin);
    const switchResult = switchAccountInAdminSession(res, req, user);
    if (!switchResult.success || !switchResult.session) {
      res.status(400).json({ error: 'Failed to switch account.', ok: false });
      return;
    }

    const accounts = await hydrateLinkedAdminAccounts(req, res, switchResult.session, user, access.isSuperAdmin);
    logger.auth.info(`[AdminSwitchAccount] Switched to account ID ${user.id} (${user.email}) from IP ${clientIp}`);

    res.status(200).json({
      accessibleApps: access.accessibleApps,
      accounts,
      message: 'Account switched successfully.',
      ok: true,
      user,
    });
  } catch (error) {
    logger.auth.error('[AdminSwitchAccount] Error switching account:', error);
    res.status(500).json({ error: 'Error switching account.', ok: false });
  }
}

async function logout(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const rawUserId = req.body?.userId;
    const targetUserId = rawUserId !== undefined ? Number(rawUserId) : undefined;
    const existingPayload = getAdminSessionPayload(req);
    const idToRevoke = targetUserId && !isNaN(targetUserId) ? targetUserId : existingPayload?.activeId;

    if (idToRevoke) {
      await revokeAdminSessions(idToRevoke);
    }

    const removed = removeAccountFromAdminSession(res, req, targetUserId);
    logger.auth.info(`[AdminLogout] Admin account ${idToRevoke || 'active'} logged out from IP ${clientIp}`);

    if (removed.session) {
      const nextSession = await getValidatedAdminSession(req, res, { includeAccounts: true });
      if (nextSession) {
        res.status(200).json({
          accessibleApps: nextSession.access.accessibleApps,
          accounts: nextSession.accounts,
          ok: true,
          remainingCount: nextSession.accounts.length,
          switched: true,
          user: nextSession.user,
        });
        return;
      }
    }

    clearAdminSessionCookie(res, req);
    res.status(200).json({
      accessibleApps: [],
      accounts: [],
      ok: true,
      remainingCount: 0,
      switched: false,
      user: null,
    });
  } catch (error) {
    logger.auth.error('[AdminLogout] Error in logout:', error);
    res.status(500).json({ error: 'Error logging out.', ok: false });
  }
}

async function logoutAll(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const existingPayload = getAdminSessionPayload(req);
    if (existingPayload && Array.isArray(existingPayload.accounts)) {
      await Promise.all(existingPayload.accounts.map((acc) => revokeAdminSessions(acc.id)));
    }
    clearAdminSessionCookie(res, req);
    logger.auth.info(`[AdminLogoutAll] Cleared all admin sessions from IP ${clientIp}`);
    res.status(200).json({
      accessibleApps: [],
      accounts: [],
      message: 'All sessions have been terminated.',
      ok: true,
      user: null,
    });
  } catch (error) {
    logger.auth.error('[AdminLogoutAll] Error in logoutAll:', error);
    res.status(500).json({ error: 'Error terminating all sessions.', ok: false });
  }
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
  logoutAll,
  me,
  switchAccount,
  updatePreferences
};
