import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { estimateAiTokenCost, getUserTokenBalance } from '../services/ai-token.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

async function handleGetTokenBalance(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
      return;
    }

    const permissions = user.permissions || [];
    const info = await getUserTokenBalance(user.id, permissions);

    res.status(200).json({
      data: info,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al obtener balance de tokens IA', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al consultar tus tokens. Por favor intenta más tarde.',
      success: false,
    });
  }
}

async function handleEstimateTokenCost(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
      return;
    }

    const { fileSizeBytes, pageCount, toolId } = req.body || {};
    if (!toolId || typeof toolId !== 'string') {
      res.status(400).json({ error: 'Parámetros inválidos para estimar costo de tokens.', success: false });
      return;
    }

    const permissions = user.permissions || [];
    const estimate = await estimateAiTokenCost({
      fileSizeBytes: Number(fileSizeBytes) || 0,
      pageCount: Number(pageCount) || 1,
      permissions,
      toolId,
      userId: user.id,
    });

    res.status(200).json({
      data: estimate,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al estimar costo de tokens IA', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al calcular la estimación. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { handleEstimateTokenCost, handleGetTokenBalance };
