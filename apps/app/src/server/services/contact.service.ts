import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { pool } from '../config/database.config.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface CreateContactMessageData {
  email: string;
  message: string;
  name: string;
  subject: string;
  userId?: number | null;
}

interface ContactMessageRecord {
  created_at: string;
  email: string;
  id: number;
  message: string;
  name: string;
  status: 'archived' | 'read' | 'unread';
  subject: string;
  updated_at: string;
  user_id: number | null;
  uuid: string;
}

async function createContactMessage(data: CreateContactMessageData): Promise<{ id: number; uuid: string }> {
  const msgUuid = crypto.randomUUID();
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.name.trim();
  const cleanSubject = data.subject.trim();
  const cleanMessage = data.message.trim();

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO contact_messages (uuid, user_id, name, email, subject, message, status)
     VALUES (?, ?, ?, ?, ?, ?, 'unread')`,
    [
      msgUuid,
      data.userId || null,
      cleanName,
      cleanEmail,
      cleanSubject,
      cleanMessage,
    ]
  );

  logger.app.info(`[Contact] New contact message received: ${msgUuid} from ${cleanName} (${cleanEmail})`);

  return {
    id: result.insertId,
    uuid: msgUuid,
  };
}

async function getContactMessageByUuid(uuid: string): Promise<ContactMessageRecord | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM contact_messages WHERE uuid = ? LIMIT 1',
    [uuid]
  );
  if (!rows || rows.length === 0) {
    return null;
  }
  return rows[0] as ContactMessageRecord;
}

export {
  createContactMessage,
  getContactMessageByUuid
};

export type {
  ContactMessageRecord,
  CreateContactMessageData
};
