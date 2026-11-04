import { claimEducationFreeYear, getEducationStatus } from '../controllers/education.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/education/status', requireAuth, getEducationStatus);
router.post('/education/claim-free-year', requireAuth, claimEducationFreeYear);

export default router;
