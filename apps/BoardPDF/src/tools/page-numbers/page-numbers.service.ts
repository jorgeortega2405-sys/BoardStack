import { logger } from '../../services/logger.service.js';
import { storeTempFile } from '../../services/temp-storage.service.js';
import { cleanTextForWinAnsi, sanitizePdfFilename } from '../../utils/pdf.util.js';
import { PageNumberOptions, PageNumberPosition, PageNumberResponse, StoredPageNumberResult } from './page-numbers.types.js';
import crypto from 'crypto';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function resolveMargin(margin?: string): number {
  if (margin === 'small') return 18;
  if (margin === 'large') return 50;
  return 34;
}

function resolvePositionForPage(
  basePosition: PageNumberPosition,
  pageNumberOneBased: number,
  mode?: string
): PageNumberPosition {
  if (mode !== 'double') {
    return basePosition;
  }

  const isLeftPage = pageNumberOneBased % 2 === 0;

  if (basePosition === 'bottom-center' || basePosition === 'top-center') {
    return basePosition;
  }

  if (isLeftPage) {
    if (basePosition.startsWith('top')) return 'top-left';
    return 'bottom-left';
  } else {
    if (basePosition.startsWith('top')) return 'top-right';
    return 'bottom-right';
  }
}

export async function addPageNumbers(
  fileBuffer: Buffer,
  originalFilename: string,
  options: PageNumberOptions
): Promise<PageNumberResponse> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  } catch (err) {
    logger.app.error(`Error al cargar PDF para insertar números de página: ${originalFilename}`, err);
    throw new Error('El archivo seleccionado no es un documento PDF válido o está protegido contra lectura.');
  }

  const totalPages = doc.getPageCount();
  if (totalPages === 0) {
    throw new Error('El documento no contiene páginas válidas.');
  }

  let selectedStandardFont = StandardFonts.Helvetica;
  if (options.fontFamily === 'Helvetica-Bold') selectedStandardFont = StandardFonts.HelveticaBold;
  else if (options.fontFamily === 'Times-Roman') selectedStandardFont = StandardFonts.TimesRoman;
  else if (options.fontFamily === 'Courier') selectedStandardFont = StandardFonts.Courier;

  const font = await doc.embedFont(selectedStandardFont);
  const fontSize = Math.max(8, Math.min(24, options.fontSize || 10.5));
  const margin = resolveMargin(options.margin);
  const startNumber = typeof options.startNumber === 'number' ? options.startNumber : 1;
  const fromPage = Math.max(1, Math.min(totalPages, options.fromPage || 1));
  const toPage = Math.max(fromPage, Math.min(totalPages, options.toPage || totalPages));
  const firstPageIsCover = Boolean(options.firstPageIsCover);
  const basePosition = options.position || 'bottom-right';
  const formatTemplate = options.format || '{n}';

  let totalNumberedPages = toPage - fromPage + 1;
  if (firstPageIsCover && fromPage === 1) {
    totalNumberedPages = Math.max(1, totalNumberedPages - 1);
  }

  let currentSequence = 0;

  for (let i = fromPage - 1; i <= toPage - 1; i++) {
    const pageIndex = i;
    const pageNumOneBased = pageIndex + 1;

    if (firstPageIsCover && pageNumOneBased === 1) {
      continue;
    }

    const currentNumber = startNumber + currentSequence;
    currentSequence++;

    const rawText = formatTemplate
      .replace(/\{n\}/g, String(currentNumber))
      .replace(/\{p\}/g, String(totalNumberedPages));
    const text = cleanTextForWinAnsi(rawText) || String(currentNumber);

    const page = doc.getPage(pageIndex);
    const { height, width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    const position = resolvePositionForPage(basePosition, pageNumOneBased, options.mode);

    let x = 0;
    let y = 0;

    switch (position) {
      case 'bottom-left':
        x = margin;
        y = margin;
        break;
      case 'bottom-center':
        x = (width - textWidth) / 2;
        y = margin;
        break;
      case 'bottom-right':
        x = width - margin - textWidth;
        y = margin;
        break;
      case 'top-left':
        x = margin;
        y = height - margin - textHeight;
        break;
      case 'top-center':
        x = (width - textWidth) / 2;
        y = height - margin - textHeight;
        break;
      case 'top-right':
        x = width - margin - textWidth;
        y = height - margin - textHeight;
        break;
    }

    const rotation = page.getRotation().angle;
    if (rotation === 0) {
      page.drawText(text, {
        color: rgb(0.2, 0.2, 0.2),
        font,
        size: fontSize,
        x,
        y,
      });
    } else {
      page.drawText(text, {
        color: rgb(0.2, 0.2, 0.2),
        font,
        rotate: degrees(rotation),
        size: fontSize,
        x,
        y,
      });
    }
  }

  const savedBytes = await doc.save();
  const finalBuffer = Buffer.from(savedBytes);
  const fileId = crypto.randomUUID();
  const filename = sanitizePdfFilename(options.filename, `${originalFilename.replace(/\.pdf$/i, '')}_numerado.pdf`);

  const storedItem: StoredPageNumberResult = {
    buffer: finalBuffer,
    contentType: 'application/pdf',
    createdAt: Date.now(),
    filename,
    id: fileId,
    pagesCount: totalPages,
    size: finalBuffer.length,
  };

  const tokenResult = await storeTempFile(fileId, storedItem);

  return {
    downloadUrl: tokenResult.downloadUrl,
    fileId: tokenResult.fullToken,
    filename,
    fileSize: finalBuffer.length,
    totalPages,
  };
}
