import {
  deleteEnterpriseContract,
  FileSanitizationError,
  getEnterpriseContractForDownload,
  getEnterpriseLeadDetail,
  listEnterpriseLeads,
  lookupAppUserByEmail,
  provisionEnterpriseSubscription,
  updateEnterpriseLeadStatus,
  uploadEnterpriseContract,
} from '../services/app-sales.service.js';
import { getAdminRequestSession } from '../middlewares/auth.middleware.js';
import { getAppDashboardStats, getAppUsersList } from '../services/app-admin.service.js';
import { getS3Object } from '../services/s3.service.js';
import { getUserAdminPageAccess } from '../services/admin-access.service.js';
import { logger } from '../utils/logger.js';
import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { sendError, sendSuccess } from '../utils/response.util.js';

const VALID_LEAD_STATUSES = ['approved', 'contacted', 'pending', 'rejected'] as const;

const contractMemoryUpload = multer({
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
  storage: multer.memoryStorage(),
});

async function ensureSalesManageBeforeUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = getAdminRequestSession(req);
  if (!session) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const appSlug = String(req.params.appSlug || '').trim();
  const result = await getUserAdminPageAccess(session.user.id, appSlug, 'sales');
  if (!result.allowed || !result.app) {
    sendError(res, 'You do not have permission to access this page.', 403, {
      code: 'PAGE_ACCESS_DENIED',
    });
    return;
  }

  const canManage = result.access.isSuperAdmin || result.app.permissions.includes('admin:sales:manage');
  if (!canManage) {
    sendError(res, 'You do not have permission to upload enterprise contracts.', 403);
    return;
  }

  next();
}

function handleContractUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  contractMemoryUpload.single('file')(req, res, (err: any) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      sendError(res, 'Contract file exceeds the maximum limit of 20 MB.', 400, {
        code: 'FILE_TOO_LARGE',
      });
      return;
    }
    sendError(res, err?.message || 'Invalid multipart upload payload.', 400, {
      code: 'UPLOAD_MIDDLEWARE_ERROR',
    });
  });
}

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

async function getSalesLeadsHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const appSlug = String(req.params.appSlug || '').trim();
    const result = await getUserAdminPageAccess(session.user.id, appSlug, 'sales');
    if (!result.allowed || !result.app || !result.page) {
      sendError(res, 'You do not have permission to view sales leads.', 403, {
        code: 'PAGE_ACCESS_DENIED',
      });
      return;
    }

    if (result.app.slug.toLowerCase() !== 'app') {
      sendSuccess(res, {
        app: result.app,
        canManage: false,
        leads: [],
        page: result.page,
      });
      return;
    }

    const leads = await listEnterpriseLeads();
    const canManage = result.access.isSuperAdmin || result.app.permissions.includes('admin:sales:manage');

    sendSuccess(res, {
      app: result.app,
      canManage,
      leads,
      page: result.page,
    });
  } catch (error) {
    logger.app.error('[AdminController] Error loading sales leads:', error);
    sendError(res, 'Error loading enterprise sales inquiries.', 500);
  }
}

async function getSalesLeadDetailHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const appSlug = String(req.params.appSlug || '').trim();
    const leadId = Number(req.params.leadId);
    if (!leadId || isNaN(leadId)) {
      sendError(res, 'Valid lead identifier is required.', 400);
      return;
    }

    const result = await getUserAdminPageAccess(session.user.id, appSlug, 'sales');
    if (!result.allowed || !result.app || !result.page) {
      sendError(res, 'You do not have permission to view sales leads.', 403, {
        code: 'PAGE_ACCESS_DENIED',
      });
      return;
    }

    const detail = await getEnterpriseLeadDetail(leadId);
    if (!detail) {
      sendError(res, 'Sales inquiry not found.', 404);
      return;
    }

    sendSuccess(res, {
      detail,
    });
  } catch (error) {
    logger.app.error('[AdminController] Error loading sales lead detail:', error);
    sendError(res, 'Error loading enterprise inquiry details.', 500);
  }
}

async function lookupSalesUserHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const appSlug = String(req.params.appSlug || '').trim();
    const result = await getUserAdminPageAccess(session.user.id, appSlug, 'sales');
    if (!result.allowed || !result.app || !result.page) {
      sendError(res, 'You do not have permission to access sales tools.', 403, {
        code: 'PAGE_ACCESS_DENIED',
      });
      return;
    }

    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendError(res, 'Valid email query parameter is required.', 400);
      return;
    }

    const matchedUser = await lookupAppUserByEmail(email);
    sendSuccess(res, {
      found: Boolean(matchedUser),
      user: matchedUser,
    });
  } catch (error) {
    logger.app.error('[AdminController] Error looking up user by email:', error);
    sendError(res, 'Error searching for user account.', 500);
  }
}

