import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { educationService } from '../services/education.service.js';
import { logger } from '../services/logger.service.js';
import { sendBadRequest, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function getEducationStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para consultar el estado educativo.');
      return;
    }
    const status = await educationService.getEducationStatus(user.id, user.email);
    sendSuccess(res, status);
  } catch (error: any) {
    logger.app.error('Error al consultar estado educativo', { error });
    sendInternalError(res, 'Ha ocurrido un error al verificar tu estado de elegibilidad.', error);
  }
}

export async function claimEducationFreeYear(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para canjear tu beneficio educativo.');
      return;
    }
    const result = await educationService.claimFreeEducationYear(user.id, user.email);
    sendSuccess(res, result);
  } catch (error: any) {
    if (error?.message) {
      sendBadRequest(res, error.message);
      return;
    }
    logger.app.error('Error inesperado al canjear año gratis', { error });
    sendInternalError(res, 'Ha ocurrido un error inesperado al procesar tu solicitud.', error);
  }
}
