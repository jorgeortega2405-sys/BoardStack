import { login, loginWith2FA, logout, logoutAll, me, resendRegistrationCode, sendRegistrationCode, switchAccount, validateStage1, verifyRegistrationCode } from '../controllers/auth.controller.js';
import { handleAvatarRequest } from '../controllers/avatar.controller.js';
import { handleGoogleCallback, initiateGoogleAuth } from '../controllers/google-auth.controller.js';
import { avatarLimiter, loginLimiter, registerLimiter, sendCodeLimiter, verifyCodeLimiter } from '../middlewares/rate-limit.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/auth/google', initiateGoogleAuth);
router.get('/auth/google/callback', handleGoogleCallback);
router.post('/auth/validate-stage-1', registerLimiter, validateStage1);
router.post('/auth/register-send-code', sendCodeLimiter, sendRegistrationCode);
router.post('/auth/resend-code', sendCodeLimiter, resendRegistrationCode);
router.post('/auth/register-verify', verifyCodeLimiter, verifyRegistrationCode);
router.post('/auth/login', loginLimiter, login);
router.post('/auth/login-2fa', verifyCodeLimiter, loginWith2FA);
router.get('/auth/me', me);
router.post('/auth/switch-account', switchAccount);
router.post('/auth/logout', logout);
router.post('/auth/logout-all', logoutAll);

router.get('/avatar', avatarLimiter, handleAvatarRequest);

export default router;
