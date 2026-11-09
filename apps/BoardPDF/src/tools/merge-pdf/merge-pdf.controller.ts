import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { validateMultiplePdfs, validatePdfUpload } from '../../utils/tool-handler.util.js';
import { mergePdfFiles } from './merge-pdf.service.js';
import { Request, Response } from 'express';

const handleUploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdfs',
  maxFileSizeMB: 1000,
  maxFiles: 500,
});

async function handleMergePdf(req: Request, res: Response): Promise<void> {
  const files = (req.files as Express.Multer.File[]) || [];

  if (!files || files.length < 2) {
    res.status(400).json({
      error: 'Debes seleccionar al menos 2 archivos PDF para poder unirlos.',
      success: false,
    });
    return;
  }

  const userPerms: string[] = (req as any).user?.permissions || [];
  const limits = getToolLimits('merge-pdf', userPerms);
  const freeLimits = getToolLimits('merge-pdf', []);

  if (files.length > limits.maxFiles) {
    const error = limits.maxFiles >= 500
      ? `Has superado el límite máximo de ${limits.maxFiles} archivos por tarea permitido por tu plan.`
      : `El plan gratuito permite unir hasta ${freeLimits.maxFiles} archivos por tarea. Actualiza a Pro para unir hasta 500 archivos.`;
    res.status(400).json({
      error,
      success: false,
    });
    return;
  }

  const validatedFiles = validateMultiplePdfs(req, res, 'merge-pdf');
  if (!validatedFiles) return;

  const maxTotalBytes = limits.maxTotalSizeMB * 1024 * 1024;
  let totalSize = 0;
  for (const file of validatedFiles) {
    totalSize += file.buffer.length;
  }

  if (totalSize > maxTotalBytes) {
    const error = limits.maxTotalSizeMB >= 1000
      ? `El tamaño total de los archivos (${Math.round(totalSize / (1024 * 1024))} MB) supera el límite máximo permitido de ${limits.maxTotalSizeMB} MB.`
      : `El tamaño total supera el límite de ${freeLimits.maxTotalSizeMB} MB del plan gratuito. Actualiza a Pro para procesar hasta 1000 MB.`;
    res.status(400).json({
      error,
      success: false,
    });
    return;
  }

  const fileItems = validatedFiles.map((f) => ({ buffer: f.buffer, originalname: f.originalname }));
  const customFilename = typeof req.body?.filename === 'string' && req.body.filename.trim()
    ? req.body.filename.trim()
    : 'documento_unido.pdf';

  try {
    const result = await mergePdfFiles(fileItems, customFilename);

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al unir documentos PDF', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al unir los documentos PDF. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { handleMergePdf, handleUploadMiddleware };
