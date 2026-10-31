import { redis } from '../config/redis.config.js';
import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
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

export function base32Decode(input: string): Buffer {
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

export function generateTotpSecret(numBytes = 20): string {
  const bytes = crypto.randomBytes(numBytes);
  return base32Encode(bytes);
}

export function calculateTotpCode(secret: string, counter: number): string {
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

export function verifyTotpCode(code: string, secret: string, windowSteps = 2): boolean {
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

export function getOtpAuthUrl(
  secret: string,
  username: string,
  issuer = 'BoardPDF'
): string {
  const safeIssuer = encodeURIComponent(issuer);
  const safeAccount = encodeURIComponent(username);
  return `otpauth://totp/${safeIssuer}:${safeAccount}?secret=${secret}&issuer=${safeIssuer}`;
}

export function generateBackupCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    codes.add(formatted);
  }
  return Array.from(codes);
}

export function hashBackupCode(code: string): string {
  const clean = code.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
  return crypto.createHash('sha256').update(clean).digest('hex');
}

const REDIS_PREFIX_SETUP = '2fa:setup:';
const REDIS_PREFIX_LOGIN = '2fa:login:';

export interface Pending2FASetup {
  backupCodes: string[];
  secret: string;
}

export async function savePending2FASetup(
  userId: number,
  data: Pending2FASetup,
  ttlSeconds = 900
): Promise<void> {
  const key = `${REDIS_PREFIX_SETUP}${userId}`;
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
}

export async function getPending2FASetup(userId: number): Promise<Pending2FASetup | null> {
  const key = `${REDIS_PREFIX_SETUP}${userId}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Pending2FASetup;
  } catch {
    return null;
  }
}

export async function clearPending2FASetup(userId: number): Promise<void> {
  const key = `${REDIS_PREFIX_SETUP}${userId}`;
  await redis.del(key);
}

export interface Pending2FALogin {
  email: string;
  userId: number;
}

export async function savePending2FALogin(
  tempToken: string,
  payload: Pending2FALogin,
  ttlSeconds = 300
): Promise<void> {
  const key = `${REDIS_PREFIX_LOGIN}${tempToken}`;
  await redis.setex(key, ttlSeconds, JSON.stringify(payload));
}

export async function getPending2FALogin(tempToken: string): Promise<Pending2FALogin | null> {
  const key = `${REDIS_PREFIX_LOGIN}${tempToken}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Pending2FALogin;
  } catch {
    return null;
  }
}

export async function consumePending2FALogin(tempToken: string): Promise<Pending2FALogin | null> {
  const key = `${REDIS_PREFIX_LOGIN}${tempToken}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  await redis.del(key);
  try {
    return JSON.parse(raw) as Pending2FALogin;
  } catch {
    return null;
  }
}
