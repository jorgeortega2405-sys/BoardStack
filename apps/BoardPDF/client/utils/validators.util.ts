import { t } from '../services/i18n.service.js';

export interface ValidationResult {
  error?: string;
  valid: boolean;
}

export function validateEmail(email: unknown): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { error: t('validation.email_required', 'El correo electrónico es requerido.'), valid: false };
  }

  const trimmed = email.trim().toLowerCase();

  if (trimmed.length < 5 || trimmed.length > 254) {
    return { error: t('validation.email_invalid', 'Ingresa un correo electrónico válido.'), valid: false };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { error: t('validation.email_invalid', 'Ingresa un correo electrónico válido.'), valid: false };
  }

  return { valid: true };
}

export function validatePassword(password: unknown): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { error: t('validation.password_required', 'La contraseña es requerida.'), valid: false };
  }

  if (password.length < 8) {
    return { error: t('validation.password_min', 'La contraseña debe tener al menos 8 caracteres.'), valid: false };
  }

  if (password.length > 128) {
    return { error: t('validation.password_max', 'La contraseña no puede exceder los 128 caracteres.'), valid: false };
  }

  return { valid: true };
}

export function validateUsername(username: unknown): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { error: t('validation.username_required', 'El nombre de usuario es requerido.'), valid: false };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { error: t('validation.username_min', 'El nombre de usuario debe tener al menos 3 caracteres.'), valid: false };
  }

  if (trimmed.length > 30) {
    return { error: t('validation.username_max', 'El nombre de usuario no puede superar los 30 caracteres.'), valid: false };
  }

  const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return {
      error: t('validation.username_invalid', 'El nombre de usuario solo puede contener letras, números, guiones y puntos.'),
      valid: false,
    };
  }

  return { valid: true };
}

export function validateVerificationCode(code: unknown): ValidationResult {
  if (!code || typeof code !== 'string') {
    return { error: t('validation.code_required', 'Ingresa el código de 6 dígitos.'), valid: false };
  }

  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { error: t('validation.code_invalid', 'El código debe contener exactamente 6 dígitos numéricos.'), valid: false };
  }

  return { valid: true };
}

export interface FileValidationOptions {
  allowedMimes?: string[];
  maxMb?: number;
}

export interface FileValidationResult {
  error?: string;
  file?: File;
  valid: boolean;
}

export function validateAndSanitizeFile(
  file: unknown,
  options: FileValidationOptions = {}
): FileValidationResult {
  if (!file || !(file instanceof File)) {
    return { error: 'No se proporcionó un archivo válido.', valid: false };
  }

  if (file.size <= 0) {
    return { error: 'El archivo seleccionado está vacío.', valid: false };
  }

  const maxMb = options.maxMb !== undefined ? options.maxMb : 2;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      error: `El archivo supera el límite permitido de ${maxMb} MB.`,
      valid: false,
    };
  }

  const allowedMimes = options.allowedMimes || ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const fileMime = file.type ? file.type.toLowerCase().split(';')[0].trim() : '';

  if (!allowedMimes.includes(fileMime)) {
    return {
      error: 'Formato de imagen no compatible. Usa PNG, JPG o WEBP.',
      valid: false,
    };
  }

  return {
    file,
    valid: true,
  };
}

const ACADEMIC_PATTERNS: RegExp[] = [
  /\.edu(\.[a-z]{2,3})?$/i,
  /\.ac(\.[a-z]{2,3})?$/i,
  /\.sch\.[a-z]{2,3}$/i,
  /\.escolar\.[a-z]{2,3}$/i,
  /\.ed\.[a-z]{2,3}$/i,
  /\.res\.[a-z]{2,3}$/i,
  /\.(college|university|academy|education)$/i,
  /\.k12(\.[a-z]{2,3})?$/i,
  /\.k12\.[a-z]{2}\.us$/i,
  /@([a-z0-9\-]+\.)*(unam|ipn|itesm|uam|ibero|anahuac|cinvestav|colmex|udg|uanl|buap|uv|uaemex|uaslp|uson|uabc|uach|ujat|uady|uaeh|uaa|uaq|tecnm|iteso|nuevaescuela)\.mx$/i,
  /@([a-z0-9\-]+\.)*(gva\.es|xtec\.cat|educa\.madrid\.org|juntadeandalucia\.es|educantabria\.es|educa\.aragon\.es|educacyl\.jcyl\.es|educarex\.es|educacion\.navarra\.es|euskadi\.eus)$/i,
  /@([a-z0-9\-]+\.)*(univ-[a-z0-9\-]+\.fr|u-[a-z0-9\-]+\.fr|uni-[a-z0-9\-]+\.de|sorbonne-universite\.fr)$/i,
  /@([a-z0-9\-]+\.)*educa\.[a-z]{2,5}$/i,
];

export function isAcademicEmail(email: unknown): boolean {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return false;
  }
  const clean = email.trim().toLowerCase();
  return ACADEMIC_PATTERNS.some((pattern) => pattern.test(clean));
}


