import {
  cacheUserData,
  createUser,
  findUserByEmail,
  findUserById,
  findUserDuplicates,
  getCachedUserData,
  getUser2FASecret,
  revokeUserSessions,
  updateUserLastLogin,
  updateUserPassword,
  verifyAndConsumeBackupCode,
} from '../services/user.service.js';
import {
  clearSessionCookie,
  completeUserLogin,
  hashPassword,
  removeAccountFromSession,
  switchAccountInSession,
  updateActiveAccountInSession,
  verifyPassword,
} from '../services/auth.service.js';
import { config } from '../config/env.config.js';
import {
  consume2FALoginTicket,
  create2FALoginTicket,
  verify2FALoginTicket,
  verifyTotpCode,
} from '../services/two-factor.service.js';
import {
  createPasswordResetToken,
  createRegistrationTicket,
  getPendingRegistration,
  savePendingRegistration,
  verifyAndConsumePasswordResetToken,
  verifyAndConsumeRegistrationCode,
  verifyRegistrationTicket,
} from '../services/verification.service.js';
import { getAllPermissions, getAllRoles, getUserPermissions, getUserRoles } from '../services/role.service.js';
import { getClientIp } from '../utils/ip.util.js';
import { getCurrentUser, getLinkedAccounts } from '../middlewares/auth.middleware.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';
import { sanitizeUser } from '../utils/user.util.js';
import { sendError, sendSuccess } from '../utils/response.util.js';
import { sendPasswordResetEmail, sendVerificationCodeEmail } from '../services/mail.service.js';
import type { UserPayload } from '../types/auth.types.js';

async function validateStage1(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Valid email address required.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters long.' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existing = await findUserByEmail(trimmedEmail);

    if (existing) {
      logger.auth.warn(`[ValidateStage1] Email already exists: ${trimmedEmail} (IP: ${clientIp})`);
      res.status(409).json({ error: 'Email address is already registered.' });
      return;
    }

    const registrationTicket = createRegistrationTicket(trimmedEmail, 600);
    logger.auth.info(`[ValidateStage1] Valid credentials format for registration: ${trimmedEmail} (IP: ${clientIp})`);
    res.status(200).json({ message: 'Valid credentials to proceed.', ok: true, registrationTicket });
  } catch (error) {
    logger.auth.error('[ValidateStage1] Unexpected error:', error);
    res.status(500).json({ error: 'Error processing request. Please try again later.' });
  }
}

async function sendRegistrationCode(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const { email, password, registrationTicket, turnstileToken, username } = req.body || {};

    if (!email || typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Valid email address required.' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const hasValidTicket = typeof registrationTicket === 'string' && verifyRegistrationTicket(registrationTicket, trimmedEmail);
    if (!hasValidTicket && config.turnstile.enabled) {
      if (!turnstileToken || typeof turnstileToken !== 'string') {
        res.status(403).json({ error: 'Security verification required. Please complete step 1 first.' });
        return;
      }
    }

    if (!password || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters long.' });
      return;
    }

    if (!username || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30) {
      res.status(400).json({ error: 'Username must be between 3 and 30 characters.' });
      return;
    }

    const trimmedUsername = username.trim();

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });
      return;
    }

    const { emailExists, usernameExists } = await findUserDuplicates(trimmedEmail, trimmedUsername);

    if (usernameExists) {
      logger.auth.warn(`[Register] Username already in use: ${trimmedUsername} (IP: ${clientIp})`);
      res.status(409).json({ error: 'Username is already taken.' });
      return;
    }

    if (emailExists) {
      logger.auth.warn(`[Register] Email already in use: ${trimmedEmail} (IP: ${clientIp})`);
      res.status(409).json({ error: 'Email address is already registered.' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const { code: activeCode, reused } = await savePendingRegistration(
      trimmedEmail,
      {
        passwordHash,
        username: trimmedUsername,
      },
      600
    );

    if (!reused) {
      try {
        await sendVerificationCodeEmail(trimmedEmail, trimmedUsername, activeCode);
        logger.auth.info(`[Register] Verification email sent to ${trimmedEmail} (IP: ${clientIp})`);
      } catch (mailError) {
        logger.auth.error('[Register] Failed to send email via SMTP:', mailError);
      }
    }

    res.status(200).json({
      message: reused
        ? `Active verification code is still valid for ${trimmedEmail}.`
        : `Verification code sent successfully to ${trimmedEmail}.`,
      ok: true,
      reused,
    });
  } catch (error) {
    logger.auth.error('[Register] Error in sendRegistrationCode:', error);
    res.status(500).json({ error: 'Failed to send registration code. Please try again later.' });
  }
}

async function resendRegistrationCode(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const { email, registrationTicket, turnstileToken } = req.body || {};

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Valid email address required.' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const hasValidTicket = typeof registrationTicket === 'string' && verifyRegistrationTicket(registrationTicket, trimmedEmail);
    if (!hasValidTicket && config.turnstile.enabled) {
      if (!turnstileToken || typeof turnstileToken !== 'string') {
        res.status(403).json({ error: 'Security verification required. Please restart registration.' });
        return;
      }
    }

    const pending = await getPendingRegistration(trimmedEmail);

    if (!pending) {
      res.status(400).json({ error: 'No pending registration found for this email address.' });
      return;
    }

    const { code: activeCode, reused } = await savePendingRegistration(
      trimmedEmail,
      {
        passwordHash: pending.passwordHash,
        username: pending.username,
      },
      600
    );

    try {
      await sendVerificationCodeEmail(trimmedEmail, pending.username, activeCode);
      logger.auth.info(`[ResendCode] Verification email resent to ${trimmedEmail} (IP: ${clientIp})`);
    } catch (mailError) {
      logger.auth.error('[ResendCode] Failed to resend email via SMTP:', mailError);
    }

    res.status(200).json({
      message: reused
        ? 'Active verification code is still valid. Please check your email.'
        : 'New verification code sent successfully.',
      ok: true,
      reused,
    });
  } catch (error) {
    logger.auth.error('[ResendCode] Error in resendRegistrationCode:', error);
    res.status(500).json({ error: 'Failed to resend code. Please try again later.' });
  }
}

