import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe } from 'node:test';
import { API_ROUTES } from '../client/config/api-routes.js';
import { TOOLS_REGISTRY } from '../client/config/tools.registry.js';

describe('BoardPDF - Frontend Views, Templates & Options Contract Verification', () => {
  const appRootDir = fs.existsSync(path.resolve(process.cwd(), 'src/index.ts'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'apps/BoardPDF');
  const publicToolsDir = path.resolve(appRootDir, 'public/views/tools');
  const clientViewsDir = path.resolve(appRootDir, 'client/views/tools');
  const backendToolsDir = path.resolve(appRootDir, 'src/tools');

  test('Tool Registry has registered tools', () => {
    assert.ok(TOOLS_REGISTRY.length >= 20);
    const uniqueIds = new Set(TOOLS_REGISTRY.map((t) => t.id));
    assert.strictEqual(uniqueIds.size, TOOLS_REGISTRY.length);
  });

  describe('HTML Templates integrity (Zero IDs, Type First for Buttons, Core data-refs)', () => {
    const templateFolders = fs.readdirSync(publicToolsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const folder of templateFolders) {
      test(`verifies HTML template for tool: ${folder}`, () => {
        const htmlFiles = fs.readdirSync(path.join(publicToolsDir, folder)).filter((f) => f.endsWith('.html'));
        assert.ok(htmlFiles.length > 0);

        for (const hf of htmlFiles) {
          const content = fs.readFileSync(path.join(publicToolsDir, folder, hf), 'utf-8');

          // Rule 3: Zero ID attributes
          const idMatches = content.match(/\bid\s*=\s*["'][^"']+["']/gi);
          assert.strictEqual(idMatches, null, `Template ${folder}/${hf} contains forbidden id attribute: ${idMatches}`);

          // Rule 4: Buttons must have type first
          const badButtons = [...content.matchAll(/<button\s+([^>]*?)>/gi)]
            .filter((m) => !m[1].trim().startsWith('type='));
          assert.strictEqual(
            badButtons.length,
            0,
            `Template ${folder}/${hf} has button without type as first attribute: ${badButtons.map((b) => b[0]).join(', ')}`
          );

          // Required core data-refs for standard tools
          assert.ok(
            content.includes('data-ref="') || content.includes("data-ref='"),
            `Template ${folder}/${hf} missing semantic data-ref attributes`
          );
        }
      });
    }
  });

  describe('Tool View Option Controls and HTML Bindings', () => {
    test('compress-pdf: options binding for compression levels', () => {
      const html = fs.readFileSync(path.join(publicToolsDir, 'compress-pdf/compress-pdf.html'), 'utf-8');
      assert.ok(html.includes('data-ref="radio-compress-recommended"'));
      assert.ok(html.includes('data-ref="radio-compress-extreme"'));
      assert.ok(html.includes('data-ref="radio-compress-low"'));
      assert.ok(html.includes('data-ref="btn-compress-action"'));
    });

    test('split-pdf: options binding for ranges, extraction, and merge toggle', () => {
      const html = fs.readFileSync(path.join(publicToolsDir, 'split-pdf/split-pdf.html'), 'utf-8');
      assert.ok(html.includes('data-ref="tab-range"'));
      assert.ok(html.includes('data-ref="tab-pages"'));
      assert.ok(html.includes('data-ref="btn-range-submode-custom"'));
      assert.ok(html.includes('data-ref="btn-range-submode-fixed"'));
      assert.ok(html.includes('data-ref="check-merge-ranges"'));
      assert.ok(html.includes('data-ref="check-merge-pages"'));
      assert.ok(html.includes('data-ref="btn-main-action"'));
    });

    test('rotate-pdf: options binding for rotations and page manipulation', () => {
      const html = fs.readFileSync(path.join(publicToolsDir, 'rotate-pdf/rotate-pdf.html'), 'utf-8');
      assert.ok(html.includes('data-ref="btn-sidebar-rotate-right"'));
      assert.ok(html.includes('data-ref="btn-sidebar-rotate-left"'));
      assert.ok(html.includes('data-ref="btn-execute-rotate"'));
    });

    test('ocr-pdf: options binding for language selector and auto-deskew', () => {
      const html = fs.readFileSync(path.join(publicToolsDir, 'ocr-pdf/ocr-pdf.html'), 'utf-8');
      assert.ok(html.includes('data-ref="radio-lang-spa"'));
      assert.ok(html.includes('data-ref="radio-lang-eng"'));
      assert.ok(html.includes('data-ref="check-deskew"'));
      assert.ok(html.includes('data-ref="btn-ocr-action"'));
    });

    test('page-numbers: options binding for positions, formats, and cover skip', () => {
      const html = fs.readFileSync(path.join(publicToolsDir, 'page-numbers/page-numbers.html'), 'utf-8');
      assert.ok(html.includes('data-ref="pos-cell-bottom-right"'));
      assert.ok(html.includes('data-ref="pos-cell-bottom-center"'));
      assert.ok(html.includes('data-ref="pos-cell-top-center"'));
      assert.ok(html.includes('data-ref="check-cover"'));
      assert.ok(html.includes('data-ref="btn-execute-page-numbers"'));
    });

    test('watermark-pdf: options binding for text vs image, position, opacity, rotation, and mosaic', () => {
      const html = fs.readFileSync(path.join(publicToolsDir, 'watermark-pdf/watermark-pdf.html'), 'utf-8');
      assert.ok(html.includes('data-ref="tab-text"'));
      assert.ok(html.includes('data-ref="tab-image"'));
      assert.ok(html.includes('data-ref="input-wm-text"'));
      assert.ok(html.includes('data-ref="check-mosaic"'));
      assert.ok(html.includes('data-ref="btn-execute-watermark"'));
    });

    test('crop-pdf: options binding for crop area and applyToAll toggle', () => {
      const html = fs.readFileSync(path.join(publicToolsDir, 'crop-pdf/crop-pdf.html'), 'utf-8');
      assert.ok(html.includes('data-ref="radio-all-pages"'));
      assert.ok(html.includes('data-ref="radio-current-page"'));
      assert.ok(html.includes('data-ref="btn-reset-crop"'));
      assert.ok(html.includes('data-ref="btn-execute-crop"'));
    });

    test('protect-pdf and unlock-pdf: password inputs and controls', () => {
      const protectHtml = fs.readFileSync(path.join(publicToolsDir, 'protect-pdf/protect-pdf.html'), 'utf-8');
      assert.ok(protectHtml.includes('data-ref="input-password"'));
      assert.ok(protectHtml.includes('data-ref="btn-execute-protect"'));

      const unlockHtml = fs.readFileSync(path.join(publicToolsDir, 'unlock-pdf/unlock-pdf.html'), 'utf-8');
      assert.ok(unlockHtml.includes('data-ref="input-unlock-password"'));
      assert.ok(unlockHtml.includes('data-ref="btn-execute-unlock"'));
    });

    test('compare-pdf: dual document dropzones and comparison mode selector', () => {
      const html = fs.readFileSync(path.join(publicToolsDir, 'compare-pdf/compare-pdf.html'), 'utf-8');
      assert.ok(html.includes('data-ref="input-pdf-file1"'));
      assert.ok(html.includes('data-ref="input-pdf-file2"'));
      assert.ok(html.includes('data-ref="btn-tab-semantic"'));
      assert.ok(html.includes('data-ref="btn-tab-overlay"'));
    });

    test('translate-pdf: target and source language controls', () => {
      const html = fs.readFileSync(path.join(publicToolsDir, 'translate-pdf/translate-pdf.html'), 'utf-8');
      assert.ok(html.includes('data-ref="btn-trigger-target-lang"'));
      assert.ok(html.includes('data-ref="btn-trigger-source-lang"'));
      assert.ok(html.includes('data-ref="btn-translate-action"'));
    });
  });

  describe('Frontend-to-Backend FormData Contracts & Routes Compatibility', () => {
    const contracts = [
      {
        backendRoute: '/tools/compare-pdf/compare',
        clientEndpoint: API_ROUTES.tools.comparePdf.compare,
        clientFields: ['file1', 'file2', 'comparisonMode'],
        name: 'compare-pdf',
      },
      {
        backendRoute: '/tools/compress-pdf/compress',
        clientEndpoint: API_ROUTES.tools.compressPdf.compress,
        clientFields: ['pdf', 'level'],
        name: 'compress-pdf',
      },
      {
        backendRoute: '/tools/crop-pdf/process',
        clientEndpoint: API_ROUTES.tools.cropPdf.process,
        clientFields: ['file', 'options'],
        name: 'crop-pdf',
      },
      {
        backendRoute: '/tools/edit-pdf/process',
        clientEndpoint: API_ROUTES.tools.editPdf.process,
        clientFields: ['file', 'modifications'],
        name: 'edit-pdf',
      },
      {
        backendRoute: '/tools/merge-pdf/merge',
        clientEndpoint: API_ROUTES.tools.mergePdf.merge,
        clientFields: ['pdfs', 'filename'],
        name: 'merge-pdf',
      },
      {
        backendRoute: '/tools/ocr-pdf/process',
        clientEndpoint: API_ROUTES.tools.ocrPdf.process,
        clientFields: ['pdf', 'language', 'deskew'],
        name: 'ocr-pdf',
      },
      {
        backendRoute: '/tools/organize-pdf/organize',
        clientEndpoint: API_ROUTES.tools.organizePdf.organize,
        clientFields: ['pdf', 'pagesOrder', 'filename'],
        name: 'organize-pdf',
      },
      {
        backendRoute: '/tools/page-numbers/process',
        clientEndpoint: API_ROUTES.tools.pageNumbers.process,
        clientFields: ['file', 'options'],
        name: 'page-numbers',
      },
      {
        backendRoute: '/tools/protect-pdf/process',
        clientEndpoint: API_ROUTES.tools.protectPdf.process,
        clientFields: ['file', 'options'],
        name: 'protect-pdf',
      },
      {
        backendRoute: '/tools/redact-pdf/redact',
        clientEndpoint: API_ROUTES.tools.redactPdf.redact,
        clientFields: ['file', 'redactions'],
        name: 'redact-pdf',
      },
      {
        backendRoute: '/tools/remove-pdf-pages/remove',
        clientEndpoint: API_ROUTES.tools.removePdfPages.remove,
        clientFields: ['pdf', 'pagesToRemove'],
        name: 'remove-pdf-pages',
      },
      {
        backendRoute: '/tools/repair-pdf/repair',
        clientEndpoint: API_ROUTES.tools.repairPdf.repair,
        clientFields: ['pdf', 'filename'],
        name: 'repair-pdf',
      },
      {
        backendRoute: '/tools/rotate-pdf/process',
        clientEndpoint: API_ROUTES.tools.rotatePdf.process,
        clientFields: ['file', 'options'],
        name: 'rotate-pdf',
      },
      {
        backendRoute: '/tools/split-pdf/split',
        clientEndpoint: API_ROUTES.tools.splitPdf.split,
        clientFields: ['pdf', 'options'],
        name: 'split-pdf',
      },
      {
        backendRoute: '/tools/unlock-pdf/process',
        clientEndpoint: API_ROUTES.tools.unlockPdf.process,
        clientFields: ['file', 'options'],
        name: 'unlock-pdf',
      },
      {
        backendRoute: '/tools/watermark-pdf/process',
        clientEndpoint: API_ROUTES.tools.watermarkPdf.process,
        clientFields: ['file', 'options'],
        name: 'watermark-pdf',
      },
    ];

    for (const contract of contracts) {
      test(`contract for ${contract.name}: endpoint matches backend and view appends correct fields`, () => {
        // Verify client endpoint has /api prefix and matches backend route path
        assert.strictEqual(
          contract.clientEndpoint,
          `/api${contract.backendRoute}`,
          `API route mismatch for ${contract.name}`
        );

        // Verify view file exists
        const viewDir = path.join(clientViewsDir, contract.name);
        assert.ok(fs.existsSync(viewDir), `Client view directory missing for ${contract.name}`);

        const viewFiles = fs.readdirSync(viewDir).filter((f) => f.endsWith('.view.ts'));
        assert.ok(viewFiles.length > 0);

        const viewContent = fs.readFileSync(path.join(viewDir, viewFiles[0]), 'utf-8');
        for (const field of contract.clientFields) {
          const appendsField =
            viewContent.includes(`formData.append('${field}'`) ||
            viewContent.includes(`formData.append("${field}"`);
          assert.ok(
            appendsField,
            `View ${contract.name} does not append expected FormData field "${field}"`
          );
        }
      });
    }
  });

  describe('Lifecycle methods: controllers implement init and destroy with cleanup', () => {
    const viewFolders = fs.readdirSync(clientViewsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const folder of viewFolders) {
      test(`view controller for ${folder} implements init() and destroy()`, () => {
        const viewFiles = fs.readdirSync(path.join(clientViewsDir, folder)).filter((f) => f.endsWith('.view.ts'));
        for (const vf of viewFiles) {
          const content = fs.readFileSync(path.join(clientViewsDir, folder, vf), 'utf-8');
          assert.ok(
            content.includes('init()') || content.includes('init():'),
            `View ${folder}/${vf} missing init() lifecycle method`
          );
          assert.ok(
            content.includes('destroy()') || content.includes('destroy():'),
            `View ${folder}/${vf} missing destroy() lifecycle method`
          );
          assert.ok(
            content.includes('AbortController') || content.includes('.abort()'),
            `View ${folder}/${vf} missing AbortController for event listener cleanup`
          );
        }
      });
    }
  });
});
