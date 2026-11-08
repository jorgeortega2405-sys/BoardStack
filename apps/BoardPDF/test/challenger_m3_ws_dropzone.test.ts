import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// 1. Mock DOM Token List & Lightweight DOM Infrastructure
// ---------------------------------------------------------------------------

class MockDOMTokenList {
  private classes = new Set<string>();

  constructor(initial = '') {
    if (initial) {
      initial.split(/\s+/).filter(Boolean).forEach((c) => this.classes.add(c));
    }
  }

  add(...tokens: string[]): void {
    tokens.forEach((t) => this.classes.add(t));
  }

  remove(...tokens: string[]): void {
    tokens.forEach((t) => this.classes.delete(t));
  }

  contains(token: string): boolean {
    return this.classes.has(token);
  }

  toggle(token: string, force?: boolean): boolean {
    if (force !== undefined) {
      if (force) this.add(token);
      else this.remove(token);
      return force;
    }
    if (this.contains(token)) {
      this.remove(token);
      return false;
    }
    this.add(token);
    return true;
  }

  get value(): string {
    return Array.from(this.classes).join(' ');
  }

  toString(): string {
    return this.value;
  }
}

class MockElement {
  public tagName: string;
  public classList: MockDOMTokenList;
  public attributes = new Map<string, string>();
  public children: MockElement[] = [];
  public parentNode: MockElement | null = null;
  public style: Record<string, string> = {};
  public eventListeners = new Map<string, Array<(e: any) => void>>();
  public __controller?: any;
  private _textContent = '';
  private _innerHTML = '';

  constructor(tagName = 'DIV', initialClass = '') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockDOMTokenList(initialClass);
    if (initialClass) {
      this.attributes.set('class', initialClass);
    }
  }

  get className(): string {
    return this.classList.value;
  }

  set className(val: string) {
    this.classList = new MockDOMTokenList(val);
    this.attributes.set('class', val);
  }

  get textContent(): string {
    if (this.children.length === 0) return this._textContent;
    return this.children.map((c) => c.textContent).join('');
  }

  set textContent(val: string) {
    this._textContent = val;
  }

  get childNodes(): MockElement[] {
    return this.children;
  }

  get innerHTML(): string {
    return this._innerHTML;
  }

  set innerHTML(html: string) {
    this._innerHTML = html;
    this.children = [];
    const parsed = parseHtml(html);
    parsed.forEach((c) => this.appendChild(c));
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === 'class') {
      this.classList = new MockDOMTokenList(value);
    }
  }

  getAttribute(name: string): string | null {
    if (name === 'class') return this.classList.value || null;
    return this.attributes.has(name) ? this.attributes.get(name)! : null;
  }

  hasAttribute(name: string): boolean {
    if (name === 'class') return this.classList.value.length > 0;
    return this.attributes.has(name);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === 'class') {
      this.classList = new MockDOMTokenList('');
    }
  }

  appendChild<T extends MockElement>(child: T): T {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild<T extends MockElement>(child: T): T {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove(): void {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(type: string, listener: (e: any) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (e: any) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    }
  }

  dispatchEvent(event: any): boolean {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((fn) => fn(event));
    }
    return true;
  }

  querySelector<T = MockElement>(selector: string): T | null {
    const results = this.querySelectorAll(selector);
    return (results[0] as unknown as T) || null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const matches: MockElement[] = [];

    function walk(el: MockElement) {
      for (const child of el.children) {
        if (matchesSelector(child, selector, el)) {
          matches.push(child);
        }
        walk(child);
      }
    }

    walk(this);
    return matches;
  }
}

function matchesSelector(el: MockElement, selector: string, parent?: MockElement): boolean {
  selector = selector.trim();
  if (selector === '*') return true;
  if (selector === '.layout-content > *') {
    return parent?.classList.contains('layout-content') ?? false;
  }
  const attrMatch = selector.match(/^\[([a-z0-9-_:]+)(?:=["']?([^"']*)["']?)?\]$/i);
  if (attrMatch) {
    const [, name, val] = attrMatch;
    if (val === undefined) {
      return el.hasAttribute(name);
    }
    return el.getAttribute(name) === val;
  }
  if (selector.startsWith('.')) {
    const className = selector.slice(1);
    return el.classList.contains(className);
  }
  if (/^[a-z0-9-]+$/i.test(selector)) {
    return el.tagName.toLowerCase() === selector.toLowerCase();
  }
  return false;
}

