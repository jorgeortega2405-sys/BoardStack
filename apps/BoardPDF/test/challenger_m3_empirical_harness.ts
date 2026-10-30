import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { ToolLayoutController } from '../client/components/tool-layout.component.js';
import { getCurrentUserToolLimits, TOOLS_LIMITS } from '../client/config/tools-limits.config.js';
import { setNavigationHandler } from '../client/services/navigation.service.js';
import { generateThumbnailDataUrl, renderPdfThumbnail } from '../client/services/pdf-preview.service.js';
import { saveDownloadPayloadAndNavigate, setupToolFileFlow, validatePdfFile } from '../client/services/tool-flow.service.js';

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

(globalThis as any).requestAnimationFrame = (cb: (time: number) => void) => setTimeout(() => cb(Date.now()), 0);
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

class MockElement {
  public tagName: string;
  public classList: MockDOMTokenList;
  public attributes = new Map<string, string>();
  public style: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentNode: MockElement | null = null;
  public textContent: string = '';
  public value: string = '';
  public type: string = '';
  public files: any[] | null = null;
  public width = 0;
  public height = 0;
  private listeners: Array<{
    type: string;
    listener: (e: any) => void;
    signal?: AbortSignal;
    once?: boolean;
  }> = [];

  constructor(tagName: string, className = '') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockDOMTokenList(className);
  }

  get childNodes(): MockElement[] {
    return this.children;
  }

  get className(): string {
    return this.classList.value;
  }

  set className(val: string) {
    this.classList = new MockDOMTokenList(val);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name.toLowerCase(), value);
    if (name.toLowerCase() === 'class') {
      this.className = value;
    }
  }

  getAttribute(name: string): string | null {
    if (name.toLowerCase() === 'class') return this.className;
    return this.attributes.get(name.toLowerCase()) || null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name.toLowerCase());
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name.toLowerCase());
  }

  appendChild(child: MockElement): MockElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx >= 0) this.parentNode.children.splice(idx, 1);
      this.parentNode = null;
    }
  }

  addEventListener(type: string, listener: (e: any) => void, options?: any): void {
    const signal: AbortSignal | undefined = options?.signal;
    const once: boolean = !!options?.once;

    if (signal?.aborted) return;

    const entry = { type, listener, signal, once };
    this.listeners.push(entry);

    if (signal) {
      signal.addEventListener('abort', () => {
        this.removeEventListener(type, listener);
      }, { once: true });
    }
  }

  removeEventListener(type: string, listener: (e: any) => void): void {
    const idx = this.listeners.findIndex((l) => l.type === type && l.listener === listener);
    if (idx >= 0) {
      this.listeners.splice(idx, 1);
    }
  }

  dispatchEvent(event: any): boolean {
    event.currentTarget = this;
    if (!event.target) event.target = this;
    const targets = [...this.listeners];
    for (const entry of targets) {
      if (entry.type === event.type) {
        entry.listener(event);
        if (entry.once) {
          this.removeEventListener(entry.type, entry.listener);
        }
      }
    }
    return !event.defaultPrevented;
  }

  click(): void {
    const ev = {
      type: 'click',
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault: () => { ev.defaultPrevented = true; },
      stopPropagation: () => {},
    };
    this.dispatchEvent(ev);
  }

  focus(): void {}

  setPointerCapture(_id: number): void {}
  releasePointerCapture(_id: number): void {}

  getBoundingClientRect(): any {
    return { left: 0, right: 200, top: 0, bottom: 200, width: 200, height: 200 };
  }

  getContext(contextId: string): any {
    if (contextId === '2d') {
      return {
        scale: (_x: number, _y: number) => {},
        drawImage: () => {},
        fillRect: () => {},
        clearRect: () => {},
      };
    }
    return null;
  }

  toDataURL(_type?: string, _quality?: number): string {
    return 'data:image/jpeg;base64,mockThumbnailData';
  }

  set innerHTML(_val: string) {}

  querySelector<T = MockElement>(selector: string): T | null {
    const results = this.querySelectorAll<T>(selector);
    return results.length > 0 ? results[0] : null;
  }

  querySelectorAll<T = MockElement>(selector: string): T[] {
    const matched: MockElement[] = [];

    const testMatch = (el: MockElement): boolean => {
      const parts = selector.split(',').map((s) => s.trim());
      for (const part of parts) {
        if (part === 'input[type="file"]') {
          if (el.tagName === 'INPUT' && el.getAttribute('type') === 'file') return true;
        } else if (part === '.tool-layout__workspace') {
          if (el.classList.contains('tool-layout__workspace')) return true;
        } else if (part === '.tool-workspace__canvas') {
          if (el.classList.contains('tool-workspace__canvas')) return true;
        } else if (part === '.pdf-items-view') {
          if (el.classList.contains('pdf-items-view')) return true;
        } else if (part === '.tool-layout__sidebar') {
          if (el.classList.contains('tool-layout__sidebar')) return true;
        } else if (part === '.tool-sidebar__error-banner') {
          if (el.classList.contains('tool-sidebar__error-banner')) return true;
        } else if (part === '.tool-sidebar-backdrop') {
          if (el.classList.contains('tool-sidebar-backdrop')) return true;
        } else if (part === '.tool-hero-dropzone') {
          if (el.classList.contains('tool-hero-dropzone')) return true;
        } else if (part === '.pdf-dropzone') {
          if (el.classList.contains('pdf-dropzone')) return true;
        } else if (part === '.tool-layout') {
          if (el.classList.contains('tool-layout')) return true;
        } else if (part.startsWith('[data-ref=')) {
          const m = part.match(/\[data-ref="([^"]+)"\]/);
          if (m && el.getAttribute('data-ref') === m[1]) return true;
        } else if (part.startsWith('[data-ref*=')) {
          const m = part.match(/\[data-ref\*="([^"]+)"\]/);
          if (m) {
            const val = el.getAttribute('data-ref') || '';
            if (val.includes(m[1])) return true;
          }
        } else if (part.startsWith('[data-ref$=')) {
          const m = part.match(/\[data-ref\$="([^"]+)"\]/);
          if (m) {
            const val = el.getAttribute('data-ref') || '';
            if (val.endsWith(m[1])) return true;
          }
        }
      }
      return false;
    };

    const traverse = (node: MockElement) => {
      for (const child of node.children) {
        if (testMatch(child)) {
          matched.push(child);
        }
        traverse(child);
      }
    };

    traverse(this);
    return matched as unknown as T[];
  }

  closest<T = MockElement>(selector: string): T | null {
    let curr: MockElement | null = this;
    while (curr) {
      if (selector === '.tool-workspace__canvas' && curr.classList.contains('tool-workspace__canvas')) {
        return curr as unknown as T;
      }
      curr = curr.parentNode;
    }
    return null;
  }
}

