import { config } from '../config/env.config.js';
import crypto from 'crypto';
import { pool } from '../config/database.config.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

interface PendingRegistrationPayload {
  passwordHash: string;
  username: string;
}

interface VerificationCodeRow extends RowDataPacket {
  attempts: number;
  code: string;
  created_at: string;
  email: string;
  expires_at: string;
  id: number;
  payload: PendingRegistrationPayload | null;
  type: string;
}

interface PasswordResetRow extends RowDataPacket {
  created_at: string;
  email: string;
  expires_at: string;
  id: number;
  token: string;
  used: number;
}

function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

async function issueReusableVerificationCode(params: {
  code?: string;
  email: string;
  payload?: string | null;
  ttlSeconds: number;
  type: 'email_change' | 'register';
  updatePayloadOnReuse?: boolean;
}): Promise<{ code: string; reused: boolean }> {
  const cleanEmail = params.email.toLowerCase().trim();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<VerificationCodeRow[]>(
      'SELECT * FROM verification_codes WHERE email = ? AND type = ? ORDER BY id DESC FOR UPDATE',
      [cleanEmail, params.type]
    );

    if (rows.length > 0) {
      const activeRow = rows[0];
      const isNotExpired = new Date(activeRow.expires_at).getTime() > Date.now();
      const hasAttemptsRemaining = activeRow.attempts < 5;

      if (isNotExpired && hasAttemptsRemaining) {
        if (params.updatePayloadOnReuse && params.payload !== undefined) {
          await conn.execute(
            'UPDATE verification_codes SET payload = ? WHERE id = ?',
            [params.payload, activeRow.id]
          );
        }
        await conn.commit();
        return { code: activeRow.code, reused: true };
      }
    }

    await conn.execute(
      'DELETE FROM verification_codes WHERE email = ? AND type = ?',
      [cleanEmail, params.type]
    );

    const code = params.code || generateSixDigitCode();
    const expiresAt = new Date(Date.now() + params.ttlSeconds * 1000);

    await conn.execute<ResultSetHeader>(
      'INSERT INTO verification_codes (email, code, type, payload, attempts, expires_at) VALUES (?, ?, ?, ?, 0, ?)',
      [cleanEmail, code, params.type, params.payload ?? null, expiresAt]
    );

    await conn.commit();
    return { code, reused: false };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function savePendingRegistration(
  email: string,
  data: { code?: string; passwordHash: string; username: string },
  ttlSeconds = 600
): Promise<{ code: string; reused: boolean }> {
  const payloadStr = JSON.stringify({
    passwordHash: data.passwordHash,
    username: data.username.trim(),
  });

  return issueReusableVerificationCode({
    code: data.code,
    email,
    payload: payloadStr,
    ttlSeconds,
    type: 'register',
    updatePayloadOnReuse: true,
  });
}

async function getPendingRegistration(
  email: string
): Promise<{ code: string; passwordHash: string; username: string } | null> {
  const cleanEmail = email.toLowerCase().trim();
  const [rows] = await pool.execute<VerificationCodeRow[]>(
    'SELECT * FROM verification_codes WHERE email = ? AND type = "register" AND expires_at > CURRENT_TIMESTAMP LIMIT 1',
    [cleanEmail]
  );

  if (rows.length === 0 || !rows[0].payload) return null;
  const row = rows[0];
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;

  return {
    code: row.code,
    passwordHash: payload.passwordHash,
    username: payload.username,
  };
}

async function verifyAndConsumeRegistrationCode(
  email: string,
  inputCode: string,
  maxAttempts = 5
): Promise<{
  data?: { email: string; passwordHash: string; username: string };
  error?: string;
  success: boolean;
}> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanCode = String(inputCode).trim();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<VerificationCodeRow[]>(
      'SELECT * FROM verification_codes WHERE email = ? AND type = "register" FOR UPDATE',
      [cleanEmail]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return { error: 'Verification code has expired or does not exist. Please request a new one.', success: false };
    }

    const row = rows[0];

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await conn.execute('DELETE FROM verification_codes WHERE id = ?', [row.id]);
      await conn.commit();
      return { error: 'Verification code has expired. Please request a new one.', success: false };
    }

    if (row.attempts >= maxAttempts) {
      await conn.execute('DELETE FROM verification_codes WHERE id = ?', [row.id]);
      await conn.commit();
      return { error: 'Maximum verification attempts exceeded.', success: false };
    }

    if (row.code !== cleanCode) {
      await conn.execute(
        'UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?',
        [row.id]
      );
      await conn.commit();
      const remaining = maxAttempts - (row.attempts + 1);
      return {
        error: `Incorrect verification code. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`,
        success: false,
      };
    }

    await conn.execute('DELETE FROM verification_codes WHERE id = ?', [row.id]);
    await conn.commit();

    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    return {
      data: {
        email: cleanEmail,
        passwordHash: payload.passwordHash,
        username: payload.username,
      },
      success: true,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function createPasswordResetToken(
  email: string,
  ttlSeconds = 600
): Promise<{ reused: boolean; token: string }> {
  const cleanEmail = email.toLowerCase().trim();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<PasswordResetRow[]>(
      'SELECT * FROM password_resets WHERE email = ? AND used = FALSE ORDER BY id DESC FOR UPDATE',
      [cleanEmail]
    );

    if (rows.length > 0) {
      const activeRow = rows[0];
      const now = Date.now();
      const expiresMs = new Date(activeRow.expires_at).getTime();
      const createdMs = new Date(activeRow.created_at).getTime();
      if (expiresMs > now && (now - createdMs) < 600000) {
        await conn.commit();
        return { reused: true, token: activeRow.token };
      }
    }

    await conn.execute(
      'UPDATE password_resets SET used = TRUE WHERE email = ? AND used = FALSE',
      [cleanEmail]
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await conn.execute(
      'INSERT INTO password_resets (email, token, used, expires_at) VALUES (?, ?, FALSE, ?)',
      [cleanEmail, token, expiresAt]
    );

    await conn.commit();
    return { reused: false, token };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function verifyAndConsumePasswordResetToken(
  email: string,
  token: string
): Promise<{ email?: string; error?: string; success: boolean }> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanToken = String(token).trim();

  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE password_resets SET used = TRUE WHERE email = ? AND token = ? AND used = FALSE AND expires_at > CURRENT_TIMESTAMP',
    [cleanEmail, cleanToken]
  );

  if (result.affectedRows === 0) {
    return { error: 'Password reset link is invalid, expired, or already used.', success: false };
  }

  return { email: cleanEmail, success: true };
}

async function createEmailChangeCode(
  email: string,
  ttlSeconds = 600
): Promise<{ code: string; reused: boolean }> {
  return issueReusableVerificationCode({
    email,
    ttlSeconds,
    type: 'email_change',
  });
}

async function verifyAndConsumeEmailChangeCode(
  email: string,
  inputCode: string,
  maxAttempts = 5
): Promise<{ error?: string; success: boolean }> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanCode = String(inputCode).trim();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<VerificationCodeRow[]>(
      'SELECT * FROM verification_codes WHERE email = ? AND type = "email_change" FOR UPDATE',
      [cleanEmail]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return { error: 'Verification code has expired or does not exist.', success: false };
    }

    const row = rows[0];
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await conn.execute('DELETE FROM verification_codes WHERE id = ?', [row.id]);
      await conn.commit();
      return { error: 'Verification code has expired.', success: false };
    }

    if (row.attempts >= maxAttempts) {
      await conn.execute('DELETE FROM verification_codes WHERE id = ?', [row.id]);
      await conn.commit();
      return { error: 'Maximum attempts exceeded.', success: false };
    }

    if (row.code !== cleanCode) {
      await conn.execute('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?', [row.id]);
      await conn.commit();
      return { error: 'Incorrect verification code.', success: false };
    }

    await conn.execute('DELETE FROM verification_codes WHERE id = ?', [row.id]);
    await conn.commit();
    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function createEmailChangeTicket(userId: number, currentEmail: string): string {
  const payload = {
    email: currentEmail.toLowerCase().trim(),
    exp: Date.now() + 600000,
    type: 'email_change',
    userId,
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.sessionSecret).update(str).digest('base64url');
  return `${str}.${sig}`;
}

