import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { addWatermarkToPdf } from './watermark-pdf.service.js';
import { WatermarkOptions } from './watermark-pdf.types.js';
import { Request, Response } from 'express';

export async function addWatermarkHandler(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const pdfFile = files?.file?.[0] || req.file;

    if (!pdfFile) {
      res.status(400).json({ error: 'Debes seleccionar un archivo PDF.', success: false });
      return;
    }

    if (!isPdfBuffer(pdfFile.buffer)) {
      res.status(400).json({ error: 'El archivo enviado no corresponde a un documento PDF válido.', success: false });
      return;
    }

    const userPermissions = (req as any).user?.permissions || [];
    const limits = getToolLimits('watermark-pdf', userPermissions);

    if (pdfFile.size > limits.maxFileSizeMB * 1024 * 1024) {
      res.status(403).json({
        error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar archivos más grandes.`,
        success: false,
      });
      return;
    }

    const watermarkImageFile = files?.watermarkImage?.[0];

    let options: WatermarkOptions = {};
    if (req.body?.options) {
      try {
        options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      } catch {
        options = {};
      }
    }

    const result = await addWatermarkToPdf(
      pdfFile.buffer,
      pdfFile.originalname,
      options,
      watermarkImageFile?.buffer
    );

    res.json({ data: result, success: true });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint addWatermarkHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error al insertar la marca de agua en el PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}
