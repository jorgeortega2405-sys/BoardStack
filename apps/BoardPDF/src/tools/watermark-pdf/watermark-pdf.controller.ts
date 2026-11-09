import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { addWatermarkToPdf } from './watermark-pdf.service.js';
import { WatermarkOptions } from './watermark-pdf.types.js';
import { Request, Response } from 'express';

async function addWatermarkHandler(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files?.file?.[0] && !req.file) {
      req.file = files.file[0];
    }

    const pdfFile = validatePdfUpload(req, res, 'watermark-pdf');
    if (!pdfFile) return;

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

export { addWatermarkHandler };
