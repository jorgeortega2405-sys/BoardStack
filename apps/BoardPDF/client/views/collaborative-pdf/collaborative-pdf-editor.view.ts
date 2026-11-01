import { API_ROUTES } from '../../config/api-routes.js';
import { getApi, postFormApi, putApi } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { renderPdfThumbnail } from '../../services/pdf-preview.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';
import { hideElement, showElement, withButtonLoading } from '../../utils/dom.util.js';

interface ElementText {
  backgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize: number;
  height?: number;
  id: string;
  isBold?: boolean;
  isStickyNote?: boolean;
  pageIndex: number;
  rotation?: number;
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
  rotation?: number;
  shapeType: 'arrow' | 'circle' | 'diamond' | 'line' | 'line-flexible' | 'line-multiconnect' | 'rect' | 'star' | 'triangle';
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
  opacity?: number;
  pageIndex: number;
  points: Array<{ x: number; y: number }>;
  type: 'drawing';
  width: number;
}

interface ElementImage {
  height: number;
  id: string;
  name?: string;
  pageIndex: number;
  rotation?: number;
  type: 'image';
  url: string;
  width: number;
  x: number;
  y: number;
}

type EditorElement = ElementDrawing | ElementImage | ElementShape | ElementText;

interface PagePdfSource {
  pageNumber: number;
  pdfUrl: string;
}

interface UploadedAsset {
  createdAt?: string;
  id: string;
  mimeType?: string;
  name: string;
  pageCount?: number;
  size: number;
  type: 'image' | 'pdf';
  url: string;
}

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

export class CollaborativePdfEditorController implements ViewController {
  private abortController: AbortController | null = null;
  private activePageIndex = 0;
  private activePanelTab: 'elements' | 'text' | 'tools' | 'uploads' | null = null;
  private activeTool: 'draw' | 'lines' | 'select' | 'shapes' | 'stickynotes' | 'text' = 'select';
  private activeUploadFilter: 'all' | 'images' | 'pdfs' = 'all';
  private container: HTMLElement;
  private docId = '';
  private docTitle = 'Documento sin título';
  private drawColor = '#000000';
  private drawMode: 'eraser' | 'highlighter' | 'marker' | 'pen' = 'pen';
  private drawThickness = 2;
  private elements: EditorElement[] = [];
  private isModified = false;
  private lockedPages = new Set<number>();
  private pageBackgrounds: string[] = [];
  private pageCount = 1;
  private pagePdfSources: Array<PagePdfSource | null> = [];
  private pageTitles: string[] = [];
  private selectedElementId: string | null = null;
  private selectedPageIndex: number | null = null;
  private selectedPdfAsset: UploadedAsset | null = null;
  private uploadedAssets: UploadedAsset[] = [];

  constructor(container: HTMLElement, docId?: string) {
    this.container = container;
    this.docId = docId || '';
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();

    if (!this.docId) {
      const urlParams = new URLSearchParams(window.location.search);
      this.docId = urlParams.get('id') || `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      window.history.replaceState({}, '', `/collaborative-pdf/editor?id=${encodeURIComponent(this.docId)}`);
    }

    this.setupRailNavigation();
    await this.loadDocument();
    this.renderPages();
    this.bindEvents();
    void this.loadUploadedAssets();
    this.handleRailTabClick('tools');
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
    const toolsToolbar = this.container.querySelector<HTMLElement>('[data-ref="collaborative-tools-toolbar"]');
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="side-panel-title"]');
    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');

    if (tab === 'tools') {
      if (sidePanel) {
        hideElement(sidePanel);
      }

      const isToolbarVisible = toolsToolbar && !toolsToolbar.classList.contains('is-hidden');
      if (this.activePanelTab === 'tools' && isToolbarVisible) {
        if (toolsToolbar) {
          hideElement(toolsToolbar);
        }
        this.closeSubtoolbars();
        this.activePanelTab = null;
        if (collabCenter) {
          const btns = collabCenter.querySelectorAll('.rail-btn');
          btns.forEach((b) => b.classList.remove('is-active'));
        }
        return;
      }

      this.activePanelTab = 'tools';
      if (toolsToolbar) {
        showElement(toolsToolbar);
      }

      if (collabCenter) {
        const btns = collabCenter.querySelectorAll<HTMLElement>('[data-panel-tab]');
        btns.forEach((btn) => {
          const btnTab = btn.getAttribute('data-panel-tab');
          btn.classList.toggle('is-active', btnTab === 'tools');
        });
      }
      renderIcons(this.container);
      return;
    }

    if (toolsToolbar) {
      hideElement(toolsToolbar);
    }
    this.closeSubtoolbars();

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

  private openSubtoolbar(toolName: string): void {
    const flyout = this.container.querySelector<HTMLElement>('[data-ref="collaborative-subtoolbar-flyout"]');
    if (!flyout) return;

    const subtoolbars = flyout.querySelectorAll<HTMLElement>('.collaborative-subtoolbar');
    let found = false;

    subtoolbars.forEach((sub) => {
      if (sub.getAttribute('data-ref') === `subtoolbar-${toolName}`) {
        showElement(sub);
        found = true;
      } else {
        hideElement(sub);
      }
    });

    if (found) {
      showElement(flyout);
      renderIcons(flyout);
    } else {
      hideElement(flyout);
    }
  }

  private closeSubtoolbars(): void {
    const flyout = this.container.querySelector<HTMLElement>('[data-ref="collaborative-subtoolbar-flyout"]');
    if (flyout) {
      hideElement(flyout);
      const subtoolbars = flyout.querySelectorAll<HTMLElement>('.collaborative-subtoolbar');
      subtoolbars.forEach((s) => hideElement(s));
    }
  }

  private activateSelectTool(): void {
    this.activeTool = 'select';
    const toolbarButtons = this.container.querySelectorAll<HTMLButtonElement>('.collaborative-toolbar-btn');
    toolbarButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-tool') === 'select');
    });
    this.closeSubtoolbars();
  }

  private addTextElement(preset: 'body' | 'subtitle' | 'title'): void {
    const id = `txt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    let text = 'Texto';
    let fontSize = 16;
    let isBold = false;
    let color = '#333333';
    let yOffset = 180;
    let width = 200;
    let height = 36;

    if (preset === 'title') {
      text = 'Título';
      fontSize = 32;
      isBold = true;
      color = '#000000';
      yOffset = 120;
      width = 300;
      height = 54;
    } else if (preset === 'subtitle') {
      text = 'Subtítulo';
      fontSize = 22;
      isBold = true;
      color = '#1f2937';
      yOffset = 160;
      width = 250;
      height = 42;
    }

    const newElement: ElementText = {
      color,
      fontSize,
      height,
      id,
      isBold,
      pageIndex: this.activePageIndex,
      rotation: 0,
      text,
      type: 'text',
      width,
      x: 100,
      y: yOffset + (this.elements.length % 6) * 32,
    };

    this.elements.push(newElement);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
    this.setModified(true);

    const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
    elNode?.focus();
  }

  private addShapeElement(shapeType: ElementShape['shapeType']): void {
    const id = `shape_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    let width = 140;
    let height = 100;
    let fillColor = '#4f46e5';
    let strokeColor = 'transparent';
    let strokeWidth = 0;

    if (shapeType === 'rect') {
      width = 160;
      height = 100;
    } else if (shapeType === 'circle') {
      width = 120;
      height = 120;
    } else if (shapeType === 'triangle') {
      width = 130;
      height = 120;
    } else if (shapeType === 'diamond') {
      width = 120;
      height = 120;
    } else if (shapeType === 'arrow') {
      width = 160;
      height = 46;
      strokeColor = '#4f46e5';
      strokeWidth = 4;
    } else if (shapeType === 'star') {
      width = 120;
      height = 120;
      fillColor = '#facc15';
    }

    const newShape: ElementShape = {
      fillColor,
      height,
      id,
      pageIndex: this.activePageIndex,
      rotation: 0,
      shapeType,
      strokeColor,
      strokeWidth,
      type: 'shape',
      width,
      x: 140 + (this.elements.length % 5) * 25,
      y: 180 + (this.elements.length % 5) * 25,
    };

    this.elements.push(newShape);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
    this.setModified(true);
  }

  private addLineElement(lineType: 'flexible' | 'multiconnect' | 'straight'): void {
    const id = `line_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const x1 = 120 + (this.elements.length % 4) * 30;
    const y1 = 200 + (this.elements.length % 4) * 30;
    const x2 = x1 + 180;
    const y2 = lineType === 'straight' ? y1 : y1 + 90;

    const shapeType: ElementShape['shapeType'] =
      lineType === 'flexible' ? 'line-flexible' :
      lineType === 'multiconnect' ? 'line-multiconnect' : 'line';

    const newLine: ElementShape = {
      fillColor: 'transparent',
      height: Math.abs(y2 - y1) || 20,
      id,
      pageIndex: this.activePageIndex,
      rotation: 0,
      shapeType,
      strokeColor: '#000000',
      strokeWidth: 3,
      type: 'shape',
      width: Math.abs(x2 - x1) || 180,
      x: x1,
      x2,
      y: y1,
      y2,
    };

    this.elements.push(newLine);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
    this.setModified(true);
  }

  private addStickyNoteElement(color: string): void {
    const id = `sticky_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newSticky: ElementText = {
      backgroundColor: color,
      color: '#1e293b',
      fontSize: 15,
      height: 140,
      id,
      isStickyNote: true,
      pageIndex: this.activePageIndex,
      rotation: 0,
      text: 'Nota adhesiva',
      type: 'text',
      width: 140,
      x: 100 + (this.elements.length % 5) * 30,
      y: 150 + (this.elements.length % 5) * 30,
    };

    this.elements.push(newSticky);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
    this.setModified(true);

    const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
    elNode?.focus();
  }

  private addPage(afterIndex?: number): void {
    const targetIndex = afterIndex !== undefined ? afterIndex + 1 : this.pageCount;
    this.elements.forEach((el) => {
      if ((el.pageIndex ?? 0) >= targetIndex) {
        el.pageIndex = (el.pageIndex ?? 0) + 1;
      }
    });

    this.pageTitles.splice(targetIndex, 0, '');
    this.pageBackgrounds.splice(targetIndex, 0, '#ffffff');
    this.pagePdfSources.splice(targetIndex, 0, null);
    this.pageCount++;
    this.activePageIndex = targetIndex;
    this.renderPages();
    this.selectPage(targetIndex);
    this.setModified(true);
    showToast(`Página ${targetIndex + 1} añadida`, 'success');
  }

  private togglePageLock(pageIndex: number): void {
    if (this.lockedPages.has(pageIndex)) {
      this.lockedPages.delete(pageIndex);
      showToast(`Página ${pageIndex + 1} desbloqueada`, 'info');
    } else {
      this.lockedPages.add(pageIndex);
      showToast(`Página ${pageIndex + 1} bloqueada`, 'info');
    }
    this.renderPages();
  }

  private duplicatePage(pageIndex: number): void {
    const targetIndex = pageIndex + 1;
    this.elements.forEach((el) => {
      if ((el.pageIndex ?? 0) >= targetIndex) {
        el.pageIndex = (el.pageIndex ?? 0) + 1;
      }
    });

    const pageElements = this.elements.filter((el) => (el.pageIndex ?? 0) === pageIndex);
    for (const el of pageElements) {
      const clone = JSON.parse(JSON.stringify(el));
      clone.id = `${clone.type}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      clone.pageIndex = targetIndex;
      this.elements.push(clone);
    }

    this.pageTitles.splice(targetIndex, 0, this.pageTitles[pageIndex] ? `${this.pageTitles[pageIndex]} (Copia)` : '');
    this.pageBackgrounds.splice(targetIndex, 0, this.pageBackgrounds[pageIndex] || '#ffffff');
    const sourcePdf = this.pagePdfSources[pageIndex];
    this.pagePdfSources.splice(targetIndex, 0, sourcePdf ? { ...sourcePdf } : null);
    this.pageCount++;
    this.activePageIndex = targetIndex;
    this.renderPages();
    this.selectPage(targetIndex);
    this.setModified(true);
    showToast(`Página ${targetIndex + 1} duplicada`, 'success');
  }