class MockDocument extends MockElement {
  public body: MockElement;

  constructor() {
    super('DOCUMENT');
    this.body = new MockElement('BODY');
    this.appendChild(this.body);
  }

  createElement(tagName: string): MockElement {
    return new MockElement(tagName);
  }
}

const mockDoc = new MockDocument();
(globalThis as any).document = mockDoc;
const windowEventTarget = new EventTarget();
(globalThis as any).addEventListener = (type: string, listener: any, options?: any) => {
  windowEventTarget.addEventListener(type, listener, options);
};
(globalThis as any).removeEventListener = (type: string, listener: any) => {
  windowEventTarget.removeEventListener(type, listener);
};
(globalThis as any).dispatchEvent = (event: any) => {
  return windowEventTarget.dispatchEvent(event);
};

(globalThis as any).window = globalThis;
(globalThis as any).devicePixelRatio = 2;
(globalThis as any).HTMLElement = MockElement;
(globalThis as any).HTMLInputElement = MockElement;
(globalThis as any).HTMLCanvasElement = MockElement;

let capturedToasts: Array<{ msg: string; type: string }> = [];
(globalThis as any).showToastMock = (msg: string, type: string) => {
  capturedToasts.push({ msg, type });
};

const sessionStorageStore = new Map<string, string>();
(globalThis as any).sessionStorage = {
  getItem: (k: string) => sessionStorageStore.get(k) || null,
  setItem: (k: string, v: string) => sessionStorageStore.set(k, v),
  removeItem: (k: string) => sessionStorageStore.delete(k),
  clear: () => sessionStorageStore.clear(),
};

