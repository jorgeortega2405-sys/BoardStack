import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { processOcrPdf } from './ocr-pdf.service.js';
import { OcrLanguage } from './ocr-pdf.types.js';
import { Request, Response } from 'express';

async function handleProcessOcrPdf(req: Request, res: Response): Promise<void> {
  const file = validatePdfUpload(req, res, 'ocr-pdf');
  if (!file) return;

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

export { handleProcessOcrPdf };
