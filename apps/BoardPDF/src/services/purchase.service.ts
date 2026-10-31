import { getDbPool } from '../config/database.config.js';
import { normalizeTierKey } from '../config/plans.config.js';
import { redis } from '../config/redis.config.js';
import { PurchaseRecord, SubscriptionTierId } from '../types/subscription.types.js';
import { logger } from './logger.service.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export class PurchaseService {
  private static instance: PurchaseService;

  private constructor() {}

  public static getInstance(): PurchaseService {
    if (!PurchaseService.instance) {
      PurchaseService.instance = new PurchaseService();
    }
    return PurchaseService.instance;
  }

  public async recordPurchase(purchase: PurchaseRecord): Promise<void> {
    const pool = getDbPool();
    try {
      await pool.query<ResultSetHeader>(
        `INSERT INTO purchases (
          user_id,
          stripe_session_id,
          stripe_payment_intent_id,
          stripe_subscription_id,
          stripe_customer_id,
          plan_id,
          billing_period,
          amount_total,
          currency,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          stripe_payment_intent_id = VALUES(stripe_payment_intent_id),
          stripe_subscription_id = VALUES(stripe_subscription_id),
          stripe_customer_id = VALUES(stripe_customer_id),
          status = VALUES(status),
          updated_at = CURRENT_TIMESTAMP`,
        [
          purchase.user_id,
          purchase.stripe_session_id,
          purchase.stripe_payment_intent_id || null,
          purchase.stripe_subscription_id || null,
          purchase.stripe_customer_id || null,
          purchase.plan_id,
          purchase.billing_period,
          purchase.amount_total,
          purchase.currency.toUpperCase(),
          purchase.status,
        ]
      );
      logger.db.info('Registro de compra guardado en base de datos', {
        period: purchase.billing_period,
        plan: purchase.plan_id,
        status: purchase.status,
        userId: purchase.user_id,
      });
    } catch (error) {
      logger.db.error('Error al registrar compra en base de datos', error);
      throw error;
    }
  }

  public async updateUserSubscription(
    userId: number,
    tier: string,
    customerId?: string | null,
    subscriptionId?: string | null,
    status = 'active',
    periodEnd?: Date | null
  ): Promise<void> {
    const canonicalTier = normalizeTierKey(tier);
    const pool = getDbPool();

    try {
      const shouldUpdateSubId = subscriptionId !== undefined;
      const shouldUpdatePeriodEnd = periodEnd !== undefined;

      const params: any[] = [canonicalTier, customerId || null];
      if (shouldUpdateSubId) params.push(subscriptionId);
      params.push(status);
      if (shouldUpdatePeriodEnd) params.push(periodEnd);
      params.push(userId);

      await pool.query<ResultSetHeader>(
        `UPDATE users
        SET
          subscription_tier = ?,
          stripe_customer_id = COALESCE(?, stripe_customer_id),
          stripe_subscription_id = ${shouldUpdateSubId ? '?' : 'stripe_subscription_id'},
          subscription_status = ?,
          subscription_period_end = ${shouldUpdatePeriodEnd ? '?' : 'subscription_period_end'}
        WHERE id = ?`,
        params
      );

      try {
        await redis.del(`user:profile:${userId}`);
      } catch {}

      logger.db.info('Suscripción de usuario actualizada en base de datos', {
        status,
        tier: canonicalTier,
        userId,
      });
    } catch (error) {
      logger.db.error('Error al actualizar suscripción de usuario', error);
      throw error;
    }
  }

  public async getPurchasesByUserId(userId: number): Promise<PurchaseRecord[]> {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows as PurchaseRecord[];
  }

  public async getPurchaseBySessionId(sessionId: string): Promise<PurchaseRecord | null> {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM purchases WHERE stripe_session_id = ? LIMIT 1',
      [sessionId]
    );
    if (rows.length === 0) return null;
    return rows[0] as PurchaseRecord;
  }

  public async getUserBillingInfo(userId: number): Promise<{
    email: string;
    id: number;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_period_end: Date | null;
    subscription_status: string;
    subscription_tier: SubscriptionTierId;
    username: string;
  } | null> {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, subscription_tier, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (rows.length === 0) return null;
    const u = rows[0];
    return {
      email: u.email,
      id: u.id,
      stripe_customer_id: u.stripe_customer_id || null,
      stripe_subscription_id: u.stripe_subscription_id || null,
      subscription_period_end: u.subscription_period_end || null,
      subscription_status: u.subscription_status || 'inactive',
      subscription_tier: normalizeTierKey(u.subscription_tier),
      username: u.username,
    };
  }

  public async getUserByStripeCustomerId(customerId: string): Promise<{
    email: string;
    id: number;
    subscription_tier: SubscriptionTierId;
  } | null> {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, email, subscription_tier FROM users WHERE stripe_customer_id = ? LIMIT 1',
      [customerId]
    );
    if (rows.length === 0) return null;
    return {
      email: rows[0].email,
      id: rows[0].id,
      subscription_tier: normalizeTierKey(rows[0].subscription_tier),
    };
  }
}

export const purchaseService = PurchaseService.getInstance();
