import { cancelSubscriptionImmediate, createCheckout, createSetupIntent, deletePaymentMethod, getBillingDetails, getPurchaseHistory, getSubscriptions, handleWebhook, setDefaultPaymentMethod, updateAutoRenewal, verifySession } from '../controllers/subscription.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/subscription/plans', getSubscriptions);
router.post('/subscription/checkout', requireAuth, createCheckout);
router.get('/subscription/verify-session', requireAuth, verifySession);
router.post('/subscription/webhook', handleWebhook);

router.get('/subscription/billing', requireAuth, getBillingDetails);
router.get('/subscription/purchases', requireAuth, getPurchaseHistory);
router.post('/subscription/renewal', requireAuth, updateAutoRenewal);
router.post('/subscription/cancel-immediate', requireAuth, cancelSubscriptionImmediate);

export default router;
