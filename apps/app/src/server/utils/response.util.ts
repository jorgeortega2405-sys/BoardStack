import { getCurrentUser } from '../middlewares/auth.middleware.js';
import type { Request, Response } from 'express';
import type { SessionAccount } from '../types/auth.types.js';

interface SendErrorOptions {
  code?: string;
  details?: unknown;
}

function sendSuccess<T extends object>(
  res: Response,
  payload: T = {} as T,
  status = 200
): void {
  res.status(status).json({
    ok: true,
    success: true,
    ...payload,
  });
}

function sendError(
  res: Response,
  message: string,
  status = 400,
  options?: SendErrorOptions
): void {
  const responsePayload: Record<string, unknown> = {
    error: message,
    message,
    ok: false,
    success: false,
  };
  if (options?.code) {
    responsePayload.code = options.code;
  }
  if (options?.details !== undefined) {
    responsePayload.details = options.details;
  }
  res.status(status).json(responsePayload);
}

function requireAuthenticatedUser(
  req: Request,
  res: Response,
  message = 'Invalid or expired session.'
): SessionAccount | null {
  const user = getCurrentUser(req);
  if (!user) {
    sendError(res, message, 401);
    return null;
  }
  return user;
}

function validateRequiredFields(
  res: Response,
  fields: Record<string, unknown>
): boolean {
  for (const [fieldName, val] of Object.entries(fields)) {
    if (!val || typeof val !== 'string' || val.trim().length === 0) {
      sendError(res, `${fieldName} is required.`, 400);
      return false;
    }
  }
  return true;
}

export {
  requireAuthenticatedUser,
  sendError,
  sendSuccess,
  validateRequiredFields
};

export type {
  SendErrorOptions
};
