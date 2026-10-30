import { logger } from '../../services/logger.service.js';
import { getTempFile, storeTempFile } from '../../services/temp-storage.service.js';
import { sanitizePdfFilename } from '../../utils/pdf.util.js';
import { executeProcessWithTimeout, findPythonWorkerScript, getPythonCommand } from '../../utils/process.util.js';
import { PageRedaction, RedactPdfParams, RedactPdfResponse, StoredRedactedPdf } from './redact-pdf.types.js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { PDFArray, PDFDocument, PDFName, PDFRawStream, PDFStream, rgb } from 'pdf-lib';


async function runPythonRedactWorker(
  inputPath: string,
  outputPath: string,
  spec: any,
  sanitizeMeta: boolean
): Promise<{ ok: boolean; redactedBoxesCount?: number; redactedPagesCount?: number }> {
  try {
    const pythonCmd = await getPythonCommand();
    const scriptPath = findPythonWorkerScript('redact_worker.py', 'redact-pdf');
    const specJson = JSON.stringify(spec);
    const result = await executeProcessWithTimeout(
      pythonCmd,
      [scriptPath, inputPath, outputPath, specJson, sanitizeMeta ? '1' : '0'],
      { timeoutMs: 60000 }
    );

    if (result.code === 0 && fs.existsSync(outputPath)) {
      const stats = await fs.promises.stat(outputPath);
      if (stats.size > 0) {
        try {
          const parsed = JSON.parse(result.stdout.trim().split('\n').pop() || '{}');
          return {
            ok: true,
            redactedBoxesCount: parsed.redactedBoxesCount,
            redactedPagesCount: parsed.redactedPagesCount,
          };
        } catch {
          return { ok: true };
        }
      }
    }
  } catch (err) {
    logger.app.warn('Fallo ejecutando redact_worker.py local', { error: err });
  }
  return { ok: false };
}

function purgeTextFromPageStreams(pdfDoc: PDFDocument, page: any, targetTexts: string[]): void {
  if (targetTexts.length === 0) return;
  try {
    const contents = page.node.Contents();
    if (!contents) return;

    const streams: any[] = [];
    if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i++) {
        const item = pdfDoc.context.lookup(contents.get(i));
        if (item instanceof PDFStream || item instanceof PDFRawStream) {
          streams.push(item);
        }
      }
    } else {
      const item = pdfDoc.context.lookup(contents);
      if (item instanceof PDFStream || item instanceof PDFRawStream) {
        streams.push(item);
      }
    }

    for (const stream of streams) {
      const rawBytes = stream.getContents();
      if (!rawBytes || rawBytes.length === 0) continue;

      let isCompressed = false;
      let textStream: string;

      try {
        const decompressed = zlib.inflateSync(rawBytes);
        textStream = decompressed.toString('latin1');
        isCompressed = true;
      } catch {
        textStream = Buffer.from(rawBytes).toString('latin1');
      }

      let modified = false;
      for (const text of targetTexts) {
        if (!text || text.length < 2) continue;
        if (textStream.includes(text)) {
          const replacement = ' '.repeat(text.length);
          textStream = textStream.split(text).join(replacement);
          modified = true;
        }
        const hex = Buffer.from(text, 'utf-8').toString('hex').toUpperCase();
        if (textStream.toUpperCase().includes(hex)) {
          const blankHex = '20'.repeat(text.length);
          const regex = new RegExp(hex, 'gi');
          textStream = textStream.replace(regex, blankHex);
          modified = true;
        }
      }

      if (modified) {
        const newBytes = Buffer.from(textStream, 'latin1');
        stream.contents = isCompressed ? zlib.deflateSync(newBytes) : newBytes;
      }
    }
  } catch (err) {
    logger.app.warn('Advertencia al sanitizar stream de texto en censura', { error: err });
  }
}

export async function getStoredRedactedPdf(fileId: string): Promise<StoredRedactedPdf | null> {
  return getTempFile<StoredRedactedPdf>(fileId);
}

