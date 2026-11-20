import { config } from '../config/env.config.js';
import crypto from 'crypto';
import { getRedisClient } from '../config/redis.config.js';

interface Pending2FASetup {
  backupCodes: string[];
  expiresAt: number;
  secret: string;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const pendingSetupMap = new Map<number, Pending2FASetup>();

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      continue;
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateTotpSecret(numBytes = 20): string {
  const bytes = crypto.randomBytes(numBytes);
  return base32Encode(bytes);
}

function calculateTotpCode(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (codeInt % 1000000).toString().padStart(6, '0');
  return code;
}

function verifyTotpCode(code: string, secret: string, windowSteps = 2): boolean {
  if (!code || typeof code !== 'string' || !secret) {
    return false;
  }

  const cleanCode = code.replace(/[\s-]+/g, '').trim();
  if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  const timeStep = 30;
  const currentCounter = Math.floor(Date.now() / 1000 / timeStep);

  for (let w = -windowSteps; w <= windowSteps; w++) {
    const testCode = calculateTotpCode(secret, currentCounter + w);
    if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(testCode))) {
      return true;
    }
  }

  return false;
}

function getOtpAuthUrl(
  secret: string,
  username: string,
  issuer = 'BoardStack'
): string {
  const safeIssuer = encodeURIComponent(issuer);
  const safeAccount = encodeURIComponent(username);
  return `otpauth://totp/${safeIssuer}:${safeAccount}?secret=${secret}&issuer=${safeIssuer}`;
}

function generateBackupCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    codes.add(formatted);
  }
  return Array.from(codes);
}

function hashBackupCode(code: string): string {
  const clean = code.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
  return crypto.createHash('sha256').update(clean).digest('hex');
}

async function savePending2FASetup(
  userId: number,
  data: { backupCodes: string[]; secret: string },
  ttlSeconds = 900
): Promise<void> {
  const payload: Pending2FASetup = {
    backupCodes: data.backupCodes,
    expiresAt: Date.now() + ttlSeconds * 1000,
    secret: data.secret,
  };
  pendingSetupMap.set(userId, payload);
  try {
    const redis = getRedisClient();
    await redis.setex(`2fa:pending:${userId}`, ttlSeconds, JSON.stringify(payload));
  } catch {}
}

async function getPending2FASetup(userId: number): Promise<Pending2FASetup | null> {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(`2fa:pending:${userId}`);
    if (raw) {
      return JSON.parse(raw) as Pending2FASetup;
    }
  } catch {}

  const pending = pendingSetupMap.get(userId);
  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    pendingSetupMap.delete(userId);
    return null;
  }
  return pending;
}

async function clearPending2FASetup(userId: number): Promise<void> {
  pendingSetupMap.delete(userId);
  try {
    const redis = getRedisClient();
    await redis.del(`2fa:pending:${userId}`);
  } catch {}
}

function create2FALoginTicket(userId: number, ttlSeconds = 300): string {
  const now = Date.now();
  const payload = {
    exp: now + ttlSeconds * 1000,
    iat: now,
    type: '2fa_login',
    userId,
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.sessionSecret).update(str).digest('base64url');
  return `${str}.${sig}`;
}

function verify2FALoginTicket(ticket: string): number | null {
  try {
    const parts = ticket.split('.');
    if (parts.length !== 2) return null;
    const [str, sig] = parts;
    if (!str || !sig) return null;

    const expectedSig = crypto.createHmac('sha256', config.sessionSecret).update(str).digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    if (payload.type !== '2fa_login' || typeof payload.userId !== 'number' || Date.now() > payload.exp) {
      return null;
    }

    return payload.userId;
  } catch {
    return null;
  }
}

export {
  base32Decode,
  base32Encode,
  calculateTotpCode,
  clearPending2FASetup,
  create2FALoginTicket,
  generateBackupCodes,
  generateTotpSecret,
  getOtpAuthUrl,
  getPending2FASetup,
  hashBackupCode,
  savePending2FASetup,
  verify2FALoginTicket,
  verifyTotpCode
};

export type {
  Pending2FASetup
};
