import { verifyDownloadToken } from '../services/download-token.service.js';
import { logger } from '../services/logger.service.js';
import { DEFAULT_TTL_SECONDS, deleteTempFile, getTempFile, getTempFileMeta, getTempFilePresignedUrl, getTempFileStream } from '../services/temp-storage.service.js';
import { Request, Response } from 'express';

function extractRawToken(req: Request): string {
  const token = req.params.token ? String(req.params.token).trim() : '';
  const shard = req.params.shard ? String(req.params.shard).trim() : '';
  return shard ? `${token}/${shard}` : token;
}

export async function handleDownloadFile(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = extractRawToken(req);
    if (!rawToken) {
      res.status(400).json({ error: 'Token de descarga inválido.', success: false });
      return;
    }

    const verified = verifyDownloadToken(rawToken);
    if (!verified.valid && !verified.isLegacy) {
      if (verified.expired) {
        res.status(410).json({ error: 'El archivo solicitado ha expirado o no existe.', success: false });
        return;
      }
      res.status(403).json({ error: 'Token de descarga inválido o alterado.', success: false });
      return;
    }

    const storageToken = verified.valid ? verified.fileId : rawToken;
    const streamResult = await getTempFileStream(storageToken);
    if (streamResult) {
      const downloadFilename = verified.filename || streamResult.filename;
      res.setHeader('Content-Type', streamResult.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
      if (streamResult.fileSize > 0) {
        res.setHeader('Content-Length', streamResult.fileSize);
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      streamResult.stream.on('error', (streamErr) => {
        logger.app.error('Error durante la transmisión del archivo en descarga', streamErr);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Ha ocurrido un error durante la descarga del archivo.', success: false });
        }
      });

      streamResult.stream.pipe(res);
      return;
    }

    const item = await getTempFile(storageToken);
    if (!item) {
      res.status(404).json({ error: 'El archivo solicitado ha expirado o no existe.', success: false });
      return;
    }

    const downloadFilename = verified.filename || item.filename;
    res.setHeader('Content-Type', item.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
    res.setHeader('Content-Length', item.buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(item.buffer);
  } catch (err) {
    logger.app.error('Error al descargar archivo temporal', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la descarga.', success: false });
  }
}

export async function handleDownloadInfo(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = extractRawToken(req);
    if (!rawToken) {
      res.status(400).json({ error: 'Token de descarga inválido.', success: false });
      return;
    }

    const verified = verifyDownloadToken(rawToken);
    if (!verified.valid && !verified.isLegacy) {
      if (verified.expired) {
        res.status(410).json({ error: 'El archivo solicitado ha expirado o no existe.', success: false });
        return;
      }
      res.status(403).json({ error: 'Token de descarga inválido o alterado.', success: false });
      return;
    }

    const storageToken = verified.valid ? verified.fileId : rawToken;
    const meta = await getTempFileMeta(storageToken);
    if (!meta) {
      res.status(404).json({ error: 'El archivo solicitado ha expirado o no existe.', success: false });
      return;
    }

    const fileSize = meta.fileSize || meta.size || 0;
    const createdAt = meta.createdAt || Date.now();
    const expiresAt = verified.valid && verified.exp ? verified.exp : (createdAt + DEFAULT_TTL_SECONDS * 1000);
    const presignedUrl = await getTempFilePresignedUrl(storageToken);

    res.status(200).json({
      data: {
        contentType: meta.contentType || 'application/pdf',
        createdAt,
        downloadUrl: `/api/download/${rawToken}`,
        expiresAt,
        fileSize,
        filename: verified.filename || meta.filename,
        presignedUrl,
        token: rawToken,
      },
      success: true,
    });
  } catch (err) {
    logger.app.error('Error al obtener información de archivo temporal', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al consultar el archivo.', success: false });
  }
}

export async function handleDeleteDownloadFile(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = extractRawToken(req);
    if (!rawToken) {
      res.status(400).json({ error: 'Token de descarga inválido.', success: false });
      return;
    }

    const verified = verifyDownloadToken(rawToken);
    if (!verified.valid && !verified.isLegacy) {
      res.status(403).json({ error: 'Token de descarga inválido o alterado.', success: false });
      return;
    }

    const storageToken = verified.valid ? verified.fileId : rawToken;
    await deleteTempFile(storageToken);
    res.status(200).json({
      message: 'Archivo eliminado correctamente.',
      success: true,
    });
  } catch (err) {
    logger.app.error('Error al eliminar archivo temporal', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al eliminar el archivo.', success: false });
  }
}

export async function handleToolDownload(req: Request, res: Response): Promise<void> {
  try {
    const fileId = req.params.fileId || req.params.token;
    if (!fileId) {
      res.status(404).json({
        error: 'El archivo solicitado ha expirado o no existe.',
        success: false,
      });
      return;
    }

    const item = await getTempFile(fileId);
    if (!item) {
      res.status(404).json({
        error: 'El archivo solicitado ha expirado o no existe.',
        success: false,
      });
      return;
    }

    const downloadFilename = item.filename || 'document.pdf';
    res.setHeader('Content-Type', item.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
    res.setHeader('Content-Length', item.buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(item.buffer);
  } catch (err) {
    logger.app.error('Error al descargar archivo temporal de herramienta', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la descarga.',
      success: false,
    });
  }
}
