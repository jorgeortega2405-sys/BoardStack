import {
  calculatePeriodEnd,
  ENTERPRISE_PLAN,
  getPriceAmount,
  getStorageTierLimitBytes,
  PRO_PLAN,
} from '../config/subscription-plans.config.js';
import { config } from '../config/env.config.js';
import { corePool, pool } from '../config/database.config.js';
import crypto from 'crypto';
import { ensureAppUserProfile, invalidateUserCache } from './user.service.js';
import { logger } from '../utils/logger.js';
import { RowDataPacket } from 'mysql2';
import Stripe from 'stripe';

const stripe = new Stripe(config.stripe.secretKey || '', {
  apiVersion: '2025-02-24.acacia' as any,
});

interface SubscriptionInfo {
  billing_period?: string;
  billing_type?: string;
  is_active: boolean;
  period_end?: string | null;
  status: string;
  tier: string;
}

interface CreatePaymentIntentParams {
  billingPeriod: '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly';
  billingType: 'one_time' | 'recurring';
  planId: 'pro' | 'business' | 'enterprise';
  seats?: number;
}

interface InvoiceData {
  amount: string;
  billingPeriod?: string | null;
  billingType?: string | null;
  createdAt: string;
  currency: string;
  customerEmail: string;
  customerName: string;
  id: number | string;
  invoiceNumber: string;
  planId: string;
  receiptUrl: string | null;
  reference: string;
  status: string;
}

interface PaymentIntentResult {
  amount: number;
  billingPeriod: string;
  billingType: string;
  clientSecret: string;
  currency: string;
  paymentIntentId: string;
  planId: string;
  publishableKey: string;
}

async function getUserSubscriptionInfo(userId: number): Promise<SubscriptionInfo> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT subscription_tier, subscription_status, subscription_period_end FROM app_user_profiles WHERE user_id = ?',
    [userId]
  );

  if (!rows || rows.length === 0) {
    return { is_active: false, status: 'inactive', tier: 'free' };
  }

  const user = rows[0];
  const tier = user.subscription_tier || 'free';
  const status = user.subscription_status || 'inactive';
  const periodEnd = user.subscription_period_end || null;

  const isActive = (tier === 'pro' || tier === 'business' || tier === 'enterprise') && status === 'active' && (!periodEnd || new Date(periodEnd).getTime() > Date.now());

  return {
    is_active: isActive,
    period_end: periodEnd,
    status: isActive ? 'active' : 'inactive',
    tier: isActive ? tier : 'free',
  };
}

async function getOrCreateStripeCustomer(userId: number, email: string): Promise<string> {
  await ensureAppUserProfile(userId);
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT stripe_customer_id FROM app_user_profiles WHERE user_id = ?',
    [userId]
  );

  if (!rows || rows.length === 0) {
    throw new Error('User not found.');
  }

  const existingId = rows[0]?.stripe_customer_id;
  if (existingId) {
    try {
      const customer = await stripe.customers.retrieve(existingId);
      if (!customer.deleted) {
        return customer.id;
      }
    } catch {}
  }

  const customer = await stripe.customers.create({
    email: email.toLowerCase().trim(),
    metadata: {
      userId: String(userId),
    },
  });

  await pool.query(
    'UPDATE app_user_profiles SET stripe_customer_id = ? WHERE user_id = ?',
    [customer.id, userId]
  );

  return customer.id;
}

async function createSubscriptionPaymentIntent(
  userId: number,
  email: string,
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResult> {
  const [userRows] = await corePool.query<RowDataPacket[]>(
    'SELECT id, email FROM users WHERE id = ?',
    [userId]
  );
  if (!userRows || userRows.length === 0) {
    throw new Error('User not found.');
  }

  const customerId = await getOrCreateStripeCustomer(userId, email);
  const seats = params.planId === 'business' ? (params.seats || 3) : undefined;
  const amount = getPriceAmount(params.planId, params.billingType, params.billingPeriod, seats);
  const amountInCents = Math.round(amount * 100);

  const planDisplayName = params.planId === 'enterprise' ? 'Enterprise' : (params.planId === 'business' ? 'Business' : 'Pro');
  const seatsDesc = params.planId === 'business' ? ` (${seats || 3} seats)` : '';
  const description = `BoardStack ${planDisplayName}${seatsDesc} - ${params.billingType === 'recurring' ? 'Subscription ' + params.billingPeriod : 'One-time payment ' + params.billingPeriod}`;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    automatic_payment_methods: { enabled: true },
    currency: 'usd',
    customer: customerId,
    description,
    metadata: {
      billingPeriod: params.billingPeriod,
      billingType: params.billingType,
      planId: params.planId,
      seats: String(seats || 3),
      userId: String(userId),
    },
  });

  if (!paymentIntent.client_secret) {
    throw new Error('Unable to initialize payment intent.');
  }

  const now = new Date();
  const periodEnd = calculatePeriodEnd(now, params.billingType, params.billingPeriod);

  await pool.query(
    `INSERT INTO subscriptions (user_id, plan_id, billing_type, billing_period, amount, currency, status, stripe_customer_id, stripe_payment_intent_id, current_period_start, current_period_end)
     VALUES (?, ?, ?, ?, ?, 'USD', 'pending', ?, ?, ?, ?)`,
    [
      userId,
      params.planId,
      params.billingType,
      params.billingPeriod,
      amount,
      customerId,
      paymentIntent.id,
      now,
      periodEnd,
    ]
  );

  return {
    amount,
    billingPeriod: params.billingPeriod,
    billingType: params.billingType,
    clientSecret: paymentIntent.client_secret,
    currency: 'USD',
    paymentIntentId: paymentIntent.id,
    planId: params.planId,
    publishableKey: config.stripe.publishableKey,
  };
}