async function verifyRegistrationCode(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const { code, email } = req.body || {};

    if (!email || !code) {
      res.status(400).json({ error: 'Code and email are required.' });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const verificationResult = await verifyAndConsumeRegistrationCode(trimmedEmail, cleanCode);

    if (!verificationResult.success || !verificationResult.data) {
      logger.auth.warn(`[VerifyCode] Invalid or expired code for ${trimmedEmail} (IP: ${clientIp})`);
      res.status(400).json({ error: verificationResult.error || 'Invalid or expired code.' });
      return;
    }

    const pending = verificationResult.data;

    const newUser = await createUser({
      email: pending.email,
      passwordHash: pending.passwordHash,
      registrationIp: clientIp,
      username: pending.username,
    });

    logger.auth.info(`[UserCreated] User registered successfully: ID ${newUser.id} (${newUser.email}) from IP ${clientIp}`);

    const { accounts, user } = await completeUserLogin(res, req, newUser, clientIp);

    res.status(201).json({
      accounts,
      message: 'Account created and verified successfully.',
      ok: true,
      user,
    });
  } catch (error) {
    logger.auth.error('[VerifyCode] Error in verifyRegistrationCode:', error);
    res.status(500).json({ error: 'Failed to verify code. Please try again later.' });
  }
}

async function login(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const { email, password, tempToken, twoFactorCode } = req.body || {};

    if (tempToken && twoFactorCode) {
      const userId = verify2FALoginTicket(String(tempToken));
      if (!userId) {
        logger.auth.warn(`[Login2FA] Invalid or expired 2FA login ticket from IP ${clientIp}`);
        res.status(401).json({ error: 'Two-factor session expired. Please log in again.' });
        return;
      }

      const userRow = await findUserById(userId);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
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
        logger.auth.warn(`[Login2FA] Invalid 2FA code for user ID ${userRow.id} (${userRow.email}) from IP ${clientIp}`);
        res.status(401).json({ error: 'Invalid two-factor authentication code or backup code.' });
        return;
      }

      consume2FALoginTicket(String(tempToken));
      logger.auth.info(`[Login2FA] Successful 2FA login for user ID ${userRow.id} (${userRow.email}) from IP ${clientIp}`);

      const { accounts, user } = await completeUserLogin(res, req, userRow, clientIp);

      res.status(200).json({
        accounts,
        message: 'Login successful.',
        ok: true,
        user,
      });
      return;
    }

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    if (email.trim().length > 254 || password.length > 128) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const userRow = await findUserByEmail(trimmedEmail);

    if (!userRow || !userRow.password_hash) {
      logger.auth.warn(`[Login] Failed login attempt for ${trimmedEmail} (user not found or no password) from IP ${clientIp}`);
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const isMatch = await verifyPassword(String(password), userRow.password_hash);
    if (!isMatch) {
      logger.auth.warn(`[Login] Invalid password for user ID ${userRow.id} (${trimmedEmail}) from IP ${clientIp}`);
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    if (userRow.two_factor_enabled) {
      const ticket = create2FALoginTicket(userRow.id);
      logger.auth.info(`[Login] 2FA required for user ID ${userRow.id} (${trimmedEmail}) from IP ${clientIp}`);
      res.status(200).json({
        message: 'Two-factor authentication code required.',
        ok: true,
        requires2FA: true,
        tempToken: ticket,
      });
      return;
    }

    logger.auth.info(`[Login] Successful login for user ID ${userRow.id} (${trimmedEmail}) from IP ${clientIp}`);

    const { accounts, user } = await completeUserLogin(res, req, userRow, clientIp);

    res.status(200).json({
      accounts,
      message: 'Login successful.',
      ok: true,
      user,
    });
  } catch (error) {
    logger.auth.error('[Login] Error in login:', error);
    res.status(500).json({ error: 'Error logging in. Please try again later.' });
  }
}

