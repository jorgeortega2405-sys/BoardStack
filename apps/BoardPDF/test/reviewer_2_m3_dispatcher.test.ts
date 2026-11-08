import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { CollabActionDispatcher, CollabEditorDelegate } from '../client/views/collaborative-pdf/collab-action-dispatcher.service.js';
import { wsService } from '../client/services/websocket.service.js';

let passed = 0;
let failed = 0;

async function it(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${name}:`, err);
  }
}

function createMockDelegate(overrides: Partial<CollabEditorDelegate> = {}): {
  delegate: CollabEditorDelegate;
  broadcasts: any[];
  historyCount: number;
  modifiedCount: number;
  autoSaveCount: number;
  renderedPagesCount: number;
} {
  const broadcasts: any[] = [];
  let historyCount = 0;
  let modifiedCount = 0;
  let autoSaveCount = 0;
  let renderedPagesCount = 0;

  wsService.send = (msg: any) => {
    broadcasts.push(msg);
  };

  const delegate: CollabEditorDelegate = {
    alignElementToPage: () => true,
    canEdit: () => true,
    docDefaultPageSize: { width: 794, height: 1123 },
    docTitle: 'Test Document',
    elements: [],
    flushAutoSave: async () => { autoSaveCount++; },
    getPageDimensions: () => ({ width: 794, height: 1123 }),
    isCollabRoomFull: false,
    isLockedPage: () => false,
    moveElementLayer: () => true,
    pageBackgrounds: ['#ffffff'],
    pageCount: 1,
    pagePdfSources: [null],
    pageSizes: [{ width: 794, height: 1123 }],
    pageTitles: ['Page 1'],
    recordHistory: () => { historyCount++; },
    redo: () => {},
    renderPages: () => { renderedPagesCount++; },
    reorderElementLayer: () => true,
    selectElement: () => {},
    selectedElementId: null,
    setDocTitle: (t) => { delegate.docTitle = t; },
    setModified: (v) => { if (v) modifiedCount++; },
    undo: () => {},
    updateContextToolbar: () => {},
    updateTransformBoxPosition: () => {},
    ...overrides,
  };

  return {
    delegate,
    broadcasts,
    get historyCount() { return historyCount; },
    get modifiedCount() { return modifiedCount; },
    get autoSaveCount() { return autoSaveCount; },
    get renderedPagesCount() { return renderedPagesCount; }
  };
}

async function runTests() {
  console.log('=== Reviewer 2 Milestone 3: CollabActionDispatcher Empirical Test Suite ===\n');

  // --- SUITE 1: 25 Distinct Action Types ---
  console.log('--- Suite 1: 25 Distinct Action Types ---');

  await it('1. ELEMENT_ADD', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const el: any = { id: 'el_1', type: 'text', x: 10, y: 20, pageIndex: 0 };
    const ok = dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: el, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.elements.length, 1);
    assert.strictEqual(mock.broadcasts.length, 1);
    assert.strictEqual(mock.broadcasts[0].type, 'elementChange');
    assert.strictEqual(mock.broadcasts[0].action, 'add');
    assert.strictEqual(mock.historyCount, 1);
    assert.strictEqual(mock.modifiedCount, 1);
    dispatcher.destroy();
  });

  await it('2. ELEMENT_UPDATE', () => {
    const el: any = { id: 'el_1', type: 'text', x: 10, y: 20, pageIndex: 0 };
    const mock = createMockDelegate({ elements: [el] });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'ELEMENT_UPDATE', payload: { id: 'el_1', x: 50 }, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.elements[0].x, 50);
    assert.strictEqual(mock.broadcasts[0].type, 'elementChange');
    assert.strictEqual(mock.broadcasts[0].action, 'update');
    dispatcher.destroy();
  });

  await it('3. ELEMENT_DELETE', () => {
    const el: any = { id: 'el_1', type: 'text', x: 10, y: 20, pageIndex: 0 };
    const mock = createMockDelegate({ elements: [el], selectedElementId: 'el_1' });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'ELEMENT_DELETE', payload: { id: 'el_1' }, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.elements.length, 0);
    assert.strictEqual(mock.broadcasts[0].type, 'elementChange');
    assert.strictEqual(mock.broadcasts[0].action, 'delete');
    dispatcher.destroy();
  });

  await it('4. ELEMENT_DUPLICATE', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const el: any = { id: 'el_copy', type: 'text', x: 30, y: 40, pageIndex: 0 };
    const ok = dispatcher.dispatch({ type: 'ELEMENT_DUPLICATE', payload: el, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.elements.length, 1);
    assert.strictEqual(mock.broadcasts[0].action, 'add');
    dispatcher.destroy();
  });

  await it('5. ELEMENT_MOVE', () => {
    const el: any = { id: 'el_1', type: 'text', x: 10, y: 20, pageIndex: 0 };
    const mock = createMockDelegate({ elements: [el] });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'ELEMENT_MOVE', payload: { id: 'el_1', x: 99, y: 88 }, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.elements[0].x, 99);
    assert.strictEqual(mock.delegate.elements[0].y, 88);
    assert.strictEqual(mock.broadcasts[0].action, 'update');
    dispatcher.destroy();
  });

  await it('6. ELEMENT_RESIZE', () => {
    const el: any = { id: 'el_1', type: 'shape', width: 40, height: 40, pageIndex: 0 };
    const mock = createMockDelegate({ elements: [el] });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'ELEMENT_RESIZE', payload: { id: 'el_1', width: 120, height: 90 }, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual((mock.delegate.elements[0] as any).width, 120);
    assert.strictEqual((mock.delegate.elements[0] as any).height, 90);
    assert.strictEqual(mock.broadcasts[0].action, 'update');
    dispatcher.destroy();
  });

  await it('7. ELEMENT_ROTATE', () => {
    const el: any = { id: 'el_1', type: 'shape', rotation: 0, pageIndex: 0 };
    const mock = createMockDelegate({ elements: [el] });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'ELEMENT_ROTATE', payload: { id: 'el_1', rotation: 90 }, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual((mock.delegate.elements[0] as any).rotation, 90);
    assert.strictEqual(mock.broadcasts[0].action, 'update');
    dispatcher.destroy();
  });

  await it('8. ELEMENT_LAYER_MOVE', () => {
    let layerMoved = false;
    const mock = createMockDelegate({
      moveElementLayer: (id, dir) => {
        layerMoved = true;
        assert.strictEqual(id, 'el_1');
        assert.strictEqual(dir, 'front');
        return true;
      },
    });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'ELEMENT_LAYER_MOVE', payload: { elementId: 'el_1', direction: 'front' } });
    assert.strictEqual(ok, true);
    assert.strictEqual(layerMoved, true);
    assert.strictEqual(mock.broadcasts.length, 1);
    assert.strictEqual(mock.broadcasts[0].type, 'docSync');
    dispatcher.destroy();
  });

  await it('9. ELEMENT_LAYER_REORDER', () => {
    let reordered = false;
    const mock = createMockDelegate({
      reorderElementLayer: (dragged, target) => {
        reordered = true;
        assert.strictEqual(dragged, 'el_1');
        assert.strictEqual(target, 'el_2');
        return true;
      },
    });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'ELEMENT_LAYER_REORDER', payload: { draggedId: 'el_1', targetId: 'el_2' } });
    assert.strictEqual(ok, true);
    assert.strictEqual(reordered, true);
    assert.strictEqual(mock.broadcasts[0].type, 'docSync');
    dispatcher.destroy();
  });

  await it('10. ELEMENT_ALIGN', () => {
    let aligned = false;
    const el: any = { id: 'el_1', type: 'text', x: 0, y: 0, pageIndex: 0 };
    const mock = createMockDelegate({
      elements: [el],
      alignElementToPage: (id, align) => {
        aligned = true;
        assert.strictEqual(id, 'el_1');
        assert.strictEqual(align, 'center');
        return true;
      },
    });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'ELEMENT_ALIGN', payload: { elementId: 'el_1', alignment: 'center' } });
    assert.strictEqual(ok, true);
    assert.strictEqual(aligned, true);
    assert.strictEqual(mock.broadcasts[0].type, 'elementChange');
    assert.strictEqual(mock.broadcasts[0].action, 'update');
    assert.strictEqual(mock.broadcasts[0].element.id, 'el_1');
    dispatcher.destroy();
  });

  await it('11. ELEMENT_STYLE_UPDATE', () => {
    const el: any = { id: 'el_1', type: 'text', fontSize: 16, pageIndex: 0 };
    const mock = createMockDelegate({ elements: [el] });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'ELEMENT_STYLE_UPDATE', payload: { id: 'el_1', fontSize: 20 }, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual((mock.delegate.elements[0] as any).fontSize, 20);
    assert.strictEqual(mock.broadcasts[0].type, 'elementChange');
    assert.strictEqual(mock.broadcasts[0].action, 'update');
    dispatcher.destroy();
  });

  await it('12. DRAWING_ADD', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const draw: any = { id: 'draw_1', type: 'drawing', path: 'M 0 0 L 10 10', pageIndex: 0 };
    const ok = dispatcher.dispatch({ type: 'DRAWING_ADD', payload: draw, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.elements.length, 1);
    assert.strictEqual(mock.broadcasts[0].type, 'elementChange');
    assert.strictEqual(mock.broadcasts[0].action, 'add');
    dispatcher.destroy();
  });

  await it('13. DRAWING_ERASE', () => {
    const draw: any = { id: 'draw_1', type: 'drawing', pageIndex: 0 };
    const mock = createMockDelegate({ elements: [draw] });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'DRAWING_ERASE', payload: { id: 'draw_1' }, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.elements.length, 0);
    assert.strictEqual(mock.broadcasts[0].type, 'elementChange');
    assert.strictEqual(mock.broadcasts[0].action, 'delete');
    dispatcher.destroy();
  });

  await it('14. PAGE_ADD', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'PAGE_ADD', payload: { afterIndex: 0 } });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.pageCount, 2);
    assert.strictEqual(mock.delegate.pageSizes.length, 2);
    assert.strictEqual(mock.broadcasts[0].type, 'docSync');
    dispatcher.destroy();
  });

  await it('15. PAGE_DELETE', () => {
    const mock = createMockDelegate({
      pageCount: 2,
      pageSizes: [{ width: 794, height: 1123 }, { width: 794, height: 1123 }],
      pageTitles: ['Page 1', 'Page 2'],
      pageBackgrounds: ['#ffffff', '#ffffff'],
      pagePdfSources: [null, null],
    });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'PAGE_DELETE', payload: { pageIndex: 1 } });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.pageCount, 1);
    assert.strictEqual(mock.broadcasts[0].type, 'docSync');
    dispatcher.destroy();
  });

  await it('16. PAGE_DUPLICATE', () => {
    const el: any = { id: 'text_src', type: 'text', pageIndex: 0 };
    const mock = createMockDelegate({
      elements: [el],
      pageTitles: ['Original Page'],
    });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'PAGE_DUPLICATE', payload: { pageIndex: 0 } });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.pageCount, 2);
    assert.strictEqual(mock.delegate.elements.length, 2);
    assert.strictEqual(mock.delegate.elements[1].pageIndex, 1);
    assert.strictEqual(mock.delegate.pageTitles[1], 'Original Page (Copia)');
    assert.strictEqual(mock.broadcasts[0].type, 'docSync');
    dispatcher.destroy();
  });

  await it('17. PAGE_MOVE', () => {
    const el0: any = { id: 'el0', pageIndex: 0 };
    const el1: any = { id: 'el1', pageIndex: 1 };
    const mock = createMockDelegate({
      elements: [el0, el1],
      pageCount: 2,
      pageSizes: [{ width: 100, height: 100 }, { width: 200, height: 200 }],
      pageTitles: ['Title 0', 'Title 1'],
      pageBackgrounds: ['#111111', '#222222'],
      pagePdfSources: [null, null],
    });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'PAGE_MOVE', payload: { fromIndex: 0, toIndex: 1 } });
    assert.strictEqual(ok, true);
    assert.strictEqual(el0.pageIndex, 1);
    assert.strictEqual(el1.pageIndex, 0);
    assert.strictEqual(mock.delegate.pageTitles[0], 'Title 1');
    assert.strictEqual(mock.delegate.pageTitles[1], 'Title 0');
    assert.strictEqual(mock.broadcasts[0].type, 'docSync');
    dispatcher.destroy();
  });

  await it('18. PAGE_SET_SIZE', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'PAGE_SET_SIZE', payload: { pageIndex: 0, dimension: { width: 500, height: 600 } } });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.pageSizes[0].width, 500);
    assert.strictEqual(mock.broadcasts[0].type, 'docSync');
    dispatcher.destroy();
  });

  await it('19. PAGE_SET_BG', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'PAGE_SET_BG', payload: { color: '#abcdef', pageIndex: 0 } });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.pageBackgrounds[0], '#abcdef');
    assert.strictEqual(mock.broadcasts[0].type, 'docSync');
    dispatcher.destroy();
  });

  await it('20. PAGE_SET_TITLE', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'PAGE_SET_TITLE', payload: { pageIndex: 0, title: 'Cover Page' } });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.pageTitles[0], 'Cover Page');
    assert.strictEqual(mock.broadcasts[0].type, 'docSync');
    dispatcher.destroy();
  });

  await it('21. PAGE_TOGGLE_LOCK', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'PAGE_TOGGLE_LOCK', payload: { pageIndex: 0 } });
    assert.strictEqual(ok, true);
    dispatcher.destroy();
  });

  await it('22. DOC_TITLE_CHANGE', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'DOC_TITLE_CHANGE', payload: { title: 'Q4 Financial Report' } });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.docTitle, 'Q4 Financial Report');
    assert.strictEqual(mock.broadcasts[0].type, 'titleChange');
    assert.strictEqual(mock.broadcasts[0].title, 'Q4 Financial Report');
    dispatcher.destroy();
  });

  await it('23. DOC_SYNC_FULL', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({
      type: 'DOC_SYNC_FULL',
      payload: {
        elements: [{ id: 'synced_el', type: 'text', pageIndex: 0 }],
        pageBackgrounds: ['#000000', '#ffffff'],
        pageCount: 2,
        pageSizes: [{ width: 500, height: 700 }, { width: 500, height: 700 }],
        title: 'Full Synced Document',
      },
    });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.delegate.elements.length, 1);
    assert.strictEqual(mock.delegate.pageCount, 2);
    assert.strictEqual(mock.delegate.docTitle, 'Full Synced Document');
    assert.strictEqual(mock.broadcasts[0].type, 'docSync');
    dispatcher.destroy();
  });

  await it('24. UNDO', () => {
    let undoCalled = false;
    const mock = createMockDelegate({ undo: () => { undoCalled = true; } });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'UNDO', payload: {} });
    assert.strictEqual(ok, true);
    assert.strictEqual(undoCalled, true);
    assert.strictEqual(mock.broadcasts.length, 0);
    assert.strictEqual(mock.historyCount, 0);
    dispatcher.destroy();
  });

  await it('25. REDO', () => {
    let redoCalled = false;
    const mock = createMockDelegate({ redo: () => { redoCalled = true; } });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'REDO', payload: {} });
    assert.strictEqual(ok, true);
    assert.strictEqual(redoCalled, true);
    assert.strictEqual(mock.broadcasts.length, 0);
    assert.strictEqual(mock.historyCount, 0);
    dispatcher.destroy();
  });

  // --- SUITE 2: Security & Permission Guards ---
  console.log('\n--- Suite 2: Security & Permission Guards ---');

  await it('Permission: canEdit = false blocks mutations', () => {
    const mock = createMockDelegate({ canEdit: () => false });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const el: any = { id: 'el_blocked', type: 'text', pageIndex: 0 };
    const ok = dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: el, pageIndex: 0 });
    assert.strictEqual(ok, false);
    assert.strictEqual(mock.delegate.elements.length, 0);
    assert.strictEqual(mock.broadcasts.length, 0);
    assert.strictEqual(mock.historyCount, 0);
    dispatcher.destroy();
  });

  await it('Permission: canEdit = false allows PAGE_TOGGLE_LOCK and UNDO/REDO', () => {
    let undoCalled = false;
    const mock = createMockDelegate({
      canEdit: () => false,
      undo: () => { undoCalled = true; },
    });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const lockOk = dispatcher.dispatch({ type: 'PAGE_TOGGLE_LOCK', payload: { pageIndex: 0 } });
    assert.strictEqual(lockOk, true);
    const undoOk = dispatcher.dispatch({ type: 'UNDO', payload: {} });
    assert.strictEqual(undoOk, true);
    assert.strictEqual(undoCalled, true);
    dispatcher.destroy();
  });

  await it('Permission: locked page blocks mutations for that pageIndex', () => {
    const mock = createMockDelegate({
      isLockedPage: (idx) => idx === 1,
    });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const el: any = { id: 'el_locked', type: 'text', pageIndex: 1 };
    const ok = dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: el, pageIndex: 1 });
    assert.strictEqual(ok, false);
    assert.strictEqual(mock.delegate.elements.length, 0);
    assert.strictEqual(mock.broadcasts.length, 0);
    assert.strictEqual(mock.historyCount, 0);

    // Page 0 is not locked, should succeed
    const el0: any = { id: 'el_unlocked', type: 'text', pageIndex: 0 };
    const ok0 = dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: el0, pageIndex: 0 });
    assert.strictEqual(ok0, true);
    assert.strictEqual(mock.delegate.elements.length, 1);
    dispatcher.destroy();
  });

  // --- SUITE 3: Options Flags (skipBroadcast, localOnly, skipHistory) ---
  console.log('\n--- Suite 3: Options Flags ---');

  await it('Options: skipBroadcast suppresses wsService.send', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const el: any = { id: 'el_1', type: 'text', pageIndex: 0 };
    const ok = dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: el, pageIndex: 0 }, { skipBroadcast: true });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.broadcasts.length, 0);
    assert.strictEqual(mock.historyCount, 1);
    dispatcher.destroy();
  });

  await it('Options: localOnly suppresses wsService.send', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const el: any = { id: 'el_1', type: 'text', pageIndex: 0 };
    const ok = dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: el, pageIndex: 0 }, { localOnly: true });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.broadcasts.length, 0);
    dispatcher.destroy();
  });

  await it('Options: skipHistory suppresses recordHistory & setModified', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const el: any = { id: 'el_1', type: 'text', pageIndex: 0 };
    const ok = dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: el, pageIndex: 0 }, { skipHistory: true });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.historyCount, 0);
    assert.strictEqual(mock.modifiedCount, 0);
    assert.strictEqual(mock.broadcasts.length, 1);
    dispatcher.destroy();
  });

  await it('Room Full: isCollabRoomFull = true suppresses broadcast', () => {
    const mock = createMockDelegate({ isCollabRoomFull: true });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const el: any = { id: 'el_1', type: 'text', pageIndex: 0 };
    const ok = dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: el, pageIndex: 0 });
    assert.strictEqual(ok, true);
    assert.strictEqual(mock.broadcasts.length, 0);
    dispatcher.destroy();
  });

  // --- SUITE 4: Subscribers & Auto-Save Debounce ---
  console.log('\n--- Suite 4: Subscribers & Auto-Save Debounce ---');

  await it('Subscribers receive dispatched actions and unsubscribe cleanly', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const received: any[] = [];
    const unsub = dispatcher.subscribe((act) => {
      received.push(act);
    });

    dispatcher.dispatch({ type: 'PAGE_SET_TITLE', payload: { pageIndex: 0, title: 'T1' } });
    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].type, 'PAGE_SET_TITLE');

    unsub();
    dispatcher.dispatch({ type: 'PAGE_SET_TITLE', payload: { pageIndex: 0, title: 'T2' } });
    assert.strictEqual(received.length, 1); // Not called after unsubscribe
    dispatcher.destroy();
  });

  await it('Throwing subscriber does not interrupt dispatch chain', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    let secondCalled = false;
    dispatcher.subscribe(() => {
      throw new Error('Subscriber intentional error');
    });
    dispatcher.subscribe(() => {
      secondCalled = true;
    });

    const ok = dispatcher.dispatch({ type: 'PAGE_SET_TITLE', payload: { pageIndex: 0, title: 'T1' } });
    assert.strictEqual(ok, true);
    assert.strictEqual(secondCalled, true);
    dispatcher.destroy();
  });

  await it('Auto-save debounces 600ms and flushes once', async () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: { id: 'e1', type: 'text', pageIndex: 0 } });
    dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: { id: 'e2', type: 'text', pageIndex: 0 } });
    dispatcher.dispatch({ type: 'ELEMENT_ADD', payload: { id: 'e3', type: 'text', pageIndex: 0 } });

    assert.strictEqual(mock.autoSaveCount, 0);
    await new Promise((r) => setTimeout(r, 700));
    assert.strictEqual(mock.autoSaveCount, 1);
    dispatcher.destroy();
  });

  // --- SUITE 5: Boundary & Error Conditions ---
  console.log('\n--- Suite 5: Boundary & Error Conditions ---');

  await it('Boundary: PAGE_DELETE with pageCount <= 1 returns false', () => {
    const mock = createMockDelegate({ pageCount: 1 });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'PAGE_DELETE', payload: { pageIndex: 0 } });
    assert.strictEqual(ok, false);
    assert.strictEqual(mock.delegate.pageCount, 1);
    dispatcher.destroy();
  });

  await it('Boundary: PAGE_MOVE with invalid indices returns false', () => {
    const mock = createMockDelegate({ pageCount: 2 });
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok1 = dispatcher.dispatch({ type: 'PAGE_MOVE', payload: { fromIndex: -1, toIndex: 1 } });
    assert.strictEqual(ok1, false);
    const ok2 = dispatcher.dispatch({ type: 'PAGE_MOVE', payload: { fromIndex: 0, toIndex: 5 } });
    assert.strictEqual(ok2, false);
    dispatcher.destroy();
  });

  await it('Boundary: Unknown action returns false', () => {
    const mock = createMockDelegate();
    const dispatcher = new CollabActionDispatcher(mock.delegate);
    const ok = dispatcher.dispatch({ type: 'UNKNOWN_ACTION' as any, payload: {} });
    assert.strictEqual(ok, false);
    dispatcher.destroy();
  });

  // --- SUITE 6: Static Wiring Checks in collaborative-pdf-editor.view.ts ---
  console.log('\n--- Suite 6: Static Wiring Checks in Editor View ---');

  const editorPath = fs.existsSync(path.resolve('apps/BoardPDF/client/views/collaborative-pdf/collaborative-pdf-editor.view.ts'))
    ? path.resolve('apps/BoardPDF/client/views/collaborative-pdf/collaborative-pdf-editor.view.ts')
    : path.resolve('client/views/collaborative-pdf/collaborative-pdf-editor.view.ts');
  const editorSrc = fs.readFileSync(editorPath, 'utf8');

  await it('Wiring: moveElementLayer dispatches ELEMENT_LAYER_MOVE', () => {
    assert(editorSrc.includes("type: 'ELEMENT_LAYER_MOVE'"), 'Must contain ELEMENT_LAYER_MOVE action dispatch');
  });

  await it('Wiring: reorderElementLayer dispatches ELEMENT_LAYER_REORDER', () => {
    assert(editorSrc.includes("type: 'ELEMENT_LAYER_REORDER'"), 'Must contain ELEMENT_LAYER_REORDER action dispatch');
  });

  await it('Wiring: alignElementToPage dispatches ELEMENT_ALIGN', () => {
    assert(editorSrc.includes("type: 'ELEMENT_ALIGN'"), 'Must contain ELEMENT_ALIGN action dispatch');
  });

  await it('Wiring: typography buttons dispatch ELEMENT_STYLE_UPDATE', () => {
    assert(editorSrc.includes("type: 'ELEMENT_STYLE_UPDATE'"), 'Must contain ELEMENT_STYLE_UPDATE action dispatch');
  });

  await it('Wiring: page actions dispatch PAGE_ADD, PAGE_DELETE, PAGE_DUPLICATE, PAGE_MOVE', () => {
    assert(editorSrc.includes("type: 'PAGE_ADD'"), 'Must contain PAGE_ADD');
    assert(editorSrc.includes("type: 'PAGE_DELETE'"), 'Must contain PAGE_DELETE');
    assert(editorSrc.includes("type: 'PAGE_DUPLICATE'"), 'Must contain PAGE_DUPLICATE');
    assert(editorSrc.includes("type: 'PAGE_MOVE'"), 'Must contain PAGE_MOVE');
  });

  await it('Wiring: element lifecycle pushElement, broadcastElementUpdate, broadcastElementDelete dispatch actions', () => {
    assert(editorSrc.includes("type: 'ELEMENT_ADD'"), 'Must contain ELEMENT_ADD in pushElement');
    assert(editorSrc.includes("type: 'ELEMENT_UPDATE'"), 'Must contain ELEMENT_UPDATE in broadcastElementUpdate');
    assert(editorSrc.includes("type: 'ELEMENT_DELETE'"), 'Must contain ELEMENT_DELETE in broadcastElementDelete');
  });

  await it('Compliance: Zero console.* in collab-action-dispatcher.service.ts and editor view', () => {
    const servicePath = fs.existsSync(path.resolve('apps/BoardPDF/client/views/collaborative-pdf/collab-action-dispatcher.service.ts'))
      ? path.resolve('apps/BoardPDF/client/views/collaborative-pdf/collab-action-dispatcher.service.ts')
      : path.resolve('client/views/collaborative-pdf/collab-action-dispatcher.service.ts');
    const serviceSrc = fs.readFileSync(servicePath, 'utf8');
    assert.strictEqual(serviceSrc.match(/console\.[a-z]+/g), null);
    assert.strictEqual(editorSrc.match(/console\.[a-z]+/g), null);
  });

  console.log(`\n==============================================`);
  console.log(`Total tests run: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`==============================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