function createStandardToolDOM(toolName = 'compress-pdf'): {
  container: MockElement;
  workspace: MockElement;
  dropzoneCard: MockElement;
  selectedCard: MockElement;
  sidebar: MockElement;
  errorBanner: MockElement;
  settingsBtn: MockElement;
  fab: MockElement;
  fileInput: MockElement;
  browseBtn: MockElement;
  driveHeroBtn: MockElement;
  dropboxHeroBtn: MockElement;
} {
  const container = new MockElement('DIV', 'tool-container');
  mockDoc.body.appendChild(container);

  const workspace = new MockElement('DIV', 'tool-layout__workspace');
  workspace.setAttribute('data-ref', `${toolName}-workspace`);
  container.appendChild(workspace);

  const dropzoneCard = new MockElement('DIV', 'tool-dropzone-card tool-workspace__canvas');
  dropzoneCard.setAttribute('data-ref', `${toolName}-dropzone-card`);
  workspace.appendChild(dropzoneCard);

  const fileInput = new MockElement('INPUT');
  fileInput.setAttribute('type', 'file');
  fileInput.setAttribute('data-ref', 'file-input-pdf');
  dropzoneCard.appendChild(fileInput);

  const browseBtn = new MockElement('BUTTON', 'component-button');
  browseBtn.setAttribute('data-ref', 'btn-browse-file');
  dropzoneCard.appendChild(browseBtn);

  const driveHeroBtn = new MockElement('BUTTON');
  driveHeroBtn.setAttribute('data-ref', 'btn-hero-drive');
  dropzoneCard.appendChild(driveHeroBtn);

  const dropboxHeroBtn = new MockElement('BUTTON');
  dropboxHeroBtn.setAttribute('data-ref', 'btn-hero-dropbox');
  dropzoneCard.appendChild(dropboxHeroBtn);

  const selectedCard = new MockElement('DIV', 'tool-selected-card is-hidden');
  selectedCard.setAttribute('data-ref', `${toolName}-selected-card`);
  workspace.appendChild(selectedCard);

  const sidebar = new MockElement('ASIDE', 'tool-layout__sidebar is-hidden');
  sidebar.setAttribute('data-ref', `${toolName}-sidebar`);
  container.appendChild(sidebar);

  const errorBanner = new MockElement('DIV', 'banner banner--danger is-hidden');
  errorBanner.setAttribute('data-ref', `${toolName}-error`);
  sidebar.appendChild(errorBanner);

  const settingsBtn = new MockElement('BUTTON');
  settingsBtn.setAttribute('data-ref', 'btn-tool-settings');
  container.appendChild(settingsBtn);

  const fab = new MockElement('DIV', 'tool-fab-container is-hidden');
  fab.setAttribute('data-ref', 'tool-fab-more');
  container.appendChild(fab);

  return {
    container,
    workspace,
    dropzoneCard,
    selectedCard,
    sidebar,
    errorBanner,
    settingsBtn,
    fab,
    fileInput,
    browseBtn,
    driveHeroBtn,
    dropboxHeroBtn,
  };
}

