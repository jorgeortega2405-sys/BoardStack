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

const REDIS_EMAIL_CHANGE_PREFIX = 'email_change_code:';
const REDIS_EMAIL_CHANGE_AUTH_PREFIX = 'email_change_auth:';

export interface EmailChangeCodePayload {
  attempts: number;
  code: string;
  createdAt: number;
  currentEmail: string;
  userId: number;
}

export async function saveEmailChangeCode(
  userId: number,
  currentEmail: string,
  code: string,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  const key = `${REDIS_EMAIL_CHANGE_PREFIX}${userId}`;
  const payload: EmailChangeCodePayload = {
    attempts: 0,
    code: code.trim(),
    createdAt: Date.now(),
    currentEmail: currentEmail.toLowerCase().trim(),
    userId,
  };

  await redis.setex(key, ttlSeconds, JSON.stringify(payload));
}

const VERIFY_EMAIL_CHANGE_LUA = `
local codeKey = KEYS[1]
local authKey = KEYS[2]
local inputCode = ARGV[1]
local maxAttempts = tonumber(ARGV[2])
local authTtl = tonumber(ARGV[3])

local raw = redis.call('GET', codeKey)
if not raw then
  return {0, 'expired'}
end

local data = cjson.decode(raw)
if tonumber(data.attempts) >= maxAttempts then
  redis.call('DEL', codeKey)
  return {0, 'max_attempts_exceeded'}
end

if tostring(data.code) ~= tostring(inputCode) then
  data.attempts = tonumber(data.attempts) + 1
  local ttl = redis.call('TTL', codeKey)
  if ttl > 0 then
    redis.call('SETEX', codeKey, ttl, cjson.encode(data))
  end
  local remaining = maxAttempts - data.attempts
  return {0, 'wrong_code', tostring(remaining)}
end

redis.call('DEL', codeKey)
redis.call('SETEX', authKey, authTtl, '1')
return {1, 'authorized'}
`;

export async function verifyEmailChangeCode(
  userId: number,
  inputCode: string
): Promise<{ error?: string; success: boolean; token?: string }> {
  const codeKey = `${REDIS_EMAIL_CHANGE_PREFIX}${userId}`;
  const authKey = `${REDIS_EMAIL_CHANGE_AUTH_PREFIX}${userId}`;
  const cleanInput = String(inputCode).trim();

  const result = (await redis.eval(
    VERIFY_EMAIL_CHANGE_LUA,
    2,
    codeKey,
    authKey,
    cleanInput,
    5,
    300
  )) as [number, string, string?];

  const [status, payloadOrError, remaining] = result;

  if (status === 1) {
    return { success: true, token: 'authorized' };
  }

  if (payloadOrError === 'expired') {
    return {
      error: 'El código de verificación ha expirado o no existe. Solicita uno nuevo.',
      success: false,
    };
  }

  if (payloadOrError === 'max_attempts_exceeded') {
    return {
      error: 'Demasiados intentos fallidos. El código ha sido invalidado. Solicita uno nuevo.',
      success: false,
    };
  }

  if (payloadOrError === 'wrong_code') {
    return {
      error: `Código incorrecto. Te quedan ${remaining ?? 0} intentos.`,
      success: false,
    };
  }

  return { error: 'Error al verificar el código.', success: false };
}

export async function isEmailChangeAuthorized(userId: number): Promise<boolean> {
  const authKey = `${REDIS_EMAIL_CHANGE_AUTH_PREFIX}${userId}`;
  const val = await redis.get(authKey);
  return Boolean(val);
}

const CONSUME_EMAIL_AUTH_LUA = `
local authKey = KEYS[1]
local val = redis.call('GET', authKey)
if val then
  redis.call('DEL', authKey)
  return 1
else
  return 0
end
`;

export async function consumeEmailChangeAuthorization(
  userId: number
): Promise<{ error?: string; valid: boolean }> {
  const authKey = `${REDIS_EMAIL_CHANGE_AUTH_PREFIX}${userId}`;
  const consumed = (await redis.eval(CONSUME_EMAIL_AUTH_LUA, 1, authKey)) as number;

  if (consumed !== 1) {
    return {
      error: 'La autorización de 5 minutos para cambiar el correo ha expirado. Por favor verifica tu código de nuevo.',
      valid: false,
    };
  }

  return { valid: true };
}

const REDIS_PASSWORD_CHANGE_AUTH_PREFIX = 'pwd_change_auth:';

export async function savePasswordChangeAuth(userId: number, ttlSeconds = 300): Promise<void> {
  const key = `${REDIS_PASSWORD_CHANGE_AUTH_PREFIX}${userId}`;
  await redis.setex(key, ttlSeconds, 'authorized');
}

export async function isPasswordChangeAuthorized(userId: number): Promise<boolean> {
  const key = `${REDIS_PASSWORD_CHANGE_AUTH_PREFIX}${userId}`;
  const val = await redis.get(key);
  return Boolean(val);
}

const CONSUME_PWD_AUTH_LUA = `
local authKey = KEYS[1]
local val = redis.call('GET', authKey)
if val then
  redis.call('DEL', authKey)
  return 1
else
  return 0
end
`;

export async function consumePasswordChangeAuth(
  userId: number
): Promise<{ error?: string; valid: boolean }> {
  const authKey = `${REDIS_PASSWORD_CHANGE_AUTH_PREFIX}${userId}`;
  const consumed = (await redis.eval(CONSUME_PWD_AUTH_LUA, 1, authKey)) as number;

  if (consumed !== 1) {
    return {
      error: 'La autorización de 5 minutos para cambiar la contraseña ha expirado. Por favor confirma tu contraseña actual de nuevo.',
      valid: false,
    };
  }

  return { valid: true };
}
