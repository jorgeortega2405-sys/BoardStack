import { logger } from '../services/logger.service.js';
import { UserPayload } from '../types/auth.types.js';
import { Response } from 'express';

function sanitizeUser(user: any): UserPayload {
  const tier = user.subscription_tier || 'free';
  return {
    ai_tokens_balance: user.ai_tokens_balance !== undefined ? Number(user.ai_tokens_balance) : 100,
    ai_tokens_reset_at: user.ai_tokens_reset_at ? new Date(user.ai_tokens_reset_at).toISOString() : undefined,
    avatar_url: user.avatar_url || null,
    created_at: user.created_at ? new Date(user.created_at).toISOString() : undefined,
    email: user.email,
    id: user.id,
    subscription_tier: tier,
    two_factor_enabled: Boolean(user.two_factor_enabled),
    username: user.username,
  };
}

function sendSuccess(res: Response, data: Record<string, any> = {}, statusCode = 200): void {
  res.status(statusCode).json({ ok: true, ...data });
}

function sendCreated(res: Response, data: Record<string, any> = {}): void {
  res.status(201).json({ ok: true, ...data });
}

function sendBadRequest(res: Response, error: string): void {
  res.status(400).json({ error, ok: false });
}

function sendUnauthorized(res: Response, error = 'No autorizado.'): void {
  res.status(401).json({ error, ok: false });
}

function sendForbidden(res: Response, error = 'Acceso denegado.'): void {
  res.status(403).json({ error, ok: false });
}

function sendNotFound(res: Response, error = 'Recurso no encontrado.'): void {
  res.status(404).json({ error, ok: false });
}

function sendConflict(res: Response, error: string): void {
  res.status(409).json({ error, ok: false });
}

function sendInternalError(
  res: Response,
  contextMessage: string,
  error: unknown,
  userFacingMessage = 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.'
): void {
  logger.app.error(contextMessage, error);
  res.status(500).json({ error: userFacingMessage, ok: false });
}

export { sanitizeUser, sendBadRequest, sendConflict, sendCreated, sendForbidden, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized };
