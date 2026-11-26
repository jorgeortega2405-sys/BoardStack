import { getAdminRequestSession } from '../middlewares/auth.middleware.js';
import { getAppDashboardStats, getAppUsersList } from '../services/app-admin.service.js';
import { getUserAdminPageAccess } from '../services/admin-access.service.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../utils/response.util.js';

async function getAccessibleAppsHandler(req: Request, res: Response): Promise<void> {
  const session = getAdminRequestSession(req);
  if (!session) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  sendSuccess(res, {
    apps: session.access.accessibleApps,
  });
}

async function getPageAccessHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const appSlug = String(req.params.appSlug || '').trim();
    const pageSlug = String(req.params.pageSlug || '').trim();
    if (!appSlug || !pageSlug) {
      sendError(res, 'Application and page identifiers are required.', 400);
      return;
    }

    const result = await getUserAdminPageAccess(session.user.id, appSlug, pageSlug);
    if (!result.allowed || !result.app || !result.page) {
      sendError(res, 'You do not have permission to access this page.', 403, {
        code: 'PAGE_ACCESS_DENIED',
      });
      return;
    }

    sendSuccess(res, {
      app: result.app,
      page: result.page,
    });
  } catch (error) {
    logger.app.error('[AdminController] Error checking page access:', error);
    sendError(res, 'Error validating page access.', 500);
  }
}

async function getAppDashboardHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const appSlug = String(req.params.appSlug || '').trim();
    if (!appSlug) {
      sendError(res, 'Application identifier is required.', 400);
      return;
    }

    const result = await getUserAdminPageAccess(session.user.id, appSlug, 'dashboard');
    if (!result.allowed || !result.app || !result.page) {
      sendError(res, 'You do not have permission to access this dashboard.', 403, {
        code: 'PAGE_ACCESS_DENIED',
      });
      return;
    }

    const stats = result.app.slug.toLowerCase() === 'app'
      ? await getAppDashboardStats(result.app.id)
      : null;

    sendSuccess(res, {
      app: result.app,
      page: result.page,
      stats,
    });
  } catch (error) {
    logger.app.error('[AdminController] Error loading app dashboard stats:', error);
    sendError(res, 'Error loading dashboard statistics.', 500);
  }
}

async function getAppUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const appSlug = String(req.params.appSlug || '').trim();
    if (!appSlug) {
      sendError(res, 'Application identifier is required.', 400);
      return;
    }

    const result = await getUserAdminPageAccess(session.user.id, appSlug, 'users');
    if (!result.allowed || !result.app || !result.page) {
      sendError(res, 'You do not have permission to view application users.', 403, {
        code: 'PAGE_ACCESS_DENIED',
      });
      return;
    }

    const users = result.app.slug.toLowerCase() === 'app'
      ? await getAppUsersList(result.app.id)
      : [];

    sendSuccess(res, {
      app: result.app,
      page: result.page,
      users,
    });
  } catch (error) {
    logger.app.error('[AdminController] Error loading app users:', error);
    sendError(res, 'Error loading application users.', 500);
  }
}

export {
  getAccessibleAppsHandler,
  getAppDashboardHandler,
  getAppUsersHandler,
  getPageAccessHandler
};
