import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { pool } from '../config/database.config.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface CreateEnterpriseLeadData {
  companyName: string;
  companySize: string;
  country: string;
  firstName: string;
  hearAbout: string;
  lastName: string;
  notes?: string;
  phoneNumber: string;
  roleLevel: string;
  userId?: number | null;
  workEmail: string;
}

interface EnterpriseLeadRecord {
  company_name: string;
  company_size: string;
  country: string;
  created_at: string;
  first_name: string;
  hear_about: string;
  id: number;
  last_name: string;
  notes: string | null;
  phone_number: string;
  role_level: string;
  status: 'approved' | 'contacted' | 'pending' | 'rejected';
  updated_at: string;
  user_id: number | null;
  uuid: string;
  work_email: string;
}

async function createEnterpriseLead(data: CreateEnterpriseLeadData): Promise<{ id: number; uuid: string }> {
  const leadUuid = crypto.randomUUID();
  const cleanEmail = data.workEmail.trim().toLowerCase();
  const cleanFirstName = data.firstName.trim();
  const cleanLastName = data.lastName.trim();
  const cleanCompany = data.companyName.trim();
  const cleanSize = data.companySize.trim();
  const cleanCountry = data.country.trim();
  const cleanRole = data.roleLevel.trim();
  const cleanPhone = data.phoneNumber.trim();
  const cleanHearAbout = (data.hearAbout || '').trim();
  const cleanNotes = (data.notes || '').trim() || null;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO enterprise_leads 
     (uuid, user_id, first_name, last_name, work_email, hear_about, company_name, company_size, country, role_level, phone_number, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      leadUuid,
      data.userId || null,
      cleanFirstName,
      cleanLastName,
      cleanEmail,
      cleanHearAbout,
      cleanCompany,
      cleanSize,
      cleanCountry,
      cleanRole,
      cleanPhone,
      cleanNotes,
    ]
  );

  logger.app.info(`[SalesLead] New enterprise inquiry registered: ${leadUuid} for ${cleanCompany} (${cleanEmail})`);

  return {
    id: result.insertId,
    uuid: leadUuid,
  };
}

async function getEnterpriseLeadByUuid(uuid: string): Promise<EnterpriseLeadRecord | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM enterprise_leads WHERE uuid = ? LIMIT 1',
    [uuid]
  );
  if (!rows || rows.length === 0) {
    return null;
  }
  return rows[0] as EnterpriseLeadRecord;
}

export {
  createEnterpriseLead,
  getEnterpriseLeadByUuid
};

export type {
  CreateEnterpriseLeadData,
  EnterpriseLeadRecord
};
