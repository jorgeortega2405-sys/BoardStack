import {
  clearPending2FASetup,
  generateBackupCodes,
  generateTotpSecret,
  getOtpAuthUrl,
  getPending2FASetup,
  savePending2FASetup,
  verifyTotpCode,
} from '../services/two-factor.service.js';
import {
  createEmailChangeCode,
  createEmailChangeTicket,
  createSecurityActionTicket,
  verifyAndConsumeEmailChangeCode,
  verifyEmailChangeTicket,
  verifySecurityActionTicket,
} from '../services/verification.service.js';
import { deleteFromS3, sanitizeAndUploadToS3 } from '../services/s3.service.js';
import {
  deleteUserPermanently,
  disableUser2FA,
  enableUser2FA,
  findUserById,
  getUser2FASecret,
  getUserPreferences,
  updateUserAvatar,
  updateUserEmail,
  updateUsername,
  updateUserPassword,
  updateUserPreferences,
  verifyAndConsumeBackupCode,
  verifyCurrentPassword,
} from '../services/user.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import {
  hashPassword,
  removeAccountFromSession,
  updateActiveAccountInSession,
  verifyPassword,
} from '../services/auth.service.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';
import { sendEmailChangeCodeEmail } from '../services/mail.service.js';

async function handleGetPreferences(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }
    const preferences = await getUserPreferences(user.id);
    res.json({ ok: true, preferences });
  } catch (error) {
    logger.app.error('[Settings] Error fetching preferences:', error);
    res.status(500).json({ error: 'Error fetching preferences.', ok: false });
  }
}

async function handleUpdatePreferences(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }
    const preferences = await updateUserPreferences(user.id, req.body || {});
    res.json({
      message: 'Preferences updated successfully.',
      ok: true,
      preferences,
    });
  } catch (error) {
    logger.app.error('[Settings] Error updating preferences:', error);
    res.status(500).json({ error: 'Error saving preferences.', ok: false });
  }
}

async function handleUpdateUsername(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const { username } = req.body || {};
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username is required.', ok: false });
      return;
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      res.status(400).json({ error: 'Username must be between 3 and 30 characters.', ok: false });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.', ok: false });
      return;
    }

    const success = await updateUsername(user.id, cleanUsername);
    if (!success) {
      res.status(409).json({ error: 'Username is already taken.', ok: false });
      return;
    }

    const updatedUser = await findUserById(user.id);
    if (updatedUser) {
      updateActiveAccountInSession(res, req, { username: cleanUsername });
    }

    res.json({
      message: 'Username updated successfully.',
      ok: true,
      username: cleanUsername,
    });
  } catch (error) {
    logger.app.error('[Settings] Error updating username:', error);
    res.status(500).json({ error: 'Error updating username.', ok: false });
  }
}

async function handleRequestEmailChangeCode(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const fullUser = await findUserById(user.id);
    if (!fullUser) {
      res.status(404).json({ error: 'User not found.', ok: false });
      return;
    }

    const { code, reused } = await createEmailChangeCode(fullUser.email, 600);
    if (!reused) {
      await sendEmailChangeCodeEmail(fullUser.email, code);
    }

    res.json({
      message: reused
        ? 'Active verification code is still valid. Please check your email.'
        : 'Verification code sent successfully to your current email.',
      ok: true,
      reused,
    });
  } catch (error) {
    logger.app.error('[Settings] Error requesting email change code:', error);
    res.status(500).json({ error: 'Error sending verification code.', ok: false });
  }
}

async function handleVerifyEmailChangeCode(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const fullUser = await findUserById(user.id);
    if (!fullUser) {
      res.status(404).json({ error: 'User not found.', ok: false });
      return;
    }

    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Verification code is required.', ok: false });
      return;
    }

    const verification = await verifyAndConsumeEmailChangeCode(fullUser.email, code.trim());
    if (!verification.success) {
      res.status(400).json({ error: verification.error || 'Invalid or expired code.', ok: false });
      return;
    }

    const ticket = createEmailChangeTicket(user.id, fullUser.email);

    res.json({
      message: 'Code verified successfully. You can now enter your new email.',
      ok: true,
      ticket,
    });
  } catch (error) {
    logger.app.error('[Settings] Error verifying email code:', error);
    res.status(500).json({ error: 'Error verifying code.', ok: false });
  }
}

