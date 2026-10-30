import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { captureUrlScreenshot, convertToPdf, convertUrlToPdf, isValidPublicUrl } from './to-pdf-converter.service.js';
import { ToPdfSourceType } from './to-pdf-converter.types.js';
import { Request, Response } from 'express';


const ALLOWED_SOURCE_TYPES: Set<string> = new Set([
  'excel-to-pdf',
  'html-to-pdf',
  'jpg-to-pdf',
  'powerpoint-to-pdf',
  'word-to-pdf',
]);

export async function convertToPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const sourceType = (req.body?.sourceType || req.query?.sourceType) as ToPdfSourceType;
    if (!sourceType || !ALLOWED_SOURCE_TYPES.has(sourceType)) {
      res.status(400).json({ error: 'Tipo de conversión no válido.', success: false });
      return;
    }

    const rawUrl = req.body?.url ? String(req.body.url).trim() : '';

    const uploadedFiles: Express.Multer.File[] = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[])
      : req.file
      ? [req.file]
      : [];

    if (uploadedFiles.length === 0 && (!rawUrl || sourceType !== 'html-to-pdf')) {
      res.status(400).json({ error: 'Debes seleccionar un archivo o ingresar una URL para convertir.', success: false });
      return;
    }

    if (sourceType === 'html-to-pdf' && rawUrl) {
      if (!isValidPublicUrl(rawUrl)) {
        res.status(400).json({
          error: 'La dirección URL ingresada no es válida o apunta a una red restringida (ej. localhost o intranet privada). Ingresa una URL web pública como https://ejemplo.com.',
          success: false,
        });
        return;
      }

      const htmlOptions = {
        blockAds: req.body?.blockAds === 'true',
        margin: req.body?.margin || 'none',
        orientation: req.body?.orientation || 'portrait',
        removePopups: req.body?.removePopups === 'true',
        screen: req.body?.screen || 'screen',
        singlePage: req.body?.singlePage === 'true',
      };

      const result = await convertUrlToPdf(rawUrl, htmlOptions);
      res.json({ data: result, success: true });
      return;
    }

    if (uploadedFiles.length === 0) {
      res.status(400).json({ error: 'Debes seleccionar un archivo para convertir.', success: false });
      return;
    }

    const userPerms = ((req as any).user?.permissions as string[]) || [];
    const limits = getToolLimits('to-pdf-converter', userPerms);
    const totalSize = uploadedFiles.reduce((acc, f) => acc + f.size, 0);

    if (totalSize > limits.maxFileSizeMB * 1024 * 1024) {
      res.status(400).json({
        error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar documentos de mayor tamaño.`,
        success: false,
      });
      return;
    }

    const jpgOptions = {
      margin: req.body?.margin || 'none',
      merge: req.body?.merge !== 'false',
      orientation: req.body?.orientation || 'portrait',
      pageSize: req.body?.pageSize || 'fit',
    };

    const result = await convertToPdf(uploadedFiles, sourceType, jpgOptions);
    res.json({ data: result, success: true });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint convertToPdfHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la conversión del archivo. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function previewUrlHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const screen = typeof req.body?.screen === 'string' ? req.body.screen.trim() : 'screen';

    if (!rawUrl || !isValidPublicUrl(rawUrl)) {
      res.status(400).json({
        error: 'La dirección URL ingresada no es válida.',
        success: false,
      });
      return;
    }

    const previewImage = await captureUrlScreenshot(rawUrl, screen);
    if (!previewImage) {
      res.status(422).json({
        error: 'No se pudo generar la vista previa de la página web.',
        success: false,
      });
      return;
    }

    res.json({
      data: { previewImage },
      success: true,
    });
  } catch (err: unknown) {
    logger.app.error('Fallo en endpoint previewUrlHandler', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al generar la vista previa.',
      success: false,
    });
  }
}

