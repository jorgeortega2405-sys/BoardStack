import { API_ROUTES } from '../../config/api-routes.js';
import { getApi, putApi } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';
import { hideElement, showElement, withButtonLoading } from '../../utils/dom.util.js';

interface ElementText {
  color?: string;
  fontFamily?: string;
  fontSize: number;
  height?: number;
  id: string;
  isBold?: boolean;
  pageIndex: number;
  text: string;
  type: 'text';
  width?: number;
  x: number;
  y: number;
}

interface ElementShape {
  fillColor?: string;
  height: number;
  id: string;
  pageIndex: number;
  shapeType: 'circle' | 'line' | 'rect';
  strokeColor: string;
  strokeWidth: number;
  type: 'shape';
  width: number;
  x: number;
  x2?: number;
  y: number;
  y2?: number;
}

interface ElementDrawing {
  color: string;
  id: string;
  pageIndex: number;
  points: Array<{ x: number; y: number }>;
  type: 'drawing';
  width: number;
}

type EditorElement = ElementDrawing | ElementShape | ElementText;

export class CollaborativePdfEditorController implements ViewController {
  private abortController: AbortController | null = null;
  private activeTool: 'circle' | 'draw' | 'line' | 'rect' | 'select' | 'text' = 'select';
  private container: HTMLElement;
  private currentDrawing: ElementDrawing | null = null;
  private docId = '';
  private docTitle = 'Documento sin título';
  private elements: EditorElement[] = [];
  private fillColor = 'transparent';
  private isBold = false;
  private isDrawing = false;
  private isModified = false;
  private pageCount = 1;
  private redoStack: EditorElement[][] = [];
  private selectedElementId: string | null = null;
  private strokeColor = '#000000';
  private strokeWidth = 2;
  private undoStack: EditorElement[][] = [];

