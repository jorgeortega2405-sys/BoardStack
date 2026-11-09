import { getDbPool } from '../../config/database.config.js';
import { logger } from '../../services/logger.service.js';
import { reclaimDocumentStorage, syncDocumentStorage } from '../../services/storage-quota.service.js';
import { cleanTextForWinAnsi, parseHexColor } from '../../utils/pdf.util.js';
import { CollaborativeDocumentContent, CollaborativeDocumentRecord, CollaborativeMember } from './collaborative-pdf.types.js';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readPublicAsset(relPath: string): Buffer | null {
  const cleanRel = relPath.replace(/^\//, '');
  const candidate1 = path.resolve(__dirname, '../../../public', cleanRel);
  if (fs.existsSync(candidate1)) return fs.readFileSync(candidate1);
  const candidate2 = path.resolve(process.cwd(), 'public', cleanRel);
  if (fs.existsSync(candidate2)) return fs.readFileSync(candidate2);
  return null;
}

async function renderCollaborativePdf(
  title: string,
  content: CollaborativeDocumentContent
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(cleanTextForWinAnsi(title));
  pdfDoc.setCreator('BoardPDF Collaborative');

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  const resolveFont = (fontFamily?: string, isBold?: boolean) => {
    if (isBold) return fontHelveticaBold;
    if (!fontFamily) return fontHelvetica;
    const lower = fontFamily.toLowerCase();
    if (lower.includes('times') || lower.includes('serif')) return fontTimes;
    if (lower.includes('courier') || lower.includes('mono')) return fontCourier;
    return fontHelvetica;
  };

  const defaultW = content.pageSize?.width || 794;
  const defaultH = content.pageSize?.height || 1123;
  const scale = 72 / 96;
  const pageCount = Math.max(1, content.pageCount || 1);

  const pages = [];
  const pageHeights: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    const pageW = content.pageSizes?.[i]?.width || defaultW;
    const pageH = content.pageSizes?.[i]?.height || defaultH;
    const targetWidth = (pageW / 96) * 72;
    const targetHeight = (pageH / 96) * 72;
    pageHeights.push(targetHeight);
    const page = pdfDoc.addPage([targetWidth, targetHeight]);
    if (content.pageBackgrounds && content.pageBackgrounds[i] && content.pageBackgrounds[i] !== '#ffffff') {
      const bg = parseHexColor(content.pageBackgrounds[i]);
      page.drawRectangle({
        color: rgb(bg.r, bg.g, bg.b),
        height: targetHeight,
        width: targetWidth,
        x: 0,
        y: 0,
      });
    }

    const pageSource = content.pagePdfSources?.[i];
    if (pageSource && pageSource.pdfUrl) {
      try {
        const sourceBytes = readPublicAsset(pageSource.pdfUrl);
        if (sourceBytes) {
          const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
          const sourcePageIdx = Math.max(0, (pageSource.pageNumber || 1) - 1);
          if (sourcePageIdx < sourceDoc.getPageCount()) {
            const [embeddedPage] = await pdfDoc.embedPdf(sourceDoc, [sourcePageIdx]);
            page.drawPage(embeddedPage, {
              height: targetHeight,
              width: targetWidth,
              x: 0,
              y: 0,
            });
          }
        }
      } catch (pageErr) {
        logger.app.warn('Error al incrustar página de PDF de fondo en renderCollaborativePdf', pageErr);
      }
    }

    pages.push(page);
  }

  for (const el of content.elements || []) {
    const pageIndex = el.pageIndex ?? 0;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const targetHeight = pageHeights[pageIndex] || (defaultH / 96) * 72;

    if (el.type === 'text') {
      const clean = cleanTextForWinAnsi(el.text || '');
      const scaledW = (el.width || 140) * scale;
      const scaledH = (el.height || 140) * scale;
      const scaledX = el.x * scale;
      const scaledY = el.y * scale;

      if (el.isStickyNote && el.backgroundColor) {
        const bg = parseHexColor(el.backgroundColor);
        page.drawRectangle({
          color: rgb(bg.r, bg.g, bg.b),
          height: scaledH,
          width: scaledW,
          x: scaledX,
          y: targetHeight - scaledY - scaledH,
        });
      }
      if (!clean.trim()) continue;
      const { r, g, b } = parseHexColor(el.color || '#000000');
      const font = resolveFont(el.fontFamily, el.isBold);
      const fontSize = Math.max(6, (el.fontSize || 16) * scale);
      const pdfX = Math.max(0, el.isStickyNote ? scaledX + 8 * scale : scaledX);
      const pdfY = Math.max(0, targetHeight - scaledY - (el.isStickyNote ? 24 * scale : fontSize));
      page.drawText(clean, {
        color: rgb(r, g, b),
        font,
        size: fontSize,
        x: pdfX,
        y: pdfY,
      });
    } else if (el.type === 'shape') {
      const stroke = parseHexColor(el.strokeColor || '#000000');
      const strokeRgb = rgb(stroke.r, stroke.g, stroke.b);
      let fillRgb = undefined;
      if (el.fillColor && el.fillColor !== 'transparent') {
        const fill = parseHexColor(el.fillColor);
        fillRgb = rgb(fill.r, fill.g, fill.b);
      }
      const borderWidth = (el.strokeWidth || 0) * scale;
      const scaledX = el.x * scale;
      const scaledY = el.y * scale;
      const scaledW = Math.max(2, (el.width || 50) * scale);
      const scaledH = Math.max(2, (el.height || 50) * scale);

      if (el.shapeType === 'rect') {
        const pdfY = targetHeight - scaledY - scaledH;
        page.drawRectangle({
          borderColor: el.strokeWidth ? strokeRgb : undefined,
          borderWidth,
          color: fillRgb,
          height: scaledH,
          width: scaledW,
          x: scaledX,
          y: pdfY,
        });
      } else if (el.shapeType === 'circle') {
        const radiusX = Math.abs(scaledW / 2);
        const radiusY = Math.abs(scaledH / 2);
        const centerX = scaledX + radiusX;
        const centerY = targetHeight - scaledY - radiusY;
        page.drawEllipse({
          borderColor: el.strokeWidth ? strokeRgb : undefined,
          borderWidth,
          color: fillRgb,
          x: centerX,
          xScale: radiusX,
          y: centerY,
          yScale: radiusY,
        });
      } else if (el.shapeType === 'line' || el.shapeType === 'line-flexible' || el.shapeType === 'line-multiconnect') {
        const x2 = (el.x2 !== undefined ? el.x2 : el.x + (el.width || 50)) * scale;
        const y2 = (el.y2 !== undefined ? el.y2 : el.y + (el.height || 0)) * scale;
        page.drawLine({
          color: strokeRgb,
          end: { x: x2, y: targetHeight - y2 },
          start: { x: scaledX, y: targetHeight - scaledY },
          thickness: Math.max(1, (el.strokeWidth || 2) * scale),
        });
      } else {
        const pdfY = targetHeight - scaledY - scaledH;
        page.drawRectangle({
          borderColor: el.strokeWidth ? strokeRgb : undefined,
          borderWidth,
          color: fillRgb,
          height: scaledH,
          width: scaledW,
          x: scaledX,
          y: pdfY,
        });
      }
    } else if (el.type === 'drawing' && Array.isArray(el.points) && el.points.length > 1) {
      const stroke = parseHexColor(el.color || '#000000');
      const strokeRgb = rgb(stroke.r, stroke.g, stroke.b);
      const thickness = Math.max(1, (el.width || 2) * scale);
      for (let p = 0; p < el.points.length - 1; p++) {
        const p1 = el.points[p];
        const p2 = el.points[p + 1];
        page.drawLine({
          color: strokeRgb,
          end: { x: p2.x * scale, y: targetHeight - p2.y * scale },
          start: { x: p1.x * scale, y: targetHeight - p1.y * scale },
          thickness,
        });
      }
    } else if (el.type === 'image' && el.url) {
      try {
        let imgBytes: Buffer | null = null;
        if (el.url.startsWith('data:')) {
          const parts = el.url.split(',');
          if (parts[1]) imgBytes = Buffer.from(parts[1], 'base64');
        } else {
          imgBytes = readPublicAsset(el.url);
        }
        if (imgBytes) {
          let embeddedImg: any = null;
          const lowerUrl = el.url.toLowerCase();
          if (lowerUrl.includes('png') || el.url.startsWith('data:image/png')) {
            try {
              embeddedImg = await pdfDoc.embedPng(imgBytes);
            } catch {
              try {
                embeddedImg = await pdfDoc.embedJpg(imgBytes);
              } catch {}
            }
          } else {
            try {
              embeddedImg = await pdfDoc.embedJpg(imgBytes);
            } catch {
              try {
                embeddedImg = await pdfDoc.embedPng(imgBytes);
              } catch {}
            }
          }
          if (embeddedImg) {
            const scaledW = (el.width || 200) * scale;
            const scaledH = (el.height || 150) * scale;
            const scaledX = el.x * scale;
            const scaledY = el.y * scale;
            page.drawImage(embeddedImg, {
              height: scaledH,
              width: scaledW,
              x: scaledX,
              y: targetHeight - scaledY - scaledH,
            });
          }
        }
      } catch (imgErr) {
        logger.app.warn('Error al incrustar imagen en renderCollaborativePdf', imgErr);
      }
    } else if (el.type === 'table' && Array.isArray(el.cells) && el.rows > 0 && el.cols > 0) {
      const spacing = (el.cellSpacing || 0) * scale;
      const cellPad = (el.cellPadding || 8) * scale;
      const borderWidth = (el.borderWidth || 0) * scale;
      const bColor = parseHexColor(el.borderColor || '#4b5563');
      const borderRgb = rgb(bColor.r, bColor.g, bColor.b);
      const startX = el.x * scale;
      const colW = ((el.width * scale) - spacing * (el.cols + 1)) / el.cols;
      let curY = el.y * scale + spacing;

      for (let r = 0; r < el.rows; r++) {
        const rowH = (el.rowHeights?.[r] || 40) * scale;
        for (let c = 0; c < el.cols; c++) {
          const cell = el.cells[r]?.[c];
          const cellX = startX + spacing + c * (colW + spacing);
          const cellY = targetHeight - curY - rowH;
          const bgHex = cell?.backgroundColor || (r === 0 ? el.headerColor : undefined);
          let cellFillRgb = undefined;
          if (bgHex && bgHex !== 'transparent') {
            const fill = parseHexColor(bgHex);
            cellFillRgb = rgb(fill.r, fill.g, fill.b);
          }
          page.drawRectangle({
            borderColor: borderWidth > 0 ? borderRgb : undefined,
            borderWidth: borderWidth > 0 ? borderWidth : 0,
            color: cellFillRgb,
            height: rowH,
            width: colW,
            x: cellX,
            y: cellY,
          });

          const text = cleanTextForWinAnsi(cell?.text || '');
          if (text) {
            const isHead = r === 0;
            const font = resolveFont('Helvetica', isHead || cell?.isBold);
            const fontSize = Math.max(6, 12 * scale);
            const txtHex = cell?.color || (isHead && el.tableStyle !== 'grid' ? '#ffffff' : '#1e293b');
            const txtColor = parseHexColor(txtHex);
            page.drawText(text, {
              color: rgb(txtColor.r, txtColor.g, txtColor.b),
              font,
              size: fontSize,
              x: cellX + cellPad,
              y: cellY + rowH / 2 - fontSize / 3,
            });
          }
        }
        curY += rowH + spacing;
      }
    } else if (el.type === 'chart') {
      const startX = el.x * scale;
      const startY = targetHeight - (el.y * scale) - (el.height * scale);
      const chartW = el.width * scale;
      const chartH = el.height * scale;

      const title = cleanTextForWinAnsi(el.options?.title || '');
      if (title) {
        const titleFont = resolveFont('Helvetica', true);
        const titleSize = Math.max(8, 14 * scale);
        page.drawText(title, {
          color: rgb(0.12, 0.16, 0.23),
          font: titleFont,
          size: titleSize,
          x: startX + 10 * scale,
          y: startY + chartH - 20 * scale,
        });
      }

      const numCats = Math.max(1, el.labels?.length || 1);
      const s0 = el.series?.[0];
      if (s0 && Array.isArray(s0.values)) {
        const slotW = (chartW - 40 * scale) / numCats;
        const maxVal = Math.max(1, ...s0.values.map(Number));
        const plotBottom = startY + 24 * scale;
        const plotHeight = chartH - 54 * scale;

        s0.values.forEach((v, idx) => {
          const num = Number(v) || 0;
          const barH = Math.max(2, (num / maxVal) * plotHeight);
          const barW = Math.min(36 * scale, slotW * 0.6);
          const bx = startX + 24 * scale + idx * slotW + (slotW - barW) / 2;
          const by = plotBottom;

          const col = parseHexColor(s0.color || '#3b82f6');
          page.drawRectangle({
            color: rgb(col.r, col.g, col.b),
            height: barH,
            width: barW,
            x: bx,
            y: by,
          });

          const lbl = cleanTextForWinAnsi(el.labels?.[idx] || '');
          if (lbl) {
            const font = resolveFont('Helvetica', false);
            const size = Math.max(6, 9 * scale);
            page.drawText(lbl, {
              color: rgb(0.39, 0.45, 0.55),
              font,
              size,
              x: bx + barW / 2 - (lbl.length * size) / 4,
              y: by - 14 * scale,
            });
          }
        });
      }
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

async function listCollaborativeDocuments(
  userId?: number | null,
  folderId?: string | null | 'all'
): Promise<CollaborativeDocumentRecord[]> {
  if (!userId) {
    return [];
  }
  try {
    const pool = getDbPool();
    let query = `
      SELECT DISTINCT cd.id, cd.user_id, cd.folder_id, cd.title, cd.content_json, cd.pdf_filename, cd.page_count, cd.access_level, cd.created_at, cd.updated_at
      FROM collaborative_documents cd
      LEFT JOIN collaborative_document_members cdm ON cdm.document_id = cd.id
      WHERE (cd.user_id = ? OR cdm.user_id = ?)
    `;
    const params: any[] = [userId, userId];

    if (folderId === null || folderId === '') {
      query += ' AND cd.folder_id IS NULL';
    } else if (folderId && folderId !== 'all') {
      query += ' AND cd.folder_id = ?';
      params.push(folderId);
    }

    query += ' ORDER BY cd.updated_at DESC';
    const [rows] = await pool.query<any[]>(query, params);
    if (Array.isArray(rows)) {
      return rows.map((r) => ({
        access_level: r.access_level || 'restricted',
        content: typeof r.content_json === 'string' ? JSON.parse(r.content_json) : r.content_json,
        created_at: new Date(r.created_at).toISOString(),
        folder_id: r.folder_id || null,
        id: r.id,
        page_count: r.page_count,
        pdf_filename: r.pdf_filename,
        title: r.title,
        updated_at: new Date(r.updated_at).toISOString(),
        user_id: r.user_id,
      }));
    }
  } catch (err) {
    logger.db.warn('No se pudieron obtener documentos colaborativos de MySQL', err);
  }
  return [];
}

async function getCollaborativeDocument(
  id: string
): Promise<CollaborativeDocumentRecord | null> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(
      'SELECT id, user_id, folder_id, title, content_json, pdf_filename, page_count, access_level, created_at, updated_at FROM collaborative_documents WHERE id = ? LIMIT 1',
      [id]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const r = rows[0];
      const members = await getCollaborativeDocMembers(id);
      return {
        access_level: r.access_level || 'restricted',
        content: typeof r.content_json === 'string' ? JSON.parse(r.content_json) : r.content_json,
        created_at: new Date(r.created_at).toISOString(),
        folder_id: r.folder_id || null,
        id: r.id,
        members,
        page_count: r.page_count,
        pdf_filename: r.pdf_filename,
        title: r.title,
        updated_at: new Date(r.updated_at).toISOString(),
        user_id: r.user_id,
      };
    }
  } catch (err) {
    logger.db.warn('No se pudo leer documento colaborativo de MySQL', err);
  }
  return null;
}

async function saveCollaborativeDocument(payload: {
  accessLevel?: 'anyone_with_link' | 'restricted';
  content: CollaborativeDocumentContent;
  folderId?: string | null;
  id: string;
  title: string;
  userId?: number | null;
}): Promise<CollaborativeDocumentRecord> {
  const title = (payload.title || 'Documento sin título').trim();
  const pageCount = Math.max(1, payload.content.pageCount || 1);
  const pdfFilename = `${payload.id}.pdf`;
  const now = new Date().toISOString();

  let existingUserId = payload.userId ?? null;
  let existingAccess: 'anyone_with_link' | 'restricted' = payload.accessLevel || 'restricted';
  let existingFolderId: string | null = payload.folderId !== undefined ? (payload.folderId || null) : null;

  try {
    const pool = getDbPool();
    const [existingRows] = await pool.query<any[]>(
      'SELECT user_id, access_level, folder_id FROM collaborative_documents WHERE id = ? LIMIT 1',
      [payload.id]
    );
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      const prev = existingRows[0];
      if (!payload.accessLevel && prev.access_level) existingAccess = prev.access_level;
      if (existingUserId === null && prev.user_id) existingUserId = prev.user_id;
      if (payload.folderId === undefined && prev.folder_id) existingFolderId = prev.folder_id;
    }

    await pool.query(
      `INSERT INTO collaborative_documents (id, user_id, folder_id, title, content_json, pdf_filename, page_count, access_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE title = VALUES(title), content_json = VALUES(content_json), page_count = VALUES(page_count), folder_id = COALESCE(VALUES(folder_id), folder_id), updated_at = NOW()`,
      [payload.id, existingUserId, existingFolderId, title, JSON.stringify(payload.content), pdfFilename, pageCount, existingAccess]
    );
  } catch (err) {
    logger.db.warn('Error al guardar documento colaborativo en MySQL', err);
  }

  if (existingUserId) {
    const jsonBytes = Buffer.byteLength(JSON.stringify(payload.content), 'utf-8');
    void syncDocumentStorage(payload.id, Number(existingUserId), jsonBytes, 0);
  }

  const members = await getCollaborativeDocMembers(payload.id);
  return {
    access_level: existingAccess,
    content: payload.content,
    created_at: now,
    folder_id: existingFolderId,
    id: payload.id,
    members,
    page_count: pageCount,
    pdf_filename: pdfFilename,
    title,
    updated_at: now,
    user_id: existingUserId,
  };
}