async function confirmSubscriptionPayment(
  userId: number,
  paymentIntentId: string
): Promise<{ ok: boolean; periodEnd: Date; status: string; tier: string }> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (intent.metadata?.userId && intent.metadata.userId !== String(userId)) {
    throw new Error('Payment intent does not belong to this user.');
  }

  if (intent.status !== 'succeeded' && intent.status !== 'processing') {
    throw new Error(`Payment has not yet succeeded (Current status: ${intent.status}).`);
  }

  const billingType = (intent.metadata.billingType as 'one_time' | 'recurring') || 'recurring';
  const billingPeriod = (intent.metadata.billingPeriod as any) || 'monthly';
  const planId = (intent.metadata.planId as 'pro' | 'business' | 'enterprise') || 'pro';
  const seatsLimit = Math.max(3, parseInt(intent.metadata.seats || '3', 10) || 3);

  const now = new Date();
  const periodEnd = calculatePeriodEnd(now, billingType, billingPeriod);

  const [existingPurchases] = await pool.query<RowDataPacket[]>(
    'SELECT id, created_at FROM purchases WHERE stripe_payment_intent_id = ? LIMIT 1',
    [paymentIntentId]
  );

  if (existingPurchases && existingPurchases.length > 0) {
    await invalidateUserCache(userId);
    return {
      ok: true,
      periodEnd,
      status: 'active',
      tier: planId,
    };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const storageLimitBytes = getStorageTierLimitBytes(planId);

    await conn.query(
      'INSERT IGNORE INTO app_user_profiles (user_id) VALUES (?)',
      [userId]
    );

    await conn.query(
      `UPDATE app_user_profiles
       SET subscription_tier = ?, subscription_status = 'active', subscription_period_end = ?, storage_limit_bytes = ?
       WHERE user_id = ?`,
      [planId, periodEnd, storageLimitBytes, userId]
    );

    if (planId === 'enterprise' || planId === 'business') {
      const [existingOrg] = await conn.query<RowDataPacket[]>(
        'SELECT id, seats_limit FROM organizations WHERE owner_id = ? LIMIT 1',
        [userId]
      );
      if (!existingOrg || existingOrg.length === 0) {
        const [userRows] = await corePool.query<RowDataPacket[]>(
          'SELECT username, email FROM users WHERE id = ? LIMIT 1',
          [userId]
        );
        const orgUuid = crypto.randomUUID();
        const defaultOrgName = userRows[0]?.username || (planId === 'business' ? 'Business' : 'Enterprise');
        const defaultSlug = `org-${userId}-${Date.now().toString(36)}`;
        const [orgResult] = await conn.query<any>(
          `INSERT INTO organizations (uuid, owner_id, name, slug, seats_limit, saml_enabled)
           VALUES (?, ?, ?, ?, ?, FALSE)`,
          [orgUuid, userId, defaultOrgName, defaultSlug, seatsLimit]
        );
        const orgId = orgResult.insertId;
        await conn.query(
          `INSERT INTO organization_members (org_id, user_id, email, role, status)
           VALUES (?, ?, ?, 'owner', 'active')`,
          [orgId, userId, userRows[0]?.email || '']
        );
      } else {
        await conn.query(
          'UPDATE organizations SET seats_limit = ? WHERE id = ?',
          [seatsLimit, existingOrg[0].id]
        );
      }
    }

    await conn.query(
      `UPDATE subscriptions
       SET status = 'replaced'
       WHERE user_id = ? AND status = 'active' AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id != ?)`,
      [userId, paymentIntentId]
    );

    await conn.query(
      `UPDATE subscriptions 
       SET status = 'active', current_period_start = ?, current_period_end = ?
       WHERE stripe_payment_intent_id = ? AND user_id = ?`,
      [now, periodEnd, paymentIntentId, userId]
    );

    const amountTotal = (intent.amount || 0) / 100;
    await conn.query(
      `INSERT INTO purchases (user_id, plan_id, billing_type, billing_period, amount_total, currency, status, stripe_payment_intent_id, stripe_customer_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'USD', 'completed', ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = 'completed'`,
      [userId, planId, billingType, billingPeriod, amountTotal, paymentIntentId, intent.customer ? String(intent.customer) : null, now]
    );

    await conn.commit();
    await invalidateUserCache(userId);

    return {
      ok: true,
      periodEnd,
      status: 'active',
      tier: planId,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getBillingDetails(userId: number): Promise<any> {
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT subscription_tier, subscription_status, subscription_period_end,
            stripe_customer_id, stripe_subscription_id, cancel_at_period_end,
            storage_used_bytes, storage_limit_bytes
     FROM app_user_profiles WHERE user_id = ?`,
    [userId]
  );

  if (!userRows || userRows.length === 0) {
    return {
      amount: 0,
      billing_period: null,
      billing_type: null,
      cancel_at_period_end: false,
      current_period_end: null,
      hasSubscription: false,
      is_enterprise_managed: false,
      is_one_time: false,
      ok: true,
      organization_name: null,
      seats_limit: null,
      status: 'inactive',
      success: true,
      tier: 'free',
    };
  }

  const user = userRows[0];
  const [subRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  const latestSub = subRows[0] || null;

  const [orgRows] = await pool.query<RowDataPacket[]>(
    `SELECT o.name, o.seats_limit
     FROM organizations o
     LEFT JOIN organization_members om ON om.org_id = o.id
     WHERE o.owner_id = ? OR om.user_id = ?
     ORDER BY (o.owner_id = ?) DESC, o.id ASC
     LIMIT 1`,
    [userId, userId, userId]
  );
  const orgInfo = orgRows[0] || null;

  const isEnterprise = user.subscription_tier === 'enterprise';
  const isBusiness = user.subscription_tier === 'business';
  const isPro = isEnterprise || isBusiness || user.subscription_tier === 'pro';
  const isActive = isPro && (user.subscription_status === 'active' || user.subscription_status === 'trialing');

  const billingType = latestSub?.billing_type || (user.stripe_subscription_id ? 'recurring' : 'one_time');
  const billingPeriod = latestSub?.billing_period || 'monthly';
  const isOneTime = billingType === 'one_time' || billingType === 'enterprise_contract';
  const cancelAtPeriodEnd = Boolean(user.cancel_at_period_end || latestSub?.cancel_at_period_end);

  const defaultAmount = isEnterprise ? 0 : (isBusiness ? 29.00 : (isPro ? 9.99 : 0));
  const customLimit = Number(user.storage_limit_bytes || 0);
  const storageLimit = customLimit > 0 ? customLimit : getStorageTierLimitBytes(user.subscription_tier);

  return {
    amount: latestSub ? Number(latestSub.amount) : defaultAmount,
    billing_period: billingPeriod,
    billing_type: billingType,
    cancel_at_period_end: cancelAtPeriodEnd,
    current_period_end: user.subscription_period_end || latestSub?.current_period_end || null,
    currency: latestSub?.currency || 'USD',
    hasSubscription: isActive,
    is_enterprise_managed: isEnterprise,
    is_one_time: isOneTime,
    ok: true,
    organization_name: orgInfo?.name || null,
    seats_limit: orgInfo ? Number(orgInfo.seats_limit || 0) : null,
    status: isActive ? 'active' : 'inactive',
    storage_limit_bytes: storageLimit,
    storage_used_bytes: Number(user.storage_used_bytes || 0),
    stripe_subscription_id: user.stripe_subscription_id || null,
    success: true,
    tier: isActive ? (user.subscription_tier || 'free') : 'free',
  };
}

async function updateSubscriptionRenewal(
  userId: number,
  cancelAtPeriodEnd: boolean
): Promise<{ cancel_at_period_end: boolean; current_period_end: string | null; success: boolean }> {
  const [userRows] = await pool.query<RowDataPacket[]>(
    'SELECT stripe_subscription_id, subscription_period_end FROM app_user_profiles WHERE user_id = ?',
    [userId]
  );
  const user = userRows[0];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      'UPDATE app_user_profiles SET cancel_at_period_end = ? WHERE user_id = ?',
      [cancelAtPeriodEnd ? 1 : 0, userId]
    );

    await conn.query(
      'UPDATE subscriptions SET cancel_at_period_end = ? WHERE user_id = ? AND status = "active"',
      [cancelAtPeriodEnd ? 1 : 0, userId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await invalidateUserCache(userId);

  if (user?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(user.stripe_subscription_id, {
        cancel_at_period_end: cancelAtPeriodEnd,
      });
    } catch (err) {
      logger.system.warn('[Subscription] Stripe update warning:', err);
    }
  }

  return {
    cancel_at_period_end: cancelAtPeriodEnd,
    current_period_end: user?.subscription_period_end || null,
    success: true,
  };
}

async function getUserPurchases(userId: number): Promise<any[]> {
  const [purchaseRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );

  if (purchaseRows.length > 0) {
    return purchaseRows;
  }

  const [subRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, plan_id, billing_type, billing_period, amount AS amount_total,
            currency, status, stripe_payment_intent_id, stripe_subscription_id,
            created_at
     FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );

  return subRows;
}

async function getPurchaseInvoice(userId: number, purchaseId: number | string): Promise<InvoiceData | null> {
  const [purchaseRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM purchases WHERE id = ? AND user_id = ? LIMIT 1',
    [purchaseId, userId]
  );

  let record = purchaseRows[0] || null;

  if (!record) {
    const [subRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, plan_id, billing_type, billing_period, amount AS amount_total,
              currency, status, stripe_payment_intent_id, stripe_subscription_id,
              created_at
       FROM subscriptions WHERE id = ? AND user_id = ? LIMIT 1`,
      [purchaseId, userId]
    );
    record = subRows[0] || null;
  }

  if (!record) {
    return null;
  }

  const [userRows] = await corePool.query<RowDataPacket[]>(
    'SELECT username, email FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const user = userRows[0] || {};

  let receiptUrl: string | null = null;
  const paymentIntentId = record.stripe_payment_intent_id;
  if (paymentIntentId && config.stripe.secretKey && !config.stripe.secretKey.includes('placeholder')) {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge'],
      });
      if (intent.latest_charge && typeof intent.latest_charge !== 'string') {
        receiptUrl = (intent.latest_charge as any).receipt_url || null;
      }
    } catch (stripeErr) {
      logger.app.warn('[Subscription] Could not retrieve Stripe receipt URL:', stripeErr);
    }
  }

  const createdDate = record.created_at ? new Date(record.created_at) : new Date();
  const year = createdDate.getFullYear();
  const paddedId = String(record.id).padStart(6, '0');

  return {
    amount: Number(record.amount_total || record.amount || 0).toFixed(2),
    billingPeriod: record.billing_period || null,
    billingType: record.billing_type || null,
    createdAt: createdDate.toISOString(),
    currency: (record.currency || 'USD').toUpperCase(),
    customerEmail: user.email || '',
    customerName: user.username || 'Customer',
    id: record.id,
    invoiceNumber: `INV-${year}-${paddedId}`,
    planId: record.plan_id || 'pro',
    receiptUrl,
    reference: record.stripe_payment_intent_id || record.stripe_subscription_id || `#${record.id}`,
    status: record.status || 'completed',
  };
}

