import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { addPageNumbers } from './page-numbers.service.js';
import { PageNumberOptions } from './page-numbers.types.js';
import { Request, Response } from 'express';

export async function addPageNumbersHandler(req: Request, res: Response): Promise<void> {
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
    const limits = getToolLimits('page-numbers', userPermissions);

    if (req.file.size > limits.maxFileSizeMB * 1024 * 1024) {
      res.status(403).json({
        error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar archivos más grandes.`,
        success: false,
      });
      return;
    }

    let options: PageNumberOptions = {};
    if (req.body?.options) {
      try {
        options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      } catch {
        options = {};
      }
    }

    const result = await addPageNumbers(req.file.buffer, req.file.originalname, options);
    res.json({ data: result, success: true });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint addPageNumbersHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error al insertar números de página en el PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}
