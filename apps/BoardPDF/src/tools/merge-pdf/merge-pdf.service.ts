import { logger } from '../../services/logger.service.js';
import { storeTempFile } from '../../services/temp-storage.service.js';
import { sanitizePdfFilename } from '../../utils/pdf.util.js';
import { MergePdfResponse, StoredMergedPdf } from './merge-pdf.types.js';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';

export async function mergePdfFiles(
  files: Array<{ buffer: Buffer; originalname: string }>,
  customFilename?: string
): Promise<MergePdfResponse> {
  const mergedDoc = await PDFDocument.create();
  let totalPages = 0;

  for (const file of files) {
    try {
      const srcDoc = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
      const indices = srcDoc.getPageIndices();
      const copiedPages = await mergedDoc.copyPages(srcDoc, indices);
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
      totalPages += indices.length;
    } catch (loadError) {
      logger.app.error(`Error al procesar archivo PDF "${file.originalname}"`, loadError);
      throw new Error(`El archivo "${file.originalname}" no es un documento PDF válido o está protegido.`);
    }
  }

  const mergedBytes = await mergedDoc.save();
  const fileBuffer = Buffer.from(mergedBytes);
  const fileId = crypto.randomUUID();
  const filename = sanitizePdfFilename(customFilename, 'documento_unido.pdf');

  const storedItem: StoredMergedPdf = {
    buffer: fileBuffer,
    contentType: 'application/pdf',
    createdAt: Date.now(),
    filename,
    id: fileId,
    pageCount: totalPages,
    size: fileBuffer.length,
  };

  const tokenResult = await storeTempFile(fileId, storedItem);

  return {
    downloadUrl: tokenResult.downloadUrl,
    fileId: tokenResult.fullToken,
    filename,
    fileSize: fileBuffer.length,
    pageCount: totalPages,
  };
}
