import {
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
  handleVerifyEmailChangeCode,
} from '../controllers/settings.controller.js';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';
import {
  settingsAvatarRateLimiter,
  settingsGeneralRateLimiter,
  settingsPasswordVerifyRateLimiter,
  settingsPreferencesRateLimiter,
  settingsSecurityRateLimiter,
} from '../middlewares/rate-limit.middleware.js';

const router = Router();

const upload = multer({
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported image format. Please use PNG, JPEG or WEBP.'));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  storage: multer.memoryStorage(),
});

router.use('/settings', requireAuth);

router.get('/settings/account/status', handleGetAccountStatus);
router.post('/settings/username', settingsGeneralRateLimiter, handleUpdateUsername);
router.post('/settings/email/request-code', settingsSecurityRateLimiter, handleRequestEmailChangeCode);
router.post('/settings/email/verify-code', settingsSecurityRateLimiter, handleVerifyEmailChangeCode);
router.post('/settings/email', settingsSecurityRateLimiter, handleUpdateEmail);

router.post('/settings/avatar', settingsAvatarRateLimiter, upload.single('avatar'), handleUpdateAvatar);
router.delete('/settings/avatar', settingsAvatarRateLimiter, handleDeleteAvatar);
router.post('/settings/avatar/delete', settingsAvatarRateLimiter, handleDeleteAvatar);

router.get('/settings/password/status', handleGetPasswordStatus);
router.post('/settings/password/verify', settingsPasswordVerifyRateLimiter, handleVerifyCurrentPassword);
router.post('/settings/password', settingsSecurityRateLimiter, handleUpdatePassword);

router.get('/settings/2fa/status', handleGet2FAStatus);
router.post('/settings/2fa/generate', settingsSecurityRateLimiter, handleGenerate2FA);
router.post('/settings/2fa/enable', settingsSecurityRateLimiter, handleEnable2FA);
router.post('/settings/2fa/disable', settingsSecurityRateLimiter, handleDisable2FA);

router.post('/settings/account/delete', settingsSecurityRateLimiter, handleDeleteAccount);
router.delete('/settings/account', settingsSecurityRateLimiter, handleDeleteAccount);

router.get('/settings/preferences', handleGetPreferences);
router.post('/settings/preferences', settingsPreferencesRateLimiter, handleUpdatePreferences);

export default router;
