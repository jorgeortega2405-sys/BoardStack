import { logger } from '../../services/logger.service.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { splitPdfFile } from './split-pdf.service.js';
import { SplitPdfOptions } from './split-pdf.types.js';
import { Request, Response } from 'express';

const handleSplitUploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

async function handleSplitPdf(req: Request, res: Response): Promise<void> {
  const file = validatePdfUpload(req, res, 'split-pdf');
  if (!file) return;

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

export { handleSplitPdf, handleSplitUploadMiddleware };
