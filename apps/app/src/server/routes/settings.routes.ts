import { asyncHandler } from '../middlewares/async.middleware.js';
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
import { Router, type NextFunction, type Request, type Response } from 'express';
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

function handleAvatarUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('avatar')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          code: 'LIMIT_FILE_SIZE',
          error: 'File size exceeds the allowed 2MB limit.',
          message: 'File size exceeds the allowed 2MB limit.',
          ok: false,
          success: false,
        });
        return;
      }
      res.status(400).json({
        code: err.code || 'INVALID_FILE_UPLOAD',
        error: err.message || 'Invalid image file upload.',
        message: err.message || 'Invalid image file upload.',
        ok: false,
        success: false,
      });
      return;
    }
    next();
  });
}

router.use('/settings', requireAuth);

router.get('/settings/account/status', asyncHandler(handleGetAccountStatus));
router.post('/settings/username', settingsGeneralRateLimiter, asyncHandler(handleUpdateUsername));
router.post('/settings/email/request-code', settingsSecurityRateLimiter, asyncHandler(handleRequestEmailChangeCode));
router.post('/settings/email/verify-code', settingsSecurityRateLimiter, asyncHandler(handleVerifyEmailChangeCode));
router.post('/settings/email', settingsSecurityRateLimiter, asyncHandler(handleUpdateEmail));

router.post('/settings/avatar', settingsAvatarRateLimiter, handleAvatarUpload, asyncHandler(handleUpdateAvatar));
router.delete('/settings/avatar', settingsAvatarRateLimiter, asyncHandler(handleDeleteAvatar));
router.post('/settings/avatar/delete', settingsAvatarRateLimiter, asyncHandler(handleDeleteAvatar));

router.get('/settings/password/status', asyncHandler(handleGetPasswordStatus));
router.post('/settings/password/verify', settingsPasswordVerifyRateLimiter, asyncHandler(handleVerifyCurrentPassword));
router.post('/settings/password', settingsSecurityRateLimiter, asyncHandler(handleUpdatePassword));

router.get('/settings/2fa/status', asyncHandler(handleGet2FAStatus));
router.post('/settings/2fa/generate', settingsSecurityRateLimiter, asyncHandler(handleGenerate2FA));
router.post('/settings/2fa/enable', settingsSecurityRateLimiter, asyncHandler(handleEnable2FA));
router.post('/settings/2fa/disable', settingsSecurityRateLimiter, asyncHandler(handleDisable2FA));

router.post('/settings/account/delete', settingsSecurityRateLimiter, asyncHandler(handleDeleteAccount));
router.delete('/settings/account', settingsSecurityRateLimiter, asyncHandler(handleDeleteAccount));

router.get('/settings/preferences', asyncHandler(handleGetPreferences));
router.post('/settings/preferences', settingsPreferencesRateLimiter, asyncHandler(handleUpdatePreferences));

export default router;
