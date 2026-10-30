import { logger } from '../../services/logger.service.js';
import { storeTempFile } from '../../services/temp-storage.service.js';
import { extractPdfText, sanitizePdfFilename } from '../../utils/pdf.util.js';
import { executeProcessWithTimeout, findPythonWorkerScript, getPythonCommand } from '../../utils/process.util.js';
import { ComparePdfParams, ComparePdfResponse, DiffChangeItem, PageComparison } from './compare-pdf.types.js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

async function runPythonCompareWorker(
  pdf1Path: string,
  pdf2Path: string,
  outJsonPath: string,
  diffPdfPath: string
): Promise<{ diffPdfBuffer: Buffer | null; report: any } | null> {
  try {
    const pythonCmd = await getPythonCommand();
    const scriptPath = findPythonWorkerScript('compare_worker.py', 'compare-pdf');
    const result = await executeProcessWithTimeout(
      pythonCmd,
      [scriptPath, pdf1Path, pdf2Path, outJsonPath, diffPdfPath],
      { timeoutMs: 90000 }
    );

    if (result.code === 0 && fs.existsSync(outJsonPath)) {
      const jsonRaw = await fs.promises.readFile(outJsonPath, 'utf-8');
      const report = JSON.parse(jsonRaw);
      let diffPdfBuffer: Buffer | null = null;
      if (fs.existsSync(diffPdfPath)) {
        diffPdfBuffer = await fs.promises.readFile(diffPdfPath);
      }
      return { diffPdfBuffer, report };
    }
  } catch (err) {
    logger.app.warn('Fallo ejecutando compare_worker.py local', { error: err });
  }
  return null;
}


function computeLineDiff(text1: string, text2: string, pageIndex: number): DiffChangeItem[] {
  const changes: DiffChangeItem[] = [];
  const words1 = text1.split(' ').filter(Boolean);
  const words2 = text2.split(' ').filter(Boolean);

  if (text1 === text2) {
    return changes;
  }

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const removedWords = words1.filter((w) => !set2.has(w));
  const addedWords = words2.filter((w) => !set1.has(w));

  if (removedWords.length > 0 || addedWords.length > 0) {
    const removedSnippet = removedWords.slice(0, 35).join(' ');
    const addedSnippet = addedWords.slice(0, 35).join(' ');

    changes.push({
      diffCount: addedWords.length - removedWords.length,
      id: randomUUID(),
      newText: addedSnippet || undefined,
      oldText: removedSnippet || undefined,
      pageIndex,
      type: removedWords.length > 0 && addedWords.length > 0 ? 'modification' : (addedWords.length > 0 ? 'addition' : 'deletion'),
    });
  }

  return changes;
}

function calculateSimilarity(pages1: string[], pages2: string[]): number {
  const all1 = pages1.join(' ').trim();
  const all2 = pages2.join(' ').trim();

  if (all1.length === 0 && all2.length === 0) return 100;
  if (all1.length === 0 || all2.length === 0) return 0;
  if (all1 === all2) return 100;

  const words1 = new Set(all1.toLowerCase().split(/\s+/));
  const words2 = new Set(all2.toLowerCase().split(/\s+/));

  let intersection = 0;
  words1.forEach((w) => {
    if (words2.has(w)) intersection++;
  });

  const union = new Set([...words1, ...words2]).size;
  if (union === 0) return 100;
  return Math.round((intersection / union) * 100);
}

