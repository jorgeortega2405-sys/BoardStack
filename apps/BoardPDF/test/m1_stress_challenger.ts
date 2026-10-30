import assert from 'node:assert';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Request, Response } from 'express';
import { getToolLimits, TOOLS_LIMITS } from '../src/config/tools-limits.config.js';
import { handleToolDownload } from '../src/controllers/download.controller.js';
import { deleteTempFile, storeTempFile } from '../src/services/temp-storage.service.js';
import { createZipBuffer } from '../src/utils/archive.util.js';
import {
  cleanTextForWinAnsi,
  extractPdfText,
  getGhostscriptCommand,
  isPdfBuffer,
  parseHexColor,
  sanitizePdfFilename,
} from '../src/utils/pdf.util.js';
import { createPdfUploadMiddleware } from '../src/utils/upload.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARCHIVOS_DIR = path.join(__dirname, 'archivos');

async function runEmpiricalStressTests() {
  console.log('[CHALLENGER 2] Starting empirical test suite for Milestone M1...');
  let totalTests = 0;
  let passedTests = 0;

  async function runTest(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  ✓ PASS: ${name}`);
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(err);
      throw err;
    }
  }

  // ==========================================
  // SECTION 1: pdf.util.ts
  // ==========================================
  console.log('\n--- Section 1: pdf.util.ts Stress Testing ---');

  await runTest('isPdfBuffer with valid PDF headers', () => {
    assert.strictEqual(isPdfBuffer(Buffer.from('%PDF-1.4 test')), true);
    assert.strictEqual(isPdfBuffer(Buffer.from('%PDF-2.0')), true);
  });

  await runTest('isPdfBuffer with invalid buffers and edge cases', () => {
    assert.strictEqual(isPdfBuffer(Buffer.alloc(0)), false);
    assert.strictEqual(isPdfBuffer(Buffer.from('%PDF')), false); // 4 bytes (< 5)
    assert.strictEqual(isPdfBuffer(Buffer.from('GIF89a')), false);
    assert.strictEqual(isPdfBuffer(Buffer.from('\x89PNG\r\n\x1a\n')), false);
    assert.strictEqual(isPdfBuffer(null as any), false);
    assert.strictEqual(isPdfBuffer(undefined as any), false);
  });

  await runTest('sanitizePdfFilename against path traversal and malformed names', () => {
    assert.strictEqual(sanitizePdfFilename('../../../etc/passwd'), 'passwd.pdf');
    assert.strictEqual(sanitizePdfFilename('..\\..\\windows\\system32\\cmd.exe'), 'cmd.exe.pdf');
    assert.strictEqual(sanitizePdfFilename('/var/log/syslog.pdf'), 'syslog.pdf');
    assert.strictEqual(sanitizePdfFilename(''), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename('...'), 'document.pdf');
    assert.ok(['document.pdf', 'pdf.pdf'].includes(sanitizePdfFilename('.pdf')));
    assert.strictEqual(sanitizePdfFilename('valid_name.pdf'), 'valid_name.pdf');
    assert.strictEqual(sanitizePdfFilename('valid name with spaces.pdf'), 'valid name with spaces.pdf');
    assert.strictEqual(sanitizePdfFilename('illegal*chars?:<>|.pdf'), 'illegal_chars_____.pdf');
    assert.strictEqual(sanitizePdfFilename(undefined, 'custom_default.pdf'), 'custom_default.pdf');
  });

  await runTest('cleanTextForWinAnsi with unicode and emojis', () => {
    assert.strictEqual(cleanTextForWinAnsi('Hello World 123!'), 'Hello World 123!');
    const accented = cleanTextForWinAnsi('Accentué et cédille: é, à, ç');
    assert.ok(accented.length > 0);
    const withEmoji = cleanTextForWinAnsi('Text with emoji: 😀🎉 and CJK: 漢字');
    assert.doesNotThrow(() => cleanTextForWinAnsi(withEmoji));
    assert.strictEqual(cleanTextForWinAnsi(''), '');
    assert.strictEqual(cleanTextForWinAnsi(null as any), '');
  });

  await runTest('parseHexColor normalized RGB extraction', () => {
    const white = parseHexColor('#ffffff');
    assert.strictEqual(white.r, 1);
    assert.strictEqual(white.g, 1);
    assert.strictEqual(white.b, 1);

    const black = parseHexColor('#000000');
    assert.strictEqual(black.r, 0);
    assert.strictEqual(black.g, 0);
    assert.strictEqual(black.b, 0);

    const red3 = parseHexColor('#f00');
    assert.strictEqual(red3.r, 1);
    assert.strictEqual(red3.g, 0);
    assert.strictEqual(red3.b, 0);

    const invalid = parseHexColor('invalid');
    assert.strictEqual(invalid.r, 0);
    assert.strictEqual(invalid.g, 0);
    assert.strictEqual(invalid.b, 0);

    const transparent = parseHexColor('transparent');
    assert.strictEqual(transparent.r, 0);
    assert.strictEqual(transparent.g, 0);
    assert.strictEqual(transparent.b, 0);
  });

  await runTest('getGhostscriptCommand returns valid string binary name', () => {
    const cmd = getGhostscriptCommand();
    assert.ok(typeof cmd === 'string' && cmd.length > 0);
    console.log(`    Detected Ghostscript command: "${cmd}"`);
  });

  // Real PDF files in test/archivos/
  await runTest('extractPdfText with real PDF: muestra_1_pagina.pdf', async () => {
    const filePath = path.join(ARCHIVOS_DIR, 'muestra_1_pagina.pdf');
    assert.ok(fs.existsSync(filePath), `Missing test file: ${filePath}`);
    const buffer = fs.readFileSync(filePath);
    const result = await extractPdfText(buffer);
    assert.strictEqual(result.pages.length, 1);
    assert.ok(result.fullText.length > 0);
    console.log(`    Extracted ${result.fullText.length} chars from 1 page.`);
  });

  await runTest('extractPdfText with real PDF: muestra_3_paginas.pdf', async () => {
    const filePath = path.join(ARCHIVOS_DIR, 'muestra_3_paginas.pdf');
    assert.ok(fs.existsSync(filePath), `Missing test file: ${filePath}`);
    const buffer = fs.readFileSync(filePath);
    const result = await extractPdfText(buffer);
    assert.strictEqual(result.pages.length, 3);
    assert.ok(result.fullText.length > 0);
    console.log(`    Extracted ${result.fullText.length} chars across 3 pages.`);
  });

  await runTest('extractPdfText with real PDF: muestra_con_imagenes.pdf', async () => {
    const filePath = path.join(ARCHIVOS_DIR, 'muestra_con_imagenes.pdf');
    assert.ok(fs.existsSync(filePath), `Missing test file: ${filePath}`);
    const buffer = fs.readFileSync(filePath);
    const result = await extractPdfText(buffer);
    assert.ok(Array.isArray(result.pages));
    console.log(`    Extracted text from image PDF without crash: ${result.pages.length} pages.`);
  });

  await runTest('extractPdfText resilience with password-protected PDF: muestra_protegida.pdf', async () => {
    const filePath = path.join(ARCHIVOS_DIR, 'muestra_protegida.pdf');
    assert.ok(fs.existsSync(filePath), `Missing test file: ${filePath}`);
    const buffer = fs.readFileSync(filePath);
    const result = await extractPdfText(buffer);
    assert.strictEqual(typeof result.fullText, 'string');
    assert.ok(Array.isArray(result.pages));
    console.log(`    Gracefully handled protected PDF: returned empty text without crashing.`);
  });

  await runTest('extractPdfText resilience with corrupted/garbage buffer', async () => {
    const garbage = Buffer.from('This is completely corrupted and not a PDF');
    const result = await extractPdfText(garbage);
    assert.strictEqual(result.fullText, '');
    assert.deepStrictEqual(result.pages, []);
    console.log(`    Gracefully handled corrupted buffer: returned empty text without throwing.`);
  });

  // ==========================================
  // SECTION 2: archive.util.ts
  // ==========================================
  console.log('\n--- Section 2: archive.util.ts ZIP Generation Testing ---');

  await runTest('createZipBuffer creates valid zip from file buffers', async () => {
    const files = [
      { name: 'file1.pdf', buffer: Buffer.from('%PDF-1.4 file1 content') },
      { name: 'file2.pdf', buffer: Buffer.from('%PDF-1.4 file2 content') },
    ];
    const zipBuffer = await createZipBuffer(files);
    assert.ok(Buffer.isBuffer(zipBuffer));
    assert.ok(zipBuffer.length > 0);
    // Standard ZIP magic bytes: PK\x03\x04
    assert.strictEqual(zipBuffer[0], 0x50); // 'P'
    assert.strictEqual(zipBuffer[1], 0x4b); // 'K'
    assert.strictEqual(zipBuffer[2], 0x03);
    assert.strictEqual(zipBuffer[3], 0x04);
    console.log(`    Generated ZIP archive of size ${zipBuffer.length} bytes.`);
  });

  // ==========================================
  // SECTION 3: HTTP Server Setup for Middleware & Controller
  // ==========================================
  console.log('\n--- Section 3: Live Express Server for Upload & Download Testing ---');

  const app = express();

  // Test route 1: single file upload with 1MB limit
  app.post(
    '/api/test-upload-single',
    createPdfUploadMiddleware({ maxFileSizeMB: 1, maxFiles: 1 }),
    (req: Request, res: Response) => {
      if (!req.file) {
        res.status(400).json({ error: 'No se ha proporcionado ningún archivo.', success: false });
        return;
      }
      res.status(200).json({
        file: {
          mimetype: req.file.mimetype,
          originalname: req.file.originalname,
          size: req.file.size,
        },
        success: true,
      });
    }
  );

  // Test route 2: multiple files upload with 3 files max
  app.post(
    '/api/test-upload-multi',
    createPdfUploadMiddleware({ maxFileSizeMB: 5, maxFiles: 3 }),
    (req: Request, res: Response) => {
      const files = (req.files as Express.Multer.File[]) || [];
      if (!files.length) {
        res.status(400).json({ error: 'No se han proporcionado archivos.', success: false });
        return;
      }
      res.status(200).json({
        count: files.length,
        files: files.map((f) => f.originalname),
        success: true,
      });
    }
  );

  // Test route 3: download handler
  app.get('/api/test-download/:fileId', handleToolDownload);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`    Ephemeral test server running at ${baseUrl}`);

  try {
    // 3.1: Reject invalid MIME / extension (.txt file)
    await runTest('createPdfUploadMiddleware rejects invalid format (.txt / text/plain)', async () => {
      const formData = new FormData();
      const textBlob = new Blob(['Not a PDF file content'], { type: 'text/plain' });
      formData.append('file', textBlob, 'notes.txt');

      const res = await fetch(`${baseUrl}/api/test-upload-single`, {
        body: formData,
        method: 'POST',
      });
      const data: any = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'Formato no compatible. Solo se permiten documentos en formato PDF.');
      console.log(`    Rejected invalid format with HTTP 400 and safe message.`);
    });

    // 3.2: Reject oversized file (1.5MB file against 1MB limit)
    await runTest('createPdfUploadMiddleware rejects oversized files (> 1MB)', async () => {
      const formData = new FormData();
      const largeContent = new Uint8Array(1.5 * 1024 * 1024); // 1.5 MB
      largeContent.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
      const pdfBlob = new Blob([largeContent], { type: 'application/pdf' });
      formData.append('file', pdfBlob, 'huge.pdf');

      const res = await fetch(`${baseUrl}/api/test-upload-single`, {
        body: formData,
        method: 'POST',
      });
      const data: any = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'El archivo supera el límite máximo permitido de 1 MB.');
      console.log(`    Rejected oversized file with HTTP 400 and exact limit message.`);
    });

    // 3.3: Missing files handled cleanly
    await runTest('createPdfUploadMiddleware handles request with no files cleanly', async () => {
      const formData = new FormData(); // empty form
      const res = await fetch(`${baseUrl}/api/test-upload-single`, {
        body: formData,
        method: 'POST',
      });
      const data: any = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'No se ha proporcionado ningún archivo.');
      console.log(`    Handled missing file without crash or unhandled error.`);
    });

    // 3.4: Accept valid single PDF upload
    await runTest('createPdfUploadMiddleware accepts valid PDF upload', async () => {
      const formData = new FormData();
      const validPdfBytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const pdfBlob = new Blob([validPdfBytes], { type: 'application/pdf' });
      formData.append('file', pdfBlob, 'contrato.pdf');

      const res = await fetch(`${baseUrl}/api/test-upload-single`, {
        body: formData,
        method: 'POST',
      });
      const data: any = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.file.originalname, 'contrato.pdf');
      assert.strictEqual(data.file.mimetype, 'application/pdf');
      console.log(`    Accepted valid PDF upload successfully.`);
    });

    // 3.5: Reject exceeding max files limit (4 files against max 3)
    await runTest('createPdfUploadMiddleware rejects exceeding maxFiles limit', async () => {
      const formData = new FormData();
      for (let i = 1; i <= 4; i++) {
        const bytes = new TextEncoder().encode(`%PDF-1.4 file ${i}`);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        formData.append('files', blob, `doc${i}.pdf`);
      }

      const res = await fetch(`${baseUrl}/api/test-upload-multi`, {
        body: formData,
        method: 'POST',
      });
      const data: any = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'Puedes subir un máximo de 3 archivos por tarea.');
      console.log(`    Rejected exceeding file count with HTTP 400 and exact limit message.`);
    });

    // 3.6: Accept multiple valid PDF files within limit
    await runTest('createPdfUploadMiddleware accepts multiple valid files within limit', async () => {
      const formData = new FormData();
      for (let i = 1; i <= 3; i++) {
        const bytes = new TextEncoder().encode(`%PDF-1.4 file ${i}`);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        formData.append('files', blob, `doc${i}.pdf`);
      }

      const res = await fetch(`${baseUrl}/api/test-upload-multi`, {
        body: formData,
        method: 'POST',
      });
      const data: any = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.count, 3);
      console.log(`    Accepted 3 multiple PDF uploads successfully.`);
    });

    // ==========================================
    // SECTION 4: handleToolDownload
    // ==========================================
    console.log('\n--- Section 4: handleToolDownload Live HTTP Testing ---');

    await runTest('handleToolDownload returns 404 for missing/expired fileId', async () => {
      const res = await fetch(`${baseUrl}/api/test-download/missing_or_expired_file_id`);
      const data: any = await res.json();
      assert.strictEqual(res.status, 404);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'El archivo solicitado ha expirado o no existe.');
      console.log(`    Missing/expired file returned HTTP 404 with standard message.`);
    });

    await runTest('handleToolDownload streams valid stored file with correct headers', async () => {
      const testBuffer = Buffer.from('%PDF-1.4 sample downloaded content');
      const filename = 'reporte_final.pdf';
      const fileId = 'test_token_live_123';

      await storeTempFile(fileId, {
        buffer: testBuffer,
        contentType: 'application/pdf',
        createdAt: Date.now(),
        filename,
      });

      try {
        const res = await fetch(`${baseUrl}/api/test-download/${fileId}`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
        assert.strictEqual(
          res.headers.get('content-disposition'),
          `attachment; filename="${encodeURIComponent(filename)}"`
        );
        assert.strictEqual(res.headers.get('content-length'), String(testBuffer.length));
        assert.strictEqual(res.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');

        const arrayBuf = await res.arrayBuffer();
        const receivedBuf = Buffer.from(arrayBuf);
        assert.deepStrictEqual(receivedBuf, testBuffer);
        console.log(`    Streamed valid stored file: byte match verified (${receivedBuf.length} bytes).`);
      } finally {
        await deleteTempFile(fileId);
      }
    });
  } finally {
    server.close();
  }

  // ==========================================
  // SECTION 5: tools-limits.config.ts PBAC
  // ==========================================
  console.log('\n--- Section 5: tools-limits.config.ts PBAC Enforcement Testing ---');

  await runTest('getToolLimits enforces free limits when no permissions are provided', () => {
    const limits = getToolLimits('merge-pdf', []);
    assert.strictEqual(limits.maxFiles, TOOLS_LIMITS['merge-pdf'].free.maxFiles);
    assert.strictEqual(limits.maxFileSizeMB, TOOLS_LIMITS['merge-pdf'].free.maxFileSizeMB);
    assert.strictEqual(limits.maxTotalSizeMB, TOOLS_LIMITS['merge-pdf'].free.maxTotalSizeMB);
    assert.strictEqual(limits.maxFiles, 25);
    console.log(`    Enforced free limits: maxFiles = 25.`);
  });

  await runTest('getToolLimits enforces premium limits when requiredPermission is present', () => {
    const limits = getToolLimits('merge-pdf', ['tools:merge:batch_500']);
    assert.strictEqual(limits.maxFiles, TOOLS_LIMITS['merge-pdf'].premium.maxFiles);
    assert.strictEqual(limits.maxFileSizeMB, TOOLS_LIMITS['merge-pdf'].premium.maxFileSizeMB);
    assert.strictEqual(limits.maxTotalSizeMB, TOOLS_LIMITS['merge-pdf'].premium.maxTotalSizeMB);
    assert.strictEqual(limits.maxFiles, 500);
    console.log(`    Enforced premium limits: maxFiles = 500.`);
  });

  await runTest('getToolLimits falls back to free if user has other unrelated permissions', () => {
    const limits = getToolLimits('merge-pdf', ['unrelated:permission', 'tools:other']);
    assert.strictEqual(limits.maxFiles, TOOLS_LIMITS['merge-pdf'].free.maxFiles);
    assert.strictEqual(limits.maxFiles, 25);
    console.log(`    Enforced free fallback for non-matching permissions.`);
  });

  await runTest('getToolLimits handles unknown toolId with safe fallback', () => {
    const limits = getToolLimits('unknown-tool', ['tools:all']);
    assert.strictEqual(limits.maxFiles, 1);
    assert.strictEqual(limits.maxFileSizeMB, 50);
    assert.strictEqual(limits.maxTotalSizeMB, 50);
    console.log(`    Handled unknown tool with safe default fallback.`);
  });

  console.log(`\n============================================================`);
  console.log(`[CHALLENGER 2] ALL ${passedTests}/${totalTests} EMPIRICAL TESTS PASSED SUCCESSFULLY!`);
  console.log(`============================================================\n`);
  process.exit(0);
}

runEmpiricalStressTests().catch((err) => {
  console.error('[CHALLENGER 2] Test suite encountered fatal error:', err);
  process.exit(1);
});