async function forgotPassword(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(trimmedEmail);

    if (user) {
      const { reused, token } = await createPasswordResetToken(trimmedEmail, 600);
      if (!reused) {
        const resetUrl = `${config.appUrl}/reset-password?email=${encodeURIComponent(trimmedEmail)}&token=${encodeURIComponent(token)}`;

        try {
          await sendPasswordResetEmail(trimmedEmail, resetUrl);
          logger.auth.info(`[ForgotPassword] Password reset email sent to ${trimmedEmail} (IP: ${clientIp})`);
        } catch (mailError) {
          logger.auth.error('[ForgotPassword] Failed to send password reset email via SMTP:', mailError);
        }
      }
    } else {
      logger.auth.info(`[ForgotPassword] Request for non-existent email: ${trimmedEmail} (IP: ${clientIp})`);
    }

    res.status(200).json({
      message: 'If the email is registered, you will receive a password reset link.',
      ok: true,
    });
  } catch (error) {
    logger.auth.error('[ForgotPassword] Error in forgotPassword:', error);
    res.status(500).json({ error: 'Error processing password reset.' });
  }
}

async function resetPassword(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const { confirmPassword, email, newPassword, token } = req.body || {};

    if (!email || !token || !newPassword) {
      res.status(400).json({ error: 'Missing required parameters.' });
      return;
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanToken = String(token).trim();

    const verification = await verifyAndConsumePasswordResetToken(cleanEmail, cleanToken);
    if (!verification.success) {
      logger.auth.warn(`[ResetPassword] Invalid or expired token for ${cleanEmail} (IP: ${clientIp})`);
      res.status(400).json({ error: verification.error || 'Invalid or expired link.' });
      return;
    }

    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      res.status(400).json({ error: 'User not found.' });
      return;
    }

    const newHash = await hashPassword(newPassword);
    await updateUserPassword(user.id, newHash);

    logger.auth.info(`[ResetPassword] Password reset successfully for user ID ${user.id} (${cleanEmail}) from IP ${clientIp}`);

    res.status(200).json({
      message: 'Password updated successfully. You can now log in.',
      ok: true,
    });
  } catch (error) {
    logger.auth.error('[ResetPassword] Error in resetPassword:', error);
    res.status(500).json({ error: 'Error resetting password. Please try again later.' });
  }
}

async function me(req: Request, res: Response): Promise<void> {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    let user = getCurrentUser(req);
    const accounts = getLinkedAccounts(req);

    if (user && typeof user.id === 'number') {
      const cachedData = await getCachedUserData(user.id);

      if (cachedData) {
        user.avatar_url = cachedData.avatar_url ?? null;
        user.email = cachedData.email;
        user.google_connected = Boolean(cachedData.google_connected);
        user.google_email = cachedData.google_email || null;
        user.has_password = Boolean(cachedData.has_password);
        user.subscription_tier = cachedData.subscription_tier || 'free';
        user.username = cachedData.username;
        user.roles = cachedData.roles || [];
        user.permissions = cachedData.permissions || [];
      } else {
        const [dbUser, roles, permissions] = await Promise.all([
          findUserById(user.id),
          getUserRoles(user.id),
          getUserPermissions(user.id),
        ]);

        if (dbUser) {
          user.avatar_url = dbUser.avatar_url ?? null;
          user.email = dbUser.email;
          user.google_connected = Boolean(dbUser.google_id);
          user.google_email = dbUser.google_email || null;
          user.has_password = Boolean(dbUser.password_hash);
          user.subscription_tier = dbUser.subscription_tier || 'free';
          user.username = dbUser.username;
          user.roles = roles;
          user.permissions = permissions;

          await cacheUserData(user);

          updateActiveAccountInSession(res, req, {
            avatar_url: user.avatar_url,
            email: user.email,
            google_connected: user.google_connected,
            google_email: user.google_email,
            has_password: user.has_password,
            permissions: user.permissions,
            roles: user.roles,
            subscription_tier: user.subscription_tier,
            username: user.username,
          });
        } else {
          clearSessionCookie(res);
          user = null;
        }
      }
    }

    res.status(200).json({
      accounts: user ? accounts.map(sanitizeUser) : [],
      user: user ? sanitizeUser(user) : null,
    });
  } catch (error) {
    logger.auth.error('[Me] Error in me:', error);
    res.status(500).json({ error: 'Error retrieving current session.' });
  }
}

