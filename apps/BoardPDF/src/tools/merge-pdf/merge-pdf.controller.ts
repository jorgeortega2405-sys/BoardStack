import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { mergePdfFiles } from './merge-pdf.service.js';
import { Request, Response } from 'express';

export const handleUploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdfs',
  maxFileSizeMB: 1000,
  maxFiles: 500,
});

export async function handleMergePdf(req: Request, res: Response): Promise<void> {
  const files = (req.files as Express.Multer.File[]) || [];

  if (!files || files.length < 2) {
    res.status(400).json({
      error: 'Debes seleccionar al menos 2 archivos PDF para poder unirlos.',
      success: false,
    });
    return;
  }

  const userPerms: string[] = (req as any).user?.permissions || [];
  const limits = getToolLimits('merge-pdf', userPerms);
  const freeLimits = getToolLimits('merge-pdf', []);

  if (files.length > limits.maxFiles) {
    res.status(400).json({
      error: `El plan gratuito permite unir hasta ${freeLimits.maxFiles} archivos por tarea. Actualiza a Pro para unir hasta 500 archivos.`,
      success: false,
    });
    return;
  }

  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;
  const maxTotalBytes = limits.maxTotalSizeMB * 1024 * 1024;
  let totalSize = 0;
  for (const file of files) {
    totalSize += file.buffer.length;
    if (file.buffer.length > maxBytes) {
      res.status(400).json({
        error: `El archivo "${file.originalname}" supera el límite permitido de ${limits.maxFileSizeMB} MB.`,
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
  }

  if (totalSize > maxTotalBytes) {
    res.status(400).json({
      error: `El tamaño total acumulado de los archivos supera el límite de ${limits.maxTotalSizeMB} MB.`,
      success: false,
    });
    return;
  }

  try {
    const customFilename = typeof req.body?.filename === 'string' ? req.body.filename : undefined;
    const result = await mergePdfFiles(
      files.map((f) => ({
        buffer: f.buffer,
        originalname: f.originalname,
      })),
      customFilename
    );

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al unir documentos PDF', error);
    const friendlyMessage = error instanceof Error && error.message.includes('válido')
      ? error.message
      : 'Ha ocurrido un error inesperado al unir los archivos PDF. Por favor intenta más tarde.';
    res.status(500).json({
      error: friendlyMessage,
      success: false,
    });
  }
}
