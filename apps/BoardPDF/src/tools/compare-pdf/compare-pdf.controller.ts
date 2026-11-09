import { logger } from '../../services/logger.service.js';
import { validateMultiplePdfs } from '../../utils/tool-handler.util.js';
import { comparePdfDocuments } from './compare-pdf.service.js';
import { Request, Response } from 'express';

async function handleComparePdf(req: Request, res: Response): Promise<Response | void> {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const file1 = files?.file1?.[0] || (Array.isArray(req.files) ? req.files[0] : undefined);
    const file2 = files?.file2?.[0] || (Array.isArray(req.files) ? req.files[1] : undefined);

    if (!file1 || !file2) {
      return res.status(400).json({
        error: 'Debes proporcionar dos archivos PDF para realizar la comparación.',
        success: false,
      });
    }

    req.files = [file1, file2];
    const validated = validateMultiplePdfs(req, res, 'compare-pdf', 2);
    if (!validated) return;

    const comparisonMode = req.body?.comparisonMode === 'overlay' ? 'overlay' : 'semantic';

    const result = await comparePdfDocuments({
      buffer1: validated[0].buffer,
      buffer2: validated[1].buffer,
      comparisonMode,
      filename1: validated[0].originalname,
      filename2: validated[1].originalname,
    });

    return res.status(200).json({
      data: result,
      success: true,
    });
  } catch (err: any) {
    logger.app.error('Error al comparar documentos PDF', { error: err });
    return res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la comparación de los documentos PDF.',
      success: false,
    });
  }
}

export { handleComparePdf };
