import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { summarizePdf } from './summarize-pdf.service.js';
import { SummaryMode } from './summarize-pdf.types.js';
import { Request, Response } from 'express';

export async function handleSummarizePdf(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      error: 'Debes seleccionar un archivo PDF para generar el resumen.',
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
  const limits = getToolLimits('summarize-pdf', userPerms);
  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;

  if (file.buffer.length > maxBytes) {
    res.status(400).json({
      error: `El archivo PDF seleccionado supera el límite permitido de ${limits.maxFileSizeMB} MB.`,
      success: false,
    });
    return;
  }

  const mode: SummaryMode = req.body?.mode === 'standard' ? 'standard' : 'advanced';
  const customPrompt = typeof req.body?.customPrompt === 'string' ? req.body.customPrompt : undefined;

  try {
    const result = await summarizePdf({
      buffer: file.buffer,
      customPrompt,
      mode,
      originalname: file.originalname,
    });

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error: any) {
    logger.app.error('Error al procesar resumen de PDF con IA', error);

    if (error?.message === 'EMPTY_PDF_TEXT') {
      res.status(400).json({
        error: 'El documento PDF no contiene texto digital legible. Si es un archivo escaneado o una imagen, puedes procesarlo primero con nuestra herramienta de OCR PDF.',
        success: false,
      });
      return;
    }

    if (error?.message === 'CONFIG_GEMINI_KEY_MISSING') {
      res.status(503).json({
        error: 'El servicio de IA no está configurado temporalmente. Por favor intenta más tarde.',
        success: false,
      });
      return;
    }

    res.status(500).json({
      error: 'No se pudo generar el resumen del documento PDF. Por favor intenta de nuevo en unos momentos.',
      success: false,
    });
  }
}