async function deleteCollaborativeDocument(id: string, userId?: number | null): Promise<boolean> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(
      'SELECT user_id FROM collaborative_documents WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows || rows.length === 0) {
      return false;
    }
    const docUserId = rows[0].user_id;
    if (userId && docUserId !== null && docUserId !== undefined && Number(docUserId) !== Number(userId)) {
      const [memberRows] = await pool.query<any[]>(
        'SELECT role FROM collaborative_document_members WHERE document_id = ? AND user_id = ? LIMIT 1',
        [id, userId]
      );
      const isOwnerMember = memberRows && memberRows.length > 0 && memberRows[0].role === 'owner';
      if (!isOwnerMember) {
        return false;
      }
    }
    await pool.query('DELETE FROM collaborative_document_members WHERE document_id = ?', [id]);
    await pool.query('DELETE FROM collaborative_documents WHERE id = ?', [id]);
  } catch (err) {
    logger.db.warn('Error al eliminar documento colaborativo de MySQL', err);
    return false;
  }

  await reclaimDocumentStorage(id, userId);
  return true;
}

async function getCollaborativeDocMembers(docId: string): Promise<CollaborativeMember[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(
      `SELECT m.id, m.user_id, m.role, m.created_at, u.username, u.email, u.avatar_url
       FROM collaborative_document_members m
       JOIN users u ON m.user_id = u.id
       WHERE m.document_id = ?
       ORDER BY m.created_at ASC`,
      [docId]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        avatar_url: r.avatar_url || null,
        created_at: new Date(r.created_at).toISOString(),
        email: r.email || '',
        id: r.id,
        role: r.role || 'editor',
        user_id: r.user_id,
        username: r.username || '',
      }));
    }
  } catch (err) {
    logger.db.warn('No se pudieron leer miembros de MySQL', err);
  }
  return [];
}

