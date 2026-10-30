import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { removePdfPages } from './remove-pdf-pages.service.js';
import { RemovePagesOptions } from './remove-pdf-pages.types.js';
import { Request, Response } from 'express';

export const handleRemovePagesUploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

export async function handleRemovePages(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      error: 'Debes seleccionar un archivo PDF para procesar.',
      success: false,
    });
    return;
  }

  const userPerms = ((req as any).user?.permissions as string[]) || [];
  const limits = getToolLimits('remove-pdf-pages', userPerms);

  if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
    res.status(400).json({
      error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar documentos de mayor tamaño.`,
      success: false,
    });
    return;
  }

  if (!isPdfBuffer(file.buffer)) {
    res.status(400).json({
      error: 'El archivo enviado no corresponde a un documento PDF válido.',
      success: false,
    });
    return;
  }

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
    const isValidationError = error instanceof Error && (
      error.message.includes('página') ||
      error.message.includes('protegido') ||
      error.message.includes('válido')
    );
    const friendlyMessage = isValidationError
      ? (error as Error).message
      : 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.';
    res.status(isValidationError ? 400 : 500).json({
      error: friendlyMessage,
      success: false,
    });
  }
}
