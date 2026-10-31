import { logger } from '../services/logger.service.js';
import { UserPayload } from '../types/auth.types.js';
import { Response } from 'express';

export function sanitizeUser(user: any): UserPayload {
  const tier = user.subscription_tier || 'free';
  return {
    avatar_url: user.avatar_url || null,
    created_at: user.created_at ? new Date(user.created_at).toISOString() : undefined,
    email: user.email,
    id: user.id,
    role: user.role || 'USER',
    roles: Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : ['USER']),
    subscription_tier: tier,
    two_factor_enabled: Boolean(user.two_factor_enabled),
    username: user.username,
  };
}

export function sendSuccess(res: Response, data: Record<string, any> = {}, statusCode = 200): void {
  res.status(statusCode).json({ ok: true, ...data });
}

export function sendCreated(res: Response, data: Record<string, any> = {}): void {
  res.status(201).json({ ok: true, ...data });
}

export function sendBadRequest(res: Response, error: string): void {
  res.status(400).json({ error, ok: false });
}

export function sendUnauthorized(res: Response, error = 'No autorizado.'): void {
  res.status(401).json({ error, ok: false });
}

export function sendForbidden(res: Response, error = 'Acceso denegado.'): void {
  res.status(403).json({ error, ok: false });
}

export function sendNotFound(res: Response, error = 'Recurso no encontrado.'): void {
  res.status(404).json({ error, ok: false });
}

export function sendConflict(res: Response, error: string): void {
  res.status(409).json({ error, ok: false });
}

export function sendInternalError(
  res: Response,
  contextMessage: string,
  error: unknown,
  userFacingMessage = 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.'
): void {
  logger.app.error(contextMessage, error);
  res.status(500).json({ error: userFacingMessage, ok: false });
}
