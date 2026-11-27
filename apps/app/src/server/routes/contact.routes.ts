import { asyncHandler } from '../middlewares/async.middleware.js';
import { contactRateLimiter } from '../middlewares/rate-limit.middleware.js';
import { Router } from 'express';
import { submitContactMessageHandler } from '../controllers/contact.controller.js';

const router = Router();

router.post('/contact', contactRateLimiter, asyncHandler(submitContactMessageHandler));

export default router;
