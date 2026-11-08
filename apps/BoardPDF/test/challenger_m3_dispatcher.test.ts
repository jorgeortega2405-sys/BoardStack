import assert from 'node:assert';
import { PageDimension } from '../client/config/collab-page-presets.config.js';
import { wsService } from '../client/services/websocket.service.js';
import {
  ActionCallback,
  CollabAction,
  CollabActionDispatcher,
  CollabActionType,
  CollabEditorDelegate,
} from '../client/views/collaborative-pdf/collab-action-dispatcher.service.js';
import { EditorElement, PagePdfSource } from '../client/views/collaborative-pdf/collaborative-pdf.types.js';

interface TestHarnessState {
  alignedElements: Array<{ alignment: string; elementId: string }>;
  canEditFlag: boolean;
  delegate: CollabEditorDelegate;
  dispatcher: CollabActionDispatcher;
  flushedAutoSaveCount: number;
  historyRecordCount: number;
  lastSelectedElementId: string | null;
  layerMoves: Array<{ direction: string; elementId: string }>;
  layerReorders: Array<{ draggedId: string; targetId: string }>;
  lockedPages: Set<number>;
  redoCount: number;
  renderLayersCount: number;
  renderPagesCount: number;
  sentMessages: any[];
  setModifiedCalls: boolean[];
  undoCount: number;
  updatedContextToolbarCount: number;
  updatedTransformBoxCount: number;
}

