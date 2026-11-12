import { logger } from '../../services/logger.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { convertPdfFile, UPLOADS_DIR } from './pdf-converter.service.js';
import { ConversionType } from './pdf-converter.types.js';
import { Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`);
  },
});

const uploadPdf = multer({
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos en formato PDF.'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  storage,
});

const VALID_CONVERSION_TYPES: ConversionType[] = [
  'pdf-to-jpg',
  'pdf-to-word',
  'pdf-to-powerpoint',
  'pdf-to-excel',
  'pdf-to-pdfa',
];

async function handleConvertPdf(req: Request, res: Response): Promise<void> {
  const uploadedPath = req.file?.path;
  try {
    const file = validatePdfUpload(req, res, 'pdf-converter');
    if (!file) return;

    const targetType = req.body.targetType as ConversionType;
    if (!targetType || !VALID_CONVERSION_TYPES.includes(targetType)) {
      res.status(400).json({
        error: `Tipo de conversión inválido. Tipos soportados: ${VALID_CONVERSION_TYPES.join(', ')}`,
        success: false,
      });
      return;
    }

    const result = await convertPdfFile(file, targetType);

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al convertir documento PDF', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al convertir el documento PDF. Por favor intenta más tarde.',
      success: false,
    });
  } finally {
    if (uploadedPath) {
      await fs.promises.unlink(uploadedPath).catch(() => {});
    }
  }
}

export { handleConvertPdf, uploadPdf };
