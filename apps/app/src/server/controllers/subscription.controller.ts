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
import { PRO_PLAN } from '../config/subscription-plans.config.js';
import type { Request, Response } from 'express';
import { updateActiveAccountInSession } from '../services/auth.service.js';

async function getSubscriptionConfig(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    ok: true,
    plan: PRO_PLAN,
    publishableKey: config.stripe.publishableKey,
  });
}

async function getSubscriptionStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(200).json({
        is_active: false,
        ok: true,
        status: 'inactive',
        tier: 'free',
      });
      return;
    }

    const info = await getUserSubscriptionInfo(user.id);
    res.status(200).json({
      ok: true,
      ...info,
    });
  } catch (error) {
    logger.app.error('[Subscription] Error getting status:', error);
    res.status(500).json({ error: 'Error fetching subscription status.', ok: false });
  }
}

async function createPaymentIntentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'You must be logged in to make a purchase.', ok: false });
      return;
    }

    const { billingPeriod, billingType, planId } = req.body || {};

    if (planId !== 'pro') {
      res.status(400).json({ error: 'Invalid subscription plan.', ok: false });
      return;
    }

    if (billingType !== 'recurring' && billingType !== 'one_time') {
      res.status(400).json({ error: 'Invalid billing type.', ok: false });
      return;
    }

    const validPeriods = ['1_month', '6_months', '12_months', 'monthly', 'yearly'];
    if (!validPeriods.includes(billingPeriod)) {
      res.status(400).json({ error: 'Invalid billing period.', ok: false });
      return;
    }

    const result = await createSubscriptionPaymentIntent(user.id, user.email, {
      billingPeriod,
      billingType,
      planId: 'pro',
    });

    res.status(200).json({
      ok: true,
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.app.error('[Subscription] Error creating payment intent:', error);
    if (error?.message === 'User not found.') {
      res.status(401).json({
        error: 'User not found or session expired. Please log in again.',
        ok: false,
        success: false,
      });
      return;
    }
    res.status(500).json({
      error: 'Failed to initialize payment gateway. Please try again later.',
      ok: false,
      success: false,
    });
  }
}

async function confirmPaymentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'You must be logged in to confirm payment.', ok: false, success: false });
      return;
    }

    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      res.status(400).json({ error: 'PaymentIntent ID is required.', ok: false, success: false });
      return;
    }

    const result = await confirmSubscriptionPayment(user.id, paymentIntentId);

    updateActiveAccountInSession(res, req, {
      subscription_status: 'active',
      subscription_tier: 'pro',
    });

    res.status(200).json({
      message: 'Pro subscription activated successfully.',
      ok: true,
      periodEnd: result.periodEnd,
      status: result.status,
      success: true,
      tier: result.tier,
    });
  } catch (error: any) {
    logger.app.error('[Subscription] Error confirming payment:', error);
    res.status(500).json({
      error: 'Failed to confirm subscription payment. Please try again later.',
      ok: false,
      success: false,
    });
  }
}

async function getBillingDetailsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false, success: false });
      return;
    }

    const details = await getBillingDetails(user.id);
    res.status(200).json(details);
  } catch (error) {
    logger.app.error('[Subscription] Error fetching billing details:', error);
    res.status(500).json({ error: 'Error fetching billing details.', ok: false, success: false });
  }
}

async function getPurchasesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false, success: false });
      return;
    }

    const purchases = await getUserPurchases(user.id);
    res.status(200).json({
      ok: true,
      purchases,
      success: true,
    });
  } catch (error) {
    logger.app.error('[Subscription] Error fetching purchases:', error);
    res.status(500).json({ error: 'Error fetching purchase history.', ok: false, success: false });
  }
}

async function updateRenewalHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false, success: false });
      return;
    }

    const { cancelAtPeriodEnd } = req.body || {};
    if (typeof cancelAtPeriodEnd !== 'boolean') {
      res.status(400).json({ error: 'A boolean cancelAtPeriodEnd value is required.', ok: false, success: false });
      return;
    }
    const result = await updateSubscriptionRenewal(user.id, cancelAtPeriodEnd);

    res.status(200).json({
      cancel_at_period_end: result.cancel_at_period_end,
      current_period_end: result.current_period_end,
      message: cancelAtPeriodEnd
        ? 'Auto-renewal cancelled. Your subscription remains active until the end of the billing period.'
        : 'Auto-renewal reactivated successfully.',
      ok: true,
      success: true,
    });
  } catch (error) {
    logger.app.error('[Subscription] Error updating auto-renewal:', error);
    res.status(500).json({ error: 'Could not update auto-renewal.', ok: false, success: false });
  }
}

async function getPurchaseInvoiceHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session.', ok: false, success: false });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Purchase ID is required.', ok: false, success: false });
      return;
    }

    const invoice = await getPurchaseInvoice(user.id, id);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.', ok: false, success: false });
      return;
    }

    res.status(200).json({
      invoice,
      ok: true,
      success: true,
    });
  } catch (error) {
    logger.app.error('[Subscription] Error fetching invoice:', error);
    res.status(500).json({ error: 'Error fetching invoice details.', ok: false, success: false });
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
