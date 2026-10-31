import { handleDeleteAccount, handleDeleteAvatar, handleDisable2FA, handleEnable2FA, handleGenerate2FA, handleGet2FAStatus, handleGetPasswordStatus, handleGetPreferences, handleRequestEmailChangeCode, handleUpdateAvatar, handleUpdateEmail, handleUpdatePassword, handleUpdatePreferences, handleUpdateUsername, handleVerifyCurrentPassword, handleVerifyEmailChangeCode } from '../controllers/settings.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { avatarLimiter, emailCodeLimiter, preferencesLimiter, twoFactorGenerateLimiter, twoFactorVerifyLimiter, updatePasswordLimiter, updateUsernameLimiter, verifyEmailCodeLimiter, verifyPasswordLimiter } from '../middlewares/rate-limit.middleware.js';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagen no compatible. Usa PNG, JPG o WEBP.'));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  storage,
});

function uploadAvatarMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single('avatar')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'La imagen supera el límite permitido de 2 MB.', ok: false });
        return;
      }
      res.status(400).json({ error: 'Error al procesar el archivo.', ok: false });
      return;
    } else if (err) {
      res.status(400).json({ error: 'El archivo enviado no es válido o no cumple con los requisitos.', ok: false });
      return;
    }
    next();
  });
}

router.use('/settings', requireAuth);

router.post('/settings/avatar', avatarLimiter, uploadAvatarMiddleware, handleUpdateAvatar);
router.delete('/settings/avatar', avatarLimiter, handleDeleteAvatar);
router.post('/settings/avatar/delete', avatarLimiter, handleDeleteAvatar);

router.post('/settings/username', updateUsernameLimiter, handleUpdateUsername);
router.post('/settings/email/request-code', emailCodeLimiter, handleRequestEmailChangeCode);
router.post('/settings/email/verify-code', verifyEmailCodeLimiter, handleVerifyEmailChangeCode);
router.post('/settings/email', verifyEmailCodeLimiter, handleUpdateEmail);

router.get('/settings/password/status', handleGetPasswordStatus);
router.post('/settings/password/verify', verifyPasswordLimiter, handleVerifyCurrentPassword);
router.post('/settings/password', updatePasswordLimiter, handleUpdatePassword);

router.get('/settings/2fa/status', handleGet2FAStatus);
router.post('/settings/2fa/generate', twoFactorGenerateLimiter, handleGenerate2FA);
router.post('/settings/2fa/enable', twoFactorVerifyLimiter, handleEnable2FA);
router.post('/settings/2fa/disable', verifyPasswordLimiter, handleDisable2FA);

router.get('/settings/preferences', handleGetPreferences);
router.post('/settings/preferences', preferencesLimiter, handleUpdatePreferences);

router.post('/settings/account/delete', verifyPasswordLimiter, handleDeleteAccount);
router.delete('/settings/account', verifyPasswordLimiter, handleDeleteAccount);

export default router;
