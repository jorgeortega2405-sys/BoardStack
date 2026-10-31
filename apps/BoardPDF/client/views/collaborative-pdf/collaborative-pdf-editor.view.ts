import { API_ROUTES } from '../../config/api-routes.js';
import { getApi, putApi } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
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
  private activePanelTab: 'elements' | 'text' | 'tools' | 'uploads' | null = null;
  private activeTool: 'circle' | 'draw' | 'line' | 'rect' | 'select' | 'text' = 'select';
  private container: HTMLElement;
  private docId = '';
  private docTitle = 'Documento sin título';
  private elements: EditorElement[] = [];
  private isModified = false;
  private pageCount = 1;
  private selectedElementId: string | null = null;

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

    this.setupRailNavigation();
    await this.loadDocument();
    this.renderPages();
    this.bindEvents();
    renderIcons(this.container);
  }

  destroy(): void {
    this.teardownRailNavigation();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private setupRailNavigation(): void {
    const defaultCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-default"]');
    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');

    if (defaultCenter) {
      defaultCenter.style.display = 'none';
    }
    if (collabCenter) {
      collabCenter.style.display = 'flex';
      collabCenter.style.flexDirection = 'column';
      renderIcons(collabCenter);
    }
  }

  private teardownRailNavigation(): void {
    const defaultCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-default"]');
    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');

    if (defaultCenter) {
      defaultCenter.style.display = '';
    }
    if (collabCenter) {
      collabCenter.style.display = 'none';
      const btns = collabCenter.querySelectorAll('.rail-btn');
      btns.forEach((b) => b.classList.remove('is-active'));
    }
  }

  private handleRailTabClick(tab: 'elements' | 'text' | 'tools' | 'uploads'): void {
    const sidePanel = this.container.querySelector<HTMLElement>('[data-ref="collaborative-side-panel"]');
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="side-panel-title"]');
    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');

    if (this.activePanelTab === tab && sidePanel && !sidePanel.classList.contains('is-hidden')) {
      this.closeSidePanel();
      return;
    }

    this.activePanelTab = tab;
    if (sidePanel) {
      showElement(sidePanel);
    }

    const titles: Record<string, string> = {
      elements: 'Elementos',
      text: 'Escribir',
      tools: 'Herramientas',
      uploads: 'Subidos',
    };

    if (titleEl) {
      titleEl.textContent = titles[tab] || '';
    }

    const sections = this.container.querySelectorAll<HTMLElement>('.collaborative-panel-section');
    sections.forEach((sec) => {
      const secRef = sec.getAttribute('data-ref');
      if (secRef === `panel-section-${tab}`) {
        showElement(sec);
      } else {
        hideElement(sec);
      }
    });

    if (collabCenter) {
      const btns = collabCenter.querySelectorAll<HTMLElement>('[data-panel-tab]');
      btns.forEach((btn) => {
        const btnTab = btn.getAttribute('data-panel-tab');
        btn.classList.toggle('is-active', btnTab === tab);
      });
    }
    renderIcons(this.container);
  }

  private closeSidePanel(): void {
    const sidePanel = this.container.querySelector<HTMLElement>('[data-ref="collaborative-side-panel"]');
    if (sidePanel) {
      hideElement(sidePanel);
    }
    this.activePanelTab = null;

    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');
    if (collabCenter) {
      const btns = collabCenter.querySelectorAll('.rail-btn');
      btns.forEach((b) => b.classList.remove('is-active'));
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
    this.setModified(false);
  }

  private setModified(val: boolean): void {
    this.isModified = val;
    const cloudBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cloud-status"]');
    if (cloudBtn) {
      if (val) {
        cloudBtn.classList.add('btn-cloud-status--dirty');
        cloudBtn.setAttribute('data-tooltip', 'Cambios sin guardar - Haz clic para guardar');
        cloudBtn.setAttribute('aria-label', 'Guardar cambios pendientes');
      } else {
        cloudBtn.classList.remove('btn-cloud-status--dirty');
        cloudBtn.setAttribute('data-tooltip', 'Guardado en el servidor');
        cloudBtn.setAttribute('aria-label', 'Documento guardado');
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
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  private selectElement(id: string | null): void {
    this.selectedElementId = id;
    this.updateSelection();
  }

  private updateSelection(): void {
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
    this.elements = this.elements.filter((el) => el.id !== this.selectedElementId);
    this.selectedElementId = null;
    this.renderPages();
    this.setModified(true);
  }

  private bindEvents(): void {
    const { signal } = this.abortController || {};

    const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
    titleInput?.addEventListener('input', () => {
      this.docTitle = titleInput.value.trim() || 'Documento sin título';
      this.setModified(true);
    }, { signal });

    const cloudBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cloud-status"]');
    cloudBtn?.addEventListener('click', async () => {
      await withButtonLoading(cloudBtn, async () => {
        await this.saveDocument();
      });
    }, { signal });

    const shareBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-link"]');
    shareBtn?.addEventListener('click', () => {
      const url = `${window.location.origin}/collaborative-pdf/editor?id=${encodeURIComponent(this.docId)}`;
      void navigator.clipboard.writeText(url).then(() => {
        showToast('Enlace de colaboración copiado al portapapeles', 'info');
      });
    }, { signal });

    const closeSidePanelBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-side-panel"]');
    closeSidePanelBtn?.addEventListener('click', () => {
      this.closeSidePanel();
    }, { signal });

    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');
    if (collabCenter) {
      const tabBtns = collabCenter.querySelectorAll<HTMLElement>('[data-panel-tab]');
      tabBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const tab = btn.getAttribute('data-panel-tab') as any;
          if (tab) {
            this.handleRailTabClick(tab);
          }
        }, { signal });
      });
    }

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

    const workspace = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
    workspace?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('collaborative-workspace') || target.classList.contains('collaborative-pages-container')) {
        this.selectElement(null);
      }
    }, { signal });
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