async function handleUpdateEmail(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const { email, ticket } = req.body || {};
    if (!ticket || typeof ticket !== 'string') {
      res.status(403).json({ error: 'Security ticket is missing. Please verify your current email first.', ok: false });
      return;
    }

    const isTicketValid = verifyEmailChangeTicket(ticket, user.id);
    if (!isTicketValid || !isTicketValid.valid) {
      res.status(403).json({ error: 'Security ticket is expired or invalid. Please verify again.', ok: false });
      return;
    }

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email address is required.', ok: false });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail.length > 254) {
      res.status(400).json({ error: 'Email cannot exceed 254 characters.', ok: false });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Invalid email address format.', ok: false });
      return;
    }
    if (cleanEmail === isTicketValid.email.toLowerCase()) {
      res.status(400).json({ error: 'New email address must be different from current email.', ok: false });
      return;
    }

    const success = await updateUserEmail(user.id, cleanEmail);
    if (!success) {
      res.status(409).json({ error: 'Email address is already registered with another account.', ok: false });
      return;
    }

    updateActiveAccountInSession(res, req, { email: cleanEmail });

    res.json({
      email: cleanEmail,
      message: 'Email address updated successfully.',
      ok: true,
    });
  } catch (error) {
    logger.app.error('[Settings] Error updating email:', error);
    res.status(500).json({ error: 'Error updating email address.', ok: false });
  }
}

async function handleUpdateAvatar(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: 'A valid image file is required.', ok: false });
      return;
    }

    const uploadResult = await sanitizeAndUploadToS3({
      allowedCategories: ['image'],
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      body: req.file.buffer,
      folder: 'avatars',
      maxSizeBytes: 2 * 1024 * 1024,
      originalName: req.file.originalname,
      prefix: `avatar_${user.id}`,
    });

    const previousUser = await findUserById(user.id);
    if (previousUser?.avatar_url) {
      void deleteFromS3(previousUser.avatar_url);
    }

    await updateUserAvatar(user.id, uploadResult.url);
    updateActiveAccountInSession(res, req, { avatar_url: uploadResult.url });

    res.json({
      avatar_url: uploadResult.url,
      message: 'Profile avatar updated successfully.',
      ok: true,
    });
  } catch (error: any) {
    logger.app.error('[Settings] Error updating avatar in AWS S3:', error);
    const message = error?.message || 'Error processing and uploading image to AWS S3.';
    const code = error?.code || 'AVATAR_UPLOAD_FAILED';
    res.status(400).json({ code, error: message, ok: false });
  }
}

async function handleDeleteAvatar(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const fullUser = await findUserById(user.id);
    if (fullUser?.avatar_url) {
      await deleteFromS3(fullUser.avatar_url);
    }

    await updateUserAvatar(user.id, null);
    updateActiveAccountInSession(res, req, { avatar_url: null });

    res.json({
      avatar_url: null,
      message: 'Profile avatar removed.',
      ok: true,
    });
  } catch (error) {
    logger.app.error('[Settings] Error deleting avatar from AWS S3:', error);
    res.status(500).json({ error: 'Error deleting profile avatar.', ok: false });
  }
}

async function handleUpdatePassword(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const fullUser = await findUserById(user.id);
    if (!fullUser) {
      res.status(404).json({ error: 'User not found.', ok: false });
      return;
    }

    const { currentPassword, newPassword, securityTicket } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.', ok: false });
      return;
    }
    if (newPassword.length > 128) {
      res.status(400).json({ error: 'New password cannot exceed 128 characters.', ok: false });
      return;
    }

    const hasValidTicket = typeof securityTicket === 'string' && verifySecurityActionTicket(securityTicket, user.id);

    if (!hasValidTicket) {
      if (fullUser.password_hash) {
        if (!currentPassword || typeof currentPassword !== 'string') {
          res.status(400).json({ error: 'Current password is required.', ok: false });
          return;
        }
        const isMatch = await verifyPassword(currentPassword, fullUser.password_hash);
        if (!isMatch) {
          res.status(400).json({ error: 'Current password is incorrect.', ok: false });
          return;
        }
      } else {
        res.status(403).json({ error: 'Identity verification is required to set a password.', ok: false });
        return;
      }
    }

    if (fullUser.password_hash) {
      const isSameAsCurrent = await verifyPassword(newPassword, fullUser.password_hash);
      if (isSameAsCurrent) {
        res.status(400).json({ error: 'New password must be different from current password.', ok: false });
        return;
      }
    }

    const newHash = await hashPassword(newPassword);
    await updateUserPassword(user.id, newHash);
    updateActiveAccountInSession(res, req, { has_password: true });

    res.json({
      message: 'Password updated successfully.',
      ok: true,
    });
  } catch (error) {
    logger.app.error('[Settings] Error updating password:', error);
    res.status(500).json({ error: 'Error updating password.', ok: false });
  }
}

