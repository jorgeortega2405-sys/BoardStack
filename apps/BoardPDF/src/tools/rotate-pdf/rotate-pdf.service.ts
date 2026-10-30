import { logger } from '../../services/logger.service.js';
import { storeTempFile } from '../../services/temp-storage.service.js';
import { sanitizePdfFilename } from '../../utils/pdf.util.js';
import { RotatePdfOptions, RotatePdfResponse, StoredRotatePdfResult } from './rotate-pdf.types.js';
import crypto from 'crypto';
import { degrees, PDFDocument } from 'pdf-lib';

export async function rotatePdf(
  fileBuffer: Buffer,
  originalFilename: string,
  options: RotatePdfOptions
): Promise<RotatePdfResponse> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  } catch (err) {
    logger.app.error(`Error al cargar PDF para rotar: ${originalFilename}`, err);
    throw new Error('El archivo seleccionado no es un documento PDF válido o está protegido contra lectura.');
  }

  const totalPages = doc.getPageCount();
  if (totalPages === 0) {
    throw new Error('El documento no contiene páginas válidas.');
  }

  const pagesMap = new Map<number, number>();
  if (Array.isArray(options.pages)) {
    for (const item of options.pages) {
      if (typeof item.pageIndex === 'number' && item.pageIndex >= 0 && item.pageIndex < totalPages) {
        pagesMap.set(item.pageIndex, item.rotation || 0);
      }
    }
  }

  const globalRot = typeof options.globalRotation === 'number' ? options.globalRotation : 0;

  for (let i = 0; i < totalPages; i++) {
    const page = doc.getPage(i);
    const pageSpecificRot = pagesMap.get(i) || 0;
    const additionalRot = ((pageSpecificRot + globalRot) % 360 + 360) % 360;

    if (additionalRot !== 0) {
      const currentAngle = page.getRotation().angle;
      page.setRotation(degrees((currentAngle + additionalRot) % 360));
    }
  }

  const savedBytes = await doc.save();
  const finalBuffer = Buffer.from(savedBytes);
  const fileId = crypto.randomUUID();
  const filename = sanitizePdfFilename(options.filename, `${originalFilename.replace(/\.pdf$/i, '')}_rotado.pdf`);

  const storedItem: StoredRotatePdfResult = {
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
