import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { logger } from '../../services/logger.service.js';
import { getTempFile, storeTempFile } from '../../services/temp-storage.service.js';
import { executeProcessWithTimeout, findPythonWorkerScript, getPythonCommand } from '../../utils/process.util.js';
import { OcrLanguage, OcrPdfParams, OcrPdfResponse, StoredOcrPdf } from './ocr-pdf.types.js';

function sanitizePdfFilename(rawName?: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'documento_ocr.pdf';
  }
  const clean = path.basename(rawName).trim().replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  if (!clean) {
    return 'documento_ocr.pdf';
  }
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

function resolveTesseractLang(lang?: OcrLanguage): string {
  if (lang === 'eng') return 'eng';
  if (lang === 'spa+eng') return 'spa+eng';
  return 'spa';
}

async function runPythonOcrWorker(
  inputPath: string,
  outputPath: string,
  language: string,
  deskew: boolean
): Promise<{ ok: boolean; pageCount?: number }> {
  try {
    const pythonCmd = await getPythonCommand();
    const scriptPath = findPythonWorkerScript('ocr_worker.py', 'ocr-pdf');
    const result = await executeProcessWithTimeout(
      pythonCmd,
      [scriptPath, inputPath, outputPath, language, deskew ? '1' : '0'],
      { timeoutMs: 90000 }
    );

    if (result.code === 0 && fs.existsSync(outputPath)) {
      const stats = await fs.promises.stat(outputPath);
      if (stats.size > 0) {
        try {
          const parsed = JSON.parse(result.stdout.trim().split('\n').pop() || '{}');
          return { ok: true, pageCount: parsed.pageCount };
        } catch {
          return { ok: true };
        }
      }
    }
  } catch (err) {
    logger.app.warn('Fallo ejecutando ocr_worker.py', { err });
  }
  return { ok: false };
}

async function runOcrmypdf(inputPath: string, outputPath: string, language: string, deskew: boolean): Promise<boolean> {
  const args = ['-l', language, '--skip-text', '--output-type', 'pdf'];
  if (deskew) {
    args.push('--deskew');
  }
  args.push(inputPath, outputPath);

  const result = await executeProcessWithTimeout('ocrmypdf', args, { timeoutMs: 90000 });
  if (result.timedOut) {
    logger.app.warn('ocrmypdf excedió el tiempo límite (timeout 90s)');
    return false;
  }

  if (result.code === 0 || result.code === 6) {
    try {
      const stats = await fs.promises.stat(outputPath);
      if (stats.size > 0) return true;
    } catch {}
  }

  return false;
}

export async function processOcrPdf(params: OcrPdfParams): Promise<OcrPdfResponse> {
  const { buffer, deskew = true, filename: customFilename, language = 'spa', originalname } = params;
  const originalSize = buffer.length;
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf_ocr_'));
  const inputTempPath = path.join(tempDir, 'source.pdf');
  const outputTempPath = path.join(tempDir, 'output_ocr.pdf');
  const resolvedLang = resolveTesseractLang(language);

  await fs.promises.writeFile(inputTempPath, buffer);

  let finalBuffer: Buffer | null = null;
  let pageCount = 1;

  try {
    const initialDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    pageCount = initialDoc.getPageCount() || 1;
  } catch {
    pageCount = 1;
  }

  try {
    const pyResult = await runPythonOcrWorker(inputTempPath, outputTempPath, resolvedLang, deskew);
    if (pyResult.ok) {
      try {
        finalBuffer = await fs.promises.readFile(outputTempPath);
        if (pyResult.pageCount) pageCount = pyResult.pageCount;
      } catch {}
    }

    if (!finalBuffer) {
      const ocrmypdfOk = await runOcrmypdf(inputTempPath, outputTempPath, resolvedLang, deskew);
      if (ocrmypdfOk) {
        try {
          finalBuffer = await fs.promises.readFile(outputTempPath);
        } catch {}
      }
    }

    if (!finalBuffer) {
      finalBuffer = buffer;
    } else {
      try {
        const outDoc = await PDFDocument.load(finalBuffer, { ignoreEncryption: true });
        pageCount = outDoc.getPageCount() || pageCount;
      } catch {}
    }
  } finally {
    try {
      await fs.promises.rm(tempDir, { force: true, recursive: true });
    } catch {}
  }

  const processedSize = finalBuffer.length;
  const fileId = crypto.randomUUID();
  const filename = sanitizePdfFilename(customFilename || originalname);

  const storedItem: StoredOcrPdf = {
    buffer: finalBuffer,
    contentType: 'application/pdf',
    createdAt: Date.now(),
    filename,
    id: fileId,
    language: resolvedLang,
    originalSize,
    pageCount,
    size: processedSize,
  };

  const tokenResult = await storeTempFile(fileId, storedItem);

  return {
    downloadUrl: tokenResult.downloadUrl,
    fileId: tokenResult.fullToken,
    filename,
    language: resolvedLang,
    originalSize,
    pageCount,
    processedSize,
  };
}

export async function getOcrPdf(fileId: string): Promise<StoredOcrPdf | null> {
  return getTempFile<StoredOcrPdf>(fileId);
}
