import { getDbPool } from '../../config/database.config.js';
import { logger } from '../../services/logger.service.js';
import { cleanTextForWinAnsi, parseHexColor } from '../../utils/pdf.util.js';
import { CollaborativeDocumentContent, CollaborativeDocumentRecord } from './collaborative-pdf.types.js';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const STORAGE_DIR = path.resolve(process.cwd(), 'data', 'collaborative-docs');

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

export async function renderCollaborativePdf(
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

  const targetWidth = 595.28;
  const targetHeight = 841.89;
  const screenWidth = content.pageSize?.width || 794;
  const scale = targetWidth / screenWidth;
  const pageCount = Math.max(1, content.pageCount || 1);

  const pages = [];
  for (let i = 0; i < pageCount; i++) {
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
        const localRel = pageSource.pdfUrl.replace(/^\//, '');
        const localPath = path.resolve(process.cwd(), 'public', localRel);
        if (fs.existsSync(localPath)) {
          const sourceBytes = fs.readFileSync(localPath);
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
        const localRel = el.url.replace(/^\//, '');
        const localPath = path.resolve(process.cwd(), 'public', localRel);
        if (fs.existsSync(localPath)) {
          const imgBytes = fs.readFileSync(localPath);
          let embeddedImg: any = null;
          const lowerUrl = el.url.toLowerCase();
          if (lowerUrl.endsWith('.png')) {
            embeddedImg = await pdfDoc.embedPng(imgBytes);
          } else if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) {
            embeddedImg = await pdfDoc.embedJpg(imgBytes);
          } else {
            try {
              embeddedImg = await pdfDoc.embedPng(imgBytes);
            } catch {
              embeddedImg = await pdfDoc.embedJpg(imgBytes);
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
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function listCollaborativeDocuments(
  userId?: number | null
): Promise<CollaborativeDocumentRecord[]> {
  ensureStorageDir();
  try {
    const pool = getDbPool();
    const query = userId
      ? 'SELECT id, user_id, title, content_json, pdf_filename, page_count, created_at, updated_at FROM collaborative_documents WHERE user_id = ? OR user_id IS NULL ORDER BY updated_at DESC'
      : 'SELECT id, user_id, title, content_json, pdf_filename, page_count, created_at, updated_at FROM collaborative_documents ORDER BY updated_at DESC LIMIT 50';
    const params = userId ? [userId] : [];
    const [rows] = await pool.query<any[]>(query, params);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        content: typeof r.content_json === 'string' ? JSON.parse(r.content_json) : r.content_json,
        created_at: new Date(r.created_at).toISOString(),
        id: r.id,
        page_count: r.page_count,
        pdf_filename: r.pdf_filename,
        title: r.title,
        updated_at: new Date(r.updated_at).toISOString(),
        user_id: r.user_id,
      }));
    }
  } catch (err) {
    logger.db.warn('No se pudieron obtener documentos colaborativos de MySQL, leyendo respaldo local', err);
  }

  const files = fs.readdirSync(STORAGE_DIR);
  const docs: CollaborativeDocumentRecord[] = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const raw = fs.readFileSync(path.join(STORAGE_DIR, file), 'utf-8');
        docs.push(JSON.parse(raw));
      } catch {}
    }
  }
  return docs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function getCollaborativeDocument(
  id: string
): Promise<CollaborativeDocumentRecord | null> {
  ensureStorageDir();
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(
      'SELECT id, user_id, title, content_json, pdf_filename, page_count, created_at, updated_at FROM collaborative_documents WHERE id = ? LIMIT 1',
      [id]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const r = rows[0];
      return {
        content: typeof r.content_json === 'string' ? JSON.parse(r.content_json) : r.content_json,
        created_at: new Date(r.created_at).toISOString(),
        id: r.id,
        page_count: r.page_count,
        pdf_filename: r.pdf_filename,
        title: r.title,
        updated_at: new Date(r.updated_at).toISOString(),
        user_id: r.user_id,
      };
    }
  } catch (err) {
    logger.db.warn('No se pudo leer documento colaborativo de MySQL, intentando respaldo local', err);
  }

  const jsonPath = path.join(STORAGE_DIR, `${id}.json`);
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}

export async function saveCollaborativeDocument(payload: {
  content: CollaborativeDocumentContent;
  id: string;
  title: string;
  userId?: number | null;
}): Promise<CollaborativeDocumentRecord> {
  ensureStorageDir();
  const title = (payload.title || 'Documento sin título').trim();
  const pageCount = Math.max(1, payload.content.pageCount || 1);
  const pdfFilename = `${payload.id}.pdf`;
  const now = new Date().toISOString();

  const record: CollaborativeDocumentRecord = {
    content: payload.content,
    created_at: now,
    id: payload.id,
    page_count: pageCount,
    pdf_filename: pdfFilename,
    title,
    updated_at: now,
    user_id: payload.userId || null,
  };

  const pdfBuffer = await renderCollaborativePdf(title, payload.content);
  fs.writeFileSync(path.join(STORAGE_DIR, pdfFilename), pdfBuffer);
  fs.writeFileSync(path.join(STORAGE_DIR, `${payload.id}.json`), JSON.stringify(record, null, 2));

  try {
    const pool = getDbPool();
    await pool.query(
      `INSERT INTO collaborative_documents (id, user_id, title, content_json, pdf_filename, page_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE title = VALUES(title), content_json = VALUES(content_json), page_count = VALUES(page_count), updated_at = NOW()`,
      [payload.id, payload.userId || null, title, JSON.stringify(payload.content), pdfFilename, pageCount]
    );
  } catch (err) {
    logger.db.warn('No se pudo guardar documento colaborativo en MySQL, guardado en disco con éxito', err);
  }

  return record;
}

export async function deleteCollaborativeDocument(id: string): Promise<boolean> {
  ensureStorageDir();
  try {
    const pool = getDbPool();
    await pool.query('DELETE FROM collaborative_documents WHERE id = ?', [id]);
  } catch (err) {
    logger.db.warn('Error al eliminar documento colaborativo de MySQL', err);
  }

  const jsonPath = path.join(STORAGE_DIR, `${id}.json`);
  const pdfPath = path.join(STORAGE_DIR, `${id}.pdf`);
  if (fs.existsSync(jsonPath)) {
    try {
      fs.unlinkSync(jsonPath);
    } catch {}
  }
  if (fs.existsSync(pdfPath)) {
    try {
      fs.unlinkSync(pdfPath);
    } catch {}
  }
  return true;
}

export function getRenderedPdfPath(id: string): string | null {
  ensureStorageDir();
  const pdfPath = path.join(STORAGE_DIR, `${id}.pdf`);
  if (fs.existsSync(pdfPath)) {
    return pdfPath;
  }
  return null;
}
