import { API_ROUTES } from '../../config/api-routes.js';
import { getApi, postFormApi, putApi } from '../../services/api.service.js';
import { translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { renderPdfThumbnail } from '../../services/pdf-preview.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';
import { hideElement, showElement, withButtonLoading } from '../../utils/dom.util.js';
import { createCollaborativeDrawerElement } from './collaborative-pdf-drawer.template.js';

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
  shapeType: 'arch' | 'arrow' | 'arrow-bidirectional-bold' | 'arrow-block-down' | 'arrow-block-left' | 'arrow-block-right' | 'arrow-block-up' | 'arrow-chevron-right' | 'arrow-double-horizontal' | 'arrow-double-vertical' | 'arrow-down' | 'arrow-left' | 'arrow-notched-left' | 'arrow-pentagon-right' | 'arrow-up' | 'badge' | 'badge-20' | 'callout' | 'chamfered-rect' | 'circle' | 'cloud' | 'cross' | 'decagon' | 'diamond' | 'flare-10' | 'flare-12' | 'flare-8' | 'flowchart-data' | 'flowchart-decision' | 'flowchart-delay' | 'flowchart-display' | 'flowchart-document' | 'flowchart-manual' | 'flowchart-merge' | 'flowchart-offpage' | 'flowchart-preparation' | 'flowchart-process-rounded' | 'flowchart-terminator' | 'heart' | 'heptagon' | 'hexagon' | 'hexagon-vertical' | 'lightning' | 'line' | 'line-flexible' | 'line-multiconnect' | 'octagon' | 'parallelogram-left' | 'parallelogram-right' | 'pentagon' | 'plaque' | 'quarter-circle' | 'quarter-circle-arc' | 'rect' | 'right-triangle' | 'rounded-rect' | 'scalloped-rect' | 'semicircle' | 'semicircle-arc' | 'shield' | 'star' | 'star-10' | 'star-12' | 'star-16' | 'star-24' | 'star-32' | 'star-4' | 'star-5' | 'star-6' | 'star-7' | 'star-8' | 'trapezoid' | 'trapezoid-inverted' | 'triangle' | 'triangle-down';
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
  private activePanelTab: 'colors' | 'elements' | 'text' | 'tools' | 'uploads' | null = null;
  private currentColorTarget: 'draw-color' | 'page-bg' | 'shape-fill' | 'shape-stroke' | 'sticky-bg' | 'text-color' | null = null;
  private recentColors: string[] = [];
  private activeTool: 'draw' | 'lines' | 'select' | 'shapes' | 'stickynotes' | 'text' = 'select';
  private activeUploadFilter: 'all' | 'images' | 'pdfs' = 'all';
  private container: HTMLElement;
  private docId = '';
  private docTitle = 'Documento sin título';
  private drawColor = '#000000';
  private drawMode: 'eraser' | 'highlighter' | 'marker' | 'pen' = 'pen';
  private drawThickness = 2;
  private drawer: HTMLElement | null = null;
  private drawerAbortController: AbortController | null = null;
  private drawerRemovalTimer: ReturnType<typeof setTimeout> | null = null;
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
  private zoomLevel = 1.0;

  constructor(container: HTMLElement, docId?: string) {
    this.container = container;
    this.docId = docId || '';
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();

    if (!this.docId) {
      const urlParams = new URLSearchParams(window.location.search);
      const queryId = urlParams.get('id');
      const pathMatch = window.location.pathname.match(/^\/d\/([a-zA-Z0-9_-]+)\/?$/);
      this.docId = queryId || (pathMatch ? pathMatch[1] : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`));
    }

    if (window.location.pathname !== `/d/${this.docId}`) {
      window.history.replaceState({}, '', `/d/${encodeURIComponent(this.docId)}`);
    }

    this.setupRailNavigation();
    await this.loadDocument();
    this.renderPages();
    this.bindEvents();
    void this.loadUploadedAssets();
    this.updateFooterPageInfo();
    renderIcons(this.container);
  }

  destroy(): void {
    if (this.drawerRemovalTimer) {
      clearTimeout(this.drawerRemovalTimer);
      this.drawerRemovalTimer = null;
    }
    if (this.drawerAbortController) {
      this.drawerAbortController.abort();
      this.drawerAbortController = null;
    }
    if (this.drawer) {
      this.drawer.classList.remove('is-open');
      this.drawer.remove();
      this.drawer = null;
    }
    this.teardownRailNavigation();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private queryPanel<T extends HTMLElement>(selector: string): T | null {
    if (this.drawer) {
      const el = this.drawer.querySelector<T>(selector);
      if (el) return el;
    }
    return this.container.querySelector<T>(selector);
  }

  private queryPanelAll<T extends HTMLElement>(selector: string): NodeListOf<T> {
    if (this.drawer) {
      const list = this.drawer.querySelectorAll<T>(selector);
      if (list.length > 0) return list;
    }
    return this.container.querySelectorAll<T>(selector);
  }

  private ensureDrawerMounted(): void {
    if (this.drawerRemovalTimer) {
      clearTimeout(this.drawerRemovalTimer);
      this.drawerRemovalTimer = null;
    }

    if (this.drawer && document.body.contains(this.drawer)) {
      return;
    }

    const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
    if (!sidebar) return;

    const existingDrawers = sidebar.querySelectorAll<HTMLElement>('[data-ref="layout-drawer"]');
    existingDrawers.forEach((d) => d.remove());

    if (this.drawerAbortController) {
      this.drawerAbortController.abort();
      this.drawerAbortController = null;
    }
    this.drawerAbortController = new AbortController();

    this.drawer = createCollaborativeDrawerElement();
    sidebar.appendChild(this.drawer);
    translateElement(this.drawer);
    renderIcons(this.drawer);
    this.bindDrawerEvents();
  }

  private bindDrawerEvents(): void {
    const { signal } = this.drawerAbortController || {};

    const closeSidePanelBtn = this.queryPanel<HTMLButtonElement>('[data-ref="btn-close-side-panel"]');
    closeSidePanelBtn?.addEventListener('click', () => {
      this.closeSidePanel();
    }, { signal });

    const btnAddTextBox = this.queryPanel<HTMLButtonElement>('[data-ref="btn-add-text-box"]');
    btnAddTextBox?.addEventListener('click', () => this.addTextElement('body'), { signal });

    const btnPresetTitle = this.queryPanel<HTMLButtonElement>('[data-ref="btn-preset-title"]');
    btnPresetTitle?.addEventListener('click', () => this.addTextElement('title'), { signal });

    const btnPresetSubtitle = this.queryPanel<HTMLButtonElement>('[data-ref="btn-preset-subtitle"]');
    btnPresetSubtitle?.addEventListener('click', () => this.addTextElement('subtitle'), { signal });

    const btnPresetBody = this.queryPanel<HTMLButtonElement>('[data-ref="btn-preset-body"]');
    btnPresetBody?.addEventListener('click', () => this.addTextElement('body'), { signal });

    const elemConfigs: Array<{ handler: () => void; ref: string }> = [
      { handler: () => showToast('Función de tablas próximamente', 'info'), ref: 'btn-elem-tables' },
      { handler: () => this.handleRailTabClick('uploads'), ref: 'btn-elem-photos' },
      { handler: () => showToast('Gráficas estadísticas próximamente', 'info'), ref: 'btn-elem-charts' },
    ];

    elemConfigs.forEach(({ handler, ref }) => {
      this.queryPanel<HTMLButtonElement>(`[data-ref="${ref}"]`)?.addEventListener('click', handler, { signal });
    });

    const btnElemShapes = this.queryPanel<HTMLButtonElement>('[data-ref="btn-elem-shapes"]');
    btnElemShapes?.addEventListener('click', () => {
      const mainView = this.queryPanel<HTMLElement>('[data-ref="elements-main-view"]');
      const shapesView = this.queryPanel<HTMLElement>('[data-ref="elements-shapes-view"]');
      const backBtn = this.queryPanel<HTMLElement>('[data-ref="btn-drawer-back"]');
      const titleEl = this.queryPanel<HTMLElement>('[data-ref="side-panel-title"]');
      if (mainView) hideElement(mainView);
      if (shapesView) showElement(shapesView);
      if (backBtn) showElement(backBtn);
      if (titleEl) titleEl.textContent = 'Formas';
    }, { signal });

    const goBackToElements = () => {
      const mainView = this.queryPanel<HTMLElement>('[data-ref="elements-main-view"]');
      const shapesView = this.queryPanel<HTMLElement>('[data-ref="elements-shapes-view"]');
      const backBtn = this.queryPanel<HTMLElement>('[data-ref="btn-drawer-back"]');
      const titleEl = this.queryPanel<HTMLElement>('[data-ref="side-panel-title"]');
      if (mainView) showElement(mainView);
      if (shapesView) hideElement(shapesView);
      if (backBtn) hideElement(backBtn);
      if (titleEl) titleEl.textContent = 'Elementos';
    };

    const btnShapesBack = this.queryPanel<HTMLButtonElement>('[data-ref="btn-shapes-back"]');
    btnShapesBack?.addEventListener('click', goBackToElements, { signal });

    const btnDrawerBack = this.queryPanel<HTMLButtonElement>('[data-ref="btn-drawer-back"]');
    btnDrawerBack?.addEventListener('click', () => {
      const shapesView = this.queryPanel<HTMLElement>('[data-ref="elements-shapes-view"]');
      const pdfApplyPanel = this.queryPanel<HTMLElement>('[data-ref="pdf-apply-panel"]');
      if (shapesView && !shapesView.classList.contains('is-hidden')) {
        goBackToElements();
      } else if (pdfApplyPanel && !pdfApplyPanel.classList.contains('is-hidden')) {
        this.closePdfApplyPanel();
      }
    }, { signal });

    const panelShapeBtns = this.queryPanelAll<HTMLButtonElement>('.collaborative-shape-card');
    panelShapeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const shape = btn.getAttribute('data-shape') as ElementShape['shapeType'];
        if (shape) {
          this.addShapeElement(shape);
        }
      }, { signal });
    });

    const colorSwatches = this.queryPanelAll<HTMLButtonElement>('[data-ref="swatch-color"]');
    colorSwatches.forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (color) {
          this.applyColorToCurrentTarget(color);
        }
      }, { signal });
    });

    const btnCustomPicker = this.queryPanel<HTMLButtonElement>('[data-ref="btn-color-custom-picker"]');
    const inputCustomColor = this.queryPanel<HTMLInputElement>('[data-ref="input-custom-color"]');
    btnCustomPicker?.addEventListener('click', () => {
      inputCustomColor?.click();
    }, { signal });

    inputCustomColor?.addEventListener('input', () => {
      if (inputCustomColor.value) {
        this.applyColorToCurrentTarget(inputCustomColor.value);
      }
    }, { signal });

    const btnEyedropper = this.queryPanel<HTMLButtonElement>('[data-ref="btn-color-eyedropper"]');
    btnEyedropper?.addEventListener('click', () => {
      void this.activateZoomEyeDropper();
    }, { signal });

    const btnUpload = this.queryPanel<HTMLButtonElement>('[data-ref="btn-upload-file"]');
    const fileInput = this.queryPanel<HTMLInputElement>('[data-ref="input-file-upload"]');

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

      const progress = this.queryPanel<HTMLElement>('[data-ref="upload-progress-indicator"]');
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

    const tabAll = this.queryPanel<HTMLButtonElement>('[data-ref="tab-upload-all"]');
    const tabImages = this.queryPanel<HTMLButtonElement>('[data-ref="tab-upload-images"]');
    const tabPdfs = this.queryPanel<HTMLButtonElement>('[data-ref="tab-upload-pdfs"]');

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

    const btnBack = this.queryPanel<HTMLButtonElement>('[data-ref="btn-pdf-apply-back"]');
    btnBack?.addEventListener('click', () => {
      this.closePdfApplyPanel();
    }, { signal });

    const btnApplyAll = this.queryPanel<HTMLButtonElement>('[data-ref="btn-apply-all-pages"]');
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

  private setupRailNavigation(): void {
    const railTop = document.querySelector<HTMLElement>('[data-ref="rail-top"]');
    const railDivider = document.querySelector<HTMLElement>('[data-ref="rail-divider"]');
    const defaultCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-default"]');
    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');

    if (railTop) {
      railTop.style.display = 'none';
    }
    if (railDivider) {
      railDivider.style.display = 'none';
    }
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
    const railTop = document.querySelector<HTMLElement>('[data-ref="rail-top"]');
    const railDivider = document.querySelector<HTMLElement>('[data-ref="rail-divider"]');
    const defaultCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-default"]');
    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');

    if (railTop) {
      railTop.style.display = '';
    }
    if (railDivider) {
      railDivider.style.display = '';
    }
    if (defaultCenter) {
      defaultCenter.style.display = '';
    }
    if (collabCenter) {
      collabCenter.style.display = 'none';
      const btns = collabCenter.querySelectorAll('.rail-btn');
      btns.forEach((b) => b.classList.remove('is-active'));
    }
  }

  private handleRailTabClick(tab: 'colors' | 'elements' | 'text' | 'tools' | 'uploads'): void {
    const toolsToolbar = this.container.querySelector<HTMLElement>('[data-ref="collaborative-tools-toolbar"]');
    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');

    if (tab === 'tools') {
      const isToolbarVisible = toolsToolbar && !toolsToolbar.classList.contains('is-hidden');
      const btnTools = collabCenter?.querySelector<HTMLElement>('[data-panel-tab="tools"]');
      if (isToolbarVisible) {
        if (toolsToolbar) {
          hideElement(toolsToolbar);
        }
        this.closeSubtoolbars();
        btnTools?.classList.remove('is-active');
      } else {
        if (toolsToolbar) {
          showElement(toolsToolbar);
        }
        btnTools?.classList.add('is-active');
      }
      renderIcons(this.container);
      return;
    }

    if (this.activePanelTab === tab && this.drawer?.classList.contains('is-open')) {
      this.closeSidePanel();
      return;
    }

    this.ensureDrawerMounted();

    this.activePanelTab = tab;
    if (this.drawer) {
      this.drawer.classList.add('is-open');
    }

    const titleEl = this.queryPanel<HTMLElement>('[data-ref="side-panel-title"]');
    const titles: Record<string, string> = {
      colors: 'Color',
      elements: 'Elementos',
      text: 'Escribir',
      uploads: 'Subidos',
    };

    if (titleEl) {
      titleEl.textContent = titles[tab] || '';
    }

    const backBtn = this.queryPanel<HTMLElement>('[data-ref="btn-drawer-back"]');
    if (backBtn) {
      hideElement(backBtn);
    }

    const sections = this.queryPanelAll<HTMLElement>('.collaborative-panel-section');
    sections.forEach((sec) => {
      const secRef = sec.getAttribute('data-ref');
      if (secRef === `panel-section-${tab}`) {
        showElement(sec);
      } else {
        hideElement(sec);
      }
    });

    if (tab === 'elements') {
      const mainView = this.queryPanel<HTMLElement>('[data-ref="elements-main-view"]');
      const shapesView = this.queryPanel<HTMLElement>('[data-ref="elements-shapes-view"]');
      if (mainView) showElement(mainView);
      if (shapesView) hideElement(shapesView);
    }

    if (tab === 'uploads') {
      this.renderUploadsGrid();
    }

    if (collabCenter) {
      const btns = collabCenter.querySelectorAll<HTMLElement>('[data-panel-tab]:not([data-panel-tab="tools"])');
      btns.forEach((btn) => {
        const btnTab = btn.getAttribute('data-panel-tab');
        btn.classList.toggle('is-active', btnTab === tab);
      });
    }

    if (this.drawer) {
      renderIcons(this.drawer);
    }
  }

  private closeSidePanel(): void {
    if (this.drawer) {
      this.drawer.classList.remove('is-open');
      if (this.drawerRemovalTimer) {
        clearTimeout(this.drawerRemovalTimer);
      }
      this.drawerRemovalTimer = setTimeout(() => {
        if (this.drawerAbortController) {
          this.drawerAbortController.abort();
          this.drawerAbortController = null;
        }
        this.drawer?.remove();
        this.drawer = null;
        this.drawerRemovalTimer = null;
      }, 280);
    }
    this.activePanelTab = null;
    this.currentColorTarget = null;
    const colorBtns = this.container.querySelectorAll<HTMLButtonElement>('.collaborative-color-picker-btn');
    colorBtns.forEach((b) => b.classList.remove('is-active'));

    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');
    if (collabCenter) {
      const btns = collabCenter.querySelectorAll<HTMLElement>('[data-panel-tab]:not([data-panel-tab="tools"])');
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
    let text = 'Agregar algo de texto';
    let fontSize = 16;
    let isBold = false;
    let color = '#000000';
    let yOffset = 180;

    if (preset === 'title') {
      text = 'Agregar un título';
      fontSize = 32;
      isBold = true;
      yOffset = 120;
    } else if (preset === 'subtitle') {
      text = 'Agregar un subtítulo';
      fontSize = 22;
      isBold = true;
      yOffset = 160;
    }

    const newElement: ElementText = {
      color,
      fontSize,
      height: 0,
      id,
      isBold,
      pageIndex: this.activePageIndex,
      rotation: 0,
      text,
      type: 'text',
      width: 0,
      x: 100,
      y: yOffset + (this.elements.length % 6) * 32,
    };

    this.elements.push(newElement);
    this.renderPages();

    const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
    if (elNode) {
      newElement.width = Math.ceil((elNode.offsetWidth || elNode.scrollWidth) + 8);
      newElement.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
      elNode.style.width = `${newElement.width}px`;
      elNode.style.height = `${newElement.height}px`;
    }

    this.selectElement(id);
    this.activateSelectTool();
    this.setModified(true);
  }

  private addShapeElement(shapeType: ElementShape['shapeType']): void {
    const id = `shape_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    let width = 140;
    let height = 100;
    let fillColor = '#000000';
    let strokeColor = 'transparent';
    let strokeWidth = 0;

    if (shapeType === 'rect' || shapeType === 'rounded-rect' || shapeType === 'scalloped-rect' || shapeType === 'plaque' || shapeType === 'chamfered-rect' || shapeType === 'flowchart-process-rounded') {
      width = 160;
      height = 100;
    } else if (shapeType === 'circle' || shapeType === 'diamond' || shapeType === 'cross' || shapeType === 'flowchart-decision') {
      width = 120;
      height = 120;
    } else if (shapeType === 'triangle' || shapeType === 'triangle-down' || shapeType === 'right-triangle' || shapeType === 'flowchart-merge') {
      width = 130;
      height = 120;
    } else if (shapeType === 'arrow' || shapeType === 'arrow-left') {
      width = 160;
      height = 46;
      strokeColor = '#000000';
      strokeWidth = 4;
    } else if (shapeType === 'arrow-up' || shapeType === 'arrow-down') {
      width = 46;
      height = 160;
      strokeColor = '#000000';
      strokeWidth = 4;
    } else if (shapeType === 'arrow-block-right' || shapeType === 'arrow-block-left' || shapeType === 'arrow-double-horizontal' || shapeType === 'arrow-pentagon-right' || shapeType === 'arrow-chevron-right' || shapeType === 'arrow-notched-left' || shapeType === 'arrow-bidirectional-bold') {
      width = 160;
      height = 80;
    } else if (shapeType === 'arrow-block-up' || shapeType === 'arrow-block-down' || shapeType === 'arrow-double-vertical') {
      width = 80;
      height = 160;
    } else if (shapeType.startsWith('star-') || shapeType.startsWith('flare-') || shapeType === 'star' || shapeType === 'badge' || shapeType === 'badge-20') {
      width = 120;
      height = 120;
    } else if (shapeType === 'pentagon' || shapeType === 'hexagon' || shapeType === 'hexagon-vertical' || shapeType === 'octagon' || shapeType === 'heptagon' || shapeType === 'decagon') {
      width = 120;
      height = 120;
    } else if (shapeType === 'parallelogram-right' || shapeType === 'parallelogram-left' || shapeType === 'trapezoid' || shapeType === 'trapezoid-inverted' || shapeType === 'flowchart-data' || shapeType === 'flowchart-manual') {
      width = 160;
      height = 100;
    } else if (shapeType === 'shield' || shapeType === 'arch') {
      width = 120;
      height = 135;
    } else if (shapeType === 'semicircle' || shapeType === 'semicircle-arc') {
      width = 140;
      height = 80;
    } else if (shapeType === 'quarter-circle' || shapeType === 'quarter-circle-arc') {
      width = 120;
      height = 120;
    } else if (shapeType === 'flowchart-preparation' || shapeType === 'flowchart-terminator' || shapeType === 'flowchart-document' || shapeType === 'flowchart-delay' || shapeType === 'flowchart-display') {
      width = 160;
      height = 95;
    } else if (shapeType === 'flowchart-offpage') {
      width = 120;
      height = 130;
    } else if (shapeType === 'callout') {
      width = 150;
      height = 105;
    } else if (shapeType === 'cloud') {
      width = 150;
      height = 95;
    } else if (shapeType === 'lightning') {
      width = 85;
      height = 140;
    } else if (shapeType === 'heart') {
      width = 120;
      height = 110;
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
    const footerStatus = this.container.querySelector<HTMLElement>('[data-ref="txt-footer-status"]');
    if (footerStatus) {
      footerStatus.textContent = val ? 'Cambios sin guardar' : 'Documento guardado';
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
        if (this.pageBackgrounds[p].startsWith('linear-gradient')) {
          sheet.style.backgroundImage = this.pageBackgrounds[p];
          sheet.style.backgroundColor = 'transparent';
        } else {
          sheet.style.backgroundImage = 'none';
          sheet.style.backgroundColor = this.pageBackgrounds[p];
        }
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

      const scaler = document.createElement('div');
      scaler.className = 'collaborative-page-sheet-scaler';
      scaler.setAttribute('data-ref', `page-sheet-scaler-${p}`);
      const scaledW = Math.round(PAGE_WIDTH * this.zoomLevel);
      const scaledH = Math.round(PAGE_HEIGHT * this.zoomLevel);
      scaler.style.width = `${scaledW}px`;
      scaler.style.height = `${scaledH}px`;

      sheet.style.width = `${PAGE_WIDTH}px`;
      sheet.style.height = `${PAGE_HEIGHT}px`;
      sheet.style.transform = `scale(${this.zoomLevel})`;
      sheet.style.transformOrigin = 'top left';

      scaler.appendChild(sheet);

      header.style.width = `${Math.max(340, scaledW)}px`;

      wrapper.appendChild(header);
      wrapper.appendChild(scaler);
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
    this.updateFooterPageInfo();
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
      if (el.backgroundColor?.startsWith('linear-gradient')) {
        div.style.backgroundImage = el.backgroundColor;
        div.style.backgroundColor = 'transparent';
      } else {
        div.style.backgroundColor = el.backgroundColor || '#fef08a';
      }
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
    if (el.color?.startsWith('linear-gradient')) {
      div.style.backgroundImage = el.color;
      div.style.webkitBackgroundClip = 'text';
      div.style.webkitTextFillColor = 'transparent';
    } else {
      div.style.color = el.color || '#000000';
    }
    div.style.fontWeight = el.isBold ? 'bold' : 'normal';
    div.style.fontFamily = el.fontFamily || 'Helvetica, sans-serif';
    div.style.transform = `rotate(${el.rotation || 0}deg)`;
    div.style.transformOrigin = 'center center';
    div.contentEditable = 'false';
    div.innerText = el.text || 'Texto';

    div.addEventListener('input', () => {
      el.text = div.innerText;
      if (!el.isStickyNote) {
        div.style.width = 'auto';
        div.style.height = 'auto';
        el.width = Math.ceil((div.offsetWidth || div.scrollWidth) + 8);
        el.height = Math.ceil(div.offsetHeight || div.scrollHeight);
        div.style.width = `${el.width}px`;
        div.style.height = `${el.height}px`;
        this.updateTransformBoxPosition();
      }
      this.setModified(true);
    });

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!div.classList.contains('is-editing')) {
        this.selectElement(el.id);
      }
    });

    div.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.selectElement(el.id);
      div.contentEditable = 'true';
      div.classList.add('is-editing');
      div.focus();
      const range = document.createRange();
      range.selectNodeContents(div);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });

    div.addEventListener('blur', () => {
      div.contentEditable = 'false';
      div.classList.remove('is-editing');
      el.text = div.innerText;
      if (!el.isStickyNote) {
        div.style.width = 'auto';
        div.style.height = 'auto';
        el.width = Math.ceil((div.offsetWidth || div.scrollWidth) + 8);
        el.height = Math.ceil(div.offsetHeight || div.scrollHeight);
        div.style.width = `${el.width}px`;
        div.style.height = `${el.height}px`;
        this.updateTransformBoxPosition();
      }
      this.setModified(true);
    });

    div.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        div.blur();
      }
    });

    this.makeDraggable(div, el);
    return div;
  }

  private renderShapeInner(el: ElementShape): string {
    let fill = el.fillColor && el.fillColor !== 'transparent' ? el.fillColor : '#000000';
    const stroke = el.strokeColor && el.strokeColor !== 'transparent' ? el.strokeColor : 'none';
    const strokeWidth = el.strokeWidth || 0;
    const w = el.width;
    const h = el.height;
    let gradDef = '';

    if (fill.startsWith('linear-gradient')) {
      const gradId = `shape-grad-${el.id}`;
      const hexes = fill.match(/#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}/g);
      if (hexes && hexes.length >= 2) {
        gradDef = `<defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${hexes[0]}"/><stop offset="100%" stop-color="${hexes[1]}"/></linearGradient></defs>`;
        fill = `url(#${gradId})`;
      }
    }

    const geom = this.renderShapeGeometry(el, fill, stroke, strokeWidth, w, h);
    return geom ? `${gradDef}${geom}` : '';
  }

  private renderShapeGeometry(el: ElementShape, fill: string, stroke: string, strokeWidth: number, w: number, h: number): string {
    const generateStarPolygon = (nPoints: number, innerRatio: number): string => {
      const cx = w / 2;
      const cy = h / 2;
      const rxOuter = w / 2;
      const ryOuter = h / 2;
      const rxInner = rxOuter * innerRatio;
      const ryInner = ryOuter * innerRatio;
      const pts: string[] = [];
      const total = nPoints * 2;
      for (let i = 0; i < total; i++) {
        const angle = (i * Math.PI) / nPoints - Math.PI / 2;
        const rx = i % 2 === 0 ? rxOuter : rxInner;
        const ry = i % 2 === 0 ? ryOuter : ryInner;
        pts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`);
      }
      return pts.join(' ');
    };

    const generateRegularPolygon = (sides: number): string => {
      const cx = w / 2;
      const cy = h / 2;
      const rx = w / 2;
      const ry = h / 2;
      const pts: string[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        pts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`);
      }
      return pts.join(' ');
    };

    if (el.shapeType === 'rect') {
      return `<rect x="0" y="0" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'rounded-rect') {
      const rx = Math.min(w, h) * 0.18;
      return `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'circle') {
      return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'triangle') {
      return `<polygon points="${w / 2},0 ${w},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'triangle-down') {
      return `<polygon points="0,0 ${w},0 ${w / 2},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'diamond') {
      return `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'cross') {
      const cx1 = w * 0.35;
      const cx2 = w * 0.65;
      const cy1 = h * 0.35;
      const cy2 = h * 0.65;
      return `<polygon points="${cx1},0 ${cx2},0 ${cx2},${cy1} ${w},${cy1} ${w},${cy2} ${cx2},${cy2} ${cx2},${h} ${cx1},${h} ${cx1},${cy2} 0,${cy2} 0,${cy1} ${cx1},${cy1}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'plaque') {
      return `<path d="M 0 ${h * 0.15} Q ${w / 2} 0 ${w} ${h * 0.15} V ${h * 0.85} Q ${w / 2} ${h} 0 ${h * 0.85} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'scalloped-rect') {
      const r = Math.min(w, h) * 0.15;
      return `<path d="M ${r} 0 H ${w - r} A ${r} ${r} 0 0 0 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 0 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 0 0 ${h - r} V ${r} A ${r} ${r} 0 0 0 ${r} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'parallelogram-right') {
      return `<polygon points="${w * 0.25},0 ${w},0 ${w * 0.75},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'parallelogram-left') {
      return `<polygon points="0,0 ${w * 0.75},0 ${w},${h} ${w * 0.25},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'trapezoid') {
      return `<polygon points="${w * 0.2},0 ${w * 0.8},0 ${w},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'trapezoid-inverted') {
      return `<polygon points="0,0 ${w},0 ${w * 0.8},${h} ${w * 0.2},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'shield') {
      return `<path d="M 0 0 H ${w} V ${h * 0.6} C ${w} ${h * 0.9} ${w / 2} ${h} ${w / 2} ${h} C ${w / 2} ${h} 0 ${h * 0.9} 0 ${h * 0.6} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arch') {
      return `<path d="M 0 ${h} V ${h * 0.45} C 0 ${-h * 0.05} ${w} ${-h * 0.05} ${w} ${h * 0.45} V ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'right-triangle') {
      return `<polygon points="0,0 0,${h} ${w},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'semicircle') {
      return `<path d="M 0 ${h} A ${w / 2} ${h} 0 0 1 ${w} ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'quarter-circle') {
      return `<path d="M 0 ${h} V 0 A ${w} ${h} 0 0 1 ${w} ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'quarter-circle-arc') {
      const t = Math.min(w, h) * 0.35;
      return `<path d="M 0 ${h} H ${t} A ${w - t} ${h - t} 0 0 1 ${w} ${h - t} V 0 A ${w} ${h} 0 0 0 0 ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'semicircle-arc') {
      const t = Math.min(w, h) * 0.35;
      return `<path d="M 0 ${h} H ${t} A ${w / 2 - t} ${h - t} 0 0 1 ${w - t} ${h} H ${w} A ${w / 2} ${h} 0 0 0 0 ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'pentagon') {
      return `<polygon points="${generateRegularPolygon(5)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'hexagon-vertical') {
      return `<polygon points="${w * 0.5},0 ${w},${h * 0.25} ${w},${h * 0.75} ${w * 0.5},${h} 0,${h * 0.75} 0,${h * 0.25}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'hexagon') {
      return `<polygon points="${w * 0.25},0 ${w * 0.75},0 ${w},${h * 0.5} ${w * 0.75},${h} ${w * 0.25},${h} 0,${h * 0.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'octagon') {
      const c = 0.2929;
      return `<polygon points="${w * c},0 ${w * (1 - c)},0 ${w},${h * c} ${w},${h * (1 - c)} ${w * (1 - c)},${h} ${w * c},${h} 0,${h * (1 - c)} 0,${h * c}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'chamfered-rect') {
      const c = Math.min(w, h) * 0.15;
      return `<polygon points="${c},0 ${w - c},0 ${w},${c} ${w},${h - c} ${w - c},${h} ${c},${h} 0,${h - c} 0,${c}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'heptagon') {
      return `<polygon points="${generateRegularPolygon(7)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'decagon') {
      return `<polygon points="${generateRegularPolygon(10)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'star-4') {
      return `<polygon points="${generateStarPolygon(4, 0.28)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'star' || el.shapeType === 'star-5') {
      return `<polygon points="${generateStarPolygon(5, 0.42)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'star-6') {
      return `<polygon points="${generateStarPolygon(6, 0.58)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'star-7') {
      return `<polygon points="${generateStarPolygon(7, 0.5)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'star-8') {
      return `<polygon points="${generateStarPolygon(8, 0.7)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'star-10') {
      return `<polygon points="${generateStarPolygon(10, 0.78)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'star-12') {
      return `<polygon points="${generateStarPolygon(12, 0.8)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'star-16') {
      return `<polygon points="${generateStarPolygon(16, 0.84)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'star-24') {
      return `<polygon points="${generateStarPolygon(24, 0.88)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'star-32') {
      return `<polygon points="${generateStarPolygon(32, 0.91)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flare-8') {
      return `<polygon points="${generateStarPolygon(8, 0.16)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flare-10') {
      return `<polygon points="${generateStarPolygon(10, 0.18)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flare-12') {
      return `<polygon points="${generateStarPolygon(12, 0.2)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'badge') {
      return `<polygon points="${generateStarPolygon(16, 0.76)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'badge-20') {
      return `<polygon points="${generateStarPolygon(20, 0.86)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arrow') {
      const midY = h / 2;
      const head = Math.min(24, Math.max(12, w / 4));
      return `<path d="M 0 ${midY} L ${w} ${midY} M ${w - head} ${midY - head * 0.6} L ${w} ${midY} L ${w - head} ${midY + head * 0.6}" fill="${fill}" stroke="${fill}" stroke-width="${Math.max(4, strokeWidth || 4)}" stroke-linecap="round" stroke-linejoin="round" />`;
    }
    if (el.shapeType === 'arrow-left') {
      const midY = h / 2;
      const head = Math.min(24, Math.max(12, w / 4));
      return `<path d="M ${w} ${midY} L 0 ${midY} M ${head} ${midY - head * 0.6} L 0 ${midY} L ${head} ${midY + head * 0.6}" fill="${fill}" stroke="${fill}" stroke-width="${Math.max(4, strokeWidth || 4)}" stroke-linecap="round" stroke-linejoin="round" />`;
    }
    if (el.shapeType === 'arrow-up') {
      const midX = w / 2;
      const head = Math.min(24, Math.max(12, h / 4));
      return `<path d="M ${midX} ${h} L ${midX} 0 M ${midX - head * 0.6} ${head} L ${midX} 0 L ${midX + head * 0.6} ${head}" fill="${fill}" stroke="${fill}" stroke-width="${Math.max(4, strokeWidth || 4)}" stroke-linecap="round" stroke-linejoin="round" />`;
    }
    if (el.shapeType === 'arrow-down') {
      const midX = w / 2;
      const head = Math.min(24, Math.max(12, h / 4));
      return `<path d="M ${midX} 0 L ${midX} ${h} M ${midX - head * 0.6} ${h - head} L ${midX} ${h} L ${midX + head * 0.6} ${h - head}" fill="${fill}" stroke="${fill}" stroke-width="${Math.max(4, strokeWidth || 4)}" stroke-linecap="round" stroke-linejoin="round" />`;
    }
    if (el.shapeType === 'arrow-block-right') {
      return `<polygon points="0,${h * 0.25} ${w * 0.55},${h * 0.25} ${w * 0.55},0 ${w},${h * 0.5} ${w * 0.55},${h} ${w * 0.55},${h * 0.75} 0,${h * 0.75}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arrow-block-left') {
      return `<polygon points="${w},${h * 0.25} ${w * 0.45},${h * 0.25} ${w * 0.45},0 0,${h * 0.5} ${w * 0.45},${h} ${w * 0.45},${h * 0.75} ${w},${h * 0.75}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arrow-block-up') {
      return `<polygon points="${w * 0.25},${h} ${w * 0.25},${h * 0.55} 0,${h * 0.55} ${w * 0.5},0 ${w},${h * 0.55} ${w * 0.75},${h * 0.55} ${w * 0.75},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arrow-block-down') {
      return `<polygon points="${w * 0.25},0 ${w * 0.25},${h * 0.45} 0,${h * 0.45} ${w * 0.5},${h} ${w},${h * 0.45} ${w * 0.75},${h * 0.45} ${w * 0.75},0" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arrow-double-horizontal') {
      return `<polygon points="${w * 0.25},0 0,${h * 0.5} ${w * 0.25},${h} ${w * 0.25},${h * 0.7} ${w * 0.75},${h * 0.7} ${w * 0.75},${h} ${w},${h * 0.5} ${w * 0.75},0 ${w * 0.75},${h * 0.3} ${w * 0.25},${h * 0.3}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arrow-double-vertical') {
      return `<polygon points="0,${h * 0.25} ${w * 0.5},0 ${w},${h * 0.25} ${w * 0.7},${h * 0.25} ${w * 0.7},${h * 0.75} ${w},${h * 0.75} ${w * 0.5},${h} 0,${h * 0.75} ${w * 0.3},${h * 0.75} ${w * 0.3},${h * 0.25}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arrow-pentagon-right') {
      return `<polygon points="0,0 ${w * 0.7},0 ${w},${h * 0.5} ${w * 0.7},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arrow-chevron-right') {
      return `<polygon points="0,0 ${w * 0.65},0 ${w},${h * 0.5} ${w * 0.65},${h} 0,${h} ${w * 0.35},${h * 0.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arrow-notched-left') {
      return `<polygon points="${w},0 ${w * 0.4},0 ${w * 0.4},${h * 0.2} 0,${h * 0.5} ${w * 0.4},${h * 0.8} ${w * 0.4},${h} ${w},${h} ${w * 0.75},${h * 0.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'arrow-bidirectional-bold') {
      return `<polygon points="${w * 0.28},${h * 0.15} 0,${h * 0.5} ${w * 0.28},${h * 0.85} ${w * 0.28},${h * 0.65} ${w * 0.72},${h * 0.65} ${w * 0.72},${h * 0.85} ${w},${h * 0.5} ${w * 0.72},${h * 0.15} ${w * 0.72},${h * 0.35} ${w * 0.28},${h * 0.35}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-preparation') {
      return `<polygon points="${w * 0.2},0 ${w * 0.8},0 ${w},${h * 0.5} ${w * 0.8},${h} ${w * 0.2},${h} 0,${h * 0.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-terminator') {
      return `<rect x="0" y="0" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-process-rounded') {
      return `<rect x="0" y="0" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.15}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-decision') {
      return `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-document') {
      return `<path d="M 0 0 H ${w} V ${h * 0.78} C ${w * 0.78} ${h * 0.94} ${w * 0.68} ${h * 0.66} ${w * 0.48} ${h * 0.82} C ${w * 0.32} ${h * 0.95} ${w * 0.16} ${h * 0.82} 0 ${h * 0.88} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-data') {
      return `<polygon points="${w * 0.22},0 ${w},0 ${w * 0.78},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-manual') {
      return `<polygon points="0,0 ${w},0 ${w * 0.82},${h} ${w * 0.18},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-delay') {
      return `<path d="M 0 0 H ${w * 0.55} A ${h / 2} ${h / 2} 0 0 1 ${w * 0.55} ${h} H 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-merge') {
      return `<polygon points="0,0 ${w},0 ${w / 2},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-display') {
      return `<polygon points="${w * 0.25},0 ${w},0 ${w},${h} ${w * 0.25},${h} 0,${h * 0.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'flowchart-offpage') {
      return `<polygon points="0,0 ${w},0 ${w},${h * 0.65} ${w * 0.5},${h} 0,${h * 0.65}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'heart') {
      return `<path d="M ${w / 2} ${h * 0.85} C ${w * 0.15} ${h * 0.6} 0 ${h * 0.35} 0 ${h * 0.22} C 0 ${h * 0.08} ${w * 0.2} 0 ${w * 0.38} 0 C ${w * 0.45} 0 ${w / 2} ${h * 0.12} ${w / 2} ${h * 0.12} C ${w / 2} ${h * 0.12} ${w * 0.55} 0 ${w * 0.62} 0 C ${w * 0.8} 0 ${w} ${h * 0.08} ${w} ${h * 0.22} C ${w} ${h * 0.35} ${w * 0.85} ${h * 0.6} ${w / 2} ${h * 0.85} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'callout') {
      const r = Math.min(w, h) * 0.1;
      return `<path d="M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h * 0.7 - r} A ${r} ${r} 0 0 1 ${w - r} ${h * 0.7} H ${w * 0.45} L ${w * 0.25} ${h} L ${w * 0.3} ${h * 0.7} H ${r} A ${r} ${r} 0 0 1 0 ${h * 0.7 - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'cloud') {
      return `<path d="M ${w * 0.25} ${h * 0.75} A ${h * 0.25} ${h * 0.25} 0 0 1 ${w * 0.18} ${h * 0.35} A ${h * 0.28} ${h * 0.28} 0 0 1 ${w * 0.45} ${h * 0.2} A ${h * 0.35} ${h * 0.35} 0 0 1 ${w * 0.78} ${h * 0.35} A ${h * 0.25} ${h * 0.25} 0 0 1 ${w * 0.82} ${h * 0.75} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (el.shapeType === 'lightning') {
      return `<polygon points="${w * 0.55},0 ${w * 0.15},${h * 0.55} ${w * 0.45},${h * 0.55} ${w * 0.35},${h} ${w * 0.85},${h * 0.42} ${w * 0.55},${h * 0.42}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    return '';
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

    div.innerHTML = `<svg viewBox="0 0 ${el.width} ${el.height}" width="100%" height="100%" style="overflow: visible; display: block;">${this.renderShapeInner(el)}</svg>`;

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
      const dx = (e.clientX - startX) / (this.zoomLevel || 1);
      const dy = (e.clientY - startY) / (this.zoomLevel || 1);
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
      if (element.classList.contains('is-editing')) return;
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

  private makeLineDraggable(node: SVGElement, item: ElementShape): void {
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (this.activeTool !== 'select') return;
      const dx = (e.clientX - startX) / (this.zoomLevel || 1);
      const dy = (e.clientY - startY) / (this.zoomLevel || 1);
      node.setAttribute('transform', `translate(${dx}, ${dy})`);
    };

    const onMouseUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const dx = (e.clientX - startX) / (this.zoomLevel || 1);
      const dy = (e.clientY - startY) / (this.zoomLevel || 1);
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
    this.updateFooterPageInfo();
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
      <div class="collaborative-transform-handle collaborative-transform-handle--rot" data-handle="rot" data-tooltip="Girar" aria-label="Girar">
        <svg class="collaborative-rot-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8"></path>
          <polyline points="21 3 21 8 16 8"></polyline>
        </svg>
      </div>
      <div class="collaborative-transform-handle collaborative-transform-handle--corner collaborative-transform-handle--nw" data-handle="nw"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--corner collaborative-transform-handle--ne" data-handle="ne"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--corner collaborative-transform-handle--se" data-handle="se"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--corner collaborative-transform-handle--sw" data-handle="sw"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--pill collaborative-transform-handle--n" data-handle="n"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--pill collaborative-transform-handle--s" data-handle="s"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--pill collaborative-transform-handle--w" data-handle="w"></div>
      <div class="collaborative-transform-handle collaborative-transform-handle--pill collaborative-transform-handle--e" data-handle="e"></div>
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

    const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
    if (elNode && el.type === 'text' && !el.isStickyNote && (!el.width || !el.height)) {
      el.width = Math.ceil((elNode.offsetWidth || elNode.scrollWidth) + 8);
      el.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
    }

    const width = el.width || 100;
    const height = el.height || 40;

    box.style.left = `${el.x}px`;
    box.style.top = `${el.y}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.transform = `rotate(${el.rotation || 0}deg)`;
    box.style.transformOrigin = 'center center';

    const isNarrow = width < 40 || height < 40;
    box.classList.toggle('is-narrow', isNarrow);
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
    const initialFontSize = el.type === 'text' ? (el.fontSize || 16) : 16;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / (this.zoomLevel || 1);
      const dy = (ev.clientY - startY) / (this.zoomLevel || 1);

      if (el.type === 'text' && !el.isStickyNote) {
        if (handleType === 'e') {
          el.x = initialX;
          el.width = Math.max(30, initialW + dx);
          elNode.style.width = `${el.width}px`;
          elNode.style.height = 'auto';
          el.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
          elNode.style.height = `${el.height}px`;
        } else if (handleType === 'w') {
          const nextW = Math.max(30, initialW - dx);
          el.x = (initialX + initialW) - nextW;
          el.width = nextW;
          elNode.style.width = `${el.width}px`;
          elNode.style.height = 'auto';
          el.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
          elNode.style.height = `${el.height}px`;
        } else if (handleType === 's') {
          el.y = initialY;
          el.height = Math.max(14, initialH + dy);
          elNode.style.height = `${el.height}px`;
        } else if (handleType === 'n') {
          const nextH = Math.max(14, initialH - dy);
          el.y = (initialY + initialH) - nextH;
          el.height = nextH;
          elNode.style.height = `${el.height}px`;
        } else {
          let scale = 1;
          if (handleType === 'se') {
            scale = Math.max(0.2, (initialW + dx) / initialW);
          } else if (handleType === 'sw') {
            scale = Math.max(0.2, (initialW - dx) / initialW);
          } else if (handleType === 'ne') {
            scale = Math.max(0.2, (initialW + dx) / initialW);
          } else if (handleType === 'nw') {
            scale = Math.max(0.2, (initialW - dx) / initialW);
          }

          el.fontSize = Math.max(8, Math.min(144, Math.round(initialFontSize * scale)));
          elNode.style.fontSize = `${el.fontSize}px`;
          elNode.style.width = 'auto';
          elNode.style.height = 'auto';
          el.width = Math.ceil((elNode.offsetWidth || elNode.scrollWidth) + 8);
          el.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);

          if (handleType === 'se') {
            el.x = initialX;
            el.y = initialY;
          } else if (handleType === 'sw') {
            el.x = (initialX + initialW) - el.width;
            el.y = initialY;
          } else if (handleType === 'ne') {
            el.x = initialX;
            el.y = (initialY + initialH) - el.height;
          } else if (handleType === 'nw') {
            el.x = (initialX + initialW) - el.width;
            el.y = (initialY + initialH) - el.height;
          }

          elNode.style.width = `${el.width}px`;
          elNode.style.height = `${el.height}px`;
          this.updateContextToolbar();
        }
      } else {
        if (handleType === 'se') {
          el.x = initialX;
          el.y = initialY;
          el.width = Math.max(10, initialW + dx);
          el.height = Math.max(10, initialH + dy);
        } else if (handleType === 'ne') {
          const nextH = Math.max(10, initialH - dy);
          el.x = initialX;
          el.y = (initialY + initialH) - nextH;
          el.width = Math.max(10, initialW + dx);
          el.height = nextH;
        } else if (handleType === 'sw') {
          const nextW = Math.max(10, initialW - dx);
          el.x = (initialX + initialW) - nextW;
          el.y = initialY;
          el.width = nextW;
          el.height = Math.max(10, initialH + dy);
        } else if (handleType === 'nw') {
          const nextW = Math.max(10, initialW - dx);
          const nextH = Math.max(10, initialH - dy);
          el.x = (initialX + initialW) - nextW;
          el.y = (initialY + initialH) - nextH;
          el.width = nextW;
          el.height = nextH;
        } else if (handleType === 'e') {
          el.x = initialX;
          el.width = Math.max(10, initialW + dx);
        } else if (handleType === 'w') {
          const nextW = Math.max(10, initialW - dx);
          el.x = (initialX + initialW) - nextW;
          el.width = nextW;
        } else if (handleType === 's') {
          el.y = initialY;
          el.height = Math.max(10, initialH + dy);
        } else if (handleType === 'n') {
          const nextH = Math.max(10, initialH - dy);
          el.y = (initialY + initialH) - nextH;
          el.height = nextH;
        }

        elNode.style.width = `${el.width}px`;
        elNode.style.height = `${el.height}px`;
      }

      elNode.style.left = `${el.x}px`;
      elNode.style.top = `${el.y}px`;

      if (el.type === 'shape') {
        const svgNode = elNode.querySelector('svg');
        if (svgNode) {
          svgNode.setAttribute('viewBox', `0 0 ${el.width} ${el.height}`);
          svgNode.innerHTML = this.renderShapeInner(el);
        }
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
        if (previewTextColor) {
          if (el.color?.startsWith('linear-gradient')) {
            previewTextColor.style.backgroundImage = el.color;
            previewTextColor.style.backgroundColor = 'transparent';
          } else {
            previewTextColor.style.backgroundImage = 'none';
            previewTextColor.style.backgroundColor = el.color || '#000000';
          }
        }

        const btnStickyBg = toolbar.querySelector<HTMLElement>('[data-ref="btn-sticky-bg"]');
        if (el.isStickyNote) {
          if (btnStickyBg) showElement(btnStickyBg);
          const previewStickyBg = toolbar.querySelector<HTMLElement>('[data-ref="preview-sticky-bg"]');
          if (previewStickyBg) {
            if (el.backgroundColor?.startsWith('linear-gradient')) {
              previewStickyBg.style.backgroundImage = el.backgroundColor;
              previewStickyBg.style.backgroundColor = 'transparent';
            } else {
              previewStickyBg.style.backgroundImage = 'none';
              previewStickyBg.style.backgroundColor = el.backgroundColor || '#fef08a';
            }
          }
        } else {
          if (btnStickyBg) hideElement(btnStickyBg);
        }
      } else if (el.type === 'shape') {
        showElement(shapeGroup);
        hideElement(textGroup);

        const previewFill = toolbar.querySelector<HTMLElement>('[data-ref="preview-shape-fill"]');
        if (previewFill) {
          if (el.fillColor?.startsWith('linear-gradient')) {
            previewFill.style.backgroundImage = el.fillColor;
            previewFill.style.backgroundColor = 'transparent';
          } else {
            previewFill.style.backgroundImage = 'none';
            previewFill.style.backgroundColor = el.fillColor || '#000000';
          }
        }

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
        const bg = this.pageBackgrounds[this.selectedPageIndex] || '#ffffff';
        if (bg.startsWith('linear-gradient')) {
          previewPageBg.style.backgroundImage = bg;
          previewPageBg.style.backgroundColor = 'transparent';
        } else {
          previewPageBg.style.backgroundImage = 'none';
          previewPageBg.style.backgroundColor = bg;
        }
      }
    } else {
      hideElement(toolbar);
    }

    if (this.activePanelTab === 'colors') {
      this.highlightActiveColorSwatch();
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

  private openColorMenu(target: 'draw-color' | 'page-bg' | 'shape-fill' | 'shape-stroke' | 'sticky-bg' | 'text-color'): void {
    this.currentColorTarget = target;
    this.ensureDrawerMounted();
    const titleEl = this.queryPanel<HTMLElement>('[data-ref="side-panel-title"]');

    const titles: Record<string, string> = {
      'draw-color': 'Color de trazo',
      'page-bg': 'Color de fondo',
      'shape-fill': 'Color de relleno',
      'shape-stroke': 'Color de borde',
      'sticky-bg': 'Color de nota',
      'text-color': 'Color de texto',
    };

    if (titleEl) {
      titleEl.textContent = titles[target] || 'Color';
    }

    const firstCategoryTitleEl = this.queryPanel<HTMLElement>('[data-ref="txt-color-section-first-title"]');
    if (firstCategoryTitleEl) {
      const categoryTitles: Record<string, string> = {
        'draw-color': 'Colores de trazo',
        'page-bg': 'Colores del fondo',
        'shape-fill': 'Colores de la forma',
        'shape-stroke': 'Colores de la forma',
        'sticky-bg': 'Colores de la nota',
        'text-color': 'Colores del texto',
      };
      firstCategoryTitleEl.textContent = categoryTitles[target] || 'Colores';
    }

    this.activePanelTab = 'colors';
    if (this.drawer) {
      this.drawer.classList.add('is-open');
    }

    const backBtn = this.queryPanel<HTMLElement>('[data-ref="btn-drawer-back"]');
    if (backBtn) {
      hideElement(backBtn);
    }

    const sections = this.queryPanelAll<HTMLElement>('.collaborative-panel-section');
    sections.forEach((sec) => {
      const secRef = sec.getAttribute('data-ref');
      if (secRef === 'panel-section-colors') {
        showElement(sec);
      } else {
        hideElement(sec);
      }
    });

    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');
    if (collabCenter) {
      const btns = collabCenter.querySelectorAll<HTMLElement>('[data-panel-tab]');
      btns.forEach((b) => {
        const tab = b.getAttribute('data-panel-tab');
        b.classList.toggle('is-active', tab === 'colors');
      });
    }

    const colorBtns = this.container.querySelectorAll<HTMLButtonElement>('.collaborative-color-picker-btn');
    colorBtns.forEach((btn) => {
      const ref = btn.getAttribute('data-ref');
      btn.classList.toggle('is-active', ref === `btn-${target}`);
    });

    this.highlightActiveColorSwatch();
    if (this.drawer) {
      renderIcons(this.drawer);
    }
  }

  private applyColorToCurrentTarget(color: string): void {
    if (!this.currentColorTarget) return;

    if (!color.startsWith('linear-gradient')) {
      if (!this.recentColors.includes(color)) {
        this.recentColors.unshift(color);
        if (this.recentColors.length > 7) {
          this.recentColors = this.recentColors.slice(0, 7);
        }
        this.renderRecentColors();
      }
    }

    if (this.currentColorTarget === 'text-color') {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        el.color = color;
        const preview = this.container.querySelector<HTMLElement>('[data-ref="preview-text-color"]');
        if (preview) {
          if (color.startsWith('linear-gradient')) {
            preview.style.backgroundImage = color;
            preview.style.backgroundColor = 'transparent';
          } else {
            preview.style.backgroundImage = 'none';
            preview.style.backgroundColor = color;
          }
        }
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          if (color.startsWith('linear-gradient')) {
            elNode.style.backgroundImage = color;
            elNode.style.webkitBackgroundClip = 'text';
            elNode.style.webkitTextFillColor = 'transparent';
          } else {
            elNode.style.backgroundImage = 'none';
            elNode.style.webkitBackgroundClip = '';
            elNode.style.webkitTextFillColor = '';
            elNode.style.color = color;
          }
        }
        this.setModified(true);
      }
    } else if (this.currentColorTarget === 'sticky-bg') {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text' && el.isStickyNote) {
        el.backgroundColor = color;
        const preview = this.container.querySelector<HTMLElement>('[data-ref="preview-sticky-bg"]');
        if (preview) {
          if (color.startsWith('linear-gradient')) {
            preview.style.backgroundImage = color;
            preview.style.backgroundColor = 'transparent';
          } else {
            preview.style.backgroundImage = 'none';
            preview.style.backgroundColor = color;
          }
        }
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          if (color.startsWith('linear-gradient')) {
            elNode.style.backgroundImage = color;
            elNode.style.backgroundColor = 'transparent';
          } else {
            elNode.style.backgroundImage = 'none';
            elNode.style.backgroundColor = color;
          }
        }
        this.setModified(true);
      }
    } else if (this.currentColorTarget === 'shape-fill') {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        el.fillColor = color;
        const preview = this.container.querySelector<HTMLElement>('[data-ref="preview-shape-fill"]');
        if (preview) {
          if (color.startsWith('linear-gradient')) {
            preview.style.backgroundImage = color;
            preview.style.backgroundColor = 'transparent';
          } else {
            preview.style.backgroundImage = 'none';
            preview.style.backgroundColor = color;
          }
        }
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
      }
    } else if (this.currentColorTarget === 'shape-stroke') {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        el.strokeColor = color;
        if (!el.strokeWidth) el.strokeWidth = 2;
        const preview = this.container.querySelector<HTMLElement>('[data-ref="preview-shape-stroke"]');
        if (preview) preview.style.backgroundColor = color;
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
      }
    } else if (this.currentColorTarget === 'page-bg') {
      if (this.selectedPageIndex === null) return;
      this.pageBackgrounds[this.selectedPageIndex] = color;
      const preview = this.container.querySelector<HTMLElement>('[data-ref="preview-page-bg-color"]');
      if (preview) {
        if (color.startsWith('linear-gradient')) {
          preview.style.backgroundImage = color;
          preview.style.backgroundColor = 'transparent';
        } else {
          preview.style.backgroundImage = 'none';
          preview.style.backgroundColor = color;
        }
      }
      const sheet = this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-${this.selectedPageIndex}"]`);
      if (sheet) {
        if (color.startsWith('linear-gradient')) {
          sheet.style.backgroundImage = color;
          sheet.style.backgroundColor = 'transparent';
        } else {
          sheet.style.backgroundImage = 'none';
          sheet.style.backgroundColor = color;
        }
      }
      this.setModified(true);
    } else if (this.currentColorTarget === 'draw-color') {
      this.drawColor = color;
      const preview = this.container.querySelector<HTMLElement>('[data-ref="preview-draw-color"]');
      if (preview) preview.style.backgroundColor = color;
    }

    this.highlightActiveColorSwatch();
  }

  private highlightActiveColorSwatch(): void {
    let activeColor = '';
    if (this.currentColorTarget === 'text-color') {
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') activeColor = el.color || '#000000';
    } else if (this.currentColorTarget === 'sticky-bg') {
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text' && el.isStickyNote) activeColor = el.backgroundColor || '#fef08a';
    } else if (this.currentColorTarget === 'shape-fill') {
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') activeColor = el.fillColor || '#000000';
    } else if (this.currentColorTarget === 'shape-stroke') {
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') activeColor = el.strokeColor || 'transparent';
    } else if (this.currentColorTarget === 'page-bg') {
      if (this.selectedPageIndex !== null) activeColor = this.pageBackgrounds[this.selectedPageIndex] || '#ffffff';
    } else if (this.currentColorTarget === 'draw-color') {
      activeColor = this.drawColor;
    }

    const swatches = this.queryPanelAll<HTMLButtonElement>('[data-ref="swatch-color"]');
    swatches.forEach((sw) => {
      const color = sw.getAttribute('data-color');
      sw.classList.toggle('is-active', !!color && color.toLowerCase() === activeColor.toLowerCase());
    });
  }

  private renderRecentColors(): void {
    const recentGrid = this.queryPanel<HTMLElement>('[data-ref="grid-recent-colors"]');
    if (!recentGrid) return;
    if (this.recentColors.length === 0) {
      hideElement(recentGrid);
      return;
    }
    showElement(recentGrid);
    recentGrid.innerHTML = '';
    this.recentColors.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `collaborative-color-swatch${color.toLowerCase() === '#ffffff' ? ' collaborative-color-swatch--white' : ''}`;
      btn.setAttribute('data-ref', 'swatch-color');
      btn.setAttribute('data-color', color);
      btn.style.backgroundColor = color;
      btn.setAttribute('data-tooltip', color);
      btn.setAttribute('aria-label', color);
      btn.addEventListener('click', () => {
        this.applyColorToCurrentTarget(color);
      });
      recentGrid.appendChild(btn);
    });
  }

  private async activateZoomEyeDropper(): Promise<void> {
    if (typeof (window as any).EyeDropper === 'function') {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          this.applyColorToCurrentTarget(result.sRGBHex);
        }
        return;
      } catch {
        return;
      }
    }
    this.startCustomZoomLoupe();
  }

  private startCustomZoomLoupe(): void {
    const existing = document.querySelector('.collaborative-zoom-loupe');
    if (existing) existing.remove();

    const loupe = document.createElement('div');
    loupe.className = 'collaborative-zoom-loupe';

    const canvas = document.createElement('canvas');
    canvas.className = 'collaborative-zoom-loupe__canvas';
    canvas.width = 32;
    canvas.height = 32;

    const crosshair = document.createElement('div');
    crosshair.className = 'collaborative-zoom-loupe__crosshair';

    const badge = document.createElement('div');
    badge.className = 'collaborative-zoom-loupe__badge';
    badge.textContent = '#000000';

    loupe.appendChild(canvas);
    loupe.appendChild(crosshair);
    loupe.appendChild(badge);
    document.body.appendChild(loupe);

    const ctx = canvas.getContext('2d');
    let currentColor = '#000000';

    const rgbToHex = (r: number, g: number, b: number): string => {
      return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
    };

    const parseRgb = (str: string): string => {
      const m = str.match(/\d+/g);
      if (m && m.length >= 3) {
        return rgbToHex(parseInt(m[0], 10), parseInt(m[1], 10), parseInt(m[2], 10));
      }
      return '#000000';
    };

    const onMouseMove = (e: MouseEvent) => {
      loupe.style.left = `${e.clientX}px`;
      loupe.style.top = `${e.clientY}px`;

      loupe.style.display = 'none';
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      loupe.style.display = 'block';

      if (target) {
        const cs = window.getComputedStyle(target);
        let colorStr = cs.backgroundColor;
        if (!colorStr || colorStr === 'rgba(0, 0, 0, 0)' || colorStr === 'transparent') {
          colorStr = cs.color || (target as any).getAttribute?.('fill') || cs.fill || '#ffffff';
        }
        currentColor = colorStr.startsWith('#') ? colorStr : parseRgb(colorStr);
        badge.textContent = currentColor.toUpperCase();

        if (ctx) {
          ctx.fillStyle = currentColor;
          ctx.fillRect(0, 0, 32, 32);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillRect(15, 0, 2, 32);
          ctx.fillRect(0, 15, 32, 2);
        }
      }
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown);
      loupe.remove();
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.applyColorToCurrentTarget(currentColor);
      cleanup();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick, { capture: true, once: true });
    window.addEventListener('keydown', onKeyDown, { once: true });
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
      const url = `${window.location.origin}/d/${encodeURIComponent(this.docId)}`;
      void navigator.clipboard.writeText(url).then(() => {
        showToast('Enlace de colaboración copiado al portapapeles', 'info');
      });
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

    const btnDrawColor = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-draw-color"]');
    btnDrawColor?.addEventListener('click', () => {
      this.openColorMenu('draw-color');
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
        if (elNode) {
          elNode.style.fontSize = `${el.fontSize}px`;
          if (!el.isStickyNote) {
            elNode.style.width = 'auto';
            elNode.style.height = 'auto';
            el.width = Math.ceil(elNode.offsetWidth || elNode.scrollWidth);
            el.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
            elNode.style.width = `${el.width}px`;
            elNode.style.height = `${el.height}px`;
          }
        }
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
        if (elNode) {
          elNode.style.fontSize = `${el.fontSize}px`;
          if (!el.isStickyNote) {
            elNode.style.width = 'auto';
            elNode.style.height = 'auto';
            el.width = Math.ceil(elNode.offsetWidth || elNode.scrollWidth);
            el.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
            elNode.style.width = `${el.width}px`;
            elNode.style.height = `${el.height}px`;
          }
        }
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
        if (elNode) {
          elNode.style.fontWeight = el.isBold ? 'bold' : 'normal';
          if (!el.isStickyNote) {
            elNode.style.width = 'auto';
            elNode.style.height = 'auto';
            el.width = Math.ceil(elNode.offsetWidth || elNode.scrollWidth);
            el.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
            elNode.style.width = `${el.width}px`;
            elNode.style.height = `${el.height}px`;
          }
        }
        this.updateContextToolbar();
        this.updateTransformBoxPosition();
        this.setModified(true);
      }
    }, { signal });

    const btnTextColor = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-text-color"]');
    btnTextColor?.addEventListener('click', () => {
      this.openColorMenu('text-color');
    }, { signal });

    const btnStickyBg = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sticky-bg"]');
    btnStickyBg?.addEventListener('click', () => {
      this.openColorMenu('sticky-bg');
    }, { signal });

    const btnShapeFill = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-shape-fill"]');
    btnShapeFill?.addEventListener('click', () => {
      this.openColorMenu('shape-fill');
    }, { signal });

    const btnShapeStroke = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-shape-stroke"]');
    btnShapeStroke?.addEventListener('click', () => {
      this.openColorMenu('shape-stroke');
    }, { signal });

    const btnPageBg = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-bg-color"]');
    btnPageBg?.addEventListener('click', () => {
      this.openColorMenu('page-bg');
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

    const sliderZoom = this.container.querySelector<HTMLInputElement>('[data-ref="slider-zoom"]');
    sliderZoom?.addEventListener('input', () => {
      const val = parseFloat(sliderZoom.value);
      this.setZoom(val / 100);
    }, { signal });

    const btnZoomReset = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-reset"]');
    btnZoomReset?.addEventListener('click', () => this.setZoom(1.0), { signal });

    workspace?.addEventListener('wheel', (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        this.setZoom(this.zoomLevel + delta);
      }
    }, { passive: false, signal });
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

  private setZoom(level: number): void {
    const clamped = Math.max(0.10, Math.min(3.0, Math.round(level * 100) / 100));
    this.zoomLevel = clamped;

    const txtZoomLevel = this.container.querySelector<HTMLElement>('[data-ref="txt-zoom-level"]');
    const sliderZoom = this.container.querySelector<HTMLInputElement>('[data-ref="slider-zoom"]');
    if (txtZoomLevel) {
      txtZoomLevel.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
    if (sliderZoom) {
      if (document.activeElement !== sliderZoom) {
        sliderZoom.value = `${Math.round(this.zoomLevel * 100)}`;
      }
      const pct = Math.max(0, Math.min(100, ((this.zoomLevel * 100 - 10) / (300 - 10)) * 100));
      sliderZoom.style.setProperty('--slider-pct', `${pct}%`);
    }

    const scaledW = Math.round(PAGE_WIDTH * this.zoomLevel);
    const scaledH = Math.round(PAGE_HEIGHT * this.zoomLevel);
    const headerW = Math.max(340, scaledW);

    const scalers = this.container.querySelectorAll<HTMLElement>('.collaborative-page-sheet-scaler');
    scalers.forEach((s) => {
      s.style.width = `${scaledW}px`;
      s.style.height = `${scaledH}px`;
    });

    const sheets = this.container.querySelectorAll<HTMLElement>('.collaborative-page-sheet');
    sheets.forEach((sh) => {
      sh.style.transform = `scale(${this.zoomLevel})`;
      sh.style.transformOrigin = 'top left';
    });

    const headers = this.container.querySelectorAll<HTMLElement>('.collaborative-page-header');
    headers.forEach((h) => {
      h.style.width = `${headerW}px`;
    });

    this.updateTransformBoxPosition();
  }

  private zoomIn(): void {
    this.setZoom(this.zoomLevel + 0.1);
  }

  private zoomOut(): void {
    this.setZoom(this.zoomLevel - 0.1);
  }

  private zoomFit(): void {
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
    if (!workspace) return;
    const availableW = workspace.clientWidth - 64;
    const fitLevel = Math.max(0.10, Math.min(2.0, availableW / PAGE_WIDTH));
    this.setZoom(fitLevel);
  }

  private updateFooterPageInfo(): void {
    const txtPageInfo = this.container.querySelector<HTMLElement>('[data-ref="txt-footer-page-info"]');
    if (!txtPageInfo) return;
    const current = (this.selectedPageIndex !== null ? this.selectedPageIndex : (this.activePageIndex ?? 0)) + 1;
    txtPageInfo.textContent = `${Math.min(current, this.pageCount)} de ${this.pageCount}`;
  }

  private renderUploadsGrid(): void {
    const grid = this.queryPanel<HTMLElement>('[data-ref="uploads-grid"]');
    const emptyState = this.queryPanel<HTMLElement>('[data-ref="empty-uploads"]');
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
            <span class="collaborative-upload-card__name" title="${asset.name}">${asset.name}</span>
          </div>
        `;

        const img = card.querySelector<HTMLImageElement>('.collaborative-upload-card__img');
        if (img) {
          const applyRatioClass = (w: number, h: number) => {
            if (!w || !h) return;
            const ratio = w / h;
            if (ratio >= 2.2) {
              card.classList.add('collaborative-upload-card--full');
            } else if (ratio >= 1.3) {
              card.classList.add('collaborative-upload-card--wide');
            } else if (ratio <= 0.72) {
              card.classList.add('collaborative-upload-card--tall');
            }
          };

          if (img.complete && img.naturalWidth) {
            applyRatioClass(img.naturalWidth, img.naturalHeight);
          } else {
            img.addEventListener('load', () => {
              applyRatioClass(img.naturalWidth, img.naturalHeight);
            });
          }
        }

        card.addEventListener('click', () => {
          this.addImageElement(asset);
        });
      } else {
        card.classList.add('collaborative-upload-card--tall');
        const pageLabel = `${asset.pageCount || 1} ${(asset.pageCount || 1) === 1 ? 'pág' : 'págs'}`;
        card.innerHTML = `
          <div class="collaborative-upload-card__thumb">
            <canvas class="collaborative-upload-card__canvas" data-ref="pdf-card-canvas-${asset.id}"></canvas>
            <span class="collaborative-upload-card__badge">PDF · ${pageLabel}</span>
            <span class="collaborative-upload-card__name" title="${asset.name}">${asset.name}</span>
          </div>
        `;

        const canvas = card.querySelector<HTMLCanvasElement>('canvas');
        if (canvas) {
          void renderPdfThumbnail(asset.url, canvas, {
            pageNum: 1,
            targetWidth: 160,
          });
        }

        card.addEventListener('click', () => {
          this.openPdfApplyPanel(asset);
        });
      }

      grid.appendChild(card);
    }

    renderIcons(grid);
  }

  private closePdfApplyPanel(): void {
    const mainView = this.queryPanel<HTMLElement>('[data-ref="uploads-main-view"]');
    const pdfPanel = this.queryPanel<HTMLElement>('[data-ref="pdf-apply-panel"]');
    const backBtn = this.queryPanel<HTMLElement>('[data-ref="btn-drawer-back"]');
    const titleEl = this.queryPanel<HTMLElement>('[data-ref="side-panel-title"]');
    if (mainView) showElement(mainView);
    if (pdfPanel) hideElement(pdfPanel);
    if (backBtn) hideElement(backBtn);
    if (titleEl) titleEl.textContent = 'Subidos';
    this.selectedPdfAsset = null;
  }

  private openPdfApplyPanel(asset: UploadedAsset): void {
    this.selectedPdfAsset = asset;
    const mainView = this.queryPanel<HTMLElement>('[data-ref="uploads-main-view"]');
    const pdfPanel = this.queryPanel<HTMLElement>('[data-ref="pdf-apply-panel"]');
    const titleEl = this.queryPanel<HTMLElement>('[data-ref="txt-pdf-apply-name"]');
    const applyTextEl = this.queryPanel<HTMLElement>('[data-ref="txt-apply-all-pages"]');
    const pagesGrid = this.queryPanel<HTMLElement>('[data-ref="pdf-pages-thumbnails-grid"]');
    const backBtn = this.queryPanel<HTMLElement>('[data-ref="btn-drawer-back"]');

    if (mainView) hideElement(mainView);
    if (pdfPanel) showElement(pdfPanel);
    if (backBtn) showElement(backBtn);
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
  (container as any).__controller = controller;
  await controller.init();
  return container;
}
