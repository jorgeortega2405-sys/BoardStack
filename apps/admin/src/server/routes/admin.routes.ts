import { adminGeneralRateLimiter } from '../middlewares/rate-limit.middleware.js';
import { asyncHandler } from '../middlewares/async.middleware.js';
import {
  getAccessibleAppsHandler,
  getAppDashboardHandler,
  getAppUsersHandler,
  getPageAccessHandler,
} from '../controllers/admin.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use('/admin', requireAdminAuth, adminGeneralRateLimiter);
router.get('/admin/apps', asyncHandler(getAccessibleAppsHandler));
router.get('/admin/apps/:appSlug/dashboard', asyncHandler(getAppDashboardHandler));
router.get('/admin/apps/:appSlug/users', asyncHandler(getAppUsersHandler));
router.get('/admin/apps/:appSlug/pages/:pageSlug', asyncHandler(getPageAccessHandler));

export default router;