async function runEmpiricalStressSuite() {
  let passedTests = 0;
  let totalTests = 0;

  function runTest(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    try {
      fn();
      passedTests++;
      console.log(`[PASS] ${name}`);
    } catch (err: any) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  async function runAsyncTest(name: string, fn: () => Promise<void>) {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`[PASS] ${name}`);
    } catch (err: any) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  console.log('--- INITIATING EMPIRICAL CHALLENGER TEST SUITE (M3) ---');

  // TEST 1: ToolLayoutController Resolution & State Transitions
  runTest('ToolLayoutController: Constructor & Resolution with defaults', () => {
    const dom = createStandardToolDOM('compress-pdf');
    const layout = new ToolLayoutController({
      container: dom.container as any,
      toolName: 'Comprimir PDF',
    });

    assert.strictEqual(layout.resolveWorkspace(), dom.workspace as any);
    assert.strictEqual(layout.resolveDropzoneCard(), dom.dropzoneCard as any);
    assert.strictEqual(layout.resolveSelectedCard(), dom.selectedCard as any);
    assert.strictEqual(layout.resolveSidebar(), dom.sidebar as any);
    assert.strictEqual(layout.resolveErrorBanner(), dom.errorBanner as any);
    assert.strictEqual(layout.resolveSettingsBtn(), dom.settingsBtn as any);
    assert.strictEqual(layout.resolveFab(), dom.fab as any);
  });

  // TEST 2: State Transitions: empty -> ready -> processing -> empty
  runTest('ToolLayoutController: State transitions (empty -> ready -> processing -> empty)', () => {
    const dom = createStandardToolDOM('compress-pdf');
    const layout = new ToolLayoutController({
      container: dom.container as any,
      toolName: 'Comprimir PDF',
    });
    layout.init();

    // 1. Initially Empty State
    layout.showEmptyState();
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-hidden'), false);
    assert.strictEqual(dom.selectedCard.classList.contains('is-hidden'), true);
    assert.strictEqual(dom.sidebar.classList.contains('is-hidden'), true);
    assert.strictEqual(dom.workspace.classList.contains('tool-layout__workspace--top-aligned'), false);
    assert.strictEqual(dom.settingsBtn.classList.contains('is-visible'), false);
    assert.strictEqual(dom.fab.classList.contains('is-hidden'), true);

    // 2. Transition to Ready State
    layout.showReadyState();
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-hidden'), true);
    assert.strictEqual(dom.selectedCard.classList.contains('is-hidden'), false);
    assert.strictEqual(dom.sidebar.classList.contains('is-hidden'), false);
    assert.strictEqual(dom.workspace.classList.contains('tool-layout__workspace--top-aligned'), true);
    assert.strictEqual(dom.settingsBtn.classList.contains('is-visible'), true);
    assert.strictEqual(dom.fab.classList.contains('is-hidden'), false);

    // 3. Transition to Processing State
    layout.showProcessingState();
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-hidden'), true);
    assert.strictEqual(dom.selectedCard.classList.contains('is-hidden'), true);
    assert.strictEqual(dom.sidebar.classList.contains('is-hidden'), true);
    assert.strictEqual(dom.workspace.classList.contains('tool-layout__workspace--top-aligned'), false);
    assert.strictEqual(dom.settingsBtn.classList.contains('is-visible'), false);
    assert.strictEqual(dom.fab.classList.contains('is-hidden'), true);

    // 4. Return to Empty State
    layout.showEmptyState();
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-hidden'), false);
    assert.strictEqual(dom.selectedCard.classList.contains('is-hidden'), true);
    assert.strictEqual(dom.sidebar.classList.contains('is-hidden'), true);
    assert.strictEqual(dom.workspace.classList.contains('tool-layout__workspace--top-aligned'), false);
    assert.strictEqual(dom.settingsBtn.classList.contains('is-visible'), false);
    assert.strictEqual(dom.fab.classList.contains('is-hidden'), true);

    layout.destroy();
  });

  // TEST 3: Stress-test Rapid State Cycling (100 iterations)
  runTest('ToolLayoutController: Stress 100 rapid state cycles', () => {
    const dom = createStandardToolDOM('merge-pdf');
    const layout = new ToolLayoutController({
      container: dom.container as any,
      toolName: 'Unir PDF',
    });
    layout.init();

    for (let i = 0; i < 100; i++) {
      layout.showReadyState();
      assert.strictEqual(dom.selectedCard.classList.contains('is-hidden'), false);
      layout.showProcessingState();
      assert.strictEqual(dom.selectedCard.classList.contains('is-hidden'), true);
      layout.showEmptyState();
      assert.strictEqual(dom.dropzoneCard.classList.contains('is-hidden'), false);
    }

    layout.destroy();
  });

  // TEST 4: Error Banner Rendering and Auto-hiding
  runTest('ToolLayoutController: Error banner rendering & auto-hiding', () => {
    const dom = createStandardToolDOM('unlock-pdf');
    const layout = new ToolLayoutController({
      container: dom.container as any,
      toolName: 'Desbloquear PDF',
    });
    layout.init();

    layout.showError('Contraseña incorrecta para el archivo.');
    assert.strictEqual(dom.errorBanner.textContent, 'Contraseña incorrecta para el archivo.');
    assert.strictEqual(dom.errorBanner.classList.contains('is-hidden'), false);

    // Transition to ready state auto-clears and hides error banner
    layout.showReadyState();
    assert.strictEqual(dom.errorBanner.textContent, '');
    assert.strictEqual(dom.errorBanner.classList.contains('is-hidden'), true);

    layout.showError('Nuevo error de prueba.');
    assert.strictEqual(dom.errorBanner.textContent, 'Nuevo error de prueba.');
    assert.strictEqual(dom.errorBanner.classList.contains('is-hidden'), false);

    // Calling hideError explicitly
    layout.hideError();
    assert.strictEqual(dom.errorBanner.textContent, '');
    assert.strictEqual(dom.errorBanner.classList.contains('is-hidden'), true);

    layout.destroy();
  });

  // TEST 5: Graceful fallback when error banner is absent from DOM
  runTest('ToolLayoutController: Graceful degradation when error banner missing', () => {
    const dom = createStandardToolDOM('crop-pdf');
    dom.errorBanner.remove(); // Remove error banner completely
    const layout = new ToolLayoutController({
      container: dom.container as any,
      toolName: 'Recortar PDF',
    });
    layout.init();

    // Should not throw even if errorBanner is null
    layout.showError('Error sin banner');
    layout.hideError();
    layout.showReadyState();
    layout.showEmptyState();
    layout.destroy();
  });

  // TEST 6: Lifecycle Cleanup & Idempotence on destroy()
  runTest('ToolLayoutController: Lifecycle cleanup and double-destroy idempotence', () => {
    const dom = createStandardToolDOM('protect-pdf');
    const abortCtrl = new AbortController();
    const layout = new ToolLayoutController({
      container: dom.container as any,
      toolName: 'Proteger PDF',
    });

    layout.init(abortCtrl.signal);
    assert.strictEqual(layout.sidebarModal !== null, true);

    // External abort triggers destroy
    abortCtrl.abort();
    assert.strictEqual(layout.sidebarModal, null);

    // Repeated destroy should be safely idempotent
    layout.destroy();
    layout.destroy();
  });

  // TEST 7: File Validation Logic in setupToolFileFlow
  runTest('File Validation: PDF extension, MIME types, and size limits', () => {
    const toolId = 'compress-pdf';
    const limits = getCurrentUserToolLimits(toolId);
    assert.strictEqual(limits.maxFileSizeMB, 1000);

    // 1. Valid PDF file
    const validFile = new File(['%PDF-1.4 mock content'], 'document.pdf', { type: 'application/pdf' });
    const res1 = validatePdfFile(validFile, toolId);
    assert.strictEqual(res1.valid, true);

    // 2. Valid uppercase PDF extension
    const uppercaseFile = new File(['%PDF-1.4'], 'REPORT.PDF', { type: '' });
    const res2 = validatePdfFile(uppercaseFile, toolId);
    assert.strictEqual(res2.valid, true);

    // 3. Invalid non-PDF file
    const textFile = new File(['hello world'], 'notes.txt', { type: 'text/plain' });
    const res3 = validatePdfFile(textFile, toolId);
    assert.strictEqual(res3.valid, false);
    assert.strictEqual(res3.error, 'Selecciona únicamente un documento en formato PDF.');

    // 4. Oversized PDF file (simulate file > limits.maxFileSizeMB)
    const oversizedFile = new File(['dummy'], 'giant.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: 1001 * 1024 * 1024 });
    const res4 = validatePdfFile(oversizedFile, toolId);
    assert.strictEqual(res4.valid, false);
    assert.ok(res4.error?.includes('supera el límite permitido'));
  });

  // TEST 8: setupToolFileFlow file input change event
  await runAsyncTest('setupToolFileFlow: File input change handling', async () => {
    const dom = createStandardToolDOM('rotate-pdf');
    const abortCtrl = new AbortController();

    let receivedFile: File | null = null;
    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'rotate-pdf',
      signal: abortCtrl.signal,
      onFile: (file) => {
        receivedFile = file;
      },
    });

    const file = new File(['%PDF-1.7 data'], 'sample.pdf', { type: 'application/pdf' });
    dom.fileInput.files = [file];

    const changeEv = {
      type: 'change',
      target: dom.fileInput,
      currentTarget: dom.fileInput,
    };
    dom.fileInput.dispatchEvent(changeEv);

    // Allow promise tick
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(receivedFile, file);
    assert.strictEqual(dom.fileInput.value, ''); // Value must be reset

    abortCtrl.abort();
  });

  // TEST 9: setupToolFileFlow browse button triggers file input click
  runTest('setupToolFileFlow: Browse button delegates click to file input', () => {
    const dom = createStandardToolDOM('organize-pdf');
    const abortCtrl = new AbortController();

    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'organize-pdf',
      signal: abortCtrl.signal,
      onFile: () => {},
    });

    let inputClicked = false;
    dom.fileInput.addEventListener('click', () => {
      inputClicked = true;
    });

    dom.browseBtn.click();
    assert.strictEqual(inputClicked, true);

    abortCtrl.abort();
  });

  // TEST 10: setupToolFileFlow drag & drop visual states and file ingestion
  await runAsyncTest('setupToolFileFlow: Drag and Drop visual feedback & file delivery', async () => {
    const dom = createStandardToolDOM('watermark-pdf');
    const abortCtrl = new AbortController();

    let droppedFiles: File[] = [];
    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'watermark-pdf',
      multiselect: true,
      signal: abortCtrl.signal,
      onFiles: (files) => {
        droppedFiles = files;
      },
    });

    // 1. Drag enter adds active classes
    const dragEnterEv = {
      type: 'dragenter',
      preventDefault: () => {},
    };
    dom.dropzoneCard.dispatchEvent(dragEnterEv);
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-dragover'), true);
    assert.strictEqual(dom.dropzoneCard.classList.contains('tool-dropzone--active'), true);

    // 2. Drag leave removes active classes
    const dragLeaveEv = {
      type: 'dragleave',
      preventDefault: () => {},
      clientX: -10, // outside bounds
      clientY: -10,
    };
    dom.dropzoneCard.dispatchEvent(dragLeaveEv);
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-dragover'), false);
    assert.strictEqual(dom.dropzoneCard.classList.contains('tool-dropzone--active'), false);

    // 3. Drop event dispatches files
    const file1 = new File(['%PDF-doc1'], 'doc1.pdf', { type: 'application/pdf' });
    const file2 = new File(['%PDF-doc2'], 'doc2.pdf', { type: 'application/pdf' });
    const dropEv = {
      type: 'drop',
      preventDefault: () => {},
      dataTransfer: {
        files: [file1, file2],
      },
    };
    dom.dropzoneCard.dispatchEvent(dropEv);

    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(droppedFiles.length, 2);
    assert.strictEqual(droppedFiles[0].name, 'doc1.pdf');
    assert.strictEqual(droppedFiles[1].name, 'doc2.pdf');

    abortCtrl.abort();
  });

  // TEST 11: setupToolFileFlow Multiselect Validation & Filter
  await runAsyncTest('setupToolFileFlow: Multiselect filters out non-PDF files', async () => {
    const dom = createStandardToolDOM('merge-pdf');
    const abortCtrl = new AbortController();

    let received: File[] = [];
    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'merge-pdf',
      multiselect: true,
      signal: abortCtrl.signal,
      onFiles: (files) => {
        received = files;
      },
    });

    const validPdf = new File(['%PDF'], 'valid.pdf', { type: 'application/pdf' });
    const invalidDoc = new File(['corrupt'], 'notes.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    dom.fileInput.files = [validPdf, invalidDoc];
    dom.fileInput.dispatchEvent({ type: 'change' });

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Only the valid PDF must have been forwarded
    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].name, 'valid.pdf');

    abortCtrl.abort();
  });

  // TEST 12: to-pdf-converter accepts non-PDF files
  await runAsyncTest('setupToolFileFlow: to-pdf-converter accepts non-PDF files', async () => {
    const dom = createStandardToolDOM('to-pdf-converter');
    const abortCtrl = new AbortController();

    let accepted: File[] = [];
    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'to-pdf-converter',
      multiselect: true,
      signal: abortCtrl.signal,
      onFiles: (files) => {
        accepted = files;
      },
    });

    const docxFile = new File(['docx content'], 'presentation.pptx', { type: 'application/vnd.ms-powerpoint' });
    dom.fileInput.files = [docxFile];
    dom.fileInput.dispatchEvent({ type: 'change' });

    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(accepted.length, 1);
    assert.strictEqual(accepted[0].name, 'presentation.pptx');

    abortCtrl.abort();
  });

  // TEST 13: setupToolFileFlow AbortSignal listener removal
  await runAsyncTest('setupToolFileFlow: AbortSignal unbinds all event listeners cleanly', async () => {
    const dom = createStandardToolDOM('split-pdf');
    const abortCtrl = new AbortController();

    let callCount = 0;
    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'split-pdf',
      signal: abortCtrl.signal,
      onFile: () => {
        callCount++;
      },
    });

    // Abort the signal
    abortCtrl.abort();

    // Trigger change event after abort
    const file = new File(['%PDF'], 'test.pdf', { type: 'application/pdf' });
    dom.fileInput.files = [file];
    dom.fileInput.dispatchEvent({ type: 'change' });

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Listener was cleaned up, callback must not have been invoked
    assert.strictEqual(callCount, 0);
  });

  // TEST 14: PDF Preview Service Thumbnail Rendering Math & Contracts
  await runAsyncTest('PDF Preview: renderPdfThumbnail with Mock PDF Document', async () => {
    let docDestroyCalled = false;
    let pageRenderCalled = false;

    const mockPage = {
      getViewport: ({ scale }: { scale: number }) => {
        return {
          width: 595 * scale,
          height: 842 * scale,
        };
      },
      render: ({ canvasContext, viewport }: any) => {
        pageRenderCalled = true;
        return {
          promise: Promise.resolve(),
        };
      },
    };

    const mockDoc = {
      getPage: async (num: number) => {
        assert.strictEqual(num, 1);
        return mockPage;
      },
      destroy: async () => {
        docDestroyCalled = true;
      },
    };

    const canvas = new MockElement('CANVAS');
    await renderPdfThumbnail(mockDoc as any, canvas as any, { targetWidth: 180, dpr: true });

    assert.strictEqual(pageRenderCalled, true);
    // When caller passes existing document proxy, it should NOT destroy it
    assert.strictEqual(docDestroyCalled, false);
    // Canvas dimensions scaled by DPR (2)
    assert.strictEqual(canvas.width, 360);
    assert.strictEqual(canvas.style.width, '180px');
  });

  // TEST 15: PDF Preview Service Data URL Generator Contract
  await runAsyncTest('PDF Preview: generateThumbnailDataUrl with Mock Document', async () => {
    const mockPage = {
      getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
      render: () => ({ promise: Promise.resolve() }),
    };
    const mockDoc = {
      getPage: async () => mockPage,
      destroy: async () => {},
    };

    const dataUrl = await generateThumbnailDataUrl(mockDoc as any, 1, 200, 0.85);
    assert.strictEqual(dataUrl, 'data:image/jpeg;base64,mockThumbnailData');
  });

  // TEST 16: saveDownloadPayloadAndNavigate session storage and paths
  runTest('saveDownloadPayloadAndNavigate: SessionStorage payload and routing', () => {
    let navigatedUrl = '';
    setNavigationHandler((url: string) => {
      navigatedUrl = url;
    });

    // 1. With token
    saveDownloadPayloadAndNavigate({
      filename: 'result.pdf',
      returnUrl: '/compress-pdf',
      token: 'tok-abc-123',
    });
    assert.strictEqual(navigatedUrl, '/download/tok-abc-123');
    const stored = JSON.parse(sessionStorage.getItem('download_ready_data') || '{}');
    assert.strictEqual(stored.token, 'tok-abc-123');
    assert.strictEqual(stored.downloadUrl, '/api/download/tok-abc-123');
    assert.strictEqual(stored.filename, 'result.pdf');
    assert.strictEqual(stored.returnUrl, '/compress-pdf');

    // 2. Without token
    saveDownloadPayloadAndNavigate({
      filename: 'merged.pdf',
      returnUrl: '/merge-pdf',
      downloadUrl: '/custom-blob-url',
    });
    assert.strictEqual(navigatedUrl, '/download');
    const stored2 = JSON.parse(sessionStorage.getItem('download_ready_data') || '{}');
    assert.strictEqual(stored2.token, '');
    assert.strictEqual(stored2.downloadUrl, '/custom-blob-url');
  });

  // TEST 17: ToolLayoutController: onRetry handler custom vs default behavior
  runTest('ToolLayoutController: onRetry handler custom vs default behavior', () => {
    const dom = createStandardToolDOM('edit-pdf');
    let customRetryCalled = false;
    const layout1 = new ToolLayoutController({
      container: dom.container as any,
      toolName: 'Editar PDF',
      onRetry: () => {
        customRetryCalled = true;
      },
    });
    layout1.init();
    layout1.showProcessingState();
    // Trigger onRetry handler configured on statusManager
    (layout1.statusManager as any).onRetry();
    assert.strictEqual(customRetryCalled, true);
    layout1.destroy();

    // Default retry behavior without onRetry option: falls back to showEmptyState()
    const layout2 = new ToolLayoutController({
      container: dom.container as any,
      toolName: 'Editar PDF',
    });
    layout2.init();
    layout2.showReadyState();
    (layout2.statusManager as any).onRetry();
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-hidden'), false);
    assert.strictEqual(dom.selectedCard.classList.contains('is-hidden'), true);
    layout2.destroy();
  });

  // TEST 18: Multiselect with zero valid files rejects completely
  await runAsyncTest('setupToolFileFlow: Multiselect with zero valid files rejects completely', async () => {
    const dom = createStandardToolDOM('organize-pdf');
    const abortCtrl = new AbortController();

    let onFilesCalled = false;
    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'organize-pdf',
      multiselect: true,
      signal: abortCtrl.signal,
      onFiles: () => {
        onFilesCalled = true;
      },
    });

    const file1 = new File(['1'], 'doc.exe', { type: 'application/x-msdownload' });
    const file2 = new File(['2'], 'image.jpg', { type: 'image/jpeg' });
    dom.fileInput.files = [file1, file2];
    dom.fileInput.dispatchEvent({ type: 'change' });

    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(onFilesCalled, false);
    abortCtrl.abort();
  });

  // TEST 19: Single-file flow accepts only first file and ignores excess
  await runAsyncTest('setupToolFileFlow: Single-file flow accepts only first file and ignores excess', async () => {
    const dom = createStandardToolDOM('compress-pdf');
    const abortCtrl = new AbortController();

    let processedFile: File | null = null;
    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'compress-pdf',
      multiselect: false,
      signal: abortCtrl.signal,
      onFile: (f) => {
        processedFile = f;
      },
    });

    const file1 = new File(['%PDF-1'], 'first.pdf', { type: 'application/pdf' });
    const file2 = new File(['%PDF-2'], 'second.pdf', { type: 'application/pdf' });
    dom.fileInput.files = [file1, file2];
    dom.fileInput.dispatchEvent({ type: 'change' });

    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(processedFile, file1);
    abortCtrl.abort();
  });

  // TEST 20: FAB button delegates click to input-add-more-pdf
  runTest('setupToolFileFlow: FAB button delegates click to input-add-more-pdf', () => {
    const dom = createStandardToolDOM('merge-pdf');
    const abortCtrl = new AbortController();

    const addMoreInput = new MockElement('INPUT');
    addMoreInput.setAttribute('type', 'file');
    addMoreInput.setAttribute('data-ref', 'input-add-more-pdf');
    dom.container.appendChild(addMoreInput);

    const fabBtn = new MockElement('BUTTON');
    fabBtn.setAttribute('data-ref', 'btn-fab-add-more');
    dom.container.appendChild(fabBtn);

    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'merge-pdf',
      multiselect: true,
      signal: abortCtrl.signal,
      onFiles: () => {},
    });

    let addMoreClicked = false;
    addMoreInput.addEventListener('click', () => {
      addMoreClicked = true;
    });

    fabBtn.click();
    assert.strictEqual(addMoreClicked, true);

    abortCtrl.abort();
  });

  // TEST 21: Dragenter on child preserves active state without flickering
  runTest('bindFileDropzone: Dragenter on child preserves active state without flickering', () => {
    const dom = createStandardToolDOM('rotate-pdf');
    const abortCtrl = new AbortController();

    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'rotate-pdf',
      signal: abortCtrl.signal,
      onFile: () => {},
    });

    // Enter container -> dragCounter = 1
    dom.dropzoneCard.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-dragover'), true);

    // Enter child button -> dragCounter = 2
    dom.browseBtn.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-dragover'), true);

    // Leave child button (still inside container coords)
    dom.browseBtn.dispatchEvent({
      type: 'dragleave',
      preventDefault: () => {},
      clientX: 50,
      clientY: 50, // inside bounding rect 0..200
    });
    // Active class must NOT be removed!
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-dragover'), true);

    // Leave container completely
    dom.dropzoneCard.dispatchEvent({
      type: 'dragleave',
      preventDefault: () => {},
      clientX: -50,
      clientY: -50,
    });
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-dragover'), false);

    abortCtrl.abort();
  });

  // TEST 22: Global window drop & dragend resets dropzone active class
  runTest('bindFileDropzone: Global window drop & dragend resets dropzone active class', () => {
    const dom = createStandardToolDOM('unlock-pdf');
    const abortCtrl = new AbortController();

    setupToolFileFlow({
      container: dom.container as any,
      toolId: 'unlock-pdf',
      signal: abortCtrl.signal,
      onFile: () => {},
    });

    // Enter dropzone
    dom.dropzoneCard.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-dragover'), true);

    // Drop anywhere on window
    const winDropEv = new Event('drop');
    (globalThis as any).dispatchEvent(winDropEv);
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-dragover'), false);

    // Dragenter again and dragend on window
    dom.dropzoneCard.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-dragover'), true);
    const winDragEndEv = new Event('dragend');
    (globalThis as any).dispatchEvent(winDragEndEv);
    assert.strictEqual(dom.dropzoneCard.classList.contains('is-dragover'), false);

    abortCtrl.abort();
  });

  // TEST 23: PDF Preview: Error handling does not crash on corrupt input
  await runAsyncTest('PDF Preview: Error handling does not crash on corrupt input', async () => {
    const corruptDoc = {
      getPage: async () => {
        throw new Error('Corrupted PDF structure');
      },
      destroy: async () => {},
    };

    const canvas = new MockElement('CANVAS');
    // Must resolve cleanly without throwing
    await renderPdfThumbnail(corruptDoc as any, canvas as any);

    const dataUrl = await generateThumbnailDataUrl(corruptDoc as any);
    assert.strictEqual(dataUrl, '');
  });

  // TEST 24: ToolLayoutController: Re-init and destroy during processing state cleans up DOM
  runTest('ToolLayoutController: Re-init and destroy during processing state cleans up DOM', () => {
    const dom = createStandardToolDOM('summarize-pdf');
    const layout = new ToolLayoutController({
      container: dom.container as any,
      toolName: 'Resumir PDF',
    });

    layout.init();
    layout.showProcessingState();

    // Destroy during processing state must clean up status manager and upload screen
    layout.destroy();
    assert.strictEqual(layout.sidebarModal, null);

    // Subsequent re-init and state changes should work cleanly
    layout.init();
    layout.showReadyState();
    assert.strictEqual(dom.selectedCard.classList.contains('is-hidden'), false);
    layout.destroy();
  });

  console.log('=======================================================');
  console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('=======================================================');
}

runEmpiricalStressSuite().catch((err) => {
  console.error('TEST SUITE ENCOUNTERED UNHANDLED ERROR:', err);
  process.exit(1);
});
