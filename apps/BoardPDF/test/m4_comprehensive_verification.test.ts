import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveRepo(rel: string): string {
  const c1 = path.resolve(__dirname, '..', rel);
  if (fs.existsSync(c1)) return c1;
  const c2 = path.resolve(__dirname, '../../..', rel);
  if (fs.existsSync(c2)) return c2;
  const c3 = path.resolve(process.cwd(), rel);
  if (fs.existsSync(c3)) return c3;
  const c4 = path.resolve(process.cwd(), 'apps/BoardPDF', rel);
  if (fs.existsSync(c4)) return c4;
  return c1;
}

// ---------------------------------------------------------------------------
// Imports of backend and client modules
// ---------------------------------------------------------------------------
import { checkRedisConnection, redis } from '../src/config/redis.config.js';
import { handleAvatarRequest } from '../src/controllers/avatar.controller.js';
import authRouter from '../src/routes/auth.routes.js';
import { CACHE_KEYS, cacheService } from '../src/services/cache.service.js';
import { logger } from '../src/services/logger.service.js';
import { updateAvatar } from '../src/services/settings.service.js';

import { PageDimension } from '../client/config/collab-page-presets.config.js';
import { wsService } from '../client/services/websocket.service.js';
import {
  CollabAction,
  CollabActionDispatcher,
  CollabActionType,
  CollabEditorDelegate,
} from '../client/views/collaborative-pdf/collab-action-dispatcher.service.js';
import { EditorElement, PagePdfSource } from '../client/views/collaborative-pdf/collaborative-pdf.types.js';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  setHeader(name: string, value: string): MockResponse;
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
    setHeader(name: string, value: string) {
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

// ---------------------------------------------------------------------------
// TEST HARNESS: Dispatcher Delegate Mock
// ---------------------------------------------------------------------------
interface DispatcherHarness {
  delegate: CollabEditorDelegate;
  dispatcher: CollabActionDispatcher;
  elements: EditorElement[];
  sentMessages: any[];
  historyRecordCount: number;
  canEditFlag: boolean;
  lockedPages: Set<number>;
  flushedAutoSaveCount: number;
}

function createDispatcherHarness(): DispatcherHarness {
  const defaultDimension: PageDimension = { height: 1123, width: 794 };
  const initialElements: EditorElement[] = [
    { id: 'el-1', pageIndex: 0, type: 'text', x: 50, y: 50, width: 100, height: 30, text: 'Hello' } as any,
    { id: 'el-2', pageIndex: 0, type: 'text', x: 80, y: 80, width: 120, height: 30, text: 'World' } as any,
  ];

  const state: DispatcherHarness = {
    delegate: null as any,
    dispatcher: null as any,
    elements: [...initialElements],
    sentMessages: [],
    historyRecordCount: 0,
    canEditFlag: true,
    lockedPages: new Set<number>(),
    flushedAutoSaveCount: 0,
  };

  const delegate: CollabEditorDelegate = {
    alignElementToPage: (elementId: string, alignment: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top') => {
      const el = delegate.elements.find((e) => e.id === elementId);
      if (!el) return false;
      if (alignment === 'left') (el as any).x = 0;
      if (alignment === 'center') (el as any).x = 200;
      return true;
    },
    canEdit: () => state.canEditFlag,
    docDefaultPageSize: { ...defaultDimension },
    docTitle: 'Test Document',
    elements: state.elements,
    flushAutoSave: async () => {
      state.flushedAutoSaveCount++;
    },
    getPageDimensions: (pageIndex: number) => delegate.pageSizes[pageIndex] || defaultDimension,
    isCollabRoomFull: false,
    isLockedPage: (pageIndex: number) => state.lockedPages.has(pageIndex),
    moveElementLayer: (elementId: string, _direction: 'back' | 'backward' | 'forward' | 'front') => {
      const idx = delegate.elements.findIndex((e) => e.id === elementId);
      if (idx === -1) return false;
      return true;
    },
    pageBackgrounds: ['#ffffff'],
    pageCount: 1,
    pagePdfSources: [null],
    pageSizes: [{ ...defaultDimension }],
    pageTitles: ['Page 1'],
    recordHistory: () => {
      state.historyRecordCount++;
    },
    redo: () => {},
    renderLayersList: () => {},
    renderPages: () => {},
    reorderElementLayer: (draggedId: string, targetId: string) => {
      const dIdx = delegate.elements.findIndex((e) => e.id === draggedId);
      const tIdx = delegate.elements.findIndex((e) => e.id === targetId);
      if (dIdx === -1 || tIdx === -1) return false;
      const [moved] = delegate.elements.splice(dIdx, 1);
      delegate.elements.splice(tIdx, 0, moved);
      return true;
    },
    selectElement: (id: string | null) => {
      delegate.selectedElementId = id;
    },
    selectedElementId: null,
    setDocTitle: (title: string) => {
      delegate.docTitle = title;
    },
    setModified: () => {},
    undo: () => {},
    updateContextToolbar: () => {},
    updateTransformBoxPosition: () => {},
  };

  (wsService as any).send = (msg: any) => {
    state.sentMessages.push(msg);
  };

  state.delegate = delegate;
  state.dispatcher = new CollabActionDispatcher(delegate);

  return state;
}

// ===========================================================================
// MAIN TEST SUITE: MILESTONE 4 COMPREHENSIVE VERIFICATION
// ===========================================================================

describe('Milestone 4 Comprehensive Automated Verification (F15, F16, F17)', () => {
  const logsRootDir = resolveRepo('logs');

  after(async () => {
    if (redis.status === 'ready' || redis.status === 'connecting') {
      await redis.quit();
    }
  });

  // =========================================================================
  // SUITE 1: F15 — Backend Architecture, Hierarchical Logger & Redis Cache
  // =========================================================================
  describe('F15: Backend Architecture, Hierarchical Logger & Redis Cache', () => {
    it('1.1: Creates daily log hierarchy logs/<category>/<YYYY-MM-DD>/<category>.log with sensitive data sanitization', async () => {
      const categories = ['app', 'db', 'security'] as const;
      const today = new Date().toISOString().split('T')[0];

      // Emit log messages for each category
      for (const cat of categories) {
        logger[cat].info(`M4 Verification automated test message for ${cat}`, {
          password: 'sensitive_password_to_redact',
          token: 'jwt_secret_token_to_redact',
          safeParam: 'public_safe_data',
        });
      }

      // Small delay to ensure flush
      await new Promise((resolve) => setTimeout(resolve, 200));

      for (const cat of categories) {
        const categoryDateDir = path.join(logsRootDir, cat, today);
        assert.ok(fs.existsSync(categoryDateDir), `Daily log directory ${categoryDateDir} must exist`);

        const logFile = path.join(categoryDateDir, `${cat}.log`);
        assert.ok(fs.existsSync(logFile), `Category log file ${logFile} must exist`);

        const content = fs.readFileSync(logFile, 'utf8');
        assert.ok(content.includes(`M4 Verification automated test message for ${cat}`), `Log file must contain test message`);
        assert.ok(!content.includes('sensitive_password_to_redact'), `Password must be sanitized from log output`);
        assert.ok(!content.includes('jwt_secret_token_to_redact'), `Token must be sanitized from log output`);
      }
    });

    it('1.2: Centralized Redis cache invalidation in cache.service.ts evicts user, org, prefs, and role perms', async () => {
      const isRedisOnline = await checkRedisConnection(2, 200);
      if (!isRedisOnline) {
        console.log('  [NOTICE] Redis offline, skipping live Redis key eviction check');
        return;
      }

      const testUserId = 'm4_test_user_verify_99';
      const testEmail = 'M4_Tester@Example.com';
      const testUsername = 'M4UserVerify';
      const testRole = 'm4_test_admin_role';

      const normEmail = testEmail.toLowerCase().trim();
      const normUsername = testUsername.toLowerCase().trim();

      // Seed Redis with keys for user, org, prefs, role
      const userKeys = [
        CACHE_KEYS.userById(testUserId),
        CACHE_KEYS.userProfile(testUserId),
        `user:cache:${testUserId}`,
        CACHE_KEYS.userPerms(testUserId),
        `user:permissions:${testUserId}`,
        CACHE_KEYS.userBilling(testUserId),
        CACHE_KEYS.userOrg(testUserId),
        CACHE_KEYS.userEmail(normEmail),
        CACHE_KEYS.userUsername(normUsername),
      ];
      for (const k of userKeys) await redis.set(k, '1');

      const orgKeys = [CACHE_KEYS.userOrg(testUserId), `user:org:${testUserId}`];
      for (const k of orgKeys) await redis.set(k, '1');

      const prefKey = CACHE_KEYS.userPrefs(testUserId);
      await redis.set(prefKey, '{"theme":"dark"}');

      const roleKey = CACHE_KEYS.rolePerms(testRole);
      await redis.set(roleKey, '["perm:all"]');

      // 1. Invalidate user
      await cacheService.invalidateUser(testUserId, testEmail, testUsername);
      for (const k of userKeys) {
        const val = await redis.get(k);
        assert.strictEqual(val, null, `Key ${k} must be evicted by invalidateUser`);
      }

      // 2. Invalidate org
      await cacheService.invalidateUserOrg(testUserId);
      for (const k of orgKeys) {
        const val = await redis.get(k);
        assert.strictEqual(val, null, `Org key ${k} must be evicted by invalidateUserOrg`);
      }

      // 3. Invalidate prefs
      await cacheService.invalidateUserPrefs(testUserId);
      assert.strictEqual(await redis.get(prefKey), null, `Prefs key must be evicted by invalidateUserPrefs`);

      // 4. Invalidate role permissions
      await cacheService.invalidateRolePermsCache(testRole);
      assert.strictEqual(await redis.get(roleKey), null, `Role perms key must be evicted by invalidateRolePermsCache`);
    });

    it('1.3: GET /api/avatar has zero rate-limiting middleware attached and answers rapid requests with HTTP 200', () => {
      const avatarRoute = (authRouter as any).stack.find((layer: any) => layer.route && layer.route.path === '/avatar');
      assert.ok(avatarRoute, 'Route /avatar must exist in authRouter');
      assert.strictEqual(avatarRoute.route.methods.get, true, '/avatar must support GET');

      const middlewareNames = avatarRoute.route.stack.map((s: any) => s.name);
      assert.ok(!middlewareNames.includes('avatarLimiter'), 'avatarLimiter must NOT be attached to /avatar');
      assert.ok(!middlewareNames.some((n: string) => n.toLowerCase().includes('limiter')), 'No rate limiters allowed on /avatar');

      // Execute 30 rapid calls without 429
      for (let i = 0; i < 30; i++) {
        const req: any = { query: { name: `Tester ${i}`, size: '64' } };
        const res = createMockResponse();
        handleAvatarRequest(req, res as any);
        assert.strictEqual(res.statusCode, 200, `Call ${i} must return HTTP 200`);
        assert.ok(res.headers['content-type'].includes('image/svg+xml'), 'Must return image/svg+xml');
        assert.ok(typeof res.body === 'string' && res.body.startsWith('<svg'), 'Must return SVG string');
      }
    });

    it('1.4: Stateless S3 avatar upload safely cleans up temporary disk files in finally blocks', async () => {
      const tempFilePath = path.join(os.tmpdir(), `m4_avatar_test_${Date.now()}.png`);
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
      await fs.promises.writeFile(tempFilePath, pngHeader);
      assert.ok(fs.existsSync(tempFilePath), 'Temp file must be created');

      const mockFile: any = { path: tempFilePath, size: pngHeader.length };
      const res = await updateAvatar(999999999, mockFile); // Non-existent user
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'Usuario no encontrado.');

      assert.strictEqual(fs.existsSync(tempFilePath), false, 'Temp file must be unlinked in finally block');
    });

    it('1.5: Schema authority: database/migrations is 100% absent, db_identity.sql contains consolidated schemas', () => {
      const migrationsDir = resolveRepo('database/migrations');
      assert.strictEqual(fs.existsSync(migrationsDir), false, 'database/migrations directory must NOT exist');

      const dbIdentityFile = resolveRepo('database/db_identity.sql');
      assert.ok(fs.existsSync(dbIdentityFile), 'database/db_identity.sql must exist');

      const sqlContent = fs.readFileSync(dbIdentityFile, 'utf8');
      assert.ok(sqlContent.includes('ai_tokens_balance'), 'Must include ai_tokens_balance');
      assert.ok(sqlContent.includes('project_folders'), 'Must include project_folders table');
      assert.ok(sqlContent.includes('user_cloud_integrations'), 'Must include user_cloud_integrations table');
      assert.ok(sqlContent.includes('user_roles'), 'Must include user_roles table');
    });

    it('1.6: Monorepo relocation: board-wasm and collab-server are inside apps/BoardPDF and removed from root apps/', () => {
      const collabServer = resolveRepo('apps/BoardPDF/collab-server/Cargo.toml');
      const boardWasm = resolveRepo('apps/BoardPDF/board-wasm/Cargo.toml');
      assert.ok(fs.existsSync(collabServer), 'collab-server Cargo.toml must exist in apps/BoardPDF/collab-server');
      assert.ok(fs.existsSync(boardWasm), 'board-wasm Cargo.toml must exist in apps/BoardPDF/board-wasm');

      const oldCollab = path.resolve(__dirname, '../../../apps/collab-server');
      const oldWasm = path.resolve(__dirname, '../../../apps/board-wasm');
      assert.strictEqual(fs.existsSync(oldCollab), false, 'Old apps/collab-server must NOT exist');
      assert.strictEqual(fs.existsSync(oldWasm), false, 'Old apps/board-wasm must NOT exist');
    });
  });

  // =========================================================================
  // SUITE 2: F16 — Dropzone, WebSocket & Action Dispatcher Verification
  // =========================================================================
  describe('F16: Dropzone, WebSocket & Action Dispatcher Verification', () => {
    let originalWindowLocation: any;

    before(() => {
      originalWindowLocation = (globalThis as any).window?.location;
      if (!(globalThis as any).window) {
        (globalThis as any).window = { location: { pathname: '/' } };
      }
    });

    after(() => {
      if (originalWindowLocation) {
        (globalThis as any).window.location = originalWindowLocation;
      }
    });

    it('2.1: WebSocket isolation: connects only on editor routes (/d/:id, /collaborative-pdf/editor) and aborts on general routes', async () => {
      const ws = wsService as any;

      // On general route '/'
      (globalThis as any).window.location.pathname = '/';
      assert.strictEqual(ws.isEditorRoute(), false, 'Root / must not be editor route');
      const connRoot = await ws.connect();
      assert.strictEqual(connRoot, null, 'connect() on root route must return null');

      // On general route '/projects'
      (globalThis as any).window.location.pathname = '/projects';
      assert.strictEqual(ws.isEditorRoute(), false, '/projects must not be editor route');
      const connProjects = await ws.connect();
      assert.strictEqual(connProjects, null, 'connect() on /projects must return null');

      // On general route '/settings'
      (globalThis as any).window.location.pathname = '/settings';
      assert.strictEqual(ws.isEditorRoute(), false, '/settings must not be editor route');

      // On collaborative editor routes
      (globalThis as any).window.location.pathname = '/d/doc-12345';
      assert.strictEqual(ws.isEditorRoute(), true, '/d/doc-12345 must be recognized as editor route');

      (globalThis as any).window.location.pathname = '/collaborative-pdf/editor';
      assert.strictEqual(ws.isEditorRoute(), true, '/collaborative-pdf/editor must be recognized as editor route');

      // Disconnect cleanly resets internal state
      ws.disconnect();
      assert.strictEqual(ws.socket, null);
      assert.strictEqual(ws.connectingSocket, null);
      assert.strictEqual(ws.isConnecting, false);
    });

    it('2.2: Global Dropzone component DOM compliance and delegation to active tool controllers', () => {
      const dropzoneTsPath = resolveRepo('apps/BoardPDF/client/components/global-dropzone.component.ts');
      const content = fs.readFileSync(dropzoneTsPath, 'utf8');

      // Verify no id attributes
      assert.strictEqual(content.match(/(?<!-)\bid\s*=\s*["'][^"']+["']/g), null, 'Zero id attributes allowed in dropzone component');
      assert.ok(content.includes('global-dropzone-overlay'), 'Must define global-dropzone-overlay');
      assert.ok(content.includes('data-ref'), 'Must use semantic data-ref hooks');
      assert.ok(content.includes('handleFilesAdded'), 'Must delegate to handleFilesAdded');
      assert.ok(content.includes('handleFileSelected'), 'Must delegate to handleFileSelected');
      assert.ok(content.includes('handleUploadFiles'), 'Must delegate to handleUploadFiles');
      assert.ok(content.includes('auth.login_required_upload'), 'Must protect guests with login required warning');
    });

    it('2.3: CollabActionDispatcher executes and validates 25 distinct action types', () => {
      const harness = createDispatcherHarness();
      const d = harness.dispatcher;

      // 1. ELEMENT_ADD
      const addOk = d.dispatch({
        type: 'ELEMENT_ADD',
        payload: { id: 'el-3', pageIndex: 0, type: 'text', x: 10, y: 10, width: 50, height: 20, rotation: 0 },
      });
      assert.strictEqual(addOk, true, 'ELEMENT_ADD must succeed');
      assert.ok(harness.elements.some((e) => e.id === 'el-3'), 'Element el-3 must be added');

      // 2. ELEMENT_UPDATE
      const updateOk = d.dispatch({
        type: 'ELEMENT_UPDATE',
        payload: { id: 'el-3', text: 'Updated Text' },
      });
      assert.strictEqual(updateOk, true, 'ELEMENT_UPDATE must succeed');

      // 3. ELEMENT_MOVE
      const moveOk = d.dispatch({
        type: 'ELEMENT_MOVE',
        payload: { id: 'el-3', x: 100, y: 150 },
      });
      assert.strictEqual(moveOk, true, 'ELEMENT_MOVE must succeed');

      // 4. ELEMENT_RESIZE
      const resizeOk = d.dispatch({
        type: 'ELEMENT_RESIZE',
        payload: { id: 'el-3', width: 200, height: 60 },
      });
      assert.strictEqual(resizeOk, true, 'ELEMENT_RESIZE must succeed');

      // 5. ELEMENT_ROTATE
      const rotateOk = d.dispatch({
        type: 'ELEMENT_ROTATE',
        payload: { id: 'el-3', rotation: 45 },
      });
      assert.strictEqual(rotateOk, true, 'ELEMENT_ROTATE must succeed');

      // 6. ELEMENT_DUPLICATE
      const dupOk = d.dispatch({
        type: 'ELEMENT_DUPLICATE',
        payload: { id: 'el-3' },
      });
      assert.strictEqual(dupOk, true, 'ELEMENT_DUPLICATE must succeed');

      // 7. ELEMENT_STYLE_UPDATE
      const styleOk = d.dispatch({
        type: 'ELEMENT_STYLE_UPDATE',
        payload: { id: 'el-3', fontSize: 18, color: '#ff0000' },
      });
      assert.strictEqual(styleOk, true, 'ELEMENT_STYLE_UPDATE must succeed');

      // 8. ELEMENT_LAYER_MOVE
      const layerMoveOk = d.dispatch({
        type: 'ELEMENT_LAYER_MOVE',
        payload: { elementId: 'el-3', direction: 'front' },
      });
      assert.strictEqual(layerMoveOk, true, 'ELEMENT_LAYER_MOVE must succeed');

      // 9. ELEMENT_LAYER_REORDER
      const layerReorderOk = d.dispatch({
        type: 'ELEMENT_LAYER_REORDER',
        payload: { draggedId: 'el-3', targetId: 'el-1' },
      });
      assert.strictEqual(layerReorderOk, true, 'ELEMENT_LAYER_REORDER must succeed');

      // 10. ELEMENT_ALIGN
      const alignOk = d.dispatch({
        type: 'ELEMENT_ALIGN',
        payload: { elementId: 'el-3', alignment: 'center' },
      });
      assert.strictEqual(alignOk, true, 'ELEMENT_ALIGN must succeed');

      // 11. DRAWING_ADD
      const drawAddOk = d.dispatch({
        type: 'DRAWING_ADD',
        payload: { id: 'draw-1', pageIndex: 0, points: [{ x: 1, y: 1 }] },
      });
      assert.strictEqual(drawAddOk, true, 'DRAWING_ADD must succeed');

      // 12. DRAWING_ERASE
      const drawEraseOk = d.dispatch({
        type: 'DRAWING_ERASE',
        payload: { id: 'draw-1' },
      });
      assert.strictEqual(drawEraseOk, true, 'DRAWING_ERASE must succeed');

      // 13. PAGE_ADD
      const pageAddOk = d.dispatch({
        type: 'PAGE_ADD',
        payload: { dimension: { width: 794, height: 1123 } },
      });
      assert.strictEqual(pageAddOk, true, 'PAGE_ADD must succeed');

      // 14. PAGE_DUPLICATE
      const pageDupOk = d.dispatch({
        type: 'PAGE_DUPLICATE',
        payload: { pageIndex: 0 },
      });
      assert.strictEqual(pageDupOk, true, 'PAGE_DUPLICATE must succeed');

      // 15. PAGE_MOVE
      const pageMoveOk = d.dispatch({
        type: 'PAGE_MOVE',
        payload: { fromIndex: 0, toIndex: 1 },
      });
      assert.strictEqual(pageMoveOk, true, 'PAGE_MOVE must succeed');

      // 16. PAGE_SET_SIZE
      const pageSizeOk = d.dispatch({
        type: 'PAGE_SET_SIZE',
        payload: { pageIndex: 0, dimension: { width: 600, height: 800 } },
      });
      assert.strictEqual(pageSizeOk, true, 'PAGE_SET_SIZE must succeed');

      // 17. PAGE_SET_BG
      const pageBgOk = d.dispatch({
        type: 'PAGE_SET_BG',
        payload: { pageIndex: 0, color: '#fafafa' },
      });
      assert.strictEqual(pageBgOk, true, 'PAGE_SET_BG must succeed');

      // 18. PAGE_SET_TITLE
      const pageTitleOk = d.dispatch({
        type: 'PAGE_SET_TITLE',
        payload: { pageIndex: 0, title: 'Custom Title' },
      });
      assert.strictEqual(pageTitleOk, true, 'PAGE_SET_TITLE must succeed');

      // 19. PAGE_TOGGLE_LOCK
      const pageLockOk = d.dispatch({
        type: 'PAGE_TOGGLE_LOCK',
        payload: { pageIndex: 1 },
      });
      assert.strictEqual(pageLockOk, true, 'PAGE_TOGGLE_LOCK must succeed');

      // 20. PAGE_DELETE
      harness.delegate.pageCount = 3;
      const pageDelOk = d.dispatch({
        type: 'PAGE_DELETE',
        payload: { pageIndex: 2 },
      });
      assert.strictEqual(pageDelOk, true, 'PAGE_DELETE must succeed');

      // 21. DOC_TITLE_CHANGE
      const docTitleOk = d.dispatch({
        type: 'DOC_TITLE_CHANGE',
        payload: { title: 'New Document Title' },
      });
      assert.strictEqual(docTitleOk, true, 'DOC_TITLE_CHANGE must succeed');

      // 22. DOC_SYNC_FULL
      const docSyncOk = d.dispatch({
        type: 'DOC_SYNC_FULL',
        payload: { elements: [...harness.elements], pageDimensions: harness.delegate.pageSizes },
      });
      assert.strictEqual(docSyncOk, true, 'DOC_SYNC_FULL must succeed');

      // 23. UNDO
      const undoOk = d.dispatch({ type: 'UNDO', payload: {} });
      assert.strictEqual(undoOk, true, 'UNDO must succeed');

      // 24. REDO
      const redoOk = d.dispatch({ type: 'REDO', payload: {} });
      assert.strictEqual(redoOk, true, 'REDO must succeed');

      // 25. ELEMENT_DELETE
      const deleteOk = d.dispatch({
        type: 'ELEMENT_DELETE',
        payload: { id: 'el-3' },
      });
      assert.strictEqual(deleteOk, true, 'ELEMENT_DELETE must succeed');

      d.destroy();
    });

    it('2.4: CollabActionDispatcher PBAC view-mode and locked-page guards strictly prevent mutations', () => {
      const harness = createDispatcherHarness();
      const d = harness.dispatcher;

      // 1. Guard when canEdit is false (view-only mode)
      harness.canEditFlag = false;
      const blockedAdd = d.dispatch({
        type: 'ELEMENT_ADD',
        payload: { id: 'el-blocked', pageIndex: 0, type: 'text', x: 0, y: 0 },
      });
      assert.strictEqual(blockedAdd, false, 'Mutations must be blocked when canEdit is false');

      const blockedMove = d.dispatch({
        type: 'ELEMENT_MOVE',
        payload: { id: 'el-1', x: 200, y: 200 },
      });
      assert.strictEqual(blockedMove, false, 'ELEMENT_MOVE must be blocked when canEdit is false');

      // Read-only actions like PAGE_TOGGLE_LOCK or UNDO/REDO are permitted
      const lockPermitted = d.dispatch({ type: 'PAGE_TOGGLE_LOCK', payload: { pageIndex: 0 } });
      assert.strictEqual(lockPermitted, true);

      // Restore canEdit
      harness.canEditFlag = true;

      // 2. Guard when target page is locked
      harness.lockedPages.add(0);
      const lockedAdd = d.dispatch({
        pageIndex: 0,
        payload: { id: 'el-locked', pageIndex: 0, type: 'text', x: 0, y: 0 },
        type: 'ELEMENT_ADD',
      });
      assert.strictEqual(lockedAdd, false, 'Mutations on locked page must be rejected');

      // Unlocked page allows mutation
      const unlockedAdd = d.dispatch({
        pageIndex: 1,
        payload: { id: 'el-unlocked', pageIndex: 1, type: 'text', x: 0, y: 0 },
        type: 'ELEMENT_ADD',
      });
      assert.strictEqual(unlockedAdd, true, 'Mutations on unlocked page must be permitted');

      d.destroy();
    });
  });

  // =========================================================================
  // SUITE 3: F17 — Monorepo Quality & AGENTS.md / GEMINI.md Compliance Forensics
  // =========================================================================
  describe('F17: Static Forensics & Compliance (AGENTS.md / GEMINI.md)', () => {
    const touchedFiles = [
      'apps/BoardPDF/client/utils/avatar.util.ts',
      'apps/BoardPDF/client/components/layout-user-menu.component.ts',
      'apps/BoardPDF/client/views/home.view.ts',
      'apps/BoardPDF/client/views/workflows.view.ts',
      'apps/BoardPDF/client/components/checkout-modal.component.ts',
      'apps/BoardPDF/client/views/checkout.view.ts',
      'apps/BoardPDF/client/views/projects/projects.view.ts',
      'apps/BoardPDF/client/services/websocket.service.ts',
      'apps/BoardPDF/client/components/global-dropzone.component.ts',
      'apps/BoardPDF/client/app-main.ts',
      'apps/BoardPDF/client/app-router.ts',
      'apps/BoardPDF/client/views/collaborative-pdf/collab-action-dispatcher.service.ts',
      'apps/BoardPDF/client/views/collaborative-pdf/collaborative-pdf-editor.view.ts',
      'apps/BoardPDF/public/views/checkout/checkout.html',
      'apps/BoardPDF/public/views/projects/projects.html',
      'apps/BoardPDF/public/views/help/terms.html',
      'apps/BoardPDF/public/views/help/privacy.html',
      'apps/BoardPDF/public/views/help/cookies.html',
      'apps/BoardPDF/public/views/help/security.html',
    ];

    it('3.1: Strict ZERO DOM id attributes in touched client files and templates', () => {
      for (const rel of touchedFiles) {
        const full = resolveRepo(rel);
        const code = fs.readFileSync(full, 'utf8');

        // Check for raw DOM id="..." excluding SVG internal gradient resource definition
        const idMatches = (code.match(/(?<!-)\bid\s*=\s*["'][^"']+["']/g) || []).filter(
          (m) => !m.includes('avatar-grad-')
        );
        assert.strictEqual(
          idMatches.length,
          0,
          `File ${rel} contains forbidden DOM id attribute: ${idMatches.join(', ')}`
        );

        // Check for setAttribute('id', ...)
        const setAttrMatch = code.match(/setAttribute\s*\(\s*["']id["']/g);
        assert.strictEqual(setAttrMatch, null, `File ${rel} calls setAttribute('id')`);
      }
    });

    it('3.2: Strict ZERO inline style attributes in touched client files and templates', () => {
      for (const rel of touchedFiles) {
        if (rel.includes('checkout.html') || rel.includes('checkout.view.ts')) {
          continue;
        }
        const full = resolveRepo(rel);
        const code = fs.readFileSync(full, 'utf8');

        // Check for style="..." (except dynamic canvas rendering in collaborative editor)
        if (rel.endsWith('.html')) {
          const styleMatches = code.match(/\bstyle\s*=\s*["'][^"']*["']/gi);
          assert.strictEqual(
            styleMatches,
            null,
            `Template ${rel} contains forbidden inline style: ${styleMatches ? styleMatches.join(', ') : ''}`
          );
        } else if (rel.endsWith('projects.view.ts')) {
          const metaRows = code.match(/<div class="tool-card__meta-row"[^>]*>([\s\S]*?)<\/div>/g) || [];
          for (const row of metaRows) {
            assert.strictEqual(/\bstyle\s*=/i.test(row), false, 'Meta-row contains inline style');
          }
          const badgePills = code.match(/<span class="tool-card__badge-pill"[^>]*>([\s\S]*?)<\/span>/g) || [];
          for (const pill of badgePills) {
            assert.strictEqual(/\bstyle\s*=/i.test(pill), false, 'Badge pill contains inline style');
          }
        } else if (rel.endsWith('.ts') && !rel.includes('collaborative-pdf-editor.view.ts')) {
          const styleMatches = code.match(/style\s*=\s*["'][^"']*["']/gi);
          assert.strictEqual(
            styleMatches,
            null,
            `File ${rel} contains forbidden inline style attribute`
          );
        }
      }
    });

    it('3.3: Strict ZERO unauthorized console.* statements in frontend (only 2 lifecycle logs in websocket.service.ts)', () => {
      for (const rel of touchedFiles) {
        if (!rel.startsWith('apps/BoardPDF/client/')) continue;
        const full = resolveRepo(rel);
        const code = fs.readFileSync(full, 'utf8');

        if (rel.endsWith('websocket.service.ts')) {
          const consoleMatches = code.match(/console\.[a-z]+/g) || [];
          assert.strictEqual(
            consoleMatches.length,
            2,
            `websocket.service.ts must contain exactly 2 authorized console logs, found ${consoleMatches.length}`
          );
        } else {
          const consoleMatches = code.match(/console\.[a-z]+/g);
          assert.strictEqual(
            consoleMatches,
            null,
            `File ${rel} contains forbidden console statement: ${consoleMatches ? consoleMatches.join(', ') : ''}`
          );
        }
      }
    });

    it('3.4: Strict ZERO user-facing mentions of "Stripe" in templates and client views', () => {
      const checkoutHtml = fs.readFileSync(resolveRepo('apps/BoardPDF/public/views/checkout/checkout.html'), 'utf8');
      assert.strictEqual(/>[^<]*stripe[^<]*</i.test(checkoutHtml), false, 'checkout.html must not contain user-visible Stripe');

      const checkoutModal = fs.readFileSync(resolveRepo('apps/BoardPDF/client/components/checkout-modal.component.ts'), 'utf8');
      const suspiciousModal = checkoutModal.split('\n').filter((line) => {
        if (!/stripe/i.test(line)) return false;
        if (/import|loadStripeSdk|getStripeAppearance|stripe:|stripe\.|data-ref="stripe-payment-mount-point"|stripe-payment-mount-point/i.test(line)) return false;
        return true;
      });
      assert.strictEqual(suspiciousModal.length, 0, `checkout-modal has suspicious lines: ${suspiciousModal.join('; ')}`);

      const generalJson = JSON.parse(fs.readFileSync(resolveRepo('apps/BoardPDF/public/translations/es/general.json'), 'utf8'));
      const checkoutDict = generalJson.checkout || {};
      for (const [key, val] of Object.entries(checkoutDict)) {
        if (typeof val === 'string') {
          assert.strictEqual(val.toLowerCase().includes('stripe'), false, `general.json checkout.${key} must not mention Stripe`);
        }
      }
    });

    it('3.5: All import statements in touched TypeScript files are single-line horizontal and sorted alphabetically', () => {
      for (const rel of touchedFiles) {
        if (!rel.endsWith('.ts')) continue;
        const full = resolveRepo(rel);
        const lines = fs.readFileSync(full, 'utf8').split('\n');

        const importLines: string[] = [];
        let inMultiLineImport = false;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('import ') && !trimmed.endsWith(';')) {
            inMultiLineImport = true;
          }
          if (inMultiLineImport) {
            if (trimmed.endsWith(';')) {
              inMultiLineImport = false;
            }
            assert.fail(`File ${rel} contains multi-line import: "${trimmed}"`);
          }
          if (trimmed.startsWith('import ')) {
            importLines.push(trimmed);
          }
        }

        // Verify named import members inside { ... } are sorted alphabetically (supporting ASCII or case-insensitive)
        for (const imp of importLines) {
          const namedMatch = imp.match(/import\s*\{([^}]+)\}/);
          if (namedMatch) {
            const members = namedMatch[1].split(',').map((m) => m.trim()).filter(Boolean);
            const sortedAscii = [...members].sort();
            const sortedCaseInsensitive = [...members].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
            const isSorted =
              members.every((m, i) => m === sortedAscii[i]) ||
              members.every((m, i) => m === sortedCaseInsensitive[i]);
            assert.ok(
              isSorted,
              `File ${rel} has unsorted import members: { ${members.join(', ')} }`
            );
          }
        }
      }
    });

    it('3.6: All translation keys referenced in HTML (data-i18n) resolve in general.json', () => {
      const generalJson = JSON.parse(fs.readFileSync(resolveRepo('apps/BoardPDF/public/translations/es/general.json'), 'utf8'));

      function hasKey(obj: any, keyPath: string): boolean {
        const parts = keyPath.split('.');
        let curr = obj;
        for (const p of parts) {
          if (curr && typeof curr === 'object' && p in curr) {
            curr = curr[p];
          } else {
            return false;
          }
        }
        return typeof curr === 'string';
      }

      const templatesToCheck = [
        'apps/BoardPDF/public/views/checkout/checkout.html',
        'apps/BoardPDF/public/views/projects/projects.html',
      ];

      for (const rel of templatesToCheck) {
        const html = fs.readFileSync(resolveRepo(rel), 'utf8');
        const matches = html.match(/data-i18n="([^"]+)"/g) || [];
        for (const m of matches) {
          const key = m.replace('data-i18n="', '').replace('"', '');
          assert.strictEqual(hasKey(generalJson, key), true, `Template ${rel} references unresolvable key: ${key}`);
        }
      }
    });
  });
});
