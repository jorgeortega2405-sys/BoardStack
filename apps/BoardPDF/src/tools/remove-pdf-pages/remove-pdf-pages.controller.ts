import { logger } from '../../services/logger.service.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { removePdfPages } from './remove-pdf-pages.service.js';
import { RemovePagesOptions } from './remove-pdf-pages.types.js';
import { Request, Response } from 'express';

const handleRemovePagesUploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

async function handleRemovePages(req: Request, res: Response): Promise<void> {
  const file = validatePdfUpload(req, res, 'remove-pdf-pages');
  if (!file) return;

  let pagesToRemove: number[] = [];
  try {
    if (typeof req.body?.pagesToRemove === 'string') {
      pagesToRemove = JSON.parse(req.body.pagesToRemove);
    } else if (Array.isArray(req.body?.pagesToRemove)) {
      pagesToRemove = req.body.pagesToRemove.map((n: unknown) => Number(n));
    }
  } catch {
    res.status(400).json({
      error: 'La lista de páginas para eliminar es inválida.',
      success: false,
    });
    return;
  }

  const customFilename = typeof req.body?.filename === 'string' && req.body.filename.trim() ? req.body.filename.trim() : `${file.originalname.replace(/\.pdf$/i, '')}_sin_paginas.pdf`;

  const options: RemovePagesOptions = {
    filename: customFilename,
    pagesToRemove,
  };

  try {
    const result = await removePdfPages(file.buffer, file.originalname, options);

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al eliminar páginas del documento PDF', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al eliminar las páginas del documento PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { handleRemovePages, handleRemovePagesUploadMiddleware };