async function switchAccount(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const { userId } = req.body || {};
    const targetUserId = Number(userId);

    if (!targetUserId || isNaN(targetUserId)) {
      res.status(400).json({ error: 'Invalid user identifier.' });
      return;
    }

    const result = await switchAccountInSession(res, req, targetUserId);

    if (!result.success || !result.activeUser) {
      res.status(400).json({ error: 'Failed to switch to the specified account.' });
      return;
    }

    logger.auth.info(`[SwitchAccount] Switched to account ID ${targetUserId} from IP ${clientIp}`);

    res.status(200).json({
      accounts: result.accounts.map(sanitizeUser),
      message: 'Account switched successfully.',
      ok: true,
      user: sanitizeUser(result.activeUser),
    });
  } catch (error) {
    logger.auth.error('[SwitchAccount] Error in switchAccount:', error);
    res.status(500).json({ error: 'Error switching account.' });
  }
}

async function logout(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const { userId } = req.body || {};
    const targetUserId = userId ? Number(userId) : undefined;
    const currentUser = getCurrentUser(req);
    const idToRevoke = targetUserId || currentUser?.id;

    if (idToRevoke) {
      await revokeUserSessions(idToRevoke);
    }

    const result = await removeAccountFromSession(res, req, targetUserId);

    logger.auth.info(`[Logout] User ${targetUserId || 'active'} logged out from IP ${clientIp}`);

    res.status(200).json({
      accounts: result.accounts.map(sanitizeUser),
      ok: true,
      remainingCount: result.remainingCount,
      switched: result.remainingCount > 0,
      user: result.activeUser ? sanitizeUser(result.activeUser) : null,
    });
  } catch (error) {
    logger.auth.error('[Logout] Error in logout:', error);
    res.status(500).json({ error: 'Error logging out.' });
  }
}

async function logoutAll(req: Request, res: Response): Promise<void> {
  const clientIp = getClientIp(req);
  try {
    const user = getCurrentUser(req);
    if (user && user.id) {
      await revokeUserSessions(user.id);
    }
    clearSessionCookie(res);
    logger.auth.info(`[LogoutAll] Cleared all sessions from IP ${clientIp}`);
    res.status(200).json({
      accounts: [],
      message: 'All sessions have been terminated.',
      ok: true,
      user: null,
    });
  } catch (error) {
    logger.auth.error('[LogoutAll] Error in logoutAll:', error);
    res.status(500).json({ error: 'Error terminating all sessions.' });
  }
}

async function getRolesHandler(_req: Request, res: Response): Promise<void> {
  try {
    const roles = await getAllRoles();
    sendSuccess(res, { roles });
  } catch (error) {
    logger.auth.error('[GetRoles] Error fetching roles:', error);
    sendError(res, 'Failed to retrieve roles.', 500);
  }
}

async function getPermissionsHandler(_req: Request, res: Response): Promise<void> {
  try {
    const permissions = await getAllPermissions();
    sendSuccess(res, { permissions });
  } catch (error) {
    logger.auth.error('[GetPermissions] Error fetching permissions:', error);
    sendError(res, 'Failed to retrieve permissions.', 500);
  }
}

export {
  forgotPassword,
  getPermissionsHandler,
  getRolesHandler,
  login,
  logout,
  logoutAll,
  me,
  resendRegistrationCode,
  resetPassword,
  sanitizeUser,
  sendRegistrationCode,
  switchAccount,
  validateStage1,
  verifyRegistrationCode
};
