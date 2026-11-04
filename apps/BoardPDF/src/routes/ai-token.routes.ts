import { handleEstimateTokenCost, handleGetTokenBalance } from '../controllers/ai-token.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/tokens/balance', requireAuth, handleGetTokenBalance);
router.post('/tokens/estimate', requireAuth, handleEstimateTokenCost);

export default router;
