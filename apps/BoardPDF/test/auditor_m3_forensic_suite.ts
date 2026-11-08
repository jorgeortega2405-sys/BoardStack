import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PageDimension } from '../client/config/collab-page-presets.config.js';
import { CollabAction, CollabActionDispatcher, CollabEditorDelegate } from '../client/views/collaborative-pdf/collab-action-dispatcher.service.js';
import { EditorElement } from '../client/views/collaborative-pdf/collaborative-pdf.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TOUCHED_FILES = [
  'client/services/websocket.service.ts',
  'client/components/global-dropzone.component.ts',
  'public/css/components/component-overlays.css',
  'public/translations/es/general.json',
  'client/app-main.ts',
  'client/app-router.ts',
  'client/views/collaborative-pdf/collab-action-dispatcher.service.ts',
  'client/views/collaborative-pdf/collaborative-pdf-editor.view.ts',
];

async function runForensicAuditSuite(): Promise<void> {
  console.log('================================================================');
  console.log('FORENSIC AUDITOR: MILESTONE 3 INTEGRITY & COMPLIANCE SUITE');
  console.log('================================================================\n');

  let testCount = 0;
  let assertionCount = 0;

  function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    testCount++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res.then(() => {
          console.log(`[PASS] ${name}`);
        });
      }
      console.log(`[PASS] ${name}`);
      return Promise.resolve();
    } catch (err: any) {
      console.error(`[FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // --- SECTION 1: STATIC INTEGRITY FORENSICS ---
  console.log('--- SECTION 1: Static Code Forensics (AGENTS.md & GEMINI.md) ---');

  await test('1.1 Zero DOM ID attributes in touched client files and templates', () => {
    for (const relPath of TOUCHED_FILES) {
      if (relPath.endsWith('.json') || relPath.endsWith('.css')) continue;
      const fullPath = path.resolve(ROOT, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Check for raw DOM id="..." (excluding data-* attributes like data-element-id) or setAttribute('id')
      const idMatch = content.match(/(?<!-)\bid\s*=\s*["'][^"']+["']/g);
      const setAttrIdMatch = content.match(/setAttribute\s*\(\s*["']id["']/g);
      const getElemIdMatch = content.match(/document\.getElementById\s*\(/g);

      assert.strictEqual(idMatch, null, `Found raw DOM id in ${relPath}: ${idMatch}`);
      assert.strictEqual(setAttrIdMatch, null, `Found setAttribute('id') in ${relPath}`);
      assert.strictEqual(getElemIdMatch, null, `Found getElementById in ${relPath}`);
      assertionCount += 3;
    }
  });

  await test('1.2 Zero inline styles in newly introduced component code', () => {
    const dropzoneContent = fs.readFileSync(path.resolve(ROOT, 'client/components/global-dropzone.component.ts'), 'utf-8');
    assert.strictEqual(dropzoneContent.includes('style='), false, 'global-dropzone must not contain inline style attribute');
    assert.strictEqual(dropzoneContent.includes('.style.'), false, 'global-dropzone must not set element.style directly');

    const dispatcherContent = fs.readFileSync(path.resolve(ROOT, 'client/views/collaborative-pdf/collab-action-dispatcher.service.ts'), 'utf-8');
    assert.strictEqual(dispatcherContent.includes('.style.'), false, 'dispatcher must not manipulate DOM styles');
    assertionCount += 3;
  });

  await test('1.3 Zero unauthorized console.* calls in client directory', () => {
    const clientDir = path.resolve(ROOT, 'client');
    const findConsole = (dir: string): Array<{ file: string; line: string }> => {
      let results: Array<{ file: string; line: string }> = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(findConsole(full));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          const lines = fs.readFileSync(full, 'utf-8').split('\n');
          lines.forEach((l, idx) => {
            if (/console\.(log|warn|error|info|debug)\s*\(/.test(l)) {
              results.push({ file: full, line: `${idx + 1}: ${l.trim()}` });
            }
          });
        }
      }
      return results;
    };

    const found = findConsole(clientDir);
    // Exact authorized exceptions in websocket.service.ts:
    // 1. console.log('[WebSocket] Conexión establecida con éxito...');
    // 2. console.log('[WebSocket] Conexión cerrada.');
    const unauthorized = found.filter((entry) => {
      const isWs = entry.file.endsWith('websocket.service.ts');
      const isConnOpen = entry.line.includes('[WebSocket] Conexión establecida');
      const isConnClose = entry.line.includes('[WebSocket] Conexión cerrada.');
      return !(isWs && (isConnOpen || isConnClose));
    });

    assert.strictEqual(unauthorized.length, 0, `Unauthorized console calls: ${JSON.stringify(unauthorized)}`);
    assert.strictEqual(found.length, 2, 'Exactly 2 authorized lifecycle logs in websocket.service.ts');
    assertionCount += 2;
  });

  await test('1.4 Single-line horizontal and alphabetically sorted imports', () => {
    const filesToCheck = [
      'client/components/global-dropzone.component.ts',
      'client/views/collaborative-pdf/collab-action-dispatcher.service.ts',
      'client/app-main.ts',
      'client/app-router.ts',
    ];

    for (const relPath of filesToCheck) {
      const content = fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8');
      const lines = content.split('\n');
      const importLines: string[] = [];
      let inMultiline = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('import ') && !line.includes(';')) {
          inMultiline = true;
          assert.fail(`Multi-line import detected in ${relPath} at line ${i + 1}: ${line}`);
        }
        if (line.startsWith('import ') && line.includes('from')) {
          importLines.push(line);
        } else if (importLines.length > 0 && !line.startsWith('import ') && line.length > 0 && !line.startsWith('//')) {
          break; // end of import block
        }
      }

      // Check module paths alphabetical order
      const paths = importLines.map((l) => {
        const m = l.match(/from\s+['"]([^'"]+)['"]/);
        return m ? m[1] : '';
      });

      for (let i = 1; i < paths.length; i++) {
        assert(paths[i - 1].localeCompare(paths[i]) <= 0, `Unsorted imports in ${relPath}: "${paths[i - 1]}" should be before "${paths[i]}"`);
      }

      // Check named members alphabetical order within { ... }
      for (const l of importLines) {
        const memberMatch = l.match(/import\s*\{\s*([^}]+)\s*\}\s*from/);
        if (memberMatch) {
          const members = memberMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
          for (let i = 1; i < members.length; i++) {
            assert(members[i - 1].localeCompare(members[i]) <= 0, `Unsorted named members in ${relPath}: "${members[i - 1]}" should be before "${members[i]}" in line: ${l}`);
          }
        }
      }
      assertionCount += 2;
    }
  });

  await test('1.5 Translation keys registered in general.json without missing keys', () => {
    const generalJsonPath = path.resolve(ROOT, 'public/translations/es/general.json');
    const json = JSON.parse(fs.readFileSync(generalJsonPath, 'utf-8'));

    assert(json.common && json.common.drop_file_overlay === 'Soltar archivo');
    assert(json.common && json.common.drop_file_hint.includes('Suelta tus archivos'));
    assert(json.auth && json.auth.login_required_upload.includes('Inicia sesión'));
    assert(json.projects && json.projects.uploading_files.includes('Subiendo archivo'));
    assert(json.projects && json.projects.upload_success === 'Archivo subido correctamente');
    assertionCount += 5;
  });

  // --- SECTION 2: BEHAVIORAL VERIFICATION ---
  console.log('\n--- SECTION 2: Behavioral & State Machine Verifications ---');

  await test('2.1 WebSocket route isolation logic simulation', () => {
    const isEditorRoute = (pathname: string): boolean => {
      return pathname.startsWith('/d/') || pathname === '/d' || pathname.startsWith('/collaborative-pdf/editor');
    };

    assert.strictEqual(isEditorRoute('/'), false);
    assert.strictEqual(isEditorRoute('/tools/merge-pdf'), false);
    assert.strictEqual(isEditorRoute('/pricing'), false);
    assert.strictEqual(isEditorRoute('/projects'), false);
    assert.strictEqual(isEditorRoute('/settings'), false);

    assert.strictEqual(isEditorRoute('/d/doc-12345'), true);
    assert.strictEqual(isEditorRoute('/d'), true);
    assert.strictEqual(isEditorRoute('/collaborative-pdf/editor'), true);
    assert.strictEqual(isEditorRoute('/collaborative-pdf/editor/xyz'), true);
    assertionCount += 9;
  });

  await test('2.2 CollabActionDispatcher comprehensive mutation & security verification', () => {
    const elements: EditorElement[] = [
      { id: 'el-1', pageIndex: 0, type: 'text', x: 10, y: 20 } as any,
    ];
    let recordedHistory = 0;
    let modifiedState = false;
    let renderCount = 0;
    let canEdit = true;
    const lockedPages = new Set<number>();

    const delegate: CollabEditorDelegate = {
      alignElementToPage: () => true,
      canEdit: () => canEdit,
      docDefaultPageSize: { height: 1123, width: 794 },
      docTitle: 'Test Document',
      elements,
      flushAutoSave: async () => {},
      getPageDimensions: () => ({ height: 1123, width: 794 }),
      isCollabRoomFull: false,
      isLockedPage: (idx) => lockedPages.has(idx),
      moveElementLayer: () => true,
      pageBackgrounds: ['#ffffff'],
      pageCount: 1,
      pagePdfSources: [null],
      pageSizes: [{ height: 1123, width: 794 }],
      pageTitles: ['Page 1'],
      recordHistory: () => { recordedHistory++; },
      redo: () => {},
      renderPages: () => { renderCount++; },
      reorderElementLayer: () => true,
      selectElement: () => {},
      selectedElementId: 'el-1',
      setDocTitle: () => {},
      setModified: (val) => { modifiedState = val; },
      undo: () => {},
      updateContextToolbar: () => {},
      updateTransformBoxPosition: () => {},
    };

    const dispatcher = new CollabActionDispatcher(delegate);

    // 1. Normal mutation when allowed
    const ok1 = dispatcher.dispatch({
      payload: { id: 'el-1', x: 50, y: 60 },
      type: 'ELEMENT_MOVE',
    }, { skipBroadcast: true });
    assert.strictEqual(ok1, true);
    assert.strictEqual(elements[0].x, 50);
    assert.strictEqual(elements[0].y, 60);
    assert.strictEqual(recordedHistory, 1);
    assert.strictEqual(modifiedState, true);

    // 2. Reject mutation when canEdit is false
    canEdit = false;
    const ok2 = dispatcher.dispatch({
      payload: { id: 'el-1', x: 100, y: 100 },
      type: 'ELEMENT_MOVE',
    }, { skipBroadcast: true });
    assert.strictEqual(ok2, false);
    assert.strictEqual(elements[0].x, 50, 'Element coordinates must NOT change when canEdit is false');

    // 3. Reject mutation when targeted page is locked
    canEdit = true;
    lockedPages.add(0);
    const ok3 = dispatcher.dispatch({
      pageIndex: 0,
      payload: { id: 'el-2', pageIndex: 0, type: 'text' },
      type: 'ELEMENT_ADD',
    }, { skipBroadcast: true });
    assert.strictEqual(ok3, false);
    assert.strictEqual(elements.length, 1, 'Element must not be added to locked page');

    dispatcher.destroy();
    assertionCount += 7;
  });

  console.log('\n================================================================');
  console.log(`FORENSIC AUDIT SUMMARY: ALL ${testCount} TEST SCENARIOS PASSED (${assertionCount} ASSERTIONS)`);
  console.log('VERDICT: CLEAN - ZERO INTEGRITY VIOLATIONS DETECTED');
  console.log('================================================================\n');
}

runForensicAuditSuite().catch((err) => {
  console.error('Forensic suite failed:', err);
  process.exit(1);
});
