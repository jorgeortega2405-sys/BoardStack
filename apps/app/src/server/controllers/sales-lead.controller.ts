import { createEnterpriseLead } from '../services/sales-lead.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';
import { sendError, sendSuccess, validateRequiredFields } from '../utils/response.util.js';

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

  const isValid = validateRequiredFields(res, {
    'Company name': companyName,
    'Company size': companySize,
    'Country or region': country,
    'First name': firstName,
    'Last name': lastName,
    'Phone number': phoneNumber,
    'Role level': roleLevel,
  });
  if (!isValid) return;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!workEmail || typeof workEmail !== 'string' || !emailRegex.test(workEmail.trim())) {
    sendError(res, 'A valid corporate email address is required.', 400);
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
