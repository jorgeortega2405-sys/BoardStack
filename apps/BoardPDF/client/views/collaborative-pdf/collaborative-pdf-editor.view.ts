import { openModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { COLLAB_PAGE_PRESETS, inToPx, mmToPx, PageDimension, PagePreset } from '../../config/collab-page-presets.config.js';
import { currentUser, deleteApi, escapeHtml, getApi, patchApi, postApi, postFormApi, putApi } from '../../services/api.service.js';
import { translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { renderPdfThumbnail } from '../../services/pdf-preview.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { wsService } from '../../services/websocket.service.js';
import { ViewController } from '../../types/common.types.js';
import { getOrCreateGuestIdentity } from '../../utils/collab-identity.util.js';
import { getLocalDraft, saveLocalDraft, setPendingCloudSyncDraft } from '../../utils/collab-local-draft.util.js';
import { debounce, hideElement, showElement, withButtonLoading } from '../../utils/dom.util.js';
import { createCollaborativeDrawerElement } from './collaborative-pdf-drawer.template.js';

interface ElementText {
  authorName?: string;
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

interface ElementTableCell {
  align?: 'center' | 'left' | 'right';
  backgroundColor?: string;
  color?: string;
  isBold?: boolean;
  text: string;
}

interface ElementTable {
  borderColor: string;
  borderWidth: number;
  cellPadding: number;
  cellSpacing: number;
  cells: ElementTableCell[][];
  cols: number;
  headerColor: string;
  height: number;
  id: string;
  pageIndex?: number;
  rotation?: number;
  rowHeights: number[];
  rows: number;
  tableStyle: 'cards' | 'grid' | 'header-accent';
  themeColor: string;
  type: 'table';
  width: number;
  x: number;
  y: number;
}

type EditorElement = ElementDrawing | ElementImage | ElementShape | ElementTable | ElementText;

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
  private autoSaveMaxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private currentColorTarget: 'draw-color' | 'page-bg' | 'shape-fill' | 'shape-stroke' | 'sticky-bg' | 'table-bg' | 'table-border' | 'table-header' | 'text-color' | null = null;
  private recentColors: string[] = [];
  private activeTool: 'draw' | 'lines' | 'select' | 'shapes' | 'stickynotes' | 'text' = 'select';
  private activeUploadFilter: 'all' | 'images' | 'pdfs' = 'all';
  private canEditDoc = true;
  private collabCleanup: (() => void) | null = null;
  private container: HTMLElement;
  private docAccessLevel: 'anyone_with_link' | 'restricted' = 'restricted';
  private docDefaultPageSize: PageDimension = { height: 1123, width: 794 };
  private initialUrlDimensions: PageDimension | null = null;
  private isLoadingDocument = false;
  private docId = '';
  private docMembers: Array<{ avatar_url?: string | null; email?: string; id?: number; role: 'editor' | 'viewer'; user_id: number; username: string }> = [];
  private docTitle = 'Documento sin título';
  private pageSizes: PageDimension[] = [];
  private drawColor = '#000000';
  private drawMode: 'eraser' | 'highlighter' | 'marker' | 'pen' = 'pen';
  private drawThickness = 2;
  private drawer: HTMLElement | null = null;
  private drawerAbortController: AbortController | null = null;
  private drawerRemovalTimer: ReturnType<typeof setTimeout> | null = null;
  private elements: EditorElement[] = [];
  private guestIdentity: { avatarUrl: string; username: string } | null = null;
  private hasPendingSave = false;
  private isAutoSaving = false;
  private isCollabRoomFull = false;
  private isDocOwner = true;
  private isLocalOnly = false;
  private isModified = false;
  private isRestrictedAccess = false;
  private lastCursorBroadcast = 0;
  private lastSavedTimestamp = 0;
  private lockedPages = new Set<number>();
  private myClientId = '';
  private myColor = '#6366f1';
  private pageBackgrounds: string[] = [];
  private pageCount = 1;
  private pagePdfSources: Array<PagePdfSource | null> = [];
  private pageTitles: string[] = [];
  private remoteCursorElements = new Map<string, HTMLElement>();
  private remoteCursorTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private remotePeers = new Map<string, { avatarUrl?: string | null; clientId: string; color: string; isGuest?: boolean; userId?: number | null; username: string }>();
  private selectedElementId: string | null = null;
  private selectedElementIds = new Set<string>();
  private sharePopoverElement: HTMLElement | null = null;
  private cleanupSharePopover: (() => void) | null = null;
  private selectedPageIndex: number | null = null;
  private selectedPdfAsset: UploadedAsset | null = null;
  private shareModalElement: HTMLElement | null = null;
  private uploadedAssets: UploadedAsset[] = [];
  private queryParams?: URLSearchParams;
  private zoomLevel = 1.0;

  constructor(container: HTMLElement, docId?: string, queryParams?: URLSearchParams) {
    this.container = container;
    this.docId = docId || '';
    this.queryParams = queryParams;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();

    const urlParams = this.queryParams || new URLSearchParams(window.location.search);
    const queryW = parseInt(urlParams.get('w') || '0', 10);
    const queryH = parseInt(urlParams.get('h') || '0', 10);
    if (queryW > 0 && queryH > 0) {
      this.initialUrlDimensions = { height: queryH, width: queryW };
      this.docDefaultPageSize = { height: queryH, width: queryW };
      this.pageSizes = [{ height: queryH, width: queryW }];
    }

    if (!this.docId) {
      const queryId = urlParams.get('id');
      const pathMatch = window.location.pathname.match(/^\/d\/([a-zA-Z0-9_-]+)\/?$/);
      this.docId = queryId || (pathMatch ? pathMatch[1] : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`));
    }

    const currentSearch = window.location.search || (this.queryParams ? `?${this.queryParams.toString()}` : '');
    if (window.location.pathname !== `/d/${this.docId}`) {
      window.history.replaceState({}, '', `/d/${encodeURIComponent(this.docId)}${currentSearch}`);
    }

    this.setupRailNavigation();
    const loaded = await this.loadDocument();
    if (!loaded) return;
    this.initCollabWebSocket();
    this.renderPages();
    this.bindEvents();
    void this.loadUploadedAssets();
    this.updateFooterPageInfo();
    this.renderPresenceList();
    renderIcons(this.container);
  }

  destroy(): void {
    this.closeSharePopover();
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.autoSaveMaxWaitTimer) {
      clearTimeout(this.autoSaveMaxWaitTimer);
      this.autoSaveMaxWaitTimer = null;
    }
    for (const timer of this.remoteCursorTimers.values()) {
      clearTimeout(timer);
    }
    this.remoteCursorTimers.clear();
    if (this.collabCleanup) {
      this.collabCleanup();
      this.collabCleanup = null;
    }
    if (this.shareModalElement) {
      this.shareModalElement.remove();
      this.shareModalElement = null;
    }
    for (const el of this.remoteCursorElements.values()) {
      el.remove();
    }
    this.remoteCursorElements.clear();
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

    const elemMainView = this.queryPanel<HTMLElement>('[data-ref="elements-main-view"]');
    const elemShapesView = this.queryPanel<HTMLElement>('[data-ref="elements-shapes-view"]');
    const elemTablesView = this.queryPanel<HTMLElement>('[data-ref="elements-tables-view"]');

    const showShapesView = () => {
      if (elemMainView) hideElement(elemMainView);
      if (elemTablesView) hideElement(elemTablesView);
      if (elemShapesView) showElement(elemShapesView);
    };

    const showTablesView = () => {
      if (elemMainView) hideElement(elemMainView);
      if (elemShapesView) hideElement(elemShapesView);
      if (elemTablesView) showElement(elemTablesView);
    };

    const restoreElementsMain = () => {
      if (elemShapesView) hideElement(elemShapesView);
      if (elemTablesView) hideElement(elemTablesView);
      if (elemMainView) showElement(elemMainView);
    };

    const elemConfigs: Array<{ handler: () => void; ref: string }> = [
      { handler: showShapesView, ref: 'btn-elem-shapes' },
      { handler: showTablesView, ref: 'btn-elem-tables' },
      { handler: () => this.handleRailTabClick('uploads'), ref: 'btn-elem-photos' },
      { handler: () => showToast('Gráficas estadísticas próximamente', 'info'), ref: 'btn-elem-charts' },
    ];

    elemConfigs.forEach(({ handler, ref }) => {
      this.queryPanel<HTMLButtonElement>(`[data-ref="${ref}"]`)?.addEventListener('click', handler, { signal });
    });

    this.queryPanel<HTMLButtonElement>('[data-ref="btn-shapes-back"]')?.addEventListener('click', restoreElementsMain, { signal });
    this.queryPanel<HTMLButtonElement>('[data-ref="btn-tables-back"]')?.addEventListener('click', restoreElementsMain, { signal });

    const tablePresetButtons = this.queryPanelAll<HTMLButtonElement>('[data-table-preset]');
    tablePresetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-table-preset') as 'cards' | 'grid' | 'header-accent';
        const color = btn.getAttribute('data-table-color') || 'gray';
        if (preset) {
          this.addTableElement(preset, color);
        }
      }, { signal });
    });

    const drawerShapeButtons = this.queryPanelAll<HTMLButtonElement>('[data-shape]');
    drawerShapeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const shape = btn.getAttribute('data-shape') as any;
        if (shape) {
          this.addShapeElement(shape);
        }
      }, { signal });
    });

    const btnDrawerBack = this.queryPanel<HTMLButtonElement>('[data-ref="btn-drawer-back"]');
    btnDrawerBack?.addEventListener('click', () => {
      const pdfApplyPanel = this.queryPanel<HTMLElement>('[data-ref="pdf-apply-panel"]');
      if (pdfApplyPanel && !pdfApplyPanel.classList.contains('is-hidden')) {
        this.closePdfApplyPanel();
      }
    }, { signal });

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
      if (mainView) showElement(mainView);
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

  private activateTool(tool: 'draw' | 'lines' | 'select' | 'shapes' | 'stickynotes' | 'text'): void {
    const toolbarButtons = this.container.querySelectorAll<HTMLButtonElement>('.collaborative-toolbar-btn');
    toolbarButtons.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-tool') === tool));
    this.activeTool = tool;
    if (tool === 'select') {
      this.closeSubtoolbars();
    } else if (tool === 'text') {
      this.closeSubtoolbars();
      this.addTextElement('body');
    } else {
      this.openSubtoolbar(tool);
    }
  }

  private activateSelectTool(): void {
    this.activateTool('select');
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

    this.pushElement(newElement);
    this.renderPages();

    const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
    if (elNode) {
      newElement.width = Math.ceil((elNode.offsetWidth || elNode.scrollWidth) + 8);
      newElement.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
      elNode.style.width = `${newElement.width}px`;
      elNode.style.height = `${newElement.height}px`;
      this.broadcastElementUpdate(newElement);
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

    this.pushElement(newShape);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
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

    this.pushElement(newLine);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
  }

  private addStickyNoteElement(color: string): void {
    const id = `sticky_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const myName = currentUser?.username || this.guestIdentity?.username || 'Anónimo';
    const newSticky: ElementText = {
      authorName: myName,
      backgroundColor: color,
      color: '#1e293b',
      fontSize: 15,
      height: 200,
      id,
      isStickyNote: true,
      pageIndex: this.activePageIndex,
      rotation: 0,
      text: '',
      type: 'text',
      width: 200,
      x: 100 + (this.elements.length % 5) * 30,
      y: 150 + (this.elements.length % 5) * 30,
    };

    this.pushElement(newSticky);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();

    const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
    const bodyEl = elNode?.querySelector<HTMLElement>('[data-ref="sticky-body"]');
    bodyEl?.focus();
  }

  private addTableElement(style: 'cards' | 'grid' | 'header-accent', colorTheme: string): void {
    const themeMap: Record<string, { accent: string; tint: string }> = {
      amber: { accent: '#f59e0b', tint: '#fef3c7' },
      blue: { accent: '#3b82f6', tint: '#dbeafe' },
      gray: { accent: '#4b5563', tint: '#f3f4f6' },
      purple: { accent: '#8b5cf6', tint: '#ede9fe' },
      red: { accent: '#ef4444', tint: '#fee2e2' },
    };

    const theme = themeMap[colorTheme] || themeMap.gray;
    const cols = 3;
    const rows = 4;
    const rowHeights = [44, 40, 40, 40];
    const cellSpacing = style === 'cards' ? 6 : 0;
    const cellPadding = 8;
    const borderWidth = style === 'cards' ? 0 : 1.5;
    const borderColor = style === 'cards' ? 'transparent' : theme.accent;
    const headerColor = style === 'grid' ? 'transparent' : theme.accent;
    const width = 450;
    const height = rowHeights.reduce((s, h) => s + h, 0) + (rows + 1) * cellSpacing;

    const cells: ElementTableCell[][] = [];
    cells.push(
      Array.from({ length: cols }, (_, c) => ({
        align: 'left' as const,
        backgroundColor: style === 'grid' ? 'transparent' : theme.accent,
        color: style === 'grid' ? '#1e293b' : '#ffffff',
        isBold: true,
        text: `Encabezado ${c + 1}`,
      }))
    );

    for (let r = 1; r < rows; r++) {
      cells.push(
        Array.from({ length: cols }, (_, c) => ({
          align: 'left' as const,
          backgroundColor: style === 'cards' ? theme.tint : 'transparent',
          color: '#334155',
          isBold: false,
          text: `Dato ${r}.${c + 1}`,
        }))
      );
    }

    const id = `table_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newTable: ElementTable = {
      borderColor,
      borderWidth,
      cellPadding,
      cellSpacing,
      cells,
      cols,
      headerColor,
      height,
      id,
      pageIndex: this.activePageIndex,
      rotation: 0,
      rowHeights,
      rows,
      tableStyle: style,
      themeColor: theme.accent,
      type: 'table',
      width,
      x: 120 + (this.elements.length % 5) * 25,
      y: 160 + (this.elements.length % 5) * 25,
    };

    this.pushElement(newTable);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
  }

  private getPageDimensions(pageIndex: number): PageDimension {
    return this.pageSizes[pageIndex] || this.docDefaultPageSize;
  }

  private initPageSizesFromContent(content: any): void {
    if (content?.pageSize?.width && content?.pageSize?.height) {
      this.docDefaultPageSize = {
        height: content.pageSize.height,
        width: content.pageSize.width,
      };
    }
    if (Array.isArray(content?.pageSizes) && content.pageSizes.length > 0) {
      this.pageSizes = content.pageSizes.map((s: any) => ({
        height: s.height || this.docDefaultPageSize.height,
        width: s.width || this.docDefaultPageSize.width,
      }));
    } else {
      this.pageSizes = Array.from({ length: this.pageCount }, () => ({ ...this.docDefaultPageSize }));
    }
    while (this.pageSizes.length < this.pageCount) {
      this.pageSizes.push({ ...this.docDefaultPageSize });
    }
  }

  private getContentPayload() {
    while (this.pageSizes.length < this.pageCount) {
      this.pageSizes.push({ ...this.docDefaultPageSize });
    }
    while (this.pageBackgrounds.length < this.pageCount) {
      this.pageBackgrounds.push('#ffffff');
    }
    while (this.pagePdfSources.length < this.pageCount) {
      this.pagePdfSources.push(null);
    }
    while (this.pageTitles.length < this.pageCount) {
      this.pageTitles.push('');
    }
    return {
      elements: this.elements,
      pageBackgrounds: this.pageBackgrounds,
      pageCount: this.pageCount,
      pagePdfSources: this.pagePdfSources,
      pageSize: this.docDefaultPageSize,
      pageSizes: this.pageSizes,
      pageTitles: this.pageTitles,
    };
  }

  private addPage(afterIndex?: number, customDim?: PageDimension): void {
    const targetIndex = afterIndex !== undefined ? afterIndex + 1 : this.pageCount;
    this.elements.forEach((el) => {
      if ((el.pageIndex ?? 0) >= targetIndex) {
        el.pageIndex = (el.pageIndex ?? 0) + 1;
      }
    });

    const inheritedDim = afterIndex !== undefined && this.pageSizes[afterIndex]
      ? { ...this.pageSizes[afterIndex] }
      : { ...this.docDefaultPageSize };
    this.pageSizes.splice(targetIndex, 0, customDim ? { ...customDim } : inheritedDim);

    this.pageTitles.splice(targetIndex, 0, '');
    this.pageBackgrounds.splice(targetIndex, 0, '#ffffff');
    this.pagePdfSources.splice(targetIndex, 0, null);
    this.pageCount++;
    this.activePageIndex = targetIndex;
    this.renderPages();
    this.selectPage(targetIndex);
    this.setModified(true);
    this.broadcastDocSync();
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

    const copyDim = this.pageSizes[pageIndex]
      ? { ...this.pageSizes[pageIndex] }
      : { ...this.docDefaultPageSize };
    this.pageSizes.splice(targetIndex, 0, copyDim);

    this.pageTitles.splice(targetIndex, 0, this.pageTitles[pageIndex] ? `${this.pageTitles[pageIndex]} (Copia)` : '');
    this.pageBackgrounds.splice(targetIndex, 0, this.pageBackgrounds[pageIndex] || '#ffffff');
    const sourcePdf = this.pagePdfSources[pageIndex];
    this.pagePdfSources.splice(targetIndex, 0, sourcePdf ? { ...sourcePdf } : null);
    this.pageCount++;
    this.activePageIndex = targetIndex;
    this.renderPages();
    this.selectPage(targetIndex);
    this.setModified(true);
    this.broadcastDocSync();
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

    this.pageSizes.splice(pageIndex, 1);
    this.pageTitles.splice(pageIndex, 1);
    this.pageBackgrounds.splice(pageIndex, 1);
    this.pagePdfSources.splice(pageIndex, 1);
    this.pageCount--;
    this.activePageIndex = Math.max(0, Math.min(this.pageCount - 1, pageIndex));
    this.renderPages();
    this.selectPage(this.activePageIndex);
    this.setModified(true);
    this.broadcastDocSync();
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

    const tmpSize = this.pageSizes[pageIndex];
    this.pageSizes[pageIndex] = this.pageSizes[prev];
    this.pageSizes[prev] = tmpSize;

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
    this.broadcastDocSync();
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

    const tmpSize = this.pageSizes[pageIndex];
    this.pageSizes[pageIndex] = this.pageSizes[next];
    this.pageSizes[next] = tmpSize;

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
    this.broadcastDocSync();
  }

  private rotatePage(pageIndex: number): void {
    const cur = this.getPageDimensions(pageIndex);
    this.pageSizes[pageIndex] = { height: cur.width, width: cur.height };
    this.renderPages();
    this.selectPage(pageIndex);
    this.setModified(true);
    this.broadcastDocSync();
    const isLandscape = this.pageSizes[pageIndex].width > this.pageSizes[pageIndex].height;
    showToast(`Página ${pageIndex + 1} cambiada a ${isLandscape ? 'horizontal' : 'vertical'}`, 'info');
  }

  private openResizePageModal(pageIndex: number): void {
    const curDim = this.getPageDimensions(pageIndex);
    let selectedPresetId = 'custom';
    let currentOrientation: 'landscape' | 'portrait' = curDim.width > curDim.height ? 'landscape' : 'portrait';
    let customUnit: 'in' | 'mm' | 'px' = 'px';

    const matchingPreset = COLLAB_PAGE_PRESETS.find(
      (p) => (p.width === curDim.width && p.height === curDim.height) ||
             (p.width === curDim.height && p.height === curDim.width)
    );
    if (matchingPreset && matchingPreset.id !== 'custom') {
      selectedPresetId = matchingPreset.id;
    }

    const modalBody = document.createElement('div');
    modalBody.className = 'collab-size-modal';
    modalBody.setAttribute('data-ref', 'collab-resize-modal-body');

    modalBody.innerHTML = `
      <div class="collab-size-modal__section" data-ref="section-presets">
        <h4 class="collab-size-modal__section-title">Plantillas de tamaño</h4>
        <div class="collab-size-grid" data-ref="grid-presets">
          ${COLLAB_PAGE_PRESETS.map((p) => `
            <div class="collab-size-card${p.id === selectedPresetId ? ' is-selected' : ''}" data-ref="preset-card-${p.id}" data-preset-id="${p.id}">
              <div class="collab-size-card__icon-box" data-ref="icon-box-${p.id}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${p.icon}"></use></svg>
              </div>
              <div class="collab-size-card__info" data-ref="info-${p.id}">
                <span class="collab-size-card__name">${p.name}</span>
                <span class="collab-size-card__desc">${p.description}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="collab-orientation-wrapper" data-ref="wrapper-orientation">
        <span class="collab-size-modal__section-title">Orientación</span>
        <div class="collab-orientation-toggle" data-ref="toggle-orientation">
          <button type="button" class="collab-orientation-btn${currentOrientation === 'portrait' ? ' is-active' : ''}" data-ref="btn-orient-portrait" data-orient="portrait">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
            <span>Vertical</span>
          </button>
          <button type="button" class="collab-orientation-btn${currentOrientation === 'landscape' ? ' is-active' : ''}" data-ref="btn-orient-landscape" data-orient="landscape">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#slideshow"></use></svg>
            <span>Horizontal</span>
          </button>
        </div>
      </div>

      <div class="collab-custom-wrapper" data-ref="wrapper-custom" style="${selectedPresetId === 'custom' ? '' : 'display: none;'}">
        <span class="collab-size-modal__section-title">Dimensiones personalizadas</span>
        <div class="collab-custom-inputs" data-ref="custom-inputs">
          <label class="field" data-ref="field-custom-w">
            <input class="field__input field__input--h36" data-ref="input-custom-w" type="number" min="50" max="8000" value="${curDim.width}" />
            <span class="field__label">Ancho</span>
          </label>
          <label class="field" data-ref="field-custom-h">
            <input class="field__input field__input--h36" data-ref="input-custom-h" type="number" min="50" max="8000" value="${curDim.height}" />
            <span class="field__label">Alto</span>
          </label>
          <div class="field" data-ref="field-custom-unit">
            <select class="collab-custom-unit-select" data-ref="select-custom-unit">
              <option value="px" selected>Píxeles (px)</option>
              <option value="mm">Milímetros (mm)</option>
              <option value="in">Pulgadas (in)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="collab-size-summary" data-ref="size-summary">
        <span>Dimensiones resultantes:</span>
        <span class="collab-size-summary__strong" data-ref="txt-size-summary">${curDim.width} × ${curDim.height} px</span>
      </div>

      <label class="collab-resize-checkbox-label" data-ref="label-apply-all">
        <input type="checkbox" data-ref="chk-apply-all" />
        <span>Aplicar este tamaño a todas las páginas del documento</span>
      </label>
    `;

    renderIcons(modalBody);

    const cards = modalBody.querySelectorAll<HTMLElement>('[data-preset-id]');
    const customWrapper = modalBody.querySelector<HTMLElement>('[data-ref="wrapper-custom"]');
    const inputCustomW = modalBody.querySelector<HTMLInputElement>('[data-ref="input-custom-w"]');
    const inputCustomH = modalBody.querySelector<HTMLInputElement>('[data-ref="input-custom-h"]');
    const selectUnit = modalBody.querySelector<HTMLSelectElement>('[data-ref="select-custom-unit"]');
    const txtSummary = modalBody.querySelector<HTMLElement>('[data-ref="txt-size-summary"]');
    const btnPortrait = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-orient-portrait"]');
    const btnLandscape = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-orient-landscape"]');
    const chkApplyAll = modalBody.querySelector<HTMLInputElement>('[data-ref="chk-apply-all"]');

    const updateSummary = () => {
      let w = curDim.width;
      let h = curDim.height;
      if (selectedPresetId === 'custom') {
        const rawW = parseFloat(inputCustomW?.value || '800') || 800;
        const rawH = parseFloat(inputCustomH?.value || '600') || 600;
        if (customUnit === 'mm') {
          w = mmToPx(rawW);
          h = mmToPx(rawH);
        } else if (customUnit === 'in') {
          w = inToPx(rawW);
          h = inToPx(rawH);
        } else {
          w = Math.round(rawW);
          h = Math.round(rawH);
        }
      } else {
        const p = COLLAB_PAGE_PRESETS.find((item) => item.id === selectedPresetId);
        if (p) {
          if (currentOrientation === 'landscape') {
            w = Math.max(p.width, p.height);
            h = Math.min(p.width, p.height);
          } else {
            w = Math.min(p.width, p.height);
            h = Math.max(p.width, p.height);
          }
        }
      }
      if (txtSummary) {
        txtSummary.textContent = `${w} × ${h} px (${currentOrientation === 'landscape' ? 'Horizontal' : 'Vertical'})`;
      }
      return { height: h, width: w };
    };

    cards.forEach((card) => {
      card.addEventListener('click', () => {
        cards.forEach((c) => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
        selectedPresetId = card.getAttribute('data-preset-id') || 'a4';

        if (selectedPresetId === 'custom') {
          if (customWrapper) customWrapper.style.display = 'block';
        } else {
          if (customWrapper) customWrapper.style.display = 'none';
          const p = COLLAB_PAGE_PRESETS.find((item) => item.id === selectedPresetId);
          if (p?.defaultOrientation) {
            currentOrientation = p.defaultOrientation;
            if (currentOrientation === 'landscape') {
              btnLandscape?.classList.add('is-active');
              btnPortrait?.classList.remove('is-active');
            } else {
              btnPortrait?.classList.add('is-active');
              btnLandscape?.classList.remove('is-active');
            }
          }
        }
        updateSummary();
      });
    });

    btnPortrait?.addEventListener('click', () => {
      currentOrientation = 'portrait';
      btnPortrait.classList.add('is-active');
      btnLandscape?.classList.remove('is-active');
      updateSummary();
    });

    btnLandscape?.addEventListener('click', () => {
      currentOrientation = 'landscape';
      btnLandscape.classList.add('is-active');
      btnPortrait?.classList.remove('is-active');
      updateSummary();
    });

    inputCustomW?.addEventListener('input', updateSummary);
    inputCustomH?.addEventListener('input', updateSummary);
    selectUnit?.addEventListener('change', () => {
      customUnit = (selectUnit.value as 'in' | 'mm' | 'px') || 'px';
      updateSummary();
    });

    const modal = openModal({
      bodyHtml: modalBody,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--black',
      confirmText: 'Aplicar tamaño',
      description: `Modifica el formato o dimensiones de la página ${pageIndex + 1}.`,
      onConfirm: () => {
        const finalDimensions = updateSummary();
        const applyToAll = !!chkApplyAll?.checked;

        if (applyToAll) {
          this.docDefaultPageSize = { ...finalDimensions };
          this.pageSizes = Array.from({ length: this.pageCount }, () => ({ ...finalDimensions }));
        } else {
          this.pageSizes[pageIndex] = { ...finalDimensions };
        }

        this.renderPages();
        this.selectPage(pageIndex);
        this.setModified(true);
        this.broadcastDocSync();
        modal.close();
        showToast(applyToAll ? 'Tamaño aplicado a todas las páginas' : `Tamaño de página ${pageIndex + 1} actualizado`, 'success');
      },
      showCancel: true,
      showConfirm: true,
      size: 'md',
      title: `Tamaño de Página ${pageIndex + 1}`,
    });
  }

  private async loadDocument(): Promise<boolean> {
    if (!this.docId) return false;
    this.isLoadingDocument = true;
    let serverDoc: any = null;

    try {

      if (!currentUser) {
        const localDraft = getLocalDraft(this.docId);

        if (localDraft) {
          this.isLocalOnly = true;
          this.docTitle = localDraft.title;
          this.docAccessLevel = 'restricted';
          this.isDocOwner = true;
          this.canEditDoc = true;
          this.docMembers = [];
          this.pageCount = Math.max(1, localDraft.content?.pageCount || 1);
          this.elements = Array.isArray(localDraft.content?.elements) ? localDraft.content.elements : [];
          this.pageTitles = Array.isArray(localDraft.content?.pageTitles) && localDraft.content.pageTitles.length > 0 ? localDraft.content.pageTitles : [''];
          this.pageBackgrounds = Array.isArray(localDraft.content?.pageBackgrounds) && localDraft.content.pageBackgrounds.length > 0 ? localDraft.content.pageBackgrounds : ['#ffffff'];
          this.pagePdfSources = Array.isArray(localDraft.content?.pagePdfSources) && localDraft.content.pagePdfSources.length > 0 ? localDraft.content.pagePdfSources : [null];
          this.initPageSizesFromContent(localDraft.content);

          if (this.initialUrlDimensions && this.elements.length === 0) {
            this.docDefaultPageSize = { ...this.initialUrlDimensions };
            this.pageSizes = Array.from({ length: this.pageCount }, () => ({ ...this.docDefaultPageSize }));
          }
        } else {
          try {
            const getUrl = API_ROUTES.collaborativeDocs.byId(this.docId) + (this.initialUrlDimensions ? `?w=${this.initialUrlDimensions.width}&h=${this.initialUrlDimensions.height}` : '');
            const res = await getApi(getUrl);
            if (res.ok) {
              const data = await res.json();
              serverDoc = data.document;
              if (data.document) {
                this.isLocalOnly = false;
                this.docTitle = data.document.title || 'Documento sin título';
                this.docAccessLevel = data.document.access_level || 'restricted';
                this.isDocOwner = data.isOwner ?? false;
                this.canEditDoc = data.canEdit ?? true;
                this.docMembers = Array.isArray(data.document.members) ? data.document.members : [];
                this.pageCount = Math.max(1, data.document.page_count || data.document.content?.pageCount || 1);
                this.elements = Array.isArray(data.document.content?.elements) ? data.document.content.elements : [];
                this.pageTitles = Array.isArray(data.document.content?.pageTitles) && data.document.content.pageTitles.length > 0 ? data.document.content.pageTitles : [''];
                this.pageBackgrounds = Array.isArray(data.document.content?.pageBackgrounds) && data.document.content.pageBackgrounds.length > 0 ? data.document.content.pageBackgrounds : ['#ffffff'];
                this.pagePdfSources = Array.isArray(data.document.content?.pagePdfSources) && data.document.content.pagePdfSources.length > 0 ? data.document.content.pagePdfSources : [null];
                this.initPageSizesFromContent(data.document.content);

                const serverElements = data.document.content?.elements || [];
                const freshDraft = getLocalDraft(this.docId);
                const targetPageSize = this.initialUrlDimensions || freshDraft?.content?.pageSize;
                if (serverElements.length === 0 && targetPageSize?.width && targetPageSize?.height) {
                  this.docDefaultPageSize = { height: targetPageSize.height, width: targetPageSize.width };
                  this.pageSizes = Array.from({ length: this.pageCount }, () => ({ ...this.docDefaultPageSize }));
                  if (freshDraft?.title) this.docTitle = freshDraft.title;
                  this.scheduleAutoSave(500);
                }
              }
            } else if (res.status === 403) {
              this.isRestrictedAccess = true;
              this.renderRestrictedScreen();
              return false;
            } else {
              const initialDim = this.initialUrlDimensions || { height: 1123, width: 794 };
              const newDraft = saveLocalDraft(this.docId, {
                content: {
                  elements: [],
                  pageBackgrounds: ['#ffffff'],
                  pageCount: 1,
                  pagePdfSources: [null],
                  pageSize: initialDim,
                  pageSizes: [initialDim],
                  pageTitles: [''],
                },
                title: 'Documento sin título',
              });
              this.isLocalOnly = true;
              this.docTitle = newDraft.title;
              this.docAccessLevel = 'restricted';
              this.isDocOwner = true;
              this.canEditDoc = true;
              this.docMembers = [];
              this.pageCount = 1;
              this.elements = [];
              this.pageTitles = [''];
              this.pageBackgrounds = ['#ffffff'];
              this.pagePdfSources = [null];
              this.docDefaultPageSize = { ...initialDim };
              this.pageSizes = [{ ...initialDim }];
            }
          } catch {
            const initialDim = this.initialUrlDimensions || { height: 1123, width: 794 };
            const newDraft = saveLocalDraft(this.docId, {
              content: {
                elements: [],
                pageBackgrounds: ['#ffffff'],
                pageCount: 1,
                pagePdfSources: [null],
                pageSize: initialDim,
                pageSizes: [initialDim],
                pageTitles: [''],
              },
              title: 'Documento sin título',
            });
            this.isLocalOnly = true;
            this.docTitle = newDraft.title;
            this.docAccessLevel = 'restricted';
            this.isDocOwner = true;
            this.canEditDoc = true;
            this.docMembers = [];
            this.pageCount = 1;
            this.elements = [];
            this.pageTitles = [''];
            this.pageBackgrounds = ['#ffffff'];
            this.pagePdfSources = [null];
            this.docDefaultPageSize = { ...initialDim };
            this.pageSizes = [{ ...initialDim }];
          }
        }
      } else {
        try {
          const getUrl = API_ROUTES.collaborativeDocs.byId(this.docId) + (this.initialUrlDimensions ? `?w=${this.initialUrlDimensions.width}&h=${this.initialUrlDimensions.height}` : '');
          const res = await getApi(getUrl);

          if (res.status === 403) {
            this.isRestrictedAccess = true;
            this.renderRestrictedScreen();
            return false;
          }
          if (res.ok) {
            const data = await res.json();
            serverDoc = data.document;

            if (data.document) {
              this.isLocalOnly = false;
              this.docTitle = data.document.title || 'Documento sin título';
              this.docAccessLevel = data.document.access_level || 'restricted';
              this.isDocOwner = data.isOwner ?? true;
              this.canEditDoc = data.canEdit ?? true;
              this.docMembers = Array.isArray(data.document.members) ? data.document.members : [];
              this.pageCount = Math.max(1, data.document.page_count || data.document.content?.pageCount || 1);
              this.elements = Array.isArray(data.document.content?.elements) ? data.document.content.elements : [];
              this.pageTitles = Array.isArray(data.document.content?.pageTitles) && data.document.content.pageTitles.length > 0 ? data.document.content.pageTitles : [''];
              this.pageBackgrounds = Array.isArray(data.document.content?.pageBackgrounds) && data.document.content.pageBackgrounds.length > 0 ? data.document.content.pageBackgrounds : ['#ffffff'];
              this.pagePdfSources = Array.isArray(data.document.content?.pagePdfSources) && data.document.content.pagePdfSources.length > 0 ? data.document.content.pagePdfSources : [null];
              this.initPageSizesFromContent(data.document.content);

              const localDraft = getLocalDraft(this.docId);
              const serverElements = data.document.content?.elements || [];
              const targetPageSize = this.initialUrlDimensions || localDraft?.content?.pageSize;

              if (serverElements.length === 0 && targetPageSize?.width && targetPageSize?.height) {
                this.docDefaultPageSize = { height: targetPageSize.height, width: targetPageSize.width };
                this.pageSizes = Array.from({ length: this.pageCount }, () => ({ ...this.docDefaultPageSize }));
                if (localDraft?.title) this.docTitle = localDraft.title;
                this.scheduleAutoSave(500);
              }
            }
          } else {
            const localDraft = getLocalDraft(this.docId);
            if (localDraft) {
              this.isLocalOnly = true;
              this.docTitle = localDraft.title;
              this.docAccessLevel = 'restricted';
              this.isDocOwner = true;
              this.canEditDoc = true;
              this.docMembers = [];
              this.pageCount = Math.max(1, localDraft.content?.pageCount || 1);
              this.elements = Array.isArray(localDraft.content?.elements) ? localDraft.content.elements : [];
              this.pageTitles = Array.isArray(localDraft.content?.pageTitles) && localDraft.content.pageTitles.length > 0 ? localDraft.content.pageTitles : [''];
              this.pageBackgrounds = Array.isArray(localDraft.content?.pageBackgrounds) && localDraft.content.pageBackgrounds.length > 0 ? localDraft.content.pageBackgrounds : ['#ffffff'];
              this.pagePdfSources = Array.isArray(localDraft.content?.pagePdfSources) && localDraft.content.pagePdfSources.length > 0 ? localDraft.content.pagePdfSources : [null];
              this.initPageSizesFromContent(localDraft.content);

              const targetPageSize = this.initialUrlDimensions || localDraft.content?.pageSize;
              if (targetPageSize?.width && targetPageSize?.height) {
                this.docDefaultPageSize = { height: targetPageSize.height, width: targetPageSize.width };
                this.pageSizes = Array.from({ length: this.pageCount }, () => ({ ...this.docDefaultPageSize }));
              }
              this.scheduleAutoSave(500);
            } else {
              showToast('El documento colaborativo no existe o fue eliminado.', 'danger');
              navigate('/collaborative-pdf');
              return false;
            }
          }
        } catch (netErr) {
          return false;
        }
      }

      try {
        const walRaw = localStorage.getItem(`boardpdf_wal_${this.docId}`);
        if (walRaw) {
          const wal = JSON.parse(walRaw);
          const serverTime = serverDoc?.updated_at ? new Date(serverDoc.updated_at).getTime() : 0;
          if (wal && Array.isArray(wal.elements) && wal.elements.length > 0 && (!serverDoc || wal.timestamp > serverTime)) {
            this.elements = wal.elements;
            if (wal.title) this.docTitle = wal.title;
            if (Array.isArray(wal.pageTitles) && wal.pageTitles.length > 0) this.pageTitles = wal.pageTitles;
            if (Array.isArray(wal.pageBackgrounds) && wal.pageBackgrounds.length > 0) this.pageBackgrounds = wal.pageBackgrounds;
            if (Array.isArray(wal.pagePdfSources) && wal.pagePdfSources.length > 0) this.pagePdfSources = wal.pagePdfSources;
            if (typeof wal.pageCount === 'number') this.pageCount = Math.max(1, wal.pageCount);
            if (Array.isArray(wal.pageSizes) && wal.pageSizes.length > 0) this.pageSizes = wal.pageSizes;
            if (wal.pageSize?.width && wal.pageSize?.height) this.docDefaultPageSize = wal.pageSize;
            this.scheduleAutoSave(500);
          }
        }
      } catch (walErr) {
      }

      const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
      if (titleInput) {
        titleInput.value = this.docTitle;
      }
      this.setSaveStatus('saved');
      return true;
    } finally {
      this.isLoadingDocument = false;
    }
  }

  private renderRestrictedScreen(): void {
    this.container.innerHTML = `
      <div class="component-wrapper component-wrapper--full view-wrapper" style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;box-sizing:border-box;">
        <div class="collab-share-card" style="text-align:center;align-items:center;max-width:420px;">
          <div class="collab-access-icon-circle" style="width:64px;height:64px;margin-bottom:8px;">
            <svg class="component-icon" style="width:32px;height:32px;color:#ef4444;" aria-hidden="true"><use href="/icons.svg#shield"></use></svg>
          </div>
          <h2 class="collab-share-title">Acceso restringido</h2>
          <p style="color:var(--text-muted,#6b7280);font-size:14px;line-height:1.5;margin:0 0 16px 0;">Solo las personas invitadas por el creador del diseño pueden acceder a este enlace.</p>
          <a class="component-button component-button--black component-button--h44" href="/collaborative-pdf" style="width:100%;">Volver a Mis Documentos</a>
        </div>
      </div>
    `;
    renderIcons(this.container);
  }

  private writeLocalWal(): void {
    if (this.isLoadingDocument || !this.docId) return;
    try {
      const walData = {
        elements: this.elements,
        pageBackgrounds: this.pageBackgrounds,
        pageCount: this.pageCount,
        pagePdfSources: this.pagePdfSources,
        pageSize: this.docDefaultPageSize,
        pageSizes: this.pageSizes,
        pageTitles: this.pageTitles,
        timestamp: Date.now(),
        title: this.docTitle,
      };
      localStorage.setItem(`boardpdf_wal_${this.docId}`, JSON.stringify(walData));
    } catch {}
  }

  private setModified(val: boolean): void {
    this.isModified = val;
    if (val) {
      this.writeLocalWal();
      this.scheduleAutoSave();
    } else {
      this.setSaveStatus('saved');
    }
  }

  private setSaveStatus(status: 'saving' | 'saved' | 'error'): void {
    const cloudBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cloud-status"]');
    const footerStatus = this.container.querySelector<HTMLElement>('[data-ref="txt-footer-status"]');

    if (cloudBtn) {
      cloudBtn.classList.remove('is-saving', 'is-saved', 'btn-cloud-status--dirty');
      const iconUse = cloudBtn.querySelector('use');
      if (status === 'error') {
        cloudBtn.classList.add('is-error');
        iconUse?.setAttribute('href', '/icons.svg#cloud_off');
        cloudBtn.setAttribute('data-tooltip', 'Error al sincronizar. Clic para reintentar.');
        cloudBtn.setAttribute('aria-label', 'Error al sincronizar');
      } else {
        cloudBtn.classList.remove('is-error');
        iconUse?.setAttribute('href', '/icons.svg#cloud');
        if (status === 'saving') {
          cloudBtn.setAttribute('data-tooltip', 'Guardando cambios automáticamente...');
          cloudBtn.setAttribute('aria-label', 'Guardando cambios...');
        } else {
          cloudBtn.setAttribute('data-tooltip', 'Cambios guardados');
          cloudBtn.setAttribute('aria-label', 'Documento guardado');
        }
      }
    }

    if (footerStatus) {
      footerStatus.textContent =
        status === 'saving' ? 'Guardando...' :
        status === 'saved' ? 'Guardado' :
        'Error de sincronización';
    }
  }

  private scheduleAutoSave(delayMs = 350): void {
    if (!this.docId || !this.canEditDoc) return;
    this.writeLocalWal();
    this.setSaveStatus('saving');
    this.hasPendingSave = true;

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    if (!this.autoSaveMaxWaitTimer) {
      this.autoSaveMaxWaitTimer = setTimeout(() => {
        this.autoSaveMaxWaitTimer = null;
        void this.flushAutoSave();
      }, 1200);
    }

    this.autoSaveTimer = setTimeout(() => {
      if (this.autoSaveMaxWaitTimer) {
        clearTimeout(this.autoSaveMaxWaitTimer);
        this.autoSaveMaxWaitTimer = null;
      }
      void this.flushAutoSave();
    }, delayMs);
  }

  private async flushAutoSave(): Promise<void> {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.autoSaveMaxWaitTimer) {
      clearTimeout(this.autoSaveMaxWaitTimer);
      this.autoSaveMaxWaitTimer = null;
    }

    if (!this.docId || !this.canEditDoc) return;
    if (this.isAutoSaving) {
      this.hasPendingSave = true;
      return;
    }

    this.isAutoSaving = true;
    this.hasPendingSave = false;
    this.setSaveStatus('saving');

    if (this.isLocalOnly) {
      saveLocalDraft(this.docId, {
        content: this.getContentPayload(),
        title: this.docTitle,
      });
      this.lastSavedTimestamp = Date.now();
      this.isModified = false;
      this.setSaveStatus('saved');
      this.isAutoSaving = false;
      if (this.hasPendingSave) {
        this.scheduleAutoSave(200);
      }
      return;
    }

    const payload = {
      content: this.getContentPayload(),
      id: this.docId,
      title: this.docTitle,
    };

    try {
      const res = await putApi(API_ROUTES.collaborativeDocs.byId(this.docId), payload);
      if (res.ok) {
        this.lastSavedTimestamp = Date.now();
        this.isModified = false;
        this.setSaveStatus('saved');
      } else {
        this.setSaveStatus('error');
      }
    } catch {
      this.setSaveStatus('error');
    } finally {
      this.isAutoSaving = false;
      if (this.hasPendingSave) {
        this.scheduleAutoSave(200);
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
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn" data-ref="btn-page-rotate-${p}" data-page-action="rotate" data-page-index="${p}" data-tooltip="Rotar orientación" aria-label="Rotar orientación">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#swap_horiz"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn" data-ref="btn-page-resize-${p}" data-page-action="resize" data-page-index="${p}" data-tooltip="Tamaño de página" aria-label="Tamaño de página">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn" data-ref="btn-page-add-${p}" data-page-action="add" data-page-index="${p}" data-tooltip="Añadir página" aria-label="Añadir página">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#note_add"></use></svg>
        </button>
      `;

      header.appendChild(left);
      header.appendChild(actions);

      const curDim = this.getPageDimensions(p);
      const curPageW = curDim.width;
      const curPageH = curDim.height;

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
          targetWidth: curPageW,
        });
      }

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'collaborative-shapes-svg');
      svg.setAttribute('data-ref', `shapes-svg-${p}`);
      svg.setAttribute('viewBox', `0 0 ${curPageW} ${curPageH}`);

      const canvas = document.createElement('canvas');
      canvas.className = 'collaborative-drawing-canvas';
      canvas.setAttribute('data-ref', `drawing-canvas-${p}`);
      canvas.width = curPageW;
      canvas.height = curPageH;

      const guidesSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      guidesSvg.setAttribute('class', 'collaborative-guides-svg');
      guidesSvg.setAttribute('data-ref', `guides-svg-${p}`);
      guidesSvg.setAttribute('viewBox', `0 0 ${curPageW} ${curPageH}`);

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
        } else if (el.type === 'table') {
          sheet.appendChild(this.createTableElement(el));
        }
      }

      const scaler = document.createElement('div');
      scaler.className = 'collaborative-page-sheet-scaler';
      scaler.setAttribute('data-ref', `page-sheet-scaler-${p}`);
      scaler.setAttribute('data-page-index', p.toString());
      const scaledW = Math.round(curPageW * this.zoomLevel);
      const scaledH = Math.round(curPageH * this.zoomLevel);
      scaler.style.width = `${scaledW}px`;
      scaler.style.height = `${scaledH}px`;

      sheet.style.width = `${curPageW}px`;
      sheet.style.height = `${curPageH}px`;
      sheet.style.transform = `scale(${this.zoomLevel})`;
      sheet.style.transformOrigin = 'top left';

      scaler.appendChild(sheet);

      header.setAttribute('data-page-index', p.toString());
      header.style.width = `${Math.max(340, scaledW)}px`;

      wrapper.appendChild(header);
      wrapper.appendChild(scaler);
      pagesContainer.appendChild(wrapper);

      this.drawFreehandOnCanvas(canvas, p);
      this.bindCanvasDrawing(canvas, p);

      sheet.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return;
        if (this.activeTool !== 'select') return;
        const target = e.target as Element;
        const isCanvasBackground = target === sheet || target === canvas || target === svg || target === guidesSvg;
        if (!isCanvasBackground) return;

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const sheetRect = sheet.getBoundingClientRect();
        const zoom = this.zoomLevel || 1.0;
        const startX = (e.clientX - sheetRect.left) / zoom;
        const startY = (e.clientY - sheetRect.top) / zoom;

        if (!e.shiftKey && !e.ctrlKey) {
          this.selectedElementIds.clear();
          this.selectElement(null);
        }

        let marqueeBox: HTMLElement | null = null;
        let isMarquee = false;

        const onPointerMove = (moveEvt: PointerEvent) => {
          const curX = (moveEvt.clientX - sheetRect.left) / zoom;
          const curY = (moveEvt.clientY - sheetRect.top) / zoom;
          const dist = Math.hypot(moveEvt.clientX - startClientX, moveEvt.clientY - startClientY);
          if (!isMarquee && dist > 4) {
            isMarquee = true;
            marqueeBox = document.createElement('div');
            marqueeBox.className = 'collaborative-marquee-box';
            sheet.appendChild(marqueeBox);
          }
          if (!isMarquee || !marqueeBox) return;

          const left = Math.min(startX, curX);
          const top = Math.min(startY, curY);
          const width = Math.abs(curX - startX);
          const height = Math.abs(curY - startY);

          marqueeBox.style.left = `${left}px`;
          marqueeBox.style.top = `${top}px`;
          marqueeBox.style.width = `${width}px`;
          marqueeBox.style.height = `${height}px`;

          const right = left + width;
          const bottom = top + height;
          const pageElements = this.elements.filter((el): el is ElementImage | ElementShape | ElementTable | ElementText => (el.pageIndex ?? 0) === p && el.type !== 'drawing');

          for (const el of pageElements) {
            const elW = el.width || 60;
            const elH = el.height || 60;
            const elR = el.x + elW;
            const elB = el.y + elH;
            const intersects = !(elR < left || el.x > right || elB < top || el.y > bottom);
            if (intersects) {
              this.selectedElementIds.add(el.id);
            } else if (!moveEvt.shiftKey && !moveEvt.ctrlKey) {
              this.selectedElementIds.delete(el.id);
            }
          }
          this.updateSelection();
        };

        const onPointerUp = () => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          if (marqueeBox) {
            marqueeBox.remove();
            marqueeBox = null;
          }
          if (isMarquee) {
            if (this.selectedElementIds.size === 1) {
              const singleId = Array.from(this.selectedElementIds)[0];
              this.selectElement(singleId);
            } else if (this.selectedElementIds.size > 1) {
              this.selectedElementId = null;
              this.removeTransformBox();
              this.updateSelection();
              this.updateContextToolbar();
            }
          } else {
            this.selectPage(p);
          }
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });
    }

    const footer = document.createElement('div');
    footer.className = 'collaborative-pages-footer';
    const lastPageDim = this.getPageDimensions(this.pageCount - 1);
    const lastScaledW = Math.round(lastPageDim.width * this.zoomLevel);
    footer.style.width = `${Math.max(340, lastScaledW)}px`;
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
        else if (action === 'rotate') this.rotatePage(p);
        else if (action === 'resize') this.openResizePageModal(p);
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
        this.pushElement(newDrawing);
        void this.flushAutoSave();
      }
      currentStroke = [];
    };

    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
  }

  private eraseAt(x: number, y: number, pageIndex: number): void {
    const radius = 24;
    const prevCount = this.elements.length;
    const toRemove: string[] = [];
    this.elements = this.elements.filter((el) => {
      if (el.type !== 'drawing' || (el.pageIndex ?? 0) !== pageIndex) return true;
      const hit = el.points.some((pt) => Math.hypot(pt.x - x, pt.y - y) <= radius);
      if (hit) toRemove.push(el.id);
      return !hit;
    });
    if (this.elements.length !== prevCount) {
      const canvas = this.container.querySelector<HTMLCanvasElement>(`[data-ref="drawing-canvas-${pageIndex}"]`);
      if (canvas) {
        this.drawFreehandOnCanvas(canvas, pageIndex);
      }
      this.setModified(true);
      toRemove.forEach((id) => this.broadcastElementDelete(id, pageIndex));
      void this.flushAutoSave();
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
      div.style.width = `${el.width || 200}px`;
      div.style.height = `${el.height || 200}px`;

      const author = el.authorName || currentUser?.username || this.guestIdentity?.username || 'Anónimo';
      div.innerHTML = `
        <div class="collaborative-sticky-note__body" data-ref="sticky-body" data-placeholder="Escribe una nota...">${escapeHtml(el.text || '')}</div>
        <div class="collaborative-sticky-note__footer" data-ref="sticky-footer">
          <span class="collaborative-sticky-note__author">${escapeHtml(author)}</span>
        </div>
      `;

      const bodyEl = div.querySelector<HTMLElement>('[data-ref="sticky-body"]')!;
      bodyEl.contentEditable = 'false';

      bodyEl.addEventListener('input', () => {
        el.text = bodyEl.innerText;
        this.setModified(true);
        this.broadcastElementUpdate(el);
      });

      bodyEl.addEventListener('blur', () => {
        bodyEl.contentEditable = 'false';
        div.classList.remove('is-editing');
        el.text = bodyEl.innerText;
        this.setModified(true);
        this.broadcastElementUpdate(el);
        void this.flushAutoSave();
      });

      bodyEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          bodyEl.blur();
        }
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
        bodyEl.contentEditable = 'true';
        div.classList.add('is-editing');
        bodyEl.focus();
        const range = document.createRange();
        range.selectNodeContents(bodyEl);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
    } else {
      div.className = 'collaborative-text-box';
      div.style.width = el.width ? `${el.width}px` : 'auto';
      div.style.height = el.height ? `${el.height}px` : 'auto';
      div.contentEditable = 'false';
      div.innerText = el.text || 'Texto';

      div.addEventListener('input', () => {
        el.text = div.innerText;
        div.style.width = 'auto';
        div.style.height = 'auto';
        el.width = Math.ceil((div.offsetWidth || div.scrollWidth) + 8);
        el.height = Math.ceil(div.offsetHeight || div.scrollHeight);
        div.style.width = `${el.width}px`;
        div.style.height = `${el.height}px`;
        this.updateTransformBoxPosition();
        this.setModified(true);
        this.broadcastElementUpdate(el);
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
        div.style.width = 'auto';
        div.style.height = 'auto';
        el.width = Math.ceil((div.offsetWidth || div.scrollWidth) + 8);
        el.height = Math.ceil(div.offsetHeight || div.scrollHeight);
        div.style.width = `${el.width}px`;
        div.style.height = `${el.height}px`;
        this.updateTransformBoxPosition();
        this.setModified(true);
        this.broadcastElementUpdate(el);
        void this.flushAutoSave();
      });

      div.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          div.blur();
        }
      });
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
      if (!div.classList.contains('is-editing')) {
        this.selectElement(el.id);
      }
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

  private createTableElement(el: ElementTable): HTMLElement {
    const div = document.createElement('div');
    div.className = 'collaborative-table-item';
    div.setAttribute('data-ref', `table-element-${el.id}`);
    div.setAttribute('data-element-id', el.id);
    div.style.left = `${el.x}px`;
    div.style.top = `${el.y}px`;
    div.style.width = `${el.width}px`;
    div.style.height = `${el.height}px`;
    div.style.transform = `rotate(${el.rotation || 0}deg)`;
    div.style.transformOrigin = 'center center';

    const wrap = document.createElement('div');
    wrap.className = 'collaborative-table-wrap';

    const table = document.createElement('table');
    table.className = 'collaborative-table-node';
    table.style.borderSpacing = `${el.cellSpacing}px`;
    table.style.borderCollapse = el.cellSpacing > 0 ? 'separate' : 'collapse';

    const setupCell = (cellEl: HTMLTableCellElement, cellData: ElementTableCell) => {
      cellEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!div.classList.contains('is-editing')) {
          this.selectElement(el.id);
        }
      });

      cellEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (cellEl.isContentEditable) return;
        this.selectElement(el.id);
        div.classList.add('is-editing');
        cellEl.classList.add('is-editing');
        cellEl.contentEditable = 'true';
        cellEl.focus();
        const range = document.createRange();
        range.selectNodeContents(cellEl);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });

      cellEl.addEventListener('input', () => {
        cellData.text = cellEl.innerText;
        this.setModified(true);
        this.broadcastElementUpdate(el);
      });

      cellEl.addEventListener('blur', () => {
        cellEl.contentEditable = 'false';
        cellEl.classList.remove('is-editing');
        div.classList.remove('is-editing');
        cellData.text = cellEl.innerText;
        this.setModified(true);
        this.broadcastElementUpdate(el);
        void this.flushAutoSave();
      });

      cellEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          cellEl.blur();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          cellEl.blur();
          const allCells = Array.from(div.querySelectorAll<HTMLElement>('.collaborative-table-cell'));
          const idx = allCells.indexOf(cellEl);
          const next = e.shiftKey ? allCells[idx - 1] : allCells[idx + 1];
          if (next) {
            next.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          }
        }
      });
    };

    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    trHead.style.height = `${el.rowHeights[0] || 44}px`;

    const headCells = el.cells[0] || [];
    headCells.forEach((cell) => {
      const th = document.createElement('th');
      th.className = 'collaborative-table-cell';
      th.style.padding = `${el.cellPadding}px`;
      th.style.border = el.borderWidth > 0 ? `${el.borderWidth}px solid ${el.borderColor}` : 'none';
      if (el.tableStyle === 'cards') th.style.borderRadius = '4px';
      th.style.backgroundColor = cell.backgroundColor || el.headerColor || 'transparent';
      th.style.color = cell.color || (el.tableStyle === 'grid' ? '#1e293b' : '#ffffff');
      th.style.fontWeight = cell.isBold !== false ? '700' : '400';
      th.style.textAlign = cell.align || 'left';
      th.innerText = cell.text;

      setupCell(th, cell);
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const allTrs: HTMLTableRowElement[] = [trHead];

    for (let r = 1; r < el.rows; r++) {
      const tr = document.createElement('tr');
      tr.style.height = `${el.rowHeights[r] || 40}px`;
      const rowCells = el.cells[r] || [];
      rowCells.forEach((cell) => {
        const td = document.createElement('td');
        td.className = 'collaborative-table-cell';
        td.style.padding = `${el.cellPadding}px`;
        td.style.border = el.borderWidth > 0 ? `${el.borderWidth}px solid ${el.borderColor}` : 'none';
        if (el.tableStyle === 'cards') td.style.borderRadius = '4px';
        td.style.backgroundColor = cell.backgroundColor || 'transparent';
        td.style.color = cell.color || '#334155';
        td.style.textAlign = cell.align || 'left';
        td.innerText = cell.text;

        setupCell(td, cell);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
      allTrs.push(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    div.appendChild(wrap);

    const dividersContainer = document.createElement('div');
    dividersContainer.className = 'collaborative-table-dividers';

    const dividerElements: HTMLElement[] = [];
    const repositionDividers = () => {
      let cumY = el.cellSpacing;
      for (let r = 0; r < el.rows - 1; r++) {
        cumY += (el.rowHeights[r] || 40) + el.cellSpacing;
        if (dividerElements[r]) {
          dividerElements[r].style.top = `${cumY - (el.cellSpacing > 0 ? el.cellSpacing / 2 : 0)}px`;
        }
      }
    };

    for (let r = 0; r < el.rows - 1; r++) {
      const divider = document.createElement('div');
      divider.className = 'collaborative-table-row-divider';
      divider.setAttribute('data-row-index', r.toString());

      divider.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        divider.classList.add('is-dragging');
        const startY = e.clientY;
        const startHeight = el.rowHeights[r] || 40;

        const onPointerMove = (ev: PointerEvent) => {
          const dy = (ev.clientY - startY) / (this.zoomLevel || 1);
          const newH = Math.max(24, Math.round(startHeight + dy));
          el.rowHeights[r] = newH;
          if (allTrs[r]) allTrs[r].style.height = `${newH}px`;
          const totalRowH = el.rowHeights.reduce((acc, h) => acc + h, 0);
          el.height = totalRowH + (el.rows + 1) * el.cellSpacing;
          div.style.height = `${el.height}px`;
          wrap.style.height = `${el.height}px`;
          repositionDividers();
          this.updateTransformBoxPosition();
        };

        const onPointerUp = () => {
          divider.classList.remove('is-dragging');
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          this.renderPages();
          this.selectElement(el.id);
          this.setModified(true);
          this.broadcastElementUpdate(el);
          void this.flushAutoSave();
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp, { once: true });
      });

      dividersContainer.appendChild(divider);
      dividerElements.push(divider);
    }

    div.appendChild(dividersContainer);
    repositionDividers();

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

    this.pushElement(newImg);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
    this.setModified(true);
  }

  private makeDraggable(element: HTMLElement, item: ElementImage | ElementShape | ElementTable | ElementText): void {
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (this.activeTool !== 'select') return;
      e.preventDefault();
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
      this.broadcastElementUpdate(item);
      void this.flushAutoSave();
    };

    element.addEventListener('mousedown', (e) => {
      if (element.classList.contains('is-editing')) return;
      const target = e.target as HTMLElement;
      if (target?.isContentEditable || target?.closest('.collaborative-table-row-divider') || target?.closest('.is-editing')) return;
      if (e.button !== 0) return;
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
      this.broadcastElementUpdate(item);
      void this.flushAutoSave();
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
    this.selectedElementIds.clear();
    if (id) {
      this.selectedElementIds.add(id);
    }

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
    const allEls = this.container.querySelectorAll('.collaborative-text-box, .collaborative-shape-item, .collaborative-sticky-note, .collaborative-table-item');
    allEls.forEach((el) => {
      const elId = el.getAttribute('data-element-id');
      const isSelected = (elId && this.selectedElementIds.has(elId)) || elId === this.selectedElementId;
      el.classList.toggle('is-selected', !!isSelected);
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

  private bindTransformHandles(box: HTMLElement, el: ElementImage | ElementShape | ElementTable | ElementText): void {
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

  private startRotating(e: MouseEvent, el: ElementImage | ElementShape | ElementTable | ElementText): void {
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
      this.broadcastElementUpdate(el);
      void this.flushAutoSave();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private startResizing(e: MouseEvent, el: ElementImage | ElementShape | ElementTable | ElementText, handleType: string): void {
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
        if (el.type === 'table') {
          const scaleY = el.height / initialH;
          el.rowHeights = el.rowHeights.map((h) => Math.max(20, Math.round(h * scaleY)));
        }
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
        (e): e is ElementImage | ElementShape | ElementTable | ElementText =>
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
      this.broadcastElementUpdate(el);
      void this.flushAutoSave();
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
      (el): el is ElementImage | ElementShape | ElementTable | ElementText =>
        el.id !== item.id && (el.pageIndex ?? 0) === pageIndex && el.type !== 'drawing'
    );

    const pageDim = this.getPageDimensions(pageIndex);
    const pageW = pageDim.width;
    const pageH = pageDim.height;
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

    checkSnapX(rawX + width / 2, pageW / 2);
    checkSnapX(rawX, 0);
    checkSnapX(rawX + width, pageW);

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

    checkSnapY(rawY + height / 2, pageH / 2);
    checkSnapY(rawY, 0);
    checkSnapY(rawY + height, pageH);

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
    otherElements: Array<ElementImage | ElementShape | ElementTable | ElementText>
  ): void {
    const guidesSvg = this.container.querySelector<SVGElement>(`[data-ref="guides-svg-${pageIndex}"]`);
    if (!guidesSvg) return;

    guidesSvg.innerHTML = '';

    const pageDim = this.getPageDimensions(pageIndex);
    const pageW = pageDim.width;
    const pageH = pageDim.height;
    const linesToDraw: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];

    const myLeft = x;
    const myCenter = x + width / 2;
    const myRight = x + width;

    const myTop = y;
    const myMiddle = y + height / 2;
    const myBottom = y + height;

    const isClose = (a: number, b: number) => Math.abs(a - b) < 1.5;

    if (isClose(myCenter, pageW / 2)) {
      linesToDraw.push({
        x1: pageW / 2,
        x2: pageW / 2,
        y1: 0,
        y2: pageH,
      });
    }

    if (isClose(myMiddle, pageH / 2)) {
      linesToDraw.push({
        x1: 0,
        x2: pageW,
        y1: pageH / 2,
        y2: pageH / 2,
      });
    }

    const vCoords = [myLeft, myCenter, myRight];
    for (const vX of vCoords) {
      const matchingOthers: Array<ElementImage | ElementShape | ElementTable | ElementText> = [];
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
          y2: Math.min(pageH, maxY + 14),
        });
      }
    }

    const hCoords = [myTop, myMiddle, myBottom];
    for (const hY of hCoords) {
      const matchingOthers: Array<ElementImage | ElementShape | ElementTable | ElementText> = [];
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
          x2: Math.min(pageW, maxX + 14),
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
    const tableGroup = toolbar.querySelector<HTMLElement>('[data-ref="context-group-table"]');
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
        if (tableGroup) hideElement(tableGroup);
      } else if (el.type === 'table') {
        if (tableGroup) showElement(tableGroup);
        hideElement(textGroup);
        hideElement(shapeGroup);

        const previewHeader = toolbar.querySelector<HTMLElement>('[data-ref="preview-table-header-color"]');
        if (previewHeader) previewHeader.style.backgroundColor = el.headerColor || el.themeColor || '#4b5563';

        const previewBorder = toolbar.querySelector<HTMLElement>('[data-ref="preview-table-border-color"]');
        if (previewBorder) previewBorder.style.backgroundColor = el.borderColor || '#4b5563';

        const previewBg = toolbar.querySelector<HTMLElement>('[data-ref="preview-table-bg-color"]');
        if (previewBg) previewBg.style.backgroundColor = el.cells[1]?.[0]?.backgroundColor || el.themeColor || '#f3f4f6';

        const btnBorderWidth = toolbar.querySelector<HTMLElement>('[data-ref="btn-table-border-width"]');
        if (btnBorderWidth) btnBorderWidth.setAttribute('data-tooltip', `Grosor de borde: ${el.borderWidth || 0}px`);

        const btnSpacing = toolbar.querySelector<HTMLElement>('[data-ref="btn-table-spacing"]');
        if (btnSpacing) btnSpacing.setAttribute('data-tooltip', `Espaciado de celdas: ${el.cellSpacing || 0}px`);

        const btnPadding = toolbar.querySelector<HTMLElement>('[data-ref="btn-table-padding"]');
        if (btnPadding) btnPadding.setAttribute('data-tooltip', `Relleno de celdas: ${el.cellPadding || 8}px`);
      } else {
        hideElement(textGroup);
        hideElement(shapeGroup);
        if (tableGroup) hideElement(tableGroup);
      }
    } else if (this.selectedPageIndex !== null) {
      showElement(toolbar);
      hideElement(actionGroup);
      showElement(pageGroup);
      hideElement(textGroup);
      hideElement(shapeGroup);
      if (tableGroup) hideElement(tableGroup);

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
      if (tableGroup) hideElement(tableGroup);
      hideElement(toolbar);
    }

    if (this.activePanelTab === 'colors') {
      this.highlightActiveColorSwatch();
    }
  }

  private deleteSelectedElement(): void {
    if (this.selectedElementIds.size > 0) {
      const targetIds = Array.from(this.selectedElementIds);
      for (const id of targetIds) {
        const targetEl = this.elements.find((el) => el.id === id);
        const pIdx = targetEl?.pageIndex ?? 0;
        this.elements = this.elements.filter((el) => el.id !== id);
        this.broadcastElementDelete(id, pIdx);
      }
      this.selectedElementIds.clear();
      this.selectedElementId = null;
      this.removeTransformBox();
      this.renderPages();
      this.setModified(true);
      void this.flushAutoSave();
    } else if (this.selectedElementId) {
      const targetId = this.selectedElementId;
      const targetEl = this.elements.find((el) => el.id === targetId);
      const pIdx = targetEl?.pageIndex ?? 0;
      this.elements = this.elements.filter((el) => el.id !== targetId);
      this.selectedElementId = null;
      this.removeTransformBox();
      this.renderPages();
      this.setModified(true);
      this.broadcastElementDelete(targetId, pIdx);
      void this.flushAutoSave();
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
      this.pushElement(clone);
      this.renderPages();
      this.selectElement(clone.id);
      showToast('Elemento duplicado', 'info');
    } else if (this.selectedPageIndex !== null) {
      this.duplicatePage(this.selectedPageIndex);
    }
  }

  private openColorMenu(target: 'draw-color' | 'page-bg' | 'shape-fill' | 'shape-stroke' | 'sticky-bg' | 'table-bg' | 'table-border' | 'table-header' | 'text-color'): void {
    this.currentColorTarget = target;
    this.ensureDrawerMounted();
    const titleEl = this.queryPanel<HTMLElement>('[data-ref="side-panel-title"]');

    const titles: Record<string, string> = {
      'draw-color': 'Color de trazo',
      'page-bg': 'Color de fondo',
      'shape-fill': 'Color de relleno',
      'shape-stroke': 'Color de borde',
      'sticky-bg': 'Color de nota',
      'table-bg': 'Color de celdas',
      'table-border': 'Color de borde',
      'table-header': 'Color de encabezado',
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
        'table-bg': 'Colores de celdas',
        'table-border': 'Colores de borde',
        'table-header': 'Colores de encabezado',
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
    } else if (this.currentColorTarget === 'table-header') {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') {
        el.headerColor = color;
        el.cells[0]?.forEach((c) => {
          c.backgroundColor = color;
          c.color = '#ffffff';
        });
        const preview = this.container.querySelector<HTMLElement>('[data-ref="preview-table-header-color"]');
        if (preview) preview.style.backgroundColor = color;
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    } else if (this.currentColorTarget === 'table-border') {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') {
        el.borderColor = color;
        if (!el.borderWidth) el.borderWidth = 1.5;
        const preview = this.container.querySelector<HTMLElement>('[data-ref="preview-table-border-color"]');
        if (preview) preview.style.backgroundColor = color;
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    } else if (this.currentColorTarget === 'table-bg') {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') {
        el.themeColor = color;
        for (let r = 1; r < el.rows; r++) {
          el.cells[r]?.forEach((c) => {
            c.backgroundColor = color;
          });
        }
        const preview = this.container.querySelector<HTMLElement>('[data-ref="preview-table-bg-color"]');
        if (preview) preview.style.backgroundColor = color;
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
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
    } else if (this.currentColorTarget === 'table-header') {
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') activeColor = el.headerColor || el.themeColor || '#4b5563';
    } else if (this.currentColorTarget === 'table-border') {
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') activeColor = el.borderColor || '#4b5563';
    } else if (this.currentColorTarget === 'table-bg') {
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') activeColor = el.cells[1]?.[0]?.backgroundColor || el.themeColor || '#f3f4f6';
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
      wsService.send({ title: this.docTitle, type: 'titleChange' });
    }, { signal });

    const cloudBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cloud-status"]');
    cloudBtn?.addEventListener('click', async () => {
      await withButtonLoading(cloudBtn, async () => {
        await this.flushAutoSave();
      });
    }, { signal });

    const shareBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-link"]');
    shareBtn?.addEventListener('click', () => {
      this.openShareModal();
    }, { signal });

    const pagesContainer = this.container.querySelector<HTMLElement>('[data-ref="pages-container"]');
    pagesContainer?.addEventListener('pointermove', (e: PointerEvent) => {
      const now = performance.now();
      if (this.isCollabRoomFull || now - this.lastCursorBroadcast < 35) return;
      this.lastCursorBroadcast = now;
      const targetSheet = (e.target as HTMLElement)?.closest<HTMLElement>('.collaborative-page-sheet');
      if (targetSheet) {
        const pIdx = parseInt(targetSheet.getAttribute('data-page-index') || '0', 10);
        const rect = targetSheet.getBoundingClientRect();
        const scale = this.zoomLevel || 1.0;
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        wsService.send({
          pageIndex: pIdx,
          type: 'cursor',
          x: Math.round(x),
          y: Math.round(y),
        });
      }
    }, { signal });

    window.addEventListener('beforeunload', () => {
      this.writeLocalWal();
      if (this.isLocalOnly) {
        saveLocalDraft(this.docId, {
          content: this.getContentPayload(),
          title: this.docTitle,
        });
        return;
      }
      if (this.hasPendingSave || this.autoSaveTimer) {
        const payload = JSON.stringify({
          content: this.getContentPayload(),
          id: this.docId,
          title: this.docTitle,
        });
        const url = API_ROUTES.collaborativeDocs.byId(this.docId);
        if (typeof navigator.sendBeacon === 'function') {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        }
      }
    }, { signal });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && (this.hasPendingSave || this.autoSaveTimer)) {
        this.writeLocalWal();
        void this.flushAutoSave();
      }
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

    const btnTableHeaderColor = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-table-header-color"]');
    btnTableHeaderColor?.addEventListener('click', () => {
      this.openColorMenu('table-header');
    }, { signal });

    const btnTableBorderColor = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-table-border-color"]');
    btnTableBorderColor?.addEventListener('click', () => {
      this.openColorMenu('table-border');
    }, { signal });

    const btnTableBgColor = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-table-bg-color"]');
    btnTableBgColor?.addEventListener('click', () => {
      this.openColorMenu('table-bg');
    }, { signal });

    const tableBorderWidths = [0, 1, 2, 3, 4];
    const btnTableBorderWidth = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-table-border-width"]');
    btnTableBorderWidth?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') {
        const curIdx = tableBorderWidths.indexOf(el.borderWidth || 0);
        el.borderWidth = tableBorderWidths[(curIdx + 1) % tableBorderWidths.length];
        if (el.borderWidth > 0 && (!el.borderColor || el.borderColor === 'transparent')) {
          el.borderColor = el.headerColor || el.themeColor || '#4b5563';
        }
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });

    const tableSpacings = [0, 4, 8, 12, 16];
    const btnTableSpacing = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-table-spacing"]');
    btnTableSpacing?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') {
        const curIdx = tableSpacings.indexOf(el.cellSpacing || 0);
        el.cellSpacing = tableSpacings[(curIdx + 1) % tableSpacings.length];
        const totalRowH = el.rowHeights.reduce((acc, h) => acc + h, 0);
        el.height = totalRowH + (el.rows + 1) * el.cellSpacing;
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });

    const tablePaddings = [4, 8, 12, 16];
    const btnTablePadding = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-table-padding"]');
    btnTablePadding?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') {
        const curIdx = tablePaddings.indexOf(el.cellPadding || 8);
        el.cellPadding = tablePaddings[(curIdx + 1) % tablePaddings.length];
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });

    const btnTableAddRow = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-table-add-row"]');
    btnTableAddRow?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') {
        const newRowIdx = el.rows;
        el.rows++;
        el.rowHeights.push(40);
        el.cells.push(
          Array.from({ length: el.cols }, (_, c) => ({
            align: 'left' as const,
            backgroundColor: el.tableStyle === 'cards' ? (el.cells[1]?.[0]?.backgroundColor || '#f3f4f6') : 'transparent',
            color: '#334155',
            isBold: false,
            text: `Dato ${newRowIdx}.${c + 1}`,
          }))
        );
        const totalRowH = el.rowHeights.reduce((acc, h) => acc + h, 0);
        el.height = totalRowH + (el.rows + 1) * el.cellSpacing;
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });

    const btnTableDelRow = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-table-del-row"]');
    btnTableDelRow?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table' && el.rows > 1) {
        el.rows--;
        el.rowHeights.pop();
        el.cells.pop();
        const totalRowH = el.rowHeights.reduce((acc, h) => acc + h, 0);
        el.height = totalRowH + (el.rows + 1) * el.cellSpacing;
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });

    const btnTableAddCol = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-table-add-col"]');
    btnTableAddCol?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table') {
        const newColIdx = el.cols;
        el.cols++;
        el.cells[0]?.push({
          align: 'left' as const,
          backgroundColor: el.headerColor || el.themeColor || 'transparent',
          color: el.tableStyle === 'grid' ? '#1e293b' : '#ffffff',
          isBold: true,
          text: `Encabezado ${newColIdx + 1}`,
        });
        for (let r = 1; r < el.rows; r++) {
          el.cells[r]?.push({
            align: 'left' as const,
            backgroundColor: el.tableStyle === 'cards' ? (el.cells[1]?.[0]?.backgroundColor || '#f3f4f6') : 'transparent',
            color: '#334155',
            isBold: false,
            text: `Dato ${r}.${newColIdx + 1}`,
          });
        }
        el.width += 120;
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });

    const btnTableDelCol = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-table-del-col"]');
    btnTableDelCol?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'table' && el.cols > 1) {
        el.cols--;
        for (let r = 0; r < el.rows; r++) {
          el.cells[r]?.pop();
        }
        el.width = Math.max(120, el.width - 120);
        this.renderPages();
        this.selectElement(el.id);
        this.setModified(true);
        this.broadcastElementUpdate(el);
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

    const scalers = this.container.querySelectorAll<HTMLElement>('.collaborative-page-sheet-scaler');
    scalers.forEach((s) => {
      const pIdx = parseInt(s.getAttribute('data-page-index') || '0', 10);
      const dim = this.getPageDimensions(pIdx);
      const scaledW = Math.round(dim.width * this.zoomLevel);
      const scaledH = Math.round(dim.height * this.zoomLevel);
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
      const pIdx = parseInt(h.getAttribute('data-page-index') || '0', 10);
      const dim = this.getPageDimensions(pIdx);
      const scaledW = Math.round(dim.width * this.zoomLevel);
      h.style.width = `${Math.max(340, scaledW)}px`;
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
    const curDim = this.getPageDimensions(this.selectedPageIndex ?? this.activePageIndex ?? 0);
    const fitLevel = Math.max(0.10, Math.min(2.0, availableW / curDim.width));
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

  private pushElement(el: EditorElement, broadcast = true): void {
    this.elements.push(el);
    this.setModified(true);
    if (broadcast && !this.isCollabRoomFull) {
      wsService.send({
        action: 'add',
        element: el,
        pageIndex: el.pageIndex,
        type: 'elementChange',
      });
    }
  }

  private broadcastElementUpdate(el: EditorElement): void {
    if (this.isCollabRoomFull) return;
    wsService.send({
      action: 'update',
      element: el,
      pageIndex: el.pageIndex,
      type: 'elementChange',
    });
  }

  private broadcastElementDelete(id: string, pageIndex: number): void {
    if (this.isCollabRoomFull) return;
    wsService.send({
      action: 'delete',
      element: { id },
      pageIndex,
      type: 'elementChange',
    });
  }

  private broadcastDocSync(): void {
    if (this.isCollabRoomFull) return;
    wsService.send({
      elements: this.elements,
      pageBackgrounds: this.pageBackgrounds,
      pageCount: this.pageCount,
      pageSize: this.docDefaultPageSize,
      pageSizes: this.pageSizes,
      title: this.docTitle,
      type: 'docSync',
    });
  }

  private initCollabWebSocket(): void {
    if (this.isLocalOnly) {
      return;
    }

    const user = currentUser;
    const isGuest = !user;
    let username = user?.username;
    let avatarUrl = user?.avatar_url || null;

    if (isGuest) {
      if (!this.guestIdentity) {
        this.guestIdentity = getOrCreateGuestIdentity();
      }
      username = this.guestIdentity.username;
      avatarUrl = this.guestIdentity.avatarUrl;
    }

    this.collabCleanup = wsService.joinCollabRoom({
      avatarUrl,
      docId: this.docId,
      isGuest,
      onMessage: (msg) => this.handleCollabSocketMessage(msg),
      userId: user?.id || null,
      username: username || 'Invitado',
    });
  }

  private handleCollabSocketMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'joined') {
      this.myClientId = msg.clientId;
      this.myColor = msg.color;
      this.remotePeers.clear();
      if (Array.isArray(msg.peers)) {
        for (const p of msg.peers) {
          this.remotePeers.set(p.clientId, p);
        }
      }
      this.renderPresenceList();
    } else if (msg.type === 'userJoined') {
      if (msg.peer && msg.peer.clientId !== this.myClientId) {
        this.remotePeers.set(msg.peer.clientId, msg.peer);
        this.addPeerPresenceBubble(msg.peer);
        showToast(`${msg.peer.username} se unió al diseño`, 'info');
      }
    } else if (msg.type === 'userLeft') {
      this.removePeerPresenceBubble(msg.clientId);
      this.remotePeers.delete(msg.clientId);
      const cursorEl = this.remoteCursorElements.get(msg.clientId);
      if (cursorEl) {
        cursorEl.remove();
        this.remoteCursorElements.delete(msg.clientId);
      }
      const timer = this.remoteCursorTimers.get(msg.clientId);
      if (timer) {
        clearTimeout(timer);
        this.remoteCursorTimers.delete(msg.clientId);
      }
    } else if (msg.type === 'remoteCursor') {
      if (msg.clientId !== this.myClientId) {
        this.renderRemoteCursor(msg);
      }
    } else if (msg.type === 'elementChange') {
      if (msg.senderClientId !== this.myClientId) {
        this.handleRemoteElementChange(msg.action, msg.element);
      }
    } else if (msg.type === 'docSync') {
      if (msg.senderClientId !== this.myClientId) {
        if (Array.isArray(msg.elements)) this.elements = msg.elements;
        if (Array.isArray(msg.pageBackgrounds)) this.pageBackgrounds = msg.pageBackgrounds;
        if (typeof msg.pageCount === 'number') this.pageCount = msg.pageCount;
        if (Array.isArray(msg.pageSizes)) this.pageSizes = msg.pageSizes;
        if (msg.pageSize) this.docDefaultPageSize = msg.pageSize;
        if (typeof msg.title === 'string') {
          this.docTitle = msg.title;
          const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
          if (titleInput && document.activeElement !== titleInput) titleInput.value = msg.title;
        }
        this.renderPages();
      }
    } else if (msg.type === 'titleChange') {
      if (msg.senderClientId !== this.myClientId && typeof msg.title === 'string') {
        this.docTitle = msg.title;
        const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
        if (titleInput && document.activeElement !== titleInput) {
          titleInput.value = msg.title;
        }
      }
    } else if (msg.type === 'roomFull') {
      this.isCollabRoomFull = true;
      showToast(msg.message || 'La sala colaborativa ha alcanzado el límite máximo de 12 colaboradores simultáneos.', 'warning');
      this.renderPresenceList();
    } else if (msg.type === 'rateLimited') {
      showToast(msg.message || 'Demasiadas acciones por segundo. Por favor reduce la velocidad.', 'warning');
    }
  }

  private addPeerPresenceBubble(peer: { avatarUrl?: string | null; clientId: string; color: string; isGuest?: boolean; username: string }): void {
    const presenceContainer = this.container.querySelector<HTMLElement>('[data-ref="collab-presence-container"]');
    if (!presenceContainer) return;

    let bubble = presenceContainer.querySelector<HTMLElement>(`[data-client-id="${peer.clientId}"]`);
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'collab-presence-bubble collab-presence-bubble--enter';
      bubble.setAttribute('data-client-id', peer.clientId);
      bubble.style.backgroundColor = peer.color;
      const peerLabel = `${peer.username}${peer.isGuest ? ' (Invitado)' : ''}`;
      bubble.setAttribute('data-tooltip', peerLabel);
      bubble.setAttribute('aria-label', peerLabel);
      if (peer.avatarUrl) {
        bubble.innerHTML = `<img src="${peer.avatarUrl}" alt="${peer.username}" />`;
      } else {
        bubble.textContent = peer.username.substring(0, 2).toUpperCase();
      }
      presenceContainer.appendChild(bubble);
    }
  }

  private removePeerPresenceBubble(clientId: string): void {
    const presenceContainer = this.container.querySelector<HTMLElement>('[data-ref="collab-presence-container"]');
    if (!presenceContainer) return;
    const bubble = presenceContainer.querySelector<HTMLElement>(`[data-client-id="${clientId}"]`);
    if (bubble) {
      bubble.classList.remove('collab-presence-bubble--enter');
      bubble.classList.add('collab-presence-bubble--leave');
      setTimeout(() => {
        bubble.remove();
      }, 360);
    }
  }

  private renderPresenceList(): void {
    const presenceContainer = this.container.querySelector<HTMLElement>('[data-ref="collab-presence-container"]');
    if (!presenceContainer) return;

    if (!currentUser && !this.guestIdentity) {
      this.guestIdentity = getOrCreateGuestIdentity();
    }

    presenceContainer.innerHTML = '';

    const myName = currentUser?.username || this.guestIdentity?.username || 'Tú';
    const myAvatar = currentUser?.avatar_url || this.guestIdentity?.avatarUrl || null;
    const myInitials = myName.substring(0, 2).toUpperCase();
    const myBubble = document.createElement('div');
    myBubble.className = 'collab-presence-bubble';
    myBubble.setAttribute('data-client-id', 'me');
    myBubble.style.backgroundColor = this.myColor;
    const fullSuffix = this.isCollabRoomFull ? ' (Sala llena)' : '';
    myBubble.setAttribute('data-tooltip', `${myName} (Tú)${fullSuffix}`);
    myBubble.setAttribute('aria-label', `${myName} (Tú)${fullSuffix}`);
    if (myAvatar) {
      myBubble.innerHTML = `<img src="${myAvatar}" alt="${myName}" />`;
    } else {
      myBubble.textContent = myInitials;
    }
    presenceContainer.appendChild(myBubble);

    for (const peer of this.remotePeers.values()) {
      const peerBubble = document.createElement('div');
      peerBubble.className = 'collab-presence-bubble';
      peerBubble.setAttribute('data-client-id', peer.clientId);
      peerBubble.style.backgroundColor = peer.color;
      const peerLabel = `${peer.username}${peer.isGuest ? ' (Invitado)' : ''}`;
      peerBubble.setAttribute('data-tooltip', peerLabel);
      peerBubble.setAttribute('aria-label', peerLabel);
      if (peer.avatarUrl) {
        peerBubble.innerHTML = `<img src="${peer.avatarUrl}" alt="${peer.username}" />`;
      } else {
        peerBubble.textContent = peer.username.substring(0, 2).toUpperCase();
      }
      presenceContainer.appendChild(peerBubble);
    }
  }

  private renderRemoteCursor(msg: any): void {
    const pageIndex = msg.page_index ?? msg.pageIndex ?? 0;
    const pageEl = this.container.querySelector<HTMLElement>(`.collaborative-page-sheet[data-page-index="${pageIndex}"]`);
    if (!pageEl) return;

    let cursorEl = this.remoteCursorElements.get(msg.clientId);
    if (!cursorEl || cursorEl.parentElement !== pageEl) {
      if (cursorEl) cursorEl.remove();
      cursorEl = document.createElement('div');
      cursorEl.className = 'collab-remote-cursor';
      cursorEl.setAttribute('data-ref', `collab-cursor-${msg.clientId}`);
      const peer = this.remotePeers.get(msg.clientId);
      const peerAvatar = peer?.avatarUrl || msg.avatarUrl || null;
      cursorEl.innerHTML = `
        <svg class="collab-cursor-pointer" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z" fill="${msg.color}" stroke="#ffffff" stroke-width="1.5"/>
        </svg>
        <div class="collab-cursor-badge" style="background-color: ${msg.color};">
          ${peerAvatar ? `<img class="collab-cursor-avatar" src="${peerAvatar}" alt="" />` : ''}
          <span>${escapeHtml(msg.username)}</span>
        </div>
      `;
      pageEl.appendChild(cursorEl);
      this.remoteCursorElements.set(msg.clientId, cursorEl);
    }

    cursorEl.style.transform = `translate(${msg.x}px, ${msg.y}px)`;
    cursorEl.style.opacity = '1';

    const prevTimer = this.remoteCursorTimers.get(msg.clientId);
    if (prevTimer) clearTimeout(prevTimer);
    const newTimer = setTimeout(() => {
      if (cursorEl) cursorEl.style.opacity = '0';
    }, 4000);
    this.remoteCursorTimers.set(msg.clientId, newTimer);
  }

  private handleRemoteElementChange(action: string, element: any): void {
    if (action === 'add') {
      const idx = this.elements.findIndex((e) => e.id === element.id);
      if (idx >= 0) {
        this.elements[idx] = element;
      } else {
        this.elements.push(element);
      }
      this.renderPages();
    } else if (action === 'update') {
      const idx = this.elements.findIndex((e) => e.id === element.id);
      if (idx >= 0) {
        this.elements[idx] = element;
        this.renderPages();
      }
    } else if (action === 'delete') {
      this.elements = this.elements.filter((e) => e.id !== element.id);
      if (this.selectedElementId === element.id) {
        this.selectedElementId = null;
        this.removeTransformBox();
      }
      this.renderPages();
    }
  }

  private closeSharePopover(): void {
    if (this.cleanupSharePopover) {
      this.cleanupSharePopover();
      this.cleanupSharePopover = null;
    } else if (this.sharePopoverElement) {
      this.sharePopoverElement.remove();
      this.sharePopoverElement = null;
    }
  }

  private openShareModal(): void {
    if (this.isLocalOnly) {
      this.openLocalAuthModal();
      return;
    }

    if (this.sharePopoverElement) {
      this.closeSharePopover();
      return;
    }

    const popover = document.createElement('div');
    popover.className = 'collab-share-popover';
    popover.setAttribute('data-ref', 'collab-share-popover');

    const canManagePermissions = this.isDocOwner && !!currentUser;
    const isLinkMode = this.docAccessLevel === 'anyone_with_link';
    const ownerName = currentUser?.username || 'Propietario';
    const ownerAvatar = currentUser?.avatar_url || null;
    const ownerInitials = ownerName.substring(0, 2).toUpperCase();

    popover.innerHTML = `
      <div class="collab-share-card" data-ref="collab-share-card">
          <div class="collab-share-header">
            <h2 class="collab-share-title">Compartir el diseño</h2>
            <button type="button" class="collab-share-close-btn" data-ref="btn-collab-share-close" aria-label="Cerrar">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>

          <div class="collab-share-section">
            <div class="collab-share-section__title">Personas con acceso</div>
            ${canManagePermissions ? `
              <div class="collab-share-search-box">
                <svg class="component-icon collab-share-search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
                <input class="collab-share-search-input" data-ref="input-share-search-user" type="text" placeholder="Agregar personas" autocomplete="off" />
              </div>
              <div class="collab-share-search-dropdown is-hidden" data-ref="collab-share-search-dropdown"></div>
            ` : ''}

            <div class="collab-share-members-row" data-ref="collab-share-members-row">
              <div class="collab-share-avatars-list" data-ref="collab-share-avatars-list"></div>
              ${canManagePermissions ? `
                <button type="button" class="collab-share-add-btn" data-ref="btn-focus-search-user" data-tooltip="Agregar personas" aria-label="Agregar personas">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                </button>
              ` : ''}
            </div>

            <div class="collab-share-members-list is-hidden" data-ref="collab-share-members-details"></div>
          </div>

          <div class="collab-share-section">
            <div class="collab-share-section__title">Nivel de acceso</div>
            <div class="collab-access-select-wrapper" data-ref="collab-access-select-wrapper">
              <button type="button" class="collab-access-trigger ${!canManagePermissions ? 'is-disabled' : ''}" data-ref="btn-access-trigger" ${!canManagePermissions ? 'disabled' : ''}>
                <div class="collab-access-trigger__left">
                  <div class="collab-access-icon-circle" data-ref="access-trigger-icon">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isLinkMode ? 'language' : 'groups'}"></use></svg>
                  </div>
                  <span class="collab-access-trigger__label" data-ref="access-trigger-label">${isLinkMode ? 'Cualquier persona que tenga el enlace' : 'Solo las personas que agregues'}</span>
                </div>
                ${canManagePermissions ? `<svg class="component-icon collab-access-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>` : ''}
              </button>

              ${canManagePermissions ? `
                <div class="collab-access-menu is-hidden" data-ref="collab-access-menu">
                  <button type="button" class="collab-access-option ${!isLinkMode ? 'is-selected' : ''}" data-ref="option-access-restricted" data-access="restricted">
                    <div class="collab-access-option__icon">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#groups"></use></svg>
                    </div>
                    <div class="collab-access-option__text">
                      <div class="collab-access-option__title">Solo las personas que agregues</div>
                      <div class="collab-access-option__desc">Solo las personas con acceso al diseño pueden usar este enlace.</div>
                    </div>
                    <div class="collab-access-option__check ${isLinkMode ? 'is-hidden' : ''}" data-ref="check-access-restricted">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                    </div>
                  </button>

                  <button type="button" class="collab-access-option ${isLinkMode ? 'is-selected' : ''}" data-ref="option-access-link" data-access="anyone_with_link">
                    <div class="collab-access-option__icon">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#language"></use></svg>
                    </div>
                    <div class="collab-access-option__text">
                      <div class="collab-access-option__title">Cualquier persona que tenga el enlace</div>
                      <div class="collab-access-option__desc">Cualquiera podrá acceder al diseño con el enlace. <strong>No es necesario iniciar sesión.</strong></div>
                    </div>
                    <div class="collab-access-option__check ${!isLinkMode ? 'is-hidden' : ''}" data-ref="check-access-link">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                    </div>
                  </button>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="collab-share-actions">
            <button type="button" class="component-button collab-share-copy-btn" data-ref="btn-collab-copy-link">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#link"></use></svg>
              <span data-ref="txt-copy-link">Copiar el enlace</span>
            </button>
            <div class="banner banner--danger is-hidden" data-ref="collab-share-error"></div>
          </div>

          <div class="collab-share-divider"></div>

          <div class="collab-share-footer">
            <button type="button" class="collab-share-download-btn" data-ref="btn-collab-download-pdf">
              <div class="collab-share-download-icon">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
              </div>
              <span class="collab-share-download-text">Descargar</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popover);
    this.sharePopoverElement = popover;
    renderIcons(popover);

    const closePopover = () => {
      this.closeSharePopover();
    };

    const closeBtn = popover.querySelector<HTMLButtonElement>('[data-ref="btn-collab-share-close"]');
    closeBtn?.addEventListener('click', () => closePopover());

    const onOutsidePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (popover && !popover.contains(target) && !target.closest('[data-ref="btn-share-link"]')) {
        closePopover();
      }
    };
    setTimeout(() => {
      document.addEventListener('pointerdown', onOutsidePointerDown);
    }, 10);

    const onEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopover();
      }
    };
    document.addEventListener('keydown', onEscapeKey);

    this.cleanupSharePopover = () => {
      document.removeEventListener('pointerdown', onOutsidePointerDown);
      document.removeEventListener('keydown', onEscapeKey);
      popover.remove();
      this.sharePopoverElement = null;
    };

    const searchInput = popover.querySelector<HTMLInputElement>('[data-ref="input-share-search-user"]');
    const searchDropdown = popover.querySelector<HTMLElement>('[data-ref="collab-share-search-dropdown"]');
    const focusAddBtn = popover.querySelector<HTMLButtonElement>('[data-ref="btn-focus-search-user"]');
    focusAddBtn?.addEventListener('click', () => searchInput?.focus());

    const renderAvatars = () => {
      const avatarsList = popover.querySelector<HTMLElement>('[data-ref="collab-share-avatars-list"]');
      const detailsList = popover.querySelector<HTMLElement>('[data-ref="collab-share-members-details"]');
      if (!avatarsList) return;

      avatarsList.innerHTML = '';
      if (detailsList) {
        detailsList.innerHTML = '';
        if (this.docMembers.length === 0) {
          detailsList.classList.add('is-hidden');
        } else {
          detailsList.classList.remove('is-hidden');
        }
      }

      const ownerBubble = document.createElement('div');
      ownerBubble.className = 'collab-avatar-bubble';
      ownerBubble.setAttribute('data-tooltip', `${ownerName} (Tú)`);
      if (ownerAvatar) {
        ownerBubble.innerHTML = `<img src="${ownerAvatar}" alt="${ownerName}" />`;
      } else {
        ownerBubble.textContent = ownerInitials;
      }
      avatarsList.appendChild(ownerBubble);

      for (const m of this.docMembers) {
        const bubble = document.createElement('div');
        bubble.className = 'collab-avatar-bubble';
        bubble.style.backgroundColor = '#6366f1';
        bubble.setAttribute('data-tooltip', `${m.username} (${m.role === 'editor' ? 'Editor' : 'Lector'})`);
        if (m.avatar_url) {
          bubble.innerHTML = `<img src="${m.avatar_url}" alt="${m.username}" />`;
        } else {
          bubble.textContent = m.username.substring(0, 2).toUpperCase();
        }
        avatarsList.appendChild(bubble);

        if (detailsList) {
          const row = document.createElement('div');
          row.className = 'collab-share-member-row';
          row.innerHTML = `
            <div class="collab-share-member-info">
              <span class="collab-share-member-name">${m.username}</span>
              <span class="collab-share-member-badge">${m.email || 'Miembro'} • ${m.role === 'editor' ? 'Editor' : 'Lector'}</span>
            </div>
            ${canManagePermissions ? `
            <button type="button" class="collab-share-remove-btn" data-user-id="${m.user_id}" data-tooltip="Remover acceso" aria-label="Remover acceso a ${m.username}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
            </button>
            ` : ''}
          `;
          const removeBtn = row.querySelector<HTMLButtonElement>('.collab-share-remove-btn');
          removeBtn?.addEventListener('click', async () => {
            const res = await deleteApi(API_ROUTES.collaborativeDocs.memberDelete(this.docId, m.user_id));
            if (res.ok) {
              this.docMembers = this.docMembers.filter((item) => item.user_id !== m.user_id);
              renderAvatars();
              showToast('Colaborador eliminado', 'info');
            }
          });
          detailsList.appendChild(row);
        }
      }
      renderIcons(popover);
    };

    renderAvatars();

    const doSearch = debounce(async (q: string) => {
      if (!searchDropdown) return;
      if (!q.trim()) {
        searchDropdown.classList.add('is-hidden');
        searchDropdown.innerHTML = '';
        return;
      }
      try {
        const res = await getApi(API_ROUTES.collaborativeDocs.searchUsers(q, this.docId));
        if (res.ok) {
          const data = await res.json();
          const users: Array<{ avatar_url?: string | null; email: string; id: number; username: string }> = data.users || [];
          if (users.length === 0) {
            searchDropdown.innerHTML = `<div style="padding: 10px; font-size: 13px; color: var(--text-muted); text-align: center;">No se encontraron usuarios</div>`;
            searchDropdown.classList.remove('is-hidden');
          } else {
            searchDropdown.innerHTML = '';
            for (const u of users) {
              const item = document.createElement('button');
              item.type = 'button';
              item.className = 'collab-share-user-item';
              item.innerHTML = `
                <div class="collab-share-user-item__info">
                  <span class="collab-share-user-item__name">${u.username}</span>
                  <span class="collab-share-user-item__email">${u.email}</span>
                </div>
                <span class="component-button component-button--h30 component-button--black" style="font-size: 12px; padding: 0 10px;">Agregar</span>
              `;
              item.addEventListener('click', async () => {
                const addRes = await postApi(API_ROUTES.collaborativeDocs.members(this.docId), { role: 'editor', userId: u.id });
                if (addRes.ok) {
                  const addData = await addRes.json();
                  if (addData.member) {
                    this.docMembers.push(addData.member);
                  }
                  renderAvatars();
                  searchDropdown.classList.add('is-hidden');
                  if (searchInput) searchInput.value = '';
                  showToast(`${u.username} agregado como editor`, 'info');
                }
              });
              searchDropdown.appendChild(item);
            }
            searchDropdown.classList.remove('is-hidden');
          }
        }
      } catch {}
    }, 250);

    searchInput?.addEventListener('input', () => {
      void doSearch(searchInput.value);
    });

    const accessTrigger = popover.querySelector<HTMLButtonElement>('[data-ref="btn-access-trigger"]');
    const accessMenu = popover.querySelector<HTMLElement>('[data-ref="collab-access-menu"]');
    const optRestricted = popover.querySelector<HTMLButtonElement>('[data-ref="option-access-restricted"]');
    const optLink = popover.querySelector<HTMLButtonElement>('[data-ref="option-access-link"]');
    const triggerLabel = popover.querySelector<HTMLElement>('[data-ref="access-trigger-label"]');
    const triggerIcon = popover.querySelector<HTMLElement>('[data-ref="access-trigger-icon"]');
    const checkRestricted = popover.querySelector<HTMLElement>('[data-ref="check-access-restricted"]');
    const checkLink = popover.querySelector<HTMLElement>('[data-ref="check-access-link"]');

    if (canManagePermissions) {
      accessTrigger?.addEventListener('click', () => {
        accessTrigger.classList.toggle('is-open');
        accessMenu?.classList.toggle('is-hidden');
      });

      const selectAccess = async (level: 'anyone_with_link' | 'restricted') => {
        this.docAccessLevel = level;
        accessTrigger?.classList.remove('is-open');
        accessMenu?.classList.add('is-hidden');

        const isL = level === 'anyone_with_link';
        if (triggerLabel) triggerLabel.textContent = isL ? 'Cualquier persona que tenga el enlace' : 'Solo las personas que agregues';
        if (triggerIcon) triggerIcon.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isL ? 'language' : 'groups'}"></use></svg>`;

        optRestricted?.classList.toggle('is-selected', !isL);
        optLink?.classList.toggle('is-selected', isL);
        checkRestricted?.classList.toggle('is-hidden', isL);
        checkLink?.classList.toggle('is-hidden', !isL);
        renderIcons(popover);

        try {
          await patchApi(API_ROUTES.collaborativeDocs.accessLevel(this.docId), { accessLevel: level });
          showToast('Nivel de acceso actualizado', 'info');
        } catch {}
      };

      optRestricted?.addEventListener('click', () => void selectAccess('restricted'));
      optLink?.addEventListener('click', () => void selectAccess('anyone_with_link'));
    }

    const copyBtn = popover.querySelector<HTMLButtonElement>('[data-ref="btn-collab-copy-link"]');
    const copyTxt = popover.querySelector<HTMLElement>('[data-ref="txt-copy-link"]');
    copyBtn?.addEventListener('click', () => {
      const url = `${window.location.origin}/d/${encodeURIComponent(this.docId)}`;
      void navigator.clipboard.writeText(url).then(() => {
        if (copyTxt) copyTxt.textContent = '¡Enlace copiado!';
        showToast('Enlace de colaboración copiado al portapapeles', 'info');
        setTimeout(() => {
          if (copyTxt) copyTxt.textContent = 'Copiar el enlace';
        }, 2000);
      });
    });

    const downloadBtn = popover.querySelector<HTMLButtonElement>('[data-ref="btn-collab-download-pdf"]');
    downloadBtn?.addEventListener('click', () => {
      const downloadUrl = API_ROUTES.collaborativeDocs.pdf(this.docId);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${this.docTitle || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Descarga iniciada', 'info');
    });
  }

  private openLocalAuthModal(): void {
    if (this.shareModalElement) {
      this.shareModalElement.remove();
      this.shareModalElement = null;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop collab-share-backdrop';
    modal.setAttribute('data-ref', 'collab-local-auth-backdrop');

    modal.innerHTML = `
      <div class="modal-container collab-share-container" data-ref="collab-local-auth-container" style="max-width: 440px;">
        <div class="collab-share-card" data-ref="collab-local-auth-card">
          <div class="collab-share-header">
            <h2 class="collab-share-title">Compartir este diseño</h2>
            <button type="button" class="collab-share-close-btn" data-ref="btn-close-local-auth-modal" aria-label="Cerrar">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
          <div style="text-align: center; padding: 12px 4px 20px 4px;">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--surface-secondary, #f3f4f6); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
              <svg class="component-icon" style="width: 28px; height: 28px; color: var(--primary, #2563eb);" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
            </div>
            <p style="font-size: 14px; color: var(--text-secondary, #4b5563); line-height: 1.5; margin: 0 0 20px 0;">
              Tu diseño se encuentra guardado en este navegador. Para compartir un enlace de colaboración en tiempo real o invitar personas, guarda tu trabajo en tu cuenta de BoardPDF.
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <button type="button" class="component-button component-button--black component-button--h44" data-ref="btn-local-modal-register" style="width: 100%;">
                Crear cuenta gratis y guardar
              </button>
              <button type="button" class="component-button component-button--ghost component-button--h44" data-ref="btn-local-modal-login" style="width: 100%;">
                Ya tengo cuenta, iniciar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.shareModalElement = modal;
    renderIcons(modal);

    const storeCurrentAsPending = () => {
      const draft = saveLocalDraft(this.docId, {
        content: this.getContentPayload(),
        title: this.docTitle,
      });
      setPendingCloudSyncDraft(draft);
    };

    modal.querySelector('[data-ref="btn-close-local-auth-modal"]')?.addEventListener('click', () => {
      modal.remove();
      this.shareModalElement = null;
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        this.shareModalElement = null;
      }
    });

    modal.querySelector('[data-ref="btn-local-modal-register"]')?.addEventListener('click', () => {
      storeCurrentAsPending();
      modal.remove();
      this.shareModalElement = null;
      navigate(`/register?redirect=${encodeURIComponent(`/d/${this.docId}`)}`);
    });

    modal.querySelector('[data-ref="btn-local-modal-login"]')?.addEventListener('click', () => {
      storeCurrentAsPending();
      modal.remove();
      this.shareModalElement = null;
      navigate(`/login?redirect=${encodeURIComponent(`/d/${this.docId}`)}`);
    });
  }

  private async saveDocument(): Promise<void> {
    await this.flushAutoSave();
    if (this.isLocalOnly) {
      showToast('Borrador guardado localmente', 'success');
    } else {
      showToast('Documento guardado en la nube', 'success');
    }
  }
}

export async function createCollaborativePdfEditorView(docId?: string, query?: URLSearchParams): Promise<HTMLElement> {
  const container = await loadTemplate('/views/collaborative-pdf/collaborative-pdf-editor.html');
  const controller = new CollaborativePdfEditorController(container, docId, query);
  (container as any).__controller = controller;
  await controller.init();
  return container;
}
