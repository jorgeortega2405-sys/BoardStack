import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { cropPdf } from './crop-pdf.service.js';
import { CropPdfOptions } from './crop-pdf.types.js';
import { Request, Response } from 'express';

async function cropPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const file = validatePdfUpload(req, res, 'crop-pdf');
    if (!file) return;

    let options: CropPdfOptions = { cropBox: { height: 100, width: 100, x: 0, y: 0 } };
    if (req.body?.options) {
      try {
        options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      } catch {
        options = { cropBox: { height: 100, width: 100, x: 0, y: 0 } };
      }
    }

    const result = await cropPdf(file.buffer, file.originalname, options);
    res.json({ data: result, success: true });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint cropPdfHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error al recortar el PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { cropPdfHandler };
