import { getDbPool } from '../../config/database.config.js';
import { isS3Configured, S3_BUCKET_NAME, s3Client } from '../../config/s3.config.js';
import { resolveToolLimits } from '../../config/subscription-plans.config.js';
import { getCurrentUser, hasSubscriptionFeature } from '../../middlewares/auth.middleware.js';
import { getWorkspaceTeam, getWorkspaceTeamId } from '../../middlewares/workspace.middleware.js';
import { MIN_AI_GENERATE_COST, calculateAiGenerateCost, calculatePdfCost, consumeAiTokens, consumeCustomAiTokens, getUserTokenBalance } from '../../services/ai-token.service.js';
import { logger } from '../../services/logger.service.js';
import { permissionService } from '../../services/permission.service.js';
import { removeBackground } from '../../services/photoroom.service.js';
import { getProjectFolderById } from '../../services/project-folders.service.js';
import { canUserAllocateStorage, recordUserAsset } from '../../services/storage-quota.service.js';
import { getTeamContextForUser } from '../../services/team.service.js';
import { validatePdfUpload } from '../../utils/tool-handler.util.js';
import { generateCollaborativeDocumentWithAi } from './design-pdf-ai.service.js';
import { acquireCollaborativeAiLock, getCollaborativeAiLock, releaseCollaborativeAiLock } from './design-pdf-lock.service.js';
import { addCollaborativeDocMember, deleteCollaborativeDocument, getCollaborativeDocByCustomSlug, getCollaborativeDocMembers, getCollaborativeDocument, getRenderedPdfBuffer, listCollaborativeDocuments, removeCollaborativeDocMember, renderCollaborativePdf, saveCollaborativeDocument, searchRegisteredUsers, updateCollaborativeDocAccessLevel, updateCollaborativeDocCustomSlug, updateCollaborativeDocTeamAccess } from './design-pdf.service.js';
import type { CollaborativeDocumentRecord } from './design-pdf.types.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

interface CollaborativeAiControllerDeps {
  acquireLock?: typeof acquireCollaborativeAiLock;
  checkDocQuota?: (userId: number, permissions: string[]) => Promise<boolean>;
  consumeTokens?: typeof consumeCustomAiTokens;
  generateWithAi?: typeof generateCollaborativeDocumentWithAi;
  getDocument?: typeof getCollaborativeDocument;
  getTokenBalance?: typeof getUserTokenBalance;
  releaseLock?: typeof releaseCollaborativeAiLock;
  saveDocument?: typeof saveCollaborativeDocument;
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'collaborative');

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

async function resolveRequestUserPermissions(req: Request, user: any, allowDbLookup = true): Promise<string[]> {
  if (user && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions as string[];
  }
  if (Array.isArray((req as any).userPermissions) && (req as any).userPermissions.length > 0) {
    return (req as any).userPermissions as string[];
  }
  if (allowDbLookup && user?.id) {
    try {
      const perms = await permissionService.getUserPermissions(
        Number(user.id),
        user.subscription_tier,
        user.subscription_status
      );
      if (user) {
        user.permissions = perms;
      }
      return perms;
    } catch {
      return [];
    }
  }
  if (user && Array.isArray(user.permissions)) {
    return user.permissions as string[];
  }
  if (Array.isArray((req as any).userPermissions)) {
    return (req as any).userPermissions as string[];
  }
  return [];
}

