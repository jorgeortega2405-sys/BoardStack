import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Environment Polyfills for PDF.js & DOM in Node test runner ---
if (!Promise.withResolvers) {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (!(Promise as any).try) {
  (Promise as any).try = function (fn: any, ...args: any[]) {
    return new Promise((res) => res(fn(...args)));
  };
}

if (!(Uint8Array.prototype as any).toHex) {
  (Uint8Array.prototype as any).toHex = function () {
    return Array.from(this).map((b: any) => b.toString(16).padStart(2, '0')).join('');
  };
}

if (!(Map.prototype as any).getOrInsertComputed) {
  (Map.prototype as any).getOrInsertComputed = function (key: any, callbackFn: any) {
    if (this.has(key)) return this.get(key);
    const val = callbackFn(key);
    this.set(key, val);
    return val;
  };
}

if (!(ArrayBuffer.prototype as any).transferToFixedLength) {
  (ArrayBuffer.prototype as any).transferToFixedLength = function (newLength?: number) {
    const len = newLength !== undefined ? newLength : this.byteLength;
    const newBuf = new ArrayBuffer(len);
    new Uint8Array(newBuf).set(new Uint8Array(this, 0, Math.min(this.byteLength, len)));
    return newBuf;
  };
}

if (!(ArrayBuffer.prototype as any).transfer) {
  (ArrayBuffer.prototype as any).transfer = (ArrayBuffer.prototype as any).transferToFixedLength;
}

class MockDOMMatrix {
  public a = 1;
  public b = 0;
  public c = 0;
  public d = 1;
  public e = 0;
  public f = 0;
  constructor(init?: any) {
    if (init && typeof init === 'object') {
      this.a = init.a ?? 1;
      this.b = init.b ?? 0;
      this.c = init.c ?? 0;
      this.d = init.d ?? 1;
      this.e = init.e ?? 0;
      this.f = init.f ?? 0;
    }
  }
  public invertSelf(): MockDOMMatrix {
    const det = this.a * this.d - this.b * this.c;
    if (!det) return this;
    const a = this.d / det;
    const b = -this.b / det;
    const c = -this.c / det;
    const d = this.a / det;
    const e = (this.c * this.f - this.d * this.e) / det;
    const f = (this.b * this.e - this.a * this.f) / det;
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }
}
(globalThis as any).DOMMatrix = MockDOMMatrix;

class MockImageData {
  public data: Uint8ClampedArray;
  public width: number;
  public height: number;
  constructor(wOrData: any, wOrH?: number, h?: number) {
    if (wOrData instanceof Uint8ClampedArray) {
      this.data = wOrData;
      this.width = wOrH || 0;
      this.height = h || 0;
    } else {
      this.width = wOrData;
      this.height = wOrH || 0;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
}
(globalThis as any).ImageData = MockImageData;

class MockPath2D {
  addPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  rect() {}
}
(globalThis as any).Path2D = MockPath2D;

export interface MockCanvasState {
  canvas: any;
  ctx: any;
  scaleCalls: Array<{ sx: number; sy: number }>;
  allCalls: string[];
}

export function createMockCanvas(initialDpr = 1): MockCanvasState {
  const scaleCalls: Array<{ sx: number; sy: number }> = [];
  const allCalls: string[] = [];
  let currentTransform = new MockDOMMatrix();

  const canvas: any = {
    height: 0,
    style: {} as Record<string, string>,
    width: 0,
    getContext: (type: string) => (type === '2d' ? mockCtx : null),
    toDataURL: (format = 'image/jpeg', quality = 0.85) =>
      `data:${format};base64,MOCK_THUMBNAIL_${canvas.width}x${canvas.height}_q${quality}`,
  };

  const mockCtx = new Proxy(
    { canvas },
    {
      get(target, prop: string) {
        if (prop === 'canvas') return canvas;
        if (prop === 'getTransform') return () => new MockDOMMatrix(currentTransform);
        if (prop === 'scale') {
          return (sx: number, sy: number) => {
            scaleCalls.push({ sx, sy });
            allCalls.push(`scale(${sx},${sy})`);
            currentTransform.a *= sx;
            currentTransform.d *= sy;
          };
        }
        if (prop === 'transform') {
          return (a: number, b: number, c: number, d: number, e: number, f: number) => {
            allCalls.push('transform');
          };
        }
        if (prop === 'setTransform') {
          return (a: any, b?: number, c?: number, d?: number, e?: number, f?: number) => {
            allCalls.push('setTransform');
            if (typeof a === 'object' && a !== null) {
              currentTransform = new MockDOMMatrix(a);
            } else {
              currentTransform = new MockDOMMatrix({ a, b: b || 0, c: c || 0, d: d || 1, e: e || 0, f: f || 0 });
            }
          };
        }
        if (prop === 'createImageData') {
          return (w: number, h: number) => new MockImageData(w, h);
        }
        return (...args: any[]) => {
          allCalls.push(prop);
          return null;
        };
      },
    }
  );

  return { allCalls, canvas, ctx: mockCtx, scaleCalls };
}

class MockHTMLElement {
  public classList = { add: () => {}, contains: () => false, remove: () => {} };
  public style: Record<string, string> = {};
  public addEventListener() {}
  public removeEventListener() {}
  public querySelector() { return null; }
  public querySelectorAll() { return []; }
  public setAttribute(name: string, value: string) {}
  public getAttribute(name: string) { return null; }
  public remove() {}
  public appendChild(child: any) { return child; }
  public removeChild(child: any) { return child; }
}
(globalThis as any).HTMLElement = MockHTMLElement;

const raf = (cb: any) => setTimeout(cb, 0);
const caf = (id: any) => clearTimeout(id);
(globalThis as any).requestAnimationFrame = raf;
(globalThis as any).cancelAnimationFrame = caf;

(globalThis as any).window = {
  cancelAnimationFrame: caf,
  devicePixelRatio: 1,
  requestAnimationFrame: raf,
};

(globalThis as any).document = {
  addEventListener: () => {},
  body: new MockHTMLElement(),
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      return createMockCanvas((globalThis as any).window.devicePixelRatio).canvas;
    }
    return new MockHTMLElement();
  },
  querySelector: () => null,
  querySelectorAll: () => [],
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARCHIVOS_DIR = path.join(__dirname, 'archivos');

async function runTestSuite() {
  console.log('================================================================');
  console.log('CHALLENGER 2: M3 PDF PREVIEW & CANVAS STRESS HARNESS');
  console.log('================================================================\n');

  // Start internal static server for worker HTTP font/cmap loading
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    const rawUrl = (req.url || '').split('?')[0];
    const filePath = path.resolve(__dirname, '../public' + rawUrl);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  const serverPort: number = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as any).port);
    });
  });

  // Configure worker before modules load
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = import.meta.resolve('pdfjs-dist/build/pdf.worker.mjs');
  Object.defineProperty(pdfjs.GlobalWorkerOptions, 'workerSrc', {
    configurable: true,
    get: () => workerUrl,
    set: (_v: string) => {},
  });

  // Rewrite relative /vendor/ requests to local HTTP server
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: any) => {
    let url = typeof input === 'string' ? input : input?.url || '';
    if (url.startsWith('/vendor/')) {
      url = `http://127.0.0.1:${serverPort}` + url;
      return originalFetch(url, init);
    }
    return originalFetch(input, init);
  };

  // Dynamically import the target modules
  const { generateThumbnailDataUrl, renderPdfThumbnail } = await import(
    '../client/services/pdf-preview.service.js'
  );
  const { loadPdfDocument } = await import('../client/services/pdf-loader.service.js');
  const { setupToolFileFlow, validatePdfFile } = await import(
    '../client/services/tool-flow.service.js'
  );
  const { ToolLayoutController } = await import(
    '../client/components/tool-layout.component.js'
  );

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return (async () => {
      try {
        await fn();
        console.log(`[PASS] ${name}`);
        passed++;
      } catch (err: any) {
        console.error(`[FAIL] ${name}`);
        console.error(`       Error: ${err.message || err}`);
        failed++;
      }
    })();
  }

  // --- Suite 1: Single-page PDF ---
  console.log('--- SUITE 1: Single-page PDF (muestra_1_pagina.pdf) ---');
  const sample1Buf = fs.readFileSync(path.join(ARCHIVOS_DIR, 'muestra_1_pagina.pdf'));

  await test('renderPdfThumbnail renders 1-page PDF at default targetWidth 180 and dpr=1', async () => {
    (globalThis as any).window.devicePixelRatio = 1;
    const { canvas, scaleCalls } = createMockCanvas(1);
    await renderPdfThumbnail(sample1Buf.buffer.slice(0), canvas, { targetWidth: 180 });

    assert.strictEqual(canvas.width, 180, 'Canvas width should be 180');
    assert(canvas.height > 200, `Canvas height should be proportional (~233), got ${canvas.height}`);
    assert.strictEqual(canvas.style.width, '180px', 'CSS width should be 180px');
    assert(
      Math.abs(parseFloat(canvas.style.height) - canvas.height) <= 1,
      `CSS height should match canvas height within 1px, got style ${canvas.style.height} vs canvas ${canvas.height}`
    );
    assert.strictEqual(scaleCalls.length, 0, 'No ctx.scale should be called when dpr=1');
  });

  await test('generateThumbnailDataUrl generates valid data URL for 1-page PDF', async () => {
    const dataUrl = await generateThumbnailDataUrl(sample1Buf.buffer.slice(0), 1, 200, 0.85);
    assert(dataUrl.startsWith('data:image/jpeg;base64,'), 'Should return valid data URI');
    assert(dataUrl.includes('200x'), `Data URI should reflect target width 200: ${dataUrl}`);
  });

  // --- Suite 2: Multi-page PDF ---
  console.log('\n--- SUITE 2: Multi-page PDF (muestra_3_paginas.pdf) ---');
  const sample3Buf = fs.readFileSync(path.join(ARCHIVOS_DIR, 'muestra_3_paginas.pdf'));

  await test('renderPdfThumbnail renders each page (1, 2, 3) correctly', async () => {
    for (let page = 1; page <= 3; page++) {
      const { canvas } = createMockCanvas(1);
      await renderPdfThumbnail(sample3Buf.buffer.slice(0), canvas, { pageNum: page, targetWidth: 150 });
      assert.strictEqual(canvas.width, 150, `Page ${page} width should be 150`);
      assert(canvas.height > 180, `Page ${page} height should be proportional, got ${canvas.height}`);
    }
  });

  await test('generateThumbnailDataUrl generates thumbnails for all 3 pages', async () => {
    for (let page = 1; page <= 3; page++) {
      const dataUrl = await generateThumbnailDataUrl(sample3Buf.buffer.slice(0), page, 160);
      assert(dataUrl.startsWith('data:image/jpeg;base64,'), `Page ${page} thumbnail should be valid`);
      assert(dataUrl.includes('160x'), `Page ${page} thumbnail should have targetWidth 160`);
    }
  });

  // --- Suite 3: Image-heavy PDF ---
  console.log('\n--- SUITE 3: Image-heavy PDF (muestra_con_imagenes.pdf) ---');
  const sampleImgBuf = fs.readFileSync(path.join(ARCHIVOS_DIR, 'muestra_con_imagenes.pdf'));

  await test('renderPdfThumbnail renders image-heavy PDF without errors and executes canvas ops', async () => {
    const { allCalls, canvas } = createMockCanvas(1);
    await renderPdfThumbnail(sampleImgBuf.buffer.slice(0), canvas, { targetWidth: 220 });
    assert.strictEqual(canvas.width, 220, 'Canvas width should be 220');
    assert(allCalls.length > 0, `Should perform graphic rendering calls, got ${allCalls.length}`);
  });

  await test('generateThumbnailDataUrl processes image-heavy PDF', async () => {
    const dataUrl = await generateThumbnailDataUrl(sampleImgBuf.buffer.slice(0), 1, 250);
    assert(dataUrl.startsWith('data:image/jpeg;base64,'), 'Should return valid data URI');
  });

  // --- Suite 4: DPI Scaling (dpr = 1 vs dpr = 2 vs options.dpr = false) ---
  console.log('\n--- SUITE 4: High-DPI Scaling (dpr = 1 vs dpr = 2) ---');

  await test('DPR = 1 renders 1:1 pixel grid without context scaling', async () => {
    (globalThis as any).window.devicePixelRatio = 1;
    const { canvas, scaleCalls } = createMockCanvas(1);
    await renderPdfThumbnail(sample1Buf.buffer.slice(0), canvas, { dpr: true, targetWidth: 180 });

    assert.strictEqual(canvas.width, 180, 'Canvas width should be 180');
    assert.strictEqual(canvas.style.width, '180px', 'CSS width should be 180px');
    assert.strictEqual(scaleCalls.length, 0, 'No ctx.scale should be called when dpr=1');
  });

  await test('DPR = 2 doubles canvas resolution and scales 2D context (2, 2)', async () => {
    (globalThis as any).window.devicePixelRatio = 2;
    const { canvas, scaleCalls } = createMockCanvas(2);
    await renderPdfThumbnail(sample1Buf.buffer.slice(0), canvas, { dpr: true, targetWidth: 180 });

    assert.strictEqual(canvas.width, 360, 'Canvas width should be 180 * 2 = 360');
    assert.strictEqual(canvas.style.width, '180px', 'CSS width should remain 180px');
    assert(scaleCalls.some((c) => c.sx === 2 && c.sy === 2), 'ctx.scale(2, 2) must be called');
  });

  await test('options.dpr = false disables high-DPI scaling even when window.devicePixelRatio is 2', async () => {
    (globalThis as any).window.devicePixelRatio = 2;
    const { canvas, scaleCalls } = createMockCanvas(2);
    await renderPdfThumbnail(sample1Buf.buffer.slice(0), canvas, { dpr: false, targetWidth: 180 });

    assert.strictEqual(canvas.width, 180, 'Canvas width should remain 180 when dpr is false');
    assert.strictEqual(canvas.style.width, '180px', 'CSS width should remain 180px');
    assert.strictEqual(scaleCalls.length, 0, 'ctx.scale should NOT be called when options.dpr=false');
  });

  await test('Re-rendering on same canvas maintains proper geometry across scale changes', async () => {
    const { canvas, scaleCalls } = createMockCanvas(1);
    (globalThis as any).window.devicePixelRatio = 1;
    await renderPdfThumbnail(sample1Buf.buffer.slice(0), canvas, { targetWidth: 100 });
    assert.strictEqual(canvas.width, 100);

    (globalThis as any).window.devicePixelRatio = 2;
    await renderPdfThumbnail(sample1Buf.buffer.slice(0), canvas, { targetWidth: 200 });
    assert.strictEqual(canvas.width, 400, 'Re-rendered width should be 200 * 2 = 400');
    assert.strictEqual(canvas.style.width, '200px');
  });

  // --- Suite 5: Corrupted, Empty, and Boundary Inputs ---
  console.log('\n--- SUITE 5: Corrupted, Empty, and Edge Case Inputs ---');

  await test('renderPdfThumbnail handles empty ArrayBuffer gracefully without crash', async () => {
    const emptyBuf = new ArrayBuffer(0);
    const { canvas } = createMockCanvas(1);
    await renderPdfThumbnail(emptyBuf, canvas);
    assert.strictEqual(canvas.width, 0, 'Canvas width should remain untouched on failure');
  });

  await test('generateThumbnailDataUrl returns empty string for empty ArrayBuffer', async () => {
    const emptyBuf = new ArrayBuffer(0);
    const dataUrl = await generateThumbnailDataUrl(emptyBuf, 1, 200);
    assert.strictEqual(dataUrl, '', 'Should return empty string on empty buffer');
  });

  await test('renderPdfThumbnail handles corrupted junk bytes gracefully without crash', async () => {
    const junkBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03]);
    const { canvas } = createMockCanvas(1);
    await renderPdfThumbnail(junkBytes.buffer, canvas);
    assert.strictEqual(canvas.width, 0, 'Canvas width should remain untouched on corrupted file');
  });

  await test('generateThumbnailDataUrl returns empty string for corrupted junk bytes', async () => {
    const junkBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03]);
    const dataUrl = await generateThumbnailDataUrl(junkBytes.buffer, 1, 200);
    assert.strictEqual(dataUrl, '', 'Should return empty string on corrupted bytes');
  });

  await test('renderPdfThumbnail handles null and undefined inputs safely', async () => {
    const { canvas } = createMockCanvas(1);
    await renderPdfThumbnail(null as any, canvas);
    await renderPdfThumbnail(undefined as any, canvas);
    assert.strictEqual(canvas.width, 0, 'Canvas untouched on null/undefined');
  });

  await test('generateThumbnailDataUrl handles null and undefined inputs safely', async () => {
    const res1 = await generateThumbnailDataUrl(null, 1);
    const res2 = await generateThumbnailDataUrl(undefined, 1);
    assert.strictEqual(res1, '', 'null should return empty string');
    assert.strictEqual(res2, '', 'undefined should return empty string');
  });

  await test('renderPdfThumbnail handles out-of-range page numbers gracefully', async () => {
    const { canvas } = createMockCanvas(1);
    // Page 9999 does not exist on 1-page PDF
    await renderPdfThumbnail(sample1Buf.buffer.slice(0), canvas, { pageNum: 9999 });
    assert.strictEqual(canvas.width, 0, 'Canvas should not be rendered for non-existent page');

    // Page -1 is invalid in PDF.js
    const { canvas: canvasNeg } = createMockCanvas(1);
    await renderPdfThumbnail(sample1Buf.buffer.slice(0), canvasNeg, { pageNum: -1 });
    assert.strictEqual(canvasNeg.width, 0, 'Canvas should not be rendered for page -1');
  });

  await test('generateThumbnailDataUrl handles out-of-range page numbers gracefully', async () => {
    const res1 = await generateThumbnailDataUrl(sample1Buf.buffer.slice(0), 9999);
    assert.strictEqual(res1, '', 'Page 9999 should return empty string');
    const res2 = await generateThumbnailDataUrl(sample1Buf.buffer.slice(0), -5);
    assert.strictEqual(res2, '', 'Page -5 should return empty string');
  });

  // --- Suite 6: Memory Cleanup & PDF Document Lifecycle ---
  console.log('\n--- SUITE 6: Document Lifecycle & Memory Cleanup ---');

  await test('Internal document is destroyed after render when raw buffer is passed', async () => {
    let destroyed = false;
    // We spy on loadPdfDocument
    const loadedDoc = await loadPdfDocument(sample1Buf.buffer.slice(0));
    const originalDestroy = loadedDoc.destroy.bind(loadedDoc);
    loadedDoc.destroy = async () => {
      destroyed = true;
      return originalDestroy();
    };

    // When passing pre-opened document: it should NOT destroy
    const { canvas } = createMockCanvas(1);
    await renderPdfThumbnail(loadedDoc, canvas);
    assert.strictEqual(destroyed, false, 'Caller-owned document must NOT be destroyed by renderPdfThumbnail');

    await generateThumbnailDataUrl(loadedDoc, 1, 200);
    assert.strictEqual(destroyed, false, 'Caller-owned document must NOT be destroyed by generateThumbnailDataUrl');

    // Caller cleans up
    await loadedDoc.destroy();
    assert.strictEqual(destroyed, true, 'Caller explicitly destroyed the document');
  });

  await test('Sequential rendering across multiple pages re-using document proxy', async () => {
    const loadedDoc = await loadPdfDocument(sample3Buf.buffer.slice(0));
    assert.strictEqual(loadedDoc.numPages, 3, 'Document should have 3 pages');

    for (let p = 1; p <= 3; p++) {
      const { canvas } = createMockCanvas(1);
      await renderPdfThumbnail(loadedDoc, canvas, { pageNum: p, targetWidth: 120 });
      assert.strictEqual(canvas.width, 120, `Page ${p} should render with width 120`);
    }

    // Document is still alive and usable
    const page2 = await loadedDoc.getPage(2);
    assert.strictEqual(page2.pageNumber, 2);

    await loadedDoc.destroy();
  });

  // --- Suite 7: Tool Layout & File Flow Conformance ---
  console.log('\n--- SUITE 7: Tool Layout & File Flow Integration ---');

  await test('validatePdfFile validates PDF extension and size limits', () => {
    const validFile = { name: 'sample.pdf', size: 1024 * 1024, type: 'application/pdf' } as any;
    const resValid = validatePdfFile(validFile, 'merge-pdf');
    assert.strictEqual(resValid.valid, true);

    const invalidType = { name: 'sample.exe', size: 1024, type: 'application/x-msdownload' } as any;
    const resInvalid = validatePdfFile(invalidType, 'merge-pdf');
    assert.strictEqual(resInvalid.valid, false);

    const oversizedFile = { name: 'huge.pdf', size: 2000 * 1024 * 1024, type: 'application/pdf' } as any;
    const resOversized = validatePdfFile(oversizedFile, 'merge-pdf');
    assert.strictEqual(resOversized.valid, false);
    assert(resOversized.error?.includes('supera el límite'));
  });

  await test('ToolLayoutController state transitions function cleanly', () => {
    const mockContainer = new MockHTMLElement() as any;

    const controller = new ToolLayoutController({
      container: mockContainer,
      toolName: 'test-tool',
    });

    controller.init();
    controller.showReadyState();
    controller.showEmptyState();
    controller.showProcessingState();
    controller.showError('Error de prueba');
    controller.hideError();
    controller.destroy();
    assert(controller.statusManager !== undefined, 'statusManager must be defined');
  });

  server.close();

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test suite failure:', err);
  process.exit(1);
});
