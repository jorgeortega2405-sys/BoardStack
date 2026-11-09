import { getDbPool } from '../config/database.config.js';
import { normalizeTierKey } from '../config/plans.config.js';
import { PurchaseRecord, SubscriptionTierId } from '../types/subscription.types.js';
import { getMonthlyQuotaByPermissions } from './ai-token.service.js';
import { cacheService } from './cache.service.js';
import { logger } from './logger.service.js';
import { permissionService } from './permission.service.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

class PurchaseService {
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
          stripe_payment_intent_id = COALESCE(VALUES(stripe_payment_intent_id), stripe_payment_intent_id),
          stripe_subscription_id = COALESCE(VALUES(stripe_subscription_id), stripe_subscription_id),
          stripe_customer_id = COALESCE(VALUES(stripe_customer_id), stripe_customer_id),
          status = IF(purchases.status = 'completed', 'completed', VALUES(status)),
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
        await cacheService.invalidateUser(String(userId));
        await permissionService.invalidateUserPermissions(userId);
      } catch {}

      if (status === 'active') {
        try {
          const perms = await permissionService.getUserPermissions(userId, canonicalTier, status);
          const newQuota = getMonthlyQuotaByPermissions(perms);
          await pool.query(
            'UPDATE users SET ai_tokens_balance = ?, ai_tokens_reset_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 MONTH) WHERE id = ?',
            [newQuota, userId]
          );
        } catch (tokenErr) {
          logger.db.warn('Error al actualizar tokens de usuario tras cambio de suscripción', tokenErr);
        }
      }

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

  public async getPurchaseById(purchaseId: number, userId: number): Promise<PurchaseRecord | null> {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM purchases WHERE id = ? AND user_id = ? LIMIT 1',
      [purchaseId, userId]
    );
    if (rows.length === 0) return null;
    return rows[0] as PurchaseRecord;
  }

  public async getPurchaseBySessionId(sessionId: string): Promise<PurchaseRecord | null> {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM purchases WHERE stripe_session_id = ? OR stripe_payment_intent_id = ? LIMIT 1',
      [sessionId, sessionId]
    );
    if (rows.length === 0) return null;
    return rows[0] as PurchaseRecord;
  }

  public async fulfillPurchase(
    userId: number,
    tier: string,
    purchaseData: PurchaseRecord,
    periodEnd?: Date | null,
    subscriptionId?: string | null,
    status = 'active'
  ): Promise<{ alreadyCompleted: boolean; success: boolean }> {
    const pool = getDbPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const lookupKey = purchaseData.stripe_session_id || purchaseData.stripe_payment_intent_id;
      const [existingRows] = await connection.query<RowDataPacket[]>(
        'SELECT id, user_id, status FROM purchases WHERE stripe_session_id = ? OR stripe_payment_intent_id = ? FOR UPDATE',
        [lookupKey, lookupKey]
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];
        if (existing.user_id !== userId) {
          await connection.rollback();
          throw new Error('La transacción no corresponde al usuario autenticado.');
        }

        if (existing.status === 'completed') {
          await connection.commit();
          return { alreadyCompleted: true, success: true };
        }
      }

      await connection.query<ResultSetHeader>(
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
        ON DUPLICATE KEY UPDATE
          stripe_payment_intent_id = COALESCE(VALUES(stripe_payment_intent_id), stripe_payment_intent_id),
          stripe_subscription_id = COALESCE(VALUES(stripe_subscription_id), stripe_subscription_id),
          stripe_customer_id = COALESCE(VALUES(stripe_customer_id), stripe_customer_id),
          status = 'completed',
          updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          purchaseData.stripe_session_id,
          purchaseData.stripe_payment_intent_id || null,
          purchaseData.stripe_subscription_id || null,
          purchaseData.stripe_customer_id || null,
          purchaseData.plan_id,
          purchaseData.billing_period,
          purchaseData.amount_total,
          purchaseData.currency.toUpperCase(),
        ]
      );

      const canonicalTier = normalizeTierKey(tier);
      const shouldUpdateSubId = subscriptionId !== undefined;
      const shouldUpdatePeriodEnd = periodEnd !== undefined;

      const params: any[] = [canonicalTier, purchaseData.stripe_customer_id || null];
      if (shouldUpdateSubId) params.push(subscriptionId);
      params.push(status);
      if (shouldUpdatePeriodEnd) params.push(periodEnd);
      params.push(userId);

      await connection.query<ResultSetHeader>(
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

      await connection.commit();

      try {
        await cacheService.invalidateUser(String(userId));
        await permissionService.invalidateUserPermissions(userId);
      } catch {}

      if (status === 'active') {
        try {
          const perms = await permissionService.getUserPermissions(userId, canonicalTier, status);
          const newQuota = getMonthlyQuotaByPermissions(perms);
          await pool.query(
            'UPDATE users SET ai_tokens_balance = ?, ai_tokens_reset_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 MONTH) WHERE id = ?',
            [newQuota, userId]
          );
        } catch (tokenErr) {
          logger.db.warn('Error al actualizar tokens de usuario tras cambio de suscripción', tokenErr);
        }
      }

      logger.db.info('Compra confirmada y procesada atómicamente', {
        plan: canonicalTier,
        userId,
      });

      return { alreadyCompleted: false, success: true };
    } catch (error) {
      await connection.rollback();
      logger.db.error('Error al procesar cumplimiento atómico de compra', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  public async updatePurchaseStatus(
    purchaseId: number,
    status: 'completed' | 'pending' | 'failed' | 'refunded',
    paymentIntentId?: string
  ): Promise<boolean> {
    const pool = getDbPool();
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE purchases
      SET status = ?,
          stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status != 'completed'`,
      [status, paymentIntentId || null, purchaseId]
    );
    return result.affectedRows > 0;
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
    stripe_subscription_id: string | null;
    subscription_tier: SubscriptionTierId;
  } | null> {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, email, subscription_tier, stripe_subscription_id FROM users WHERE stripe_customer_id = ? LIMIT 1',
      [customerId]
    );
    if (rows.length === 0) return null;
    return {
      email: rows[0].email,
      id: rows[0].id,
      stripe_subscription_id: rows[0].stripe_subscription_id || null,
      subscription_tier: normalizeTierKey(rows[0].subscription_tier),
    };
  }
}

const purchaseService = PurchaseService.getInstance();

export { PurchaseService, purchaseService };
