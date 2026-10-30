import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { splitPdfFile } from './split-pdf.service.js';
import { SplitPdfOptions } from './split-pdf.types.js';
import { Request, Response } from 'express';

export const handleSplitUploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

export async function handleSplitPdf(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      error: 'Debes seleccionar un archivo PDF para poder dividirlo.',
      success: false,
    });
    return;
  }

  if (!isPdfBuffer(file.buffer)) {
    res.status(400).json({
      error: 'El archivo enviado no corresponde a un documento PDF válido.',
      success: false,
    });
    return;
  }

  let options: SplitPdfOptions;
  try {
    if (typeof req.body?.options === 'string') {
      options = JSON.parse(req.body.options);
    } else if (req.body?.options && typeof req.body.options === 'object') {
      options = req.body.options;
    } else {
      options = {
        filename: req.body?.filename,
        fixedPageCount: req.body?.fixedPageCount ? parseInt(req.body.fixedPageCount, 10) : undefined,
        maxSizeBytes: req.body?.maxSizeBytes ? parseInt(req.body.maxSizeBytes, 10) : undefined,
        mergeSelected: req.body?.mergeSelected === 'true' || req.body?.mergeSelected === true,
        mode: req.body?.mode || 'range',
        ranges: req.body?.ranges ? (typeof req.body.ranges === 'string' ? JSON.parse(req.body.ranges) : req.body.ranges) : undefined,
        selectedPages: req.body?.selectedPages ? (typeof req.body.selectedPages === 'string' ? JSON.parse(req.body.selectedPages) : req.body.selectedPages) : undefined,
        submode: req.body?.submode,
      };
    }
  } catch {
    res.status(400).json({
      error: 'La configuración de división enviada es inválida.',
      success: false,
    });
    return;
  }

  const userPerms = ((req as any).user?.permissions as string[]) || [];
  const limits = getToolLimits('split-pdf', userPerms);
  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;

  if (file.buffer.length > maxBytes) {
    res.status(400).json({
      error: `El archivo seleccionado supera el límite permitido de ${limits.maxFileSizeMB} MB.`,
      success: false,
    });
    return;
  }

  try {
    const result = await splitPdfFile(file.buffer, file.originalname, options);

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al dividir documento PDF', error);
    const friendlyMessage = error instanceof Error && error.message.includes('válid')
      ? error.message
      : 'Ha ocurrido un error inesperado al dividir el documento PDF. Por favor intenta más tarde.';
    res.status(500).json({
      error: friendlyMessage,
      success: false,
    });
  }
}
