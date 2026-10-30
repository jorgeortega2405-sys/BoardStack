import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { convertPdfToMarkdown } from './pdf-to-markdown.service.js';
import { MarkdownConversionMode } from './pdf-to-markdown.types.js';
import { Request, Response } from 'express';

export async function handleConvertPdfToMarkdown(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      error: 'Debes seleccionar un archivo PDF para convertir a Markdown.',
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

  const user = (req as any).user;
  const userPerms: string[] = user?.permissions || [];
  const limits = getToolLimits('pdf-to-markdown', userPerms);
  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;

  if (file.buffer.length > maxBytes) {
    res.status(400).json({
      error: `El archivo PDF seleccionado supera el límite permitido de ${limits.maxFileSizeMB} MB. Actualiza a Pro para procesar documentos de hasta 500 MB.`,
      success: false,
    });
    return;
  }

  const mode: MarkdownConversionMode = 'structured';
  const customPrompt = typeof req.body?.customPrompt === 'string' ? req.body.customPrompt : undefined;
  const includeMathLatex = req.body?.includeMathLatex === 'true' || req.body?.includeMathLatex === true;
  const removeHeadersFooters = req.body?.removeHeadersFooters !== 'false' && req.body?.removeHeadersFooters !== false;
  const preserveTables = req.body?.preserveTables !== 'false' && req.body?.preserveTables !== false;

  try {
    const result = await convertPdfToMarkdown({
      buffer: file.buffer,
      customPrompt,
      includeMathLatex,
      mode,
      originalname: file.originalname,
      preserveTables,
      removeHeadersFooters,
    });

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error: any) {
    logger.app.error('Error al procesar conversión de PDF a Markdown con IA', error);

    if (error?.message === 'EMPTY_PDF_TEXT') {
      res.status(400).json({
        error: 'El documento PDF no contiene texto legible ni elementos estructurados para convertir.',
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
      error: 'No se pudo convertir el documento PDF a Markdown. Por favor intenta de nuevo en unos momentos.',
      success: false,
    });
  }
}

