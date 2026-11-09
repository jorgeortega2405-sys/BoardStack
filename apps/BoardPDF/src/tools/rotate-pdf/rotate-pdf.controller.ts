import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { rotatePdf } from './rotate-pdf.service.js';
import { RotatePdfOptions } from './rotate-pdf.types.js';
import { Request, Response } from 'express';

async function rotatePdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const file = validatePdfUpload(req, res, 'rotate-pdf');
    if (!file) return;

    let options: RotatePdfOptions = { pages: [] };
    if (req.body?.options) {
      try {
        options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      } catch {
        options = { pages: [] };
      }
    }

    const result = await rotatePdf(file.buffer, file.originalname, options);
    res.json({ data: result, success: true });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint rotatePdfHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error al procesar la rotación del PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { rotatePdfHandler };
