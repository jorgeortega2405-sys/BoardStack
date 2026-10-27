import crypto from 'crypto';
import { config } from '../config/env.config.js';

export interface GeneratedTokenResult {
  downloadUrl: string;
  fileId: string;
  fullToken: string;
  shard: string;
  token: string;
}

export interface VerifiedTokenResult {
  exp?: number;
  expired?: boolean;
  fileId: string;
  filename?: string;
  isLegacy?: boolean;
  shard?: string;
  valid: boolean;
}

const TOKEN_KEY = crypto.createHash('sha256').update(config.downloadSecret).digest();

export function generateDownloadToken(
  fileId: string,
  filename: string = '',
  ttlSeconds: number = 3600
): GeneratedTokenResult {
  const iat = Date.now();
  const exp = iat + ttlSeconds * 1000;
  const shard = String((parseInt(crypto.createHash('md5').update(fileId).digest('hex').slice(0, 4), 16) % 64) + 1).padStart(2, '0');

  const payload = JSON.stringify({
    c: shard,
    f: fileId,
    n: filename,
    s: 'dl',
    t: iat,
    x: exp,
  });

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', TOKEN_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const packed = Buffer.concat([iv, authTag, encrypted]);
  const token = packed.toString('base64url');
  const fullToken = `${token}/${shard}`;

  return {
    downloadUrl: `/api/download/${fullToken}`,
    fileId: fullToken,
    fullToken,
    shard,
    token,
  };
}

export function verifyDownloadToken(rawToken: string): VerifiedTokenResult {
  if (!rawToken || typeof rawToken !== 'string') {
    return { fileId: '', valid: false };
  }

  const parts = rawToken.split('/');
  const tokenStr = parts[0].trim();
  const shardStr = parts[1]?.trim();

  if (tokenStr.length < 50) {
    return {
      expired: false,
      fileId: rawToken,
      isLegacy: true,
      valid: false,
    };
  }

  try {
    const packed = Buffer.from(tokenStr, 'base64url');
    if (packed.length < 29) {
      return {
        expired: false,
        fileId: rawToken,
        isLegacy: true,
        valid: false,
      };
    }

    const iv = packed.subarray(0, 12);
    const authTag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', TOKEN_KEY, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const data = JSON.parse(decrypted.toString('utf8'));

    if (data.s !== 'dl') {
      return { fileId: '', valid: false };
    }

    if (shardStr && shardStr !== data.c) {
      return { fileId: '', valid: false };
    }

    if (data.x && Number(data.x) < Date.now()) {
      return {
        expired: true,
        fileId: data.f,
        valid: false,
      };
    }

    return {
      exp: data.x,
      expired: false,
      fileId: data.f,
      filename: data.n,
      shard: data.c,
      valid: true,
    };
  } catch {
    return {
      expired: false,
      fileId: rawToken,
      isLegacy: false,
      valid: false,
    };
  }
}
