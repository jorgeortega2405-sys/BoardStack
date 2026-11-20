import {
  authForgotPasswordRateLimiter,
  authLoginRateLimiter,
  authRegisterSendCodeRateLimiter,
  authRegisterStage1RateLimiter,
  authRegisterVerifyRateLimiter,
  authResendCodeRateLimiter,
  authResetPasswordRateLimiter,
  generalAuthRateLimiter,
} from '../middlewares/rate-limit.middleware.js';
import { config } from '../config/env.config.js';
import {
  forgotPassword,
  login,
  logout,
  logoutAll,
  me,
  resendRegistrationCode,
  resetPassword,
  sendRegistrationCode,
  switchAccount,
  validateStage1,
  verifyRegistrationCode,
} from '../controllers/auth.controller.js';
import { getAllPermissions, getAllRoles } from '../services/role.service.js';
import { handleAvatarRequest } from '../controllers/avatar.controller.js';
import { handleGoogleCallback, initiateGoogleAuth } from '../controllers/google-auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireTurnstile } from '../middlewares/turnstile.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/auth/turnstile-config', (_req, res) => {
  res.json({
    enabled: config.turnstile.enabled,
    ok: true,
    siteKey: config.turnstile.siteKey,
  });
});

router.get('/avatar', handleAvatarRequest);
router.get('/auth/google', initiateGoogleAuth);
router.get('/auth/google/callback', handleGoogleCallback);

router.post('/auth/validate-stage-1', authRegisterStage1RateLimiter, requireTurnstile, validateStage1);
router.post('/auth/register-send-code', authRegisterSendCodeRateLimiter, sendRegistrationCode);
router.post('/auth/resend-code', authResendCodeRateLimiter, resendRegistrationCode);
router.post('/auth/register-verify', authRegisterVerifyRateLimiter, verifyRegistrationCode);

router.post('/auth/login', authLoginRateLimiter, requireTurnstile, login);
router.post('/auth/forgot-password', authForgotPasswordRateLimiter, requireTurnstile, forgotPassword);
router.post('/auth/reset-password', authResetPasswordRateLimiter, requireTurnstile, resetPassword);

router.get('/auth/me', me);
router.get('/auth/roles', requireAuth, async (_req, res) => {
  try {
    const roles = await getAllRoles();
    res.json({ ok: true, roles });
  } catch {
    res.status(500).json({ error: 'Failed to retrieve roles.', ok: false });
  }
});
router.get('/auth/permissions', requireAuth, async (_req, res) => {
  try {
    const permissions = await getAllPermissions();
    res.json({ ok: true, permissions });
  } catch {
    res.status(500).json({ error: 'Failed to retrieve permissions.', ok: false });
  }
});
router.post('/auth/switch-account', generalAuthRateLimiter, switchAccount);
router.post('/auth/logout', logout);
router.post('/auth/logout-all', logoutAll);

export default router;
