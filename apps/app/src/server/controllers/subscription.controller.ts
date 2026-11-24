import { config } from '../config/env.config.js';
import {
  confirmSubscriptionPayment,
  createSubscriptionPaymentIntent,
  getBillingDetails,
  getPurchaseInvoice,
  getUserPurchases,
  getUserSubscriptionInfo,
  updateSubscriptionRenewal,
} from '../services/subscription.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../utils/logger.js';
import { ENTERPRISE_PLAN, PRO_PLAN } from '../config/subscription-plans.config.js';
import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../utils/response.util.js';
import { updateActiveAccountInSession } from '../services/auth.service.js';

async function getSubscriptionConfig(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, {
    enterprisePlan: ENTERPRISE_PLAN,
    plan: PRO_PLAN,
    publishableKey: config.stripe.publishableKey,
  });
}

async function getSubscriptionStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendSuccess(res, {
        is_active: false,
        status: 'inactive',
        tier: 'free',
      });
      return;
    }

    const info = await getUserSubscriptionInfo(user.id);
    sendSuccess(res, info);
  } catch (error) {
    logger.app.error('[Subscription] Error getting status:', error);
    sendError(res, 'Error fetching subscription status.', 500);
  }
}

async function createPaymentIntentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendError(res, 'You must be logged in to make a purchase.', 401);
      return;
    }

    const { billingPeriod, billingType, planId } = req.body || {};

    if (planId !== 'pro' && planId !== 'enterprise') {
      sendError(res, 'Invalid subscription plan.', 400);
      return;
    }

    if (billingType !== 'recurring' && billingType !== 'one_time') {
      sendError(res, 'Invalid billing type.', 400);
      return;
    }

    const validPeriods = ['1_month', '6_months', '12_months', 'monthly', 'yearly'];
    if (!validPeriods.includes(billingPeriod)) {
      sendError(res, 'Invalid billing period.', 400);
      return;
    }

    const result = await createSubscriptionPaymentIntent(user.id, user.email, {
      billingPeriod,
      billingType,
      planId,
    });

    sendSuccess(res, result);
  } catch (error: any) {
    logger.app.error('[Subscription] Error creating payment intent:', error);
    if (error?.message === 'User not found.') {
      sendError(res, 'User not found or session expired. Please log in again.', 401);
      return;
    }
    sendError(res, 'Failed to initialize payment gateway. Please try again later.', 500);
  }
}

async function confirmPaymentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendError(res, 'You must be logged in to confirm payment.', 401);
      return;
    }

    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      sendError(res, 'PaymentIntent ID is required.', 400);
      return;
    }

    const result = await confirmSubscriptionPayment(user.id, paymentIntentId);

    updateActiveAccountInSession(res, req, {
      subscription_status: 'active',
      subscription_tier: result.tier,
    });

    sendSuccess(res, {
      message: `${result.tier === 'enterprise' ? 'Enterprise' : 'Pro'} subscription activated successfully.`,
      periodEnd: result.periodEnd,
      status: result.status,
      tier: result.tier,
    });
  } catch (error: any) {
    logger.app.error('[Subscription] Error confirming payment:', error);
    sendError(res, 'Failed to confirm subscription payment. Please try again later.', 500);
  }
}

async function getBillingDetailsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendError(res, 'Invalid or expired session.', 401);
      return;
    }

    const details = await getBillingDetails(user.id);
    res.status(200).json(details);
  } catch (error) {
    logger.app.error('[Subscription] Error fetching billing details:', error);
    sendError(res, 'Error fetching billing details.', 500);
  }
}

async function getPurchasesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendError(res, 'Invalid or expired session.', 401);
      return;
    }

    const purchases = await getUserPurchases(user.id);
    sendSuccess(res, { purchases });
  } catch (error) {
    logger.app.error('[Subscription] Error fetching purchases:', error);
    sendError(res, 'Error fetching purchase history.', 500);
  }
}

async function updateRenewalHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendError(res, 'Invalid or expired session.', 401);
      return;
    }

    const { cancelAtPeriodEnd } = req.body || {};
    if (typeof cancelAtPeriodEnd !== 'boolean') {
      sendError(res, 'A boolean cancelAtPeriodEnd value is required.', 400);
      return;
    }
    const result = await updateSubscriptionRenewal(user.id, cancelAtPeriodEnd);

    sendSuccess(res, {
      cancel_at_period_end: result.cancel_at_period_end,
      current_period_end: result.current_period_end,
      message: cancelAtPeriodEnd
        ? 'Auto-renewal cancelled. Your subscription remains active until the end of the billing period.'
        : 'Auto-renewal reactivated successfully.',
    });
  } catch (error) {
    logger.app.error('[Subscription] Error updating auto-renewal:', error);
    sendError(res, 'Could not update auto-renewal.', 500);
  }
}

async function getPurchaseInvoiceHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendError(res, 'Invalid or expired session.', 401);
      return;
    }

    const { id } = req.params;
    if (!id) {
      sendError(res, 'Purchase ID is required.', 400);
      return;
    }

    const invoice = await getPurchaseInvoice(user.id, id);
    if (!invoice) {
      sendError(res, 'Invoice not found.', 404);
      return;
    }

    sendSuccess(res, { invoice });
  } catch (error) {
    logger.app.error('[Subscription] Error fetching invoice:', error);
    sendError(res, 'Error fetching invoice details.', 500);
  }
}

export {
  confirmPaymentHandler,
  createPaymentIntentHandler,
  getBillingDetailsHandler,
  getPurchaseInvoiceHandler,
  getPurchasesHandler,
  getSubscriptionConfig,
  getSubscriptionStatus,
  updateRenewalHandler
};