async function handleDeleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const fullUser = await findUserById(user.id);
    if (!fullUser) {
      res.status(404).json({ error: 'User not found.', ok: false });
      return;
    }

    const { password, securityTicket } = req.body || {};
    const hasValidTicket = typeof securityTicket === 'string' && verifySecurityActionTicket(securityTicket, user.id);

    if (!hasValidTicket) {
      if (fullUser.password_hash) {
        if (!password || typeof password !== 'string') {
          res.status(400).json({ error: 'Current password is required to confirm deletion.', ok: false });
          return;
        }
        const isMatch = await verifyPassword(password, fullUser.password_hash);
        if (!isMatch) {
          res.status(400).json({ error: 'Incorrect password provided.', ok: false });
          return;
        }
      } else {
        res.status(403).json({ error: 'Identity verification is required to confirm account deletion.', ok: false });
        return;
      }
    }

    const deleted = await deleteUserPermanently(user.id);
    if (!deleted) {
      res.status(400).json({ error: 'Failed to delete account.', ok: false });
      return;
    }

    if (fullUser.avatar_url) {
      void deleteFromS3(fullUser.avatar_url);
    }

    const sessionResult = await removeAccountFromSession(res, req, user.id);

    res.json({
      accounts: sessionResult.accounts,
      activeUser: sessionResult.activeUser,
      message: 'Account permanently deleted.',
      ok: true,
      remainingAccounts: sessionResult.remainingCount,
      switched: sessionResult.remainingCount > 0,
    });
  } catch (error) {
    logger.app.error('[Settings] Error deleting account:', error);
    res.status(500).json({ error: 'Error deleting account.', ok: false });
  }
}

async function handleGetAccountStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const fullUser = await findUserById(user.id);
    if (!fullUser) {
      res.status(404).json({ error: 'User not found.', ok: false });
      return;
    }

    res.json({
      avatar_url: fullUser.avatar_url,
      email: fullUser.email,
      google_connected: Boolean(fullUser.google_id),
      has_password: Boolean(fullUser.password_hash),
      id: fullUser.id,
      ok: true,
      username: fullUser.username,
    });
  } catch (error) {
    logger.app.error('[Settings] Error fetching account status:', error);
    res.status(500).json({ error: 'Error fetching account status.', ok: false });
  }
}

async function handleGetPasswordStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }
    const fullUser = await findUserById(user.id);
    res.json({
      hasPassword: Boolean(fullUser?.password_hash),
      has_password: Boolean(fullUser?.password_hash),
      ok: true,
    });
  } catch (error) {
    logger.app.error('[Settings] Error getting password status:', error);
    res.status(500).json({ error: 'Error checking password status.', ok: false });
  }
}

async function handleVerifyCurrentPassword(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const { currentPassword } = req.body || {};
    if (!currentPassword || typeof currentPassword !== 'string') {
      res.status(400).json({ error: 'Current password is required.', ok: false });
      return;
    }

    const result = await verifyCurrentPassword(user.id, currentPassword);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Current password is incorrect.', ok: false });
      return;
    }

    const securityTicket = createSecurityActionTicket(user.id);

    res.json({
      message: 'Password verified successfully.',
      ok: true,
      securityTicket,
      success: true,
    });
  } catch (error) {
    logger.app.error('[Settings] Error verifying current password:', error);
    res.status(500).json({ error: 'Error verifying current password.', ok: false });
  }
}

async function handleGet2FAStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const fullUser = await findUserById(user.id);
    res.json({
      enabled: Boolean(fullUser?.two_factor_enabled),
      ok: true,
    });
  } catch (error) {
    logger.app.error('[Settings] Error getting 2FA status:', error);
    res.status(500).json({ error: 'Error checking two-factor authentication status.', ok: false });
  }
}

