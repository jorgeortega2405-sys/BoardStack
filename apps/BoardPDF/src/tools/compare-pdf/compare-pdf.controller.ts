import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { comparePdfDocuments } from './compare-pdf.service.js';
import { Request, Response } from 'express';

export async function handleComparePdf(req: Request, res: Response): Promise<Response> {
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

    const userPermissions = (req as any).user?.permissions || [];
    const limits = getToolLimits('compare-pdf', userPermissions);

    if (file1.size > limits.maxFileSizeMB * 1024 * 1024 || file2.size > limits.maxFileSizeMB * 1024 * 1024) {
      return res.status(403).json({
        error: `Uno o ambos archivos superan el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar archivos más grandes.`,
        success: false,
      });
    }

    if (!isPdfBuffer(file1.buffer) || !isPdfBuffer(file2.buffer)) {
      return res.status(400).json({
        error: 'Ambos archivos deben tener un formato PDF válido.',
        success: false,
      });
    }

    const comparisonMode = req.body?.comparisonMode === 'overlay' ? 'overlay' : 'semantic';

    const result = await comparePdfDocuments({
      buffer1: file1.buffer,
      buffer2: file2.buffer,
      comparisonMode,
      filename1: file1.originalname,
      filename2: file2.originalname,
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

