import { getDbPool } from '../config/database.config.js';
import { SalesInquiryPayload } from '../types/contact.types.js';
import { logger } from './logger.service.js';
import { ResultSetHeader } from 'mysql2';

export async function createSalesInquiry(payload: SalesInquiryPayload): Promise<{ id: number; success: boolean }> {
  const pool = getDbPool();
  const query = `
    INSERT INTO sales_inquiries (
      category, first_name, last_name, email, phone, organization_name,
      job_title, role_type, organization_size, primary_use_case, message, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `;

  const values = [
    payload.category,
    payload.first_name.trim(),
    payload.last_name.trim(),
    payload.email.toLowerCase().trim(),
    payload.phone?.trim() || null,
    payload.organization_name.trim(),
    payload.job_title?.trim() || null,
    payload.role_type?.trim() || null,
    payload.organization_size?.trim() || null,
    payload.primary_use_case?.trim() || null,
    payload.message?.trim() || null,
  ];

  const [result] = await pool.query<ResultSetHeader>(query, values);

  logger.app.info('Nueva solicitud comercial recibida', {
    category: payload.category,
    email: payload.email,
    id: result.insertId,
    org: payload.organization_name,
  });

  return { id: result.insertId, success: true };
}

export const contactService = {
  createSalesInquiry,
};
