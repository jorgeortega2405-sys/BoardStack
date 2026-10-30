import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { protectPdf } from './protect-pdf.service.js';
import { ProtectPdfOptions } from './protect-pdf.types.js';
import { Request, Response } from 'express';

export async function protectPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Debes seleccionar un archivo PDF.', success: false });
      return;
    }

    if (!isPdfBuffer(req.file.buffer)) {
      res.status(400).json({ error: 'El archivo enviado no corresponde a un documento PDF válido.', success: false });
      return;
    }

    const userPermissions = (req as any).user?.permissions || [];
    const limits = getToolLimits('protect-pdf', userPermissions);

    if (req.file.size > limits.maxFileSizeMB * 1024 * 1024) {
      res.status(403).json({
        error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar archivos más grandes.`,
        success: false,
      });
      return;
    }

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

    const result = await protectPdf(req.file.buffer, req.file.originalname, options);
    res.json({ data: result, success: true });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint protectPdfHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error al proteger el documento PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}
