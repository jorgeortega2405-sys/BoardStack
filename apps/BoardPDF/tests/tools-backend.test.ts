import assert from 'node:assert';
import { after, describe, test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { getDbPool } from '../src/config/database.config.js';
import { redis } from '../src/config/redis.config.js';
import { comparePdfDocuments } from '../src/tools/compare-pdf/compare-pdf.service.js';
import { compressPdfFile } from '../src/tools/compress-pdf/compress-pdf.service.js';
import { cropPdf } from '../src/tools/crop-pdf/crop-pdf.service.js';
import { editPdfDocument } from '../src/tools/edit-pdf/edit-pdf.service.js';
import { mergePdfFiles } from '../src/tools/merge-pdf/merge-pdf.service.js';
import { processOcrPdf } from '../src/tools/ocr-pdf/ocr-pdf.service.js';
import { organizePdf } from '../src/tools/organize-pdf/organize-pdf.service.js';
import { addPageNumbers } from '../src/tools/page-numbers/page-numbers.service.js';
import { convertPdfFile } from '../src/tools/pdf-converter/pdf-converter.service.js';
import { protectPdf } from '../src/tools/protect-pdf/protect-pdf.service.js';
import { redactPdfDocument } from '../src/tools/redact-pdf/redact-pdf.service.js';
import { removePdfPages } from '../src/tools/remove-pdf-pages/remove-pdf-pages.service.js';
import { repairPdfFile } from '../src/tools/repair-pdf/repair-pdf.service.js';
import { rotatePdf } from '../src/tools/rotate-pdf/rotate-pdf.service.js';
import { splitPdfFile } from '../src/tools/split-pdf/split-pdf.service.js';
import { convertToPdf, convertUrlToPdf, isValidPublicUrl } from '../src/tools/to-pdf-converter/to-pdf-converter.service.js';
import { unlockPdf } from '../src/tools/unlock-pdf/unlock-pdf.service.js';
import { addWatermarkToPdf } from '../src/tools/watermark-pdf/watermark-pdf.service.js';
import { createSampleJpgImageBuffer, createSamplePngImageBuffer, createTestPdfBuffer } from './fixtures/test-files.js';

describe('BoardPDF - Backend Tools & Options Automated Verification', () => {
  let samplePdf3Pages: Buffer;

  test('Setup: generate standard test fixtures', async () => {
    samplePdf3Pages = await createTestPdfBuffer(3);
    assert.ok(samplePdf3Pages.length > 500);
    const doc = await PDFDocument.load(samplePdf3Pages);
    assert.strictEqual(doc.getPageCount(), 3);
  });

  describe('merge-pdf service options', () => {
    test('merges 2 PDF files into a 6-page document', async () => {
      const result = await mergePdfFiles([
        { buffer: samplePdf3Pages, originalname: 'doc1.pdf' },
        { buffer: samplePdf3Pages, originalname: 'doc2.pdf' },
      ]);
      assert.strictEqual(result.pageCount, 6);
      assert.ok(result.fileId);
      assert.ok(result.downloadUrl);
    });

    test('merges 3 PDF files with a custom filename', async () => {
      const result = await mergePdfFiles(
        [
          { buffer: samplePdf3Pages, originalname: 'doc1.pdf' },
          { buffer: samplePdf3Pages, originalname: 'doc2.pdf' },
          { buffer: samplePdf3Pages, originalname: 'doc3.pdf' },
        ],
        'merged_custom.pdf'
      );
      assert.strictEqual(result.pageCount, 9);
      assert.strictEqual(result.filename, 'merged_custom.pdf');
    });
  });

  describe('split-pdf service options', () => {
    test('splits by range with mergeSelected = true', async () => {
      const result = await splitPdfFile(samplePdf3Pages, 'sample.pdf', {
        mergeSelected: true,
        mode: 'range',
        ranges: [{ from: 1, to: 2 }],
      });
      assert.ok(result.fileId);
      assert.ok(result.downloadUrl);
      assert.strictEqual(result.partsCount, 1);
    });

    test('splits by range with mergeSelected = false (multi-part)', async () => {
      const result = await splitPdfFile(samplePdf3Pages, 'sample.pdf', {
        mergeSelected: false,
        mode: 'range',
        ranges: [
          { from: 1, to: 1 },
          { from: 2, to: 3 },
        ],
      });
      assert.ok(result.fileId);
      assert.strictEqual(result.partsCount, 2);
    });

    test('extracts specific pages [1, 3] with mergeSelected = true', async () => {
      const result = await splitPdfFile(samplePdf3Pages, 'sample.pdf', {
        mergeSelected: true,
        mode: 'pages',
        selectedPages: [1, 3],
      });
      assert.ok(result.fileId);
      assert.strictEqual(result.partsCount, 1);
    });

    test('splits by fixed page count = 1', async () => {
      const result = await splitPdfFile(samplePdf3Pages, 'sample.pdf', {
        fixedPageCount: 1,
        mode: 'range',
        submode: 'fixed',
      });
      assert.ok(result.fileId);
      assert.strictEqual(result.partsCount, 3);
    });
  });

  describe('remove-pdf-pages service options', () => {
    test('removes page 2 and outputs 2 remaining pages', async () => {
      const result = await removePdfPages(samplePdf3Pages, 'sample.pdf', {
        filename: 'removed_one.pdf',
        pagesToRemove: [2],
      });
      assert.strictEqual(result.originalPages, 3);
      assert.strictEqual(result.removedPages, 1);
      assert.strictEqual(result.remainingPages, 2);
      assert.strictEqual(result.filename, 'removed_one.pdf');
    });

    test('removes multiple pages [1, 3] and outputs 1 remaining page', async () => {
      const result = await removePdfPages(samplePdf3Pages, 'sample.pdf', {
        pagesToRemove: [1, 3],
      });
      assert.strictEqual(result.originalPages, 3);
      assert.strictEqual(result.removedPages, 2);
      assert.strictEqual(result.remainingPages, 1);
    });
  });

  describe('organize-pdf service options', () => {
    test('reorders pages [3, 1, 2]', async () => {
      const result = await organizePdf(samplePdf3Pages, 'sample.pdf', {
        filename: 'reordered.pdf',
        pagesOrder: [
          { pageIndex: 2, rotation: 0 },
          { pageIndex: 0, rotation: 0 },
          { pageIndex: 1, rotation: 0 },
        ],
      });
      assert.strictEqual(result.totalPages, 3);
      assert.strictEqual(result.filename, 'reordered.pdf');
    });

    test('reorders and rotates page 1 by 90 and page 2 by 180 degrees', async () => {
      const result = await organizePdf(samplePdf3Pages, 'sample.pdf', {
        pagesOrder: [
          { pageIndex: 0, rotation: 90 },
          { pageIndex: 1, rotation: 180 },
          { pageIndex: 2, rotation: 0 },
        ],
      });
      assert.strictEqual(result.totalPages, 3);
    });
  });

  describe('rotate-pdf service options', () => {
    test('rotates all pages by 90 degrees', async () => {
      const result = await rotatePdf(samplePdf3Pages, 'sample.pdf', {
        filename: 'rotated_90.pdf',
        rotation: 90,
      });
      assert.strictEqual(result.totalPages, 3);
      assert.strictEqual(result.filename, 'rotated_90.pdf');
    });

    test('rotates all pages by 180 degrees', async () => {
      const result = await rotatePdf(samplePdf3Pages, 'sample.pdf', {
        rotation: 180,
      });
      assert.strictEqual(result.totalPages, 3);
    });

    test('rotates single specific page (page 2 by 90 degrees)', async () => {
      const result = await rotatePdf(samplePdf3Pages, 'sample.pdf', {
        pageRotations: { '2': 90 },
      });
      assert.strictEqual(result.totalPages, 3);
    });
  });

  describe('compress-pdf service options', () => {
    test('compresses with recommended level', async () => {
      const result = await compressPdfFile({
        buffer: samplePdf3Pages,
        level: 'recommended',
        originalname: 'sample.pdf',
      });
      assert.ok(result.fileId);
      assert.ok(result.compressedSize > 0);
    });

    test('compresses with extreme level and custom filename', async () => {
      const result = await compressPdfFile({
        buffer: samplePdf3Pages,
        filename: 'extreme_compressed.pdf',
        level: 'extreme',
        originalname: 'sample.pdf',
      });
      assert.strictEqual(result.filename, 'extreme_compressed.pdf');
      assert.ok(result.compressedSize > 0);
    });

    test('compresses with low level', async () => {
      const result = await compressPdfFile({
        buffer: samplePdf3Pages,
        level: 'low',
        originalname: 'sample.pdf',
      });
      assert.ok(result.compressedSize > 0);
    });
  });

  describe('repair-pdf service options', () => {
    test('repairs document and returns valid repaired file', async () => {
      const result = await repairPdfFile({
        buffer: samplePdf3Pages,
        filename: 'repaired.pdf',
        originalname: 'sample.pdf',
      });
      assert.strictEqual(result.pageCount, 3);
      assert.strictEqual(result.filename, 'repaired.pdf');
    });
  });

  describe('ocr-pdf service options', () => {
    test('processes OCR with spanish language and deskew', async () => {
      const result = await processOcrPdf({
        buffer: samplePdf3Pages,
        deskew: true,
        filename: 'ocr_result.pdf',
        language: 'spa',
        originalname: 'sample.pdf',
      });
      assert.ok(result.fileId);
      assert.ok(result.downloadUrl);
      assert.strictEqual(result.pageCount, 3);
    });
  });

  describe('page-numbers service options', () => {
    test('adds page numbers at bottom-right with page-only format', async () => {
      const result = await addPageNumbers(samplePdf3Pages, 'sample.pdf', {
        format: 'page-only',
        margin: 'medium',
        position: 'bottom-right',
      });
      assert.strictEqual(result.totalPages, 3);
      assert.ok(result.fileId);
    });

    test('adds page numbers at top-center with page-of-total format and skips cover page', async () => {
      const result = await addPageNumbers(samplePdf3Pages, 'sample.pdf', {
        coverPage: true,
        format: 'page-of-total',
        margin: 'large',
        position: 'top-center',
      });
      assert.strictEqual(result.totalPages, 3);
      assert.ok(result.fileId);
    });
  });

  describe('watermark-pdf service options', () => {
    test('adds text watermark with rotation and opacity', async () => {
      const result = await addWatermarkToPdf(samplePdf3Pages, 'sample.pdf', {
        color: '#ff0000',
        fontSize: 36,
        opacity: 0.4,
        position: 'center',
        rotation: 45,
        text: 'CONFIDENCIAL',
        type: 'text',
      });
      assert.strictEqual(result.totalPages, 3);
      assert.ok(result.fileId);
    });

    test('adds text watermark in mosaic mode', async () => {
      const result = await addWatermarkToPdf(samplePdf3Pages, 'sample.pdf', {
        fontSize: 24,
        mosaic: true,
        opacity: 0.2,
        position: 'center',
        rotation: 30,
        text: 'COPIA',
        type: 'text',
      });
      assert.strictEqual(result.totalPages, 3);
      assert.ok(result.fileId);
    });

    test('adds image watermark with sample PNG buffer', async () => {
      const imgBuffer = createSamplePngImageBuffer();
      const result = await addWatermarkToPdf(
        samplePdf3Pages,
        'sample.pdf',
        {
          opacity: 0.6,
          position: 'bottom-right',
          rotation: 0,
          scale: 0.5,
          type: 'image',
        },
        imgBuffer
      );
      assert.strictEqual(result.totalPages, 3);
      assert.ok(result.fileId);
    });
  });

  describe('crop-pdf service options', () => {
    test('crops pages with applyToAll = true', async () => {
      const result = await cropPdf(samplePdf3Pages, 'sample.pdf', {
        applyToAll: true,
        cropBox: { height: 700, width: 500, x: 20, y: 20 },
      });
      assert.strictEqual(result.totalPages, 3);
      assert.ok(result.fileId);
    });

    test('crops specific target page (targetPageIndex = 0)', async () => {
      const result = await cropPdf(samplePdf3Pages, 'sample.pdf', {
        applyToAll: false,
        cropBox: { height: 600, width: 450, x: 30, y: 30 },
        targetPageIndex: 0,
      });
      assert.strictEqual(result.totalPages, 3);
      assert.ok(result.fileId);
    });
  });

  describe('edit-pdf service options', () => {
    test('adds text and rectangle modifications', async () => {
      const result = await editPdfDocument(
        samplePdf3Pages,
        'sample.pdf',
        {
          rectangles: [
            { color: '#3366ff', height: 40, opacity: 0.5, pageIndex: 0, width: 150, x: 50, y: 500 },
          ],
          texts: [
            { color: '#000000', fontSize: 16, pageIndex: 0, text: 'Annotated note', x: 60, y: 510 },
          ],
        },
        [],
        'annotated.pdf'
      );
      assert.strictEqual(result.pageCount, 3);
      assert.strictEqual(result.filename, 'annotated.pdf');
    });
  });

  describe('protect-pdf and unlock-pdf roundtrip', () => {
    let protectedPdfBuffer: Buffer | null = null;

    test('protects PDF with password and generates encrypted document', async () => {
      const protectResult = await protectPdf(samplePdf3Pages, 'sample.pdf', {
        password: 'TestSecretPassword123',
      });
      assert.strictEqual(protectResult.totalPages, 3);
      assert.ok(protectResult.fileId);
      assert.ok(protectResult.downloadUrl);
    });

    test('unlocks PDF with correct password', async () => {
      const protectResult = await protectPdf(samplePdf3Pages, 'sample.pdf', {
        password: 'ValidKey456',
      });
      const { getProtectPdfResult } = await import('../src/tools/protect-pdf/protect-pdf.service.js');
      const storedItem = await getProtectPdfResult(protectResult.fileId);
      assert.ok(storedItem);
      protectedPdfBuffer = storedItem.buffer;

      const unlockResult = await unlockPdf(protectedPdfBuffer, 'protected.pdf', {
        password: 'ValidKey456',
      });
      assert.strictEqual(unlockResult.totalPages, 3);
      assert.ok(unlockResult.fileId);
    });

    test('fails to unlock PDF with invalid password', async () => {
      if (!protectedPdfBuffer) return;
      await assert.rejects(
        async () => {
          await unlockPdf(protectedPdfBuffer!, 'protected.pdf', {
            password: 'CompletelyWrongPassword',
          });
        },
        (err: any) => err.message === 'PASSWORD_INVALID' || err.message?.includes('password')
      );
    });
  });

  describe('redact-pdf service options', () => {
    test('applies forensic redaction on page 0 with metadata sanitization', async () => {
      const result = await redactPdfDocument({
        buffer: samplePdf3Pages,
        filename: 'redacted.pdf',
        originalname: 'sample.pdf',
        redactions: [
          {
            boxes: [{ height: 40, width: 200, x: 50, y: 740 }],
            pageIndex: 0,
          },
        ],
        sanitizeMetadata: true,
      });
      assert.strictEqual(result.redactedPagesCount, 1);
      assert.strictEqual(result.redactedBoxesCount, 1);
      assert.ok(result.fileId);
      assert.ok(result.downloadUrl);
    });
  });

  describe('compare-pdf service options', () => {
    test('compares documents in semantic mode', async () => {
      const result = await comparePdfDocuments({
        buffer1: samplePdf3Pages,
        buffer2: samplePdf3Pages,
        comparisonMode: 'semantic',
        filename1: 'doc_v1.pdf',
        filename2: 'doc_v2.pdf',
      });
      assert.ok(result.fileId);
      assert.strictEqual(result.pagesCompared, 3);
      assert.ok(result.similarityPercentage >= 0);
    });

    test('compares documents in overlay mode', async () => {
      const result = await comparePdfDocuments({
        buffer1: samplePdf3Pages,
        buffer2: samplePdf3Pages,
        comparisonMode: 'overlay',
        filename1: 'doc_v1.pdf',
        filename2: 'doc_v2.pdf',
      });
      assert.ok(result.fileId);
      assert.strictEqual(result.pagesCompared, 3);
    });
  });

  describe('to-pdf-converter service options', () => {
    test('converts sample JPG image to PDF', async () => {
      const imgJpg = createSampleJpgImageBuffer();
      const result = await convertToPdf(
        {
          buffer: imgJpg,
          mimetype: 'image/jpeg',
          originalname: 'photo.jpg',
        } as any,
        'jpg-to-pdf'
      );
      assert.ok(result.downloadToken);
      assert.ok(result.fileSize > 0);
    });

    test('validates public URLs for HTML to PDF correctly', () => {
      assert.strictEqual(isValidPublicUrl('https://example.com'), true);
      assert.strictEqual(isValidPublicUrl('https://google.com/search?q=pdf'), true);
      assert.strictEqual(isValidPublicUrl('http://127.0.0.1:8080'), false);
      assert.strictEqual(isValidPublicUrl('http://localhost:3000'), false);
      assert.strictEqual(isValidPublicUrl('ftp://ftp.example.com'), false);
    });

    test('converts sample HTML file buffer to PDF', async () => {
      const htmlBuffer = Buffer.from('<!DOCTYPE html><html><body><h1>BoardPDF HTML Test</h1><p>Conversion exitosa.</p></body></html>', 'utf-8');
      const result = await convertToPdf(
        {
          buffer: htmlBuffer,
          mimetype: 'text/html',
          originalname: 'document.html',
        } as any,
        'html-to-pdf'
      );
      assert.ok(result.downloadToken);
      assert.ok(result.fileSize > 0);
      assert.strictEqual(result.success, true);
    });

    test('converts public web URL to PDF', async () => {
      const result = await convertUrlToPdf('https://example.com');
      assert.ok(result.downloadToken);
      assert.ok(result.fileSize > 0);
      assert.strictEqual(result.success, true);
      assert.ok(result.filename.endsWith('.pdf'));
    });
  });

  describe('pdf-converter service options', () => {
    test('converts PDF to JPG', async () => {
      const result = await convertPdfFile(
        {
          buffer: samplePdf3Pages,
          mimetype: 'application/pdf',
          originalname: 'doc.pdf',
        } as any,
        'pdf-to-jpg'
      );
      assert.ok(result.downloadToken);
      assert.ok(result.filename);
      assert.strictEqual(result.success, true);
    });
  });

  after(async () => {
    try {
      redis.disconnect(false);
    } catch {}
    try {
      const pool = getDbPool();
      await pool.end();
    } catch {}
  });
});
