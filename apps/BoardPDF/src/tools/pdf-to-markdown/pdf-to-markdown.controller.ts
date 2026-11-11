import { getWorkspaceTeamId } from '../../middlewares/workspace.middleware.js';
import { calculatePdfCost, consumeAiTokens, getUserTokenBalance } from '../../services/ai-token.service.js';
import { logger } from '../../services/logger.service.js';
import { getPdfPageCount } from '../../utils/pdf.util.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { convertPdfToMarkdown } from './pdf-to-markdown.service.js';
import { MarkdownConversionMode } from './pdf-to-markdown.types.js';
import { Request, Response } from 'express';

async function handleConvertPdfToMarkdown(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({
      error: 'Debes iniciar sesión para utilizar las herramientas de Inteligencia Artificial.',
      success: false,
    });
    return;
  }

  const file = validatePdfUpload(req, res, 'pdf-to-markdown');
  if (!file) return;

  const userPerms: string[] = user?.permissions || [];
  const teamId = getWorkspaceTeamId(req);
  const pageCount = await getPdfPageCount(file.buffer);
  const requiredTokens = calculatePdfCost('pdf-to-markdown', pageCount, file.buffer.length);
  const tokenInfo = await getUserTokenBalance(user.id, userPerms, teamId);

  if (tokenInfo.balance < requiredTokens) {
    res.status(402).json({
      error: `Saldo insuficiente de tokens IA. Esta conversión requiere ${requiredTokens} tokens y dispones de ${tokenInfo.balance} tokens. Actualiza tu plan a Pro para recibir 2,000 tokens mensuales.`,
      requiredTokens,
      success: false,
      userTokens: tokenInfo.balance,
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

    const consumeResult = await consumeAiTokens({
      fileSizeBytes: file.buffer.length,
      pageCount,
      permissions: userPerms,
      teamId,
      toolId: 'pdf-to-markdown',
      userId: user.id,
    });

    res.status(200).json({
      aiTokens: {
        balance: consumeResult.balance,
        consumed: consumeResult.consumed,
      },
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

export { handleConvertPdfToMarkdown };
