import { logger } from '../../services/logger.service.js';
import { storeTempFile } from '../../services/temp-storage.service.js';
import { sanitizePdfFilename } from '../../utils/pdf.util.js';
import { RemovePagesOptions, RemovePagesResponse, StoredRemovePagesResult } from './remove-pdf-pages.types.js';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';

export async function removePdfPages(
  fileBuffer: Buffer,
  originalFilename: string,
  options: RemovePagesOptions
): Promise<RemovePagesResponse> {
  let srcDoc: PDFDocument;
  try {
    srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  } catch (err) {
    logger.app.error(`Error al cargar documento PDF para eliminar páginas: ${originalFilename}`, err);
    throw new Error('El archivo seleccionado no es un documento PDF válido o está protegido contra lectura.');
  }

  const totalPages = srcDoc.getPageCount();
  if (totalPages <= 1) {
    throw new Error('El documento solo contiene 1 página y no se pueden eliminar páginas de él.');
  }

  const toRemoveSet = new Set(
    (options.pagesToRemove || [])
      .map((p) => Math.floor(p))
      .filter((p) => p >= 1 && p <= totalPages)
  );

  if (toRemoveSet.size === 0) {
    throw new Error('Debes seleccionar al menos una página válida para eliminar.');
  }

  if (toRemoveSet.size >= totalPages) {
    throw new Error('No puedes eliminar todas las páginas del documento. Debe quedar al menos una página.');
  }

  const remainingIndices: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (!toRemoveSet.has(i)) {
      remainingIndices.push(i - 1);
    }
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, remainingIndices);
  copiedPages.forEach((p) => newDoc.addPage(p));

  const savedBytes = await newDoc.save();
  const finalBuffer = Buffer.from(savedBytes);
  const fileId = crypto.randomUUID();
  const filename = sanitizePdfFilename(options.filename, `${originalFilename.replace(/\.pdf$/i, '')}_sin_paginas.pdf`);

  const storedItem: StoredRemovePagesResult = {
    buffer: finalBuffer,
    contentType: 'application/pdf',
    createdAt: Date.now(),
    filename,
    id: fileId,
    originalPages: totalPages,
    remainingPages: remainingIndices.length,
    removedPages: toRemoveSet.size,
    size: finalBuffer.length,
  };

  const tokenResult = await storeTempFile(fileId, storedItem);

  return {
    downloadUrl: tokenResult.downloadUrl,
    fileId: tokenResult.fullToken,
    filename,
    fileSize: finalBuffer.length,
    originalPages: totalPages,
    remainingPages: remainingIndices.length,
    removedPages: toRemoveSet.size,
  };
}