async function generateReportPdf(
  filename1: string,
  filename2: string,
  pagesCompared: number,
  similarity: number,
  pageComparisons: PageComparison[]
): Promise<Buffer> {
  const reportDoc = await PDFDocument.create();
  const fontRegular = await reportDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await reportDoc.embedFont(StandardFonts.HelveticaBold);

  let page = reportDoc.addPage([595.28, 841.89]);
  const { height, width } = page.getSize();
  let currentY = height - 50;

  page.drawText('Informe de Comparación de Documentos PDF', {
    color: rgb(0.07, 0.09, 0.15),
    font: fontBold,
    size: 20,
    x: 50,
    y: currentY,
  });
  currentY -= 20;

  page.drawText('Generado automáticamente por BoardPDF', {
    color: rgb(0.4, 0.45, 0.55),
    font: fontRegular,
    size: 11,
    x: 50,
    y: currentY,
  });
  currentY -= 35;

  page.drawRectangle({
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 0.99),
    height: 90,
    width: width - 100,
    x: 50,
    y: currentY - 70,
  });

  page.drawText(`Archivo A (Base): ${filename1}`, {
    color: rgb(0.12, 0.14, 0.18),
    font: fontBold,
    size: 11,
    x: 65,
    y: currentY - 15,
  });

  page.drawText(`Archivo B (Modificado): ${filename2}`, {
    color: rgb(0.12, 0.14, 0.18),
    font: fontBold,
    size: 11,
    x: 65,
    y: currentY - 35,
  });

  page.drawText(`Páginas analizadas: ${pagesCompared}  |  Similitud global: ${similarity}%`, {
    color: rgb(0.3, 0.35, 0.45),
    font: fontRegular,
    size: 11,
    x: 65,
    y: currentY - 55,
  });
  currentY -= 105;

  page.drawText('Resumen detallado de cambios por página', {
    color: rgb(0.07, 0.09, 0.15),
    font: fontBold,
    size: 14,
    x: 50,
    y: currentY,
  });
  currentY -= 25;

  const changedPages = pageComparisons.filter((p) => p.hasDifferences);

  if (changedPages.length === 0) {
    page.drawText('No se encontraron diferencias de texto entre los documentos analizados.', {
      color: rgb(0.2, 0.6, 0.3),
      font: fontRegular,
      size: 11,
      x: 50,
      y: currentY,
    });
  } else {
    for (const comp of changedPages) {
      if (currentY < 120) {
        page = reportDoc.addPage([595.28, 841.89]);
        currentY = height - 50;
      }

      page.drawText(`Página ${comp.pageIndex + 1} (${comp.differencesCount} diferencia${comp.differencesCount === 1 ? '' : 's'})`, {
        color: rgb(0.15, 0.2, 0.3),
        font: fontBold,
        size: 12,
        x: 50,
        y: currentY,
      });
      currentY -= 20;

      for (const change of comp.changes.slice(0, 5)) {
        if (currentY < 60) {
          page = reportDoc.addPage([595.28, 841.89]);
          currentY = height - 50;
        }

        const typeLabel = change.type === 'addition' ? '[+] Añadido' : (change.type === 'deletion' ? '[-] Eliminado' : '[~] Modificado');
        const typeColor = change.type === 'addition' ? rgb(0.1, 0.6, 0.2) : (change.type === 'deletion' ? rgb(0.8, 0.2, 0.2) : rgb(0.8, 0.5, 0.1));

        page.drawText(typeLabel, {
          color: typeColor,
          font: fontBold,
          size: 10,
          x: 60,
          y: currentY,
        });

        const snippet = change.newText || change.oldText || '';
        const preview = snippet.length > 55 ? `${snippet.slice(0, 55)}...` : snippet;

        if (preview) {
          page.drawText(`: ${preview}`, {
            color: rgb(0.3, 0.35, 0.4),
            font: fontRegular,
            size: 10,
            x: 140,
            y: currentY,
          });
        }
        currentY -= 18;
      }
      currentY -= 15;
    }
  }

  const pdfBytes = await reportDoc.save();
  return Buffer.from(pdfBytes);
}