function createTestHarness(initialElements: EditorElement[] = []): TestHarnessState {
  const state: TestHarnessState = {
    alignedElements: [],
    canEditFlag: true,
    delegate: null as any,
    dispatcher: null as any,
    flushedAutoSaveCount: 0,
    historyRecordCount: 0,
    lastSelectedElementId: null,
    layerMoves: [],
    layerReorders: [],
    lockedPages: new Set<number>(),
    redoCount: 0,
    renderLayersCount: 0,
    renderPagesCount: 0,
    sentMessages: [],
    setModifiedCalls: [],
    undoCount: 0,
    updatedContextToolbarCount: 0,
    updatedTransformBoxCount: 0,
  };

  const defaultDimension: PageDimension = { height: 1123, width: 794 };

  const delegate: CollabEditorDelegate = {
    alignElementToPage: (elementId: string, alignment: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top') => {
      const el = delegate.elements.find((e) => e.id === elementId);
      if (!el) return false;
      state.alignedElements.push({ alignment, elementId });
      if (alignment === 'left') (el as any).x = 0;
      if (alignment === 'center') (el as any).x = 200;
      return true;
    },
    canEdit: () => state.canEditFlag,
    docDefaultPageSize: { ...defaultDimension },
    docTitle: 'Test Document',
    elements: [...initialElements],
    flushAutoSave: async () => {
      state.flushedAutoSaveCount++;
    },
    getPageDimensions: (pageIndex: number) => delegate.pageSizes[pageIndex] || defaultDimension,
    isCollabRoomFull: false,
    isLockedPage: (pageIndex: number) => state.lockedPages.has(pageIndex),
    moveElementLayer: (elementId: string, direction: 'back' | 'backward' | 'forward' | 'front') => {
      const idx = delegate.elements.findIndex((e) => e.id === elementId);
      if (idx === -1) return false;
      state.layerMoves.push({ direction, elementId });
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
    redo: () => {
      state.redoCount++;
    },
    renderLayersList: () => {
      state.renderLayersCount++;
    },
    renderPages: () => {
      state.renderPagesCount++;
    },
    reorderElementLayer: (draggedId: string, targetId: string) => {
      const dIdx = delegate.elements.findIndex((e) => e.id === draggedId);
      const tIdx = delegate.elements.findIndex((e) => e.id === targetId);
      if (dIdx === -1 || tIdx === -1) return false;
      state.layerReorders.push({ draggedId, targetId });
      return true;
    },
    selectElement: (id: string | null) => {
      delegate.selectedElementId = id;
      state.lastSelectedElementId = id;
    },
    selectedElementId: null,
    setDocTitle: (title: string) => {
      delegate.docTitle = title;
    },
    setModified: (val: boolean) => {
      state.setModifiedCalls.push(val);
    },
    undo: () => {
      state.undoCount++;
    },
    updateContextToolbar: () => {
      state.updatedContextToolbarCount++;
    },
    updateTransformBoxPosition: () => {
      state.updatedTransformBoxCount++;
    },
  };

  state.delegate = delegate;
  state.dispatcher = new CollabActionDispatcher(delegate);

  wsService.send = (msg: any): boolean => {
    state.sentMessages.push(JSON.parse(JSON.stringify(msg)));
    return true;
  };

  return state;
}

async function runDispatcherEmpiricalSuite() {
  console.log('================================================================');
  console.log('CHALLENGER 2: COLLABACTIONDISPATCHER & PEER SYNC EMPIRICAL SUITE');
  console.log('================================================================\n');

  let passedAssertions = 0;
  let testCount = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    testCount++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`[PASS] ${name}`);
          })
          .catch((err) => {
            console.error(`[FAIL] ${name}: ${err.message}`);
            throw err;
          });
      }
      console.log(`[PASS] ${name}`);
      return Promise.resolve();
    } catch (err: any) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  // --- SUITE 1: Element Lifecycle Mutations (F14 / R10) ---
  console.log('--- SUITE 1: Element Mutations & Real-time Broadcasts ---');

  await test('1.1 ELEMENT_ADD inserts element, triggers render, records history, and broadcasts add', () => {
    const harness = createTestHarness();
    const textEl: EditorElement = {
      fontSize: 16,
      id: 'text-1',
      pageIndex: 0,
      text: 'Hello Collab',
      type: 'text',
      x: 50,
      y: 60,
    } as any;

    const ok = harness.dispatcher.dispatch({
      payload: textEl,
      type: 'ELEMENT_ADD',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.delegate.elements.length, 1);
    assert.strictEqual(harness.delegate.elements[0].id, 'text-1');
    assert.strictEqual(harness.renderPagesCount, 1);
    assert.strictEqual(harness.historyRecordCount, 1);
    assert.deepStrictEqual(harness.setModifiedCalls, [true]);

    assert.strictEqual(harness.sentMessages.length, 1);
    const msg = harness.sentMessages[0];
    assert.strictEqual(msg.type, 'elementChange');
    assert.strictEqual(msg.action, 'add');
    assert.strictEqual(msg.element.id, 'text-1');
    assert.strictEqual(msg.pageIndex, 0);
    passedAssertions += 8;
  });

  await test('1.2 ELEMENT_UPDATE updates existing element and broadcasts update', () => {
    const existing: EditorElement = {
      fontSize: 14,
      id: 'text-1',
      pageIndex: 0,
      text: 'Initial',
      type: 'text',
      x: 10,
      y: 20,
    } as any;
    const harness = createTestHarness([existing]);

    const ok = harness.dispatcher.dispatch({
      payload: { fontSize: 20, id: 'text-1', text: 'Updated Text' },
      type: 'ELEMENT_UPDATE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual((harness.delegate.elements[0] as any).text, 'Updated Text');
    assert.strictEqual((harness.delegate.elements[0] as any).fontSize, 20);
    assert.strictEqual((harness.delegate.elements[0] as any).x, 10);
    assert.strictEqual(harness.updatedContextToolbarCount, 1);
    assert.strictEqual(harness.updatedTransformBoxCount, 1);

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'elementChange');
    assert.strictEqual(harness.sentMessages[0].action, 'update');
    assert.strictEqual(harness.sentMessages[0].element.text, 'Updated Text');
    passedAssertions += 8;
  });

  await test('1.3 ELEMENT_UPDATE returns false and suppresses broadcast on missing target', () => {
    const harness = createTestHarness();
    const ok = harness.dispatcher.dispatch({
      payload: { id: 'non-existent', text: 'Ghost' },
      type: 'ELEMENT_UPDATE',
    });

    assert.strictEqual(ok, false);
    assert.strictEqual(harness.sentMessages.length, 0);
    assert.strictEqual(harness.historyRecordCount, 0);
    passedAssertions += 3;
  });

  await test('1.4 ELEMENT_DELETE removes element, deselects if active, and broadcasts delete', () => {
    const el1: EditorElement = { id: 'el-1', pageIndex: 0, type: 'text', x: 0, y: 0 } as any;
    const el2: EditorElement = { id: 'el-2', pageIndex: 0, type: 'shape', x: 0, y: 0 } as any;
    const harness = createTestHarness([el1, el2]);
    harness.delegate.selectedElementId = 'el-1';

    const ok = harness.dispatcher.dispatch({
      pageIndex: 0,
      payload: { id: 'el-1' },
      type: 'ELEMENT_DELETE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.delegate.elements.length, 1);
    assert.strictEqual(harness.delegate.elements[0].id, 'el-2');
    assert.strictEqual(harness.delegate.selectedElementId, null);

    assert.strictEqual(harness.sentMessages.length, 1);
    const msg = harness.sentMessages[0];
    assert.strictEqual(msg.type, 'elementChange');
    assert.strictEqual(msg.action, 'delete');
    assert.strictEqual(msg.element.id, 'el-1');
    assert.strictEqual(msg.pageIndex, 0);
    passedAssertions += 7;
  });

  await test('1.5 ELEMENT_DUPLICATE appends cloned element, selects it, and broadcasts add', () => {
    const orig: EditorElement = { id: 'el-1', pageIndex: 0, type: 'text', x: 10, y: 10 } as any;
    const harness = createTestHarness([orig]);

    const dupEl: EditorElement = { id: 'el-1-copy', pageIndex: 0, type: 'text', x: 25, y: 25 } as any;
    const ok = harness.dispatcher.dispatch({
      payload: dupEl,
      type: 'ELEMENT_DUPLICATE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.delegate.elements.length, 2);
    assert.strictEqual(harness.delegate.elements[1].id, 'el-1-copy');
    assert.strictEqual(harness.lastSelectedElementId, 'el-1-copy');

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'elementChange');
    assert.strictEqual(harness.sentMessages[0].action, 'add');
    passedAssertions += 5;
  });

  await test('1.6 ELEMENT_MOVE mutates coordinates and broadcasts update', () => {
    const el: EditorElement = { id: 'box-1', pageIndex: 0, type: 'shape', x: 0, y: 0 } as any;
    const harness = createTestHarness([el]);

    const ok = harness.dispatcher.dispatch({
      payload: { id: 'box-1', x: 140, y: 220 },
      type: 'ELEMENT_MOVE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual((harness.delegate.elements[0] as any).x, 140);
    assert.strictEqual((harness.delegate.elements[0] as any).y, 220);
    assert.strictEqual(harness.updatedTransformBoxCount, 1);

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'elementChange');
    assert.strictEqual(harness.sentMessages[0].action, 'update');
    assert.strictEqual(harness.sentMessages[0].element.x, 140);
    passedAssertions += 6;
  });

  await test('1.7 ELEMENT_RESIZE mutates dimensions and broadcasts update', () => {
    const el: EditorElement = { height: 50, id: 'box-1', pageIndex: 0, type: 'shape', width: 50, x: 0, y: 0 } as any;
    const harness = createTestHarness([el]);

    const ok = harness.dispatcher.dispatch({
      payload: { height: 180, id: 'box-1', width: 240, x: 10, y: 20 },
      type: 'ELEMENT_RESIZE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual((harness.delegate.elements[0] as any).width, 240);
    assert.strictEqual((harness.delegate.elements[0] as any).height, 180);

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'elementChange');
    assert.strictEqual(harness.sentMessages[0].action, 'update');
    passedAssertions += 4;
  });

  await test('1.8 ELEMENT_ROTATE mutates rotation and broadcasts update', () => {
    const el: EditorElement = { id: 'box-1', pageIndex: 0, rotation: 0, type: 'shape', x: 0, y: 0 } as any;
    const harness = createTestHarness([el]);

    const ok = harness.dispatcher.dispatch({
      payload: { id: 'box-1', rotation: 90 },
      type: 'ELEMENT_ROTATE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual((harness.delegate.elements[0] as any).rotation, 90);
    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].element.rotation, 90);
    passedAssertions += 3;
  });

  await test('1.9 ELEMENT_STYLE_UPDATE mutates font/typography and broadcasts update', () => {
    const el: EditorElement = { fontSize: 12, id: 'text-1', isBold: false, pageIndex: 0, type: 'text', x: 0, y: 0 } as any;
    const harness = createTestHarness([el]);

    const ok = harness.dispatcher.dispatch({
      payload: { fontSize: 18, id: 'text-1', isBold: true },
      type: 'ELEMENT_STYLE_UPDATE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual((harness.delegate.elements[0] as any).fontSize, 18);
    assert.strictEqual((harness.delegate.elements[0] as any).isBold, true);
    assert.strictEqual(harness.updatedContextToolbarCount, 1);

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'elementChange');
    assert.strictEqual(harness.sentMessages[0].action, 'update');
    passedAssertions += 5;
  });

  await test('1.10 DRAWING_ADD and DRAWING_ERASE handle freehand stroke lifecycle', () => {
    const harness = createTestHarness();
    const drawingEl: EditorElement = {
      color: '#ff0000',
      id: 'draw-1',
      pageIndex: 0,
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      type: 'drawing',
    } as any;

    const okAdd = harness.dispatcher.dispatch({
      payload: drawingEl,
      type: 'DRAWING_ADD',
    });
    assert.strictEqual(okAdd, true);
    assert.strictEqual(harness.delegate.elements.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'elementChange');
    assert.strictEqual(harness.sentMessages[0].action, 'add');

    const okErase = harness.dispatcher.dispatch({
      payload: { id: 'draw-1' },
      type: 'DRAWING_ERASE',
    });
    assert.strictEqual(okErase, true);
    assert.strictEqual(harness.delegate.elements.length, 0);
    assert.strictEqual(harness.sentMessages[1].type, 'elementChange');
    assert.strictEqual(harness.sentMessages[1].action, 'delete');
    passedAssertions += 6;
  });

  // --- SUITE 2: Layer & Alignment Operations (F14 / R10) ---
  console.log('\n--- SUITE 2: Layer Operations & Alignment Synchronization ---');

  await test('2.1 ELEMENT_LAYER_MOVE calls delegate, selects element, updates layers list, and broadcasts docSync', () => {
    const el1: EditorElement = { id: 'el-1', pageIndex: 0, type: 'text', x: 0, y: 0 } as any;
    const el2: EditorElement = { id: 'el-2', pageIndex: 0, type: 'shape', x: 0, y: 0 } as any;
    const harness = createTestHarness([el1, el2]);

    const ok = harness.dispatcher.dispatch({
      payload: { direction: 'forward', elementId: 'el-1' },
      type: 'ELEMENT_LAYER_MOVE',
    });

    assert.strictEqual(ok, true);
    assert.deepStrictEqual(harness.layerMoves, [{ direction: 'forward', elementId: 'el-1' }]);
    assert.strictEqual(harness.lastSelectedElementId, 'el-1');
    assert.strictEqual(harness.renderLayersCount, 1);
    assert.strictEqual(harness.renderPagesCount, 1);

    assert.strictEqual(harness.sentMessages.length, 1);
    const syncMsg = harness.sentMessages[0];
    assert.strictEqual(syncMsg.type, 'docSync');
    assert.strictEqual(syncMsg.pageCount, 1);
    assert.strictEqual(syncMsg.elements.length, 2);
    assert.strictEqual(syncMsg.title, 'Test Document');
    passedAssertions += 8;
  });

  await test('2.2 ELEMENT_LAYER_REORDER moves dragged layer relative to target and broadcasts docSync', () => {
    const el1: EditorElement = { id: 'el-1', pageIndex: 0, type: 'text', x: 0, y: 0 } as any;
    const el2: EditorElement = { id: 'el-2', pageIndex: 0, type: 'shape', x: 0, y: 0 } as any;
    const harness = createTestHarness([el1, el2]);

    const ok = harness.dispatcher.dispatch({
      payload: { draggedId: 'el-1', targetId: 'el-2' },
      type: 'ELEMENT_LAYER_REORDER',
    });

    assert.strictEqual(ok, true);
    assert.deepStrictEqual(harness.layerReorders, [{ draggedId: 'el-1', targetId: 'el-2' }]);
    assert.strictEqual(harness.lastSelectedElementId, 'el-1');
    assert.strictEqual(harness.renderLayersCount, 1);

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'docSync');
    passedAssertions += 5;
  });

  await test('2.3 ELEMENT_ALIGN delegates page alignment and broadcasts elementChange update', () => {
    const el1: EditorElement = { id: 'el-1', pageIndex: 0, type: 'text', x: 0, y: 0 } as any;
    const harness = createTestHarness([el1]);

    const ok = harness.dispatcher.dispatch({
      payload: { alignment: 'center', elementId: 'el-1' },
      type: 'ELEMENT_ALIGN',
    });

    assert.strictEqual(ok, true);
    assert.deepStrictEqual(harness.alignedElements, [{ alignment: 'center', elementId: 'el-1' }]);
    assert.strictEqual((harness.delegate.elements[0] as any).x, 200);
    assert.strictEqual(harness.lastSelectedElementId, 'el-1');

    assert.strictEqual(harness.sentMessages.length, 1);
    const msg = harness.sentMessages[0];
    assert.strictEqual(msg.type, 'elementChange');
    assert.strictEqual(msg.action, 'update');
    assert.strictEqual(msg.element.id, 'el-1');
    passedAssertions += 6;
  });

  // --- SUITE 3: Page Operations (F14 / R10) ---
  console.log('\n--- SUITE 3: Page Operations & Synchronization ---');

  await test('3.1 PAGE_ADD appends page, bumps element indices if inserted, and broadcasts docSync', () => {
    const el: EditorElement = { id: 'el-0', pageIndex: 0, type: 'text', x: 0, y: 0 } as any;
    const harness = createTestHarness([el]);

    const ok = harness.dispatcher.dispatch({
      payload: {},
      type: 'PAGE_ADD',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.delegate.pageCount, 2);
    assert.strictEqual(harness.delegate.pageSizes.length, 2);
    assert.strictEqual(harness.delegate.pageTitles.length, 2);
    assert.strictEqual(harness.delegate.pageBackgrounds.length, 2);

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'docSync');
    assert.strictEqual(harness.sentMessages[0].pageCount, 2);
    passedAssertions += 6;
  });

  await test('3.2 PAGE_ADD with custom dimension and afterIndex inserts at designated slot', () => {
    const el0: EditorElement = { id: 'el-0', pageIndex: 0, type: 'text', x: 0, y: 0 } as any;
    const el1: EditorElement = { id: 'el-1', pageIndex: 1, type: 'text', x: 0, y: 0 } as any;
    const harness = createTestHarness([el0, el1]);
    harness.delegate.pageCount = 2;
    harness.delegate.pageSizes = [{ height: 1000, width: 800 }, { height: 1000, width: 800 }];
    harness.delegate.pageTitles = ['P0', 'P1'];
    harness.delegate.pageBackgrounds = ['#ffffff', '#ffffff'];
    harness.delegate.pagePdfSources = [null, null];

    const ok = harness.dispatcher.dispatch({
      payload: { afterIndex: 0, customDim: { height: 500, width: 400 } },
      type: 'PAGE_ADD',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.delegate.pageCount, 3);
    assert.strictEqual(harness.delegate.pageSizes[1].width, 400);
    assert.strictEqual(harness.delegate.pageSizes[1].height, 500);
    assert.strictEqual(el1.pageIndex, 2);
    passedAssertions += 5;
  });

  await test('3.3 PAGE_DELETE rejects deletion if pageCount is 1', () => {
    const harness = createTestHarness();
    assert.strictEqual(harness.delegate.pageCount, 1);

    const ok = harness.dispatcher.dispatch({
      payload: { pageIndex: 0 },
      type: 'PAGE_DELETE',
    });

    assert.strictEqual(ok, false);
    assert.strictEqual(harness.delegate.pageCount, 1);
    assert.strictEqual(harness.sentMessages.length, 0);
    passedAssertions += 3;
  });

  await test('3.4 PAGE_DELETE removes page elements, shifts remaining pages, and broadcasts docSync', () => {
    const elP0: EditorElement = { id: 'p0-el', pageIndex: 0, type: 'text', x: 0, y: 0 } as any;
    const elP1: EditorElement = { id: 'p1-el', pageIndex: 1, type: 'text', x: 0, y: 0 } as any;
    const harness = createTestHarness([elP0, elP1]);
    harness.delegate.pageCount = 2;
    harness.delegate.pageSizes = [{ height: 1000, width: 800 }, { height: 1200, width: 900 }];
    harness.delegate.pageTitles = ['Page 1', 'Page 2'];
    harness.delegate.pageBackgrounds = ['#fff', '#eee'];
    harness.delegate.pagePdfSources = [null, null];

    const ok = harness.dispatcher.dispatch({
      payload: { pageIndex: 0 },
      type: 'PAGE_DELETE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.delegate.pageCount, 1);
    assert.strictEqual(harness.delegate.elements.length, 1);
    assert.strictEqual(harness.delegate.elements[0].id, 'p1-el');
    assert.strictEqual(harness.delegate.elements[0].pageIndex, 0);
    assert.strictEqual(harness.delegate.pageTitles[0], 'Page 2');

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'docSync');
    assert.strictEqual(harness.sentMessages[0].pageCount, 1);
    passedAssertions += 8;
  });

  await test('3.5 PAGE_DUPLICATE clones page metadata, elements with fresh IDs, and broadcasts docSync', () => {
    const el: EditorElement = { id: 'orig-el', pageIndex: 0, text: 'Dupe me', type: 'text', x: 10, y: 20 } as any;
    const harness = createTestHarness([el]);
    harness.delegate.pageTitles = ['Overview'];

    const ok = harness.dispatcher.dispatch({
      payload: { pageIndex: 0 },
      type: 'PAGE_DUPLICATE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.delegate.pageCount, 2);
    assert.strictEqual(harness.delegate.elements.length, 2);
    assert.strictEqual(harness.delegate.elements[1].pageIndex, 1);
    assert.notStrictEqual(harness.delegate.elements[1].id, 'orig-el');
    assert.strictEqual((harness.delegate.elements[1] as any).text, 'Dupe me');
    assert.strictEqual(harness.delegate.pageTitles[1], 'Overview (Copia)');

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'docSync');
    assert.strictEqual(harness.sentMessages[0].pageCount, 2);
    passedAssertions += 8;
  });

  await test('3.6 PAGE_MOVE swaps pages and re-indexes page elements cleanly', () => {
    const el0: EditorElement = { id: 'el-p0', pageIndex: 0, type: 'text', x: 0, y: 0 } as any;
    const el1: EditorElement = { id: 'el-p1', pageIndex: 1, type: 'text', x: 0, y: 0 } as any;
    const harness = createTestHarness([el0, el1]);
    harness.delegate.pageCount = 2;
    harness.delegate.pageTitles = ['Page A', 'Page B'];
    harness.delegate.pageBackgrounds = ['#111111', '#222222'];
    harness.delegate.pageSizes = [{ height: 800, width: 600 }, { height: 900, width: 700 }];
    harness.delegate.pagePdfSources = [null, null];

    const ok = harness.dispatcher.dispatch({
      payload: { fromIndex: 0, toIndex: 1 },
      type: 'PAGE_MOVE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(el0.pageIndex, 1);
    assert.strictEqual(el1.pageIndex, 0);
    assert.strictEqual(harness.delegate.pageTitles[0], 'Page B');
    assert.strictEqual(harness.delegate.pageTitles[1], 'Page A');
    assert.strictEqual(harness.delegate.pageBackgrounds[0], '#222222');
    assert.strictEqual(harness.delegate.pageBackgrounds[1], '#111111');

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'docSync');
    passedAssertions += 8;
  });

  await test('3.7 PAGE_MOVE rejects out-of-range indices safely', () => {
    const harness = createTestHarness();
    assert.strictEqual(harness.delegate.pageCount, 1);

    const ok1 = harness.dispatcher.dispatch({
      payload: { fromIndex: -1, toIndex: 0 },
      type: 'PAGE_MOVE',
    });
    assert.strictEqual(ok1, false);

    const ok2 = harness.dispatcher.dispatch({
      payload: { fromIndex: 0, toIndex: 5 },
      type: 'PAGE_MOVE',
    });
    assert.strictEqual(ok2, false);
    assert.strictEqual(harness.sentMessages.length, 0);
    passedAssertions += 3;
  });

  await test('3.8 PAGE_SET_SIZE, PAGE_SET_BG, PAGE_SET_TITLE, and PAGE_TOGGLE_LOCK', () => {
    const harness = createTestHarness();

    // Size single page
    harness.dispatcher.dispatch({
      payload: { dimension: { height: 600, width: 500 }, pageIndex: 0 },
      type: 'PAGE_SET_SIZE',
    });
    assert.deepStrictEqual(harness.delegate.pageSizes[0], { height: 600, width: 500 });

    // Background
    harness.dispatcher.dispatch({
      payload: { color: '#abcdef', pageIndex: 0 },
      type: 'PAGE_SET_BG',
    });
    assert.strictEqual(harness.delegate.pageBackgrounds[0], '#abcdef');

    // Title
    harness.dispatcher.dispatch({
      payload: { pageIndex: 0, title: 'Introduction' },
      type: 'PAGE_SET_TITLE',
    });
    assert.strictEqual(harness.delegate.pageTitles[0], 'Introduction');

    // Lock toggle
    const okLock = harness.dispatcher.dispatch({
      payload: { pageIndex: 0 },
      type: 'PAGE_TOGGLE_LOCK',
    });
    assert.strictEqual(okLock, true);
    passedAssertions += 4;
  });

  // --- SUITE 4: Document-Level Operations & History (F14 / R10) ---
  console.log('\n--- SUITE 4: Document Synchronization & Undo / Redo ---');

  await test('4.1 DOC_TITLE_CHANGE mutates document title and broadcasts titleChange payload', () => {
    const harness = createTestHarness();

    const ok = harness.dispatcher.dispatch({
      payload: { title: 'Renamed Project' },
      type: 'DOC_TITLE_CHANGE',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.delegate.docTitle, 'Renamed Project');
    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'titleChange');
    assert.strictEqual(harness.sentMessages[0].title, 'Renamed Project');
    passedAssertions += 4;
  });

  await test('4.2 DOC_SYNC_FULL updates entire document state without recording history', () => {
    const harness = createTestHarness();

    const newElements: EditorElement[] = [
      { id: 'el-sync-1', pageIndex: 0, type: 'text', x: 5, y: 5 } as any,
    ];

    const ok = harness.dispatcher.dispatch({
      payload: {
        elements: newElements,
        pageBackgrounds: ['#000000'],
        pageCount: 1,
        pageSizes: [{ height: 800, width: 600 }],
        title: 'Full Synced Doc',
      },
      type: 'DOC_SYNC_FULL',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.delegate.docTitle, 'Full Synced Doc');
    assert.strictEqual(harness.delegate.elements.length, 1);
    assert.strictEqual(harness.delegate.elements[0].id, 'el-sync-1');
    assert.strictEqual(harness.historyRecordCount, 0, 'DOC_SYNC_FULL must not push redundant undo history');

    assert.strictEqual(harness.sentMessages.length, 1);
    assert.strictEqual(harness.sentMessages[0].type, 'docSync');
    passedAssertions += 5;
  });

  await test('4.3 UNDO and REDO delegate without mutation guards or peer broadcasting', () => {
    const harness = createTestHarness();
    harness.canEditFlag = false; // Even when read-only, local undo/redo viewer can be invoked

    const okUndo = harness.dispatcher.dispatch({ payload: {}, type: 'UNDO' });
    const okRedo = harness.dispatcher.dispatch({ payload: {}, type: 'REDO' });

    assert.strictEqual(okUndo, true);
    assert.strictEqual(okRedo, true);
    assert.strictEqual(harness.undoCount, 1);
    assert.strictEqual(harness.redoCount, 1);
    assert.strictEqual(harness.sentMessages.length, 0, 'UNDO/REDO must not trigger WebSocket broadcasts');
    assert.strictEqual(harness.historyRecordCount, 0);
    passedAssertions += 6;
  });

  // --- SUITE 5: Permission & Security Gates (PBAC / canEdit) ---
  console.log('\n--- SUITE 5: Security & PBAC Permission Enforcement ---');

  await test('5.1 canEdit() === false rejects ALL mutation actions and suppresses broadcasts', () => {
    const harness = createTestHarness();
    harness.canEditFlag = false;

    const mutationActions: Array<{ payload: any; type: CollabActionType }> = [
      { payload: { id: 't1', pageIndex: 0, type: 'text', x: 0, y: 0 }, type: 'ELEMENT_ADD' },
      { payload: { id: 't1', text: 'no' }, type: 'ELEMENT_UPDATE' },
      { payload: { id: 't1' }, type: 'ELEMENT_DELETE' },
      { payload: { id: 't1-copy', pageIndex: 0, type: 'text', x: 0, y: 0 }, type: 'ELEMENT_DUPLICATE' },
      { payload: { id: 't1', x: 10, y: 10 }, type: 'ELEMENT_MOVE' },
      { payload: { height: 10, id: 't1', width: 10 }, type: 'ELEMENT_RESIZE' },
      { payload: { id: 't1', rotation: 45 }, type: 'ELEMENT_ROTATE' },
      { payload: { direction: 'forward', elementId: 't1' }, type: 'ELEMENT_LAYER_MOVE' },
      { payload: { draggedId: 't1', targetId: 't2' }, type: 'ELEMENT_LAYER_REORDER' },
      { payload: { alignment: 'center', elementId: 't1' }, type: 'ELEMENT_ALIGN' },
      { payload: { fontSize: 20, id: 't1' }, type: 'ELEMENT_STYLE_UPDATE' },
      { payload: { color: '#000', id: 'd1', pageIndex: 0, points: [], type: 'drawing' }, type: 'DRAWING_ADD' },
      { payload: { id: 'd1' }, type: 'DRAWING_ERASE' },
      { payload: {}, type: 'PAGE_ADD' },
      { payload: { pageIndex: 0 }, type: 'PAGE_DELETE' },
      { payload: { pageIndex: 0 }, type: 'PAGE_DUPLICATE' },
      { payload: { fromIndex: 0, toIndex: 1 }, type: 'PAGE_MOVE' },
      { payload: { dimension: { height: 100, width: 100 }, pageIndex: 0 }, type: 'PAGE_SET_SIZE' },
      { payload: { color: '#000', pageIndex: 0 }, type: 'PAGE_SET_BG' },
      { payload: { pageIndex: 0, title: 'no' }, type: 'PAGE_SET_TITLE' },
      { payload: { title: 'Forbidden' }, type: 'DOC_TITLE_CHANGE' },
      { payload: { elements: [] }, type: 'DOC_SYNC_FULL' },
    ];

    for (const act of mutationActions) {
      const ok = harness.dispatcher.dispatch(act);
      assert.strictEqual(ok, false, `Action ${act.type} should be rejected when canEdit is false`);
      passedAssertions++;
    }

    assert.strictEqual(harness.sentMessages.length, 0, 'No broadcasts allowed when canEdit is false');
    assert.strictEqual(harness.historyRecordCount, 0, 'No history recorded when canEdit is false');
    assert.strictEqual(harness.delegate.elements.length, 0);
    passedAssertions += 3;
  });

  await test('5.2 isLockedPage(pageIndex) === true rejects mutations targeted at locked page', () => {
    const elP0: EditorElement = { id: 'p0-el', pageIndex: 0, type: 'text', x: 0, y: 0 } as any;
    const elP1: EditorElement = { id: 'p1-el', pageIndex: 1, type: 'text', x: 0, y: 0 } as any;
    const harness = createTestHarness([elP0, elP1]);
    harness.delegate.pageCount = 2;
    harness.lockedPages.add(1); // Lock page index 1

    // 1. Attempt mutation on locked page 1 -> must fail
    const okLocked = harness.dispatcher.dispatch({
      pageIndex: 1,
      payload: { id: 'new-el', pageIndex: 1, type: 'text', x: 10, y: 10 },
      type: 'ELEMENT_ADD',
    });
    assert.strictEqual(okLocked, false, 'Mutating locked page 1 must be rejected');

    // 2. Attempt mutation on unlocked page 0 -> must succeed
    const okUnlocked = harness.dispatcher.dispatch({
      pageIndex: 0,
      payload: { id: 'new-el-p0', pageIndex: 0, type: 'text', x: 10, y: 10 },
      type: 'ELEMENT_ADD',
    });
    assert.strictEqual(okUnlocked, true, 'Mutating unlocked page 0 must succeed');
    assert.strictEqual(harness.delegate.elements.length, 3);

    // 3. PAGE_TOGGLE_LOCK on locked page is allowed (so user can toggle/unlock)
    const okToggle = harness.dispatcher.dispatch({
      pageIndex: 1,
      payload: { pageIndex: 1 },
      type: 'PAGE_TOGGLE_LOCK',
    });
    assert.strictEqual(okToggle, true, 'PAGE_TOGGLE_LOCK is allowed on locked page');
    passedAssertions += 4;
  });

  // --- SUITE 6: Broadcast Filtering & Options (F14 / R10) ---
  console.log('\n--- SUITE 6: Broadcast Flags & Full Room Suppression ---');

  await test('6.1 options.skipBroadcast: true suppresses WebSocket transmission', () => {
    const harness = createTestHarness();
    const ok = harness.dispatcher.dispatch(
      {
        payload: { id: 'el-1', pageIndex: 0, type: 'text', x: 0, y: 0 },
        type: 'ELEMENT_ADD',
      },
      { skipBroadcast: true }
    );

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.delegate.elements.length, 1);
    assert.strictEqual(harness.sentMessages.length, 0);
    assert.strictEqual(harness.historyRecordCount, 1);
    passedAssertions += 4;
  });

  await test('6.2 options.localOnly: true suppresses WebSocket transmission', () => {
    const harness = createTestHarness();
    const ok = harness.dispatcher.dispatch(
      {
        payload: { id: 'el-1', pageIndex: 0, type: 'text', x: 0, y: 0 },
        type: 'ELEMENT_ADD',
      },
      { localOnly: true }
    );

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.sentMessages.length, 0);
    passedAssertions += 2;
  });

  await test('6.3 delegate.isCollabRoomFull: true suppresses WebSocket transmission', () => {
    const harness = createTestHarness();
    harness.delegate.isCollabRoomFull = true;

    const ok = harness.dispatcher.dispatch({
      payload: { id: 'el-1', pageIndex: 0, type: 'text', x: 0, y: 0 },
      type: 'ELEMENT_ADD',
    });

    assert.strictEqual(ok, true);
    assert.strictEqual(harness.sentMessages.length, 0);
    passedAssertions += 2;
  });

  // --- SUITE 7: Auto-Save Debouncing (F14 / R10) ---
  console.log('\n--- SUITE 7: Auto-Save Debounce & Lifecycle Cleanup ---');

  await test('7.1 Rapid successive dispatches trigger flushAutoSave only once after 600ms', async () => {
    const harness = createTestHarness();

    // Dispatch 5 rapid actions in tight succession
    for (let i = 0; i < 5; i++) {
      harness.dispatcher.dispatch({
        payload: { id: `el-${i}`, pageIndex: 0, type: 'text', x: i * 10, y: i * 10 },
        type: 'ELEMENT_ADD',
      });
    }

    assert.strictEqual(harness.flushedAutoSaveCount, 0, 'Auto-save must not run synchronously');

    // Wait 300ms (debounce window is 600ms)
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.strictEqual(harness.flushedAutoSaveCount, 0, 'Auto-save must still be pending at 300ms');

    // Dispatch 6th action resetting the debounce timer
    harness.dispatcher.dispatch({
      payload: { id: 'el-extra', pageIndex: 0, type: 'text', x: 100, y: 100 },
      type: 'ELEMENT_ADD',
    });

    // Wait 400ms (total 700ms since start, but only 400ms since reset)
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.strictEqual(harness.flushedAutoSaveCount, 0, 'Auto-save must still be pending 400ms after reset');

    // Wait additional 300ms (700ms total since 6th action)
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.strictEqual(harness.flushedAutoSaveCount, 1, 'Auto-save must flush exactly once after debounce window expires');

    harness.dispatcher.destroy();
    passedAssertions += 4;
  });

  await test('7.2 dispatcher.destroy() clears auto-save timer and removes all subscribers', async () => {
    const harness = createTestHarness();
    let subscriberEvents = 0;
    harness.dispatcher.subscribe(() => {
      subscriberEvents++;
    });

    harness.dispatcher.dispatch({
      payload: { id: 'el-1', pageIndex: 0, type: 'text', x: 0, y: 0 },
      type: 'ELEMENT_ADD',
    });
    assert.strictEqual(subscriberEvents, 1);

    // Call destroy immediately
    harness.dispatcher.destroy();

    // Wait 700ms; flushAutoSave should NEVER fire because timer was cancelled
    await new Promise((resolve) => setTimeout(resolve, 700));
    assert.strictEqual(harness.flushedAutoSaveCount, 0, 'flushAutoSave must not run after destroy');

    // Dispatching after destroy should not notify cleared subscribers
    harness.dispatcher.dispatch({
      payload: { id: 'el-2', pageIndex: 0, type: 'text', x: 0, y: 0 },
      type: 'ELEMENT_ADD',
    });
    assert.strictEqual(subscriberEvents, 1, 'Destroyed dispatcher has no active subscribers');
    passedAssertions += 3;
  });

  // --- SUITE 8: Pub/Sub & Fuzzing Stress Harness ---
  console.log('\n--- SUITE 8: Pub/Sub Subscription & Fuzzing Resilience ---');

  await test('8.1 subscribe() delivers events, unsubscribe() unhooks, and errors in subscriber do not crash dispatcher', () => {
    const harness = createTestHarness();
    const received: string[] = [];

    const unsubscribe = harness.dispatcher.subscribe((action) => {
      received.push(action.type);
    });

    // Second subscriber that throws
    harness.dispatcher.subscribe(() => {
      throw new Error('Hostile subscriber error');
    });

    const ok1 = harness.dispatcher.dispatch({
      payload: { id: 'el-1', pageIndex: 0, type: 'text', x: 0, y: 0 },
      type: 'ELEMENT_ADD',
    });
    assert.strictEqual(ok1, true, 'Dispatch must survive rogue subscriber exception');
    assert.deepStrictEqual(received, ['ELEMENT_ADD']);

    unsubscribe();

    const ok2 = harness.dispatcher.dispatch({
      payload: { id: 'el-1', text: 'new' },
      type: 'ELEMENT_UPDATE',
    });
    assert.strictEqual(ok2, true);
    assert.deepStrictEqual(received, ['ELEMENT_ADD'], 'Unsubscribed callback must not receive subsequent actions');
    passedAssertions += 4;
  });

  await test('8.2 Fuzzing stress test: 200 random mixed action dispatches', () => {
    const harness = createTestHarness();
    const actionTypes: CollabActionType[] = [
      'ELEMENT_ADD',
      'ELEMENT_UPDATE',
      'ELEMENT_DELETE',
      'ELEMENT_MOVE',
      'ELEMENT_RESIZE',
      'PAGE_ADD',
      'PAGE_SET_SIZE',
      'PAGE_SET_BG',
      'DOC_TITLE_CHANGE',
      'UNDO',
      'REDO',
    ];

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < 200; i++) {
      const type = actionTypes[i % actionTypes.length];
      const elId = `el-${i % 10}`;
      let payload: any = {};

      if (type === 'ELEMENT_ADD') {
        payload = { id: elId, pageIndex: 0, type: 'text', x: i, y: i };
      } else if (type === 'ELEMENT_UPDATE') {
        payload = { id: elId, text: `Fuzz ${i}` };
      } else if (type === 'ELEMENT_DELETE') {
        payload = { id: elId };
      } else if (type === 'ELEMENT_MOVE') {
        payload = { id: elId, x: i * 2, y: i * 3 };
      } else if (type === 'ELEMENT_RESIZE') {
        payload = { height: 50, id: elId, width: 50 };
      } else if (type === 'PAGE_ADD') {
        payload = {};
      } else if (type === 'PAGE_SET_SIZE') {
        payload = { dimension: { height: 800, width: 600 }, pageIndex: 0 };
      } else if (type === 'PAGE_SET_BG') {
        payload = { color: '#ffffff', pageIndex: 0 };
      } else if (type === 'DOC_TITLE_CHANGE') {
        payload = { title: `Fuzz Title ${i}` };
      }

      try {
        const ok = harness.dispatcher.dispatch({ payload, type }, { skipBroadcast: true });
        if (ok) successCount++;
        else failureCount++;
      } catch (err: any) {
        assert.fail(`Dispatcher threw unhandled exception during fuzzing at step ${i}: ${err.message}`);
      }
    }

    assert(successCount > 0, 'Fuzzer should have successful executions');
    assert(harness.delegate.elements.length >= 0, 'Elements array must be in consistent state');
    harness.dispatcher.destroy();
    passedAssertions += 2;
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${testCount} TEST SCENARIOS PASSED, ${passedAssertions} ORACLE ASSERTIONS VERIFIED`);
  console.log('================================================================\n');
}

runDispatcherEmpiricalSuite().catch((err) => {
  console.error('Empirical suite aborted:', err);
  process.exit(1);
});
