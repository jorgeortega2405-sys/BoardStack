import { contactService } from '../services/contact.service.js';
import { logger } from '../services/logger.service.js';
import { SalesInquiryPayload } from '../types/contact.types.js';
import { sendBadRequest, sendInternalError, sendSuccess } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function submitSalesInquiry(req: Request, res: Response): Promise<void> {
  try {
    const {
      category,
      email,
      first_name,
      job_title,
      last_name,
      message,
      organization_name,
      organization_size,
      phone,
      primary_use_case,
      role_type,
    } = req.body as Partial<SalesInquiryPayload>;

    if (!category || !['enterprise', 'education_school', 'education_university'].includes(category)) {
      sendBadRequest(res, 'Categoría de solicitud inválida.');
      return;
    }

    if (!first_name || !last_name || !email || !organization_name) {
      sendBadRequest(res, 'Por favor completa todos los campos obligatorios.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      sendBadRequest(res, 'El formato del correo electrónico es inválido.');
      return;
    }

    const result = await contactService.createSalesInquiry({
      category,
      email,
      first_name,
      job_title,
      last_name,
      message,
      organization_name,
      organization_size,
      phone,
      primary_use_case,
      role_type,
    });

    sendSuccess(res, { id: result.id, message: 'Solicitud enviada con éxito.' });
  } catch (error: any) {
    logger.app.error('Error al procesar solicitud de ventas', { error });
    sendInternalError(res, 'Ha ocurrido un error al enviar tu solicitud. Intenta más tarde.', error);
  }
}