  private deletePage(pageIndex: number): void {
    if (this.pageCount <= 1) {
      showToast('El documento debe tener al menos una página', 'info');
      return;
    }

    this.elements = this.elements.filter((el) => (el.pageIndex ?? 0) !== pageIndex);
    this.elements.forEach((el) => {
      if ((el.pageIndex ?? 0) > pageIndex) {
        el.pageIndex = (el.pageIndex ?? 0) - 1;
      }
    });

    this.pageTitles.splice(pageIndex, 1);
    this.pageBackgrounds.splice(pageIndex, 1);
    this.pagePdfSources.splice(pageIndex, 1);
    this.pageCount--;
    this.activePageIndex = Math.max(0, Math.min(this.pageCount - 1, pageIndex));
    this.renderPages();
    this.selectPage(this.activePageIndex);
    this.setModified(true);
    showToast('Página eliminada', 'info');
  }

  private movePageUp(pageIndex: number): void {
    if (pageIndex <= 0) return;
    const prev = pageIndex - 1;

    this.elements.forEach((el) => {
      if ((el.pageIndex ?? 0) === pageIndex) {
        el.pageIndex = prev;
      } else if ((el.pageIndex ?? 0) === prev) {
        el.pageIndex = pageIndex;
      }
    });

    const tmpTitle = this.pageTitles[pageIndex];
    this.pageTitles[pageIndex] = this.pageTitles[prev];
    this.pageTitles[prev] = tmpTitle;

    const tmpBg = this.pageBackgrounds[pageIndex];
    this.pageBackgrounds[pageIndex] = this.pageBackgrounds[prev];
    this.pageBackgrounds[prev] = tmpBg;

    const tmpPdf = this.pagePdfSources[pageIndex];
    this.pagePdfSources[pageIndex] = this.pagePdfSources[prev];
    this.pagePdfSources[prev] = tmpPdf;

    this.activePageIndex = prev;
    this.renderPages();
    this.selectPage(prev);
    this.setModified(true);
  }

  private movePageDown(pageIndex: number): void {
    if (pageIndex >= this.pageCount - 1) return;
    const next = pageIndex + 1;

    this.elements.forEach((el) => {
      if ((el.pageIndex ?? 0) === pageIndex) {
        el.pageIndex = next;
      } else if ((el.pageIndex ?? 0) === next) {
        el.pageIndex = pageIndex;
      }
    });

    const tmpTitle = this.pageTitles[pageIndex];
    this.pageTitles[pageIndex] = this.pageTitles[next];
    this.pageTitles[next] = tmpTitle;

    const tmpBg = this.pageBackgrounds[pageIndex];
    this.pageBackgrounds[pageIndex] = this.pageBackgrounds[next];
    this.pageBackgrounds[next] = tmpBg;

    const tmpPdf = this.pagePdfSources[pageIndex];
    this.pagePdfSources[pageIndex] = this.pagePdfSources[next];
    this.pagePdfSources[next] = tmpPdf;

    this.activePageIndex = next;
    this.renderPages();
    this.selectPage(next);
    this.setModified(true);
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
          this.pageTitles = Array.isArray(data.document.content?.pageTitles) ? data.document.content.pageTitles : [];
          this.pageBackgrounds = Array.isArray(data.document.content?.pageBackgrounds) ? data.document.content.pageBackgrounds : [];
          this.pagePdfSources = Array.isArray(data.document.content?.pagePdfSources) ? data.document.content.pagePdfSources : [];
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
      const wrapper = document.createElement('div');
      wrapper.className = 'collaborative-page-wrapper';
      wrapper.setAttribute('data-ref', `page-wrapper-${p}`);

      const header = document.createElement('div');
      header.className = 'collaborative-page-header';
      header.setAttribute('data-ref', `page-header-${p}`);

      const left = document.createElement('div');
      left.className = 'collaborative-page-header__left';

      const label = document.createElement('span');
      label.className = 'collaborative-page-header__label';
      label.textContent = `Página ${p + 1}`;

      const sep = document.createElement('span');
      sep.className = 'collaborative-page-header__sep';
      sep.textContent = '-';

      const input = document.createElement('input');
      input.className = 'collaborative-page-header__input';
      input.setAttribute('data-ref', `input-page-title-${p}`);
      input.setAttribute('data-page-index', p.toString());
      input.type = 'text';
      input.placeholder = 'Agregar título de página...';
      input.value = this.pageTitles[p] || '';
      input.addEventListener('input', () => {
        this.pageTitles[p] = input.value;
        this.setModified(true);
      });

      left.appendChild(label);
      left.appendChild(sep);
      left.appendChild(input);

      const actions = document.createElement('div');
      actions.className = 'collaborative-page-header__actions';

      const isFirst = p === 0;
      const isLast = p === this.pageCount - 1;
      const isOnlyOne = this.pageCount <= 1;

      actions.innerHTML = `
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${isFirst ? ' is-disabled' : ''}" data-ref="btn-page-up-${p}" data-page-action="up" data-page-index="${p}" data-tooltip="Subir página" aria-label="Subir página"${isFirst ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#expand_less"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${isLast ? ' is-disabled' : ''}" data-ref="btn-page-down-${p}" data-page-action="down" data-page-index="${p}" data-tooltip="Bajar página" aria-label="Bajar página"${isLast ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn" data-ref="btn-page-lock-${p}" data-page-action="lock" data-page-index="${p}" data-tooltip="Bloquear u ocultar página" aria-label="Bloquear página">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${this.lockedPages.has(p) ? 'lock' : 'visibility_off'}"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn" data-ref="btn-page-dup-${p}" data-page-action="dup" data-page-index="${p}" data-tooltip="Duplicar página" aria-label="Duplicar página">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${isOnlyOne ? ' is-disabled' : ''}" data-ref="btn-page-del-${p}" data-page-action="del" data-page-index="${p}" data-tooltip="Eliminar página" aria-label="Eliminar página"${isOnlyOne ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn" data-ref="btn-page-add-${p}" data-page-action="add" data-page-index="${p}" data-tooltip="Añadir página" aria-label="Añadir página">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#note_add"></use></svg>
        </button>
      `;

      header.appendChild(left);
      header.appendChild(actions);

      const sheet = document.createElement('div');
      sheet.className = `collaborative-page-sheet${this.selectedPageIndex === p ? ' is-page-selected' : ''}${this.lockedPages.has(p) ? ' is-page-locked' : ''}`;
      sheet.setAttribute('data-ref', `page-sheet-${p}`);
      sheet.setAttribute('data-page-index', p.toString());
      if (this.pageBackgrounds[p]) {
        sheet.style.backgroundColor = this.pageBackgrounds[p];
      }

      if (this.pagePdfSources[p] && this.pagePdfSources[p]?.pdfUrl) {
        const bgCanvas = document.createElement('canvas');
        bgCanvas.className = 'collaborative-page-pdf-bg';
        bgCanvas.setAttribute('data-ref', `page-pdf-bg-${p}`);
        sheet.appendChild(bgCanvas);
        void renderPdfThumbnail(this.pagePdfSources[p]!.pdfUrl, bgCanvas, {
          dpr: true,
          pageNum: this.pagePdfSources[p]!.pageNumber,
          targetWidth: PAGE_WIDTH,
        });
      }

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'collaborative-shapes-svg');
      svg.setAttribute('data-ref', `shapes-svg-${p}`);
      svg.setAttribute('viewBox', `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`);