async function updateSalesLeadStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const appSlug = String(req.params.appSlug || '').trim();
    const leadId = Number(req.params.leadId);
    if (!leadId || isNaN(leadId)) {
      sendError(res, 'Valid lead identifier is required.', 400);
      return;
    }

    const result = await getUserAdminPageAccess(session.user.id, appSlug, 'sales');
    if (!result.allowed || !result.app) {
      sendError(res, 'You do not have permission to access this page.', 403, {
        code: 'PAGE_ACCESS_DENIED',
      });
      return;
    }

    const canManage = result.access.isSuperAdmin || result.app.permissions.includes('admin:sales:manage');
    if (!canManage) {
      sendError(res, 'You do not have permission to manage sales inquiries.', 403);
      return;
    }

    const status = String(req.body?.status || '').trim().toLowerCase() as (typeof VALID_LEAD_STATUSES)[number];
    if (!VALID_LEAD_STATUSES.includes(status)) {
      sendError(res, 'Invalid inquiry status value.', 400);
      return;
    }

    const updated = await updateEnterpriseLeadStatus(leadId, status);
    if (!updated) {
      sendError(res, 'Sales inquiry not found.', 404);
      return;
    }

    sendSuccess(res, { status });
  } catch (error) {
    logger.app.error('[AdminController] Error updating lead status:', error);
    sendError(res, 'Error updating inquiry status.', 500);
  }
}

async function provisionEnterpriseHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const appSlug = String(req.params.appSlug || '').trim();
    const result = await getUserAdminPageAccess(session.user.id, appSlug, 'sales');
    if (!result.allowed || !result.app) {
      sendError(res, 'You do not have permission to access this page.', 403, {
        code: 'PAGE_ACCESS_DENIED',
      });
      return;
    }

    const canManage = result.access.isSuperAdmin || result.app.permissions.includes('admin:sales:manage');
    if (!canManage) {
      sendError(res, 'You do not have permission to provision Enterprise subscriptions.', 403);
      return;
    }

    const raw = req.body || {};
    const userEmail = String(raw.userEmail || '').trim().toLowerCase();
    const organizationName = String(raw.organizationName || '').trim();
    const organizationDomain = raw.organizationDomain !== undefined
      ? (String(raw.organizationDomain || '').trim() || null)
      : undefined;
    const seatsLimit = Number(raw.seatsLimit);
    const storageLimitBytes = Number(raw.storageLimitBytes);
    const durationMonths = Number(raw.durationMonths);
    const contractAmount = raw.contractAmount !== undefined && raw.contractAmount !== '' ? Number(raw.contractAmount) : 0;
    const currency = String(raw.currency || 'USD').trim().toUpperCase();
    const billingPeriod = raw.billingPeriod === 'yearly' || raw.billingPeriod === 'monthly' ? raw.billingPeriod : 'custom';
    const leadId = raw.leadId ? Number(raw.leadId) : null;

    if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      sendError(res, 'A valid BoardStack account email is required.', 400);
      return;
    }

    if (!organizationName) {
      sendError(res, 'Organization name is required.', 400);
      return;
    }

    const provisioned = await provisionEnterpriseSubscription({
      adminUserId: session.user.id,
      appId: result.app.id,
      billingPeriod,
      contractAmount,
      currency,
      durationMonths,
      leadId: leadId && !isNaN(leadId) ? leadId : null,
      organizationDomain,
      organizationName,
      seatsLimit,
      storageLimitBytes,
      userEmail,
    });

    sendSuccess(res, {
      provisioned,
    });
  } catch (error: any) {
    if (error?.message === 'ACCOUNT_NOT_FOUND') {
      sendError(res, 'No registered BoardStack user exists with that email address.', 404, {
        code: 'ACCOUNT_NOT_FOUND',
      });
      return;
    }
    if (error?.message === 'INVALID_SEATS') {
      sendError(res, 'Seats limit must be between 1 and 100,000.', 400);
      return;
    }
    if (error?.message === 'INVALID_STORAGE') {
      sendError(res, 'Storage limit must be at least 1 GB.', 400);
      return;
    }
    if (error?.message === 'INVALID_DURATION') {
      sendError(res, 'Duration must be between 1 and 120 months.', 400);
      return;
    }
    if (error?.message === 'INVALID_AMOUNT') {
      sendError(res, 'Contract amount must be zero or positive.', 400);
      return;
    }
    logger.app.error('[AdminController] Error provisioning Enterprise subscription:', error);
    sendError(res, 'Error provisioning Enterprise subscription.', 500);
  }
}

