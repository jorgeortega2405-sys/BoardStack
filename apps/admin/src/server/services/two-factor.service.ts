import { config } from '../config/env.config.js';
import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const consumedLoginTickets = new Set<string>();

setInterval(() => {
  consumedLoginTickets.clear();
}, 300000).unref();

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

  return (codeInt % 1000000).toString().padStart(6, '0');
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

function hashBackupCode(code: string): string {
  const clean = code.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
  return crypto.createHash('sha256').update(clean).digest('hex');
}

function create2FALoginTicket(userId: number, ttlSeconds = 300): string {
  const now = Date.now();
  const payload = {
    exp: now + ttlSeconds * 1000,
    iat: now,
    nonce: crypto.randomBytes(8).toString('hex'),
    type: 'admin_2fa_login',
    userId,
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.sessionSecret).update(str).digest('base64url');
  return `${str}.${sig}`;
}

function verify2FALoginTicket(ticket: string): number | null {
  try {
    if (consumedLoginTickets.has(ticket)) {
      return null;
    }
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
    if (payload.type !== 'admin_2fa_login' || typeof payload.userId !== 'number' || Date.now() > payload.exp) {
      return null;
    }

    return payload.userId;
  } catch {
    return null;
  }
}

function consume2FALoginTicket(ticket: string): void {
  consumedLoginTickets.add(ticket);
}

export {
  consume2FALoginTicket,
  create2FALoginTicket,
  hashBackupCode,
  verify2FALoginTicket,
  verifyTotpCode
};
