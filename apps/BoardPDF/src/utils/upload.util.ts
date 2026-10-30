import { logger } from '../services/logger.service.js';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';

export interface UploadOptions {
  fieldName?: string;
  maxFileSizeMB?: number;
  maxFiles?: number;
}

export function createPdfUploadMiddleware(options?: UploadOptions): RequestHandler {
  const maxFiles = options?.maxFiles ?? 1;
  const maxFileSizeMB = options?.maxFileSizeMB ?? 1000;
  const maxFileSizeBytes = Math.floor(maxFileSizeMB * 1024 * 1024);
  const fieldName = options?.fieldName || (maxFiles > 1 ? 'files' : 'file');

  const multerInstance = multer({
    fileFilter: (_req, file, cb) => {
      const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
      const isPdfMime = file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf';
      if (isPdfExt || isPdfMime) {
        cb(null, true);
      } else {
        cb(new Error('INVALID_FORMAT'));
      }
    },
    limits: {
      fileSize: maxFileSizeBytes,
      files: maxFiles,
    },
    storage: multer.memoryStorage(),
  });

  const uploader = maxFiles > 1
    ? multerInstance.array(fieldName, maxFiles)
    : multerInstance.single(fieldName);

  return (req: Request, res: Response, next: NextFunction): void => {
    uploader(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: `El archivo supera el límite máximo permitido de ${maxFileSizeMB} MB.`,
            success: false,
          });
          return;
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          res.status(400).json({
            error: `Puedes subir un máximo de ${maxFiles} archivos por tarea.`,
            success: false,
          });
          return;
        }
        res.status(400).json({
          error: 'Error al subir los archivos seleccionados.',
          success: false,
        });
        return;
      }

      if (err) {
        if (err.message === 'INVALID_FORMAT') {
          res.status(400).json({
            error: 'Formato no compatible. Solo se permiten documentos en formato PDF.',
            success: false,
          });
          return;
        }
        logger.app.error('Error inesperado al cargar archivos PDF', err);
        res.status(500).json({
          error: 'Ha ocurrido un error inesperado al procesar el archivo.',
          success: false,
        });
        return;
      }

      next();
    });
  };
}
