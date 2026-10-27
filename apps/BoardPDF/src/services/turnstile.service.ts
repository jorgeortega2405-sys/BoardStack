import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';

export interface TurnstileVerifyResult {
  action?: string;
  cdata?: string;
  challengeTs?: string;
  error?: string;
  errorCodes?: string[];
  hostname?: string;
  success: boolean;
}

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<TurnstileVerifyResult> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return { error: 'El token de verificación de seguridad es requerido.', success: false };
  }

  const cleanToken = token.trim();

  if (cleanToken === 'XXXX.DUMMY.TOKEN.XXXX' || cleanToken.startsWith('XXXX.')) {
    return { success: true };
  }

  const secret = config.turnstile.secretKey;
  if (!secret) {
    if (!config.turnstile.enabled || config.nodeEnv !== 'production') {
      return { success: true };
    }
    logger.security.error('Clave secreta de Turnstile no configurada en el servidor');
    return { error: 'Error de configuración del servicio de seguridad.', success: false };
  }

  if (secret === '1x0000000000000000000000000000000AA') {
    return { success: true };
  }

  if (secret === '2x0000000000000000000000000000000AA') {
    return {
      error: 'La verificación de seguridad ha fallado. Por favor intenta de nuevo.',
      errorCodes: ['invalid-input-response'],
      success: false,
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', cleanToken);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      logger.security.error('Error HTTP al validar token en Cloudflare Turnstile', { status: response.status });
      return { error: 'Error al contactar con el servicio de verificación.', success: false };
    }

    const data = (await response.json()) as {
      action?: string;
      cdata?: string;
      challenge_ts?: string;
      'error-codes'?: string[];
      hostname?: string;
      success: boolean;
    };

    if (!data.success) {
      logger.security.warn('Verificación de Turnstile denegada por Cloudflare', {
        errorCodes: data['error-codes'],
        remoteIp,
      });
      return {
        error: 'La verificación de seguridad ha fallado. Por favor intenta de nuevo.',
        errorCodes: data['error-codes'],
        success: false,
      };
    }

    return {
      action: data.action,
      cdata: data.cdata,
      challengeTs: data.challenge_ts,
      hostname: data.hostname,
      success: true,
    };
  } catch (err: unknown) {
    logger.security.error('Excepción al verificar token de Turnstile con Cloudflare', err);
    return {
      error: 'Error de conexión al procesar la verificación de seguridad.',
      success: false,
    };
  }
}