async function handleGenerate2FA(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const forceNew = req.query.force === 'true';
    let pending = forceNew ? null : await getPending2FASetup(user.id);

    if (!pending) {
      const secret = generateTotpSecret(20);
      const backupCodes = generateBackupCodes(10);
      await savePending2FASetup(user.id, { backupCodes, secret }, 900);
      pending = { backupCodes, expiresAt: Date.now() + 900000, secret };
    }

    const qrUri = getOtpAuthUrl(pending.secret, user.username || user.email, 'BoardStack');

    res.json({
      backupCodes: pending.backupCodes,
      ok: true,
      qrUri,
      secret: pending.secret,
    });
  } catch (error) {
    logger.app.error('[Settings] Error generating 2FA setup:', error);
    res.status(500).json({ error: 'Error generating two-factor authentication setup.', ok: false });
  }
}

async function handleEnable2FA(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: '6-digit code from authenticator app is required.', ok: false });
      return;
    }

    const pending = await getPending2FASetup(user.id);
    if (!pending) {
      res.status(400).json({ error: 'Setup session expired. Please generate a new QR code.', ok: false });
      return;
    }

    const isValid = verifyTotpCode(code.trim(), pending.secret, 4);
    if (!isValid) {
      res.status(400).json({ error: 'Invalid or expired code.', ok: false });
      return;
    }

    await enableUser2FA(user.id, pending.secret, pending.backupCodes);
    await clearPending2FASetup(user.id);

    updateActiveAccountInSession(res, req, { two_factor_enabled: true });

    res.json({
      backupCodes: pending.backupCodes,
      message: 'Two-factor authentication enabled successfully.',
      ok: true,
    });
  } catch (error) {
    logger.app.error('[Settings] Error enabling 2FA:', error);
    res.status(500).json({ error: 'Error enabling two-factor authentication.', ok: false });
  }
}

async function handleDisable2FA(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false });
      return;
    }

    const { code, password } = req.body || {};
    const fullUser = await findUserById(user.id);
    if (!fullUser) {
      res.status(404).json({ error: 'User not found.', ok: false });
      return;
    }

    let isAuthorized = false;

    if (fullUser.password_hash && password && typeof password === 'string') {
      const pwdRes = await verifyCurrentPassword(user.id, password);
      if (pwdRes.success) {
        isAuthorized = true;
      } else {
        res.status(400).json({ error: pwdRes.error || 'Incorrect password provided.', ok: false });
        return;
      }
    }

    if (!isAuthorized && code && typeof code === 'string') {
      const cleanCode = code.trim();
      const twoFactorData = await getUser2FASecret(user.id);
      if (/^\d{6}$/.test(cleanCode) && twoFactorData?.two_factor_secret) {
        if (verifyTotpCode(cleanCode, twoFactorData.two_factor_secret, 2)) {
          isAuthorized = true;
        }
      }
      if (!isAuthorized) {
        const backupConsumed = await verifyAndConsumeBackupCode(user.id, cleanCode);
        if (backupConsumed) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      res.status(400).json({
        error: 'Current password or valid verification code is required to disable two-factor authentication.',
        ok: false,
      });
      return;
    }

    await disableUser2FA(user.id);
    updateActiveAccountInSession(res, req, { two_factor_enabled: false });

    res.json({
      message: 'Two-factor authentication disabled successfully.',
      ok: true,
    });
  } catch (error) {
    logger.app.error('[Settings] Error disabling 2FA:', error);
    res.status(500).json({ error: 'Error disabling two-factor authentication.', ok: false });
  }
}

export {
  handleDeleteAccount,
  handleDeleteAvatar,
  handleDisable2FA,
  handleEnable2FA,
  handleGenerate2FA,
  handleGet2FAStatus,
  handleGetAccountStatus,
  handleGetPasswordStatus,
  handleGetPreferences,
  handleRequestEmailChangeCode,
  handleUpdateAvatar,
  handleUpdateEmail,
  handleUpdatePassword,
  handleUpdatePreferences,
  handleUpdateUsername,
  handleVerifyCurrentPassword,
  handleVerifyEmailChangeCode
};