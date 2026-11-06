import { getDbPool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import { permissionService } from './permission.service.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface UserTokenRecord extends RowDataPacket {
  ai_tokens_balance: number;
  ai_tokens_reset_at: Date;
}

export interface AiTokenBalanceInfo {
  balance: number;
  limit: number;
  resetAt: string;
}

export interface AiTokenEstimateResult {
  canAfford: boolean;
  cost: number;
  currentBalance: number;
  pageCount: number;
  remainingAfter: number;
}

export interface ConsumeAiTokenResult {
  balance: number;
  consumed: number;
  limit: number;
  required: number;
  resetAt: string;
  success: boolean;
}

export function getMonthlyQuotaByPermissions(permissions: string[] = []): number {
  if (permissions.includes('subscription:feature:enterprise')) {
    return 25000;
  }
  if (permissions.includes('subscription:feature:business')) {
    return 5000;
  }
  if (permissions.includes('subscription:feature:pro')) {
    return 2000;
  }
  return 100;
}

export function calculatePdfCost(toolId: string, pageCount: number, fileSizeBytes: number): number {
  if (toolId === 'remove-background' || toolId === 'image-remove-bg') {
    return 10;
  }
  const safePages = Math.max(1, Math.floor(pageCount || 1));
  const safeBytes = Math.max(0, fileSizeBytes || 0);

  let costPerPage = 2;
  if (toolId === 'summarize-pdf') {
    costPerPage = 1;
  } else if (toolId === 'pdf-to-markdown') {
    costPerPage = 2;
  } else if (toolId === 'translate-pdf') {
    costPerPage = 2;
  }

  const baseCost = 2;
  const sizeFactor = Math.ceil(safeBytes / (5 * 1024 * 1024));
  return Math.max(1, baseCost + (safePages * costPerPage) + sizeFactor);
}

export async function getUserTokenBalance(userId: number, permissions?: string[]): Promise<AiTokenBalanceInfo> {
  const pool = getDbPool();
  let perms = permissions;
  if (!perms) {
    perms = await permissionService.getUserPermissions(userId);
  }

  const maxLimit = getMonthlyQuotaByPermissions(perms);

  const [rows] = await pool.query<UserTokenRecord[]>(
    'SELECT ai_tokens_balance, ai_tokens_reset_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (rows.length === 0) {
    return {
      balance: 0,
      limit: maxLimit,
      resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  let currentBalance = Number(rows[0].ai_tokens_balance) || 0;
  let resetAt = rows[0].ai_tokens_reset_at ? new Date(rows[0].ai_tokens_reset_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (new Date() >= resetAt) {
    const nextResetDate = new Date();
    nextResetDate.setMonth(nextResetDate.getMonth() + 1);

    await pool.query(
      'UPDATE users SET ai_tokens_balance = ?, ai_tokens_reset_at = ? WHERE id = ?',
      [maxLimit, nextResetDate, userId]
    );

    currentBalance = maxLimit;
    resetAt = nextResetDate;

    logger.db.info('Cuota mensual de tokens IA restablecida', { limit: maxLimit, userId });
  } else if (currentBalance < maxLimit) {
    try {
      const [consumedRows] = await pool.query<RowDataPacket[]>(
        'SELECT COALESCE(SUM(tokens_consumed), 0) AS total_consumed FROM ai_token_logs WHERE user_id = ? AND created_at >= ?',
        [userId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]
      );
      const totalConsumed = Number((consumedRows as any[])?.[0]?.total_consumed) || 0;
      const expectedBalance = Math.max(0, maxLimit - totalConsumed);
      if (currentBalance < expectedBalance) {
        await pool.query(
          'UPDATE users SET ai_tokens_balance = ? WHERE id = ?',
          [expectedBalance, userId]
        );
        currentBalance = expectedBalance;
        logger.db.info('Balance de tokens ajustado a la cuota del plan activo', { balance: expectedBalance, maxLimit, userId });
      }
    } catch (err) {
      logger.db.warn('Error al verificar balance esperado de tokens', err);
    }
  }

  return {
    balance: currentBalance,
    limit: maxLimit,
    resetAt: resetAt.toISOString(),
  };
}

export async function estimateAiTokenCost(params: {
  fileSizeBytes: number;
  pageCount: number;
  permissions?: string[];
  toolId: string;
  userId: number;
}): Promise<AiTokenEstimateResult> {
  const cost = calculatePdfCost(params.toolId, params.pageCount, params.fileSizeBytes);
  const info = await getUserTokenBalance(params.userId, params.permissions);
  const canAfford = info.balance >= cost;
  const remainingAfter = Math.max(0, info.balance - cost);

  return {
    canAfford,
    cost,
    currentBalance: info.balance,
    pageCount: Math.max(1, Math.floor(params.pageCount || 1)),
    remainingAfter,
  };
}

export async function consumeAiTokens(params: {
  fileSizeBytes: number;
  pageCount: number;
  permissions?: string[];
  toolId: string;
  userId: number;
}): Promise<ConsumeAiTokenResult> {
  const pool = getDbPool();
  let perms = params.permissions;
  if (!perms) {
    perms = await permissionService.getUserPermissions(params.userId);
  }

  const tokenInfo = await getUserTokenBalance(params.userId, perms);
  const required = calculatePdfCost(params.toolId, params.pageCount, params.fileSizeBytes);

  if (tokenInfo.balance < required) {
    return {
      balance: tokenInfo.balance,
      consumed: 0,
      limit: tokenInfo.limit,
      required,
      resetAt: tokenInfo.resetAt,
      success: false,
    };
  }

  const [updateResult] = await pool.query<ResultSetHeader>(
    'UPDATE users SET ai_tokens_balance = ai_tokens_balance - ? WHERE id = ? AND ai_tokens_balance >= ?',
    [required, params.userId, required]
  );

  if (updateResult.affectedRows === 0) {
    const freshInfo = await getUserTokenBalance(params.userId, perms);
    return {
      balance: freshInfo.balance,
      consumed: 0,
      limit: freshInfo.limit,
      required,
      resetAt: freshInfo.resetAt,
      success: false,
    };
  }

  const newBalance = Math.max(0, tokenInfo.balance - required);

  try {
    await pool.query(
      'INSERT INTO ai_token_logs (user_id, tool_id, tokens_consumed, pdf_pages, pdf_bytes) VALUES (?, ?, ?, ?, ?)',
      [params.userId, params.toolId, required, params.pageCount, params.fileSizeBytes]
    );
  } catch (err) {
    logger.db.warn('No se pudo registrar log transaccional de tokens IA', { error: err, userId: params.userId });
  }

  logger.app.info('Tokens IA consumidos exitosamente', {
    consumed: required,
    newBalance,
    toolId: params.toolId,
    userId: params.userId,
  });

  return {
    balance: newBalance,
    consumed: required,
    limit: tokenInfo.limit,
    required,
    resetAt: tokenInfo.resetAt,
    success: true,
  };
}
