import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { protectPdf } from './protect-pdf.service.js';
import { ProtectPdfOptions } from './protect-pdf.types.js';
import { Request, Response } from 'express';

async function protectPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const file = validatePdfUpload(req, res, 'protect-pdf');
    if (!file) return;

    let options: ProtectPdfOptions = { password: '' };
    if (req.body?.options) {
      try {
        options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      } catch {
        options = { password: req.body.password || '' };
      }
    } else if (req.body?.password) {
      options = { password: req.body.password };
    }

    if (!options.password || options.password.trim().length === 0) {
      res.status(400).json({ error: 'Debes introducir una contraseña válida.', success: false });
      return;
    }

    const result = await protectPdf(file.buffer, file.originalname, options);
    res.json({ data: result, success: true });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint protectPdfHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error al proteger el documento PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { protectPdfHandler };