async function uploadEnterpriseContractHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const file = (req as any).file as { buffer: Buffer; originalname: string } | undefined;
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      sendError(res, 'Contract file is required.', 400, {
        code: 'FILE_REQUIRED',
      });
      return;
    }

    const rawBody = req.body || {};
    const leadId = rawBody.leadId ? Number(rawBody.leadId) : null;
    const organizationId = rawBody.organizationId ? Number(rawBody.organizationId) : null;
    const userEmail = typeof rawBody.userEmail === 'string' ? rawBody.userEmail.trim() : null;
    const title = typeof rawBody.title === 'string' ? rawBody.title.trim() : undefined;

    const contract = await uploadEnterpriseContract({
      adminUserId: session.user.id,
      buffer: file.buffer,
      leadId: leadId && !isNaN(leadId) ? leadId : null,
      organizationId: organizationId && !isNaN(organizationId) ? organizationId : null,
      originalName: file.originalname || 'contract.pdf',
      title,
      userEmail,
    });

    sendSuccess(res, { contract }, 201);
  } catch (error: any) {
    if (error instanceof FileSanitizationError) {
      sendError(res, error.message, 400, {
        code: error.code,
      });
      return;
    }
    if (error?.message === 'LEAD_NOT_FOUND') {
      sendError(res, 'Sales inquiry not found.', 404, {
        code: 'LEAD_NOT_FOUND',
      });
      return;
    }
    if (error?.message === 'ACCOUNT_NOT_FOUND') {
      sendError(res, 'No registered BoardStack user exists with that email address.', 404, {
        code: 'ACCOUNT_NOT_FOUND',
      });
      return;
    }
    if (error?.message === 'CONTRACT_TARGET_REQUIRED') {
      sendError(res, 'A valid sales lead, user email, or organization identifier is required.', 400, {
        code: 'CONTRACT_TARGET_REQUIRED',
      });
      return;
    }
    logger.app.error('[AdminController] Error uploading Enterprise contract:', error);
    sendError(res, 'Error uploading Enterprise contract.', 500);
  }
}

async function downloadEnterpriseContractHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const appSlug = String(req.params.appSlug || '').trim();
    const contractId = Number(req.params.contractId);
    if (!contractId || isNaN(contractId)) {
      sendError(res, 'Valid contract identifier is required.', 400);
      return;
    }

    const result = await getUserAdminPageAccess(session.user.id, appSlug, 'sales');
    if (!result.allowed || !result.app) {
      sendError(res, 'You do not have permission to view enterprise contracts.', 403, {
        code: 'PAGE_ACCESS_DENIED',
      });
      return;
    }

    const entry = await getEnterpriseContractForDownload(contractId);
    if (!entry) {
      sendError(res, 'Contract not found.', 404);
      return;
    }

    const s3Res = await getS3Object(entry.s3Key);
    if (!s3Res.Body) {
      sendError(res, 'Contract file not found in storage.', 404);
      return;
    }

    const bodyBuffer = Buffer.from(await s3Res.Body.transformToByteArray());
    const safeAsciiName = entry.contract.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const isViewMode =
      req.query.mode === 'view' &&
      (entry.contract.mimeType === 'application/pdf' || entry.contract.mimeType.startsWith('image/'));

    res.setHeader('Content-Type', entry.contract.mimeType);
    res.setHeader('Content-Length', String(bodyBuffer.length));
    res.setHeader(
      'Content-Disposition',
      `${isViewMode ? 'inline' : 'attachment'}; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(entry.contract.originalFilename)}`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(bodyBuffer);
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      sendError(res, 'Contract file not found in storage.', 404);
      return;
    }
    logger.app.error('[AdminController] Error downloading Enterprise contract:', error);
    sendError(res, 'Error downloading Enterprise contract.', 500);
  }
}

async function deleteEnterpriseContractHandler(req: Request, res: Response): Promise<void> {
  try {
    const session = getAdminRequestSession(req);
    if (!session) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const appSlug = String(req.params.appSlug || '').trim();
    const contractId = Number(req.params.contractId);
    if (!contractId || isNaN(contractId)) {
      sendError(res, 'Valid contract identifier is required.', 400);
      return;
    }

    const result = await getUserAdminPageAccess(session.user.id, appSlug, 'sales');
    if (!result.allowed || !result.app) {
      sendError(res, 'You do not have permission to access this page.', 403, {
        code: 'PAGE_ACCESS_DENIED',
      });
      return;
    }

    const canManage = result.access.isSuperAdmin || result.app.permissions.includes('admin:sales:manage');
    if (!canManage) {
      sendError(res, 'You do not have permission to delete enterprise contracts.', 403);
      return;
    }

    const deleted = await deleteEnterpriseContract(contractId);
    if (!deleted) {
      sendError(res, 'Contract not found.', 404);
      return;
    }

    sendSuccess(res, { deleted: true });
  } catch (error) {
    logger.app.error('[AdminController] Error deleting Enterprise contract:', error);
    sendError(res, 'Error deleting Enterprise contract.', 500);
  }
}

export {
  deleteEnterpriseContractHandler,
  downloadEnterpriseContractHandler,
  ensureSalesManageBeforeUpload,
  getAccessibleAppsHandler,
  getAppDashboardHandler,
  getAppUsersHandler,
  getPageAccessHandler,
  getSalesLeadDetailHandler,
  getSalesLeadsHandler,
  handleContractUploadMiddleware,
  lookupSalesUserHandler,
  provisionEnterpriseHandler,
  updateSalesLeadStatusHandler,
  uploadEnterpriseContractHandler
};
