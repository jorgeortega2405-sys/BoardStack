import { generateAvatarSvg } from '../services/avatar.service.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';

function handleAvatarRequest(req: Request, res: Response): void {
  try {
    const rawName = String(req.query.name || 'Admin');
    const size = Number(req.query.size) || 80;
    const svg = generateAvatarSvg(rawName, size);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.status(200).send(svg);
  } catch (err) {
    logger.app.error('Error generating avatar SVG:', err);
    res.status(500).send('<svg></svg>');
  }
}

export {
  handleAvatarRequest
};
