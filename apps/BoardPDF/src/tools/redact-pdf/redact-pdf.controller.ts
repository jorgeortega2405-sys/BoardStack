import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { redactPdfDocument } from './redact-pdf.service.js';
import { PageRedaction } from './redact-pdf.types.js';
import { Request, Response } from 'express';

export async function handleRedactPdf(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      error: 'Debes seleccionar un archivo PDF para aplicar la censura.',
      success: false,
    });
    return;
  }

  if (!isPdfBuffer(file.buffer)) {
    res.status(400).json({
      error: 'El archivo seleccionado no es un PDF válido.',
      success: false,
    });
    return;
  }

  const userPerms = ((req as any).user?.permissions as string[]) || [];
  const limits = getToolLimits('redact-pdf', userPerms);

  if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
    res.status(400).json({
      error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar documentos de mayor tamaño.`,
      success: false,
    });
    return;
  }

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
  } catch (error: any) {
    logger.app.error('Error al procesar la censura del documento PDF', error);

    res.status(500).json({
      error: 'No se pudo aplicar la censura al documento PDF. Por favor intenta de nuevo en unos momentos.',
      success: false,
    });
  }
}

