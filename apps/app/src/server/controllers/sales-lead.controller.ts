import { createEnterpriseLead } from '../services/sales-lead.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../utils/response.util.js';

async function submitEnterpriseLeadHandler(req: Request, res: Response): Promise<void> {
  const {
    companyName,
    companySize,
    country,
    firstName,
    hearAbout,
    lastName,
    notes,
    phoneNumber,
    roleLevel,
    workEmail,
  } = req.body || {};

  if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
    sendError(res, 'First name is required.', 400);
    return;
  }

  if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
    sendError(res, 'Last name is required.', 400);
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!workEmail || typeof workEmail !== 'string' || !emailRegex.test(workEmail.trim())) {
    sendError(res, 'A valid corporate email address is required.', 400);
    return;
  }

  if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
    sendError(res, 'Company name is required.', 400);
    return;
  }

  if (!companySize || typeof companySize !== 'string' || companySize.trim().length === 0) {
    sendError(res, 'Company size is required.', 400);
    return;
  }

  if (!country || typeof country !== 'string' || country.trim().length === 0) {
    sendError(res, 'Country or region is required.', 400);
    return;
  }

  if (!roleLevel || typeof roleLevel !== 'string' || roleLevel.trim().length === 0) {
    sendError(res, 'Role level is required.', 400);
    return;
  }

  if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
    sendError(res, 'Phone number is required.', 400);
    return;
  }

  try {
    const user = getCurrentUser(req);
    const result = await createEnterpriseLead({
      companyName,
      companySize,
      country,
      firstName,
      hearAbout: typeof hearAbout === 'string' ? hearAbout : '',
      lastName,
      notes: typeof notes === 'string' ? notes : '',
      phoneNumber,
      roleLevel,
      userId: user?.id || null,
      workEmail,
    });

    sendSuccess(res, {
      leadUuid: result.uuid,
      message: 'Enterprise inquiry submitted successfully.',
      ok: true,
    }, 201);
  } catch (error: any) {
    logger.app.error('[SalesLead] Error submitting enterprise inquiry:', error);
    sendError(res, error.message || 'Error processing sales contact request.', 500);
  }
}

export {
  submitEnterpriseLeadHandler
};
