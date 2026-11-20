import {
  confirmPaymentHandler,
  createPaymentIntentHandler,
  getBillingDetailsHandler,
  getPurchaseInvoiceHandler,
  getPurchasesHandler,
  getSubscriptionConfig,
  getSubscriptionStatus,
  updateRenewalHandler,
} from '../controllers/subscription.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/subscription/config', getSubscriptionConfig);
router.get('/subscription/status', getSubscriptionStatus);
router.get('/subscription/billing', requireAuth, getBillingDetailsHandler);
router.get('/subscription/purchases', requireAuth, getPurchasesHandler);
router.get('/subscription/invoice/:id', requireAuth, getPurchaseInvoiceHandler);
router.post('/subscription/renewal', requireAuth, updateRenewalHandler);
router.post('/subscription/create-intent', requireAuth, createPaymentIntentHandler);
router.post('/subscription/confirm', requireAuth, confirmPaymentHandler);

export default router;