  constructor(container: HTMLElement, docId?: string) {
    this.container = container;
    this.docId = docId || '';
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();

    if (!this.docId) {
      const urlParams = new URLSearchParams(window.location.search);
      this.docId = urlParams.get('id') || `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    }

    await this.loadDocument();
    this.renderPages();
    this.bindEvents();
    renderIcons(this.container);
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async loadDocument(): Promise<void> {
    if (!this.docId) return;
    try {
      const res = await getApi(API_ROUTES.collaborativeDocs.byId(this.docId));
      if (res.ok) {
        const data = await res.json();
        if (data.document) {
          this.docTitle = data.document.title || 'Documento sin título';
          this.pageCount = Math.max(1, data.document.page_count || data.document.content?.pageCount || 1);
          this.elements = Array.isArray(data.document.content?.elements) ? data.document.content.elements : [];
        }
      }
    } catch {}

    const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
    if (titleInput) {
      titleInput.value = this.docTitle;
    }
    this.updatePageInfo();
  }

  private pushUndo(): void {
    this.undoStack.push(JSON.parse(JSON.stringify(this.elements)));
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack = [];
    this.updateUndoRedoBtns();
    this.setModified(true);
  }

  private updateUndoRedoBtns(): void {
    const undoBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    const redoBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
  }

  private setModified(val: boolean): void {
    this.isModified = val;
    const badge = this.container.querySelector<HTMLElement>('[data-ref="badge-save-status"]');
    if (badge) {
      if (val) {
        badge.textContent = 'Cambios sin guardar';
        badge.className = 'component-badge component-badge--sm component-badge--warning';
      } else {
        badge.textContent = 'Guardado';
        badge.className = 'component-badge component-badge--sm';
      }
    }
  }

  private renderPages(): void {
    const pagesContainer = this.container.querySelector<HTMLElement>('[data-ref="pages-container"]');
    if (!pagesContainer) return;

    pagesContainer.innerHTML = '';

    for (let p = 0; p < this.pageCount; p++) {
      const sheet = document.createElement('div');
      sheet.className = 'collaborative-page-sheet';
      sheet.setAttribute('data-ref', `page-sheet-${p}`);
      sheet.setAttribute('data-page-index', p.toString());

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'collaborative-shapes-svg');
      svg.setAttribute('data-ref', `shapes-svg-${p}`);
      svg.setAttribute('viewBox', '0 0 595 842');

      const canvas = document.createElement('canvas');
      canvas.className = 'collaborative-drawing-canvas';
      canvas.setAttribute('data-ref', `drawing-canvas-${p}`);
      canvas.width = 595;
      canvas.height = 842;

      sheet.appendChild(svg);
      sheet.appendChild(canvas);

      const pageElements = this.elements.filter((el) => (el.pageIndex ?? 0) === p);
      for (const el of pageElements) {
        if (el.type === 'text') {
          sheet.appendChild(this.createTextElement(el));
        } else if (el.type === 'shape') {
          svg.appendChild(this.createShapeElement(el));
        }
      }

      pagesContainer.appendChild(sheet);
      this.drawFreehandOnCanvas(canvas, p);
    }

    this.updatePageInfo();
    this.updateSelection();
  }

  private drawFreehandOnCanvas(canvas: HTMLCanvasElement, pageIndex: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawings = this.elements.filter((el) => el.type === 'drawing' && (el.pageIndex ?? 0) === pageIndex) as ElementDrawing[];
    for (const d of drawings) {
      if (!d.points || d.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = d.color || '#000000';
      ctx.lineWidth = d.width || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(d.points[0].x, d.points[0].y);
      for (let i = 1; i < d.points.length; i++) {
        ctx.lineTo(d.points[i].x, d.points[i].y);
      }
      ctx.stroke();
    }
  }

  private createTextElement(el: ElementText): HTMLElement {
    const div = document.createElement('div');
    div.className = `collaborative-text-box${this.selectedElementId === el.id ? ' is-selected' : ''}`;
    div.setAttribute('data-ref', `text-element-${el.id}`);
    div.setAttribute('data-element-id', el.id);
    div.style.left = `${el.x}px`;
    div.style.top = `${el.y}px`;
    div.style.fontSize = `${el.fontSize || 14}px`;
    div.style.color = el.color || '#000000';
    div.style.fontWeight = el.isBold ? 'bold' : 'normal';
    div.style.fontFamily = el.fontFamily || 'Helvetica, sans-serif';
    div.contentEditable = 'true';
    div.innerText = el.text || 'Texto';

    div.addEventListener('input', () => {
      el.text = div.innerText;
      this.setModified(true);
    });

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(el.id);
    });

    this.makeDraggable(div, el);
    return div;
  }

  private createShapeElement(el: ElementShape): SVGElement {
    let node: SVGElement;
    if (el.shapeType === 'rect') {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      node.setAttribute('x', el.x.toString());
      node.setAttribute('y', el.y.toString());
      node.setAttribute('width', el.width.toString());
      node.setAttribute('height', el.height.toString());
      node.setAttribute('rx', '2');
    } else if (el.shapeType === 'circle') {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      node.setAttribute('cx', (el.x + el.width / 2).toString());
      node.setAttribute('cy', (el.y + el.height / 2).toString());
      node.setAttribute('rx', (el.width / 2).toString());
      node.setAttribute('ry', (el.height / 2).toString());
    } else {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      node.setAttribute('x1', el.x.toString());
      node.setAttribute('y1', el.y.toString());
      node.setAttribute('x2', (el.x2 ?? el.x + el.width).toString());
      node.setAttribute('y2', (el.y2 ?? el.y + el.height).toString());
    }

    node.setAttribute('class', `collaborative-shape-item${this.selectedElementId === el.id ? ' is-selected' : ''}`);
    node.setAttribute('data-element-id', el.id);
    node.setAttribute('stroke', el.strokeColor || '#000000');
    node.setAttribute('stroke-width', (el.strokeWidth || 2).toString());
    node.setAttribute('fill', el.fillColor && el.fillColor !== 'transparent' ? el.fillColor : 'transparent');
    node.style.pointerEvents = 'auto';

    node.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(el.id);
    });

    this.makeSvgDraggable(node, el);
    return node;
  }

  private makeDraggable(element: HTMLElement, item: ElementText): void {
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (this.activeTool !== 'select') return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const nextX = Math.max(0, Math.min(595 - 40, initialX + dx));
      const nextY = Math.max(0, Math.min(842 - 20, initialY + dy));
      element.style.left = `${nextX}px`;
      element.style.top = `${nextY}px`;
      item.x = nextX;
      item.y = nextY;
      this.setModified(true);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    element.addEventListener('mousedown', (e) => {
      if (this.activeTool !== 'select') return;
      if (document.activeElement === element) return;
      startX = e.clientX;
      startY = e.clientY;
      initialX = item.x;
      initialY = item.y;
      this.pushUndo();
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  private makeSvgDraggable(node: SVGElement, item: ElementShape): void {
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (this.activeTool !== 'select') return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const nextX = Math.max(0, Math.min(595 - item.width, initialX + dx));
      const nextY = Math.max(0, Math.min(842 - item.height, initialY + dy));

      item.x = nextX;
      item.y = nextY;

      if (item.shapeType === 'rect') {
        node.setAttribute('x', nextX.toString());
        node.setAttribute('y', nextY.toString());
      } else if (item.shapeType === 'circle') {
        node.setAttribute('cx', (nextX + item.width / 2).toString());
        node.setAttribute('cy', (nextY + item.height / 2).toString());
      } else if (item.shapeType === 'line') {
        const dx2 = (item.x2 ?? 0) - initialX;
        const dy2 = (item.y2 ?? 0) - initialY;
        item.x2 = nextX + dx2;
        item.y2 = nextY + dy2;
        node.setAttribute('x1', nextX.toString());
        node.setAttribute('y1', nextY.toString());
        node.setAttribute('x2', (item.x2 || nextX).toString());
        node.setAttribute('y2', (item.y2 || nextY).toString());
      }
      this.setModified(true);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    node.addEventListener('mousedown', (e) => {
      if (this.activeTool !== 'select') return;
      startX = e.clientX;
      startY = e.clientY;
      initialX = item.x;
      initialY = item.y;
      this.pushUndo();
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  private selectElement(id: string | null): void {
    this.selectedElementId = id;
    this.updateSelection();
  }

  private updateSelection(): void {
    const deleteBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-delete-element"]');
    if (deleteBtn) {
      if (this.selectedElementId) {
        showElement(deleteBtn);
      } else {
        hideElement(deleteBtn);
      }
    }

    const textElements = this.container.querySelectorAll('.collaborative-text-box');
    textElements.forEach((el) => {
      const elId = el.getAttribute('data-element-id');
      el.classList.toggle('is-selected', elId === this.selectedElementId);
    });

    const shapeElements = this.container.querySelectorAll('.collaborative-shape-item');
    shapeElements.forEach((el) => {
      const elId = el.getAttribute('data-element-id');
      el.classList.toggle('is-selected', elId === this.selectedElementId);
    });
  }

  private deleteSelectedElement(): void {
    if (!this.selectedElementId) return;
    this.pushUndo();
    this.elements = this.elements.filter((el) => el.id !== this.selectedElementId);
    this.selectedElementId = null;
    this.renderPages();
    this.setModified(true);
  }

  private updatePageInfo(): void {
    const info = this.container.querySelector<HTMLElement>('[data-ref="txt-page-info"]');
    if (info) {
      info.textContent = `${this.pageCount} ${this.pageCount === 1 ? 'página' : 'páginas'}`;
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController || {};

    const backBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-back-dashboard"]');
    backBtn?.addEventListener('click', () => {
      if (this.isModified) {
        if (!window.confirm('Tienes cambios sin guardar. ¿Deseas salir a Mis PDFs?')) return;
      }
      navigate('/collaborative-pdf');
    }, { signal });

    const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
    titleInput?.addEventListener('input', () => {
      this.docTitle = titleInput.value.trim() || 'Documento sin título';
      this.setModified(true);
    }, { signal });

    const undoBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    undoBtn?.addEventListener('click', () => {
      if (this.undoStack.length === 0) return;
      const prev = this.undoStack.pop();
      if (prev) {
        this.redoStack.push(JSON.parse(JSON.stringify(this.elements)));
        this.elements = prev;
        this.renderPages();
        this.updateUndoRedoBtns();
        this.setModified(true);
      }
    }, { signal });

    const redoBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    redoBtn?.addEventListener('click', () => {
      if (this.redoStack.length === 0) return;
      const next = this.redoStack.pop();
      if (next) {
        this.undoStack.push(JSON.parse(JSON.stringify(this.elements)));
        this.elements = next;
        this.renderPages();
        this.updateUndoRedoBtns();
        this.setModified(true);
      }
    }, { signal });

    const shareBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-link"]');
    shareBtn?.addEventListener('click', () => {
      const url = `${window.location.origin}/collaborative-pdf/editor?id=${encodeURIComponent(this.docId)}`;
      void navigator.clipboard.writeText(url).then(() => {
        showToast('Enlace de colaboración copiado al portapapeles', 'info');
      });
    }, { signal });

    const saveBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-save-server"]');
    saveBtn?.addEventListener('click', async () => {
      await withButtonLoading(saveBtn, async () => {
        await this.saveDocument();
      });
    }, { signal });

    const downloadBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-download-pdf"]');
    downloadBtn?.addEventListener('click', async () => {
      if (this.isModified) {
        await this.saveDocument();
      }
      window.open(API_ROUTES.collaborativeDocs.pdf(this.docId), '_blank');
    }, { signal });

    const addPageBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-add-page"]');
    addPageBtn?.addEventListener('click', () => {
      this.pushUndo();
      this.pageCount++;
      this.renderPages();
      this.setModified(true);
      showToast('Nueva página añadida al lienzo', 'info');
    }, { signal });

    const deleteElementBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-delete-element"]');
    deleteElementBtn?.addEventListener('click', () => {
      this.deleteSelectedElement();
    }, { signal });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || (document.activeElement as HTMLElement)?.isContentEditable) return;
        if (this.selectedElementId) {
          e.preventDefault();
          this.deleteSelectedElement();
        }
      }
    }, { signal });

    const toolBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="tool-"]');
    toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        toolBtns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const tool = btn.getAttribute('data-tool') as any;
        this.activeTool = tool || 'select';
      }, { signal });
    });

    const strokeInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-stroke-color"]');
    const strokePreview = this.container.querySelector<HTMLElement>('[data-ref="preview-stroke-color"]');
    strokeInput?.addEventListener('input', () => {
      this.strokeColor = strokeInput.value;
      if (strokePreview) strokePreview.style.backgroundColor = this.strokeColor;
    }, { signal });

    const fillInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-fill-color"]');
    const fillPreview = this.container.querySelector<HTMLElement>('[data-ref="preview-fill-color"]');
    fillInput?.addEventListener('input', () => {
      this.fillColor = fillInput.value;
      if (fillPreview) fillPreview.style.backgroundColor = this.fillColor;
    }, { signal });

    const boldBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-bold"]');
    boldBtn?.addEventListener('click', () => {
      this.isBold = !this.isBold;
      boldBtn.classList.toggle('is-active', this.isBold);
    }, { signal });

    const workspace = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
    workspace?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('collaborative-workspace') || target.classList.contains('collaborative-pages-container')) {
        this.selectElement(null);
      }
    }, { signal });

    this.bindCanvasInteraction();
  }

  private bindCanvasInteraction(): void {
    const pagesContainer = this.container.querySelector<HTMLElement>('[data-ref="pages-container"]');
    if (!pagesContainer) return;

    pagesContainer.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      const sheet = target.closest<HTMLElement>('.collaborative-page-sheet');
      if (!sheet) return;

      const pageIndex = parseInt(sheet.getAttribute('data-page-index') || '0', 10);
      const rect = sheet.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);

      if (this.activeTool === 'text') {
        this.pushUndo();
        const newEl: ElementText = {
          color: this.strokeColor,
          fontSize: 16,
          id: `text_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          isBold: this.isBold,
          pageIndex,
          text: 'Escribe tu texto aquí',
          type: 'text',
          x: Math.max(10, Math.min(500, x)),
          y: Math.max(10, Math.min(800, y)),
        };
        this.elements.push(newEl);
        this.renderPages();
        this.selectElement(newEl.id);
        this.activeTool = 'select';
        this.updateActiveToolBtn('select');
      } else if (this.activeTool === 'rect' || this.activeTool === 'circle' || this.activeTool === 'line') {
        this.pushUndo();
        const newShape: ElementShape = {
          fillColor: this.fillColor,
          height: this.activeTool === 'line' ? 0 : 80,
          id: `shape_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          pageIndex,
          shapeType: this.activeTool,
          strokeColor: this.strokeColor,
          strokeWidth: this.strokeWidth,
          type: 'shape',
          width: this.activeTool === 'line' ? 120 : 120,
          x: Math.max(10, Math.min(450, x)),
          x2: this.activeTool === 'line' ? Math.max(10, Math.min(450, x)) + 120 : undefined,
          y: Math.max(10, Math.min(750, y)),
          y2: this.activeTool === 'line' ? Math.max(10, Math.min(750, y)) : undefined,
        };
        this.elements.push(newShape);
        this.renderPages();
        this.selectElement(newShape.id);
        this.activeTool = 'select';
        this.updateActiveToolBtn('select');
      } else if (this.activeTool === 'draw') {
        this.isDrawing = true;
        this.currentDrawing = {
          color: this.strokeColor,
          id: `draw_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          pageIndex,
          points: [{ x, y }],
          type: 'drawing',
          width: this.strokeWidth,
        };
      }
    });

    pagesContainer.addEventListener('mousemove', (e) => {
      if (!this.isDrawing || !this.currentDrawing || this.activeTool !== 'draw') return;
      const sheet = this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-${this.currentDrawing.pageIndex}"]`);
      if (!sheet) return;

      const rect = sheet.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);

      this.currentDrawing.points.push({ x, y });
      const canvas = sheet.querySelector<HTMLCanvasElement>('.collaborative-drawing-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx && this.currentDrawing.points.length >= 2) {
          const pts = this.currentDrawing.points;
          ctx.beginPath();
          ctx.strokeStyle = this.currentDrawing.color;
          ctx.lineWidth = this.currentDrawing.width;
          ctx.lineCap = 'round';
          ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
          ctx.stroke();
        }
      }
    });

    const onMouseUp = () => {
      if (this.isDrawing && this.currentDrawing) {
        this.pushUndo();
        this.elements.push(this.currentDrawing);
        this.isDrawing = false;
        this.currentDrawing = null;
        this.setModified(true);
      }
    };

    window.addEventListener('mouseup', onMouseUp, { signal: this.abortController?.signal });
  }

  private updateActiveToolBtn(tool: string): void {
    const toolBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="tool-"]');
    toolBtns.forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-tool') === tool);
    });
  }

  private async saveDocument(): Promise<void> {
    try {
      const payload = {
        content: {
          elements: this.elements,
          pageCount: this.pageCount,
          pageSize: { height: 842, width: 595 },
        },
        id: this.docId,
        title: this.docTitle,
      };

      const res = await putApi(API_ROUTES.collaborativeDocs.byId(this.docId), payload);
      if (res.ok) {
        this.setModified(false);
        showToast('Documento guardado en el servidor con éxito', 'success');
      } else {
        showToast('No se pudo guardar el documento en el servidor.', 'error');
      }
    } catch {
      showToast('Error de red al guardar documento.', 'error');
    }
  }
}

export async function createCollaborativePdfEditorView(docId?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/collaborative-pdf/collaborative-pdf-editor.html');
  const controller = new CollaborativePdfEditorController(container, docId);
  await controller.init();
  return container;
}
