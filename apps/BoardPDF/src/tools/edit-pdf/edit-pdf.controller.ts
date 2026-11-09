import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { editPdfDocument } from './edit-pdf.service.js';
import { EditPdfModifications } from './edit-pdf.types.js';
import { Request, Response } from 'express';

async function editPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files?.file?.[0] && !req.file) {
      req.file = files.file[0];
    }
    const pdfFile = validatePdfUpload(req, res, 'edit-pdf');
    if (!pdfFile) return;

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
      error: 'Ha ocurrido un error al editar el PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { editPdfHandler };