export async function comparePdfDocuments(params: ComparePdfParams): Promise<ComparePdfResponse> {
  const { buffer1, buffer2, filename1 = 'documento_1.pdf', filename2 = 'documento_2.pdf' } = params;

  if (!buffer1 || buffer1.length === 0 || !buffer2 || buffer2.length === 0) {
    throw new Error('EMPTY_PDF_BUFFERS');
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf_cmp_'));
  const pdf1Path = path.join(tempDir, 'file1.pdf');
  const pdf2Path = path.join(tempDir, 'file2.pdf');
  const outJsonPath = path.join(tempDir, 'report.json');
  const diffPdfPath = path.join(tempDir, 'diff_visual.pdf');

  await Promise.all([
    fs.promises.writeFile(pdf1Path, buffer1),
    fs.promises.writeFile(pdf2Path, buffer2),
  ]);

  try {
    const pyResult = await runPythonCompareWorker(pdf1Path, pdf2Path, outJsonPath, diffPdfPath);
    if (pyResult && pyResult.report) {
      const rep = pyResult.report;
      const pageComps: PageComparison[] = (rep.pageComparisons || []).map((pc: any) => ({
        changes: pc.changes || [],
        differencesCount: pc.diffCount || (pc.changes ? pc.changes.length : 0),
        hasDifferences: (pc.changes && pc.changes.length > 0) || Boolean(pc.hasVisualDiff),
        pageIndex: pc.pageIndex,
      }));

      let totalChanges = 0;
      let additionsCount = 0;
      let deletionsCount = 0;

      for (const pc of pageComps) {
        for (const c of pc.changes) {
          totalChanges++;
          if (c.type === 'addition') additionsCount++;
          else if (c.type === 'deletion') deletionsCount++;
          else {
            additionsCount++;
            deletionsCount++;
          }
        }
      }

      let finalReportBuffer = pyResult.diffPdfBuffer;
      if (!finalReportBuffer) {
        finalReportBuffer = await generateReportPdf(
          filename1,
          filename2,
          rep.pagesCompared || pageComps.length,
          rep.similarity ?? 100,
          pageComps
        );
      }

      const fileId = `comp_${Date.now()}_${randomUUID().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;
      const outFilename = sanitizePdfFilename(filename1 ? `${filename1.replace(/\.pdf$/i, '')}_comparacion.pdf` : undefined, 'informe_comparacion.pdf');

      const tokenResult = await storeTempFile(fileId, {
        buffer: finalReportBuffer,
        contentType: 'application/pdf',
        createdAt: Date.now(),
        fileId,
        fileSize: finalReportBuffer.length,
        filename: outFilename,
      });

      return {
        additionsCount,
        deletionsCount,
        downloadUrl: tokenResult.downloadUrl,
        fileId: tokenResult.fullToken,
        fileSize: finalReportBuffer.length,
        filename: outFilename,
        pageComparisons: pageComps,
        pagesCompared: rep.pagesCompared || pageComps.length,
        similarityPercentage: rep.similarity ?? 100,
        totalChanges,
      };
    }
  } finally {
    try {
      await fs.promises.rm(tempDir, { force: true, recursive: true });
    } catch {}
  }

  const [res1, res2] = await Promise.all([
    extractPdfText(buffer1),
    extractPdfText(buffer2),
  ]);
  const pagesText1 = res1.pages;
  const pagesText2 = res2.pages;


  const maxPages = Math.max(pagesText1.length, pagesText2.length);
  const pageComparisons: PageComparison[] = [];
  let totalChanges = 0;
  let additionsCount = 0;
  let deletionsCount = 0;

  for (let p = 0; p < maxPages; p++) {
    const text1 = pagesText1[p] || '';
    const text2 = pagesText2[p] || '';

    const changes = computeLineDiff(text1, text2, p);
    const hasDifferences = changes.length > 0;

    changes.forEach((c) => {
      totalChanges++;
      if (c.type === 'addition') additionsCount++;
      else if (c.type === 'deletion') deletionsCount++;
      else {
        additionsCount++;
        deletionsCount++;
      }
    });

    pageComparisons.push({
      changes,
      differencesCount: changes.length,
      hasDifferences,
      pageIndex: p,
    });
  }

  const similarityPercentage = calculateSimilarity(pagesText1, pagesText2);
  const reportBuffer = await generateReportPdf(
    filename1,
    filename2,
    maxPages,
    similarityPercentage,
    pageComparisons
  );

  const fileId = `comp_${Date.now()}_${randomUUID().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;
  const outFilename = sanitizePdfFilename(filename1 ? `${filename1.replace(/\.pdf$/i, '')}_comparacion.pdf` : undefined, 'informe_comparacion.pdf');

  const tokenResult = await storeTempFile(fileId, {
    buffer: reportBuffer,
    contentType: 'application/pdf',
    createdAt: Date.now(),
    fileId,
    fileSize: reportBuffer.length,
    filename: outFilename,
  });

  return {
    additionsCount,
    deletionsCount,
    downloadUrl: tokenResult.downloadUrl,
    fileId: tokenResult.fullToken,
    fileSize: reportBuffer.length,
    filename: outFilename,
    pageComparisons,
    pagesCompared: maxPages,
    similarityPercentage,
    totalChanges,
  };
}

export { comparePdfDocuments as comparePdfs };

