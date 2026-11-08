import { getDbPool } from '../../config/database.config.js';
import { isS3Configured, S3_BUCKET_NAME, s3Client } from '../../config/s3.config.js';
import { getCurrentUser, hasSubscriptionFeature } from '../../middlewares/auth.middleware.js';
import { calculatePdfCost, consumeAiTokens, getUserTokenBalance } from '../../services/ai-token.service.js';
import { logger } from '../../services/logger.service.js';
import { removeBackground } from '../../services/photoroom.service.js';
import { canUserAllocateStorage, recordUserAsset } from '../../services/storage-quota.service.js';
import { addCollaborativeDocMember, deleteCollaborativeDocument, getCollaborativeDocMembers, getCollaborativeDocument, getRenderedPdfPath, listCollaborativeDocuments, removeCollaborativeDocMember, saveCollaborativeDocument, searchRegisteredUsers, updateCollaborativeDocAccessLevel } from './collaborative-pdf.service.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
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
    if (!user || !user.id) {
      res.status(401).json({
        error: 'Debes iniciar sesión para ver tus proyectos.',
        requireLogin: true,
        success: false,
      });
      return;
    }
    const folderParam = req.query.folderId as string | undefined;
    const folderId = folderParam === 'root' ? '' : folderParam;
    const documents = await listCollaborativeDocuments(Number(user.id), folderId);
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
      const queryW = parseInt(req.query.w as string, 10);
      const queryH = parseInt(req.query.h as string, 10);
      const initialPageSize = queryW > 0 && queryH > 0
        ? { height: queryH, width: queryW }
        : { height: 1123, width: 794 };

      document = await saveCollaborativeDocument({
        accessLevel: 'restricted',
        content: {
          elements: [],
          pageBackgrounds: ['#ffffff'],
          pageCount: 1,
          pagePdfSources: [null],
          pageSize: initialPageSize,
          pageSizes: [initialPageSize],
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
      folderId: req.body.folderId !== undefined ? req.body.folderId : undefined,
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
    const user = getCurrentUser(req);
    if (!user || !user.id) {
      res.status(401).json({
        error: 'Debes iniciar sesión para realizar esta acción.',
        success: false,
      });
      return;
    }
    const deleted = await deleteCollaborativeDocument(id, user.id);
    if (!deleted) {
      res.status(403).json({
        error: 'No tienes permisos para eliminar este documento o el documento no existe.',
        success: false,
      });
      return;
    }
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
    const pagesParam = typeof req.query.pages === 'string' ? req.query.pages.trim() : null;
    if (pagesParam && pagesParam !== 'all') {
      const pageNums = pagesParam
        .split(',')
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => !isNaN(p) && p > 0);

      if (pageNums.length > 0) {
        const existingBytes = fs.readFileSync(pdfPath);
        const srcDoc = await PDFDocument.load(existingBytes);
        const totalPages = srcDoc.getPageCount();
        const validIndices = pageNums
          .map((p) => p - 1)
          .filter((idx) => idx >= 0 && idx < totalPages);

        if (validIndices.length > 0) {
          const outDoc = await PDFDocument.create();
          const copiedPages = await outDoc.copyPages(srcDoc, validIndices);
          copiedPages.forEach((p) => outDoc.addPage(p));
          const pdfBytes = await outDoc.save();
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
          res.send(Buffer.from(pdfBytes));
          return;
        }
      }
    }

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

    const user = getCurrentUser(req);
    const totalIncomingBytes = targetFiles.reduce((acc, f) => acc + (f.size || f.buffer?.length || 0), 0);
    let targetUserId: number | null = user?.id ? Number(user.id) : null;
    let targetDocId: string | null = null;

    if (!targetUserId) {
      const docId = typeof req.body.docId === 'string' ? req.body.docId.trim() : null;
      if (!docId) {
        res.status(401).json({
          error: 'Debes iniciar sesión para subir archivos a tu cuenta.',
          requireLogin: true,
          success: false,
        });
        return;
      }

      const doc = await getCollaborativeDocument(docId);
      if (!doc || doc.access_level !== 'anyone_with_link' || !doc.user_id) {
        res.status(403).json({
          error: 'No tienes permisos para agregar archivos a este documento.',
          success: false,
        });
        return;
      }

      const hasNonImage = targetFiles.some((f) => !f.mimetype.startsWith('image/'));
      if (hasNonImage || totalIncomingBytes > 5 * 1024 * 1024) {
        res.status(400).json({
          error: 'Solo se permite adjuntar imágenes de hasta 5 MB en modo invitado.',
          success: false,
        });
        return;
      }

      const ownerId = Number(doc.user_id);
      const { allowed } = await canUserAllocateStorage(ownerId, totalIncomingBytes);
      if (!allowed) {
        res.status(413).json({
          error: 'El propietario del documento no cuenta con suficiente espacio de almacenamiento disponible.',
          success: false,
        });
        return;
      }

      targetUserId = ownerId;
      targetDocId = doc.id;
    } else {
      const { allowed } = await canUserAllocateStorage(targetUserId, totalIncomingBytes);
      if (!allowed) {
        res.status(413).json({
          error: 'Has alcanzado el límite de almacenamiento disponible (5 GB). Por favor elimina documentos o archivos para liberar espacio.',
          success: false,
        });
        return;
      }
      if (typeof req.body.docId === 'string' && req.body.docId.trim().length > 0) {
        targetDocId = req.body.docId.trim();
      }
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
      userId?: number | null;
    }> = [];

    const targetFolderId = typeof req.body.folderId === 'string' && req.body.folderId.trim().length > 0 ? req.body.folderId.trim() : null;

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
      const s3Key = `uploads/collaborative/${uniqueFilename}`;

      if (isS3Configured()) {
        try {
          await s3Client.send(
            new PutObjectCommand({
              Body: item.buffer,
              Bucket: S3_BUCKET_NAME,
              ContentType: item.mimetype || 'application/octet-stream',
              Key: s3Key,
            })
          );
        } catch (s3Err) {
          logger.app.error('Error al subir archivo colaborativo a S3/MinIO', s3Err);
          res.status(500).json({
            error: 'No se pudo guardar el archivo en el almacenamiento en la nube.',
            success: false,
          });
          return;
        }
      }

      const assetRecordId = `upl_${randomId}`;
      try {
        await recordUserAsset({
          assetType: isPdf ? 'upload_pdf' : 'upload_image',
          byteSize: item.size || item.buffer?.length || 0,
          documentId: targetDocId,
          fileName: item.originalname,
          filePath: s3Key,
          folderId: targetFolderId,
          mimeType: item.mimetype || (isPdf ? 'application/pdf' : 'image/png'),
          s3Key: isS3Configured() ? s3Key : null,
          userId: targetUserId,
        });
      } catch (quotaErr) {
        logger.db.warn('No se pudo registrar asset en cuota de almacenamiento', quotaErr);
      }

      const record = {
        createdAt: new Date().toISOString(),
        folderId: targetFolderId,
        id: assetRecordId,
        mimeType: item.mimetype,
        name: item.originalname,
        pageCount,
        size: item.size,
        type: (isPdf ? 'pdf' : 'image') as 'image' | 'pdf',
        url: `/uploads/collaborative/${uniqueFilename}`,
        userId: targetUserId,
      };

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

export async function listCollaborativeUploadsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user || !user.id) {
      res.status(401).json({
        error: 'Debes iniciar sesión para ver tus archivos subidos.',
        requireLogin: true,
        success: false,
      });
      return;
    }
    const folderIdParam = req.query.folderId as string | undefined;
    const pool = getDbPool();
    let query = 'SELECT id, file_name, s3_key, mime_type, byte_size, asset_type, folder_id, created_at FROM user_storage_assets WHERE user_id = ? AND asset_type IN ("upload_image", "upload_pdf")';
    const params: any[] = [user.id];

    if (folderIdParam === 'root') {
      query += ' AND folder_id IS NULL';
    } else if (folderIdParam && folderIdParam !== 'all') {
      query += ' AND folder_id = ?';
      params.push(folderIdParam);
    }
    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query<any[]>(query, params);
    const records = (Array.isArray(rows) ? rows : []).map((r) => ({
      createdAt: new Date(r.created_at).toISOString(),
      folderId: r.folder_id || null,
      id: r.id,
      mimeType: r.mime_type,
      name: r.file_name,
      pageCount: 1,
      size: Number(r.byte_size) || 0,
      type: r.asset_type === 'upload_pdf' ? 'pdf' : 'image',
      url: `/uploads/collaborative/${path.basename(r.s3_key || r.file_name)}`,
      userId: user.id,
    }));

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

export async function removeBackgroundHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user || !user.id) {
      res.status(401).json({
        error: 'Debes iniciar sesión para usar la herramienta de eliminación de fondos con IA.',
        requireLogin: true,
        success: false,
      });
      return;
    }

    if (!hasSubscriptionFeature(user, 'pro')) {
      res.status(403).json({
        error: 'La eliminación de fondos con IA es una función exclusiva para planes Pro y superiores.',
        requiresUpgrade: true,
        success: false,
      });
      return;
    }

    let buffer: Buffer | null = null;
    let mimeType = 'image/png';
    let originalName = 'image.png';

    if (req.file && req.file.buffer) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype || 'image/png';
      originalName = req.file.originalname || 'image.png';
    } else if (req.body && typeof req.body.imageUrl === 'string') {
      const imageUrl = req.body.imageUrl.trim();
      if (imageUrl.startsWith('data:image/')) {
        const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          buffer = Buffer.from(match[2], 'base64');
          originalName = `canvas_image.${mimeType.split('/')[1] || 'png'}`;
        }
      } else if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
        const cleanUrl = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
        const localPath = path.resolve(process.cwd(), 'public', cleanUrl);
        if (fs.existsSync(localPath)) {
          buffer = fs.readFileSync(localPath);
          originalName = path.basename(localPath);
          const ext = path.extname(originalName).toLowerCase();
          mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
        }
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        try {
          const response = await fetch(imageUrl);
          if (response.ok) {
            const ab = await response.arrayBuffer();
            buffer = Buffer.from(ab);
            const headerType = response.headers.get('content-type');
            if (headerType && headerType.startsWith('image/')) {
              mimeType = headerType.split(';')[0];
            }
            originalName = path.basename(new URL(imageUrl).pathname) || 'downloaded.png';
          }
        } catch (fetchErr) {
          logger.app.warn('No se pudo descargar imagen remota para quitar fondo', fetchErr);
        }
      }
    }

    if (!buffer || buffer.length < 4) {
      res.status(400).json({
        error: 'No se pudo cargar una imagen válida para procesar.',
        success: false,
      });
      return;
    }

    const tokenBalance = await getUserTokenBalance(user.id);
    const requiredTokens = calculatePdfCost('remove-background', 1, buffer.length);
    if (tokenBalance.balance < requiredTokens) {
      res.status(402).json({
        currentBalance: tokenBalance.balance,
        error: `No cuentas con suficientes tokens de IA para eliminar el fondo. Requiere ${requiredTokens} tokens (saldo disponible: ${tokenBalance.balance}).`,
        requiredTokens,
        success: false,
      });
      return;
    }

    const segmentedBuffer = await removeBackground(buffer, mimeType, originalName);

    const { allowed } = await canUserAllocateStorage(Number(user.id), segmentedBuffer.length);
    if (!allowed) {
      res.status(413).json({
        error: 'Has alcanzado el límite de almacenamiento disponible. Por favor elimina archivos para liberar espacio.',
        success: false,
      });
      return;
    }

    ensureUploadsDir();
    const randomId = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(originalName);
    const safeBasename = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 40) || 'image';
    const uniqueFilename = `${Date.now()}_${randomId}_${safeBasename}_nobg.png`;
    const filePath = path.join(UPLOADS_DIR, uniqueFilename);

    fs.writeFileSync(filePath, segmentedBuffer);

    if (isS3Configured()) {
      try {
        await s3Client.send(
          new PutObjectCommand({
            Body: segmentedBuffer,
            Bucket: S3_BUCKET_NAME,
            ContentType: 'image/png',
            Key: `uploads/collaborative/${uniqueFilename}`,
          })
        );
      } catch (s3Err) {
        logger.app.warn('Error al subir copia de imagen sin fondo a S3/MinIO', s3Err);
      }
    }

    try {
      await recordUserAsset({
        assetType: 'upload_image',
        byteSize: segmentedBuffer.length,
        fileName: `${safeBasename}_nobg.png`,
        filePath,
        mimeType: 'image/png',
        s3Key: isS3Configured() ? `uploads/collaborative/${uniqueFilename}` : null,
        userId: Number(user.id),
      });
    } catch (quotaErr) {
      logger.db.warn('No se pudo registrar asset en cuota de almacenamiento', quotaErr);
    }

    const record = {
      createdAt: new Date().toISOString(),
      id: `upl_${randomId}`,
      mimeType: 'image/png',
      name: `${safeBasename}_nobg.png`,
      pageCount: 1,
      size: segmentedBuffer.length,
      type: 'image' as const,
      url: `/uploads/collaborative/${uniqueFilename}`,
      userId: Number(user.id),
    };

    const metaPath = path.join(UPLOADS_DIR, `${uniqueFilename}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(record, null, 2), 'utf-8');

    const consumeResult = await consumeAiTokens({
      fileSizeBytes: segmentedBuffer.length,
      pageCount: 1,
      toolId: 'remove-background',
      userId: user.id,
    });

    res.json({
      file: record,
      newBalance: consumeResult.balance,
      success: true,
      tokensConsumed: consumeResult.consumed,
      url: record.url,
    });
  } catch (err) {
    logger.app.error('Error al procesar eliminación de fondo con IA', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}