async function resolveDocTeamAccess(
  document: CollaborativeDocumentRecord,
  userId?: number | null
): Promise<{ canEditByTeam: boolean; canViewByTeam: boolean; isTeamAdmin: boolean }> {
  if (!document.team_id || !userId) {
    return { canEditByTeam: false, canViewByTeam: false, isTeamAdmin: false };
  }
  const teamCtx = await getTeamContextForUser(document.team_id, userId);
  if (!teamCtx) {
    return { canEditByTeam: false, canViewByTeam: false, isTeamAdmin: false };
  }
  const isTeamAdmin = teamCtx.permissions.includes('team:folders:manage');
  if (document.folder_id && !isTeamAdmin) {
    const accessibleFolder = await getProjectFolderById(document.folder_id, userId, document.team_id, teamCtx.permissions);
    if (!accessibleFolder) {
      return { canEditByTeam: false, canViewByTeam: false, isTeamAdmin: false };
    }
    if (accessibleFolder.user_role === 'viewer') {
      return {
        canEditByTeam: false,
        canViewByTeam: document.team_access === 'editor' || document.team_access === 'viewer',
        isTeamAdmin: false,
      };
    }
  }
  const canEditByTeam = isTeamAdmin || document.team_access === 'editor';
  const canViewByTeam = isTeamAdmin || document.team_access === 'editor' || document.team_access === 'viewer';
  return { canEditByTeam, canViewByTeam, isTeamAdmin };
}

