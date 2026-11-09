import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { addPageNumbers } from './page-numbers.service.js';
import { PageNumberOptions } from './page-numbers.types.js';
import { Request, Response } from 'express';

async function addPageNumbersHandler(req: Request, res: Response): Promise<void> {
  try {
    const file = validatePdfUpload(req, res, 'page-numbers');
    if (!file) return;

    let options: PageNumberOptions = {};
    if (req.body?.options) {
      try {
        options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      } catch {
        options = {};
      }
    }

    const result = await addPageNumbers(file.buffer, file.originalname, options);
    res.json({ data: result, success: true });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint addPageNumbersHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error al insertar números de página en el PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { addPageNumbersHandler };
