import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { editPdfDocument } from './edit-pdf.service.js';
import { EditPdfModifications } from './edit-pdf.types.js';
import { Request, Response } from 'express';

export async function editPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const pdfFile = files?.file?.[0] || req.file;

    if (!pdfFile) {
      res.status(400).json({ error: 'Debes seleccionar un archivo PDF.', success: false });
      return;
    }

    if (!isPdfBuffer(pdfFile.buffer)) {
      res.status(400).json({ error: 'El archivo seleccionado no es un PDF válido.', success: false });
      return;
    }

    const userPerms = ((req as any).user?.permissions as string[]) || [];
    const limits = getToolLimits('edit-pdf', userPerms);

    if (pdfFile.size > limits.maxFileSizeMB * 1024 * 1024) {
      res.status(400).json({
        error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar documentos de mayor tamaño.`,
        success: false,
      });
      return;
    }

    const imageFiles = files?.images || [];
    const imageBuffers = imageFiles.map((f) => f.buffer);

    let modifications: EditPdfModifications = {};
    if (req.body?.modifications) {
      try {
        modifications = typeof req.body.modifications === 'string'
          ? JSON.parse(req.body.modifications)
          : req.body.modifications;
      } catch {
        modifications = {};
      }
    }

    const customFilename = typeof req.body?.filename === 'string' ? req.body.filename : undefined;

    const result = await editPdfDocument(
      pdfFile.buffer,
      pdfFile.originalname,
      modifications,
      imageBuffers,
      customFilename
    );

    res.json({ data: result, success: true });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint editPdfHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la edición del PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}
