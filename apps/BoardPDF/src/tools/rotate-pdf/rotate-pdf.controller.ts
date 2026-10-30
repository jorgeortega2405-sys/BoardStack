import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { rotatePdf } from './rotate-pdf.service.js';
import { RotatePdfOptions } from './rotate-pdf.types.js';
import { Request, Response } from 'express';

export async function rotatePdfHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Debes seleccionar un archivo PDF para rotar.', success: false });
      return;
    }

    if (!isPdfBuffer(req.file.buffer)) {
      res.status(400).json({ error: 'El archivo enviado no corresponde a un documento PDF válido.', success: false });
      return;
    }

    const userPerms = ((req as any).user?.permissions as string[]) || [];
    const limits = getToolLimits('rotate-pdf', userPerms);

    if (req.file.size > limits.maxFileSizeMB * 1024 * 1024) {
      res.status(400).json({
        error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar documentos de mayor tamaño.`,
        success: false,
      });
      return;
    }

    let options: RotatePdfOptions = { pages: [] };
    if (req.body?.options) {
      try {
        options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      } catch {
        options = { pages: [] };
      }
    }

    const result = await rotatePdf(req.file.buffer, req.file.originalname, options);
    res.json({ data: result, success: true });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint rotatePdfHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error al procesar la rotación del PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}