async function addCollaborativeDocMember(
  docId: string,
  targetUserId: number,
  role: 'editor' | 'viewer' = 'editor',
  _requestingUserId?: number | null
): Promise<CollaborativeMember | null> {
  let userRecord: { avatar_url: string | null; email: string; id: number; username: string } | null = null;
  try {
    const pool = getDbPool();
    const [userRows] = await pool.query<any[]>('SELECT id, username, email, avatar_url FROM users WHERE id = ? LIMIT 1', [targetUserId]);
    if (Array.isArray(userRows) && userRows.length > 0) {
      userRecord = userRows[0];
      await pool.query(
        `INSERT INTO collaborative_document_members (document_id, user_id, role, created_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE role = VALUES(role)`,
        [docId, targetUserId, role]
      );
    }
  } catch (err) {
    logger.db.warn('Error al guardar miembro en MySQL', err);
    return null;
  }

  return {
    avatar_url: userRecord?.avatar_url || null,
    created_at: new Date().toISOString(),
    email: userRecord?.email || '',
    role,
    user_id: targetUserId,
    username: userRecord?.username || `Usuario ${targetUserId}`,
  };
}

async function removeCollaborativeDocMember(
  docId: string,
  targetUserId: number,
  _requestingUserId?: number | null
): Promise<boolean> {
  try {
    const pool = getDbPool();
    await pool.query('DELETE FROM collaborative_document_members WHERE document_id = ? AND user_id = ?', [docId, targetUserId]);
    return true;
  } catch (err) {
    logger.db.warn('Error al eliminar miembro en MySQL', err);
    return false;
  }
}

