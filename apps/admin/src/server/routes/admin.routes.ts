import { adminGeneralRateLimiter } from '../middlewares/rate-limit.middleware.js';
import { asyncHandler } from '../middlewares/async.middleware.js';
import {
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
  uploadEnterpriseContractHandler,
} from '../controllers/admin.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use('/admin', requireAdminAuth, adminGeneralRateLimiter);
router.get('/admin/apps', asyncHandler(getAccessibleAppsHandler));
router.get('/admin/apps/:appSlug/dashboard', asyncHandler(getAppDashboardHandler));
router.get('/admin/apps/:appSlug/users', asyncHandler(getAppUsersHandler));
router.get('/admin/apps/:appSlug/sales/leads', asyncHandler(getSalesLeadsHandler));
router.get('/admin/apps/:appSlug/sales/leads/:leadId', asyncHandler(getSalesLeadDetailHandler));
router.get('/admin/apps/:appSlug/sales/lookup-user', asyncHandler(lookupSalesUserHandler));
router.patch('/admin/apps/:appSlug/sales/leads/:leadId/status', asyncHandler(updateSalesLeadStatusHandler));
router.post('/admin/apps/:appSlug/sales/provision-enterprise', asyncHandler(provisionEnterpriseHandler));
router.post(
  '/admin/apps/:appSlug/sales/contracts',
  asyncHandler(ensureSalesManageBeforeUpload),
  handleContractUploadMiddleware,
  asyncHandler(uploadEnterpriseContractHandler)
);
router.get('/admin/apps/:appSlug/sales/contracts/:contractId/download', asyncHandler(downloadEnterpriseContractHandler));
router.delete('/admin/apps/:appSlug/sales/contracts/:contractId', asyncHandler(deleteEnterpriseContractHandler));
router.get('/admin/apps/:appSlug/pages/:pageSlug', asyncHandler(getPageAccessHandler));

export default router;
