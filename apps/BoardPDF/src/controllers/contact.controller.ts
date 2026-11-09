import { Request, Response } from 'express';
import { getClientIp } from '../middlewares/rate-limit.middleware.js';
import { addTicketReply, createContactSubmission, getTicketByTrackingToken } from '../services/contact.service.js';
import { logger } from '../services/logger.service.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_SUBJECTS = new Set([
  'billing',
  'bug',
  'enterprise',
  'security',
  'suggestion',
  'technical',
]);

export async function submitContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email, message, name, subject } = req.body || {};

    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 150) {
      res.status(400).json({ error: 'Por favor ingresa un nombre válido (mínimo 2 caracteres).', success: false });
      return;
    }

    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) || email.trim().length > 255) {
      res.status(400).json({ error: 'Por favor ingresa un correo electrónico válido.', success: false });
      return;
    }

    const trimmedSubject = typeof subject === 'string' ? subject.trim() : '';
    if (!trimmedSubject || (!ALLOWED_SUBJECTS.has(trimmedSubject) && trimmedSubject.length > 100)) {
      res.status(400).json({ error: 'Por favor selecciona un asunto válido.', success: false });
      return;
    }

    if (typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 5000) {
      res.status(400).json({ error: 'El mensaje debe contener entre 10 y 5000 caracteres.', success: false });
      return;
    }

    const ipAddress = getClientIp(req);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;

    const result = await createContactSubmission({
      email: email.trim(),
      ipAddress,
      message: message.trim(),
      name: name.trim(),
      subject: trimmedSubject,
      userAgent,
    });

    res.status(201).json({
      message: 'Tu mensaje ha sido enviado correctamente.',
      success: true,
      ticketNumber: result.ticketNumber,
      trackingToken: result.trackingToken,
    });
  } catch (error) {
    logger.app.error('Error al procesar formulario de contacto', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function getTicketHandler(req: Request, res: Response): Promise<void> {
  try {
    const token = typeof req.params.token === 'string' ? req.params.token.trim() : '';
    if (!token || token.length < 10) {
      res.status(400).json({ error: 'Token de seguimiento no válido.', success: false });
      return;
    }

    const ticket = await getTicketByTrackingToken(token);
    if (!ticket) {
      res.status(404).json({ error: 'Incidencia o ticket no encontrado.', success: false });
      return;
    }

    res.json(ticket);
  } catch (error) {
    logger.app.error('Error al obtener información de ticket', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function replyTicketHandler(req: Request, res: Response): Promise<void> {
  try {
    const token = typeof req.params.token === 'string' ? req.params.token.trim() : '';
    const { message } = req.body || {};

    if (!token || token.length < 10) {
      res.status(400).json({ error: 'Token de seguimiento no válido.', success: false });
      return;
    }

    if (typeof message !== 'string' || message.trim().length < 2 || message.trim().length > 5000) {
      res.status(400).json({ error: 'El mensaje de respuesta no puede estar vacío.', success: false });
      return;
    }

    const reply = await addTicketReply(token, message.trim(), 'Usuario', 'customer');
    if (!reply) {
      res.status(400).json({ error: 'No se pudo enviar la respuesta a esta incidencia.', success: false });
      return;
    }

    res.json({
      message: reply,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al enviar respuesta a ticket', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}
