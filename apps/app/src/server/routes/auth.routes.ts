import { asyncHandler } from '../middlewares/async.middleware.js';
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
  getPermissionsHandler,
  getRolesHandler,
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

router.post('/auth/validate-stage-1', authRegisterStage1RateLimiter, requireTurnstile, asyncHandler(validateStage1));
router.post('/auth/register-send-code', authRegisterSendCodeRateLimiter, asyncHandler(sendRegistrationCode));
router.post('/auth/resend-code', authResendCodeRateLimiter, asyncHandler(resendRegistrationCode));
router.post('/auth/register-verify', authRegisterVerifyRateLimiter, asyncHandler(verifyRegistrationCode));

router.post('/auth/login', authLoginRateLimiter, requireTurnstile, asyncHandler(login));
router.post('/auth/forgot-password', authForgotPasswordRateLimiter, requireTurnstile, asyncHandler(forgotPassword));
router.post('/auth/reset-password', authResetPasswordRateLimiter, requireTurnstile, asyncHandler(resetPassword));

router.get('/auth/me', asyncHandler(me));
router.get('/auth/roles', requireAuth, asyncHandler(getRolesHandler));
router.get('/auth/permissions', requireAuth, asyncHandler(getPermissionsHandler));
router.post('/auth/switch-account', generalAuthRateLimiter, asyncHandler(switchAccount));
router.post('/auth/logout', asyncHandler(logout));
router.post('/auth/logout-all', asyncHandler(logoutAll));

export default router;
