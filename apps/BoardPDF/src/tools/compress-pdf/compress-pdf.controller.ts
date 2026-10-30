import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { compressPdfFile } from './compress-pdf.service.js';
import { PdfCompressLevel } from './compress-pdf.types.js';
import { Request, Response } from 'express';

export const handleUploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

export async function handleCompressPdf(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      error: 'Debes seleccionar un archivo PDF para poder comprimirlo.',
      success: false,
    });
    return;
  }

  const userPerms = ((req as any).user?.permissions as string[]) || [];
  const limits = getToolLimits('compress-pdf', userPerms);

  if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
    res.status(400).json({
      error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar documentos de mayor tamaño.`,
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
      error: 'Ha ocurrido un error inesperado al comprimir el archivo PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}
