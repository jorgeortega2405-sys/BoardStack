import { login, logout, logoutAll, me, resendRegistrationCode, sendRegistrationCode, switchAccount, validateStage1, verifyRegistrationCode } from '../controllers/auth.controller.js';
import { handleAvatarRequest } from '../controllers/avatar.controller.js';
import { Router } from 'express';

const router = Router();

router.post('/auth/validate-stage-1', validateStage1);
router.post('/auth/register-send-code', sendRegistrationCode);
router.post('/auth/resend-code', resendRegistrationCode);
router.post('/auth/register-verify', verifyRegistrationCode);
router.post('/auth/login', login);
router.get('/auth/me', me);
router.post('/auth/switch-account', switchAccount);
router.post('/auth/logout', logout);
router.post('/auth/logout-all', logoutAll);

router.get('/avatar', handleAvatarRequest);

export default router;