      const canvas = document.createElement('canvas');
      canvas.className = 'collaborative-drawing-canvas';
      canvas.setAttribute('data-ref', `drawing-canvas-${p}`);
      canvas.width = PAGE_WIDTH;
      canvas.height = PAGE_HEIGHT;

      const guidesSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      guidesSvg.setAttribute('class', 'collaborative-guides-svg');
      guidesSvg.setAttribute('data-ref', `guides-svg-${p}`);
      guidesSvg.setAttribute('viewBox', `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`);

      sheet.appendChild(svg);
      sheet.appendChild(canvas);
      sheet.appendChild(guidesSvg);

      const pageElements = this.elements.filter((el) => (el.pageIndex ?? 0) === p);
      for (const el of pageElements) {
        if (el.type === 'text') {
          sheet.appendChild(this.createTextElement(el));
        } else if (el.type === 'shape') {
          if (el.shapeType === 'line' || el.shapeType === 'line-flexible' || el.shapeType === 'line-multiconnect') {
            svg.appendChild(this.createLineSvgElement(el));
          } else {
            sheet.appendChild(this.createShapeElement(el));
          }
        } else if (el.type === 'image') {
          sheet.appendChild(this.createImageElement(el));
        }
      }

      wrapper.appendChild(header);
      wrapper.appendChild(sheet);
      pagesContainer.appendChild(wrapper);

      this.drawFreehandOnCanvas(canvas, p);
      this.bindCanvasDrawing(canvas, p);

