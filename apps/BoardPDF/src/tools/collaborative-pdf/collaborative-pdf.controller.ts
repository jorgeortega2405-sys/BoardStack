import { PutObjectCommand } from '@aws-sdk/client-s3';
import { isS3Configured, S3_BUCKET_NAME, s3Client } from '../../config/s3.config.js';
import { getCurrentUser } from '../../middlewares/auth.middleware.js';
import { logger } from '../../services/logger.service.js';
import { addCollaborativeDocMember, deleteCollaborativeDocument, getCollaborativeDocMembers, getCollaborativeDocument, getRenderedPdfPath, listCollaborativeDocuments, removeCollaborativeDocMember, saveCollaborativeDocument, searchRegisteredUsers, updateCollaborativeDocAccessLevel } from './collaborative-pdf.service.js';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'collaborative');

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

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
    const user = getCurrentUser(req);
    let document = await getCollaborativeDocument(id);
    if (!document) {
      if (!user) {
        res.status(401).json({
          error: 'Debes iniciar sesión para crear un nuevo diseño colaborativo.',
          requireLogin: true,
          success: false,
        });
        return;
      }
      document = await saveCollaborativeDocument({
        accessLevel: 'restricted',
        content: {
          elements: [],
          pageBackgrounds: ['#ffffff'],
          pageCount: 1,
          pagePdfSources: [null],
          pageSize: { height: 1123, width: 794 },
          pageTitles: [''],
        },
        id,
        title: 'Documento sin título',
        userId: user.id,
      });
    }

    const isOwner = user?.id != null && document.user_id != null && String(document.user_id) === String(user.id);
    const isMember = document.members?.some((m) => user?.id != null && String(m.user_id) === String(user.id));

    if (document.access_level === 'restricted' && !isOwner && !isMember) {
      res.status(403).json({
        error: 'Este documento es privado. Solo las personas agregadas tienen acceso.',
        isRestricted: true,
        success: false,
      });
      return;
    }

    const canEdit = isOwner || document.access_level === 'anyone_with_link' || document.members?.some((m) => user?.id != null && String(m.user_id) === String(user.id) && m.role === 'editor');

    res.json({
      canEdit: !!canEdit,
      document,
      isOwner: !!isOwner,
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
    const id = req.params.id || req.body.id || (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `doc_${crypto.randomBytes(8).toString('hex')}`);
    const existingDoc = await getCollaborativeDocument(id);

    if (!existingDoc) {
      if (!user) {
        res.status(401).json({
          error: 'Debes iniciar sesión para crear un nuevo diseño colaborativo.',
          requireLogin: true,
          success: false,
        });
        return;
      }
    } else {
      const isOwner = user?.id != null && existingDoc.user_id != null && String(existingDoc.user_id) === String(user.id);
      const isMemberEditor = existingDoc.members?.some((m) => user?.id != null && String(m.user_id) === String(user.id) && m.role === 'editor');
      const isPublicLink = existingDoc.access_level === 'anyone_with_link';

      if (!isOwner && !isMemberEditor && !isPublicLink) {
        res.status(403).json({
          error: 'No tienes permisos para modificar este documento.',
          success: false,
        });
        return;
      }
    }

    const title = typeof req.body.title === 'string' && req.body.title.trim().length > 0 ? req.body.title.trim() : (existingDoc?.title || 'Documento sin título');
    const content = req.body.content && typeof req.body.content === 'object' ? req.body.content : (existingDoc?.content || { elements: [], pageCount: 1 });
    let accessLevel = existingDoc?.access_level || 'restricted';
    if (req.body.accessLevel === 'anyone_with_link' || req.body.accessLevel === 'restricted') {
      const isOwner = user?.id != null && existingDoc?.user_id != null && String(existingDoc.user_id) === String(user.id);
      if (!existingDoc || isOwner) {
        accessLevel = req.body.accessLevel;
      }
    }

    const document = await saveCollaborativeDocument({
      accessLevel,
      content,
      id,
      title,
      userId: existingDoc?.user_id ?? user?.id,
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

export async function getCollaborativeDocMembersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Identificador de documento no válido.', success: false });
      return;
    }
    const members = await getCollaborativeDocMembers(id);
    res.json({ members, success: true });
  } catch (err) {
    logger.app.error('Error al obtener miembros del documento colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function addCollaborativeDocMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { role = 'editor', userId } = req.body;
    if (!id || !userId || typeof userId !== 'number') {
      res.status(400).json({ error: 'Parámetros no válidos para agregar colaborador.', success: false });
      return;
    }
    const user = getCurrentUser(req);
    const doc = await getCollaborativeDocument(id);
    if (doc?.user_id && (!user?.id || String(doc.user_id) !== String(user.id))) {
      res.status(403).json({ error: 'Solo el propietario del documento puede agregar miembros.', success: false });
      return;
    }
    const member = await addCollaborativeDocMember(id, userId, role === 'viewer' ? 'viewer' : 'editor', user?.id);
    res.json({ member, success: true });
  } catch (err) {
    logger.app.error('Error al agregar miembro al documento colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function removeCollaborativeDocMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id, userId } = req.params;
    const targetUserId = parseInt(userId, 10);
    if (!id || isNaN(targetUserId)) {
      res.status(400).json({ error: 'Identificadores no válidos.', success: false });
      return;
    }
    const user = getCurrentUser(req);
    const doc = await getCollaborativeDocument(id);
    const isOwner = doc?.user_id && user?.id && String(doc.user_id) === String(user.id);
    const isSelf = user?.id && String(user.id) === String(targetUserId);
    if (doc?.user_id && !isOwner && !isSelf) {
      res.status(403).json({ error: 'Solo el propietario del documento puede remover colaboradores.', success: false });
      return;
    }
    await removeCollaborativeDocMember(id, targetUserId, user?.id);
    res.json({ success: true });
  } catch (err) {
    logger.app.error('Error al remover miembro del documento colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function updateCollaborativeDocAccessLevelHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { accessLevel } = req.body;
    if (!id || (accessLevel !== 'restricted' && accessLevel !== 'anyone_with_link')) {
      res.status(400).json({ error: 'Nivel de acceso no válido.', success: false });
      return;
    }
    const user = getCurrentUser(req);
    const doc = await getCollaborativeDocument(id);
    if (doc?.user_id && (!user?.id || String(doc.user_id) !== String(user.id))) {
      res.status(403).json({ error: 'Solo el propietario del documento puede modificar el nivel de acceso.', success: false });
      return;
    }
    await updateCollaborativeDocAccessLevel(id, accessLevel, user?.id);
    res.json({ accessLevel, success: true });
  } catch (err) {
    logger.app.error('Error al actualizar nivel de acceso del documento colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function searchCollaborativeUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const excludeDocId = typeof req.query.docId === 'string' ? req.query.docId : undefined;
    const users = await searchRegisteredUsers(query, excludeDocId);
    res.json({ success: true, users });
  } catch (err) {
    logger.app.error('Error al buscar usuarios registrados', err);
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
    const pdfPath = await getRenderedPdfPath(id);

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

export async function uploadCollaborativeAssetHandler(req: Request, res: Response): Promise<void> {
  try {
    ensureUploadsDir();
    const files = req.files as Express.Multer.File[] | undefined;
    const file = req.file as Express.Multer.File | undefined;
    const targetFiles: Express.Multer.File[] = files && Array.isArray(files) ? files : file ? [file] : [];

    if (targetFiles.length === 0) {
      res.status(400).json({
        error: 'No se ha proporcionado ningún archivo para subir.',
        success: false,
      });
      return;
    }

    const uploadedRecords: Array<{
      createdAt: string;
      id: string;
      mimeType: string;
      name: string;
      pageCount: number;
      size: number;
      type: 'image' | 'pdf';
      url: string;
    }> = [];

    for (const item of targetFiles) {
      const ext = path.extname(item.originalname).toLowerCase();
      const isPdf = item.mimetype === 'application/pdf' || ext === '.pdf';
      let pageCount = 1;

      if (isPdf) {
        try {
          const loadedPdf = await PDFDocument.load(item.buffer, { ignoreEncryption: true });
          pageCount = loadedPdf.getPageCount();
        } catch (pdfErr) {
          logger.app.warn('No se pudo determinar el número de páginas del PDF subido', pdfErr);
        }
      }

      const randomId = crypto.randomBytes(6).toString('hex');
      const safeBasename = path.basename(item.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 40);
      const uniqueFilename = `${Date.now()}_${randomId}_${safeBasename}${ext}`;
      const filePath = path.join(UPLOADS_DIR, uniqueFilename);

      fs.writeFileSync(filePath, item.buffer);

      if (isS3Configured()) {
        try {
          await s3Client.send(
            new PutObjectCommand({
              Body: item.buffer,
              Bucket: S3_BUCKET_NAME,
              ContentType: item.mimetype || 'application/octet-stream',
              Key: `uploads/collaborative/${uniqueFilename}`,
            })
          );
        } catch (s3Err) {
          logger.app.warn('Error al subir copia de archivo colaborativo a S3/MinIO', s3Err);
        }
      }

      const record = {
        createdAt: new Date().toISOString(),
        id: `upl_${randomId}`,
        mimeType: item.mimetype,
        name: item.originalname,
        pageCount,
        size: item.size,
        type: (isPdf ? 'pdf' : 'image') as 'image' | 'pdf',
        url: `/uploads/collaborative/${uniqueFilename}`,
      };

      const metaPath = path.join(UPLOADS_DIR, `${uniqueFilename}.meta.json`);
      fs.writeFileSync(metaPath, JSON.stringify(record, null, 2), 'utf-8');
      uploadedRecords.push(record);
    }

    res.json({
      file: uploadedRecords[0],
      files: uploadedRecords,
      success: true,
    });
  } catch (err) {
    logger.app.error('Error al subir archivo en editor colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export async function listCollaborativeUploadsHandler(_req: Request, res: Response): Promise<void> {
  try {
    ensureUploadsDir();
    const files = fs.readdirSync(UPLOADS_DIR);
    const metaFiles = files.filter((f) => f.endsWith('.meta.json'));
    const records = [];

    for (const mf of metaFiles) {
      try {
        const content = fs.readFileSync(path.join(UPLOADS_DIR, mf), 'utf-8');
        const parsed = JSON.parse(content);
        records.push(parsed);
      } catch {}
    }

    records.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    res.json({
      files: records,
      success: true,
    });
  } catch (err) {
    logger.app.error('Error al listar archivos subidos del editor colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}
