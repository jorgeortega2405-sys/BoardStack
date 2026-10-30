import { redis } from '../config/redis.config.js';
import crypto from 'crypto';

export interface PendingRegistration {
  attempts: number;
  code: string;
  createdAt: number;
  email: string;
  passwordHash: string;
  username: string;
}

const REDIS_REG_PREFIX = 'reg_pending:';
const DEFAULT_TTL_SECONDS = 900;

export function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export async function savePendingRegistration(
  email: string,
  data: { code: string; passwordHash: string; username: string },
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
  const payload: PendingRegistration = {
    attempts: 0,
    code: data.code,
    createdAt: Date.now(),
    email: email.toLowerCase().trim(),
    passwordHash: data.passwordHash,
    username: data.username.trim(),
  };

  await redis.setex(key, ttlSeconds, JSON.stringify(payload));
}

export async function getPendingRegistration(email: string): Promise<PendingRegistration | null> {
  const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingRegistration;
  } catch {
    return null;
  }
}

const VERIFY_REG_CODE_LUA = `
local key = KEYS[1]
local inputCode = ARGV[1]
local maxAttempts = tonumber(ARGV[2])

local raw = redis.call('GET', key)
if not raw then
  return {0, 'expired'}
end

local data = cjson.decode(raw)
if tonumber(data.attempts) >= maxAttempts then
  redis.call('DEL', key)
  return {0, 'max_attempts_exceeded'}
end

if tostring(data.code) ~= tostring(inputCode) then
  data.attempts = tonumber(data.attempts) + 1
  local ttl = redis.call('TTL', key)
  if ttl > 0 then
    redis.call('SETEX', key, ttl, cjson.encode(data))
  end
  local remaining = maxAttempts - data.attempts
  return {0, 'wrong_code', tostring(remaining)}
end

redis.call('DEL', key)
return {1, raw}
`;

export async function verifyAndConsumeCode(
  email: string,
  inputCode: string
): Promise<{ data?: PendingRegistration; error?: string; success: boolean }> {
  const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
  const cleanInput = String(inputCode).trim();

  const result = (await redis.eval(
    VERIFY_REG_CODE_LUA,
    1,
    key,
    cleanInput,
    5
  )) as [number, string, string?];

  const [status, payloadOrError, remaining] = result;

  if (status === 1) {
    try {
      const data = JSON.parse(payloadOrError) as PendingRegistration;
      return { data, success: true };
    } catch {
      return { error: 'Error al procesar la verificación.', success: false };
    }
  }

  if (payloadOrError === 'expired') {
    return {
      error: 'El código de verificación ha expirado o no existe. Solicita un nuevo código.',
      success: false,
    };
  }

  if (payloadOrError === 'max_attempts_exceeded') {
    return {
      error: 'Demasiados intentos fallidos. El código ha sido invalidado. Solicita un nuevo código.',
      success: false,
    };
  }

  if (payloadOrError === 'wrong_code') {
    return {
      error: `Código incorrecto. Te quedan ${remaining ?? 0} intentos.`,
      success: false,
    };
  }

  return { error: 'No se pudo verificar el código.', success: false };
}

export async function deletePendingRegistration(email: string): Promise<void> {
  const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
  await redis.del(key);
}
