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

  const pageWidth = content.pageSize?.width || 595.28;
  const pageHeight = content.pageSize?.height || 841.89;
  const pageCount = Math.max(1, content.pageCount || 1);

  const pages = [];
  for (let i = 0; i < pageCount; i++) {
    pages.push(pdfDoc.addPage([pageWidth, pageHeight]));
  }

  for (const el of content.elements || []) {
    const pageIndex = el.pageIndex ?? 0;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];

    if (el.type === 'text') {
      const clean = cleanTextForWinAnsi(el.text || '');
      if (!clean.trim()) continue;
      const { r, g, b } = parseHexColor(el.color || '#000000');
      const font = resolveFont(el.fontFamily, el.isBold);
      const fontSize = el.fontSize || 14;
      const pdfX = Math.max(0, el.x);
      const pdfY = Math.max(0, pageHeight - el.y - fontSize);
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
      const borderWidth = el.strokeWidth || 1;

      if (el.shapeType === 'rect') {
        const w = Math.max(1, el.width || 50);
        const h = Math.max(1, el.height || 50);
        const pdfY = pageHeight - el.y - h;
        page.drawRectangle({
          borderColor: strokeRgb,
          borderWidth,
          color: fillRgb,
          height: h,
          width: w,
          x: el.x,
          y: pdfY,
        });
      } else if (el.shapeType === 'circle') {
        const w = Math.max(1, el.width || 50);
        const h = Math.max(1, el.height || 50);
        const radiusX = Math.abs(w / 2);
        const radiusY = Math.abs(h / 2);
        const centerX = el.x + radiusX;
        const centerY = pageHeight - el.y - radiusY;
        page.drawEllipse({
          borderColor: strokeRgb,
          borderWidth,
          color: fillRgb,
          x: centerX,
          xScale: radiusX,
          y: centerY,
          yScale: radiusY,
        });
      } else if (el.shapeType === 'line') {
        const x2 = el.x2 !== undefined ? el.x2 : el.x + (el.width || 50);
        const y2 = el.y2 !== undefined ? el.y2 : el.y + (el.height || 0);
        page.drawLine({
          color: strokeRgb,
          end: { x: x2, y: pageHeight - y2 },
          start: { x: el.x, y: pageHeight - el.y },
          thickness: borderWidth,
        });
      }
    } else if (el.type === 'drawing' && Array.isArray(el.points) && el.points.length > 1) {
      const stroke = parseHexColor(el.color || '#000000');
      const strokeRgb = rgb(stroke.r, stroke.g, stroke.b);
      const thickness = el.width || 2;
      for (let p = 0; p < el.points.length - 1; p++) {
        const p1 = el.points[p];
        const p2 = el.points[p + 1];
        page.drawLine({
          color: strokeRgb,
          end: { x: p2.x, y: pageHeight - p2.y },
          start: { x: p1.x, y: pageHeight - p1.y },
          thickness,
        });
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
