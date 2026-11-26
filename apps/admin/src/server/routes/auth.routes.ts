import { adminGeneralRateLimiter, adminLoginRateLimiter } from '../middlewares/rate-limit.middleware.js';
import { asyncHandler } from '../middlewares/async.middleware.js';
import {
  getPreferences,
  login,
  logout,
  logoutAll,
  me,
  switchAccount,
  updatePreferences,
} from '../controllers/auth.controller.js';
import { handleAvatarRequest } from '../controllers/avatar.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/avatar', handleAvatarRequest);
router.post('/auth/login', adminLoginRateLimiter, asyncHandler(login));
router.get('/auth/me', asyncHandler(me));
router.post('/auth/switch-account', adminGeneralRateLimiter, asyncHandler(switchAccount));
router.post('/auth/logout', asyncHandler(logout));
router.post('/auth/logout-all', asyncHandler(logoutAll));
router.get('/settings/preferences', requireAdminAuth, asyncHandler(getPreferences));
router.post('/settings/preferences', requireAdminAuth, adminGeneralRateLimiter, asyncHandler(updatePreferences));

export default router;
