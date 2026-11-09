import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { repairPdfFile } from './repair-pdf.service.js';
import { Request, Response } from 'express';

async function handleRepairPdf(req: Request, res: Response): Promise<void> {
  const file = validatePdfUpload(req, res, 'repair-pdf');
  if (!file) return;

  const customFilename = typeof req.body?.filename === 'string' && req.body.filename.trim() ? req.body.filename.trim() : `${file.originalname.replace(/\.pdf$/i, '')}_reparado.pdf`;

  try {
    const result = await repairPdfFile({
      buffer: file.buffer,
      filename: customFilename,
      originalname: file.originalname,
    });

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al reparar documento PDF', error);
    res.status(500).json({
      error: 'No se pudo reparar el archivo PDF seleccionado. El daño en el archivo puede ser irreversible.',
      success: false,
    });
  }
}

export { handleRepairPdf };