async function processStripeWebhook(rawBody: Buffer | string, signature: string): Promise<{ received: boolean }> {
  if (!config.stripe.webhookSecret) {
    throw new Error('Stripe webhook secret is not configured.');
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata?.userId;
      if (userId) {
        await confirmSubscriptionPayment(Number(userId), paymentIntent.id);
        logger.app.info(`[Stripe Webhook] Payment confirmed for user ${userId}, intent ${paymentIntent.id}`);
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as any;
      const customerId = invoice.customer ? String(invoice.customer) : null;
      if (customerId) {
        await pool.query(
          `UPDATE subscriptions SET status = 'past_due' WHERE stripe_customer_id = ?`,
          [customerId]
        );
        await pool.query(
          `UPDATE app_user_profiles SET subscription_status = 'past_due' WHERE stripe_customer_id = ?`,
          [customerId]
        );
        logger.app.warn(`[Stripe Webhook] Invoice payment failed for customer ${customerId}`);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any;
      const customerId = subscription.customer ? String(subscription.customer) : null;
      if (customerId) {
        await pool.query(
          `UPDATE subscriptions SET status = 'canceled' WHERE stripe_customer_id = ?`,
          [customerId]
        );
        await pool.query(
          `UPDATE app_user_profiles SET subscription_status = 'canceled', subscription_tier = 'free' WHERE stripe_customer_id = ?`,
          [customerId]
        );
        logger.app.info(`[Stripe Webhook] Subscription canceled for customer ${customerId}`);
      }
      break;
    }
    default:
      break;
  }

  return { received: true };
}

export {
  confirmSubscriptionPayment,
  createSubscriptionPaymentIntent,
  getBillingDetails,
  getOrCreateStripeCustomer,
  getPurchaseInvoice,
  getUserPurchases,
  getUserSubscriptionInfo,
  processStripeWebhook,
  updateSubscriptionRenewal
};

export type {
  CreatePaymentIntentParams,
  InvoiceData,
  PaymentIntentResult,
  SubscriptionInfo
};
