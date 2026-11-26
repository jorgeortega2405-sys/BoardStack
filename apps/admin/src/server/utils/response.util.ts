import type { Response } from 'express';

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

export {
  sendError,
  sendSuccess
};

export type {
  SendErrorOptions
};
