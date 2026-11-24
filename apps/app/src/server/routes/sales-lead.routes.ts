import { asyncHandler } from '../middlewares/async.middleware.js';
import { Router } from 'express';
import { salesLeadRateLimiter } from '../middlewares/rate-limit.middleware.js';
import { submitEnterpriseLeadHandler } from '../controllers/sales-lead.controller.js';

const router = Router();

router.post('/sales/contact', salesLeadRateLimiter, asyncHandler(submitEnterpriseLeadHandler));

export default router;
