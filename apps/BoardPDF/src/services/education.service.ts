import { getDbPool } from '../config/database.config.js';
import { EducationStatusResponse } from '../types/subscription.types.js';
import { extractDomain, isAcademicEmail } from '../utils/education.util.js';
import { logger } from './logger.service.js';
import { invalidateUserPermissions } from './permission.service.js';
import { RowDataPacket } from 'mysql2';

interface EducationClaimRow extends RowDataPacket {
  claimed_at: Date;
  expires_at: Date;
  id: number;
  institution_domain: string;
  institutional_email: string;
  status: 'active' | 'expired' | 'revoked';
  user_id: number;
}

interface UserBillingRow extends RowDataPacket {
  email: string;
  id: number;
  role: string;
  subscription_period_end: Date | null;
  subscription_status: string;
  subscription_tier: string;
  username: string;
}

export interface EducationClaimedUser {
  email: string;
  id: number;
  subscription_status: string;
  subscription_tier: string;
  username: string;
}

export async function getEducationStatus(userId: number, email: string): Promise<EducationStatusResponse> {
  const pool = getDbPool();
  const domain = extractDomain(email);
  const eligible = isAcademicEmail(email);

  const [claimRows] = await pool.query<EducationClaimRow[]>(
    'SELECT id, institutional_email, institution_domain, claimed_at, expires_at, status FROM education_claims WHERE user_id = ? LIMIT 1',
    [userId]
  );

  const [userRows] = await pool.query<UserBillingRow[]>(
    'SELECT subscription_tier, subscription_status FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  const currentTier = userRows[0]?.subscription_tier || 'free';
  const hasClaimed = claimRows.length > 0;

  return {
    claimed_at: hasClaimed ? claimRows[0].claimed_at.toISOString() : undefined,
    domain,
    expires_at: hasClaimed ? claimRows[0].expires_at.toISOString() : undefined,
    has_claimed: hasClaimed,
    is_eligible: eligible && !hasClaimed && currentTier === 'free',
    tier: currentTier as any,
  };
}

export async function claimFreeEducationYear(userId: number, email: string): Promise<{ success: boolean; user: EducationClaimedUser }> {
  if (!isAcademicEmail(email)) {
    throw new Error('El correo electrónico no cumple con los criterios de institución académica o educativa.');
  }

  const pool = getDbPool();
  const [userRows] = await pool.query<UserBillingRow[]>(
    'SELECT id, username, email, subscription_tier, subscription_status FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (userRows.length === 0) {
    throw new Error('Usuario no encontrado.');
  }

  const user = userRows[0];
  const activePaidTiers = ['pro', 'business', 'enterprise', 'edu_school', 'edu_university'];
  if (activePaidTiers.includes(user.subscription_tier) && user.subscription_status === 'active') {
    throw new Error('Tu cuenta ya posee un plan activo. Solo puedes mantener un plan a la vez.');
  }

  const [existingClaims] = await pool.query<EducationClaimRow[]>(
    'SELECT id FROM education_claims WHERE user_id = ? LIMIT 1',
    [userId]
  );

  if (existingClaims.length > 0) {
    throw new Error('Esta cuenta ya ha canjeado previamente el beneficio de 1 año gratuito.');
  }

  const domain = extractDomain(email);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE users 
       SET subscription_tier = 'edu_individual', 
           subscription_status = 'active', 
           subscription_period_end = DATE_ADD(NOW(), INTERVAL 1 YEAR) 
       WHERE id = ?`,
      [userId]
    );

    await connection.query(
      `INSERT INTO education_claims (user_id, institutional_email, institution_domain, expires_at, status)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 YEAR), 'active')`,
      [userId, email.toLowerCase().trim(), domain]
    );

    await connection.commit();
  } catch (err: any) {
    await connection.rollback();
    logger.app.error('Error al procesar el canje de educación', { err, userId });
    throw new Error('Ha ocurrido un error al activar tu año educativo. Por favor intenta más tarde.');
  } finally {
    connection.release();
  }

  await invalidateUserPermissions(userId);

  logger.security.info('Beneficio educativo de 1 año activado con éxito', {
    domain,
    email,
    tier: 'edu_individual',
    userId,
  });

  return {
    success: true,
    user: {
      email: user.email,
      id: user.id,
      subscription_status: 'active',
      subscription_tier: 'edu_individual',
      username: user.username,
    },
  };
}

export const educationService = {
  claimFreeEducationYear,
  getEducationStatus,
};
