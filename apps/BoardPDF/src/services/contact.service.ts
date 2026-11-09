import crypto from 'crypto';
import { RowDataPacket } from 'mysql2';
import { getDbPool } from '../config/database.config.js';
import { logger } from './logger.service.js';

interface CreateContactSubmissionInput {
  email: string;
  ipAddress?: string;
  message: string;
  name: string;
  subject: string;
  userAgent?: string;
}

interface ContactSubmissionRecord {
  createdAt: string;
  email: string;
  id: number;
  ipAddress: string | null;
  message: string;
  name: string;
  status: 'closed' | 'in_progress' | 'open' | 'resolved' | 'waiting_customer';
  subject: string;
  ticketNumber: string;
  trackingToken: string;
  updatedAt: string;
}

interface ContactMessageRecord {
  createdAt: string;
  id: number;
  message: string;
  senderName: string;
  senderType: 'agent' | 'customer' | 'system';
  submissionId: number;
}

interface TicketDetailsResponse {
  category: string;
  createdAt: string;
  email: string;
  id: string;
  messages: Array<{
    createdAt: string;
    id: string;
    message: string;
    senderName: string;
    senderType: 'agent' | 'customer' | 'system';
  }>;
  name: string;
  priority: string;
  status: string;
  subject: string;
  ticketNumber: string;
  updatedAt: string;
}

function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TK-${timestamp}-${randomPart}`;
}

async function createContactSubmission(
  input: CreateContactSubmissionInput
): Promise<{ ticketNumber: string; trackingToken: string }> {
  const pool = getDbPool();
  const ticketNumber = generateTicketNumber();
  const trackingToken = crypto.randomBytes(32).toString('hex');

  try {
    const [result] = await pool.query(
      `INSERT INTO contact_submissions 
       (ticket_number, tracking_token, name, email, subject, message, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticketNumber,
        trackingToken,
        input.name.trim(),
        input.email.trim().toLowerCase(),
        input.subject.trim(),
        input.message.trim(),
        input.ipAddress || null,
        input.userAgent || null,
      ]
    );

    const insertId = (result as { insertId?: number }).insertId;
    if (insertId) {
      await pool.query(
        `INSERT INTO contact_messages (submission_id, sender_type, sender_name, message)
         VALUES (?, 'customer', ?, ?)`,
        [insertId, input.name.trim(), input.message.trim()]
      );
    }

    logger.app.info('Nueva consulta de contacto registrada exitosamente', {
      email: input.email.trim().toLowerCase(),
      subject: input.subject,
      ticketNumber,
    });

    return { ticketNumber, trackingToken };
  } catch (error) {
    logger.db.error('Error al insertar consulta de contacto en la base de datos', error);
    throw error;
  }
}

async function getTicketByTrackingToken(
  token: string
): Promise<TicketDetailsResponse | null> {
  const pool = getDbPool();

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, ticket_number, tracking_token, name, email, subject, message, status, created_at, updated_at
       FROM contact_submissions
       WHERE tracking_token = ?
       LIMIT 1`,
      [token]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const submissionId = row.id as number;

    const [msgRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, sender_type, sender_name, message, created_at
       FROM contact_messages
       WHERE submission_id = ?
       ORDER BY created_at ASC`,
      [submissionId]
    );

    const messages = msgRows.map((msg) => ({
      createdAt: new Date(msg.created_at).toISOString(),
      id: String(msg.id),
      message: String(msg.message),
      senderName: String(msg.sender_name),
      senderType: msg.sender_type as 'agent' | 'customer' | 'system',
    }));

    if (messages.length === 0) {
      messages.push({
        createdAt: new Date(row.created_at).toISOString(),
        id: '1',
        message: String(row.message),
        senderName: String(row.name),
        senderType: 'customer',
      });
    }

    return {
      category: String(row.subject),
      createdAt: new Date(row.created_at).toISOString(),
      email: String(row.email),
      id: String(row.id),
      messages,
      name: String(row.name),
      priority: 'normal',
      status: String(row.status),
      subject: String(row.subject),
      ticketNumber: String(row.ticket_number),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  } catch (error) {
    logger.db.error('Error al consultar ticket por token de seguimiento', error);
    throw error;
  }
}

async function addTicketReply(
  token: string,
  message: string,
  senderName: string,
  senderType: 'agent' | 'customer' = 'customer'
): Promise<{
  createdAt: string;
  id: string;
  message: string;
  senderName: string;
  senderType: 'agent' | 'customer' | 'system';
} | null> {
  const pool = getDbPool();

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, status FROM contact_submissions WHERE tracking_token = ? LIMIT 1`,
      [token]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    if (row.status === 'closed') {
      return null;
    }

    const submissionId = row.id as number;
    const [insertResult] = await pool.query(
      `INSERT INTO contact_messages (submission_id, sender_type, sender_name, message)
       VALUES (?, ?, ?, ?)`,
      [submissionId, senderType, senderName.trim(), message.trim()]
    );

    const newMsgId = (insertResult as { insertId?: number }).insertId || Date.now();

    if (senderType === 'customer' && row.status === 'waiting_customer') {
      await pool.query(
        `UPDATE contact_submissions SET status = 'in_progress' WHERE id = ?`,
        [submissionId]
      );
    }

    return {
      createdAt: new Date().toISOString(),
      id: String(newMsgId),
      message: message.trim(),
      senderName: senderName.trim(),
      senderType,
    };
  } catch (error) {
    logger.db.error('Error al insertar respuesta en ticket', error);
    throw error;
  }
}

export { addTicketReply, createContactSubmission, getTicketByTrackingToken };
export type { ContactMessageRecord, ContactSubmissionRecord, CreateContactSubmissionInput, TicketDetailsResponse };
