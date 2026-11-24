import { asyncHandler } from '../middlewares/async.middleware.js';
import { Router } from 'express';
import { submitEnterpriseLeadHandler } from '../controllers/sales-lead.controller.js';

const router = Router();

router.post('/sales/contact', asyncHandler(submitEnterpriseLeadHandler));

export default router;
