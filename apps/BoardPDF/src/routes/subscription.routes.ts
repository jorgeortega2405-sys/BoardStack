import { cancelSubscriptionImmediate, confirmOneTimePayment, confirmSubscriptionPayment, createCheckout, createOneTimeIntent, createSetupIntent, createSubscriptionIntent, deletePaymentMethod, getBillingDetails, getPurchaseHistory, getSubscriptions, handleWebhook, setDefaultPaymentMethod, updateAutoRenewal, verifySession } from '../controllers/subscription.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/subscription/plans', getSubscriptions);
router.post('/subscription/checkout', requireAuth, createCheckout);
router.post('/subscription/create-intent', requireAuth, createSubscriptionIntent);
router.post('/subscription/confirm-intent', requireAuth, confirmSubscriptionPayment);
router.post('/subscription/create-one-time-intent', requireAuth, createOneTimeIntent);
router.post('/subscription/confirm-one-time-intent', requireAuth, confirmOneTimePayment);
router.get('/subscription/verify-session', requireAuth, verifySession);
router.post('/subscription/webhook', handleWebhook);

router.get('/subscription/billing', requireAuth, getBillingDetails);
router.get('/subscription/purchases', requireAuth, getPurchaseHistory);
router.post('/subscription/renewal', requireAuth, updateAutoRenewal);
router.post('/subscription/cancel-immediate', requireAuth, cancelSubscriptionImmediate);

export default router;
