import { logger } from '../../services/logger.service.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { compressPdfFile } from './compress-pdf.service.js';
import { PdfCompressLevel } from './compress-pdf.types.js';
import { Request, Response } from 'express';

const handleUploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

async function handleCompressPdf(req: Request, res: Response): Promise<void> {
  const file = validatePdfUpload(req, res, 'compress-pdf');
  if (!file) return;

  const rawLevel = req.body?.level;
  const level: PdfCompressLevel = rawLevel === 'extreme' || rawLevel === 'low' ? rawLevel : 'recommended';
  const customFilename = typeof req.body?.filename === 'string' && req.body.filename.trim() ? req.body.filename.trim() : `${file.originalname.replace(/\.pdf$/i, '')}_comprimido.pdf`;

  try {
    const result = await compressPdfFile({
      buffer: file.buffer,
      filename: customFilename,
      level,
      originalname: file.originalname,
    });

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al comprimir documento PDF', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al comprimir el documento PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { handleCompressPdf, handleUploadMiddleware };