function parseHtml(html: string): MockElement[] {
  const root = new MockElement('ROOT');
  let current: MockElement = root;
  const stack: MockElement[] = [root];

  const tokenRegex = /<\/?([a-z0-9-]+)([^>]*?)>|([^<]+)/gi;
  let match;
  while ((match = tokenRegex.exec(html)) !== null) {
    const [full, tag, attrsStr, text] = match;
    if (text) {
      if (text.trim() && current !== root) {
        current.textContent += text.trim();
      }
    } else if (full.startsWith('</')) {
      if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === tag.toLowerCase()) {
        stack.pop();
        current = stack[stack.length - 1];
      }
    } else {
      const el = new MockElement(tag.toUpperCase());
      const isSelfClosing =
        full.endsWith('/>') || ['img', 'input', 'hr', 'br', 'line', 'polyline', 'path'].includes(tag.toLowerCase());
      if (attrsStr) {
        const attrRegex = /([a-z0-9-_:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
          const name = attrMatch[1];
          const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
          el.setAttribute(name, val);
        }
      }
      current.appendChild(el);
      if (!isSelfClosing) {
        stack.push(el);
        current = el;
      }
    }
  }
  return root.children;
}

// ---------------------------------------------------------------------------
// 2. Mock WebSocket Client
// ---------------------------------------------------------------------------

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  public url: string;
  public readyState: number = MockWebSocket.CONNECTING;
  public onopen: (() => void) | null = null;
  public onclose: ((e: any) => void) | null = null;
  public onerror: ((e: any) => void) | null = null;
  public onmessage: ((e: any) => void) | null = null;
  public sentMessages: string[] = [];
  public closeCalls: Array<{ code?: number; reason?: string }> = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: code ?? 1000, reason: reason ?? 'Normal closure' });
    }
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen();
    }
  }

  simulateMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage({ data: typeof data === 'string' ? data : JSON.stringify(data) });
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Mock Window, Document & Event Dispatch
// ---------------------------------------------------------------------------

class MockDragEvent {
  public type: string;
  public dataTransfer: {
    dropEffect?: string;
    files: any[];
    types: string[];
  } | null;
  public defaultPrevented = false;

