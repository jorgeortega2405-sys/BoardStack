import { logger } from '../../services/logger.service.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { organizePdf } from './organize-pdf.service.js';
import { OrganizePdfOptions, PageOrderOption } from './organize-pdf.types.js';
import { Request, Response } from 'express';

const handleOrganizePdfUploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

async function handleOrganizePdf(req: Request, res: Response): Promise<void> {
  const file = validatePdfUpload(req, res, 'organize-pdf');
  if (!file) return;

  let pagesOrder: PageOrderOption[] = [];
  try {
    if (typeof req.body?.pagesOrder === 'string') {
      pagesOrder = JSON.parse(req.body.pagesOrder);
    } else if (Array.isArray(req.body?.pagesOrder)) {
      pagesOrder = req.body.pagesOrder;
    }
  } catch {
    res.status(400).json({
      error: 'El formato de ordenamiento de páginas es inválido.',
      success: false,
    });
    return;
  }

  if (!Array.isArray(pagesOrder) || pagesOrder.length === 0) {
    res.status(400).json({
      error: 'Debes proporcionar la lista de páginas para organizar el documento.',
      success: false,
    });
    return;
  }

  const options: OrganizePdfOptions = {
    filename: req.body?.targetFilename || req.body?.filename,
    pagesOrder,
  };

  try {
    const result = await organizePdf(file.buffer, file.originalname, options);

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al organizar páginas del documento PDF', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al organizar el documento PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { handleOrganizePdf, handleOrganizePdfUploadMiddleware };
