import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { translatePdf } from './translate-pdf.service.js';
import { Request, Response } from 'express';

export async function translatePdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const file = req.file || files?.file?.[0] || files?.pdf?.[0];
    if (!file) {
      res.status(400).json({
        error: 'Por favor selecciona un archivo PDF válido.',
        success: false,
      });
      return;
    }

    if (!isPdfBuffer(file.buffer)) {
      res.status(400).json({
        error: 'El archivo seleccionado no es un PDF válido.',
        success: false,
      });
      return;
    }

    const userPerms = ((req as any).user?.permissions as string[]) || [];
    const limits = getToolLimits('translate-pdf', userPerms);
    const maxBytes = limits.maxFileSizeMB * 1024 * 1024;

    if (file.buffer.length > maxBytes) {
      res.status(400).json({
        error: `El archivo PDF seleccionado supera el límite permitido de ${limits.maxFileSizeMB} MB.`,
        success: false,
      });
      return;
    }

    const mode = req.body.mode === 'standard' ? 'standard' : 'advanced';
    const targetLang = typeof req.body.targetLang === 'string' ? req.body.targetLang.trim() : '';
    const sourceLang = typeof req.body.sourceLang === 'string' ? req.body.sourceLang.trim() : undefined;
    const layoutMode = req.body.layoutMode === 'text_only' ? 'text_only' : 'preserve';

    if (!targetLang) {
      res.status(400).json({
        error: 'Debes seleccionar un idioma de destino para la traducción.',
        success: false,
      });
      return;
    }

    const result = await translatePdf({
      buffer: file.buffer,
      filename: file.filename || file.originalname,
      layoutMode,
      originalname: file.originalname,
      sourceLang,
      targetLang,
    });

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error: any) {
    logger.app.error('Error al procesar la traducción del PDF', {
      error: error?.message || error,
    });

    if (error?.message === 'EMPTY_PDF_TEXT') {
      res.status(400).json({
        error: 'No se pudo detectar texto para traducir en el documento PDF seleccionado.',
        success: false,
      });
      return;
    }

    if (error?.message === 'DEEPL_QUOTA_EXCEEDED') {
      res.status(429).json({
        error: 'Se ha alcanzado la cuota de traducción de documentos de DeepL. Por favor intenta más tarde.',
        success: false,
      });
      return;
    }

    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al traducir el documento PDF. Por favor intenta de nuevo más tarde.',
      success: false,
    });
  }
}

