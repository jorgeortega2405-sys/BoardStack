import { getCurrentUser } from '../../middlewares/auth.middleware.js';
import { logger } from '../../services/logger.service.js';
import { deleteCollaborativeDocument, getCollaborativeDocument, getRenderedPdfPath, listCollaborativeDocuments, saveCollaborativeDocument } from './collaborative-pdf.service.js';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import fs from 'fs';

export async function listCollaborativeDocsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const documents = await listCollaborativeDocuments(user?.id);
    res.json({
      documents,
      success: true,
    });
  } catch (err) {
    logger.app.error('Error al listar documentos colaborativos', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function getCollaborativeDocHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        error: 'Identificador de documento no válido.',
        success: false,
      });
      return;
    }
    const document = await getCollaborativeDocument(id);
    if (!document) {
      res.status(404).json({
        error: 'El documento solicitado no existe o ha sido eliminado.',
        success: false,
      });
      return;
    }
    res.json({
      document,
      success: true,
    });
  } catch (err) {
    logger.app.error('Error al obtener documento colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function saveCollaborativeDocHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const id = req.params.id || req.body.id || `doc_${crypto.randomBytes(8).toString('hex')}`;
    const title = typeof req.body.title === 'string' && req.body.title.trim().length > 0 ? req.body.title.trim() : 'Documento sin título';
    const content = req.body.content && typeof req.body.content === 'object' ? req.body.content : { elements: [], pageCount: 1 };

    const document = await saveCollaborativeDocument({
      content,
      id,
      title,
      userId: user?.id,
    });

    res.json({
      document,
      success: true,
    });
  } catch (err) {
    logger.app.error('Error al guardar documento colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function deleteCollaborativeDocHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        error: 'Identificador de documento no válido.',
        success: false,
      });
      return;
    }
    await deleteCollaborativeDocument(id);
    res.json({
      success: true,
    });
  } catch (err) {
    logger.app.error('Error al eliminar documento colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function downloadCollaborativeDocPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        error: 'Identificador de documento no válido.',
        success: false,
      });
      return;
    }

    const doc = await getCollaborativeDocument(id);
    const pdfPath = getRenderedPdfPath(id);

    if (!doc || !pdfPath || !fs.existsSync(pdfPath)) {
      res.status(404).json({
        error: 'El archivo PDF no está disponible para descarga.',
        success: false,
      });
      return;
    }

    const safeFilename = `${encodeURIComponent(doc.title.replace(/[^a-zA-Z0-9_\-\. ]/g, '_')) || 'document'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);
  } catch (err) {
    logger.app.error('Error al descargar PDF colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}