export async function redactPdfDocument(params: RedactPdfParams): Promise<RedactPdfResponse> {
  const { buffer, originalFilename, redactions, sanitizeMetadata = true } = params;

  if (!buffer || buffer.length === 0) {
    throw new Error('EMPTY_PDF_BUFFER');
  }

  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  let redactedBoxesCount = 0;
  let redactedPagesCount = 0;

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf_rdct_'));
  const inputTempPath = path.join(tempDir, 'source.pdf');
  const outputTempPath = path.join(tempDir, 'redacted.pdf');

  await fs.promises.writeFile(inputTempPath, buffer);

  const formattedPageRedactions: any[] = [];
  if (Array.isArray(redactions)) {
    for (const item of redactions) {
      const pageIdx = typeof item.pageIndex === 'number'
        ? item.pageIndex
        : typeof (item as any).pageNumber === 'number'
          ? (item as any).pageNumber - 1
          : (typeof (item as any).page === 'number' ? (item as any).page - 1 : 0);

      const targetPage = pages[pageIdx];
      const pageHeight = targetPage ? targetPage.getHeight() : 842;

      const rects: any[] = [];
      const texts: string[] = [];

      const boxes = Array.isArray(item.boxes) && item.boxes.length > 0
        ? item.boxes
        : ((item as any).width && (item as any).height ? [{ height: (item as any).height, text: (item as any).text, width: (item as any).width, x: (item as any).x, y: (item as any).y }] : []);

      for (const b of boxes) {
        const bx = Number(b.x) || 0;
        const by = Number(b.y) || 0;
        const bw = Number(b.width) || 0;
        const bh = Number(b.height) || 0;
        const pyY0 = Math.max(0, pageHeight - by - bh);
        const pyY1 = pyY0 + bh;
        rects.push([bx, pyY0, bx + bw, pyY1]);
        if (b.text?.trim()) texts.push(b.text.trim());
      }

      formattedPageRedactions.push({
        fullPage: Boolean(item.fullPage),
        pageIndex: pageIdx,
        rects,
        texts,
      });
    }
  }

  let finalBuffer: Buffer | null = null;

  try {
    const pyRes = await runPythonRedactWorker(
      inputTempPath,
      outputTempPath,
      { pageRedactions: formattedPageRedactions },
      sanitizeMetadata
    );

    if (pyRes.ok) {
      try {
        finalBuffer = await fs.promises.readFile(outputTempPath);
        redactedBoxesCount = pyRes.redactedBoxesCount || redactedBoxesCount;
        redactedPagesCount = pyRes.redactedPagesCount || redactedPagesCount;
      } catch {}
    }
  } finally {
    try {
      await fs.promises.rm(tempDir, { force: true, recursive: true });
    } catch {}
  }

  if (!finalBuffer) {
    if (Array.isArray(redactions)) {
      for (const item of redactions) {
        const pageIdx = typeof item.pageIndex === 'number'
          ? item.pageIndex
          : typeof (item as any).pageNumber === 'number'
            ? (item as any).pageNumber - 1
            : (typeof (item as any).page === 'number' ? (item as any).page - 1 : -1);

        if (pageIdx < 0 || pageIdx >= totalPages) continue;

        const page = pages[pageIdx];
        if (!page) continue;

        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        if (item.fullPage) {
          page.node.delete(PDFName.of('Contents'));
          page.node.delete(PDFName.of('Annots'));

          page.drawRectangle({
            color: rgb(0, 0, 0),
            height: pageHeight,
            opacity: 1,
            width: pageWidth,
            x: 0,
            y: 0,
          });

          redactedPagesCount++;
          continue;
        }

        let pageHadRedaction = false;
        const boxes = Array.isArray(item.boxes) && item.boxes.length > 0
          ? item.boxes
          : ((item as any).width && (item as any).height ? [{ height: (item as any).height, text: (item as any).text, width: (item as any).width, x: (item as any).x, y: (item as any).y }] : []);

        if (boxes.length > 0) {
          const textsToPurge: string[] = [];

          for (const box of boxes) {
            const boxX = Number(box.x) || 0;
            const boxY = Number(box.y) || 0;
            const boxW = Number(box.width) || 0;
            const boxH = Number(box.height) || 0;

            if (boxW <= 0 || boxH <= 0) continue;

            const pdfX = Math.max(0, boxX);
            const pdfY = Math.max(0, pageHeight - boxY - boxH);
            const pdfW = Math.min(pageWidth - pdfX, boxW);
            const pdfH = Math.min(pageHeight - pdfY, boxH);

            if (pdfW > 0 && pdfH > 0) {
              page.drawRectangle({
                color: rgb(0, 0, 0),
                height: pdfH,
                opacity: 1,
                width: pdfW,
                x: pdfX,
                y: pdfY,
              });

              redactedBoxesCount++;
              pageHadRedaction = true;

              if (box.text && typeof box.text === 'string' && box.text.trim().length > 0) {
                textsToPurge.push(box.text.trim());
              }
            }
          }

          if (pageHadRedaction) {
            redactedPagesCount++;
          }

          if (textsToPurge.length > 0) {
            purgeTextFromPageStreams(pdfDoc, page, textsToPurge);
          }
        }
      }
    }

    if (sanitizeMetadata) {
      try {
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('BoardPDF Redaction Engine');
        pdfDoc.setCreator('BoardPDF');
      } catch (metaErr) {
        logger.app.warn('Error al sanitizar metadatos en documento PDF censurado', { error: metaErr });
      }
    }

    const outputBytes = await pdfDoc.save();
    finalBuffer = Buffer.from(outputBytes);
  }

  const outFilename = sanitizePdfFilename(originalFilename ? `${originalFilename.replace(/\.pdf$/i, '')}_censurado.pdf` : undefined, 'documento_censurado.pdf');
  const fileId = `redact_${Date.now()}_${randomUUID().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;

  const tokenResult = await storeTempFile(fileId, {
    buffer: finalBuffer,
    contentType: 'application/pdf',
    createdAt: Date.now(),
    fileId,
    filename: outFilename,
    fileSize: finalBuffer.length,
  });

  return {
    downloadUrl: tokenResult.downloadUrl,
    fileId: tokenResult.fullToken,
    fileSize: finalBuffer.length,
    filename: outFilename,
    redactedBoxesCount,
    redactedPagesCount,
    totalPages,
  };
}