function verifyEmailChangeTicket(ticket: string, userId: number): { email: string; valid: boolean } {
  try {
    const parts = ticket.split('.');
    if (parts.length !== 2) return { email: '', valid: false };
    const [str, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', config.sessionSecret).update(str).digest('base64url');
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return { email: '', valid: false };
    }
    const payload = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    if (payload.type !== 'email_change' || payload.userId !== userId || Date.now() > payload.exp) {
      return { email: '', valid: false };
    }
    return { email: payload.email, valid: true };
  } catch {
    return { email: '', valid: false };
  }
}

function createSecurityActionTicket(userId: number, ttlMs = 600000): string {
  const payload = {
    exp: Date.now() + ttlMs,
    nonce: crypto.randomBytes(8).toString('hex'),
    type: 'security_action',
    userId,
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.sessionSecret).update(str).digest('base64url');
  return `${str}.${sig}`;
}

function verifySecurityActionTicket(ticket: string, userId: number): boolean {
  try {
    const parts = ticket.split('.');
    if (parts.length !== 2) return false;
    const [str, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', config.sessionSecret).update(str).digest('base64url');
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return false;
    }
    const payload = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    if (payload.type !== 'security_action' || payload.userId !== userId || Date.now() > payload.exp) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export {
  createEmailChangeCode,
  createEmailChangeTicket,
  createPasswordResetToken,
  createSecurityActionTicket,
  generateSixDigitCode,
  getPendingRegistration,
  savePendingRegistration,
  verifyAndConsumeEmailChangeCode,
  verifyAndConsumePasswordResetToken,
  verifyAndConsumeRegistrationCode,
  verifyEmailChangeTicket,
  verifySecurityActionTicket
};

export type {
  PasswordResetRow,
  PendingRegistrationPayload,
  VerificationCodeRow
};
