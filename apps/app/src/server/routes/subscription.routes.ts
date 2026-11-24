import { asyncHandler } from '../middlewares/async.middleware.js';
import {
  confirmPaymentHandler,
  createPaymentIntentHandler,
  getBillingDetailsHandler,
  getPurchaseInvoiceHandler,
  getPurchasesHandler,
  getSubscriptionConfig,
  getSubscriptionStatus,
  stripeWebhookHandler,
  updateRenewalHandler,
} from '../controllers/subscription.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';
import { subscriptionRateLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.get('/subscription/config', asyncHandler(getSubscriptionConfig));
router.get('/subscription/status', asyncHandler(getSubscriptionStatus));
router.get('/subscription/billing', requireAuth, asyncHandler(getBillingDetailsHandler));
router.get('/subscription/purchases', requireAuth, asyncHandler(getPurchasesHandler));
router.get('/subscription/invoice/:id', requireAuth, asyncHandler(getPurchaseInvoiceHandler));
router.post('/subscription/renewal', requireAuth, subscriptionRateLimiter, asyncHandler(updateRenewalHandler));
router.post('/subscription/create-intent', requireAuth, subscriptionRateLimiter, asyncHandler(createPaymentIntentHandler));
router.post('/subscription/confirm', requireAuth, subscriptionRateLimiter, asyncHandler(confirmPaymentHandler));
router.post('/subscription/webhook', asyncHandler(stripeWebhookHandler));

export default router;