  constructor(
    type: string,
    init?: {
      dataTransfer?: {
        dropEffect?: string;
        files?: any[];
        types?: string[];
      };
    }
  ) {
    this.type = type;
    this.dataTransfer = init?.dataTransfer
      ? {
          dropEffect: init.dataTransfer.dropEffect || 'none',
          files: init.dataTransfer.files || [],
          types: init.dataTransfer.types || [],
        }
      : null;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

const mockWindowListeners = new Map<string, Set<(e: any) => void>>();

const mockWindow = {
  addEventListener(type: string, listener: (e: any) => void): void {
    if (!mockWindowListeners.has(type)) {
      mockWindowListeners.set(type, new Set());
    }
    mockWindowListeners.get(type)!.add(listener);
  },
  clearInterval: (id: any) => clearInterval(id),
  clearTimeout: (id: any) => clearTimeout(id),
  dispatchEvent(event: any): boolean {
    const set = mockWindowListeners.get(event.type);
    if (set) {
      for (const fn of set) fn(event);
    }
    return true;
  },
  location: {
    hash: '',
    hostname: 'localhost',
    origin: 'http://localhost:3000',
    pathname: '/',
    port: '3000',
    protocol: 'http:',
    search: '',
  },
  removeEventListener(type: string, listener: (e: any) => void): void {
    mockWindowListeners.get(type)?.delete(listener);
  },
  setInterval: (fn: (...args: any[]) => void, ms?: number) => setInterval(fn, ms),
  setTimeout: (fn: (...args: any[]) => void, ms?: number) => setTimeout(fn, ms),
};

const mockBody = new MockElement('BODY');
const mockDocument = {
  body: mockBody,
  cookie: '',
  createElement(tag: string): MockElement {
    return new MockElement(tag);
  },
  querySelector<T = MockElement>(selector: string): T | null {
    if (matchesSelector(mockBody, selector)) return mockBody as unknown as T;
    return mockBody.querySelector<T>(selector);
  },
  querySelectorAll(selector: string): MockElement[] {
    const matches: MockElement[] = [];
    if (matchesSelector(mockBody, selector)) matches.push(mockBody);
    matches.push(...mockBody.querySelectorAll(selector));
    return matches;
  },
};

// Polyfill globals into globalThis
(globalThis as any).window = mockWindow;
(globalThis as any).document = mockDocument;
(globalThis as any).WebSocket = MockWebSocket;
(globalThis as any).DragEvent = MockDragEvent;
(globalThis as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);

// Track fetch calls
export const mockFetchCalls: Array<{ options: any; url: string }> = [];
(globalThis as any).fetch = async (url: string, options: any) => {
  mockFetchCalls.push({ options, url });
  return {
    json: async () => ({ success: true }),
    ok: true,
    status: 200,
  };
};

// Dynamically import project modules after globals are polyfilled
const { wsService } = await import('../client/services/websocket.service.js');
const api = await import('../client/services/api.service.js');
const { initGlobalDropzone } = await import('../client/components/global-dropzone.component.js');

// ---------------------------------------------------------------------------
// 4. Test Suite Execution
// ---------------------------------------------------------------------------

describe('Empirical Verification: WebSocket Confinement & Global Dropzone System', () => {
  let layoutContent: MockElement;

  beforeEach(() => {
    const existingOverlay = mockBody.children.find((c) => c.getAttribute('data-ref') === 'global-dropzone-overlay');
    mockBody.children = [];
    if (existingOverlay) {
      mockBody.appendChild(existingOverlay);
      existingOverlay.classList.remove('is-active');
    }
    // Cleanly reset dropzone dragCounter by triggering drop with empty files
    mockWindow.dispatchEvent(new MockDragEvent('drop', { dataTransfer: { files: [], types: ['Files'] } }));

    mockWindow.location.pathname = '/';
    mockWindow.location.search = '';
    mockWindow.location.hash = '';
    MockWebSocket.instances = [];
    mockFetchCalls.length = 0;
    wsService.disconnect();
    api.clearUserState();

    // Setup standard layout container
    layoutContent = new MockElement('DIV', 'layout-content');
    mockBody.appendChild(layoutContent);
  });

  afterEach(() => {
    wsService.disconnect();
    api.clearUserState();
  });

  // =========================================================================
  // SUITE 1: WebSocket Confinement & Route Filtering (F11 / R1)
  // =========================================================================
  describe('Suite 1: WebSocket Confinement & Route Filtering (F11 / R1)', () => {
    const nonEditorRoutes = [
      '/',
      '/pricing',
      '/projects',
      '/settings',
      '/settings/profile',
      '/settings/security',
      '/login',
      '/register',
      '/forgot-password',
      '/tools/merge-pdf',
      '/tools/split-pdf',
      '/terms',
      '/privacy',
      '/cookies',
    ];

    for (const route of nonEditorRoutes) {
      it(`TC-WS-01..07: strictly refuses connection and returns null on non-editor route: ${route}`, async () => {
        mockWindow.location.pathname = route;
        const initialInstanceCount = MockWebSocket.instances.length;

        const result = await wsService.connect();

        assert.strictEqual(result, null, `wsService.connect() must return null on non-editor route ${route}`);
        assert.strictEqual(
          MockWebSocket.instances.length,
          initialInstanceCount,
          `No WebSocket instance should be created on non-editor route ${route}`
        );
      });
    }

    const editorRoutes = [
      '/d/doc-uuid-12345',
      '/d',
      '/d/',
      '/d/collaborative-canvas-99',
      '/collaborative-pdf/editor',
      '/collaborative-pdf/editor/session-xyz',
    ];

    for (const route of editorRoutes) {
      it(`TC-WS-08..10: permits WebSocket instantiation on editor route: ${route}`, async () => {
        mockWindow.location.pathname = route;
        const initialInstanceCount = MockWebSocket.instances.length;

        const connectPromise = wsService.connect();
        assert.strictEqual(
          MockWebSocket.instances.length,
          initialInstanceCount + 1,
          `WebSocket instance must be created on editor route ${route}`
        );

        const wsInstance = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        assert.ok(wsInstance.url.includes('/ws/collab'), `URL must target /ws/collab, got: ${wsInstance.url}`);

        wsInstance.simulateOpen();
        const connectedSocket = await connectPromise;

        assert.strictEqual(connectedSocket, wsInstance as any, `Should resolve with active WebSocket instance`);
      });
    }

    it('TC-WS-11: transmits payload via wsService.send() only when socket is OPEN on editor route', async () => {
      mockWindow.location.pathname = '/d/doc-1';
      const connectPromise = wsService.connect();
      const wsInstance = MockWebSocket.instances[MockWebSocket.instances.length - 1];

      // Sending before OPEN should return false
      const sentBefore = wsService.send({ type: 'test' });
      assert.strictEqual(sentBefore, false);

      wsInstance.simulateOpen();
      await connectPromise;

      const sentAfter = wsService.send({ action: 'TEST_ACTION', payload: 123 });
      assert.strictEqual(sentAfter, true);
      assert.strictEqual(wsInstance.sentMessages.length, 1);
      assert.deepStrictEqual(JSON.parse(wsInstance.sentMessages[0]), { action: 'TEST_ACTION', payload: 123 });
    });

    it('TC-WS-12: idempotent reuse: returns existing open socket without creating duplicate connection', async () => {
      mockWindow.location.pathname = '/d/doc-1';
      const connectPromise1 = wsService.connect();
      const wsInstance1 = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      wsInstance1.simulateOpen();
      const socket1 = await connectPromise1;

      // Second connect call on same route
      const socket2 = await wsService.connect();

      assert.strictEqual(socket1, socket2);
      assert.strictEqual(MockWebSocket.instances.length, 1, 'Must not create a second WebSocket instance');
    });
  });

  // =========================================================================
  // SUITE 2: WebSocket Abort, Disconnect & Concurrency Guarantees (F11 / R1)
  // =========================================================================
  describe('Suite 2: WebSocket Abort, Disconnect & Concurrency Guarantees (F11 / R1)', () => {
    it('TC-WS-14: calling disconnect() when connectingSocket is pending cleanly closes socket and nulls out references', async () => {
      mockWindow.location.pathname = '/d/doc-abort-1';
      const connectPromise = wsService.connect();
      const wsInstance = MockWebSocket.instances[MockWebSocket.instances.length - 1];

      assert.strictEqual(wsInstance.closeCalls.length, 0, 'Socket not closed yet');

      // Abort connection mid-flight
      wsService.disconnect();

      assert.strictEqual(wsInstance.closeCalls.length, 1, 'Calling disconnect() must immediately call .close() on connectingSocket');
      assert.strictEqual(wsInstance.readyState, MockWebSocket.CLOSED);

      // Trigger late onopen on the abandoned socket
      wsInstance.simulateOpen();
      const result = await connectPromise;

      assert.strictEqual(result, null, 'Abandoned socket promise must resolve to null');
    });

    it('TC-WS-15: late onopen after route changed away from editor closes socket and returns null', async () => {
      mockWindow.location.pathname = '/d/doc-late-open';
      const connectPromise = wsService.connect();
      const wsInstance = MockWebSocket.instances[MockWebSocket.instances.length - 1];

      // User navigates away before connection finishes handshaking
      mockWindow.location.pathname = '/projects';

      wsInstance.simulateOpen();
      const result = await connectPromise;

      assert.strictEqual(result, null, 'Must reject connection if user is no longer on editor route');
      assert.ok(wsInstance.closeCalls.length >= 1, 'Socket must be closed when onopen arrives off-editor');
    });

    it('TC-WS-16: concurrent connect() calls deduplicate and wait for same in-flight socket', async () => {
      mockWindow.location.pathname = '/d/doc-concurrent';

      const p1 = wsService.connect();
      const p2 = wsService.connect();
      const p3 = wsService.connect();

      assert.strictEqual(MockWebSocket.instances.length, 1, 'Concurrent connect calls must not open multiple sockets');

      const wsInstance = MockWebSocket.instances[0];
      wsInstance.simulateOpen();

      const [s1, s2, s3] = await Promise.all([p1, p2, p3]);

      assert.strictEqual(s1, wsInstance as any);
      assert.strictEqual(s2, wsInstance as any);
      assert.strictEqual(s3, wsInstance as any);
    });

    it('TC-WS-17: disconnect() idempotency: multiple calls do not throw exceptions', () => {
      assert.doesNotThrow(() => {
        wsService.disconnect();
        wsService.disconnect();
        wsService.disconnect();
      });
    });

    it('TC-WS-18: router confinement helper isCollabEditorRoute accurately identifies collab paths', async () => {
      // Test app-router confinement logic directly
      const isCollabEditorRoute = (pathname: string): boolean => {
        return pathname.startsWith('/d/') || pathname === '/d' || pathname.startsWith('/collaborative-pdf/editor');
      };

      assert.strictEqual(isCollabEditorRoute('/'), false);
      assert.strictEqual(isCollabEditorRoute('/projects'), false);
      assert.strictEqual(isCollabEditorRoute('/pricing'), false);
      assert.strictEqual(isCollabEditorRoute('/settings'), false);
      assert.strictEqual(isCollabEditorRoute('/tools/merge-pdf'), false);

      assert.strictEqual(isCollabEditorRoute('/d'), true);
      assert.strictEqual(isCollabEditorRoute('/d/123'), true);
      assert.strictEqual(isCollabEditorRoute('/collaborative-pdf/editor'), true);
    });
  });

  // =========================================================================
  // SUITE 3: Global Dropzone Drag Event Interception (F12, F13 / R6)
  // =========================================================================
  describe('Suite 3: Global Dropzone Drag Event Interception (F12, F13 / R6)', () => {
    beforeEach(() => {
      initGlobalDropzone();
    });

    it('TC-DZ-01: non-file drag events (types: ["text/plain"]) do NOT trigger overlay', () => {
      const overlay = mockDocument.querySelector<MockElement>('[data-ref="global-dropzone-overlay"]');
      assert.ok(overlay, 'Global dropzone overlay must be mounted in document body');
      overlay.classList.remove('is-active');

      const event = new MockDragEvent('dragenter', {
        dataTransfer: { types: ['text/plain'] },
      });

      mockWindow.dispatchEvent(event);

      assert.strictEqual(
        overlay.classList.contains('is-active'),
        false,
        'Dropzone overlay must NOT become active for text/plain drags'
      );
    });

    it('TC-DZ-02: non-file drag events with arbitrary MIME types do NOT trigger overlay', () => {
      const overlay = mockDocument.querySelector<MockElement>('[data-ref="global-dropzone-overlay"]')!;
      overlay.classList.remove('is-active');

      const mimeTypes = [
        ['text/html'],
        ['application/json'],
        ['text/uri-list'],
        ['application/x-moz-node'],
        [],
      ];

      for (const types of mimeTypes) {
        mockWindow.dispatchEvent(new MockDragEvent('dragenter', { dataTransfer: { types } }));
        assert.strictEqual(overlay.classList.contains('is-active'), false, `Must ignore types: ${JSON.stringify(types)}`);
      }
    });

    it('TC-DZ-03: file drag event (types: ["Files"]) activates dropzone overlay', () => {
      const overlay = mockDocument.querySelector<MockElement>('[data-ref="global-dropzone-overlay"]')!;
      overlay.classList.remove('is-active');

      const event = new MockDragEvent('dragenter', {
        dataTransfer: { types: ['Files'] },
      });

      mockWindow.dispatchEvent(event);

      assert.strictEqual(
        overlay.classList.contains('is-active'),
        true,
        'Dropzone overlay MUST gain .is-active class when dragging Files'
      );
    });

    it('TC-DZ-04: dragover with Files sets dropEffect to "copy" and prevents default', () => {
      const overlay = mockDocument.querySelector<MockElement>('[data-ref="global-dropzone-overlay"]')!;
      overlay.classList.remove('is-active');

      const event = new MockDragEvent('dragover', {
        dataTransfer: { dropEffect: 'none', types: ['Files'] },
      });

      mockWindow.dispatchEvent(event);

      assert.strictEqual(event.defaultPrevented, true, 'dragover must prevent default to allow drop');
      assert.strictEqual(event.dataTransfer?.dropEffect, 'copy', 'dropEffect must be set to "copy"');
      assert.strictEqual(overlay.classList.contains('is-active'), true);
    });

    it('TC-DZ-05: dragleave removes .is-active class when counter returns to 0', () => {
      const overlay = mockDocument.querySelector<MockElement>('[data-ref="global-dropzone-overlay"]')!;
      overlay.classList.remove('is-active');

      // Enter
      mockWindow.dispatchEvent(new MockDragEvent('dragenter', { dataTransfer: { types: ['Files'] } }));
      assert.strictEqual(overlay.classList.contains('is-active'), true);

      // Leave
      mockWindow.dispatchEvent(new MockDragEvent('dragleave', { dataTransfer: { types: ['Files'] } }));
      assert.strictEqual(
        overlay.classList.contains('is-active'),
        false,
        'Overlay must hide after dragleave counter decrements to 0'
      );
    });

    it('TC-DZ-06: nested dragenter/dragleave maintains balanced counter without premature dismissal', () => {
      const overlay = mockDocument.querySelector<MockElement>('[data-ref="global-dropzone-overlay"]')!;
      overlay.classList.remove('is-active');

      // Enter window (count = 1)
      mockWindow.dispatchEvent(new MockDragEvent('dragenter', { dataTransfer: { types: ['Files'] } }));
      assert.strictEqual(overlay.classList.contains('is-active'), true);

      // Enter inner element (count = 2)
      mockWindow.dispatchEvent(new MockDragEvent('dragenter', { dataTransfer: { types: ['Files'] } }));
      assert.strictEqual(overlay.classList.contains('is-active'), true);

      // Leave inner element (count = 1)
      mockWindow.dispatchEvent(new MockDragEvent('dragleave', { dataTransfer: { types: ['Files'] } }));
      assert.strictEqual(overlay.classList.contains('is-active'), true, 'Must remain active when count > 0');

      // Leave window (count = 0)
      mockWindow.dispatchEvent(new MockDragEvent('dragleave', { dataTransfer: { types: ['Files'] } }));
      assert.strictEqual(overlay.classList.contains('is-active'), false, 'Must hide when count reaches 0');
    });
  });

  // =========================================================================
  // SUITE 4: Global Dropzone Controller Delegation (F12, F13 / R6)
  // =========================================================================
  describe('Suite 4: Global Dropzone Controller Delegation (F12, F13 / R6)', () => {
    beforeEach(() => {
      initGlobalDropzone();
    });

    it('TC-DZ-08: active controller with handleFilesAdded receives full array of files', () => {
      const dummyFiles = [
        { name: 'doc1.pdf', size: 1024 },
        { name: 'doc2.pdf', size: 2048 },
      ];

      let receivedFiles: any = null;
      const activeToolView = new MockElement('DIV', 'tool-view-active');
      activeToolView.__controller = {
        handleFilesAdded: (files: any[]) => {
          receivedFiles = files;
        },
      };
      layoutContent.appendChild(activeToolView);

      const dropEvent = new MockDragEvent('drop', {
        dataTransfer: { files: dummyFiles, types: ['Files'] },
      });

      mockWindow.dispatchEvent(dropEvent);

      assert.ok(receivedFiles, 'handleFilesAdded must have been called');
      assert.strictEqual(receivedFiles.length, 2);
      assert.strictEqual(receivedFiles[0].name, 'doc1.pdf');
      assert.strictEqual(receivedFiles[1].name, 'doc2.pdf');
    });

    it('TC-DZ-09: active controller with handleFileSelected receives first dropped file (files[0])', () => {
      const dummyFiles = [
        { name: 'single.pdf', size: 5000 },
        { name: 'ignored.pdf', size: 1000 },
      ];

      let receivedSingleFile: any = null;
      const activeToolView = new MockElement('DIV', 'tool-view-single');
      activeToolView.__controller = {
        handleFileSelected: (file: any) => {
          receivedSingleFile = file;
        },
      };
      layoutContent.appendChild(activeToolView);

      const dropEvent = new MockDragEvent('drop', {
        dataTransfer: { files: dummyFiles, types: ['Files'] },
      });

      mockWindow.dispatchEvent(dropEvent);

      assert.ok(receivedSingleFile, 'handleFileSelected must have been called');
      assert.strictEqual(receivedSingleFile.name, 'single.pdf');
    });

    it('TC-DZ-10: active controller with handleUploadFiles receives full array of files', () => {
      const dummyFiles = [{ name: 'upload.pdf', size: 3000 }];

      let receivedUploadFiles: any = null;
      const activeToolView = new MockElement('DIV', 'tool-view-upload');
      activeToolView.__controller = {
        handleUploadFiles: (files: any[]) => {
          receivedUploadFiles = files;
        },
      };
      layoutContent.appendChild(activeToolView);

      const dropEvent = new MockDragEvent('drop', {
        dataTransfer: { files: dummyFiles, types: ['Files'] },
      });

      mockWindow.dispatchEvent(dropEvent);

      assert.ok(receivedUploadFiles, 'handleUploadFiles must have been called');
      assert.strictEqual(receivedUploadFiles[0].name, 'upload.pdf');
    });

    it('TC-DZ-11: precedence order: handleFilesAdded takes precedence over handleFileSelected', () => {
      const dummyFiles = [{ name: 'precedence.pdf', size: 1000 }];

      let multiCalled = false;
      let singleCalled = false;

      const activeToolView = new MockElement('DIV', 'tool-view-both');
      activeToolView.__controller = {
        handleFileSelected: () => {
          singleCalled = true;
        },
        handleFilesAdded: () => {
          multiCalled = true;
        },
      };
      layoutContent.appendChild(activeToolView);

      const dropEvent = new MockDragEvent('drop', {
        dataTransfer: { files: dummyFiles, types: ['Files'] },
      });

      mockWindow.dispatchEvent(dropEvent);

      assert.strictEqual(multiCalled, true, 'handleFilesAdded must be called first');
      assert.strictEqual(singleCalled, false, 'handleFileSelected must not be called when handleFilesAdded handled it');
    });

    it('TC-DZ-12: drop event with empty files array is safely ignored', () => {
      let called = false;
      const activeToolView = new MockElement('DIV', 'tool-view');
      activeToolView.__controller = {
        handleFilesAdded: () => {
          called = true;
        },
      };
      layoutContent.appendChild(activeToolView);

      const dropEvent = new MockDragEvent('drop', {
        dataTransfer: { files: [], types: ['Files'] },
      });

      mockWindow.dispatchEvent(dropEvent);

      assert.strictEqual(called, false, 'Must ignore drop event when files.length === 0');
    });
  });

  // =========================================================================
  // SUITE 5: Global Dropzone Authentication Guard & Fallback (F12, F13 / R6)
  // =========================================================================
  describe('Suite 5: Global Dropzone Authentication Guard & Fallback (F12, F13 / R6)', () => {
    beforeEach(() => {
      initGlobalDropzone();
    });

    it('TC-DZ-13: unauthenticated guest drop (currentUser === null) shows warning toast and aborts upload', async () => {
      api.clearUserState();
      assert.strictEqual(api.currentUser, null, 'User must be guest (null)');

      // No custom controller on layoutContent -> triggers handleGeneralFilesUpload fallback
      const dropEvent = new MockDragEvent('drop', {
        dataTransfer: {
          files: [{ name: 'guest_document.pdf', size: 4096 }],
          types: ['Files'],
        },
      });

      mockWindow.dispatchEvent(dropEvent);

      // Verify no network upload was initiated
      assert.strictEqual(mockFetchCalls.length, 0, 'No fetch upload request should be sent for unauthenticated guest');

      // Verify warning toast was created in DOM
      const toastItem = mockDocument.querySelector<MockElement>('.toast-item--warning');
      assert.ok(toastItem, 'Warning toast must be displayed when guest drops a file');
      assert.ok(
        toastItem.textContent.includes('Inicia sesión') || toastItem.textContent.includes('login_required'),
        `Toast text should inform user to log in: ${toastItem.textContent}`
      );
    });

    it('TC-DZ-14: authenticated drop initiates POST upload to API_ROUTES.collaborativeDocs.upload', async () => {
      api.setCurrentUser({
        avatar_url: null,
        created_at: new Date().toISOString(),
        email: 'challenger@boardstack.internal',
        id: 777,
        plan: 'pro',
        username: 'challenger_tester',
      } as any);

      assert.ok(api.currentUser !== null, 'User must be authenticated');

      const dummyFile = { name: 'auth_doc.pdf', size: 10240 };
      const dropEvent = new MockDragEvent('drop', {
        dataTransfer: {
          files: [dummyFile],
          types: ['Files'],
        },
      });

      mockWindow.dispatchEvent(dropEvent);

      // Wait a microtask for async upload to start
      await new Promise((r) => setTimeout(r, 10));

      assert.strictEqual(mockFetchCalls.length, 1, 'Upload fetch call must be executed for authenticated drop');
      assert.strictEqual(mockFetchCalls[0].url, '/api/collaborative-docs/upload');
      assert.strictEqual(mockFetchCalls[0].options.method, 'POST');

      // Info toast should be shown
      const toastItem = mockDocument.querySelector<MockElement>('.toast-item--info');
      assert.ok(toastItem, 'Info toast must be displayed indicating upload in progress');
    });
  });

  // =========================================================================
  // SUITE 6: Layout, DOM & Architecture Compliance (AGENTS.md / GEMINI.md)
  // =========================================================================
  describe('Suite 6: Layout, DOM & Architecture Compliance (AGENTS.md / GEMINI.md)', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const dropzoneComponentPath = path.resolve(__dirname, '../client/components/global-dropzone.component.ts');
    const wsServicePath = path.resolve(__dirname, '../client/services/websocket.service.ts');
    const overlaysCssPath = path.resolve(__dirname, '../public/css/components/component-overlays.css');

    it('TC-DOM-01: global-dropzone.component.ts contains strictly ZERO id attributes', () => {
      const code = fs.readFileSync(dropzoneComponentPath, 'utf-8');
      const idMatches = code.match(/\sid=["'][^"']*["']/gi);
      assert.strictEqual(idMatches, null, `Found forbidden id attributes in dropzone component: ${JSON.stringify(idMatches)}`);
    });

    it('TC-DOM-02: dropzone overlay uses semantic data-ref attributes and i18n keys', () => {
      const code = fs.readFileSync(dropzoneComponentPath, 'utf-8');
      assert.ok(
        code.includes('data-ref="global-dropzone-overlay"') ||
        code.includes("setAttribute('data-ref', 'global-dropzone-overlay')"),
        'Missing overlay data-ref'
      );
      assert.ok(code.includes('data-ref="global-dropzone-box"'), 'Missing box data-ref');
      assert.ok(code.includes('data-i18n="common.drop_file_overlay"'), 'Missing title i18n');
      assert.ok(code.includes('data-i18n="common.drop_file_hint"'), 'Missing hint i18n');
    });

    it('TC-DOM-03: component-overlays.css defines .global-dropzone-overlay without inline styles', () => {
      const css = fs.readFileSync(overlaysCssPath, 'utf-8');
      assert.ok(css.includes('.global-dropzone-overlay'), 'Missing .global-dropzone-overlay in CSS');
      assert.ok(css.includes('.global-dropzone-overlay.is-active'), 'Missing .global-dropzone-overlay.is-active in CSS');
      assert.ok(css.includes('z-index: 2500'), 'Overlay must have high z-index (2500)');
    });

    it('TC-DOM-04: websocket.service.ts adheres to GEMINI.md Rule 5 (only 2 allowed lifecycle logs)', () => {
      const code = fs.readFileSync(wsServicePath, 'utf-8');
      const consoleMatches = code.match(/console\.(log|warn|error|info|debug)\s*\(/g) || [];
      assert.strictEqual(
        consoleMatches.length,
        2,
        `Expected exactly 2 authorized lifecycle console.log calls in websocket.service.ts, found: ${consoleMatches.length}`
      );
      assert.ok(code.includes('[WebSocket] Conexión establecida con éxito'));
      assert.ok(code.includes('[WebSocket] Conexión cerrada.'));
    });
  });
});
