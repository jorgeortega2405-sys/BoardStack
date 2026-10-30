import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
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

interface MockResponse {
  statusCode: number;
  headers: Record<string, any>;
  body: any;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  setHeader(name: string, value: any): MockResponse;
  send(data: any): MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, value: any) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runEmpiricalStressSuite() {
  console.log('================================================================');
  console.log('CHALLENGER 1: Milestone M1 Empirical Adversarial Stress Suite');
  console.log('================================================================\n');

  let totalTests = 0;
  let passedTests = 0;
  const findings: Array<{ name: string; error: any }> = [];

  async function test(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  [PASS] ${name}`);
    } catch (err: any) {
      console.error(`  [FAIL] ${name}: ${err?.message || err}`);
      findings.push({ name, error: err });
    }
  }

  // ------------------------------------------------------------
  // SECTION 1: isPdfBuffer Adversarial Testing
  // ------------------------------------------------------------
  console.log('--- 1. Testing isPdfBuffer ---');

  await test('Empty buffer returns false', () => {
    assert.strictEqual(isPdfBuffer(Buffer.alloc(0)), false);
  });

  await test('Truncated buffers (length 1..4) return false', () => {
    assert.strictEqual(isPdfBuffer(Buffer.from('%')), false);
    assert.strictEqual(isPdfBuffer(Buffer.from('%P')), false);
    assert.strictEqual(isPdfBuffer(Buffer.from('%PD')), false);
    assert.strictEqual(isPdfBuffer(Buffer.from('%PDF')), false);
  });

  await test('Corrupt magic bytes return false', () => {
    // 5th byte corrupted (%PDG-)
    assert.strictEqual(isPdfBuffer(Buffer.from([0x25, 0x50, 0x44, 0x47, 0x2d])), false);
    // Lowercase (%pdf-)
    assert.strictEqual(isPdfBuffer(Buffer.from('%pdf-1.4')), false);
    // Null byte prepended (\0%PDF-)
    assert.strictEqual(isPdfBuffer(Buffer.from('\x00%PDF-1.4')), false);
    // Missing percent (PDF--)
    assert.strictEqual(isPdfBuffer(Buffer.from('PDF--')), false);
    // Replaced hyphen (%PDF.)
    assert.strictEqual(isPdfBuffer(Buffer.from('%PDF.1.4')), false);
    // Binary images / random headers
    assert.strictEqual(isPdfBuffer(Buffer.from('\x89PNG\r\n\x1a\n')), false);
    assert.strictEqual(isPdfBuffer(Buffer.from('GIF89a')), false);
    assert.strictEqual(isPdfBuffer(Buffer.from('PK\x03\x04')), false);
  });

  await test('Valid PDF headers return true', () => {
    // Exactly 5 bytes
    assert.strictEqual(isPdfBuffer(Buffer.from('%PDF-')), true);
    // Standard version headers
    assert.strictEqual(isPdfBuffer(Buffer.from('%PDF-1.0\r\n')), true);
    assert.strictEqual(isPdfBuffer(Buffer.from('%PDF-1.4\n1 0 obj')), true);
    assert.strictEqual(isPdfBuffer(Buffer.from('%PDF-1.7')), true);
    assert.strictEqual(isPdfBuffer(Buffer.from('%PDF-2.0')), true);
  });

  await test('Non-buffer or falsy inputs return false safely without throwing', () => {
    assert.strictEqual(isPdfBuffer(null as any), false);
    assert.strictEqual(isPdfBuffer(undefined as any), false);
    assert.strictEqual(isPdfBuffer('' as any), false);
    assert.strictEqual(isPdfBuffer({} as any), false);
    assert.strictEqual(isPdfBuffer({ length: 10 } as any), false);
  });

  // ------------------------------------------------------------
  // SECTION 2: sanitizePdfFilename Adversarial Testing
  // ------------------------------------------------------------
  console.log('\n--- 2. Testing sanitizePdfFilename ---');

  await test('Path traversal injection vectors are neutralized', () => {
    assert.strictEqual(sanitizePdfFilename('../../etc/passwd'), 'passwd.pdf');
    assert.strictEqual(sanitizePdfFilename('../../../etc/shadow'), 'shadow.pdf');
    assert.strictEqual(sanitizePdfFilename('/var/log/syslog.pdf'), 'syslog.pdf');
    assert.strictEqual(sanitizePdfFilename('..\\..\\windows\\system32\\calc.exe'), 'calc.exe.pdf');
    assert.strictEqual(sanitizePdfFilename('C:\\Users\\admin\\secret.pdf'), 'secret.pdf');
    assert.strictEqual(sanitizePdfFilename('..\\..\\..\\secret.pdf'), 'secret.pdf');
    assert.strictEqual(sanitizePdfFilename('....//....//etc/passwd'), 'passwd.pdf');
  });

  await test('Null bytes and control characters are neutralized', () => {
    assert.strictEqual(sanitizePdfFilename('document\0.pdf'), 'document_.pdf');
    assert.strictEqual(sanitizePdfFilename('payload.pdf\0.exe'), 'payload.pdf_.exe.pdf');
    assert.strictEqual(sanitizePdfFilename('\x00'), '_.pdf');
    assert.strictEqual(sanitizePdfFilename('file\x1f\x7f.pdf'), 'file__.pdf');
  });

  await test('Weird unicode and foreign scripts are safely converted without throwing', () => {
    assert.strictEqual(sanitizePdfFilename('日本語.pdf'), '___.pdf');
    assert.strictEqual(sanitizePdfFilename('файл.pdf'), '____.pdf');
    assert.strictEqual(sanitizePdfFilename('éàçñ.pdf'), '____.pdf');
    assert.strictEqual(sanitizePdfFilename('document_🔥.pdf'), 'document___.pdf'); // emoji is 2 surrogate code units
    assert.strictEqual(sanitizePdfFilename('test\u200Bzero.pdf'), 'test_zero.pdf');
  });

  await test('Empty, whitespace, dots, and directory-only inputs fall back to defaultName', () => {
    assert.strictEqual(sanitizePdfFilename(''), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename('   '), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename('.'), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename('..'), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename('...'), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename('///'), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename('\\\\\\'), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename(null as any), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename(undefined), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename(123 as any), 'document.pdf');
    assert.strictEqual(sanitizePdfFilename({} as any), 'document.pdf');
  });

  await test('Custom defaultName is respected on fallback', () => {
    assert.strictEqual(sanitizePdfFilename('', 'custom_fallback.pdf'), 'custom_fallback.pdf');
    assert.strictEqual(sanitizePdfFilename('...', 'custom_fallback.pdf'), 'custom_fallback.pdf');
    assert.strictEqual(sanitizePdfFilename(undefined, 'custom_fallback.pdf'), 'custom_fallback.pdf');
  });

  await test('Filename extension handling (.pdf enforcement)', () => {
    assert.strictEqual(sanitizePdfFilename('report'), 'report.pdf');
    assert.strictEqual(sanitizePdfFilename('report.pdf'), 'report.pdf');
    assert.strictEqual(sanitizePdfFilename('report.PDF'), 'report.PDF');
    assert.strictEqual(sanitizePdfFilename('report.Pdf'), 'report.Pdf');
    assert.strictEqual(sanitizePdfFilename('report.docx'), 'report.docx.pdf');
    assert.strictEqual(sanitizePdfFilename('.pdf'), 'pdf.pdf');
  });

  // ------------------------------------------------------------
  // SECTION 3: cleanTextForWinAnsi Stress Testing
  // ------------------------------------------------------------
  console.log('\n--- 3. Testing cleanTextForWinAnsi ---');

  await test('ASCII printable characters (0x20..0x7E) are preserved untouched', () => {
    const ascii = 'The quick brown fox jumps over the lazy dog! 1234567890 @#$%^&*()_+~`-=[]{}|;:\'",.<>?/';
    assert.strictEqual(cleanTextForWinAnsi(ascii), ascii);
  });

  await test('Latin-1 Supplement accented characters (0xA0..0xFF) are preserved', () => {
    const latin1 = 'Café con Leche: é, à, ç, ñ, ü, ö, ä, ¡, ¿';
    assert.strictEqual(cleanTextForWinAnsi(latin1), latin1);
  });

  await test('Latin Extended-A characters decompose to ASCII equivalents via NFD', () => {
    // Š -> S, Ž -> Z, ć -> c, č -> c, ğ -> g
    assert.strictEqual(cleanTextForWinAnsi('ŠŽćčğ'), 'SZccg');
  });

  await test('Emojis and non-Latin scripts are stripped cleanly without throwing', () => {
    // Simple emojis
    assert.strictEqual(cleanTextForWinAnsi('Hello 😀 World 🚀!'), 'Hello  World !');
    // Complex ZWJ sequence emoji (family: 👨‍👩‍👧‍👦)
    assert.strictEqual(cleanTextForWinAnsi('👨‍👩‍👧‍👦'), '');
    // Cyrillic letters are stripped, spaces are preserved (0x20)
    assert.strictEqual(cleanTextForWinAnsi('Привет'), '');
    assert.strictEqual(cleanTextForWinAnsi('Привет мир'), ' ');
    // CJK
    assert.strictEqual(cleanTextForWinAnsi('你好世界'), '');
    // Arabic
    assert.strictEqual(cleanTextForWinAnsi('مرحبا'), '');
  });

  await test('Null, empty, undefined, and control characters return safe string without error', () => {
    assert.strictEqual(cleanTextForWinAnsi(''), '');
    assert.strictEqual(cleanTextForWinAnsi(null as any), '');
    assert.strictEqual(cleanTextForWinAnsi(undefined as any), '');
    assert.strictEqual(cleanTextForWinAnsi(12345 as any), '');
    assert.strictEqual(cleanTextForWinAnsi('\x00\x01\x1f'), '');
    // Newlines (\n = 0x0A) are outside 0x20..0x7E, stripped cleanly
    assert.strictEqual(cleanTextForWinAnsi('Line1\nLine2'), 'Line1Line2');
  });

  // ------------------------------------------------------------
  // SECTION 4: parseHexColor Stress Testing
  // ------------------------------------------------------------
  console.log('\n--- 4. Testing parseHexColor ---');

  await test('Standard 6-char hex colors parse to normalized RGB 0..1', () => {
    const white = parseHexColor('#ffffff');
    assert.strictEqual(white.r, 1);
    assert.strictEqual(white.g, 1);
    assert.strictEqual(white.b, 1);

    const black = parseHexColor('#000000');
    assert.strictEqual(black.r, 0);
    assert.strictEqual(black.g, 0);
    assert.strictEqual(black.b, 0);

    const red = parseHexColor('#ff0000');
    assert.strictEqual(red.r, 1);
    assert.strictEqual(red.g, 0);
    assert.strictEqual(red.b, 0);

    const green = parseHexColor('#00ff00');
    assert.strictEqual(green.r, 0);
    assert.strictEqual(green.g, 1);
    assert.strictEqual(green.b, 0);

    const blue = parseHexColor('#0000ff');
    assert.strictEqual(blue.r, 0);
    assert.strictEqual(blue.g, 0);
    assert.strictEqual(blue.b, 1);
  });

  await test('Standard 3-char shorthand hex colors parse to normalized RGB 0..1', () => {
    const white = parseHexColor('#fff');
    assert.strictEqual(white.r, 1);
    assert.strictEqual(white.g, 1);
    assert.strictEqual(white.b, 1);

    const red = parseHexColor('#f00');
    assert.strictEqual(red.r, 1);
    assert.strictEqual(red.g, 0);
    assert.strictEqual(red.b, 0);

    const blue = parseHexColor('#00f');
    assert.strictEqual(blue.r, 0);
    assert.strictEqual(blue.g, 0);
    assert.strictEqual(blue.b, 1);
  });

  await test('Hex colors without leading # and with whitespace parse correctly', () => {
    const white = parseHexColor('ffffff');
    assert.strictEqual(white.r, 1);
    assert.strictEqual(white.g, 1);
    assert.strictEqual(white.b, 1);

    const red3 = parseHexColor('  #f00  ');
    assert.strictEqual(red3.r, 1);
    assert.strictEqual(red3.g, 0);
    assert.strictEqual(red3.b, 0);
  });

  await test('Keywords transparent and none return black {r: 0, g: 0, b: 0}', () => {
    assert.deepStrictEqual(parseHexColor('transparent'), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(parseHexColor('none'), { r: 0, g: 0, b: 0 });
  });

  await test('Invalid hex strings and lengths fall back to {r: 0, g: 0, b: 0} without throwing or NaN', () => {
    const nonHex = parseHexColor('#zzzzzz');
    assert.strictEqual(nonHex.r, 0);
    assert.strictEqual(nonHex.g, 0);
    assert.strictEqual(nonHex.b, 0);

    const nonHex3 = parseHexColor('#xyz');
    assert.strictEqual(nonHex3.r, 0);
    assert.strictEqual(nonHex3.g, 0);
    assert.strictEqual(nonHex3.b, 0);

    // Invalid lengths
    assert.deepStrictEqual(parseHexColor('#f'), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(parseHexColor('#ff'), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(parseHexColor('#ffff'), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(parseHexColor('#fffff'), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(parseHexColor('#fffffff'), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(parseHexColor('#ffffffff'), { r: 0, g: 0, b: 0 });

    // Empty / null / undefined / number
    assert.deepStrictEqual(parseHexColor(''), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(parseHexColor(null as any), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(parseHexColor(undefined), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(parseHexColor(123456 as any), { r: 0, g: 0, b: 0 });
  });

  // ------------------------------------------------------------
  // SECTION 5: createZipBuffer Stress Testing
  // ------------------------------------------------------------
  console.log('\n--- 5. Testing createZipBuffer ---');

  await test('Empty file list creates valid empty ZIP buffer', async () => {
    const zip = await createZipBuffer([]);
    assert.ok(Buffer.isBuffer(zip));
    assert.ok(zip.length > 0);
    // Standard empty zip is 22 bytes with End of Central Directory record (PK\x05\x06)
    assert.strictEqual(zip[0], 0x50); // 'P'
    assert.strictEqual(zip[1], 0x4b); // 'K'
    assert.strictEqual(zip[2], 0x05);
    assert.strictEqual(zip[3], 0x06);
  });

  await test('Multiple files create standard ZIP archive with PK\\x03\\x04 header', async () => {
    const files = [
      { name: 'document1.pdf', buffer: Buffer.from('%PDF-1.4 file 1 content') },
      { name: 'document2.pdf', buffer: Buffer.from('%PDF-1.4 file 2 content') },
    ];
    const zip = await createZipBuffer(files);
    assert.ok(Buffer.isBuffer(zip));
    assert.strictEqual(zip[0], 0x50); // 'P'
    assert.strictEqual(zip[1], 0x4b); // 'K'
    assert.strictEqual(zip[2], 0x03);
    assert.strictEqual(zip[3], 0x04);
  });

  await test('Duplicate file names inside ZIP do not crash or reject', async () => {
    const files = [
      { name: 'document.pdf', buffer: Buffer.from('%PDF-1.4 v1') },
      { name: 'document.pdf', buffer: Buffer.from('%PDF-1.4 v2') },
    ];
    const zip = await createZipBuffer(files);
    assert.ok(Buffer.isBuffer(zip));
    assert.ok(zip.length > 0);
  });

  await test('Zero-byte file buffer inside ZIP works properly', async () => {
    const files = [
      { name: 'empty.pdf', buffer: Buffer.alloc(0) },
      { name: 'normal.pdf', buffer: Buffer.from('%PDF-1.4 content') },
    ];
    const zip = await createZipBuffer(files);
    assert.ok(Buffer.isBuffer(zip));
    assert.ok(zip.length > 0);
  });

  await test('Large buffer (5MB) compresses cleanly without memory error', async () => {
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024, 0x41); // 5MB of 'A'
    const files = [
      { name: 'large.pdf', buffer: largeBuffer },
    ];
    const zip = await createZipBuffer(files);
    assert.ok(Buffer.isBuffer(zip));
    // High compression ratio for repeating bytes
    assert.ok(zip.length < 50000, `Expected high compression for repeating buffer, got ${zip.length} bytes`);
  });

  // ------------------------------------------------------------
  // SECTION 6: getToolLimits PBAC Enforcement
  // ------------------------------------------------------------
  console.log('\n--- 6. Testing getToolLimits PBAC Enforcement ---');

  await test('All 21 configured tools in TOOLS_LIMITS have valid definitions', () => {
    const toolIds = Object.keys(TOOLS_LIMITS);
    assert.strictEqual(toolIds.length, 21, `Expected 21 tools in TOOLS_LIMITS, found ${toolIds.length}`);
    for (const toolId of toolIds) {
      const def = TOOLS_LIMITS[toolId];
      assert.ok(def.free, `${toolId} missing free definition`);
      assert.ok(def.premium, `${toolId} missing premium definition`);
      assert.ok(def.free.maxFiles > 0, `${toolId} free maxFiles must be > 0`);
      assert.ok(def.free.maxFileSizeMB > 0, `${toolId} free maxFileSizeMB must be > 0`);
      assert.ok(def.free.maxTotalSizeMB > 0, `${toolId} free maxTotalSizeMB must be > 0`);
      assert.ok(def.premium.maxFiles >= def.free.maxFiles, `${toolId} premium maxFiles should be >= free`);
      assert.ok(def.premium.maxFileSizeMB >= def.free.maxFileSizeMB, `${toolId} premium maxFileSizeMB should be >= free`);
      assert.ok(def.premium.requiredPermission, `${toolId} premium must declare requiredPermission`);
    }
  });

  await test('getToolLimits returns free limits when permissions list is empty', () => {
    const limits = getToolLimits('merge-pdf', []);
    assert.strictEqual(limits.maxFiles, 25);
    assert.strictEqual(limits.maxFileSizeMB, 50);
    assert.strictEqual(limits.maxTotalSizeMB, 100);
  });

  await test('getToolLimits returns free limits when permissions argument is undefined (default)', () => {
    const limits = getToolLimits('merge-pdf');
    assert.strictEqual(limits.maxFiles, 25);
  });

  await test('getToolLimits returns premium limits when exact requiredPermission is present', () => {
    // merge-pdf requires 'tools:merge:batch_500'
    const limits = getToolLimits('merge-pdf', ['tools:merge:batch_500']);
    assert.strictEqual(limits.maxFiles, 500);
    assert.strictEqual(limits.maxFileSizeMB, 1000);
    assert.strictEqual(limits.maxTotalSizeMB, 2000);

    // split-pdf requires 'tools:split:by_size'
    const splitLimits = getToolLimits('split-pdf', ['tools:split:by_size']);
    assert.strictEqual(splitLimits.maxFileSizeMB, 1000);

    // summarize-pdf requires 'tools:ai:advanced'
    const aiLimits = getToolLimits('summarize-pdf', ['tools:ai:advanced']);
    assert.strictEqual(aiLimits.maxFileSizeMB, 200);
  });

  await test('getToolLimits ignores unrelated permissions and enforces free limits', () => {
    const limits = getToolLimits('merge-pdf', ['tools:high_size_limit', 'tools:ai:advanced', 'random:perm']);
    assert.strictEqual(limits.maxFiles, 25);
  });

  await test('getToolLimits handles unknown or malformed toolId safely', () => {
    const limits = getToolLimits('non-existent-tool', ['tools:all']);
    assert.strictEqual(limits.maxFiles, 1);
    assert.strictEqual(limits.maxFileSizeMB, 50);
    assert.strictEqual(limits.maxTotalSizeMB, 50);

    const emptyLimits = getToolLimits('', ['tools:all']);
    assert.strictEqual(emptyLimits.maxFiles, 1);
  });

  await test('getToolLimits behavior when permissions is null or undefined', () => {
    // undefined cleanly defaults to []
    const undefLimits = getToolLimits('merge-pdf', undefined);
    assert.strictEqual(undefLimits.maxFiles, 25);

    // null permissions: tests whether TypeError occurs due to unhandled null
    let nullThrew = false;
    try {
      getToolLimits('merge-pdf', null as any);
    } catch (err: any) {
      nullThrew = true;
      assert.ok(err instanceof TypeError);
    }
    if (nullThrew) {
      console.log('    [OBSERVED BEHAVIOR] getToolLimits throws TypeError when permissions is null');
    }
  });

  // ------------------------------------------------------------
  // SECTION 7: handleToolDownload Stress Testing
  // ------------------------------------------------------------
  console.log('\n--- 7. Testing handleToolDownload ---');

  await test('Missing fileId or token returns 404 with generic message', async () => {
    const req: any = { params: {} };
    const res = createMockResponse();
    await handleToolDownload(req, res as any);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error, 'El archivo solicitado ha expirado o no existe.');
  });

  await test('Non-existent fileId returns 404 with generic message', async () => {
    const req: any = { params: { fileId: 'not_found_token_99999' } };
    const res = createMockResponse();
    await handleToolDownload(req, res as any);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error, 'El archivo solicitado ha expirado o no existe.');
  });

  await test('Valid stored item sends buffer with correct download headers', async () => {
    const testId = 'challenger1_test_file_id';
    const testBuffer = Buffer.from('%PDF-1.4 test download data');
    const filename = 'challenger_result.pdf';

    await storeTempFile(testId, {
      buffer: testBuffer,
      contentType: 'application/pdf',
      createdAt: Date.now(),
      filename,
    });

    try {
      const req: any = { params: { fileId: testId } };
      const res = createMockResponse();
      await handleToolDownload(req, res as any);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'application/pdf');
      assert.strictEqual(res.headers['content-disposition'], `attachment; filename="${encodeURIComponent(filename)}"`);
      assert.strictEqual(res.headers['content-length'], testBuffer.length);
      assert.strictEqual(res.headers['cache-control'], 'no-cache, no-store, must-revalidate');
      assert.deepStrictEqual(res.body, testBuffer);
    } finally {
      await deleteTempFile(testId);
    }
  });

  // ------------------------------------------------------------
  // SECTION 7: upload.util.ts Middleware Stress Testing
  // ------------------------------------------------------------
  console.log('\n--- 7. Testing upload.util.ts Middleware ---');

  function createMockUploadReq(bodyContent: string, boundary: string): any {
    const stream = new Readable({
      read() {
        this.push(Buffer.from(bodyContent));
        this.push(null);
      },
    });
    return Object.assign(stream, {
      headers: {
        'content-length': String(Buffer.byteLength(bodyContent)),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      method: 'POST',
    });
  }

  await test('createPdfUploadMiddleware rejects invalid format with 400', async () => {
    const middleware = createPdfUploadMiddleware({ maxFiles: 1, maxFileSizeMB: 10 });
    const boundary = '----WebKitFormBoundaryTestTxt';
    const bodyContent = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      'Plain text file, not a PDF',
      `--${boundary}--`,
    ].join('\r\n');

    const req = await createMockUploadReq(bodyContent, boundary);
    const res = createMockResponse();
    let nextCalled = false;

    await new Promise<void>((resolve) => {
      middleware(req, res as any, () => {
        nextCalled = true;
        resolve();
      });
      const origJson = res.json.bind(res);
      res.json = (data: any) => {
        origJson(data);
        resolve();
        return res;
      };
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error, 'Formato no compatible. Solo se permiten documentos en formato PDF.');
  });

  await test('createPdfUploadMiddleware rejects oversized files with 400', async () => {
    // Note: maxFileSizeMB * 1024 * 1024 should be an integer to avoid Multer integer limit errors
    const middleware = createPdfUploadMiddleware({ maxFileSizeMB: 1, maxFiles: 1 });
    const boundary = '----WebKitFormBoundaryOversized';
    // 1.5MB of payload (> 1MB)
    const largePayload = 'X'.repeat(1.5 * 1024 * 1024);
    const bodyContent = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="oversize.pdf"',
      'Content-Type: application/pdf',
      '',
      `%PDF-1.4\n${largePayload}`,
      `--${boundary}--`,
    ].join('\r\n');

    const req = await createMockUploadReq(bodyContent, boundary);
    const res = createMockResponse();
    let nextCalled = false;

    await new Promise<void>((resolve) => {
      middleware(req, res as any, () => {
        nextCalled = true;
        resolve();
      });
      const origJson = res.json.bind(res);
      res.json = (data: any) => {
        origJson(data);
        resolve();
        return res;
      };
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.success, false);
    assert.ok(res.body?.error.includes('supera el límite máximo permitido'));
  });

  await test('createPdfUploadMiddleware accepts valid PDF upload and passes to next()', async () => {
    const middleware = createPdfUploadMiddleware({ maxFileSizeMB: 10, maxFiles: 1 });
    const boundary = '----WebKitFormBoundaryValidPdf';
    const pdfData = '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF';
    const bodyContent = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="sample.pdf"',
      'Content-Type: application/pdf',
      '',
      pdfData,
      `--${boundary}--`,
    ].join('\r\n');

    const req = await createMockUploadReq(bodyContent, boundary);
    const res = createMockResponse();
    let nextCalled = false;

    await new Promise<void>((resolve) => {
      middleware(req, res as any, () => {
        nextCalled = true;
        resolve();
      });
      const origJson = res.json.bind(res);
      res.json = (data: any) => {
        origJson(data);
        resolve();
        return res;
      };
    });

    assert.strictEqual(nextCalled, true);
    assert.ok(req.file);
    assert.strictEqual(req.file.originalname, 'sample.pdf');
  });

  // ------------------------------------------------------------
  // SECTION 8: Real PDF Text Extraction & Ghostscript
  // ------------------------------------------------------------
  console.log('\n--- 8. Testing extractPdfText and Ghostscript ---');

  await test('getGhostscriptCommand returns a non-empty string', () => {
    const gs = getGhostscriptCommand();
    assert.ok(typeof gs === 'string' && gs.length > 0);
  });

  await test('extractPdfText with empty buffer returns empty result without throwing', async () => {
    const result = await extractPdfText(Buffer.alloc(0));
    assert.strictEqual(result.fullText, '');
    assert.deepStrictEqual(result.pages, []);
  });

  await test('extractPdfText with corrupted buffer returns empty result without throwing', async () => {
    const result = await extractPdfText(Buffer.from('Not a PDF at all'));
    assert.strictEqual(result.fullText, '');
    assert.deepStrictEqual(result.pages, []);
  });

  await test('extractPdfText with real PDF muestra_1_pagina.pdf extracts text', async () => {
    const filePath = path.join(ARCHIVOS_DIR, 'muestra_1_pagina.pdf');
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const result = await extractPdfText(buffer);
      assert.strictEqual(result.pages.length, 1);
      assert.ok(result.fullText.length > 0);
    }
  });

  await test('extractPdfText with protected PDF handles gracefully without crashing', async () => {
    const filePath = path.join(ARCHIVOS_DIR, 'muestra_protegida.pdf');
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const result = await extractPdfText(buffer);
      assert.strictEqual(typeof result.fullText, 'string');
      assert.ok(Array.isArray(result.pages));
    }
  });

  console.log('\n================================================================');
  console.log(`CHALLENGER 1 SUMMARY: ${passedTests}/${totalTests} PASSED. Findings: ${findings.length}`);
  console.log('================================================================');

  if (findings.length > 0) {
    console.error('\nList of Failures/Findings:');
    for (const f of findings) {
      console.error(`- ${f.name}: ${f.error?.message || f.error}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

runEmpiricalStressSuite().catch((err) => {
  console.error('Fatal unhandled error in test suite:', err);
  process.exit(1);
});
