import { config } from '../config/env.config.js';
import { logger } from '../utils/logger.js';

interface TurnstileVerificationResponse {
  action?: string;
  cdata?: string;
  challenge_ts?: string;
  'error-codes'?: string[];
  hostname?: string;
  messages?: string[];
  success: boolean;
}

async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<{ error?: string; success: boolean }> {
  if (!config.turnstile.enabled) {
    return { success: true };
  }

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    logger.auth.warn(`[Turnstile] Missing turnstile token from IP ${remoteIp || 'unknown'}`);
    return {
      error: 'Security verification required before continuing.',
      success: false,
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', config.turnstile.secretKey);
    formData.append('response', token.trim());
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    if (!res.ok) {
      logger.system.error(`[Turnstile] Cloudflare siteverify HTTP error: ${res.status} ${res.statusText}`);
      return {
        error: 'Unable to connect to security verification service.',
        success: false,
      };
    }

    const data = (await res.json()) as TurnstileVerificationResponse;

    if (data.success) {
      logger.auth.info(`[Turnstile] Verification passed for IP ${remoteIp || 'unknown'} (hostname: ${data.hostname || 'n/a'})`);
      return { success: true };
    }

    const errorCodes = data['error-codes']?.join(', ') || 'invalid-token';
    logger.auth.warn(`[Turnstile] Verification failed for IP ${remoteIp || 'unknown'} - Codes: ${errorCodes}`);

    return {
      error: 'Security verification invalid or expired. Please refresh and try again.',
      success: false,
    };
  } catch (err: any) {
    logger.system.error(`[Turnstile] Unexpected error verifying token with Cloudflare: ${err.message}`, { error: err });
    return {
      error: 'Error processing security verification. Please try again later.',
      success: false,
    };
  }
}

export {
  verifyTurnstileToken
};