      sheet.addEventListener('click', (e) => {
        if (e.target === sheet || e.target === canvas || e.target === svg) {
          this.selectPage(p);
        }
      });
    }

    const footer = document.createElement('div');
    footer.className = 'collaborative-pages-footer';
    footer.setAttribute('data-ref', 'pages-footer');
    footer.innerHTML = `
      <button type="button" class="component-button component-button--ghost collaborative-add-page-btn" data-ref="btn-add-page-bottom">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        <span class="component-button__text">Añadir página</span>
      </button>
    `;
    footer.querySelector('[data-ref="btn-add-page-bottom"]')?.addEventListener('click', () => {
      this.addPage();
    });

    pagesContainer.appendChild(footer);

    this.bindPageHeaderEvents();
    this.updateSelection();
    this.renderTransformBox();
    this.updateContextToolbar();
    renderIcons(this.container);
  }

  private bindPageHeaderEvents(): void {
    const actionBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-page-action]');
    actionBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-page-action');
        const p = parseInt(btn.getAttribute('data-page-index') || '0', 10);
        if (action === 'up') this.movePageUp(p);
        else if (action === 'down') this.movePageDown(p);
        else if (action === 'lock') this.togglePageLock(p);
        else if (action === 'dup') this.duplicatePage(p);
        else if (action === 'del') this.deletePage(p);
        else if (action === 'add') this.addPage(p);
      });
    });
  }

  private bindCanvasDrawing(canvas: HTMLCanvasElement, pageIndex: number): void {
    let isDrawing = false;
    let currentStroke: Array<{ x: number; y: number }> = [];

    const getCanvasPos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    canvas.addEventListener('mousedown', (e) => {
      if (this.activeTool !== 'draw') return;
      isDrawing = true;
      const pos = getCanvasPos(e);

      if (this.drawMode === 'eraser') {
        this.eraseAt(pos.x, pos.y, pageIndex);
        return;
      }

      currentStroke = [pos];
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing || this.activeTool !== 'draw') return;
      const pos = getCanvasPos(e);

      if (this.drawMode === 'eraser') {
        this.eraseAt(pos.x, pos.y, pageIndex);
        return;
      }

      currentStroke.push(pos);
      const ctx = canvas.getContext('2d');
      if (!ctx || currentStroke.length < 2) return;

      const p1 = currentStroke[currentStroke.length - 2];
      const p2 = currentStroke[currentStroke.length - 1];
      ctx.beginPath();
      ctx.strokeStyle = this.drawColor;
      ctx.lineWidth = this.getEffectiveDrawWidth();
      ctx.globalAlpha = this.drawMode === 'highlighter' ? 0.35 : 1.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    });

    const stopDrawing = () => {
      if (!isDrawing) return;
      isDrawing = false;
      if (this.activeTool === 'draw' && this.drawMode !== 'eraser' && currentStroke.length >= 2) {
        const newDrawing: ElementDrawing = {
          color: this.drawColor,
          id: `draw_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
          opacity: this.drawMode === 'highlighter' ? 0.35 : 1.0,
          pageIndex,
          points: currentStroke,
          type: 'drawing',
          width: this.getEffectiveDrawWidth(),
        };
        this.elements.push(newDrawing);
        this.setModified(true);
      }
      currentStroke = [];
    };

    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
  }

  private eraseAt(x: number, y: number, pageIndex: number): void {
    const radius = 24;
    const prevCount = this.elements.length;
    this.elements = this.elements.filter((el) => {
      if (el.type !== 'drawing' || (el.pageIndex ?? 0) !== pageIndex) return true;
      return !el.points.some((pt) => Math.hypot(pt.x - x, pt.y - y) <= radius);
    });
    if (this.elements.length !== prevCount) {
      const canvas = this.container.querySelector<HTMLCanvasElement>(`[data-ref="drawing-canvas-${pageIndex}"]`);
      if (canvas) {
        this.drawFreehandOnCanvas(canvas, pageIndex);
      }
      this.setModified(true);
    }
  }

  private getEffectiveDrawWidth(): number {
    if (this.drawMode === 'marker') return Math.max(6, this.drawThickness * 2.5);
    if (this.drawMode === 'highlighter') return Math.max(16, this.drawThickness * 5);
    return this.drawThickness;
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
      ctx.globalAlpha = d.opacity || 1.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(d.points[0].x, d.points[0].y);
      for (let i = 1; i < d.points.length; i++) {
        ctx.lineTo(d.points[i].x, d.points[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }

  private createTextElement(el: ElementText): HTMLElement {
    const div = document.createElement('div');
    if (el.isStickyNote) {
      div.className = 'collaborative-sticky-note';
      div.style.backgroundColor = el.backgroundColor || '#fef08a';
      div.style.width = `${el.width || 140}px`;
      div.style.height = `${el.height || 140}px`;
    } else {
      div.className = 'collaborative-text-box';
      div.style.width = el.width ? `${el.width}px` : 'auto';
      div.style.height = el.height ? `${el.height}px` : 'auto';
    }

    div.setAttribute('data-ref', `text-element-${el.id}`);
    div.setAttribute('data-element-id', el.id);
    div.style.left = `${el.x}px`;
    div.style.top = `${el.y}px`;
    div.style.fontSize = `${el.fontSize || 16}px`;
    div.style.color = el.color || '#000000';
    div.style.fontWeight = el.isBold ? 'bold' : 'normal';
    div.style.fontFamily = el.fontFamily || 'Helvetica, sans-serif';
    div.style.transform = `rotate(${el.rotation || 0}deg)`;
    div.style.transformOrigin = 'center center';
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

  private createShapeElement(el: ElementShape): HTMLElement {
    const div = document.createElement('div');
    div.className = 'collaborative-shape-item';
    div.setAttribute('data-ref', `shape-element-${el.id}`);
    div.setAttribute('data-element-id', el.id);
    div.style.left = `${el.x}px`;
    div.style.top = `${el.y}px`;
    div.style.width = `${el.width}px`;
    div.style.height = `${el.height}px`;
    div.style.transform = `rotate(${el.rotation || 0}deg)`;
    div.style.transformOrigin = 'center center';

    const fill = el.fillColor && el.fillColor !== 'transparent' ? el.fillColor : '#4f46e5';
    const stroke = el.strokeColor && el.strokeColor !== 'transparent' ? el.strokeColor : 'none';
    const strokeWidth = el.strokeWidth || 0;

    let shapeInner = '';
    if (el.shapeType === 'rect') {
      shapeInner = `<rect x="0" y="0" width="${el.width}" height="${el.height}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    } else if (el.shapeType === 'circle') {
      shapeInner = `<ellipse cx="${el.width / 2}" cy="${el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    } else if (el.shapeType === 'triangle') {
      shapeInner = `<polygon points="${el.width / 2},0 ${el.width},${el.height} 0,${el.height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    } else if (el.shapeType === 'diamond') {
      shapeInner = `<polygon points="${el.width / 2},0 ${el.width},${el.height / 2} ${el.width / 2},${el.height} 0,${el.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    } else if (el.shapeType === 'arrow') {
      const midY = el.height / 2;
      const head = Math.min(24, Math.max(12, el.width / 4));
      shapeInner = `<path d="M 0 ${midY} L ${el.width} ${midY} M ${el.width - head} ${midY - head * 0.6} L ${el.width} ${midY} L ${el.width - head} ${midY + head * 0.6}" fill="${fill}" stroke="${fill}" stroke-width="${Math.max(4, strokeWidth || 4)}" stroke-linecap="round" stroke-linejoin="round" />`;
    } else if (el.shapeType === 'star') {
      const cx = el.width / 2;
      const cy = el.height / 2;
      const rOuter = el.width / 2;
      const rInner = rOuter * 0.42;
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? rOuter : rInner;
        pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      shapeInner = `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }

    div.innerHTML = `<svg viewBox="0 0 ${el.width} ${el.height}" width="100%" height="100%" style="overflow: visible; display: block;">${shapeInner}</svg>`;

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(el.id);
    });

    this.makeDraggable(div, el);
    return div;
  }

  private createLineSvgElement(el: ElementShape): SVGElement {
    let node: SVGElement;
    const x1 = el.x;
    const y1 = el.y;
    const x2 = el.x2 ?? el.x + el.width;
    const y2 = el.y2 ?? el.y + el.height;
    const stroke = el.strokeColor || '#000000';
    const strokeWidth = el.strokeWidth || 3;

    if (el.shapeType === 'line-flexible') {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const cx1 = x1 + (x2 - x1) * 0.25;
      const cy1 = y1 - 40;
      const cx2 = x1 + (x2 - x1) * 0.75;
      const cy2 = y2 + 40;
      node.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
      node.setAttribute('fill', 'none');
      node.setAttribute('stroke-linecap', 'round');
    } else if (el.shapeType === 'line-multiconnect') {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midX = x1 + (x2 - x1) / 2;
      node.setAttribute('d', `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`);
      node.setAttribute('fill', 'none');
      node.setAttribute('stroke-linecap', 'round');
      node.setAttribute('stroke-linejoin', 'round');
    } else {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      node.setAttribute('x1', x1.toString());
      node.setAttribute('y1', y1.toString());
      node.setAttribute('x2', x2.toString());
      node.setAttribute('y2', y2.toString());
      node.setAttribute('stroke-linecap', 'round');
    }

    node.setAttribute('class', 'collaborative-shape-item');
    node.setAttribute('data-element-id', el.id);
    node.setAttribute('stroke', stroke);
    node.setAttribute('stroke-width', strokeWidth.toString());
    node.style.pointerEvents = 'auto';

    node.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(el.id);
    });

    this.makeLineDraggable(node, el);
    return node;
  }

  private createImageElement(el: ElementImage): HTMLElement {
    const div = document.createElement('div');
    div.className = 'collaborative-image-item';
    div.setAttribute('data-ref', `image-element-${el.id}`);
    div.setAttribute('data-element-id', el.id);
    div.style.left = `${el.x}px`;
    div.style.top = `${el.y}px`;
    div.style.width = `${el.width}px`;
    div.style.height = `${el.height}px`;
    div.style.transform = `rotate(${el.rotation || 0}deg)`;
    div.style.transformOrigin = 'center center';

    const img = document.createElement('img');
    img.className = 'collaborative-image-inner';
    img.src = el.url;
    img.alt = el.name || 'Imagen';
    img.draggable = false;
    div.appendChild(img);

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(el.id);
    });

    this.makeDraggable(div, el);
    return div;
  }

  private addImageElement(asset: UploadedAsset): void {
    const id = `img_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const pageIdx = this.selectedPageIndex !== null ? this.selectedPageIndex : this.activePageIndex;
    const newImg: ElementImage = {
      height: 200,
      id,
      name: asset.name,
      pageIndex: pageIdx,
      rotation: 0,
      type: 'image',
      url: asset.url,
      width: 280,
      x: 140 + (this.elements.length % 5) * 20,
      y: 180 + (this.elements.length % 5) * 20,
    };

    this.elements.push(newImg);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
    this.setModified(true);
  }

  private makeDraggable(element: HTMLElement, item: ElementImage | ElementShape | ElementText): void {
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (this.activeTool !== 'select') return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const rawX = initialX + dx;
      const rawY = initialY + dy;

      const snapped = this.applySmartGuides(item, rawX, rawY);

      element.style.left = `${snapped.x}px`;
      element.style.top = `${snapped.y}px`;
      item.x = snapped.x;
      item.y = snapped.y;
      this.updateTransformBoxPosition();
      this.setModified(true);
    };

    const onMouseUp = () => {
      this.clearSmartGuides(item.pageIndex ?? 0);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    element.addEventListener('mousedown', (e) => {
      this.activateSelectTool();
      this.selectElement(item.id);
      if (document.activeElement === element && (element as HTMLElement).isContentEditable) return;
      startX = e.clientX;
      startY = e.clientY;
      initialX = item.x;
      initialY = item.y;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  private makeLineDraggable(node: SVGElement, item: ElementShape): void {
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (this.activeTool !== 'select') return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      node.setAttribute('transform', `translate(${dx}, ${dy})`);
    };

    const onMouseUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      node.removeAttribute('transform');

      item.x = initialX + dx;
      item.y = initialY + dy;
      if (item.x2 !== undefined) item.x2 += dx;
      if (item.y2 !== undefined) item.y2 += dy;

      this.renderPages();
      this.setModified(true);
    };

    node.addEventListener('mousedown', (e) => {
      this.activateSelectTool();
      this.selectElement(item.id);
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
    this.selectedPageIndex = null;
    const pageSheets = this.container.querySelectorAll('.collaborative-page-sheet');
    pageSheets.forEach((s) => s.classList.remove('is-page-selected'));

    if (id) {
      const el = this.elements.find((e) => e.id === id);
      if (el) {
        this.activePageIndex = el.pageIndex ?? 0;
      }
    }

    this.updateSelection();
    this.renderTransformBox();
    this.updateContextToolbar();
  }

  private selectPage(pageIndex: number | null): void {
    this.selectedElementId = null;
    this.removeTransformBox();
    this.selectedPageIndex = pageIndex;

    const pageSheets = this.container.querySelectorAll('.collaborative-page-sheet');
    pageSheets.forEach((s) => {
      const p = parseInt(s.getAttribute('data-page-index') || '-1', 10);
      s.classList.toggle('is-page-selected', p === pageIndex);
    });

    if (pageIndex !== null) {
      this.activePageIndex = pageIndex;
    }

    this.updateSelection();
    this.updateContextToolbar();
  }

  private updateSelection(): void {
    const allEls = this.container.querySelectorAll('.collaborative-text-box, .collaborative-shape-item, .collaborative-sticky-note');
    allEls.forEach((el) => {
      const elId = el.getAttribute('data-element-id');
      el.classList.toggle('is-selected', elId === this.selectedElementId);
    });
  }

  private renderTransformBox(): void {
    this.removeTransformBox();
    if (!this.selectedElementId) return;

    const el = this.elements.find((e) => e.id === this.selectedElementId);
    if (!el || el.type === 'drawing') return;

    const sheet = this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-${el.pageIndex ?? 0}"]`);
    if (!sheet) return;

    const box = document.createElement('div');
    box.className = 'collaborative-transform-box';
    box.setAttribute('data-ref', 'transform-box');

    box.innerHTML = `
      <div class="collaborative-transform-stem"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--rot" data-handle="rot" data-tooltip="Girar" aria-label="Girar"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--nw" data-handle="nw"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--ne" data-handle="ne"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--se" data-handle="se"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--sw" data-handle="sw"></div>
    `;

    sheet.appendChild(box);
    this.updateTransformBoxPosition();
    this.bindTransformHandles(box, el);
  }

  private removeTransformBox(): void {
    const existing = this.container.querySelector('[data-ref="transform-box"]');
    existing?.remove();
  }

  private updateTransformBoxPosition(): void {
    const box = this.container.querySelector<HTMLElement>('[data-ref="transform-box"]');
    if (!box || !this.selectedElementId) return;

    const el = this.elements.find((e) => e.id === this.selectedElementId);
    if (!el || el.type === 'drawing') return;

    const width = el.width || 100;
    const height = el.height || 40;

    box.style.left = `${el.x}px`;
    box.style.top = `${el.y}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.transform = `rotate(${el.rotation || 0}deg)`;
    box.style.transformOrigin = 'center center';
  }

  private bindTransformHandles(box: HTMLElement, el: ElementImage | ElementShape | ElementText): void {
    const handles = box.querySelectorAll<HTMLElement>('.collaborative-transform-handle');
    handles.forEach((handle) => {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const type = handle.getAttribute('data-handle');
        if (type === 'rot') {
          this.startRotating(e, el);
        } else if (type) {
          this.startResizing(e, el, type);
        }
      });
    });
  }

  private startRotating(e: MouseEvent, el: ElementImage | ElementShape | ElementText): void {
    const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
    if (!elNode) return;

    const rect = elNode.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const onMouseMove = (ev: MouseEvent) => {
      const rad = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
      const deg = Math.round((rad * 180) / Math.PI + 90);
      el.rotation = ((deg % 360) + 360) % 360;

      elNode.style.transform = `rotate(${el.rotation}deg)`;
      this.updateTransformBoxPosition();
      this.setModified(true);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private startResizing(e: MouseEvent, el: ElementImage | ElementShape | ElementText, handleType: string): void {
    const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
    if (!elNode) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialW = el.width || 100;
    const initialH = el.height || 40;
    const initialX = el.x;
    const initialY = el.y;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (handleType === 'se') {
        el.width = Math.max(30, initialW + dx);
        el.height = Math.max(20, initialH + dy);
      } else if (handleType === 'ne') {
        el.width = Math.max(30, initialW + dx);
        const nextH = Math.max(20, initialH - dy);
        el.y = initialY + (initialH - nextH);
        el.height = nextH;
      } else if (handleType === 'sw') {
        const nextW = Math.max(30, initialW - dx);
        el.x = initialX + (initialW - nextW);
        el.width = nextW;
        el.height = Math.max(20, initialH + dy);
      } else if (handleType === 'nw') {
        const nextW = Math.max(30, initialW - dx);
        const nextH = Math.max(20, initialH - dy);
        el.x = initialX + (initialW - nextW);
        el.y = initialY + (initialH - nextH);
        el.width = nextW;
        el.height = nextH;
      }

      elNode.style.left = `${el.x}px`;
      elNode.style.top = `${el.y}px`;
      elNode.style.width = `${el.width}px`;
      elNode.style.height = `${el.height}px`;

      const svgNode = elNode.querySelector('svg');
      if (svgNode) {
        svgNode.setAttribute('viewBox', `0 0 ${el.width} ${el.height}`);
      }

      const otherElements = this.elements.filter(
        (e): e is ElementImage | ElementShape | ElementText =>
          e.id !== el.id && (e.pageIndex ?? 0) === (el.pageIndex ?? 0) && e.type !== 'drawing'
      );
      this.renderActiveSmartGuides(el, el.pageIndex ?? 0, el.x, el.y, el.width ?? 100, el.height ?? 40, otherElements);

      this.updateTransformBoxPosition();
      this.setModified(true);
    };

    const onMouseUp = () => {
      this.clearSmartGuides(el.pageIndex ?? 0);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.renderPages();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private applySmartGuides(
    item: { height?: number; id: string; pageIndex?: number; width?: number },
    rawX: number,
    rawY: number
  ): { x: number; y: number } {
    const pageIndex = item.pageIndex ?? 0;
    const width = item.width || 100;
    const height = item.height || 40;
    const threshold = 6;

    const otherElements = this.elements.filter(
      (el): el is ElementImage | ElementShape | ElementText =>
        el.id !== item.id && (el.pageIndex ?? 0) === pageIndex && el.type !== 'drawing'
    );

    let bestDiffX: number | null = null;
    let snappedX = rawX;

    const checkSnapX = (current: number, target: number) => {
      const diff = target - current;
      if (Math.abs(diff) <= threshold) {
        if (bestDiffX === null || Math.abs(diff) < Math.abs(bestDiffX)) {
          bestDiffX = diff;
        }
      }
    };

    checkSnapX(rawX + width / 2, PAGE_WIDTH / 2);
    checkSnapX(rawX, 0);
    checkSnapX(rawX + width, PAGE_WIDTH);

    for (const other of otherElements) {
      const oW = other.width || 100;
      const oLeft = other.x;
      const oCenter = other.x + oW / 2;
      const oRight = other.x + oW;

      checkSnapX(rawX, oLeft);
      checkSnapX(rawX, oRight);
      checkSnapX(rawX, oCenter);

      checkSnapX(rawX + width / 2, oCenter);
      checkSnapX(rawX + width / 2, oLeft);
      checkSnapX(rawX + width / 2, oRight);

      checkSnapX(rawX + width, oRight);
      checkSnapX(rawX + width, oLeft);
      checkSnapX(rawX + width, oCenter);
    }

    if (bestDiffX !== null) {
      snappedX = rawX + bestDiffX;
    }

    let bestDiffY: number | null = null;
    let snappedY = rawY;

    const checkSnapY = (current: number, target: number) => {
      const diff = target - current;
      if (Math.abs(diff) <= threshold) {
        if (bestDiffY === null || Math.abs(diff) < Math.abs(bestDiffY)) {
          bestDiffY = diff;
        }
      }
    };

    checkSnapY(rawY + height / 2, PAGE_HEIGHT / 2);
    checkSnapY(rawY, 0);
    checkSnapY(rawY + height, PAGE_HEIGHT);

    for (const other of otherElements) {
      const oH = other.height || 40;
      const oTop = other.y;
      const oCenter = other.y + oH / 2;
      const oBottom = other.y + oH;

      checkSnapY(rawY, oTop);
      checkSnapY(rawY, oBottom);
      checkSnapY(rawY, oCenter);

      checkSnapY(rawY + height / 2, oCenter);
      checkSnapY(rawY + height / 2, oTop);
      checkSnapY(rawY + height / 2, oBottom);

      checkSnapY(rawY + height, oBottom);
      checkSnapY(rawY + height, oTop);
      checkSnapY(rawY + height, oCenter);
    }

    if (bestDiffY !== null) {
      snappedY = rawY + bestDiffY;
    }

    this.renderActiveSmartGuides(item, pageIndex, snappedX, snappedY, width, height, otherElements);

    return { x: snappedX, y: snappedY };
  }

  private renderActiveSmartGuides(
    item: { id: string },
    pageIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
    otherElements: Array<ElementImage | ElementShape | ElementText>
  ): void {
    const guidesSvg = this.container.querySelector<SVGElement>(`[data-ref="guides-svg-${pageIndex}"]`);
    if (!guidesSvg) return;

    guidesSvg.innerHTML = '';

    const linesToDraw: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];

    const myLeft = x;
    const myCenter = x + width / 2;
    const myRight = x + width;

    const myTop = y;
    const myMiddle = y + height / 2;
    const myBottom = y + height;

    const isClose = (a: number, b: number) => Math.abs(a - b) < 1.5;

    if (isClose(myCenter, PAGE_WIDTH / 2)) {
      linesToDraw.push({
        x1: PAGE_WIDTH / 2,
        x2: PAGE_WIDTH / 2,
        y1: 0,
        y2: PAGE_HEIGHT,
      });
    }

    if (isClose(myMiddle, PAGE_HEIGHT / 2)) {
      linesToDraw.push({
        x1: 0,
        x2: PAGE_WIDTH,
        y1: PAGE_HEIGHT / 2,
        y2: PAGE_HEIGHT / 2,
      });
    }

    const vCoords = [myLeft, myCenter, myRight];
    for (const vX of vCoords) {
      const matchingOthers: Array<ElementImage | ElementShape | ElementText> = [];
      for (const other of otherElements) {
        const oW = other.width || 100;
        const oLeft = other.x;
        const oCenter = other.x + oW / 2;
        const oRight = other.x + oW;
        if (isClose(vX, oLeft) || isClose(vX, oCenter) || isClose(vX, oRight)) {
          matchingOthers.push(other);
        }
      }

      if (matchingOthers.length > 0) {
        let minY = myTop;
        let maxY = myBottom;
        for (const m of matchingOthers) {
          const mTop = m.y;
          const mBottom = m.y + (m.height || 40);
          if (mTop < minY) minY = mTop;
          if (mBottom > maxY) maxY = mBottom;
        }
        linesToDraw.push({
          x1: Math.round(vX),
          x2: Math.round(vX),
          y1: Math.max(0, minY - 14),
          y2: Math.min(PAGE_HEIGHT, maxY + 14),
        });
      }
    }

    const hCoords = [myTop, myMiddle, myBottom];
    for (const hY of hCoords) {
      const matchingOthers: Array<ElementImage | ElementShape | ElementText> = [];
      for (const other of otherElements) {
        const oH = other.height || 40;
        const oTop = other.y;
        const oMiddle = other.y + oH / 2;
        const oBottom = other.y + oH;
        if (isClose(hY, oTop) || isClose(hY, oMiddle) || isClose(hY, oBottom)) {
          matchingOthers.push(other);
        }
      }

      if (matchingOthers.length > 0) {
        let minX = myLeft;
        let maxX = myRight;
        for (const m of matchingOthers) {
          const mLeft = m.x;
          const mRight = m.x + (m.width || 100);
          if (mLeft < minX) minX = mLeft;
          if (mRight > maxX) maxX = mRight;
        }
        linesToDraw.push({
          x1: Math.max(0, minX - 14),
          x2: Math.min(PAGE_WIDTH, maxX + 14),
          y1: Math.round(hY),
          y2: Math.round(hY),
        });
      }
    }

    for (const l of linesToDraw) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'collaborative-guide-line');
      line.setAttribute('x1', l.x1.toString());
      line.setAttribute('y1', l.y1.toString());
      line.setAttribute('x2', l.x2.toString());
      line.setAttribute('y2', l.y2.toString());
      guidesSvg.appendChild(line);
    }
  }

  private clearSmartGuides(pageIndex?: number): void {
    if (pageIndex !== undefined) {
      const svg = this.container.querySelector<SVGElement>(`[data-ref="guides-svg-${pageIndex}"]`);
      if (svg) svg.innerHTML = '';
    } else {
      const svgs = this.container.querySelectorAll<SVGElement>('.collaborative-guides-svg');
      svgs.forEach((svg) => {
        svg.innerHTML = '';
      });
    }
  }

  private updateContextToolbar(): void {
    const toolbar = this.container.querySelector<HTMLElement>('[data-ref="collaborative-context-toolbar"]');
    if (!toolbar) return;

    const textGroup = toolbar.querySelector<HTMLElement>('[data-ref="context-group-text"]');
    const shapeGroup = toolbar.querySelector<HTMLElement>('[data-ref="context-group-shape"]');
    const pageGroup = toolbar.querySelector<HTMLElement>('[data-ref="context-group-page"]');
    const actionGroup = toolbar.querySelector<HTMLElement>('[data-ref="context-group-actions"]');

    if (this.selectedElementId) {
      showElement(toolbar);
      showElement(actionGroup);
      hideElement(pageGroup);

      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (!el) {
        hideElement(toolbar);
        return;
      }

      if (el.type === 'text') {
        showElement(textGroup);
        hideElement(shapeGroup);

        const txtFontSize = toolbar.querySelector<HTMLElement>('[data-ref="txt-font-size"]');
        if (txtFontSize) txtFontSize.textContent = (el.fontSize || 16).toString();

        const btnBold = toolbar.querySelector<HTMLElement>('[data-ref="btn-toggle-bold"]');
        btnBold?.classList.toggle('is-active', !!el.isBold);

        const previewTextColor = toolbar.querySelector<HTMLElement>('[data-ref="preview-text-color"]');
        if (previewTextColor) previewTextColor.style.backgroundColor = el.color || '#000000';

        const labelStickyBg = toolbar.querySelector<HTMLElement>('[data-ref="label-sticky-bg"]');
        if (el.isStickyNote) {
          showElement(labelStickyBg);
          const previewStickyBg = toolbar.querySelector<HTMLElement>('[data-ref="preview-sticky-bg"]');
          if (previewStickyBg) previewStickyBg.style.backgroundColor = el.backgroundColor || '#fef08a';
        } else {
          hideElement(labelStickyBg);
        }
      } else if (el.type === 'shape') {
        showElement(shapeGroup);
        hideElement(textGroup);

        const previewFill = toolbar.querySelector<HTMLElement>('[data-ref="preview-shape-fill"]');
        if (previewFill) previewFill.style.backgroundColor = el.fillColor || '#4f46e5';

        const previewStroke = toolbar.querySelector<HTMLElement>('[data-ref="preview-shape-stroke"]');
        if (previewStroke) previewStroke.style.backgroundColor = el.strokeColor || '#000000';

        const btnStrokeWidth = toolbar.querySelector<HTMLElement>('[data-ref="btn-shape-strokewidth"]');
        if (btnStrokeWidth) btnStrokeWidth.setAttribute('data-tooltip', `Grosor de borde: ${el.strokeWidth || 0}px`);
      } else {
        hideElement(textGroup);
        hideElement(shapeGroup);
      }
    } else if (this.selectedPageIndex !== null) {
      showElement(toolbar);
      hideElement(actionGroup);
      showElement(pageGroup);
      hideElement(textGroup);
      hideElement(shapeGroup);

      const previewPageBg = toolbar.querySelector<HTMLElement>('[data-ref="preview-page-bg-color"]');
      if (previewPageBg) {
        previewPageBg.style.backgroundColor = this.pageBackgrounds[this.selectedPageIndex] || '#ffffff';
      }
    } else {
      hideElement(toolbar);
    }
  }

  private deleteSelectedElement(): void {
    if (this.selectedElementId) {
      this.elements = this.elements.filter((el) => el.id !== this.selectedElementId);
      this.selectedElementId = null;
      this.removeTransformBox();
      this.renderPages();
      this.setModified(true);
    } else if (this.selectedPageIndex !== null) {
      this.deletePage(this.selectedPageIndex);
    }
  }

  private duplicateSelected(): void {
    if (this.selectedElementId) {
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (!el) return;
      const clone = JSON.parse(JSON.stringify(el));
      clone.id = `${clone.type}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      clone.x = (clone.x || 100) + 24;
      clone.y = (clone.y || 100) + 24;
      if (clone.x2 !== undefined) clone.x2 += 24;
      if (clone.y2 !== undefined) clone.y2 += 24;
      this.elements.push(clone);
      this.renderPages();
      this.selectElement(clone.id);
      this.setModified(true);
      showToast('Elemento duplicado', 'info');
    } else if (this.selectedPageIndex !== null) {
      this.duplicatePage(this.selectedPageIndex);
    }
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

    const btnAddTextBox = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-add-text-box"]');
    btnAddTextBox?.addEventListener('click', () => this.addTextElement('body'), { signal });

    const btnPresetTitle = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-preset-title"]');
    btnPresetTitle?.addEventListener('click', () => this.addTextElement('title'), { signal });

    const btnPresetSubtitle = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-preset-subtitle"]');
    btnPresetSubtitle?.addEventListener('click', () => this.addTextElement('subtitle'), { signal });

    const btnPresetBody = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-preset-body"]');
    btnPresetBody?.addEventListener('click', () => this.addTextElement('body'), { signal });

    const elemConfigs: Array<{ handler: () => void; ref: string }> = [
      { handler: () => showToast('Función de tablas próximamente', 'info'), ref: 'btn-elem-tables' },
      { handler: () => this.handleRailTabClick('uploads'), ref: 'btn-elem-photos' },
      { handler: () => showToast('Gráficas estadísticas próximamente', 'info'), ref: 'btn-elem-charts' },
    ];

    elemConfigs.forEach(({ handler, ref }) => {
      this.container.querySelector<HTMLButtonElement>(`[data-ref="${ref}"]`)?.addEventListener('click', handler, { signal });
    });

    this.bindUploadEvents();

    const toolbarButtons = this.container.querySelectorAll<HTMLButtonElement>('.collaborative-toolbar-btn');
    toolbarButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool') as any;
        toolbarButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        this.activeTool = tool;

        if (tool === 'select') {
          this.closeSubtoolbars();
        } else if (tool === 'text') {
          this.closeSubtoolbars();
          this.addTextElement('body');
        } else {
          this.openSubtoolbar(tool);
        }
      }, { signal });
    });

    const drawButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-draw-mode]');
    drawButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        drawButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.drawMode = (btn.getAttribute('data-draw-mode') as any) || 'pen';
      }, { signal });
    });

    const inputDrawColor = this.container.querySelector<HTMLInputElement>('[data-ref="input-draw-color"]');
    const previewDrawColor = this.container.querySelector<HTMLElement>('[data-ref="preview-draw-color"]');
    inputDrawColor?.addEventListener('input', () => {
      this.drawColor = inputDrawColor.value;
      if (previewDrawColor) {
        previewDrawColor.style.backgroundColor = inputDrawColor.value;
      }
    }, { signal });

    const btnDrawThickness = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-draw-thickness"]');
    const dotThickness = this.container.querySelector<HTMLElement>('[data-ref="dot-thickness"]');
    const thicknesses = [2, 4, 8, 16];
    btnDrawThickness?.addEventListener('click', () => {
      const curIndex = thicknesses.indexOf(this.drawThickness);
      const nextIndex = (curIndex + 1) % thicknesses.length;
      this.drawThickness = thicknesses[nextIndex];
      btnDrawThickness.setAttribute('data-tooltip', `Grosor: ${this.drawThickness}px`);
      if (dotThickness) {
        const sz = Math.min(18, Math.max(4, this.drawThickness * 1.5));
        dotThickness.style.width = `${sz}px`;
        dotThickness.style.height = `${sz}px`;
      }
    }, { signal });

    const shapeButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-shape]');
    shapeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const shape = btn.getAttribute('data-shape') as any;
        if (shape) {
          this.addShapeElement(shape);
        }
      }, { signal });
    });

    const lineButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-line-type]');
    lineButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const lineType = btn.getAttribute('data-line-type') as any;
        if (lineType) {
          this.addLineElement(lineType);
        }
      }, { signal });
    });

    const stickySwatches = this.container.querySelectorAll<HTMLButtonElement>('.collaborative-sticky-swatch');
    stickySwatches.forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color') || '#fef08a';
        this.addStickyNoteElement(color);
      }, { signal });
    });

    const btnFontDec = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-font-decrease"]');
    btnFontDec?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        el.fontSize = Math.max(8, (el.fontSize || 16) - 2);
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) elNode.style.fontSize = `${el.fontSize}px`;
        this.updateContextToolbar();
        this.updateTransformBoxPosition();
        this.setModified(true);
      }
    }, { signal });

    const btnFontInc = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-font-increase"]');
    btnFontInc?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        el.fontSize = Math.min(144, (el.fontSize || 16) + 2);
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) elNode.style.fontSize = `${el.fontSize}px`;
        this.updateContextToolbar();
        this.updateTransformBoxPosition();
        this.setModified(true);
      }
    }, { signal });

    const btnToggleBold = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-bold"]');
    btnToggleBold?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        el.isBold = !el.isBold;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) elNode.style.fontWeight = el.isBold ? 'bold' : 'normal';
        this.updateContextToolbar();
        this.updateTransformBoxPosition();
        this.setModified(true);
      }
    }, { signal });

    const inputTextColor = this.container.querySelector<HTMLInputElement>('[data-ref="input-text-color"]');
    const previewTextColor = this.container.querySelector<HTMLElement>('[data-ref="preview-text-color"]');
    inputTextColor?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        el.color = inputTextColor.value;
        if (previewTextColor) previewTextColor.style.backgroundColor = inputTextColor.value;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) elNode.style.color = inputTextColor.value;
        this.setModified(true);
      }
    }, { signal });

    const inputStickyBg = this.container.querySelector<HTMLInputElement>('[data-ref="input-sticky-bg"]');
    const previewStickyBg = this.container.querySelector<HTMLElement>('[data-ref="preview-sticky-bg"]');
    inputStickyBg?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text' && el.isStickyNote) {
        el.backgroundColor = inputStickyBg.value;
        if (previewStickyBg) previewStickyBg.style.backgroundColor = inputStickyBg.value;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) elNode.style.backgroundColor = inputStickyBg.value;
        this.setModified(true);
      }
    }, { signal });

    const inputShapeFill = this.container.querySelector<HTMLInputElement>('[data-ref="input-shape-fill"]');
    const previewShapeFill = this.container.querySelector<HTMLElement>('[data-ref="preview-shape-fill"]');
    inputShapeFill?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        el.fillColor = inputShapeFill.value;
        if (previewShapeFill) previewShapeFill.style.backgroundColor = inputShapeFill.value;
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
      }
    }, { signal });

    const inputShapeStroke = this.container.querySelector<HTMLInputElement>('[data-ref="input-shape-stroke"]');
    const previewShapeStroke = this.container.querySelector<HTMLElement>('[data-ref="preview-shape-stroke"]');
    inputShapeStroke?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        el.strokeColor = inputShapeStroke.value;
        if (previewShapeStroke) previewShapeStroke.style.backgroundColor = inputShapeStroke.value;
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
      }
    }, { signal });

    const btnShapeStrokeWidth = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-shape-strokewidth"]');
    const strokeWidths = [0, 1, 2, 4, 8];
    btnShapeStrokeWidth?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        const curIdx = strokeWidths.indexOf(el.strokeWidth || 0);
        el.strokeWidth = strokeWidths[(curIdx + 1) % strokeWidths.length];
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
      }
    }, { signal });

    const inputPageBg = this.container.querySelector<HTMLInputElement>('[data-ref="input-page-bg-color"]');
    const previewPageBg = this.container.querySelector<HTMLElement>('[data-ref="preview-page-bg-color"]');
    inputPageBg?.addEventListener('input', () => {
      if (this.selectedPageIndex === null) return;
      const color = inputPageBg.value;
      this.pageBackgrounds[this.selectedPageIndex] = color;
      if (previewPageBg) previewPageBg.style.backgroundColor = color;
      const sheet = this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-${this.selectedPageIndex}"]`);
      if (sheet) sheet.style.backgroundColor = color;
      this.setModified(true);
    }, { signal });

    const btnContextDup = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-context-duplicate"]');
    btnContextDup?.addEventListener('click', () => this.duplicateSelected(), { signal });

    const btnContextDel = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-context-delete"]');
    btnContextDel?.addEventListener('click', () => this.deleteSelectedElement(), { signal });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || (document.activeElement as HTMLElement)?.isContentEditable) return;
        if (this.selectedElementId || this.selectedPageIndex !== null) {
          e.preventDefault();
          this.deleteSelectedElement();
        }
      }
    }, { signal });

    const workspace = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
    workspace?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('collaborative-workspace') || target.classList.contains('collaborative-pages-container') || target.classList.contains('collaborative-page-wrapper')) {
        this.selectElement(null);
        this.selectPage(null);
      }
    }, { signal });
  }

  private async loadUploadedAssets(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.collaborativeDocs.uploads);
      if (res.ok) {
        const data = await res.json();
        this.uploadedAssets = Array.isArray(data.files) ? data.files : [];
        this.renderUploadsGrid();
      }
    } catch {}
  }

  private bindUploadEvents(): void {
    const { signal } = this.abortController || {};

    const btnUpload = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-upload-file"]');
    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-file-upload"]');

    btnUpload?.addEventListener('click', () => {
      fileInput?.click();
    }, { signal });

    fileInput?.addEventListener('change', async () => {
      const files = fileInput.files;
      if (!files || files.length === 0) return;

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const progress = this.container.querySelector<HTMLElement>('[data-ref="upload-progress-indicator"]');
      if (progress) showElement(progress);

      try {
        const res = await postFormApi(API_ROUTES.collaborativeDocs.upload, formData);
        if (res.ok) {
          const data = await res.json();
          const newFiles: UploadedAsset[] = data.files || (data.file ? [data.file] : []);
          this.uploadedAssets = [...newFiles, ...this.uploadedAssets];
          this.renderUploadsGrid();
          showToast(newFiles.length === 1 ? 'Archivo subido con éxito' : `${newFiles.length} archivos subidos con éxito`, 'success');
        } else {
          showToast('No se pudo subir el archivo.', 'error');
        }
      } catch {
        showToast('Error de red al subir archivo.', 'error');
      } finally {
        if (progress) hideElement(progress);
        fileInput.value = '';
      }
    }, { signal });

    const tabAll = this.container.querySelector<HTMLButtonElement>('[data-ref="tab-upload-all"]');
    const tabImages = this.container.querySelector<HTMLButtonElement>('[data-ref="tab-upload-images"]');
    const tabPdfs = this.container.querySelector<HTMLButtonElement>('[data-ref="tab-upload-pdfs"]');

    const updateTabs = (active: 'all' | 'images' | 'pdfs') => {
      this.activeUploadFilter = active;
      tabAll?.classList.toggle('is-active', active === 'all');
      tabImages?.classList.toggle('is-active', active === 'images');
      tabPdfs?.classList.toggle('is-active', active === 'pdfs');
      this.renderUploadsGrid();
    };

    tabAll?.addEventListener('click', () => updateTabs('all'), { signal });
    tabImages?.addEventListener('click', () => updateTabs('images'), { signal });
    tabPdfs?.addEventListener('click', () => updateTabs('pdfs'), { signal });

    const btnBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pdf-apply-back"]');
    btnBack?.addEventListener('click', () => {
      const mainView = this.container.querySelector<HTMLElement>('[data-ref="uploads-main-view"]');
      const pdfPanel = this.container.querySelector<HTMLElement>('[data-ref="pdf-apply-panel"]');
      if (mainView) showElement(mainView);
      if (pdfPanel) hideElement(pdfPanel);
      this.selectedPdfAsset = null;
    }, { signal });

    const btnApplyAll = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-apply-all-pages"]');
    btnApplyAll?.addEventListener('click', () => {
      if (!this.selectedPdfAsset) return;
      const count = Math.max(1, this.selectedPdfAsset.pageCount || 1);
      this.pageCount = count;
      this.pagePdfSources = [];
      for (let i = 0; i < count; i++) {
        this.pagePdfSources.push({
          pageNumber: i + 1,
          pdfUrl: this.selectedPdfAsset.url,
        });
      }
      this.pageTitles = Array(count).fill('').map((_, idx) => `Página ${idx + 1}`);
      this.pageBackgrounds = Array(count).fill('#ffffff');
      this.selectedPageIndex = 0;
      this.activePageIndex = 0;
      this.renderPages();
      this.setModified(true);
      showToast(`Se han aplicado las ${count} páginas del PDF al documento`, 'success');
    }, { signal });
  }

  private renderUploadsGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="uploads-grid"]');
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="empty-uploads"]');
    if (!grid) return;

    grid.innerHTML = '';
    const filtered = this.uploadedAssets.filter((a) => {
      if (this.activeUploadFilter === 'images') return a.type === 'image';
      if (this.activeUploadFilter === 'pdfs') return a.type === 'pdf';
      return true;
    });

    if (filtered.length === 0) {
      if (emptyState) showElement(emptyState);
      return;
    }

    if (emptyState) hideElement(emptyState);

    for (const asset of filtered) {
      const card = document.createElement('div');
      card.className = 'collaborative-upload-card';
      card.setAttribute('data-ref', `upload-card-${asset.id}`);

      if (asset.type === 'image') {
        card.innerHTML = `
          <div class="collaborative-upload-card__thumb">
            <img class="collaborative-upload-card__img" src="${asset.url}" alt="${asset.name}" loading="lazy" />
          </div>
          <div class="collaborative-upload-card__info">
            <span class="collaborative-upload-card__name" title="${asset.name}">${asset.name}</span>
          </div>
        `;
        card.addEventListener('click', () => {
          this.addImageElement(asset);
        });
      } else {
        const pageLabel = `${asset.pageCount || 1} ${(asset.pageCount || 1) === 1 ? 'página' : 'páginas'}`;
        card.innerHTML = `
          <div class="collaborative-upload-card__thumb">
            <div class="collaborative-upload-card__pdf-icon">
              <svg class="component-icon" style="width: 36px; height: 36px;" aria-hidden="true"><use href="/icons.svg#picture_as_pdf"></use></svg>
              <span class="collaborative-upload-card__meta">${pageLabel}</span>
            </div>
          </div>
          <div class="collaborative-upload-card__info">
            <span class="collaborative-upload-card__name" title="${asset.name}">${asset.name}</span>
          </div>
        `;
        card.addEventListener('click', () => {
          this.openPdfApplyPanel(asset);
        });
      }

      grid.appendChild(card);
    }

    renderIcons(grid);
  }

  private openPdfApplyPanel(asset: UploadedAsset): void {
    this.selectedPdfAsset = asset;
    const mainView = this.container.querySelector<HTMLElement>('[data-ref="uploads-main-view"]');
    const pdfPanel = this.container.querySelector<HTMLElement>('[data-ref="pdf-apply-panel"]');
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="txt-pdf-apply-name"]');
    const applyTextEl = this.container.querySelector<HTMLElement>('[data-ref="txt-apply-all-pages"]');
    const pagesGrid = this.container.querySelector<HTMLElement>('[data-ref="pdf-pages-thumbnails-grid"]');

    if (mainView) hideElement(mainView);
    if (pdfPanel) showElement(pdfPanel);
    if (titleEl) titleEl.textContent = asset.name;

    const count = Math.max(1, asset.pageCount || 1);
    if (applyTextEl) {
      applyTextEl.textContent = `Aplicar ${count} ${count === 1 ? 'página' : 'páginas'}`;
    }

    if (pagesGrid) {
      pagesGrid.innerHTML = '';
      for (let i = 1; i <= count; i++) {
        const pageCard = document.createElement('div');
        pageCard.className = 'collaborative-pdf-page-card';
        pageCard.setAttribute('data-ref', `pdf-thumb-card-${i}`);

        const canvas = document.createElement('canvas');
        canvas.setAttribute('data-ref', `pdf-thumb-canvas-${i}`);

        const label = document.createElement('span');
        label.textContent = `Página ${i}`;

        pageCard.appendChild(canvas);
        pageCard.appendChild(label);

        pageCard.addEventListener('click', () => {
          const targetIdx = this.selectedPageIndex !== null ? this.selectedPageIndex : this.activePageIndex;
          while (this.pagePdfSources.length <= targetIdx) {
            this.pagePdfSources.push(null);
          }
          this.pagePdfSources[targetIdx] = {
            pageNumber: i,
            pdfUrl: asset.url,
          };
          this.renderPages();
          this.setModified(true);
          showToast(`Página ${i} aplicada a la página ${targetIdx + 1}`, 'success');
        });

        pagesGrid.appendChild(pageCard);

        void renderPdfThumbnail(asset.url, canvas, {
          pageNum: i,
          targetWidth: 120,
        });
      }
    }
  }

  private async saveDocument(): Promise<void> {
    try {
      const payload = {
        content: {
          elements: this.elements,
          pageBackgrounds: this.pageBackgrounds,
          pageCount: this.pageCount,
          pagePdfSources: this.pagePdfSources,
          pageSize: { height: PAGE_HEIGHT, width: PAGE_WIDTH },
          pageTitles: this.pageTitles,
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
