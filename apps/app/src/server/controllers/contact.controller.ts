import { createContactMessage } from '../services/contact.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';
import { sendError, sendSuccess, validateRequiredFields } from '../utils/response.util.js';

async function submitContactMessageHandler(req: Request, res: Response): Promise<void> {
  const { email, message, name, subject } = req.body || {};

  const isValid = validateRequiredFields(res, {
    'Email address': email,
    'Full name': name,
    'Message': message,
    'Subject': subject,
  });
  if (!isValid) return;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    sendError(res, 'A valid email address is required.', 400);
    return;
  }

  if (typeof name !== 'string' || name.trim().length === 0) {
    sendError(res, 'Name is required.', 400);
    return;
  }

  if (typeof subject !== 'string' || subject.trim().length === 0) {
    sendError(res, 'Subject is required.', 400);
    return;
  }

  if (typeof message !== 'string' || message.trim().length === 0) {
    sendError(res, 'Message is required.', 400);
    return;
  }

  try {
    const user = getCurrentUser(req);
    const result = await createContactMessage({
      email,
      message,
      name,
      subject,
      userId: user?.id || null,
    });

    sendSuccess(res, {
      message: 'Contact message received successfully.',
      ok: true,
      uuid: result.uuid,
    }, 201);
  } catch (error: any) {
    logger.app.error('[Contact] Error submitting contact message:', error);
    sendError(res, error.message || 'Error processing contact request.', 500);
  }
}

export {
  submitContactMessageHandler
};
