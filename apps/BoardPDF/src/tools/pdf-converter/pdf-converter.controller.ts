import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { convertPdfFile, UPLOADS_DIR } from './pdf-converter.service.js';
import { ConversionType } from './pdf-converter.types.js';
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`);
  },
});

export const uploadPdf = multer({
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

export async function handleConvertPdf(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Debes seleccionar un archivo PDF para convertir.', success: false });
      return;
    }

    const userPerms = ((req as any).user?.permissions as string[]) || [];
    const limits = getToolLimits('pdf-converter', userPerms);

    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      res.status(400).json({
        error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar documentos de mayor tamaño.`,
        success: false,
      });
      return;
    }

    const targetType = req.body.targetType as ConversionType;
    if (!targetType || !VALID_CONVERSION_TYPES.includes(targetType)) {
      res.status(400).json({ error: 'Tipo de conversión inválido o no especificado.', success: false });
      return;
    }

    const options = {
      allowDowngrade: req.body.allowDowngrade !== 'false' && req.body.allowDowngrade !== false,
      excelSheets: req.body.excelSheets || 'single',
      jpgMode: req.body.jpgMode || 'pages',
      jpgQuality: req.body.jpgQuality || 'normal',
      ocr: req.body.ocr || 'no',
      pdfaLevel: req.body.pdfaLevel || '1b',
    };

    const result = await convertPdfFile(file, targetType, options);
    res.status(200).json({
      data: result,
      message: 'Conversión completada exitosamente.',
      success: true,
    });
  } catch (error) {
    logger.app.error('Error durante la conversión de PDF', error);
    res.status(500).json({
      error: 'Ha ocurrido un error al convertir el documento. Asegúrate de que el archivo no esté protegido con contraseña.',
      success: false,
    });
  }
}

