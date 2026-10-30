import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { processOcrPdf } from './ocr-pdf.service.js';
import { OcrLanguage } from './ocr-pdf.types.js';
import { Request, Response } from 'express';

export async function handleProcessOcrPdf(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      error: 'Debes seleccionar un archivo PDF para poder aplicarle OCR.',
      success: false,
    });
    return;
  }

  const userPermissions = (req as any).user?.permissions || [];
  const limits = getToolLimits('ocr-pdf', userPermissions);

  if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
    res.status(403).json({
      error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar archivos más grandes.`,
      success: false,
    });
    return;
  }

  if (!isPdfBuffer(file.buffer)) {
    res.status(400).json({
      error: `El archivo "${file.originalname}" no tiene un formato PDF válido.`,
      success: false,
    });
    return;
  }

  const rawLanguage = typeof req.body?.language === 'string' && req.body.language.trim() ? req.body.language.trim() : 'spa';
  const language: OcrLanguage = rawLanguage;
  const deskew = req.body?.deskew === 'true' || req.body?.deskew === true;
  const customFilename = typeof req.body?.filename === 'string' ? req.body.filename : undefined;

  try {
    const result = await processOcrPdf({
      buffer: file.buffer,
      deskew,
      filename: customFilename,
      language,
      originalname: file.originalname,
    });

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al aplicar OCR en documento PDF', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar el texto óptico del PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