async function listCollaborativeDocsHandler(req: Request, res: Response): Promise<void> {
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
    const teamCtx = getWorkspaceTeam(req);
    const folderParam = req.query.folderId as string | undefined;
    const folderId = folderParam === 'root' ? '' : folderParam;
    const documents = await listCollaborativeDocuments(
      Number(user.id),
      folderId,
      teamCtx?.id || null,
      teamCtx?.permissions || []
    );
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

async function getCollaborativeDocHandler(req: Request, res: Response): Promise<void> {
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
    const teamId = getWorkspaceTeamId(req);
    let document = await getCollaborativeDocument(id, user?.id ? Number(user.id) : null, teamId);
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
        teamAccess: teamId ? 'editor' : 'none',
        teamId,
        title: 'Documento sin título',
        userId: user.id,
      });
    }

    const isOwner = user?.id != null && document.user_id != null && String(document.user_id) === String(user.id);
    const isMember = document.members?.some((m) => user?.id != null && String(m.user_id) === String(user.id));
    const teamAccess = await resolveDocTeamAccess(document, user?.id ? Number(user.id) : null);

    if (document.access_level === 'restricted' && !isOwner && !isMember && !teamAccess.canViewByTeam) {
      res.status(403).json({
        error: 'Este documento es privado. Solo las personas agregadas tienen acceso.',
        isRestricted: true,
        success: false,
      });
      return;
    }

    const canEdit =
      isOwner ||
      document.access_level === 'anyone_with_link' ||
      teamAccess.canEditByTeam ||
      document.members?.some((m) => user?.id != null && String(m.user_id) === String(user.id) && m.role === 'editor');
    const aiLock = await getCollaborativeAiLock(id);

    res.json({
      aiLock,
      canEdit: !!canEdit,
      canManageAccess: !!(isOwner || teamAccess.isTeamAdmin),
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

async function saveCollaborativeDocHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const id = req.params.id || req.body.id || (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `doc_${crypto.randomBytes(8).toString('hex')}`);

    const aiLock = await getCollaborativeAiLock(id);
    if (aiLock.locked) {
      res.status(423).json({
        aiLock,
        code: 'AI_GENERATION_LOCKED',
        error: 'El documento está bloqueado temporalmente mientras la IA genera el contenido.',
        success: false,
      });
      return;
    }

    const activeTeamId = getWorkspaceTeamId(req);
    const existingDoc = await getCollaborativeDocument(id, user?.id ? Number(user.id) : null, activeTeamId);
    let canManageTeamDoc = false;

    if (!existingDoc) {
      if (!user) {
        res.status(401).json({
          error: 'Debes iniciar sesión para crear un nuevo diseño colaborativo.',
          requireLogin: true,
          success: false,
        });
        return;
      }

      const userPermissions = await resolveRequestUserPermissions(req, user);
      const limits = resolveToolLimits('collaborative-pdf', userPermissions);
      const pool = getDbPool();
      const [countRows] = activeTeamId
        ? await pool.query<any[]>('SELECT COUNT(*) as total FROM collaborative_documents WHERE team_id = ?', [activeTeamId])
        : await pool.query<any[]>('SELECT COUNT(*) as total FROM collaborative_documents WHERE user_id = ? AND team_id IS NULL', [user.id]);
      const currentDocCount = countRows?.[0]?.total || 0;
      if (currentDocCount >= limits.maxFiles) {
        res.status(403).json({
          error: 'Has alcanzado el límite de documentos colaborativos permitido para tu plan actual.',
          success: false,
        });
        return;
      }
    } else {
      const isOwner = user?.id != null && existingDoc.user_id != null && String(existingDoc.user_id) === String(user.id);
      const isMemberEditor = existingDoc.members?.some((m) => user?.id != null && String(m.user_id) === String(user.id) && m.role === 'editor');
      const isPublicLink = existingDoc.access_level === 'anyone_with_link';
      const teamAccess = await resolveDocTeamAccess(existingDoc, user?.id ? Number(user.id) : null);
      canManageTeamDoc = teamAccess.isTeamAdmin;

      if (!isOwner && !isMemberEditor && !isPublicLink && !teamAccess.canEditByTeam) {
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
      if (!existingDoc || isOwner || canManageTeamDoc) {
        accessLevel = req.body.accessLevel;
      }
    }

    let teamAccessLevel: 'editor' | 'none' | 'viewer' | undefined = existingDoc?.team_access;
    if (req.body.teamAccess === 'editor' || req.body.teamAccess === 'viewer' || req.body.teamAccess === 'none') {
      const isOwner = user?.id != null && existingDoc?.user_id != null && String(existingDoc.user_id) === String(user.id);
      if (!existingDoc || isOwner || canManageTeamDoc) {
        teamAccessLevel = req.body.teamAccess;
      }
    } else if (!existingDoc && activeTeamId) {
      teamAccessLevel = 'editor';
    }

    const document = await saveCollaborativeDocument({
      accessLevel,
      content,
      folderId: req.body.folderId !== undefined ? req.body.folderId : undefined,
      id,
      teamAccess: teamAccessLevel,
      teamId: existingDoc ? existingDoc.team_id : activeTeamId,
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

async function getCollaborativeDocMembersHandler(req: Request, res: Response): Promise<void> {
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

async function addCollaborativeDocMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { role = 'editor', userId } = req.body;
    if (!id || !userId || typeof userId !== 'number') {
      res.status(400).json({ error: 'Parámetros no válidos para agregar colaborador.', success: false });
      return;
    }
    const user = getCurrentUser(req);
    const doc = await getCollaborativeDocument(id);
    const teamAccess = doc ? await resolveDocTeamAccess(doc, user?.id ? Number(user.id) : null) : { canEditByTeam: false, canViewByTeam: false, isTeamAdmin: false };
    if (doc?.user_id && (!user?.id || (String(doc.user_id) !== String(user.id) && !teamAccess.isTeamAdmin))) {
      res.status(403).json({ error: 'Solo el propietario del documento puede agregar miembros.', success: false });
      return;
    }

    const userPermissions = await resolveRequestUserPermissions(req, user);
    const limits = resolveToolLimits('collaborative-pdf', userPermissions);
    const currentMembers = doc?.members || await getCollaborativeDocMembers(id);
    const isAlreadyMember = currentMembers.some((m) => m.user_id === userId);
    if (!isAlreadyMember && limits.maxCollaborators && currentMembers.length >= limits.maxCollaborators) {
      res.status(403).json({
        error: 'Has alcanzado el límite máximo de colaboradores permitido para tu plan actual.',
        success: false,
      });
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

async function removeCollaborativeDocMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id, userId } = req.params;
    const targetUserId = parseInt(userId, 10);
    if (!id || isNaN(targetUserId)) {
      res.status(400).json({ error: 'Identificadores no válidos.', success: false });
      return;
    }
    const user = getCurrentUser(req);
    const doc = await getCollaborativeDocument(id);
    const teamAccess = doc ? await resolveDocTeamAccess(doc, user?.id ? Number(user.id) : null) : { canEditByTeam: false, canViewByTeam: false, isTeamAdmin: false };
    const isOwner = doc?.user_id && user?.id && String(doc.user_id) === String(user.id);
    const isSelf = user?.id && String(user.id) === String(targetUserId);
    if (doc?.user_id && !isOwner && !isSelf && !teamAccess.isTeamAdmin) {
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

async function updateCollaborativeDocAccessLevelHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { accessLevel } = req.body;
    if (!id || (accessLevel !== 'restricted' && accessLevel !== 'anyone_with_link')) {
      res.status(400).json({ error: 'Nivel de acceso no válido.', success: false });
      return;
    }
    const aiLock = await getCollaborativeAiLock(id);
    if (aiLock.locked) {
      res.status(423).json({
        aiLock,
        code: 'AI_GENERATION_LOCKED',
        error: 'El documento está bloqueado temporalmente mientras la IA genera el contenido.',
        success: false,
      });
      return;
    }
    const user = getCurrentUser(req);
    const doc = await getCollaborativeDocument(id);
    const teamAccess = doc ? await resolveDocTeamAccess(doc, user?.id ? Number(user.id) : null) : { canEditByTeam: false, canViewByTeam: false, isTeamAdmin: false };
    if (doc?.user_id && (!user?.id || (String(doc.user_id) !== String(user.id) && !teamAccess.isTeamAdmin))) {
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

async function updateCollaborativeDocTeamAccessHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { teamAccess } = req.body || {};
    if (!id || (teamAccess !== 'editor' && teamAccess !== 'viewer' && teamAccess !== 'none')) {
      res.status(400).json({ error: 'Nivel de acceso de equipo no válido.', success: false });
      return;
    }
    const user = getCurrentUser(req);
    if (!user?.id) {
      res.status(401).json({ error: 'No autenticado.', success: false });
      return;
    }
    const doc = await getCollaborativeDocument(id);
    if (!doc || !doc.team_id) {
      res.status(404).json({ error: 'Documento de equipo no encontrado.', success: false });
      return;
    }
    const resolvedAccess = await resolveDocTeamAccess(doc, Number(user.id));
    const isOwner = doc.user_id && String(doc.user_id) === String(user.id);
    if (!isOwner && !resolvedAccess.isTeamAdmin) {
      res.status(403).json({ error: 'Solo el propietario o administrador del equipo puede cambiar el acceso del equipo.', success: false });
      return;
    }
    await updateCollaborativeDocTeamAccess(id, teamAccess, Number(user.id));
    res.json({ success: true, teamAccess });
  } catch (err) {
    logger.app.error('Error al actualizar acceso de equipo del documento colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

async function searchCollaborativeUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const excludeDocId = typeof req.query.docId === 'string' ? req.query.docId : undefined;
    const teamId = getWorkspaceTeamId(req);
    const users = await searchRegisteredUsers(query, excludeDocId, teamId);
    res.json({ success: true, users });
  } catch (err) {
    logger.app.error('Error al buscar usuarios registrados', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

async function deleteCollaborativeDocHandler(req: Request, res: Response): Promise<void> {
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
    const aiLock = await getCollaborativeAiLock(id);
    if (aiLock.locked) {
      res.status(423).json({
        aiLock,
        code: 'AI_GENERATION_LOCKED',
        error: 'El documento está bloqueado temporalmente mientras la IA genera el contenido.',
        success: false,
      });
      return;
    }
    const existingDoc = await getCollaborativeDocument(id, Number(user.id));
    let teamPerms: string[] = [];
    if (existingDoc?.team_id) {
      const teamCtx = await getTeamContextForUser(existingDoc.team_id, Number(user.id));
      teamPerms = teamCtx?.permissions || [];
    }
    const deleted = await deleteCollaborativeDocument(id, user.id, teamPerms);
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

async function downloadCollaborativeDocPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    let title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : 'document';
    let pdfBuffer: Buffer | null = null;

    if (req.body && req.body.content) {
      pdfBuffer = await renderCollaborativePdf(title, req.body.content);
    } else if (id && typeof id === 'string') {
      const doc = await getCollaborativeDocument(id);
      if (doc) {
        title = doc.title || title;
        pdfBuffer = await getRenderedPdfBuffer(id);
      }
    } else {
      res.status(400).json({
        error: 'Identificador de documento no válido.',
        success: false,
      });
      return;
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      res.status(404).json({
        error: 'El archivo PDF no está disponible para descarga.',
        success: false,
      });
      return;
    }

    const safeFilename = `${encodeURIComponent(title.replace(/[^a-zA-Z0-9_\-\. ]/g, '_')) || 'document'}.pdf`;
    const rawPages = typeof req.query.pages === 'string'
      ? req.query.pages.trim()
      : (typeof req.body?.pages === 'string' ? req.body.pages.trim() : null);
    let finalBuffer = pdfBuffer;

    if (rawPages && rawPages !== 'all') {
      const pageNums = (rawPages as string)
        .split(',')
        .map((p: string) => parseInt(p.trim(), 10))
        .filter((p: number) => !isNaN(p) && p > 0);

      if (pageNums.length > 0) {
        const srcDoc = await PDFDocument.load(pdfBuffer);
        const totalPages = srcDoc.getPageCount();
        const validIndices = pageNums
          .map((p: number) => p - 1)
          .filter((idx: number) => idx >= 0 && idx < totalPages);

        if (validIndices.length > 0) {
          const outDoc = await PDFDocument.create();
          const copiedPages = await outDoc.copyPages(srcDoc, validIndices);
          copiedPages.forEach((p) => outDoc.addPage(p));
          const pdfBytes = await outDoc.save();
          finalBuffer = Buffer.from(pdfBytes);
        }
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', finalBuffer.length.toString());
    res.send(finalBuffer);
  } catch (err) {
    logger.app.error('Error al descargar PDF colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

async function uploadCollaborativeAssetHandler(req: Request, res: Response): Promise<void> {
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

    let targetTeamId: number | null = getWorkspaceTeamId(req);

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
      targetTeamId = doc.team_id || null;
      const { allowed } = await canUserAllocateStorage(ownerId, totalIncomingBytes, targetTeamId);
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
      if (typeof req.body.docId === 'string' && req.body.docId.trim().length > 0) {
        const requestedDocId = req.body.docId.trim();
        targetDocId = requestedDocId;
        const docForUpload = await getCollaborativeDocument(requestedDocId);
        if (docForUpload?.team_id) {
          targetTeamId = docForUpload.team_id;
        }
      }
      const userPermissions = await resolveRequestUserPermissions(req, user);
      const limits = resolveToolLimits('collaborative-pdf', userPermissions);
      const maxFileBytes = limits.maxFileSizeMB * 1024 * 1024;
      const oversizedFile = targetFiles.find((f) => (f.size || f.buffer?.length || 0) > maxFileBytes);
      if (oversizedFile) {
        res.status(400).json({
          error: `El archivo supera el tamaño máximo permitido de ${limits.maxFileSizeMB} MB para tu plan.`,
          success: false,
        });
        return;
      }

      const { allowed } = await canUserAllocateStorage(targetUserId, totalIncomingBytes, targetTeamId);
      if (!allowed) {
        res.status(413).json({
          error: 'Has alcanzado el límite de almacenamiento disponible. Por favor elimina documentos o archivos para liberar espacio.',
          success: false,
        });
        return;
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
          teamId: targetTeamId,
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

async function listCollaborativeUploadsHandler(req: Request, res: Response): Promise<void> {
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
    const teamId = getWorkspaceTeamId(req);
    const pool = getDbPool();
    let query = teamId
      ? 'SELECT id, user_id, file_name, s3_key, mime_type, byte_size, asset_type, folder_id, created_at FROM user_storage_assets WHERE team_id = ? AND asset_type IN ("upload_image", "upload_pdf")'
      : 'SELECT id, user_id, file_name, s3_key, mime_type, byte_size, asset_type, folder_id, created_at FROM user_storage_assets WHERE user_id = ? AND team_id IS NULL AND asset_type IN ("upload_image", "upload_pdf")';
    const params: any[] = [teamId || user.id];

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
      userId: r.user_id || user.id,
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

async function removeBackgroundHandler(req: Request, res: Response): Promise<void> {
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

    const activeTeamId = getWorkspaceTeamId(req);
    const tokenBalance = await getUserTokenBalance(user.id, user.permissions, activeTeamId);
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

    const { allowed } = await canUserAllocateStorage(Number(user.id), segmentedBuffer.length, activeTeamId);
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
        teamId: activeTeamId,
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
      permissions: user.permissions,
      teamId: activeTeamId,
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

function createAiGenerateCollaborativeDocHandler(deps: CollaborativeAiControllerDeps = {}) {
  const acquireLock = deps.acquireLock || acquireCollaborativeAiLock;
  const consumeTokens = deps.consumeTokens || consumeCustomAiTokens;
  const generateWithAi = deps.generateWithAi || generateCollaborativeDocumentWithAi;
  const getDocument = deps.getDocument || getCollaborativeDocument;
  const getTokenBalance = deps.getTokenBalance || getUserTokenBalance;
  const releaseLock = deps.releaseLock || releaseCollaborativeAiLock;
  const saveDocument = deps.saveDocument || saveCollaborativeDocument;

  return async function aiGenerateCollaborativeDocHandler(req: Request, res: Response): Promise<void> {
    const user = getCurrentUser(req);
    if (!user || !user.id) {
      res.status(401).json({
        error: 'Debes iniciar sesión para generar contenido con IA.',
        requireLogin: true,
        success: false,
      });
      return;
    }

    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        error: 'Identificador de documento no válido.',
        success: false,
      });
      return;
    }

    const rawPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!rawPrompt) {
      res.status(400).json({
        error: 'Debes escribir una descripción de lo que deseas generar.',
        success: false,
      });
      return;
    }

    if (rawPrompt.length > 4000) {
      res.status(400).json({
        error: 'La descripción no puede superar los 4000 caracteres.',
        success: false,
      });
      return;
    }

    const mode: 'append' | 'replace' = req.body?.mode === 'append' ? 'append' : 'replace';

    try {
      const hasMockedDeps = Boolean(deps.getTokenBalance || deps.checkDocQuota || deps.consumeTokens);
      const userPermissions = await resolveRequestUserPermissions(req, user, !hasMockedDeps);
      const activeTeamId = getWorkspaceTeamId(req);

      const existingDoc = await getDocument(id);
      const effectiveTeamId = existingDoc?.team_id || activeTeamId || null;

      if (!existingDoc) {
        if (deps.checkDocQuota) {
          const allowed = await deps.checkDocQuota(Number(user.id), userPermissions);
          if (!allowed) {
            res.status(403).json({
              error: 'Has alcanzado el límite de documentos colaborativos permitido para tu plan actual.',
              success: false,
            });
            return;
          }
        } else {
          const limits = resolveToolLimits('collaborative-pdf', userPermissions);
          const pool = getDbPool();
          const [countRows] = effectiveTeamId
            ? await pool.query<any[]>('SELECT COUNT(*) as total FROM collaborative_documents WHERE team_id = ?', [effectiveTeamId])
            : await pool.query<any[]>('SELECT COUNT(*) as total FROM collaborative_documents WHERE user_id = ? AND team_id IS NULL', [user.id]);
          const currentDocCount = countRows?.[0]?.total || 0;
          if (currentDocCount >= limits.maxFiles) {
            res.status(403).json({
              error: 'Has alcanzado el límite de documentos colaborativos permitido para tu plan actual.',
              success: false,
            });
            return;
          }
        }
      } else {
        const isOwner = existingDoc.user_id != null && String(existingDoc.user_id) === String(user.id);
        const isMemberEditor = existingDoc.members?.some((m) => String(m.user_id) === String(user.id) && m.role === 'editor');
        const isPublicLink = existingDoc.access_level === 'anyone_with_link';
        const teamAccess = hasMockedDeps ? { canEditByTeam: false, canViewByTeam: false, isTeamAdmin: false } : await resolveDocTeamAccess(existingDoc, Number(user.id));

        if (!isOwner && !isMemberEditor && !isPublicLink && !teamAccess.canEditByTeam) {
          res.status(403).json({
            error: 'No tienes permisos para modificar este documento.',
            success: false,
          });
          return;
        }
      }

      const initialBalance = await getTokenBalance(Number(user.id), userPermissions, effectiveTeamId);
      if (initialBalance.balance < MIN_AI_GENERATE_COST) {
        res.status(402).json({
          currentBalance: initialBalance.balance,
          error: `Saldo insuficiente de tokens IA. Esta operación requiere al menos ${MIN_AI_GENERATE_COST} tokens y dispones de ${initialBalance.balance} tokens.`,
          requiredTokens: MIN_AI_GENERATE_COST,
          success: false,
          userTokens: initialBalance.balance,
        });
        return;
      }

      const lockResult = await acquireLock(id, Number(user.id), user.username);
      if (!lockResult.acquired) {
        res.status(423).json({
          aiLock: lockResult.lock,
          code: 'AI_GENERATION_LOCKED',
          error: 'El documento está bloqueado temporalmente mientras la IA genera el contenido.',
          success: false,
        });
        return;
      }

      try {
        const bodyContent = req.body?.currentContent && typeof req.body.currentContent === 'object' ? req.body.currentContent : null;
        const effectiveContent = bodyContent && Array.isArray(bodyContent.elements) ? bodyContent : existingDoc?.content;

        const requestedTitle = typeof req.body?.currentTitle === 'string' && req.body.currentTitle.trim().length > 0
          ? req.body.currentTitle.trim()
          : undefined;
        const effectiveTitle = requestedTitle || existingDoc?.title;

        const aiResult = await generateWithAi({
          authorName: user.username || undefined,
          currentContent: effectiveContent,
          currentTitle: effectiveTitle,
          mode,
          prompt: rawPrompt,
        });

        const requiredTokens = calculateAiGenerateCost(aiResult.geminiTokens, aiResult.generatedPageCount);
        const currentBalanceInfo = await getTokenBalance(Number(user.id), userPermissions, effectiveTeamId);
        if (currentBalanceInfo.balance < requiredTokens) {
          res.status(402).json({
            currentBalance: currentBalanceInfo.balance,
            error: `Saldo insuficiente de tokens IA. Esta generación de ${aiResult.generatedPageCount} página(s) requiere ${requiredTokens} tokens y dispones de ${currentBalanceInfo.balance} tokens.`,
            requiredTokens,
            success: false,
            userTokens: currentBalanceInfo.balance,
          });
          return;
        }

        const contentBytes = Buffer.byteLength(JSON.stringify(aiResult.content), 'utf8');
        const consumeRes = await consumeTokens({
          fileSizeBytes: contentBytes,
          pageCount: aiResult.generatedPageCount,
          permissions: userPermissions,
          requiredTokens,
          teamId: effectiveTeamId,
          toolId: 'collaborative-ai-generate',
          userId: Number(user.id),
        });

        if (!consumeRes.success) {
          res.status(402).json({
            currentBalance: consumeRes.balance,
            error: `Saldo insuficiente de tokens IA. Esta generación requiere ${consumeRes.required} tokens y dispones de ${consumeRes.balance} tokens.`,
            requiredTokens: consumeRes.required,
            success: false,
            userTokens: consumeRes.balance,
          });
          return;
        }

        const savedDoc = await saveDocument({
          accessLevel: existingDoc?.access_level || 'restricted',
          content: aiResult.content,
          id,
          teamAccess: existingDoc?.team_access || (effectiveTeamId ? 'editor' : 'none'),
          teamId: effectiveTeamId,
          title: aiResult.title,
          userId: existingDoc?.user_id ?? Number(user.id),
        });

        res.status(200).json({
          aiTokens: {
            balance: consumeRes.balance,
            consumed: consumeRes.consumed,
            geminiTokens: aiResult.geminiTokens,
            limit: consumeRes.limit,
          },
          document: savedDoc,
          generated: {
            addedCount: aiResult.addedCount,
            generatedPageCount: aiResult.generatedPageCount,
            mode,
            model: aiResult.model,
            pageCount: aiResult.pageCount,
          },
          success: true,
        });
      } finally {
        await releaseLock(id, lockResult.lockToken);
      }
    } catch (err: any) {
      if (err?.message === 'CONFIG_GEMINI_KEY_MISSING' || err?.message === 'GEMINI_UNAVAILABLE') {
        res.status(503).json({
          error: 'El servicio de generación con IA no está disponible temporalmente. Por favor intenta más tarde.',
          success: false,
        });
        return;
      }

      logger.app.error('Error al generar documento colaborativo con IA', err);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  };
}

const aiGenerateCollaborativeDocHandler = createAiGenerateCollaborativeDocHandler();

async function updateCollaborativeDocCustomSlugHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { customSlug } = req.body;
    if (!id || typeof id !== 'string' || !customSlug || typeof customSlug !== 'string') {
      res.status(400).json({
        error: 'Identificador o enlace personalizado inválido.',
        success: false,
      });
      return;
    }

    const user = getCurrentUser(req);
    const userId = user?.id ? Number(user.id) : null;
    const result = await updateCollaborativeDocCustomSlug(id, customSlug, userId);

    if (!result.success) {
      res.status(result.error?.includes('ya está en uso') ? 409 : 400).json({
        error: result.error || 'No se pudo actualizar el enlace personalizado.',
        success: false,
      });
      return;
    }

    res.json({
      customSlug: result.customSlug,
      success: true,
      url: `/l/${result.customSlug}`,
    });
  } catch (err) {
    logger.app.error('Error al actualizar custom slug del documento colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

async function resolveCollaborativeDocSlugHandler(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    if (!slug || typeof slug !== 'string') {
      res.status(400).json({
        error: 'Enlace no válido.',
        success: false,
      });
      return;
    }

    const docId = await getCollaborativeDocByCustomSlug(slug);
    if (!docId) {
      res.status(404).json({
        error: 'Diseño no encontrado.',
        success: false,
      });
      return;
    }

    res.json({
      id: docId,
      success: true,
    });
  } catch (err) {
    logger.app.error('Error al resolver custom slug de documento colaborativo', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  }
}

export { addCollaborativeDocMemberHandler, aiGenerateCollaborativeDocHandler, createAiGenerateCollaborativeDocHandler, deleteCollaborativeDocHandler, downloadCollaborativeDocPdfHandler, getCollaborativeDocHandler, getCollaborativeDocMembersHandler, listCollaborativeDocsHandler, listCollaborativeUploadsHandler, removeBackgroundHandler, removeCollaborativeDocMemberHandler, resolveCollaborativeDocSlugHandler, saveCollaborativeDocHandler, searchCollaborativeUsersHandler, updateCollaborativeDocAccessLevelHandler, updateCollaborativeDocCustomSlugHandler, updateCollaborativeDocTeamAccessHandler, uploadCollaborativeAssetHandler };
export type { CollaborativeAiControllerDeps };