async function updateCollaborativeDocAccessLevel(
  docId: string,
  accessLevel: 'anyone_with_link' | 'restricted',
  _requestingUserId?: number | null
): Promise<boolean> {
  try {
    const pool = getDbPool();
    await pool.query('UPDATE collaborative_documents SET access_level = ?, updated_at = NOW() WHERE id = ?', [accessLevel, docId]);
    return true;
  } catch (err) {
    logger.db.warn('Error al actualizar nivel de acceso en MySQL', err);
    return false;
  }
}

async function searchRegisteredUsers(
  query: string,
  excludeDocId?: string
): Promise<Array<{ avatar_url: string | null; email: string; id: number; username: string }>> {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(
      `SELECT id, username, email, avatar_url
       FROM users
       WHERE (LOWER(username) LIKE ? OR LOWER(email) LIKE ?)
       LIMIT 10`,
      [`%${cleanQ}%`, `%${cleanQ}%`]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      let filtered = rows;
      if (excludeDocId) {
        const members = await getCollaborativeDocMembers(excludeDocId);
        const memberIds = new Set(members.map((m) => m.user_id));
        filtered = rows.filter((r) => !memberIds.has(r.id));
      }
      return filtered.map((r) => ({
        avatar_url: r.avatar_url || null,
        email: r.email || '',
        id: r.id,
        username: r.username || '',
      }));
    }
  } catch (err) {
    logger.db.warn('No se pudo buscar usuarios en MySQL', err);
  }

  return [];
}

async function getRenderedPdfBuffer(id: string): Promise<Buffer | null> {
  const doc = await getCollaborativeDocument(id);
  if (!doc) return null;
  try {
    return await renderCollaborativePdf(doc.title, doc.content);
  } catch (err) {
    logger.app.error('Error al renderizar PDF bajo demanda para descarga', err);
    return null;
  }
}

async function getRenderedPdfPath(_id: string): Promise<string | null> {
  return null;
}

export { addCollaborativeDocMember, deleteCollaborativeDocument, getCollaborativeDocMembers, getCollaborativeDocument, getRenderedPdfBuffer, getRenderedPdfPath, listCollaborativeDocuments, removeCollaborativeDocMember, renderCollaborativePdf, saveCollaborativeDocument, searchRegisteredUsers, updateCollaborativeDocAccessLevel };
