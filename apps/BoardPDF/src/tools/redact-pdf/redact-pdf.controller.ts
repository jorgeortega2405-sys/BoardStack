import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { redactPdfDocument } from './redact-pdf.service.js';
import { PageRedaction } from './redact-pdf.types.js';
import { Request, Response } from 'express';

async function handleRedactPdf(req: Request, res: Response): Promise<void> {
  const file = validatePdfUpload(req, res, 'redact-pdf');
  if (!file) return;

  let redactions: PageRedaction[] = [];
  try {
    if (typeof req.body?.redactions === 'string') {
      redactions = JSON.parse(req.body.redactions);
    } else if (Array.isArray(req.body?.redactions)) {
      redactions = req.body.redactions;
    }
  } catch {
    res.status(400).json({
      error: 'Los parámetros de censura enviados no son válidos.',
      success: false,
    });
    return;
  }

  const sanitizeMetadata = req.body?.sanitizeMetadata !== 'false' && req.body?.sanitizeMetadata !== false;
  const redactionStyle = req.body?.redactionStyle === 'strike' ? 'strike' : 'solid';

  try {
    const result = await redactPdfDocument({
      buffer: file.buffer,
      originalFilename: file.originalname,
      redactions,
      redactionStyle,
      sanitizeMetadata,
    });

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al aplicar censura en documento PDF', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la censura del documento PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { handleRedactPdf };
