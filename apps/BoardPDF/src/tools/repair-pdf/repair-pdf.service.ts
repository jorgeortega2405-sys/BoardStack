import { logger } from '../../services/logger.service.js';
import { storeTempFile } from '../../services/temp-storage.service.js';
import { getGhostscriptCommand, sanitizePdfFilename } from '../../utils/pdf.util.js';
import { executeProcessWithTimeout, findPythonWorkerScript, getPythonCommand } from '../../utils/process.util.js';
import { RepairPdfParams, RepairPdfResponse, StoredRepairedPdf } from './repair-pdf.types.js';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PDFDocument } from 'pdf-lib';


async function runPythonRepairWorker(
  inputPath: string,
  outputPath: string
): Promise<{ ok: boolean; pageCount?: number }> {
  try {
    const pythonCmd = await getPythonCommand();
    const scriptPath = findPythonWorkerScript('repair_worker.py', 'repair-pdf');
    const result = await executeProcessWithTimeout(pythonCmd, [scriptPath, inputPath, outputPath], { timeoutMs: 60000 });
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
    logger.app.warn('Fallo ejecutando repair_worker.py local', { error: err });
  }
  return { ok: false };
}

async function runGhostscriptRepair(inputPath: string, outputPath: string): Promise<boolean> {
  const gsCmd = getGhostscriptCommand();
  const args = [
    '-sDEVICE=pdfwrite',
    '-dPDFSETTINGS=/default',
    '-dCompatibilityLevel=1.4',
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];

  const result = await executeProcessWithTimeout(gsCmd, args, { timeoutMs: 60000 });
  if (result.timedOut) {
    logger.app.warn('Ghostscript excedió el tiempo límite al reparar PDF (timeout 60s)');
    return false;
  }

  if (result.code === 0) {
    try {
      const stats = await fs.promises.stat(outputPath);
      if (stats.size > 0) return true;
    } catch {}
  }

  return false;
}

async function runQpdfLinearize(inputPath: string, outputPath: string): Promise<boolean> {
  const result = await executeProcessWithTimeout('qpdf', ['--linearize', inputPath, outputPath], { timeoutMs: 30000 });
  if (result.code === 0) {
    try {
      const stats = await fs.promises.stat(outputPath);
      if (stats.size > 0) return true;
    } catch {}
  }
  return false;
}

export async function repairPdfBuffer(buffer: Buffer): Promise<{ buffer: Buffer; pageCount: number }> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf_repair_'));
  const inputTempPath = path.join(tempDir, 'broken.pdf');
  const pyOutTempPath = path.join(tempDir, 'repaired_py.pdf');
  const gsOutTempPath = path.join(tempDir, 'repaired_gs.pdf');
  const qpdfOutTempPath = path.join(tempDir, 'repaired_qpdf.pdf');

  await fs.promises.writeFile(inputTempPath, buffer);

  let finalBuffer: Buffer | null = null;
  let pageCount = 1;

  try {
    const pyRes = await runPythonRepairWorker(inputTempPath, pyOutTempPath);
    if (pyRes.ok) {
      try {
        finalBuffer = await fs.promises.readFile(pyOutTempPath);
        if (pyRes.pageCount) pageCount = pyRes.pageCount;
      } catch {}
    }

    if (!finalBuffer) {
      const gsSuccess = await runGhostscriptRepair(inputTempPath, gsOutTempPath);
      if (gsSuccess) {
        const qpdfSuccess = await runQpdfLinearize(gsOutTempPath, qpdfOutTempPath);
        if (qpdfSuccess) {
          try {
            finalBuffer = await fs.promises.readFile(qpdfOutTempPath);
          } catch {}
        }
        if (!finalBuffer) {
          try {
            finalBuffer = await fs.promises.readFile(gsOutTempPath);
          } catch {}
        }
      }
    }

    if (!finalBuffer) {
      try {
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        pageCount = doc.getPageCount();
        const savedBytes = await doc.save({ useObjectStreams: true });
        finalBuffer = Buffer.from(savedBytes);
      } catch (pdfLibErr) {
        logger.app.error('Error al reconstruir PDF con pdf-lib', pdfLibErr);
      }
    }

    if (finalBuffer) {
      try {
        const checkDoc = await PDFDocument.load(finalBuffer, { ignoreEncryption: true });
        pageCount = checkDoc.getPageCount() || pageCount;
      } catch {}
    }
  } finally {
    try {
      await fs.promises.rm(tempDir, { force: true, recursive: true });
    } catch {}
  }

  if (!finalBuffer || finalBuffer.length === 0) {
    throw new Error('No se pudo reconstruir la estructura del archivo PDF dañado.');
  }

  return { buffer: finalBuffer, pageCount };
}

export async function repairPdfFile(params: RepairPdfParams): Promise<RepairPdfResponse> {
  const { buffer, filename: customFilename, originalname } = params;
  const originalSize = buffer.length;
  const { buffer: finalBuffer, pageCount } = await repairPdfBuffer(buffer);
  const repairedSize = finalBuffer.length;
  const fileId = crypto.randomUUID();
  const filename = sanitizePdfFilename(customFilename || originalname);

  const storedItem: StoredRepairedPdf = {
    buffer: finalBuffer,
    contentType: 'application/pdf',
    createdAt: Date.now(),
    filename,
    id: fileId,
    originalSize,
    pageCount,
    size: repairedSize,
  };

  const tokenResult = await storeTempFile(fileId, storedItem);

  return {
    downloadUrl: tokenResult.downloadUrl,
    fileId: tokenResult.fullToken,
    filename,
    originalSize,
    pageCount,
    repairedSize,
    status: 'repaired',
  };
}

