import { getDbPool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import type { RowDataPacket } from 'mysql2';

export interface CloudIntegrationStatus {
  connected: boolean;
  email: string | null;
}

export interface UserCloudIntegrationsResponse {
  dropbox: CloudIntegrationStatus;
  google_drive: CloudIntegrationStatus;
}

export async function getUserCloudIntegrations(userId: number): Promise<UserCloudIntegrationsResponse> {
  const result: UserCloudIntegrationsResponse = {
    dropbox: { connected: false, email: null },
    google_drive: { connected: false, email: null },
  };

  try {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT provider, account_email, is_active, token_expires_at FROM user_cloud_integrations WHERE user_id = ? AND is_active = TRUE',
      [userId]
    );

    for (const row of rows) {
      const provider = row.provider as 'google_drive' | 'dropbox';
      if (provider in result) {
        result[provider] = {
          connected: Boolean(row.is_active),
          email: row.account_email || null,
        };
      }
    }
  } catch (err) {
    logger.db.error('Error al consultar integraciones en la nube del usuario', { err, userId });
  }

  return result;
}

export async function saveUserCloudIntegration(
  userId: number,
  provider: 'google_drive' | 'dropbox',
  data: {
    accessToken: string;
    accountEmail?: string;
    accountId?: string;
    expiresInSec?: number;
    refreshToken?: string;
  }
): Promise<boolean> {
  try {
    const pool = getDbPool();
    const expiresIn = data.expiresInSec && data.expiresInSec > 0 ? data.expiresInSec : 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await pool.query(
      `INSERT INTO user_cloud_integrations 
        (user_id, provider, account_id, account_email, access_token, refresh_token, token_expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE
        account_id = COALESCE(VALUES(account_id), account_id),
        account_email = COALESCE(VALUES(account_email), account_email),
        access_token = VALUES(access_token),
        refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
        token_expires_at = VALUES(token_expires_at),
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        provider,
        data.accountId || null,
        data.accountEmail || null,
        data.accessToken,
        data.refreshToken || null,
        expiresAt,
      ]
    );

    logger.security.info('Integración en la nube vinculada exitosamente', { provider, userId });
    return true;
  } catch (err) {
    logger.db.error('Error al guardar integración en la nube', { err, provider, userId });
    return false;
  }
}

export async function disconnectUserCloudIntegration(
  userId: number,
  provider: 'google_drive' | 'dropbox'
): Promise<boolean> {
  try {
    const pool = getDbPool();
    await pool.query(
      'UPDATE user_cloud_integrations SET is_active = FALSE, access_token = NULL, refresh_token = NULL WHERE user_id = ? AND provider = ?',
      [userId, provider]
    );
    logger.security.info('Integración en la nube desconectada', { provider, userId });
    return true;
  } catch (err) {
    logger.db.error('Error al desconectar integración en la nube', { err, provider, userId });
    return false;
  }
}

export async function getUserCloudAccessToken(
  userId: number,
  provider: 'google_drive' | 'dropbox'
): Promise<string | null> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT access_token, token_expires_at FROM user_cloud_integrations WHERE user_id = ? AND provider = ? AND is_active = TRUE',
      [userId, provider]
    );

    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
    if (expiresAt > 0 && Date.now() > expiresAt - 60000) {
      return null;
    }

    return row.access_token || null;
  } catch (err) {
    logger.db.error('Error al consultar access token en la nube', { err, provider, userId });
    return null;
  }
}
