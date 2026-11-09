import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { unlockPdf } from './unlock-pdf.service.js';
import { UnlockPdfOptions } from './unlock-pdf.types.js';
import { Request, Response } from 'express';

async function unlockPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const file = validatePdfUpload(req, res, 'unlock-pdf');
    if (!file) return;

    let options: UnlockPdfOptions = {};
    if (req.body?.options) {
      try {
        options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      } catch {
        options = { password: req.body.password || '' };
      }
    } else if (req.body?.password) {
      options = { password: req.body.password };
    }

    const result = await unlockPdf(file.buffer, file.originalname, options);
    res.json({ data: result, success: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'PASSWORD_INVALID') {
      res.status(400).json({
        error: 'La contraseña introducida es incorrecta o el archivo está protegido con contraseña.',
        requiresPassword: true,
        success: false,
      });
      return;
    }

    logger.app.error('Fallo en endpoint unlockPdfHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error al desbloquear el documento PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { unlockPdfHandler };
