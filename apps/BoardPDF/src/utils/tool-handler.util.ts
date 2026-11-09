import { getToolLimits } from '../config/tools-limits.config.js';
import { isPdfBuffer } from './pdf.util.js';
import { Request, Response } from 'express';

function validatePdfUpload(req: Request, res: Response, toolId?: string): Express.Multer.File | null {
  if (!req.file) {
    res.status(400).json({
      error: 'Debes seleccionar un archivo PDF para procesar.',
      success: false,
    });
    return null;
  }

  const isNamedPdf = Boolean(req.file.originalname?.toLowerCase().endsWith('.pdf'));
  const validMagic = req.file.buffer ? isPdfBuffer(req.file.buffer) : true;
  if (!validMagic && !(toolId === 'repair-pdf' && isNamedPdf)) {
    res.status(400).json({
      error: 'El archivo enviado no corresponde a un documento PDF válido.',
      success: false,
    });
    return null;
  }

  if (toolId) {
    const userPerms = ((req as any).user?.permissions as string[]) || [];
    const limits = getToolLimits(toolId, userPerms);
    if (req.file.size > limits.maxFileSizeMB * 1024 * 1024) {
      res.status(400).json({
        error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar documentos de mayor tamaño.`,
        success: false,
      });
      return null;
    }
  }

  return req.file;
}

function validateMultiplePdfs(req: Request, res: Response, toolId?: string, maxFiles?: number): Express.Multer.File[] | null {
  const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
  if (!files || files.length === 0) {
    res.status(400).json({
      error: 'Debes seleccionar al menos un archivo PDF.',
      success: false,
    });
    return null;
  }

  if (maxFiles && files.length > maxFiles) {
    res.status(400).json({
      error: `No puedes procesar más de ${maxFiles} archivos simultáneamente.`,
      success: false,
    });
    return null;
  }

  for (const file of files) {
    if (file.buffer && !isPdfBuffer(file.buffer)) {
      res.status(400).json({
        error: `El archivo ${file.originalname || ''} no es un PDF válido.`,
        success: false,
      });
      return null;
    }
  }

  if (toolId) {
    const userPerms = ((req as any).user?.permissions as string[]) || [];
    const limits = getToolLimits(toolId, userPerms);
    const maxBytes = limits.maxFileSizeMB * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxBytes) {
        res.status(400).json({
          error: `El archivo ${file.originalname || ''} supera el límite de ${limits.maxFileSizeMB} MB permitido por tu suscripción.`,
          success: false,
        });
        return null;
      }
    }
  }

  return files;
}

export { validateMultiplePdfs, validatePdfUpload };
