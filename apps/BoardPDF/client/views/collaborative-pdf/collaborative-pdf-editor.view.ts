import { openModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { COLLAB_PAGE_PRESETS, inToPx, mmToPx, PageDimension, PagePreset } from '../../config/collab-page-presets.config.js';
import { currentUser, deleteApi, escapeHtml, getApi, hasSubscriptionFeature, onAuthChange, patchApi, postApi, postFormApi, putApi } from '../../services/api.service.js';
import { translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { checkPdfPagesEditableStatus, extractEditablePdfPage } from '../../services/pdf-editable-extractor.service.js';
import { renderPdfThumbnail } from '../../services/pdf-preview.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { initWasmEngine } from '../../services/wasm-engine.service.js';
import { wsService } from '../../services/websocket.service.js';
import { ViewController } from '../../types/common.types.js';
import { getOrCreateGuestIdentity } from '../../utils/collab-identity.util.js';
import { getLocalDraft, removeLocalDraft, saveLocalDraft, setPendingCloudSyncDraft } from '../../utils/collab-local-draft.util.js';
import { debounce, hideElement, setupDropdown, showElement, withButtonLoading } from '../../utils/dom.util.js';
import { applyAvatarTier } from '../../utils/tier.util.js';
import { bindChartInspectorEvents, renderChartSpreadsheet, switchChartInspectorTab, syncChartInspector } from './collab-chart-inspector.util.js';
import { applyChartPalette, renderChartSvg } from './collab-chart-renderer.util.js';
import { alignElementToPage, moveElementLayer, reorderElementLayer } from './collab-context-menu.util.js';
import { findSearchMatches, replaceAllMatches, replaceCurrentMatch } from './collab-find-replace.util.js';
import { GOOGLE_FONTS_CATALOG, GoogleFontItem, loadGoogleFont, loadGoogleFontPreview, WEIGHT_LABELS } from './collab-fonts.config.js';
import { renderLayersList } from './collab-layers-panel.util.js';
import { openLocalAuthModal } from './collab-local-auth-modal.util.js';
import { openCollabPageSizeModal } from './collab-page-size-modal.util.js';
import { addPeerPresenceBubble, removePeerPresenceBubble, renderPresenceList, renderRemoteCursor } from './collab-presence.util.js';
import { renderPersistentGuidesSvg, updateRulers } from './collab-rulers.util.js';
import { renderShapeGeometry, renderShapeInner } from './collab-shape-renderer.util.js';
import { SHAPES_CATALOG } from './collab-shapes.config.js';
import { createCollabSharePopover } from './collab-share-modal.util.js';
import { applySmartGuides, clearSmartGuides, renderActiveSmartGuides } from './collab-smart-guides.util.js';
import { createCollaborativeDrawerElement } from './collaborative-pdf-drawer.template.js';
import { applyListFormatting, CHART_PALETTES, ChartType, DocMember, EditorElement, ElementChart, ElementChartDataSeries, ElementChartOptions, ElementDrawing, ElementImage, ElementShape, ElementTable, ElementTableCell, ElementText, PAGE_HEIGHT, PAGE_WIDTH, PagePdfSource, RemotePeer, UploadedAsset } from './collaborative-pdf.types.js';

export class CollaborativePdfEditorController implements ViewController {
  private abortController: AbortController | null = null;
  private activePageIndex = 0;
  private activePanelTab: 'colors' | 'elements' | 'fonts' | 'text' | 'tools' | 'uploads' | null = null;
  private fontActiveCategory = 'all';
  private fontObserver: IntersectionObserver | null = null;
  private fontSearchQuery = '';
  private expandedFontFamily: string | null = null;
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
  private docMembers: DocMember[] = [];
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
  private remotePeers = new Map<string, RemotePeer>();
  private selectedElementId: string | null = null;
  private selectedElementIds = new Set<string>();
  private isPagesCarouselOpen = false;
  private isGridViewOpen = false;
  private consecutivePasteCount = 0;
  private lastPasteTimestamp = 0;
  private lastPastedTimestamp = 0;
  private sharePopoverElement: HTMLElement | null = null;
  private cleanupSharePopover: (() => void) | null = null;
  private selectedPageIndex: number | null = null;
  private selectedPdfAsset: UploadedAsset | null = null;
  private activeContextDropdowns: Array<{ close: () => void; destroy: () => void }> = [];
  private editDropdownCtrl: { close: () => void; destroy: () => void } | null = null;
  private fileDropdownCtrl: { close: () => void; destroy: () => void } | null = null;
  private isApplyingHistory = false;
  private maxHistoryStates = 50;
  private redoStack: string[] = [];
  private undoStack: string[] = [];
  private unsubAuth: (() => void) | null = null;
  private shareModalElement: HTMLElement | null = null;
  private uploadedAssets: UploadedAsset[] = [];
  private queryParams?: URLSearchParams;
  private zoomLevel = 1.0;
  private committedGuidesPreset: '12-col' | '3-col' | '3x3' | 'custom' | null = null;
  private currentGuidesPreset: '12-col' | '3-col' | '3x3' | 'custom' | null = null;
  private customGuideCols = 4;
  private customGuideRows = 4;
  private editorMode: 'edit' | 'view' = 'edit';
  private findCurrentIndex = -1;
  private findMatchCase = false;
  private findMatches: Array<{ elementId: string; pageIndex: number }> = [];
  private findReplaceTerm = '';
  private findSearchTerm = '';
  private rulerRafId: number | null = null;
  private showBleed = false;
  private showMargins = false;
  private showRulersAndGuides = false;
  private contextMenuTargetPage = 0;
  private contextMenuTargetElementId: string | null = null;
  private isLayersPanelOpen = false;

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
    void initWasmEngine();
    const loaded = await this.loadDocument();
    if (!loaded) return;
    this.initCollabWebSocket();
    this.renderPages();
    this.bindEvents();
    void this.loadUploadedAssets();
    this.updateFooterPageInfo();
    this.renderPresenceList();
    this.unsubAuth = onAuthChange(() => {
      this.renderPresenceList();
    });
    renderIcons(this.container);
    this.undoStack = [
      JSON.stringify({
        elements: this.elements,
        pageBackgrounds: this.pageBackgrounds,
        pageCount: this.pageCount,
        pageSizes: this.pageSizes,
      }),
    ];
    this.redoStack = [];
    this.updateUndoRedoButtons();

    const autoImportRaw = sessionStorage.getItem('collab_auto_import');
    if (autoImportRaw) {
      sessionStorage.removeItem('collab_auto_import');
      try {
        const parsed = JSON.parse(autoImportRaw);
        const autoAsset = parsed.asset;
        const autoTitle = parsed.docTitle;
        if (autoAsset && autoAsset.url) {
          if (autoTitle) {
            this.docTitle = autoTitle;
            const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
            if (titleInput) titleInput.value = autoTitle;
          }
          if (!this.uploadedAssets.some((a) => a.id === autoAsset.id || a.url === autoAsset.url)) {
            this.uploadedAssets.unshift(autoAsset);
            this.renderUploadsGrid();
          }
          void this.handleApplyAllPdfPages(autoAsset);
        }
      } catch {}
    }
  }

  destroy(): void {
    if (this.unsubAuth) {
      this.unsubAuth();
      this.unsubAuth = null;
    }
    for (const d of this.activeContextDropdowns) {
      d.destroy();
    }
    this.activeContextDropdowns = [];
    this.fileDropdownCtrl?.destroy();
    this.fileDropdownCtrl = null;
    this.editDropdownCtrl?.destroy();
    this.editDropdownCtrl = null;
    if (this.rulerRafId) {
      cancelAnimationFrame(this.rulerRafId);
      this.rulerRafId = null;
    }
    this.undoStack = [];
    this.redoStack = [];
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
    if (this.fontObserver) {
      this.fontObserver.disconnect();
      this.fontObserver = null;
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

    const collapseBtn = this.queryPanel<HTMLButtonElement>('[data-ref="btn-drawer-collapse"]');
    collapseBtn?.addEventListener('click', () => {
      this.closeSidePanel();
    }, { signal });

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

    const elemChartsView = this.queryPanel<HTMLElement>('[data-ref="elements-charts-view"]');

    const showChartsView = () => {
      if (elemMainView) hideElement(elemMainView);
      if (elemShapesView) hideElement(elemShapesView);
      if (elemTablesView) hideElement(elemTablesView);
      if (elemChartsView) showElement(elemChartsView);
    };

    const restoreAllElementsMain = () => {
      if (elemShapesView) hideElement(elemShapesView);
      const catView = this.queryPanel<HTMLElement>('[data-ref="elements-shapes-category-view"]');
      if (catView) hideElement(catView);
      if (elemTablesView) hideElement(elemTablesView);
      if (elemChartsView) hideElement(elemChartsView);
      if (elemMainView) showElement(elemMainView);
    };

    const elemShapesCatView = this.queryPanel<HTMLElement>('[data-ref="elements-shapes-category-view"]');
    const shapesCatTitle = this.queryPanel<HTMLElement>('[data-ref="shapes-cat-title"]');
    const shapesCatGrid = this.queryPanel<HTMLElement>('[data-ref="shapes-cat-grid"]');

    const elemConfigs: Array<{ handler: () => void; ref: string }> = [
      { handler: showShapesView, ref: 'btn-elem-shapes' },
      { handler: showTablesView, ref: 'btn-elem-tables' },
      { handler: () => this.handleRailTabClick('uploads'), ref: 'btn-elem-photos' },
      { handler: showChartsView, ref: 'btn-elem-charts' },
    ];

    elemConfigs.forEach(({ handler, ref }) => {
      this.queryPanel<HTMLButtonElement>(`[data-ref="${ref}"]`)?.addEventListener('click', handler, { signal });
    });

    this.queryPanel<HTMLButtonElement>('[data-ref="btn-shapes-back"]')?.addEventListener('click', restoreAllElementsMain, { signal });

    const shapeMoreBtns = this.queryPanelAll<HTMLButtonElement>('[data-shape-cat]');
    shapeMoreBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const catKey = btn.getAttribute('data-shape-cat');
        if (!catKey) return;
        const catData = SHAPES_CATALOG[catKey];
        if (!catData) return;

        if (shapesCatTitle) shapesCatTitle.textContent = catData.title;
        if (shapesCatGrid) {
          shapesCatGrid.innerHTML = catData.shapes.map((s) => s.cardHtml).join('');
          const catShapeButtons = shapesCatGrid.querySelectorAll<HTMLButtonElement>('[data-shape]');
          catShapeButtons.forEach((sBtn) => {
            sBtn.addEventListener('click', () => {
              const shape = sBtn.getAttribute('data-shape') as any;
              if (shape) this.addShapeElement(shape);
            });
          });
        }
        if (elemShapesView) hideElement(elemShapesView);
        if (elemShapesCatView) showElement(elemShapesCatView);
      }, { signal });
    });

    this.queryPanel<HTMLButtonElement>('[data-ref="btn-shapes-cat-back"]')?.addEventListener('click', () => {
      if (elemShapesCatView) hideElement(elemShapesCatView);
      if (elemShapesView) showElement(elemShapesView);
    }, { signal });
    this.queryPanel<HTMLButtonElement>('[data-ref="btn-tables-back"]')?.addEventListener('click', restoreAllElementsMain, { signal });
    this.queryPanel<HTMLButtonElement>('[data-ref="btn-charts-back"]')?.addEventListener('click', restoreAllElementsMain, { signal });

    const chartCards = this.queryPanelAll<HTMLButtonElement>('[data-ref="btn-chart-card"]');
    chartCards.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cType = btn.getAttribute('data-chart-type') as ChartType;
        if (cType) {
          this.addChartElement(cType);
        }
      }, { signal });
    });

    this.bindChartInspectorEvents(signal, restoreAllElementsMain);

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

    const btnEmbedDesign = this.queryPanel<HTMLButtonElement>('[data-ref="btn-embed-design"]');
    btnEmbedDesign?.addEventListener('click', () => {
      if (!this.selectedPdfAsset) return;
      void this.handleApplySinglePdfPage(this.selectedPdfAsset, 1);
    }, { signal });

    const btnApplyAll = this.queryPanel<HTMLButtonElement>('[data-ref="btn-apply-all-pages"]');
    btnApplyAll?.addEventListener('click', () => {
      void this.handleApplyAllPdfPages();
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

  private handleRailTabClick(tab: 'colors' | 'elements' | 'fonts' | 'text' | 'tools' | 'uploads'): void {
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
      fonts: 'Fuentes',
      text: 'Escribir',
      uploads: 'Subidos',
    };

    if (titleEl) {
      titleEl.textContent = titles[tab] || '';
    }

    const icons: Record<string, string> = {
      colors: 'palette',
      elements: 'category',
      fonts: 'font_download',
      text: 'text_fields',
      uploads: 'cloud_upload',
    };
    const iconEl = this.drawer?.querySelector<SVGElement>('[data-ref="drawer-header-icon"]');
    if (iconEl) {
      const useEl = iconEl.querySelector('use');
      if (useEl) {
        useEl.setAttribute('href', `/icons.svg#${icons[tab] || 'category'}`);
      }
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

    if (tab === 'fonts') {
      this.renderFontsPanel();
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
    if (this.editorMode === 'view') return;
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

  private addShapeElement(shapeType: string): void {
    if (this.editorMode === 'view') return;
    const id = `shape_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    let width = 120;
    let height = 120;
    let fillColor = '#000000';
    let strokeColor = 'transparent';
    let strokeWidth = 0;
    let borderRadius: number | undefined;
    let sides: number | undefined;
    let strokeStyle: ElementShape['strokeStyle'];

    if (shapeType.startsWith('line-')) {
      width = 180;
      height = 36;
      fillColor = '#000000';
      strokeColor = '#000000';
      strokeWidth = 3;
      if (shapeType.includes('dashed')) strokeStyle = 'dashed';
      else if (shapeType.includes('dotted')) strokeStyle = 'dotted';
      else strokeStyle = 'solid';
    } else if (shapeType === 'rect') {
      width = 120;
      height = 120;
      borderRadius = 0;
      sides = 4;
    } else if (shapeType === 'rounded-rect') {
      width = 120;
      height = 120;
      borderRadius = 22;
      sides = 4;
    } else if (shapeType === 'circle') {
      width = 120;
      height = 120;
    } else if (shapeType === 'diamond' || shapeType === 'cross') {
      width = 120;
      height = 120;
    } else if (shapeType === 'triangle' || shapeType === 'triangle-down' || shapeType === 'right-triangle') {
      width = 120;
      height = 120;
      sides = 3;
    } else if (shapeType === 'pentagon') {
      width = 120;
      height = 120;
      sides = 5;
    } else if (shapeType === 'hexagon' || shapeType === 'hexagon-vertical') {
      width = 120;
      height = 120;
      sides = 6;
    } else if (shapeType === 'heptagon') {
      width = 120;
      height = 120;
      sides = 7;
    } else if (shapeType === 'octagon') {
      width = 120;
      height = 120;
      sides = 8;
    } else if (shapeType === 'decagon') {
      width = 120;
      height = 120;
      sides = 10;
    } else if (shapeType === 'chamfered-rect') {
      width = 130;
      height = 100;
      borderRadius = 18;
    } else if (shapeType === 'scalloped-rect') {
      width = 140;
      height = 100;
      borderRadius = 16;
    } else if (shapeType === 'plaque') {
      width = 140;
      height = 100;
    } else if (shapeType === 'parallelogram-right' || shapeType === 'parallelogram-left' || shapeType === 'trapezoid' || shapeType === 'trapezoid-inverted') {
      width = 140;
      height = 90;
    } else if (shapeType === 'shield' || shapeType === 'arch') {
      width = 120;
      height = 135;
    } else if (shapeType === 'semicircle' || shapeType === 'semicircle-arc') {
      width = 140;
      height = 80;
    } else if (shapeType === 'quarter-circle' || shapeType === 'quarter-circle-arc') {
      width = 120;
      height = 120;
    } else if (shapeType.startsWith('star-') || shapeType.startsWith('flare-') || shapeType.startsWith('badge')) {
      width = 120;
      height = 120;
    } else if (shapeType.startsWith('gear-')) {
      width = 120;
      height = 120;
    } else if (shapeType.startsWith('heart')) {
      width = 120;
      height = 110;
    } else if (shapeType.startsWith('teardrop-')) {
      width = 100;
      height = 120;
    } else if (shapeType.startsWith('cloud-')) {
      width = 140;
      height = 90;
    } else if (shapeType.startsWith('callout-')) {
      width = 140;
      height = 100;
      if (shapeType === 'callout-rounded') borderRadius = 14;
      else if (shapeType === 'callout-capsule') borderRadius = 36;
    } else if (shapeType.startsWith('asterisk-')) {
      width = 120;
      height = 120;
    } else if (shapeType.startsWith('organic-')) {
      width = 120;
      height = 120;
    } else if (shapeType.startsWith('banner-')) {
      if (shapeType === 'banner-ribbon-vertical') {
        width = 75;
        height = 150;
      } else {
        width = 150;
        height = 75;
      }
    } else if (shapeType.startsWith('arrow-block-') || shapeType.startsWith('arrow-double-') || shapeType.startsWith('arrow-pentagon') || shapeType.startsWith('arrow-chevron') || shapeType.startsWith('arrow-notched') || shapeType.startsWith('arrow-bidirectional')) {
      if (shapeType === 'arrow-block-up' || shapeType === 'arrow-block-down' || shapeType === 'arrow-double-vertical') {
        width = 75;
        height = 150;
      } else {
        width = 150;
        height = 75;
      }
    } else if (shapeType.startsWith('flowchart-')) {
      if (shapeType === 'flowchart-decision' || shapeType === 'flowchart-merge') {
        width = 120;
        height = 120;
      } else if (shapeType === 'flowchart-offpage') {
        width = 120;
        height = 130;
      } else {
        width = 150;
        height = 90;
        if (shapeType === 'flowchart-terminator') borderRadius = 45;
        else if (shapeType === 'flowchart-process-rounded') borderRadius = 16;
      }
    } else if (shapeType === 'lightning') {
      width = 85;
      height = 140;
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
    if (borderRadius !== undefined) newShape.borderRadius = borderRadius;
    if (sides !== undefined) newShape.sides = sides;
    if (strokeStyle !== undefined) newShape.strokeStyle = strokeStyle;

    this.pushElement(newShape);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
  }

  private addLineElement(lineType: 'flexible' | 'multiconnect' | 'straight'): void {
    if (this.editorMode === 'view') return;
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
    if (this.editorMode === 'view') return;
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
    if (this.editorMode === 'view') return;
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

  private addChartElement(chartType: ChartType): void {
    if (this.editorMode === 'view') return;
    const defaultLabels = ['Invierno', 'Primavera', 'Verano', 'Otoño'];
    const palette = CHART_PALETTES.blue;
    const defaultSeries: ElementChartDataSeries[] = [
      { color: palette[0], name: 'Ventas', values: [60, 45, 78, 30] },
    ];

    if (chartType === 'bar-grouped' || chartType === 'bar-stacked' || chartType === 'line-multi' || chartType === 'area-stacked' || chartType === 'area-overlap') {
      defaultSeries.push({ color: palette[1], name: 'Objetivo', values: [50, 55, 70, 40] });
    }

    const isProgress = chartType === 'progress-bar' || chartType === 'progress-ring' || chartType === 'progress-gauge';
    const width = isProgress ? 320 : 480;
    const height = isProgress ? 220 : 320;

    const id = `chart_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newChart: ElementChart = {
      chartType,
      height,
      id,
      labels: defaultLabels,
      options: {
        colorScheme: 'blue',
        percentageValue: 72,
        showDataLabels: false,
        showGridLines: true,
        showLegend: !isProgress,
        showXLabels: true,
        showYLabels: true,
        title: '',
      },
      pageIndex: this.activePageIndex,
      rotation: 0,
      series: defaultSeries,
      type: 'chart',
      width,
      x: 120 + (this.elements.length % 5) * 20,
      y: 160 + (this.elements.length % 5) * 20,
    };

    this.pushElement(newChart);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
    this.openChartInspector(newChart, 'data');
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
    if (this.editorMode === 'view') return;
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
    this.scrollToPage(targetIndex);
    this.setModified(true);
    this.broadcastDocSync();
    this.recordHistory();
    showToast(`Página ${targetIndex + 1} añadida`, 'success');
  }

  private scrollToPage(pageIndex: number): void {
    requestAnimationFrame(() => {
      const pageEl = this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-scaler-${pageIndex}"], [data-ref="page-sheet-${pageIndex}"]`);
      pageEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
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
    this.scrollToPage(targetIndex);
    this.setModified(true);
    this.broadcastDocSync();
    this.recordHistory();
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
    this.recordHistory();
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
    openCollabPageSizeModal({
      currentDimensions: curDim,
      mode: 'resize',
      onConfirm: ({ applyToAll, dimensions }) => {
        if (applyToAll) {
          this.docDefaultPageSize = { ...dimensions };
          this.pageSizes = Array.from({ length: this.pageCount }, () => ({ ...dimensions }));
        } else {
          this.pageSizes[pageIndex] = { ...dimensions };
        }

        this.renderPages();
        this.selectPage(pageIndex);
        this.setModified(true);
        this.broadcastDocSync();
        showToast(applyToAll ? 'Tamaño aplicado a todas las páginas' : `Tamaño de página ${pageIndex + 1} actualizado`, 'success');
      },
      pageIndex,
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
                userId: null,
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
              userId: null,
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
              showToast('El documento no existe o fue eliminado.', 'danger');
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
        userId: currentUser?.id ?? null,
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

      if (this.showMargins) {
        const marginsEl = document.createElement('div');
        marginsEl.className = 'collaborative-page-margins';
        marginsEl.setAttribute('data-ref', `page-margins-${p}`);
        sheet.appendChild(marginsEl);
      }

      if (this.showBleed) {
        const bleedEl = document.createElement('div');
        bleedEl.className = 'collaborative-page-bleed';
        bleedEl.setAttribute('data-ref', `page-bleed-${p}`);
        sheet.appendChild(bleedEl);
      }

      if (this.showRulersAndGuides && this.currentGuidesPreset) {
        const pGuidesSvg = this.renderPersistentGuidesSvg(p, curPageW, curPageH);
        sheet.appendChild(pGuidesSvg);
      }

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
        } else if (el.type === 'chart') {
          sheet.appendChild(this.createChartElement(el));
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
        if (this.editorMode === 'view') return;
        if (e.button !== 0) return;
        if (this.activeTool !== 'select') return;
        const clickedItem = (e.target as HTMLElement)?.closest(
          '[data-element-id], .collaborative-transform-box, .collaborative-transform-handle, .collaborative-page-header, .collaborative-page-controls, button, input'
        );
        if (clickedItem) return;

        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        document.body.classList.add('is-marquee-selecting');

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
          window.getSelection()?.removeAllRanges();
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
          const pageElements = this.elements.filter((el): el is ElementChart | ElementImage | ElementShape | ElementTable | ElementText => (el.pageIndex ?? 0) === p && el.type !== 'drawing');

          for (const el of pageElements) {
            const elNode = sheet.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
            const elX = el.x;
            const elY = el.y;
            const elW = el.width || (elNode ? elNode.offsetWidth : 60);
            const elH = el.height || (elNode ? elNode.offsetHeight : 60);
            const elR = elX + elW;
            const elB = elY + elH;
            const intersects = !(elR < left || elX > right || elB < top || elY > bottom);
            if (intersects) {
              this.selectedElementIds.add(el.id);
            } else if (!moveEvt.shiftKey && !moveEvt.ctrlKey) {
              this.selectedElementIds.delete(el.id);
            }
          }
          this.updateSelection();
        };

        const onPointerUp = () => {
          document.body.classList.remove('is-marquee-selecting');
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          if (marqueeBox) {
            marqueeBox.remove();
            marqueeBox = null;
          }
          if (isMarquee) {
            this.selectedPageIndex = p;
            this.activePageIndex = p;
            if (this.selectedElementIds.size === 1) {
              const singleId = Array.from(this.selectedElementIds)[0];
              this.selectElement(singleId);
            } else if (this.selectedElementIds.size > 1) {
              this.selectedElementId = null;
              this.updateSelection();
              this.renderTransformBox();
              this.updateContextToolbar();
              this.updateFooterPageInfo();
            } else {
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

    if (this.selectedElementId) {
      const selected = this.elements.find((e) => e.id === this.selectedElementId);
      if (selected && selected.type === 'chart') {
        this.syncChartInspector(selected);
      }
    }
    this.updateFooterPageInfo();
    renderIcons(this.container);
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
    if (this.isPagesCarouselOpen) {
      this.applySinglePageMode(true);
      this.renderPagesFilmstrip();
    }
    if (this.isGridViewOpen) {
      this.renderGridView();
    }
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
      if (this.editorMode === 'view') return;
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
        this.recordHistory();
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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
        this.setModified(true);
        this.broadcastElementUpdate(el);
        this.recordHistory();
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
    div.style.fontWeight = el.fontWeight ? String(el.fontWeight) : (el.isBold ? 'bold' : 'normal');
    div.style.fontFamily = el.fontFamily ? `"${el.fontFamily}", sans-serif` : 'Helvetica, sans-serif';
    if (el.isItalic) div.style.fontStyle = 'italic';
    else if (el.fontStyle) div.style.fontStyle = el.fontStyle;
    if (el.isUnderline && el.isStrikethrough) {
      div.style.textDecoration = 'underline line-through';
    } else if (el.isUnderline) {
      div.style.textDecoration = 'underline';
    } else if (el.isStrikethrough) {
      div.style.textDecoration = 'line-through';
    } else {
      div.style.textDecoration = 'none';
    }
    if (el.isUppercase) div.style.textTransform = 'uppercase';
    if (el.align) div.style.textAlign = el.align;
    if (el.letterSpacing !== undefined) div.style.letterSpacing = `${el.letterSpacing}px`;
    if (el.lineHeight !== undefined) div.style.lineHeight = `${el.lineHeight}`;
    if (el.opacity !== undefined) div.style.opacity = `${el.opacity}`;
    if (el.verticalAlign) {
      div.style.display = 'flex';
      div.style.flexDirection = 'column';
      div.style.justifyContent = el.verticalAlign === 'middle' ? 'center' : (el.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start');
    }
    if (el.fontFamily) {
      void loadGoogleFont(el.fontFamily, [el.fontWeight ? Number(el.fontWeight) : (el.isBold ? 700 : 400)], el.fontStyle === 'italic');
    }
    div.style.transform = `rotate(${el.rotation || 0}deg)`;
    div.style.transformOrigin = 'center center';

    this.makeDraggable(div, el);
    return div;
  }

  private applyChartPalette(el: ElementChart): void {
    applyChartPalette(el);
  }

  private renderChartSvg(el: ElementChart): string {
    return renderChartSvg(el);
  }

  private createChartElement(el: ElementChart): HTMLElement {
    const div = document.createElement('div');
    div.className = 'collaborative-chart-item';
    div.setAttribute('data-ref', `chart-element-${el.id}`);
    div.setAttribute('data-element-id', el.id);
    div.style.left = `${el.x}px`;
    div.style.top = `${el.y}px`;
    div.style.width = `${el.width}px`;
    div.style.height = `${el.height}px`;
    div.style.transform = `rotate(${el.rotation || 0}deg)`;
    div.style.transformOrigin = 'center center';

    div.innerHTML = this.renderChartSvg(el);

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(el.id);
    });

    div.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.selectElement(el.id);
      this.openChartInspector(el, 'data');
    });

    this.makeDraggable(div, el);
    return div;
  }

  private openChartInspector(el?: ElementChart, tab: 'customize' | 'data' = 'data'): void {
    const inspector = this.queryPanel<HTMLElement>('[data-ref="panel-section-chart-inspector"]');
    if (!inspector) return;

    const sections = this.queryPanelAll<HTMLElement>('.collaborative-panel-section');
    sections.forEach((sec) => hideElement(sec));
    showElement(inspector);

    const titleEl = this.queryPanel<HTMLElement>('[data-ref="side-panel-title"]');
    if (titleEl) titleEl.textContent = 'Gráfica';

    const targetEl = el || (this.selectedElementId ? (this.elements.find((e) => e.id === this.selectedElementId && e.type === 'chart') as ElementChart) : undefined);
    if (targetEl) {
      this.syncChartInspector(targetEl);
      this.switchChartInspectorTab(tab);
    }
  }

  private switchChartInspectorTab(tab: 'customize' | 'data'): void {
    switchChartInspectorTab(tab, (ref) => this.queryPanel(ref));
  }

  private updateChartSvgOnCanvas(el: ElementChart): void {
    const node = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
    if (node) node.innerHTML = this.renderChartSvg(el);
    this.setModified(true);
    this.broadcastElementUpdate(el);
  }

  private syncChartInspector(el: ElementChart): void {
    syncChartInspector(
      el,
      (ref) => this.queryPanel(ref),
      (ref) => this.queryPanelAll(ref),
      (target) => this.updateChartSvgOnCanvas(target)
    );
  }

  private renderChartSpreadsheet(el: ElementChart): void {
    renderChartSpreadsheet(el, (ref) => this.queryPanel(ref), (target) => this.updateChartSvgOnCanvas(target));
  }

  private bindChartInspectorEvents(signal: AbortSignal | undefined, restoreElementsMain: () => void): void {
    bindChartInspectorEvents(
      signal,
      restoreElementsMain,
      (ref) => this.queryPanel(ref),
      (ref) => this.queryPanelAll(ref),
      () => {
        if (!this.selectedElementId) return undefined;
        const el = this.elements.find((e) => e.id === this.selectedElementId);
        return el && el.type === 'chart' ? (el as ElementChart) : undefined;
      },
      (target) => this.updateChartSvgOnCanvas(target),
      (target) => this.applyChartPalette(target)
    );
  }

  private renderShapeInner(el: ElementShape): string {
    return renderShapeInner(el);
  }

  private renderShapeGeometry(el: ElementShape, fill: string, stroke: string, strokeWidth: number, w: number, h: number, strokeDash = ''): string {
    return renderShapeGeometry(el, fill, stroke, strokeWidth, w, h, strokeDash);
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

    const sx = el.flipHorizontal ? -1 : 1;
    const sy = el.flipVertical ? -1 : 1;
    div.style.transform = `rotate(${el.rotation || 0}deg) scale(${sx}, ${sy})`;
    div.style.transformOrigin = 'center center';

    if (el.opacity !== undefined) {
      div.style.opacity = `${el.opacity}`;
    }

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

    const sx = el.flipHorizontal ? -1 : 1;
    const sy = el.flipVertical ? -1 : 1;
    div.style.transform = `rotate(${el.rotation || 0}deg) scale(${sx}, ${sy})`;
    div.style.transformOrigin = 'center center';

    if (el.opacity !== undefined) {
      div.style.opacity = `${el.opacity}`;
    }

    if (el.borderRadius !== undefined) {
      div.style.borderRadius = `${el.borderRadius}px`;
      div.style.overflow = el.borderRadius > 0 ? 'hidden' : '';
    }

    if (el.borderWidth && el.borderStyle && el.borderStyle !== 'none') {
      const bs = el.borderStyle === 'long-dash' ? 'dashed' : el.borderStyle;
      div.style.border = `${el.borderWidth}px ${bs} ${el.borderColor || '#000000'}`;
      div.style.boxSizing = 'border-box';
    }

    const img = document.createElement('img');
    img.className = 'collaborative-image-inner';
    img.src = el.url;
    img.alt = el.name || 'Imagen';
    img.draggable = false;
    if (el.borderRadius !== undefined) {
      img.style.borderRadius = `${el.borderRadius}px`;
    }
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
        this.recordHistory();
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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
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
    if (this.editorMode === 'view') return;
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

  private makeDraggable(element: HTMLElement, item: ElementChart | ElementImage | ElementShape | ElementTable | ElementText): void {
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let initialX = 0;
    let initialY = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    const initialPositions = new Map<string, { x: number; y: number }>();
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');

    const updatePosition = (clientX: number, clientY: number) => {
      if (this.activeTool !== 'select') return;
      const zoom = this.zoomLevel || 1;
      const scrollDx = (workspace?.scrollLeft || 0) - startScrollLeft;
      const scrollDy = (workspace?.scrollTop || 0) - startScrollTop;
      const dx = (clientX - startX + scrollDx) / zoom;
      const dy = (clientY - startY + scrollDy) / zoom;

      if (initialPositions.size > 1) {
        for (const [selId, initPos] of initialPositions.entries()) {
          const elObj = this.elements.find((el) => el.id === selId);
          const domNode = this.container.querySelector<HTMLElement>(`[data-element-id="${selId}"]`);
          if (elObj && 'x' in elObj && 'y' in elObj && domNode) {
            const nextX = initPos.x + dx;
            const nextY = initPos.y + dy;
            domNode.style.left = `${nextX}px`;
            domNode.style.top = `${nextY}px`;
            elObj.x = nextX;
            elObj.y = nextY;
          }
        }
        this.updateTransformBoxPosition();
        if (this.showRulersAndGuides) this.updateRulers();
        if (this.isLayersPanelOpen) this.renderLayersList();
        this.setModified(true);
      } else {
        const rawX = initialX + dx;
        const rawY = initialY + dy;
        const snapped = this.applySmartGuides(item, rawX, rawY);
        element.style.left = `${snapped.x}px`;
        element.style.top = `${snapped.y}px`;
        item.x = snapped.x;
        item.y = snapped.y;
        this.updateTransformBoxPosition();
        if (this.showRulersAndGuides) this.updateRulers();
        if (this.isLayersPanelOpen) this.renderLayersList();
        this.setModified(true);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (this.activeTool !== 'select') return;
      e.preventDefault();
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      updatePosition(e.clientX, e.clientY);
    };

    const onScroll = () => {
      updatePosition(lastClientX, lastClientY);
    };

    const onMouseUp = (e: MouseEvent) => {
      document.body.classList.remove('is-dragging-element');
      this.clearSmartGuides(item.pageIndex ?? 0);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      workspace?.removeEventListener('scroll', onScroll);

      const sheets = this.container.querySelectorAll<HTMLElement>('.collaborative-page-sheet');
      let targetSheet: HTMLElement | null = null;
      let targetPageIndex = item.pageIndex ?? 0;

      for (const s of sheets) {
        const r = s.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          targetSheet = s;
          const pIdx = parseInt(s.getAttribute('data-page-index') || '0', 10);
          if (!isNaN(pIdx)) {
            targetPageIndex = pIdx;
          }
          break;
        }
      }

      if (targetSheet && targetPageIndex !== (item.pageIndex ?? 0)) {
        const originSheet = this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-${item.pageIndex ?? 0}"]`);
        const originRect = originSheet?.getBoundingClientRect();
        const targetRect = targetSheet.getBoundingClientRect();
        const zoom = this.zoomLevel || 1.0;

        if (initialPositions.size > 1) {
          for (const selId of initialPositions.keys()) {
            const elObj = this.elements.find((el) => el.id === selId);
            if (elObj && 'x' in elObj && 'y' in elObj) {
              if (originRect) {
                const absL = originRect.left + elObj.x * zoom;
                const absT = originRect.top + elObj.y * zoom;
                elObj.x = Math.round((absL - targetRect.left) / zoom);
                elObj.y = Math.round((absT - targetRect.top) / zoom);
              }
              elObj.pageIndex = targetPageIndex;
              this.broadcastElementUpdate(elObj);
            }
          }
        } else {
          if (originRect) {
            const absL = originRect.left + item.x * zoom;
            const absT = originRect.top + item.y * zoom;
            item.x = Math.round((absL - targetRect.left) / zoom);
            item.y = Math.round((absT - targetRect.top) / zoom);
          }
          item.pageIndex = targetPageIndex;
          this.broadcastElementUpdate(item);
        }
        this.renderPages();
        this.selectElement(item.id);
      } else {
        if (initialPositions.size > 1) {
          for (const selId of initialPositions.keys()) {
            const elObj = this.elements.find((el) => el.id === selId);
            if (elObj) this.broadcastElementUpdate(elObj);
          }
        } else {
          this.broadcastElementUpdate(item);
        }
      }
      this.recordHistory();
      void this.flushAutoSave();
    };

    element.addEventListener('mousedown', (e) => {
      if (element.classList.contains('is-editing')) return;
      const target = e.target as HTMLElement;
      if (target?.isContentEditable || target?.closest('.collaborative-table-row-divider') || target?.closest('.is-editing')) return;
      if (e.button !== 0) return;
      document.body.classList.add('is-dragging-element');
      this.activateSelectTool();
      if (!this.selectedElementIds.has(item.id)) {
        this.selectElement(item.id);
      }
      startX = e.clientX;
      startY = e.clientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      startScrollLeft = workspace?.scrollLeft || 0;
      startScrollTop = workspace?.scrollTop || 0;
      initialX = item.x;
      initialY = item.y;
      initialPositions.clear();
      if (this.selectedElementIds.size > 1 && this.selectedElementIds.has(item.id)) {
        for (const selId of this.selectedElementIds) {
          const elObj = this.elements.find((el) => el.id === selId);
          if (elObj && 'x' in elObj && 'y' in elObj) {
            initialPositions.set(selId, { x: elObj.x, y: elObj.y });
          }
        }
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      workspace?.addEventListener('scroll', onScroll, { passive: true });
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
      document.body.classList.remove('is-dragging-element');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const dx = (e.clientX - startX) / (this.zoomLevel || 1);
      const dy = (e.clientY - startY) / (this.zoomLevel || 1);
      node.removeAttribute('transform');

      item.x = initialX + dx;
      item.y = initialY + dy;
      if (item.x2 !== undefined) item.x2 += dx;
      if (item.y2 !== undefined) item.y2 += dy;

      const sheets = this.container.querySelectorAll<HTMLElement>('.collaborative-page-sheet');
      let targetSheet: HTMLElement | null = null;
      let targetPageIndex = item.pageIndex ?? 0;

      for (const s of sheets) {
        const r = s.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          targetSheet = s;
          const pIdx = parseInt(s.getAttribute('data-page-index') || '0', 10);
          if (!isNaN(pIdx)) {
            targetPageIndex = pIdx;
          }
          break;
        }
      }

      if (targetSheet && targetPageIndex !== (item.pageIndex ?? 0)) {
        const originSheet = this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-${item.pageIndex ?? 0}"]`);
        const originRect = originSheet?.getBoundingClientRect();
        const targetRect = targetSheet.getBoundingClientRect();
        const zoom = this.zoomLevel || 1.0;
        if (originRect) {
          const absL = originRect.left + item.x * zoom;
          const absT = originRect.top + item.y * zoom;
          const shiftX = Math.round((absL - targetRect.left) / zoom) - item.x;
          const shiftY = Math.round((absT - targetRect.top) / zoom) - item.y;
          item.x += shiftX;
          item.y += shiftY;
          if (item.x2 !== undefined) item.x2 += shiftX;
          if (item.y2 !== undefined) item.y2 += shiftY;
        }
        item.pageIndex = targetPageIndex;
      }

      this.renderPages();
      this.selectElement(item.id);
      this.setModified(true);
      this.broadcastElementUpdate(item);
      this.recordHistory();
      void this.flushAutoSave();
    };

    node.addEventListener('mousedown', (e) => {
      document.body.classList.add('is-dragging-element');
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
    if (this.editorMode === 'view' && id !== null) {
      return;
    }
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
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
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
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
  }

  private updateSelection(): void {
    const allEls = this.container.querySelectorAll('.collaborative-text-box, .collaborative-shape-item, .collaborative-sticky-note, .collaborative-table-item, .collaborative-chart-item, .collaborative-image-item, .collaborative-line-item');
    allEls.forEach((el) => {
      const elId = el.getAttribute('data-element-id');
      const isSelected = (elId && this.selectedElementIds.has(elId)) || elId === this.selectedElementId;
      el.classList.toggle('is-selected', !!isSelected);
    });
  }

  private renderTransformBox(): void {
    this.removeTransformBox();
    if (!this.selectedElementId && this.selectedElementIds.size <= 1) return;

    if (this.selectedElementIds.size > 1) {
      const activeP = this.selectedPageIndex !== null ? this.selectedPageIndex : (this.activePageIndex ?? 0);
      const selectedEls = this.elements.filter(
        (e): e is ElementChart | ElementImage | ElementShape | ElementTable | ElementText =>
          this.selectedElementIds.has(e.id) && (e.pageIndex ?? 0) === activeP && e.type !== 'drawing'
      );
      if (selectedEls.length === 0) return;

      const sheet = this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-${activeP}"]`);
      if (!sheet) return;

      const box = document.createElement('div');
      box.className = 'collaborative-transform-box collaborative-transform-box--multi';
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
      this.bindMultiTransformBox(box, selectedEls);
      if (this.showRulersAndGuides) {
        this.updateRulers();
      }
      if (this.isLayersPanelOpen) {
        this.renderLayersList();
      }
      return;
    }

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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
    this.bindTransformHandles(box, el);
  }

  private removeTransformBox(): void {
    const existing = this.container.querySelector('[data-ref="transform-box"]');
    existing?.remove();
  }

  private bindMultiTransformBox(box: HTMLElement, selectedEls: Array<ElementChart | ElementImage | ElementShape | ElementTable | ElementText>): void {
    box.addEventListener('mousedown', (e) => {
      const handle = (e.target as HTMLElement).closest('.collaborative-transform-handle');
      if (handle) return;
      if (e.button !== 0) return;
      e.stopPropagation();

      document.body.classList.add('is-dragging-element');
      const startX = e.clientX;
      const startY = e.clientY;
      const workspace = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
      const startScrollLeft = workspace?.scrollLeft || 0;
      const startScrollTop = workspace?.scrollTop || 0;

      const initialPositions = new Map<string, { x: number; y: number }>();
      for (const el of selectedEls) {
        initialPositions.set(el.id, { x: el.x, y: el.y });
      }

      let lastClientX = startX;
      let lastClientY = startY;

      const updateMultiDrag = (clientX: number, clientY: number) => {
        const zoom = this.zoomLevel || 1;
        const scrollDx = (workspace?.scrollLeft || 0) - startScrollLeft;
        const scrollDy = (workspace?.scrollTop || 0) - startScrollTop;
        const dx = (clientX - startX + scrollDx) / zoom;
        const dy = (clientY - startY + scrollDy) / zoom;

        for (const el of selectedEls) {
          const init = initialPositions.get(el.id);
          if (!init) continue;
          el.x = init.x + dx;
          el.y = init.y + dy;
          const node = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
          if (node) {
            node.style.left = `${el.x}px`;
            node.style.top = `${el.y}px`;
          }
        }
        this.updateTransformBoxPosition();
        if (this.showRulersAndGuides) this.updateRulers();
        if (this.isLayersPanelOpen) this.renderLayersList();
        this.setModified(true);
      };

      const onMouseMove = (ev: MouseEvent) => {
        ev.preventDefault();
        lastClientX = ev.clientX;
        lastClientY = ev.clientY;
        updateMultiDrag(ev.clientX, ev.clientY);
      };

      const onScroll = () => {
        updateMultiDrag(lastClientX, lastClientY);
      };

      const onMouseUp = () => {
        document.body.classList.remove('is-dragging-element');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        workspace?.removeEventListener('scroll', onScroll);
        for (const el of selectedEls) {
          this.broadcastElementUpdate(el);
        }
        this.recordHistory();
        void this.flushAutoSave();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      workspace?.addEventListener('scroll', onScroll, { passive: true });
    });
  }

  private updateTransformBoxPosition(): void {
    const box = this.container.querySelector<HTMLElement>('[data-ref="transform-box"]');
    if (!box) return;

    if (this.selectedElementIds.size > 1) {
      const activeP = this.selectedPageIndex !== null ? this.selectedPageIndex : this.activePageIndex;
      const selectedEls = this.elements.filter(
        (e): e is ElementChart | ElementImage | ElementShape | ElementTable | ElementText =>
          this.selectedElementIds.has(e.id) && (e.pageIndex ?? 0) === activeP && e.type !== 'drawing'
      );
      if (selectedEls.length === 0) return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const el of selectedEls) {
        const w = el.width || 100;
        const h = el.height || 40;
        if (el.x < minX) minX = el.x;
        if (el.y < minY) minY = el.y;
        if (el.x + w > maxX) maxX = el.x + w;
        if (el.y + h > maxY) maxY = el.y + h;
      }

      box.style.left = `${minX}px`;
      box.style.top = `${minY}px`;
      box.style.width = `${Math.max(20, maxX - minX)}px`;
      box.style.height = `${Math.max(20, maxY - minY)}px`;
      box.style.transform = 'none';
      box.classList.remove('is-narrow');
      return;
    }

    if (!this.selectedElementId) return;

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

  private bindTransformHandles(box: HTMLElement, el: ElementChart | ElementImage | ElementShape | ElementTable | ElementText): void {
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

  private startRotating(e: MouseEvent, el: ElementChart | ElementImage | ElementShape | ElementTable | ElementText): void {
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
      if (this.showRulersAndGuides) {
        this.updateRulers();
      }
      if (this.isLayersPanelOpen) {
        this.renderLayersList();
      }
      this.setModified(true);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.broadcastElementUpdate(el);
      this.recordHistory();
      void this.flushAutoSave();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private startResizing(e: MouseEvent, el: ElementChart | ElementImage | ElementShape | ElementTable | ElementText, handleType: string): void {
    const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
    if (!elNode) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
    const startScrollLeft = workspace?.scrollLeft || 0;
    const startScrollTop = workspace?.scrollTop || 0;

    const initialW = el.width || 100;
    const initialH = el.height || 40;
    const initialX = el.x;
    const initialY = el.y;
    const initialFontSize = el.type === 'text' ? (el.fontSize || 16) : 16;

    const sheet = elNode.closest('.collaborative-page-sheet') || elNode.parentElement;
    const sizeBadge = document.createElement('div');
    sizeBadge.className = 'collaborative-size-badge';
    sizeBadge.textContent = `${Math.round(initialW)} × ${Math.round(initialH)} px`;
    sizeBadge.style.left = `${initialX + initialW / 2}px`;
    sizeBadge.style.top = `${initialY + initialH + 14}px`;
    sheet?.appendChild(sizeBadge);

    const onMouseMove = (ev: MouseEvent) => {
      const scrollDx = (workspace?.scrollLeft || 0) - startScrollLeft;
      const scrollDy = (workspace?.scrollTop || 0) - startScrollTop;
      const dx = (ev.clientX - startX + scrollDx) / (this.zoomLevel || 1);
      const dy = (ev.clientY - startY + scrollDy) / (this.zoomLevel || 1);

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

      if (el.type === 'chart') {
        elNode.innerHTML = this.renderChartSvg(el);
      }

      if (el.type === 'shape') {
        const svgNode = elNode.querySelector('svg');
        if (svgNode) {
          svgNode.setAttribute('viewBox', `0 0 ${el.width} ${el.height}`);
          svgNode.innerHTML = this.renderShapeInner(el);
        }
      }

      const otherElements = this.elements.filter(
        (e): e is ElementChart | ElementImage | ElementShape | ElementTable | ElementText =>
          e.id !== el.id && (e.pageIndex ?? 0) === (el.pageIndex ?? 0) && e.type !== 'drawing'
      );
      this.renderActiveSmartGuides(el, el.pageIndex ?? 0, el.x, el.y, el.width ?? 100, el.height ?? 40, otherElements);

      this.updateTransformBoxPosition();
      sizeBadge.textContent = `${Math.round(el.width || 0)} × ${Math.round(el.height || 0)} px`;
      sizeBadge.style.left = `${el.x + (el.width || 0) / 2}px`;
      sizeBadge.style.top = `${el.y + (el.height || 0) + 14}px`;
      if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
      this.setModified(true);
    };

    const onMouseUp = () => {
      sizeBadge.remove();
      this.clearSmartGuides(el.pageIndex ?? 0);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.renderPages();
      this.broadcastElementUpdate(el);
      this.recordHistory();
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
    return applySmartGuides(item, rawX, rawY, this.elements, this.getPageDimensions(item.pageIndex ?? 0), this.container);
  }

  private renderActiveSmartGuides(
    _item: { id: string },
    pageIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
    otherElements: Array<ElementChart | ElementImage | ElementShape | ElementTable | ElementText>
  ): void {
    renderActiveSmartGuides(pageIndex, x, y, width, height, otherElements, this.getPageDimensions(pageIndex), this.container);
  }

  private clearSmartGuides(pageIndex?: number): void {
    clearSmartGuides(this.container, pageIndex);
  }

  private recordHistory(): void {
    if (this.isApplyingHistory) return;
    const snapshot = JSON.stringify({
      elements: this.elements,
      pageBackgrounds: this.pageBackgrounds,
      pageCount: this.pageCount,
      pageSizes: this.pageSizes,
    });
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snapshot) {
      return;
    }
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistoryStates) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateUndoRedoButtons();
  }

  private undo(): void {
    if (this.undoStack.length <= 1) return;
    const currentState = this.undoStack.pop()!;
    this.redoStack.push(currentState);
    const previousState = this.undoStack[this.undoStack.length - 1];
    this.applyHistoryState(previousState);
    this.updateUndoRedoButtons();
  }

  private redo(): void {
    if (this.redoStack.length === 0) return;
    const nextState = this.redoStack.pop()!;
    this.undoStack.push(nextState);
    this.applyHistoryState(nextState);
    this.updateUndoRedoButtons();
  }

  private applyHistoryState(stateJson: string): void {
    try {
      this.isApplyingHistory = true;
      const parsed = JSON.parse(stateJson);
      this.elements = Array.isArray(parsed.elements) ? parsed.elements : [];
      if (typeof parsed.pageCount === 'number') this.pageCount = parsed.pageCount;
      if (Array.isArray(parsed.pageSizes)) this.pageSizes = parsed.pageSizes;
      if (Array.isArray(parsed.pageBackgrounds)) this.pageBackgrounds = parsed.pageBackgrounds;

      this.selectedElementId = null;
      this.selectedElementIds.clear();
      this.removeTransformBox();
      this.renderPages();
      this.updateContextToolbar();
      this.setModified(true);
      this.broadcastDocSync();
      void this.flushAutoSave();
    } finally {
      this.isApplyingHistory = false;
    }
  }

  private updateUndoRedoButtons(): void {
    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-undo"]');
    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-redo"]');
    if (btnUndo) {
      btnUndo.disabled = this.undoStack.length <= 1;
    }
    if (btnRedo) {
      btnRedo.disabled = this.redoStack.length === 0;
    }
  }

  private updateContextToolbar(): void {
    const toolbar = this.container.querySelector<HTMLElement>('[data-ref="collaborative-context-toolbar"]');
    if (!toolbar) return;

    const textGroup = toolbar.querySelector<HTMLElement>('[data-ref="context-group-text"]');
    const shapeGroup = toolbar.querySelector<HTMLElement>('[data-ref="context-group-shape"]');
    const imageGroup = toolbar.querySelector<HTMLElement>('[data-ref="context-group-image"]');
    const tableGroup = toolbar.querySelector<HTMLElement>('[data-ref="context-group-table"]');
    const chartGroup = toolbar.querySelector<HTMLElement>('[data-ref="context-group-chart"]');
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
        if (imageGroup) hideElement(imageGroup);
        if (tableGroup) hideElement(tableGroup);
        if (chartGroup) hideElement(chartGroup);

        const txtFontFamily = toolbar.querySelector<HTMLElement>('[data-ref="txt-font-family"]');
        if (txtFontFamily) txtFontFamily.textContent = el.fontFamily || 'Helvetica';

        const txtFontSize = toolbar.querySelector<HTMLElement>('[data-ref="txt-font-size"]');
        if (txtFontSize) txtFontSize.textContent = (el.fontSize || 16).toString();

        const isBoldActive = !!(el.isBold || (typeof el.fontWeight === 'number' && el.fontWeight >= 600));
        const btnBold = toolbar.querySelector<HTMLElement>('[data-ref="btn-toggle-bold"]');
        btnBold?.classList.toggle('is-active', isBoldActive);

        const btnItalic = toolbar.querySelector<HTMLElement>('[data-ref="btn-toggle-italic"]');
        btnItalic?.classList.toggle('is-active', !!el.isItalic);

        const btnUnderline = toolbar.querySelector<HTMLElement>('[data-ref="btn-toggle-underline"]');
        btnUnderline?.classList.toggle('is-active', !!el.isUnderline);

        const btnStrikethrough = toolbar.querySelector<HTMLElement>('[data-ref="btn-toggle-strikethrough"]');
        btnStrikethrough?.classList.toggle('is-active', !!el.isStrikethrough);

        const btnUppercase = toolbar.querySelector<HTMLElement>('[data-ref="btn-toggle-uppercase"]');
        btnUppercase?.classList.toggle('is-active', !!el.isUppercase);

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

        const align = el.align || 'left';
        const alignBtns = toolbar.querySelectorAll<HTMLElement>('[data-ref="dropdown-menu-text-align"] [data-align]');
        alignBtns.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.align === align));
        const iconAlign = toolbar.querySelector<SVGUseElement>('[data-ref="icon-current-align"] use');
        if (iconAlign) iconAlign.setAttribute('href', `/icons.svg#format_align_${align}`);

        const listType = el.listType || 'none';
        const listBtns = toolbar.querySelectorAll<HTMLElement>('[data-ref="dropdown-menu-text-list"] [data-list]');
        listBtns.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.list === listType));
        const iconList = toolbar.querySelector<SVGUseElement>('[data-ref="icon-current-list"] use');
        if (iconList) {
          const iconName = listType === 'numbered' ? 'format_list_numbered' : 'format_list_bulleted';
          iconList.setAttribute('href', `/icons.svg#${iconName}`);
        }

        const rangeLetter = toolbar.querySelector<HTMLInputElement>('[data-ref="range-letter-spacing"]');
        const numLetter = toolbar.querySelector<HTMLElement>('[data-ref="num-letter-spacing"]');
        const letterVal = el.letterSpacing ?? 0;
        if (rangeLetter) rangeLetter.value = letterVal.toString();
        if (numLetter) numLetter.textContent = letterVal.toString();

        const rangeLine = toolbar.querySelector<HTMLInputElement>('[data-ref="range-line-height"]');
        const numLine = toolbar.querySelector<HTMLElement>('[data-ref="num-line-height"]');
        const lhVal = el.lineHeight ?? 1.4;
        if (rangeLine) rangeLine.value = Math.round(lhVal * 10).toString();
        if (numLine) numLine.textContent = lhVal.toFixed(1);

        const vAlign = el.verticalAlign || 'top';
        const vAlignBtns = toolbar.querySelectorAll<HTMLElement>('[data-ref="valign-row"] [data-valign]');
        vAlignBtns.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.valign === vAlign));

        const rangeTextOp = toolbar.querySelector<HTMLInputElement>('[data-ref="range-text-opacity"]');
        const numTextOp = toolbar.querySelector<HTMLElement>('[data-ref="num-text-opacity"]');
        const textOpVal = Math.round((el.opacity !== undefined ? el.opacity : 1) * 100);
        if (rangeTextOp) rangeTextOp.value = textOpVal.toString();
        if (numTextOp) numTextOp.textContent = textOpVal.toString();
      } else if (el.type === 'shape') {
        showElement(shapeGroup);
        hideElement(textGroup);
        if (imageGroup) hideElement(imageGroup);
        if (tableGroup) hideElement(tableGroup);
        if (chartGroup) hideElement(chartGroup);

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

        const strokeStyle = el.strokeStyle || ((el.strokeWidth ?? 0) > 0 ? 'solid' : 'none');
        const strokeStyleBtns = toolbar.querySelectorAll<HTMLElement>('[data-ref="shape-stroke-styles-row"] [data-style]');
        strokeStyleBtns.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.style === strokeStyle));

        const rangeShapeStroke = toolbar.querySelector<HTMLInputElement>('[data-ref="range-shape-stroke-width"]');
        const numShapeStroke = toolbar.querySelector<HTMLElement>('[data-ref="num-shape-stroke-width"]');
        const swVal = el.strokeWidth ?? 0;
        if (rangeShapeStroke) rangeShapeStroke.value = swVal.toString();
        if (numShapeStroke) numShapeStroke.textContent = swVal.toString();

        const rangeShapeCorner = toolbar.querySelector<HTMLInputElement>('[data-ref="range-shape-corner-radius"]');
        const numShapeCorner = toolbar.querySelector<HTMLElement>('[data-ref="num-shape-corner-radius"]');
        const crVal = el.borderRadius ?? 0;
        if (rangeShapeCorner) rangeShapeCorner.value = crVal.toString();
        if (numShapeCorner) numShapeCorner.textContent = crVal.toString();

        const rangeShapeSides = toolbar.querySelector<HTMLInputElement>('[data-ref="range-shape-sides"]');
        const numShapeSides = toolbar.querySelector<HTMLElement>('[data-ref="num-shape-sides"]');
        let currentSides = el.sides;
        if (!currentSides) {
          if (el.shapeType === 'triangle' || el.shapeType === 'triangle-down' || el.shapeType === 'right-triangle') currentSides = 3;
          else if (el.shapeType === 'pentagon') currentSides = 5;
          else if (el.shapeType === 'hexagon' || el.shapeType === 'hexagon-vertical') currentSides = 6;
          else if (el.shapeType === 'heptagon') currentSides = 7;
          else if (el.shapeType === 'octagon') currentSides = 8;
          else if (el.shapeType === 'decagon') currentSides = 10;
          else currentSides = 4;
        }
        if (rangeShapeSides) rangeShapeSides.value = currentSides.toString();
        if (numShapeSides) numShapeSides.textContent = currentSides.toString();

        const rangeShapeOp = toolbar.querySelector<HTMLInputElement>('[data-ref="range-shape-opacity"]');
        const numShapeOp = toolbar.querySelector<HTMLElement>('[data-ref="num-shape-opacity"]');
        const shapeOpVal = Math.round((el.opacity !== undefined ? el.opacity : 1) * 100);
        if (rangeShapeOp) rangeShapeOp.value = shapeOpVal.toString();
        if (numShapeOp) numShapeOp.textContent = shapeOpVal.toString();
      } else if (el.type === 'image') {
        if (imageGroup) showElement(imageGroup);
        hideElement(textGroup);
        hideElement(shapeGroup);
        if (tableGroup) hideElement(tableGroup);
        if (chartGroup) hideElement(chartGroup);

        const imgStrokeStyle = el.borderStyle || ((el.borderWidth ?? 0) > 0 ? 'solid' : 'none');
        const imgStrokeBtns = toolbar.querySelectorAll<HTMLElement>('[data-ref="image-stroke-styles-row"] [data-style]');
        imgStrokeBtns.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.style === imgStrokeStyle));

        const rangeImgStroke = toolbar.querySelector<HTMLInputElement>('[data-ref="range-image-stroke-width"]');
        const numImgStroke = toolbar.querySelector<HTMLElement>('[data-ref="num-image-stroke-width"]');
        const imgSwVal = el.borderWidth ?? 0;
        if (rangeImgStroke) rangeImgStroke.value = imgSwVal.toString();
        if (numImgStroke) numImgStroke.textContent = imgSwVal.toString();

        const rangeImgCorner = toolbar.querySelector<HTMLInputElement>('[data-ref="range-image-corner-radius"]');
        const numImgCorner = toolbar.querySelector<HTMLElement>('[data-ref="num-image-corner-radius"]');
        const imgCrVal = el.borderRadius ?? 0;
        if (rangeImgCorner) rangeImgCorner.value = imgCrVal.toString();
        if (numImgCorner) numImgCorner.textContent = imgCrVal.toString();

        const rangeImgOp = toolbar.querySelector<HTMLInputElement>('[data-ref="range-image-opacity"]');
        const numImgOp = toolbar.querySelector<HTMLElement>('[data-ref="num-image-opacity"]');
        const imgOpVal = Math.round((el.opacity !== undefined ? el.opacity : 1) * 100);
        if (rangeImgOp) rangeImgOp.value = imgOpVal.toString();
        if (numImgOp) numImgOp.textContent = imgOpVal.toString();
      } else if (el.type === 'chart') {
        if (chartGroup) showElement(chartGroup);
        hideElement(textGroup);
        hideElement(shapeGroup);
        if (imageGroup) hideElement(imageGroup);
        if (tableGroup) hideElement(tableGroup);
      } else if (el.type === 'table') {
        if (chartGroup) hideElement(chartGroup);
        if (tableGroup) showElement(tableGroup);
        hideElement(textGroup);
        hideElement(shapeGroup);
        if (imageGroup) hideElement(imageGroup);

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
        if (chartGroup) hideElement(chartGroup);
        hideElement(textGroup);
        hideElement(shapeGroup);
        if (imageGroup) hideElement(imageGroup);
        if (tableGroup) hideElement(tableGroup);
      }
    } else if (this.selectedPageIndex !== null) {
      showElement(toolbar);
      hideElement(actionGroup);
      showElement(pageGroup);
      hideElement(textGroup);
      hideElement(shapeGroup);
      if (imageGroup) hideElement(imageGroup);
      if (tableGroup) hideElement(tableGroup);
      if (chartGroup) hideElement(chartGroup);

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
      if (chartGroup) hideElement(chartGroup);
      if (imageGroup) hideElement(imageGroup);
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
      this.recordHistory();
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
      this.recordHistory();
      void this.flushAutoSave();
    } else if (this.selectedPageIndex !== null) {
      this.deletePage(this.selectedPageIndex);
    }
  }

  private duplicateSelected(): void {
    const targetIds = new Set<string>();
    if (this.selectedElementIds.size > 0) {
      for (const id of this.selectedElementIds) targetIds.add(id);
    } else if (this.selectedElementId) {
      targetIds.add(this.selectedElementId);
    }

    if (targetIds.size > 0) {
      const selectedElements = this.elements.filter((el) => targetIds.has(el.id));
      const newIds: string[] = [];
      for (const el of selectedElements) {
        const clone = JSON.parse(JSON.stringify(el));
        clone.id = `${clone.type}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        clone.x = (clone.x || 100) + 24;
        clone.y = (clone.y || 100) + 24;
        if (clone.x2 !== undefined) clone.x2 += 24;
        if (clone.y2 !== undefined) clone.y2 += 24;
        this.pushElement(clone);
        newIds.push(clone.id);
      }
      this.renderPages();
      this.selectedElementIds.clear();
      for (const id of newIds) this.selectedElementIds.add(id);
      this.selectedElementId = newIds[0] || null;
      this.updateTransformBoxPosition();
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
      this.updateContextToolbar();
      showToast(newIds.length > 1 ? `${newIds.length} elementos duplicados` : 'Elemento duplicado', 'info');
    } else if (this.selectedPageIndex !== null) {
      this.duplicatePage(this.selectedPageIndex);
    }
  }

  private copySelectedElements(): void {
    const targetIds = new Set<string>();
    if (this.selectedElementIds.size > 0) {
      for (const id of this.selectedElementIds) targetIds.add(id);
    } else if (this.selectedElementId) {
      targetIds.add(this.selectedElementId);
    }

    if (targetIds.size === 0) return;

    const selectedElements = this.elements.filter((el) => targetIds.has(el.id));
    if (selectedElements.length === 0) return;

    const payload = {
      __boardpdf_collab_elements__: true,
      elements: JSON.parse(JSON.stringify(selectedElements)),
      sourceDocId: this.docId,
      sourcePageIndex: selectedElements[0]?.pageIndex ?? 0,
      timestamp: Date.now(),
    };

    const payloadJson = JSON.stringify(payload);
    try {
      localStorage.setItem('boardpdf_collab_clipboard', payloadJson);
    } catch {}

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(payloadJson).catch(() => {});
    }

    showToast(selectedElements.length > 1 ? `${selectedElements.length} elementos copiados` : 'Elemento copiado', 'info');
  }

  private async pasteFromClipboard(overrideText?: string, overrideFiles?: FileList | null): Promise<void> {
    const activeTag = document.activeElement?.tagName.toLowerCase();
    const isEditing = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;
    if (isEditing) return;

    const now = performance.now();
    if (now - this.lastPasteTimestamp < 150) return;
    this.lastPasteTimestamp = now;

    let text = overrideText;
    const files = overrideFiles;

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            this.addImageElement({
              id: `pasted_${Date.now()}`,
              name: file.name || 'Imagen pegada',
              size: file.size || 0,
              type: 'image',
              url: dataUrl,
            });
            showToast('Imagen pegada', 'info');
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }

    if (text === undefined) {
      try {
        const localData = localStorage.getItem('boardpdf_collab_clipboard');
        if (localData && localData.includes('__boardpdf_collab_elements__')) {
          text = localData;
        }
      } catch {}
    }

    if (text === undefined && navigator.clipboard?.readText) {
      try {
        text = await navigator.clipboard.readText();
      } catch {
        showToast('Para pegar contenido externo, usa el atajo Ctrl+V', 'info');
        return;
      }
    }

    const targetPageIndex = this.selectedPageIndex !== null
      ? this.selectedPageIndex
      : (this.elements.find((e) => e.id === this.selectedElementId)?.pageIndex ?? 0);
    const pageDim = this.getPageDimensions(targetPageIndex);

    let collabPayload: {
      __boardpdf_collab_elements__: boolean;
      elements: EditorElement[];
      sourceDocId?: string;
      sourcePageIndex?: number;
      timestamp?: number;
    } | null = null;

    if (text && text.includes('__boardpdf_collab_elements__')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.__boardpdf_collab_elements__ && Array.isArray(parsed.elements)) {
          collabPayload = parsed;
        }
      } catch {}
    }

    if (!collabPayload && (!text || text.trim() === '')) {
      try {
        const localRaw = localStorage.getItem('boardpdf_collab_clipboard');
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (parsed && parsed.__boardpdf_collab_elements__ && Array.isArray(parsed.elements)) {
            collabPayload = parsed;
          }
        }
      } catch {}
    }

    if (collabPayload && collabPayload.elements.length > 0) {
      const isSameDocAndPage = collabPayload.sourceDocId === this.docId && (collabPayload.sourcePageIndex ?? 0) === targetPageIndex;

      if (collabPayload.timestamp && collabPayload.timestamp === this.lastPastedTimestamp) {
        this.consecutivePasteCount++;
      } else {
        this.lastPastedTimestamp = collabPayload.timestamp || Date.now();
        this.consecutivePasteCount = 0;
      }

      const offset = (isSameDocAndPage ? 24 : 0) + (this.consecutivePasteCount * 24);
      const newIds: string[] = [];

      for (const rawEl of collabPayload.elements) {
        const cloned: EditorElement = JSON.parse(JSON.stringify(rawEl));
        const newId = `${cloned.type}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        cloned.id = newId;
        cloned.pageIndex = targetPageIndex;

        if (cloned.type === 'drawing') {
          if (offset > 0) {
            cloned.points = cloned.points.map((pt) => ({ x: pt.x + offset, y: pt.y + offset }));
          }
        } else {
          cloned.x = (cloned.x || 0) + offset;
          cloned.y = (cloned.y || 0) + offset;
          if ('x2' in cloned && cloned.x2 !== undefined) cloned.x2 += offset;
          if ('y2' in cloned && cloned.y2 !== undefined) cloned.y2 += offset;
        }

        this.pushElement(cloned);
        newIds.push(newId);
      }

      this.renderPages();
      this.selectedElementIds.clear();
      for (const id of newIds) {
        this.selectedElementIds.add(id);
      }
      this.selectedElementId = newIds[0] || null;
      this.updateTransformBoxPosition();
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
      this.updateContextToolbar();
      this.activateSelectTool();
      void this.flushAutoSave();

      showToast(newIds.length > 1 ? `${newIds.length} elementos pegados` : 'Elemento pegado', 'info');
      return;
    }

    if (text && text.trim().length > 0) {
      const cleanText = text.trim();
      const id = `text_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const defaultW = Math.min(420, Math.max(180, Math.round(pageDim.width * 0.6)));
      const x = Math.max(40, Math.round((pageDim.width - defaultW) / 2));
      const y = Math.max(80, Math.round(pageDim.height * 0.35 + (this.elements.length % 5) * 20));

      const newTextEl: ElementText = {
        align: 'left',
        color: '#000000',
        fontFamily: 'Helvetica',
        fontSize: 16,
        id,
        pageIndex: targetPageIndex,
        text: cleanText,
        type: 'text',
        width: defaultW,
        x,
        y,
      };

      this.pushElement(newTextEl);
      this.renderPages();

      const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
      if (elNode) {
        newTextEl.width = Math.ceil((elNode.offsetWidth || elNode.scrollWidth) + 8);
        newTextEl.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
        elNode.style.width = `${newTextEl.width}px`;
        elNode.style.height = `${newTextEl.height}px`;
        this.broadcastElementUpdate(newTextEl);
      }

      this.selectElement(id);
      this.activateSelectTool();
      void this.flushAutoSave();
      showToast('Texto pegado', 'info');
    }
  }

  private openFontMenu(): void {
    this.handleRailTabClick('fonts');
  }

  private renderFontsPanel(): void {
    this.ensureDrawerMounted();
    if (!this.drawer) return;

    const searchInput = this.queryPanel<HTMLInputElement>('[data-ref="input-search-fonts"]');
    const clearSearchBtn = this.queryPanel<HTMLButtonElement>('[data-ref="btn-clear-fonts-search"]');

    if (searchInput && !searchInput.dataset.hasFontListener) {
      searchInput.dataset.hasFontListener = 'true';
      searchInput.addEventListener('input', () => {
        this.fontSearchQuery = searchInput.value.trim();
        if (clearSearchBtn) {
          clearSearchBtn.style.display = this.fontSearchQuery ? 'inline-flex' : 'none';
        }
        this.updateFontList();
      });
    }

    if (clearSearchBtn && !clearSearchBtn.dataset.hasFontListener) {
      clearSearchBtn.dataset.hasFontListener = 'true';
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          this.fontSearchQuery = '';
          clearSearchBtn.style.display = 'none';
          this.updateFontList();
        }
      });
    }

    this.updateFontList();
  }

  private updateFontList(): void {
    const listContainer = this.queryPanel<HTMLElement>('[data-ref="font-list-container"]');
    if (!listContainer) return;

    let activeEl: ElementText | undefined;
    if (this.selectedElementId) {
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') activeEl = el;
    }
    const currentFamily = activeEl?.fontFamily || 'Helvetica';
    const curWeight = Number(activeEl?.fontWeight || (activeEl?.isBold ? 700 : 400));
    const isItalic = activeEl?.fontStyle === 'italic' || !!activeEl?.isItalic;

    let filtered = GOOGLE_FONTS_CATALOG;
    if (this.fontActiveCategory !== 'all') {
      filtered = filtered.filter((f) => f.category === this.fontActiveCategory);
    }
    if (this.fontSearchQuery) {
      const q = this.fontSearchQuery.toLowerCase();
      filtered = filtered.filter((f) => f.family.toLowerCase().includes(q));
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="collaborative-panel-empty" style="text-align: center; padding: 24px; color: var(--text-secondary); font-size: 13px;">No se encontraron fuentes</div>';
      return;
    }

    listContainer.innerHTML = filtered.map((f) => {
      const isSelected = f.family.toLowerCase() === currentFamily.toLowerCase();
      const isExpanded = this.expandedFontFamily?.toLowerCase() === f.family.toLowerCase();

      const variantsHtml = isExpanded ? `
        <div class="collaborative-font-variants-inline" data-ref="font-variants-${f.family.replace(/\s+/g, '-')}">
          <div class="collaborative-font-weights-grid">
            ${f.weights.map((w) => {
              const isAct = w === curWeight;
              const label = WEIGHT_LABELS[w] || `${w}`;
              return `<button type="button" class="collaborative-weight-pill${isAct ? ' is-active' : ''}" data-font-family="${f.family}" data-weight="${w}" style="font-family: '${f.family}', sans-serif; font-weight: ${w};">${w} ${label}</button>`;
            }).join('')}
            ${f.hasItalic ? `
              <button type="button" class="collaborative-weight-pill${isItalic ? ' is-active' : ''}" data-font-family="${f.family}" data-action="toggle-italic" style="font-family: '${f.family}', sans-serif; font-style: italic;">Cursiva</button>
            ` : ''}
          </div>
        </div>
      ` : '';

      return `
        <div class="collaborative-font-card${isSelected ? ' is-selected' : ''}${isExpanded ? ' is-expanded' : ''}" data-ref="font-card-${f.family.replace(/\s+/g, '-')}" data-font-family="${f.family}">
          <button type="button" class="collaborative-font-card__header collaborative-text-preset" data-ref="font-item-${f.family.replace(/\s+/g, '-')}" data-font-family="${f.family}">
            <div class="collaborative-font-card__info">
              <span class="collaborative-font-card__name" style="font-family: '${f.family}', sans-serif;">${f.family}</span>
              <span class="collaborative-font-card__meta">${f.category} • ${f.weights.length} variantes</span>
            </div>
            <svg class="component-icon collaborative-font-card__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>
          ${variantsHtml}
        </div>
      `;
    }).join('');

    renderIcons(listContainer);

    if (this.fontObserver) {
      this.fontObserver.disconnect();
    }
    this.fontObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const fam = entry.target.getAttribute('data-font-family');
          if (fam) {
            loadGoogleFontPreview(fam);
            this.fontObserver?.unobserve(entry.target);
          }
        }
      }
    }, { root: listContainer, rootMargin: '80px' });

    const fontHeaders = listContainer.querySelectorAll<HTMLButtonElement>('.collaborative-font-card__header');
    fontHeaders.forEach((btn) => {
      const fam = btn.getAttribute('data-font-family');
      if (fam) {
        this.fontObserver?.observe(btn);
        btn.addEventListener('click', async () => {
          await this.applyFontFamily(fam);
          this.expandedFontFamily = this.expandedFontFamily?.toLowerCase() === fam.toLowerCase() ? null : fam;
          this.updateFontList();
        });
      }
    });

    const weightPills = listContainer.querySelectorAll<HTMLButtonElement>('.collaborative-weight-pill[data-weight]');
    weightPills.forEach((pill) => {
      pill.addEventListener('click', async (e) => {
        e.stopPropagation();
        const weightNum = Number(pill.getAttribute('data-weight') || 400);
        const fam = pill.getAttribute('data-font-family');
        if (activeEl) {
          activeEl.fontWeight = weightNum;
          activeEl.isBold = weightNum >= 600;
          if (fam) await loadGoogleFont(fam, [weightNum], activeEl.fontStyle === 'italic');
          const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${activeEl.id}"]`);
          if (elNode) {
            elNode.style.fontWeight = `${weightNum}`;
            if (!activeEl.isStickyNote) {
              elNode.style.width = 'auto';
              elNode.style.height = 'auto';
              activeEl.width = Math.ceil(elNode.offsetWidth || elNode.scrollWidth);
              activeEl.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
              elNode.style.width = `${activeEl.width}px`;
              elNode.style.height = `${activeEl.height}px`;
            }
          }
          this.updateTransformBoxPosition();
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
          this.updateContextToolbar();
          this.setModified(true);
          this.broadcastElementUpdate(activeEl);
          this.recordHistory();
          this.updateFontList();
        }
      });
    });

    const italicPills = listContainer.querySelectorAll<HTMLButtonElement>('.collaborative-weight-pill[data-action="toggle-italic"]');
    italicPills.forEach((pill) => {
      pill.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fam = pill.getAttribute('data-font-family');
        if (activeEl) {
          const nextStyle = activeEl.fontStyle === 'italic' ? 'normal' : 'italic';
          activeEl.fontStyle = nextStyle;
          activeEl.isItalic = nextStyle === 'italic';
          if (fam) await loadGoogleFont(fam, undefined, true);
          const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${activeEl.id}"]`);
          if (elNode) {
            elNode.style.fontStyle = nextStyle;
            if (!activeEl.isStickyNote) {
              elNode.style.width = 'auto';
              elNode.style.height = 'auto';
              activeEl.width = Math.ceil(elNode.offsetWidth || elNode.scrollWidth);
              activeEl.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
              elNode.style.width = `${activeEl.width}px`;
              elNode.style.height = `${activeEl.height}px`;
            }
          }
          this.updateTransformBoxPosition();
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
          this.updateContextToolbar();
          this.setModified(true);
          this.broadcastElementUpdate(activeEl);
          this.recordHistory();
          this.updateFontList();
        }
      });
    });
  }

  private async applyFontFamily(family: string): Promise<void> {
    const fontItem = GOOGLE_FONTS_CATALOG.find((f) => f.family.toLowerCase() === family.toLowerCase());
    await loadGoogleFont(family, fontItem?.weights, fontItem?.hasItalic);

    const targetIds = new Set<string>();
    if (this.selectedElementIds.size > 0) {
      for (const id of this.selectedElementIds) targetIds.add(id);
    } else if (this.selectedElementId) {
      targetIds.add(this.selectedElementId);
    }

    let updatedAny = false;

    for (const id of targetIds) {
      const el = this.elements.find((e) => e.id === id);
      if (el && el.type === 'text') {
        el.fontFamily = family;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          elNode.style.fontFamily = `'${family}', sans-serif`;
          if (!el.isStickyNote) {
            elNode.style.width = 'auto';
            elNode.style.height = 'auto';
            el.width = Math.ceil(elNode.offsetWidth || elNode.scrollWidth);
            el.height = Math.ceil(elNode.offsetHeight || elNode.scrollHeight);
            elNode.style.width = `${el.width}px`;
            elNode.style.height = `${el.height}px`;
          }
        }
        this.broadcastElementUpdate(el);
        updatedAny = true;
      }
    }

    if (updatedAny) {
      this.updateTransformBoxPosition();
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
      this.updateContextToolbar();
      this.setModified(true);
      this.recordHistory();
      void this.flushAutoSave();
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
        this.updateTransformBoxPosition();
        if (this.showRulersAndGuides) {
          this.updateRulers();
        }
        if (this.isLayersPanelOpen) {
          this.renderLayersList();
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
        this.updateTransformBoxPosition();
        if (this.showRulersAndGuides) {
          this.updateRulers();
        }
        if (this.isLayersPanelOpen) {
          this.renderLayersList();
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
    this.recordHistory();
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

    const btnTopHome = this.container.querySelector<HTMLElement>('[data-ref="btn-top-home"]');
    btnTopHome?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/');
    }, { signal });

    const fileWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-file"]');
    if (fileWrapper) {
      this.fileDropdownCtrl = setupDropdown(fileWrapper, {
        backdrop: fileWrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-file"]'),
        menu: fileWrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-file"]'),
      });
    }

    const editWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-edit"]');
    if (editWrapper) {
      this.editDropdownCtrl = setupDropdown(editWrapper, {
        backdrop: editWrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-edit"]'),
        menu: editWrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-edit"]'),
      });
    }

    const btnMenuFileNew = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-file-new"]');
    btnMenuFileNew?.addEventListener('click', () => {
      this.fileDropdownCtrl?.close();
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc_${Date.now().toString(36)}`;
      window.open(`/d/${newId}`, '_blank');
    }, { signal });

    const btnMenuFileUpload = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-file-upload"]');
    btnMenuFileUpload?.addEventListener('click', () => {
      this.fileDropdownCtrl?.close();
      if (this.activePanelTab !== 'uploads' || !this.drawer?.classList.contains('is-open')) {
        this.handleRailTabClick('uploads');
      }
    }, { signal });

    const btnMenuFileCopy = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-file-copy"]');
    btnMenuFileCopy?.addEventListener('click', async () => {
      this.fileDropdownCtrl?.close();
      await this.createDocumentCopy();
    }, { signal });

    const btnMenuFileRulers = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-file-rulers"]');
    const submenuRulers = this.container.querySelector<HTMLElement>('[data-ref="dropdown-submenu-rulers"]');
    const rulersParent = this.container.querySelector<HTMLElement>('[data-ref="item-menu-file-rulers-parent"]');

    btnMenuFileRulers?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !submenuRulers?.classList.contains('is-hidden');
      if (isOpen) {
        submenuRulers?.classList.add('is-hidden');
        rulersParent?.classList.remove('is-open');
      } else {
        submenuRulers?.classList.remove('is-hidden');
        rulersParent?.classList.add('is-open');
      }
    }, { signal });

    rulersParent?.addEventListener('mouseenter', () => {
      submenuRulers?.classList.remove('is-hidden');
      rulersParent.classList.add('is-open');
    }, { signal });

    rulersParent?.addEventListener('mouseleave', () => {
      submenuRulers?.classList.add('is-hidden');
      rulersParent.classList.remove('is-open');
    }, { signal });

    const btnSubRulers = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sub-toggle-rulers"]');
    btnSubRulers?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleRulersAndGuides();
    }, { signal });

    const btnSubAddGuides = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sub-add-guides"]');
    btnSubAddGuides?.addEventListener('click', () => {
      this.fileDropdownCtrl?.close();
      submenuRulers?.classList.add('is-hidden');
      rulersParent?.classList.remove('is-open');
      this.openGuidesModal();
    }, { signal });

    const btnSubMargins = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sub-toggle-margins"]');
    btnSubMargins?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMargins();
    }, { signal });

    const btnSubBleed = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sub-toggle-bleed"]');
    btnSubBleed?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleBleed();
    }, { signal });

    const btnMenuFileDownload = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-file-download"]');
    btnMenuFileDownload?.addEventListener('click', () => {
      this.fileDropdownCtrl?.close();
      this.downloadPdf();
    }, { signal });

    const btnMenuFileSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-file-search"]');
    btnMenuFileSearch?.addEventListener('click', () => {
      this.fileDropdownCtrl?.close();
      this.openFindReplace();
    }, { signal });

    const btnMenuFileDelete = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-file-delete"]');
    btnMenuFileDelete?.addEventListener('click', () => {
      this.fileDropdownCtrl?.close();
      this.confirmDeleteDocument();
    }, { signal });

    const btnGuidesBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-guides-modal-back"]');
    const btnGuidesCancel = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-guides-cancel"]');
    const closeGuides = () => {
      this.currentGuidesPreset = this.committedGuidesPreset;
      this.container.querySelector('[data-ref="collab-guides-modal"]')?.classList.add('is-hidden');
      this.renderPages();
    };
    btnGuidesBack?.addEventListener('click', closeGuides, { signal });
    btnGuidesCancel?.addEventListener('click', closeGuides, { signal });

    const presetCards = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="card-guide-"]');
    presetCards.forEach((card) => {
      card.addEventListener('click', () => {
        const preset = card.getAttribute('data-preset') as '12-col' | '3-col' | '3x3' | 'custom';
        presetCards.forEach((c) => c.classList.remove('is-active'));
        card.classList.add('is-active');

        const customFields = this.container.querySelector('[data-ref="collab-guides-custom-fields"]');
        if (preset === 'custom') {
          customFields?.classList.remove('is-hidden');
        } else {
          customFields?.classList.add('is-hidden');
        }

        this.currentGuidesPreset = preset;
        if (!this.showRulersAndGuides) {
          this.showRulersAndGuides = true;
          this.updateRulersUI();
        }
        this.renderPages();
      }, { signal });
    });

    const inputCols = this.container.querySelector<HTMLInputElement>('[data-ref="input-guides-custom-cols"]');
    const inputRows = this.container.querySelector<HTMLInputElement>('[data-ref="input-guides-custom-rows"]');
    inputCols?.addEventListener('input', () => {
      this.customGuideCols = Math.max(1, parseInt(inputCols.value || '1', 10));
      if (this.currentGuidesPreset === 'custom') {
        this.renderPages();
      }
    }, { signal });
    inputRows?.addEventListener('input', () => {
      this.customGuideRows = Math.max(1, parseInt(inputRows.value || '1', 10));
      if (this.currentGuidesPreset === 'custom') {
        this.renderPages();
      }
    }, { signal });

    const btnGuidesConfirm = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-guides-confirm"]');
    btnGuidesConfirm?.addEventListener('click', () => {
      this.committedGuidesPreset = this.currentGuidesPreset;
      this.container.querySelector('[data-ref="collab-guides-modal"]')?.classList.add('is-hidden');
      this.renderPages();
      showToast('Guías agregadas al documento', 'success');
    }, { signal });

    const btnFindClose = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-find-replace-close"]');
    btnFindClose?.addEventListener('click', () => {
      this.closeFindReplace();
    }, { signal });

    const inputSearch = this.container.querySelector<HTMLInputElement>('[data-ref="input-find-search"]');
    const inputReplace = this.container.querySelector<HTMLInputElement>('[data-ref="input-find-replace"]');
    const checkMatchCase = this.container.querySelector<HTMLInputElement>('[data-ref="check-find-match-case"]');

    inputSearch?.addEventListener('input', () => {
      this.findSearchTerm = inputSearch.value;
      this.executeSearch();
    }, { signal });

    inputSearch?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.findPrev();
        } else {
          this.findNext();
        }
      } else if (e.key === 'Escape') {
        this.closeFindReplace();
      }
    }, { signal });

    inputReplace?.addEventListener('input', () => {
      this.findReplaceTerm = inputReplace.value;
    }, { signal });

    checkMatchCase?.addEventListener('change', () => {
      this.findMatchCase = checkMatchCase.checked;
      this.executeSearch();
    }, { signal });

    const btnFindPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-find-prev"]');
    const btnFindNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-find-next"]');
    btnFindPrev?.addEventListener('click', () => {
      this.findPrev();
    }, { signal });
    btnFindNext?.addEventListener('click', () => {
      this.findNext();
    }, { signal });

    const btnReplaceOne = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-find-replace-one"]');
    const btnReplaceAll = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-find-replace-all"]');
    btnReplaceOne?.addEventListener('click', () => {
      this.replaceCurrent();
    }, { signal });
    btnReplaceAll?.addEventListener('click', () => {
      this.replaceAll();
    }, { signal });

    const workspaceEl = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
    workspaceEl?.addEventListener('scroll', () => {
      if (this.showRulersAndGuides) {
        if (this.rulerRafId) cancelAnimationFrame(this.rulerRafId);
        this.rulerRafId = requestAnimationFrame(() => {
          this.updateRulers();
        });
      }
    }, { passive: true, signal });

    const contextDropdownNames = [
      'text-align',
      'text-list',
      'text-advanced',
      'text-opacity',
      'shape-stroke',
      'shape-corner',
      'shape-opacity',
      'shape-flip',
      'image-stroke',
      'image-corner',
      'image-opacity',
      'image-flip',
    ];

    for (const name of contextDropdownNames) {
      const wrap = this.container.querySelector<HTMLElement>(`[data-ref="dropdown-wrapper-${name}"]`);
      if (wrap) {
        const ctrl = setupDropdown(wrap, {
          backdrop: wrap.querySelector<HTMLElement>(`[data-ref="dropdown-backdrop-${name}"]`),
          menu: wrap.querySelector<HTMLElement>(`[data-ref="dropdown-menu-${name}"]`),
        });
        this.activeContextDropdowns.push(ctrl);
      }
    }

    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-undo"]');
    btnUndo?.addEventListener('click', () => {
      this.undo();
    }, { signal });

    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-redo"]');
    btnRedo?.addEventListener('click', () => {
      this.redo();
    }, { signal });

    this.updateUndoRedoButtons();

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
          userId: currentUser?.id ?? null,
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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
        this.setModified(true);
        this.recordHistory();
      }
    }, { signal });

    const btnFontFamily = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-font-family"]');
    btnFontFamily?.addEventListener('click', () => {
      this.openFontMenu();
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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
        this.setModified(true);
        this.broadcastElementUpdate(el);
        this.recordHistory();
      }
    }, { signal });

    const btnToggleItalic = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-italic"]');
    btnToggleItalic?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        el.isItalic = !el.isItalic;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          elNode.style.fontStyle = el.isItalic ? 'italic' : 'normal';
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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
        this.setModified(true);
        this.broadcastElementUpdate(el);
        this.recordHistory();
      }
    }, { signal });

    const btnToggleUnderline = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-underline"]');
    btnToggleUnderline?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        el.isUnderline = !el.isUnderline;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          const decs: string[] = [];
          if (el.isUnderline) decs.push('underline');
          if (el.isStrikethrough) decs.push('line-through');
          elNode.style.textDecoration = decs.length ? decs.join(' ') : 'none';
        }
        this.updateContextToolbar();
        this.setModified(true);
        this.broadcastElementUpdate(el);
        this.recordHistory();
      }
    }, { signal });

    const btnToggleStrikethrough = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-strikethrough"]');
    btnToggleStrikethrough?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        el.isStrikethrough = !el.isStrikethrough;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          const decs: string[] = [];
          if (el.isUnderline) decs.push('underline');
          if (el.isStrikethrough) decs.push('line-through');
          elNode.style.textDecoration = decs.length ? decs.join(' ') : 'none';
        }
        this.updateContextToolbar();
        this.setModified(true);
        this.broadcastElementUpdate(el);
        this.recordHistory();
      }
    }, { signal });

    const btnToggleUppercase = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-uppercase"]');
    btnToggleUppercase?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        el.isUppercase = !el.isUppercase;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          elNode.style.textTransform = el.isUppercase ? 'uppercase' : 'none';
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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
        this.setModified(true);
        this.broadcastElementUpdate(el);
        this.recordHistory();
      }
    }, { signal });

    const alignOptions = this.container.querySelectorAll<HTMLElement>('[data-ref="dropdown-menu-text-align"] [data-align]');
    alignOptions.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((e) => e.id === this.selectedElementId);
        if (el && el.type === 'text') {
          const align = (btn.dataset.align as 'center' | 'justify' | 'left' | 'right') || 'left';
          el.align = align;
          const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
          if (elNode) elNode.style.textAlign = align;
          this.updateContextToolbar();
          this.setModified(true);
          this.broadcastElementUpdate(el);
          this.recordHistory();
        }
      }, { signal });
    });

    const listOptions = this.container.querySelectorAll<HTMLElement>('[data-ref="dropdown-menu-text-list"] [data-list]');
    listOptions.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((e) => e.id === this.selectedElementId);
        if (el && el.type === 'text') {
          const listType = (btn.dataset.list as 'bullet' | 'none' | 'numbered') || 'none';
          el.listType = listType;
          el.text = applyListFormatting(el.text, listType);
          const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
          if (elNode) {
            const contentEl = elNode.querySelector<HTMLElement>('.collaborative-element-text__content') || elNode;
            contentEl.innerText = el.text;
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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
          this.setModified(true);
          this.broadcastElementUpdate(el);
          this.recordHistory();
        }
      }, { signal });
    });

    const rangeLetter = this.container.querySelector<HTMLInputElement>('[data-ref="range-letter-spacing"]');
    const numLetter = this.container.querySelector<HTMLElement>('[data-ref="num-letter-spacing"]');
    rangeLetter?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        const val = parseFloat(rangeLetter.value) || 0;
        if (numLetter) numLetter.textContent = val.toString();
        el.letterSpacing = val;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) elNode.style.letterSpacing = `${val}px`;
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });
    rangeLetter?.addEventListener('change', () => {
      this.recordHistory();
    }, { signal });

    const rangeLine = this.container.querySelector<HTMLInputElement>('[data-ref="range-line-height"]');
    const numLine = this.container.querySelector<HTMLElement>('[data-ref="num-line-height"]');
    rangeLine?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        const raw = parseFloat(rangeLine.value) || 14;
        const val = parseFloat((raw / 10).toFixed(1));
        if (numLine) numLine.textContent = val.toFixed(1);
        el.lineHeight = val;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) elNode.style.lineHeight = `${val}`;
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });
    rangeLine?.addEventListener('change', () => {
      this.recordHistory();
    }, { signal });

    const valignBtns = this.container.querySelectorAll<HTMLElement>('[data-ref="valign-row"] [data-valign]');
    valignBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((e) => e.id === this.selectedElementId);
        if (el && el.type === 'text') {
          const v = (btn.dataset.valign as 'bottom' | 'middle' | 'top') || 'top';
          el.verticalAlign = v;
          const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
          if (elNode) {
            if (v === 'middle') {
              elNode.style.display = 'flex';
              elNode.style.alignItems = 'center';
            } else if (v === 'bottom') {
              elNode.style.display = 'flex';
              elNode.style.alignItems = 'flex-end';
            } else {
              elNode.style.display = 'block';
              elNode.style.alignItems = 'unset';
            }
          }
          this.updateContextToolbar();
          this.setModified(true);
          this.broadcastElementUpdate(el);
          this.recordHistory();
        }
      }, { signal });
    });

    const btnTextMoreOptions = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-text-more-options"]');
    btnTextMoreOptions?.addEventListener('click', () => {
      showToast('Opciones de configuración avanzada de texto', 'info');
    }, { signal });

    const rangeTextOp = this.container.querySelector<HTMLInputElement>('[data-ref="range-text-opacity"]');
    const numTextOp = this.container.querySelector<HTMLElement>('[data-ref="num-text-opacity"]');
    rangeTextOp?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'text') {
        const pct = parseInt(rangeTextOp.value, 10);
        if (numTextOp) numTextOp.textContent = pct.toString();
        el.opacity = pct / 100;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) elNode.style.opacity = `${el.opacity}`;
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });
    rangeTextOp?.addEventListener('change', () => {
      this.recordHistory();
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

    const shapeStrokeStyles = this.container.querySelectorAll<HTMLElement>('[data-ref="shape-stroke-styles-row"] [data-style]');
    shapeStrokeStyles.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((e) => e.id === this.selectedElementId);
        if (el && el.type === 'shape') {
          const style = (btn.dataset.style as 'dashed' | 'dotted' | 'long-dash' | 'none' | 'solid') || 'none';
          el.strokeStyle = style;
          if (style === 'none') {
            el.strokeWidth = 0;
          } else if ((el.strokeWidth || 0) === 0) {
            el.strokeWidth = 2;
          }
          if (!el.strokeColor || el.strokeColor === 'transparent') {
            el.strokeColor = '#000000';
          }
          const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
          const svgNode = elNode?.querySelector<SVGElement>('svg');
          if (svgNode) svgNode.innerHTML = this.renderShapeInner(el);
          this.updateContextToolbar();
          this.setModified(true);
          this.broadcastElementUpdate(el);
          this.recordHistory();
        }
      }, { signal });
    });

    const rangeShapeStroke = this.container.querySelector<HTMLInputElement>('[data-ref="range-shape-stroke-width"]');
    const numShapeStroke = this.container.querySelector<HTMLElement>('[data-ref="num-shape-stroke-width"]');
    rangeShapeStroke?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        const val = parseInt(rangeShapeStroke.value, 10);
        if (numShapeStroke) numShapeStroke.textContent = val.toString();
        el.strokeWidth = val;
        if (val > 0 && (!el.strokeStyle || el.strokeStyle === 'none')) {
          el.strokeStyle = 'solid';
        }
        if (!el.strokeColor || el.strokeColor === 'transparent') {
          el.strokeColor = '#000000';
        }
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        const svgNode = elNode?.querySelector<SVGElement>('svg');
        if (svgNode) svgNode.innerHTML = this.renderShapeInner(el);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });
    rangeShapeStroke?.addEventListener('change', () => {
      this.updateContextToolbar();
      this.recordHistory();
    }, { signal });

    const rangeShapeCorner = this.container.querySelector<HTMLInputElement>('[data-ref="range-shape-corner-radius"]');
    const numShapeCorner = this.container.querySelector<HTMLElement>('[data-ref="num-shape-corner-radius"]');
    rangeShapeCorner?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        const val = parseInt(rangeShapeCorner.value, 10);
        if (numShapeCorner) numShapeCorner.textContent = val.toString();
        el.borderRadius = val;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        const svgNode = elNode?.querySelector<SVGElement>('svg');
        if (svgNode) svgNode.innerHTML = this.renderShapeInner(el);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });
    rangeShapeCorner?.addEventListener('change', () => {
      this.recordHistory();
    }, { signal });

    const rangeShapeSides = this.container.querySelector<HTMLInputElement>('[data-ref="range-shape-sides"]');
    const numShapeSides = this.container.querySelector<HTMLElement>('[data-ref="num-shape-sides"]');
    rangeShapeSides?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        const val = parseInt(rangeShapeSides.value, 10);
        if (numShapeSides) numShapeSides.textContent = val.toString();
        el.sides = val;
        if (val === 3) el.shapeType = 'triangle';
        else if (val === 4) el.shapeType = 'rect';
        else if (val === 5) el.shapeType = 'pentagon';
        else if (val === 6) el.shapeType = 'hexagon';
        else if (val === 7) el.shapeType = 'heptagon';
        else if (val === 8) el.shapeType = 'octagon';
        else if (val === 10) el.shapeType = 'decagon';
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        const svgNode = elNode?.querySelector<SVGElement>('svg');
        if (svgNode) svgNode.innerHTML = this.renderShapeInner(el);
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });
    rangeShapeSides?.addEventListener('change', () => {
      this.recordHistory();
    }, { signal });

    const rangeShapeOp = this.container.querySelector<HTMLInputElement>('[data-ref="range-shape-opacity"]');
    const numShapeOp = this.container.querySelector<HTMLElement>('[data-ref="num-shape-opacity"]');
    rangeShapeOp?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        const pct = parseInt(rangeShapeOp.value, 10);
        if (numShapeOp) numShapeOp.textContent = pct.toString();
        el.opacity = pct / 100;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) elNode.style.opacity = `${el.opacity}`;
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });
    rangeShapeOp?.addEventListener('change', () => {
      this.recordHistory();
    }, { signal });

    const btnShapeFlipH = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-shape-flip-h"]');
    btnShapeFlipH?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        el.flipHorizontal = !el.flipHorizontal;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          const sx = el.flipHorizontal ? -1 : 1;
          const sy = el.flipVertical ? -1 : 1;
          elNode.style.transform = `rotate(${el.rotation || 0}deg) scale(${sx}, ${sy})`;
        }
        this.setModified(true);
        this.broadcastElementUpdate(el);
        this.recordHistory();
      }
    }, { signal });

    const btnShapeFlipV = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-shape-flip-v"]');
    btnShapeFlipV?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        el.flipVertical = !el.flipVertical;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          const sx = el.flipHorizontal ? -1 : 1;
          const sy = el.flipVertical ? -1 : 1;
          elNode.style.transform = `rotate(${el.rotation || 0}deg) scale(${sx}, ${sy})`;
        }
        this.setModified(true);
        this.broadcastElementUpdate(el);
        this.recordHistory();
      }
    }, { signal });

    const btnImageRemoveBg = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-image-remove-bg"]');
    btnImageRemoveBg?.addEventListener('click', async () => {
      if (!currentUser) {
        showToast('Inicia sesión para eliminar fondos con IA', 'warning');
        this.openLocalAuthModal();
        return;
      }
      if (!hasSubscriptionFeature('pro')) {
        showToast('La eliminación de fondos con IA es exclusiva para planes Pro o superiores', 'warning');
        navigate('/precios');
        return;
      }
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (!el || el.type !== 'image' || !el.url) {
        showToast('Selecciona una imagen válida', 'warning');
        return;
      }

      await withButtonLoading(btnImageRemoveBg, async () => {
        try {
          const res = await postApi(API_ROUTES.collaborativeDocs.removeBackground, { imageUrl: el.url });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.success) {
            showToast(data?.error || 'No se pudo eliminar el fondo de la imagen', 'error');
            return;
          }
          el.url = data.url;
          const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
          const imgNode = elNode?.querySelector<HTMLImageElement>('.collaborative-image-inner');
          if (imgNode) {
            imgNode.src = data.url;
          }
          this.setModified(true);
          this.broadcastElementUpdate(el);
          this.recordHistory();
          this.loadUploadedAssets();
          const balanceMsg = data.newBalance !== undefined ? ` (Saldo: ${data.newBalance} tokens)` : '';
          showToast(`Fondo eliminado exitosamente con IA${balanceMsg}`, 'success');
        } catch {
          showToast('Error de conexión al eliminar el fondo', 'error');
        }
      });
    }, { signal });

    const btnImageCrop = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-image-crop"]');
    btnImageCrop?.addEventListener('click', () => {
      showToast('Herramienta de recorte próximamente disponible', 'info');
    }, { signal });

    const imgStrokeStyles = this.container.querySelectorAll<HTMLElement>('[data-ref="image-stroke-styles-row"] [data-style]');
    imgStrokeStyles.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((e) => e.id === this.selectedElementId);
        if (el && el.type === 'image') {
          const style = (btn.dataset.style as 'dashed' | 'dotted' | 'long-dash' | 'none' | 'solid') || 'none';
          el.borderStyle = style;
          if (style === 'none') {
            el.borderWidth = 0;
          } else if ((el.borderWidth || 0) === 0) {
            el.borderWidth = 2;
          }
          if (!el.borderColor) el.borderColor = '#000000';
          const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
          if (elNode) {
            if (el.borderWidth && el.borderStyle && el.borderStyle !== 'none') {
              const bs = el.borderStyle === 'long-dash' ? 'dashed' : el.borderStyle;
              elNode.style.border = `${el.borderWidth}px ${bs} ${el.borderColor || '#000000'}`;
              elNode.style.boxSizing = 'border-box';
            } else {
              elNode.style.border = 'none';
            }
          }
          this.updateContextToolbar();
          this.setModified(true);
          this.broadcastElementUpdate(el);
          this.recordHistory();
        }
      }, { signal });
    });

    const rangeImgStroke = this.container.querySelector<HTMLInputElement>('[data-ref="range-image-stroke-width"]');
    const numImgStroke = this.container.querySelector<HTMLElement>('[data-ref="num-image-stroke-width"]');
    rangeImgStroke?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'image') {
        const val = parseInt(rangeImgStroke.value, 10);
        if (numImgStroke) numImgStroke.textContent = val.toString();
        el.borderWidth = val;
        if (val > 0 && (!el.borderStyle || el.borderStyle === 'none')) {
          el.borderStyle = 'solid';
        }
        if (!el.borderColor) el.borderColor = '#000000';
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          if (val > 0) {
            const bs = el.borderStyle === 'long-dash' ? 'dashed' : (el.borderStyle || 'solid');
            elNode.style.border = `${val}px ${bs} ${el.borderColor || '#000000'}`;
            elNode.style.boxSizing = 'border-box';
          } else {
            elNode.style.border = 'none';
          }
        }
        this.updateTransformBoxPosition();
        if (this.showRulersAndGuides) {
          this.updateRulers();
        }
        if (this.isLayersPanelOpen) {
          this.renderLayersList();
        }
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });
    rangeImgStroke?.addEventListener('change', () => {
      this.updateContextToolbar();
      this.recordHistory();
    }, { signal });

    const rangeImgCorner = this.container.querySelector<HTMLInputElement>('[data-ref="range-image-corner-radius"]');
    const numImgCorner = this.container.querySelector<HTMLElement>('[data-ref="num-image-corner-radius"]');
    rangeImgCorner?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'image') {
        const val = parseInt(rangeImgCorner.value, 10);
        if (numImgCorner) numImgCorner.textContent = val.toString();
        el.borderRadius = val;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          elNode.style.borderRadius = `${val}px`;
          elNode.style.overflow = val > 0 ? 'hidden' : '';
          const img = elNode.querySelector<HTMLImageElement>('img');
          if (img) img.style.borderRadius = `${val}px`;
        }
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });
    rangeImgCorner?.addEventListener('change', () => {
      this.recordHistory();
    }, { signal });

    const rangeImgOp = this.container.querySelector<HTMLInputElement>('[data-ref="range-image-opacity"]');
    const numImgOp = this.container.querySelector<HTMLElement>('[data-ref="num-image-opacity"]');
    rangeImgOp?.addEventListener('input', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'image') {
        const pct = parseInt(rangeImgOp.value, 10);
        if (numImgOp) numImgOp.textContent = pct.toString();
        el.opacity = pct / 100;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) elNode.style.opacity = `${el.opacity}`;
        this.setModified(true);
        this.broadcastElementUpdate(el);
      }
    }, { signal });
    rangeImgOp?.addEventListener('change', () => {
      this.recordHistory();
    }, { signal });

    const btnImageFlipH = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-image-flip-h"]');
    btnImageFlipH?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'image') {
        el.flipHorizontal = !el.flipHorizontal;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          const sx = el.flipHorizontal ? -1 : 1;
          const sy = el.flipVertical ? -1 : 1;
          elNode.style.transform = `rotate(${el.rotation || 0}deg) scale(${sx}, ${sy})`;
        }
        this.setModified(true);
        this.broadcastElementUpdate(el);
        this.recordHistory();
      }
    }, { signal });

    const btnImageFlipV = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-image-flip-v"]');
    btnImageFlipV?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'image') {
        el.flipVertical = !el.flipVertical;
        const elNode = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (elNode) {
          const sx = el.flipHorizontal ? -1 : 1;
          const sy = el.flipVertical ? -1 : 1;
          elNode.style.transform = `rotate(${el.rotation || 0}deg) scale(${sx}, ${sy})`;
        }
        this.setModified(true);
        this.broadcastElementUpdate(el);
        this.recordHistory();
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

    const btnChartEditData = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-chart-edit-data"]');
    btnChartEditData?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'chart') {
        this.openChartInspector(el, 'data');
      }
    }, { signal });

    const btnChartEditStyle = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-chart-edit-style"]');
    btnChartEditStyle?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'chart') {
        this.openChartInspector(el, 'customize');
      }
    }, { signal });

    const btnChartPalette = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-chart-palette"]');
    btnChartPalette?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (el && el.type === 'chart') {
        const schemes: Array<ElementChartOptions['colorScheme']> = ['blue', 'purple', 'coral', 'amber', 'emerald', 'gray'];
        const currentIdx = schemes.indexOf(el.options.colorScheme || 'blue');
        el.options.colorScheme = schemes[(currentIdx + 1) % schemes.length];
        this.applyChartPalette(el);
        this.syncChartInspector(el);
        const node = this.container.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
        if (node) node.innerHTML = this.renderChartSvg(el);
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

    const btnModeEdit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-edit-mode-edit"]');
    btnModeEdit?.addEventListener('click', () => {
      this.setEditorMode('edit');
      this.editDropdownCtrl?.close();
    }, { signal });

    const btnModeView = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-edit-mode-view"]');
    btnModeView?.addEventListener('click', () => {
      this.setEditorMode('view');
      this.editDropdownCtrl?.close();
    }, { signal });

    const btnContextCopy = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-context-copy"]');
    btnContextCopy?.addEventListener('click', () => {
      this.copySelectedElements();
    }, { signal });

    const btnContextDup = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-context-duplicate"]');
    btnContextDup?.addEventListener('click', () => this.duplicateSelected(), { signal });

    const btnContextDel = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-context-delete"]');
    btnContextDel?.addEventListener('click', () => this.deleteSelectedElement(), { signal });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeContextMenu();
      }

      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isEditing = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.shiftKey && (e.key === 'R' || e.key === 'r') && !isEditing) {
        e.preventDefault();
        this.toggleRulersAndGuides();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        this.openFindReplace();
        return;
      }

      if (this.editorMode === 'view') {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y' || e.key === 'v' || e.key === 'x')) {
          e.preventDefault();
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (!isEditing) {
          const key = e.key.toLowerCase();
          if (key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
            return;
          }
          if (key === 'y' || (key === 'z' && e.shiftKey)) {
            e.preventDefault();
            this.redo();
            return;
          }
          if (key === 'c') {
            const hasSelection = this.selectedElementId || this.selectedElementIds.size > 0;
            if (hasSelection) {
              e.preventDefault();
              this.copySelectedElements();
              return;
            }
          }
          if (key === 'x') {
            const hasSelection = this.selectedElementId || this.selectedElementIds.size > 0;
            if (hasSelection) {
              e.preventDefault();
              this.copySelectedElements();
              this.deleteSelectedElement();
              return;
            }
          }
          if (key === 'v') {
            e.preventDefault();
            void this.pasteFromClipboard();
            return;
          }
          if (key === 'd') {
            e.preventDefault();
            this.duplicateSelected();
            return;
          }
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeTag === 'input' || (document.activeElement as HTMLElement)?.isContentEditable) return;
        if (this.selectedElementId || this.selectedPageIndex !== null) {
          e.preventDefault();
          this.deleteSelectedElement();
        }
      }
    }, { signal });

    window.addEventListener('paste', (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isEditing = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;
      if (isEditing) return;

      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain');
      const files = e.clipboardData?.files;
      void this.pasteFromClipboard(text, files);
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
      const pct = Math.max(0, Math.min(100, ((val - 10) / (300 - 10)) * 100));
      sliderZoom.style.setProperty('--slider-pct', `${pct}%`);
      const zoomTrack = this.container.querySelector<HTMLElement>('[data-ref="zoom-track"]');
      if (zoomTrack) {
        zoomTrack.style.setProperty('--slider-pct', `${pct}%`);
      }
      this.setZoom(val / 100);
    }, { signal });

    const btnZoomReset = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-reset"]');
    btnZoomReset?.addEventListener('click', () => this.setZoom(1.0), { signal });

    const btnFooterPages = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-footer-pages"]');
    btnFooterPages?.addEventListener('click', () => this.togglePagesCarousel(), { signal });

    const btnFooterGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-footer-grid"]');
    btnFooterGrid?.addEventListener('click', () => this.toggleGridView(), { signal });

    workspace?.addEventListener('wheel', (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        this.setZoom(this.zoomLevel + delta);
      }
    }, { passive: false, signal });

    const workspaceCtx = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
    workspaceCtx?.addEventListener('contextmenu', (e: MouseEvent) => {
      this.handleContextMenu(e);
    }, { signal });

    window.addEventListener('pointerdown', (e: PointerEvent) => {
      const contextMenu = this.container.querySelector<HTMLElement>('[data-ref="collab-context-menu"]');
      if (contextMenu && !contextMenu.classList.contains('is-hidden')) {
        if (!contextMenu.contains(e.target as Node)) {
          this.closeContextMenu();
        }
      }
    }, { signal });

    const btnCtxElemCopy = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-elem-copy"]');
    btnCtxElemCopy?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.selectElement(this.contextMenuTargetElementId);
        this.copySelectedElements();
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxElemPaste = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-elem-paste"]');
    btnCtxElemPaste?.addEventListener('click', () => {
      void this.pasteFromClipboard();
      this.closeContextMenu();
    }, { signal });

    const btnCtxElemDup = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-elem-duplicate"]');
    btnCtxElemDup?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.selectElement(this.contextMenuTargetElementId);
        this.duplicateSelected();
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxElemDel = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-elem-delete"]');
    btnCtxElemDel?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.selectElement(this.contextMenuTargetElementId);
        this.deleteSelectedElement();
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxLayerFront = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-layer-front"]');
    btnCtxLayerFront?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.moveElementLayer(this.contextMenuTargetElementId, 'front');
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxLayerForward = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-layer-forward"]');
    btnCtxLayerForward?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.moveElementLayer(this.contextMenuTargetElementId, 'forward');
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxLayerBackward = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-layer-backward"]');
    btnCtxLayerBackward?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.moveElementLayer(this.contextMenuTargetElementId, 'backward');
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxLayerBack = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-layer-back"]');
    btnCtxLayerBack?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.moveElementLayer(this.contextMenuTargetElementId, 'back');
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxLayerShowPanel = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-layer-show-panel"]');
    btnCtxLayerShowPanel?.addEventListener('click', () => {
      this.closeContextMenu();
      this.openLayersPanel();
    }, { signal });

    const btnCtxAlignTop = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-align-top"]');
    btnCtxAlignTop?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.alignElementToPage(this.contextMenuTargetElementId, 'top');
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxAlignMiddle = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-align-middle"]');
    btnCtxAlignMiddle?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.alignElementToPage(this.contextMenuTargetElementId, 'middle');
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxAlignBottom = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-align-bottom"]');
    btnCtxAlignBottom?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.alignElementToPage(this.contextMenuTargetElementId, 'bottom');
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxAlignLeft = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-align-left"]');
    btnCtxAlignLeft?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.alignElementToPage(this.contextMenuTargetElementId, 'left');
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxAlignCenter = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-align-center"]');
    btnCtxAlignCenter?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.alignElementToPage(this.contextMenuTargetElementId, 'center');
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxAlignRight = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-align-right"]');
    btnCtxAlignRight?.addEventListener('click', () => {
      if (this.contextMenuTargetElementId) {
        this.alignElementToPage(this.contextMenuTargetElementId, 'right');
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxPageCopy = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-page-copy"]');
    btnCtxPageCopy?.addEventListener('click', () => {
      if (this.contextMenuTargetPage !== null) {
        this.selectPage(this.contextMenuTargetPage);
        const pageElements = this.elements.filter((el) => (el.pageIndex ?? 0) === this.contextMenuTargetPage);
        if (pageElements.length > 0) {
          const payload = {
            __boardpdf_collab_elements__: true,
            elements: JSON.parse(JSON.stringify(pageElements)),
            sourceDocId: this.docId,
            sourcePageIndex: this.contextMenuTargetPage,
            timestamp: Date.now(),
          };
          const payloadJson = JSON.stringify(payload);
          try {
            localStorage.setItem('boardpdf_collab_clipboard', payloadJson);
          } catch {}
          if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(payloadJson).catch(() => {});
          }
          showToast(`Página ${this.contextMenuTargetPage + 1} (${pageElements.length} elementos) copiada`, 'info');
        } else {
          showToast(`Página ${this.contextMenuTargetPage + 1} copiada`, 'info');
        }
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxPagePaste = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-page-paste"]');
    btnCtxPagePaste?.addEventListener('click', () => {
      void this.pasteFromClipboard();
      this.closeContextMenu();
    }, { signal });

    const btnCtxPageDup = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-page-dup"]');
    btnCtxPageDup?.addEventListener('click', () => {
      if (this.contextMenuTargetPage !== null) {
        this.duplicatePage(this.contextMenuTargetPage);
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxPageAdd = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-page-add"]');
    btnCtxPageAdd?.addEventListener('click', () => {
      if (this.contextMenuTargetPage !== null) {
        this.addPage(this.contextMenuTargetPage);
      } else {
        this.addPage();
      }
      this.closeContextMenu();
    }, { signal });

    const btnCtxPageLock = this.container.querySelector<HTMLButtonElement>('[data-ref="ctx-page-lock"]');
    btnCtxPageLock?.addEventListener('click', () => {
      if (this.contextMenuTargetPage !== null) {
        this.togglePageLock(this.contextMenuTargetPage);
      }
      this.closeContextMenu();
    }, { signal });

    const btnLayersClose = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layers-close"]');
    btnLayersClose?.addEventListener('click', () => {
      this.closeLayersPanel();
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
      const zoomTrack = this.container.querySelector<HTMLElement>('[data-ref="zoom-track"]');
      if (zoomTrack) {
        zoomTrack.style.setProperty('--slider-pct', `${pct}%`);
      }
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
    if (this.showRulersAndGuides) {
      this.updateRulers();
    }
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
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
          void this.handleApplySinglePdfPage(asset, i);
        });

        pagesGrid.appendChild(pageCard);

        void renderPdfThumbnail(asset.url, canvas, {
          pageNum: i,
          targetWidth: 120,
        });
      }

      void checkPdfPagesEditableStatus(asset.url).then((statuses) => {
        statuses.forEach((isEditable, idx) => {
          const card = pagesGrid.querySelector<HTMLElement>(`[data-ref="pdf-thumb-card-${idx + 1}"]`);
          if (!card) return;
          const badge = document.createElement('span');
          badge.className = `collaborative-pdf-page-card__badge ${isEditable ? 'is-editable' : 'is-scanned'}`;
          badge.setAttribute('data-ref', `pdf-page-badge-${idx + 1}`);
          badge.textContent = isEditable ? 'Editable' : 'Escaneado';
          card.appendChild(badge);
        });
      });
    }
  }

  private async handleApplyAllPdfPages(customAsset?: UploadedAsset): Promise<void> {
    const asset = customAsset || this.selectedPdfAsset;
    if (!asset) return;
    this.selectedPdfAsset = asset;
    if (customAsset && asset.name) {
      const inferredTitle = asset.name.replace(/\.[^/.]+$/, '');
      this.docTitle = inferredTitle;
      const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
      if (titleInput) titleInput.value = inferredTitle;
    }
    const count = Math.max(1, asset.pageCount || 1);
    const btnApplyAll = this.queryPanel<HTMLButtonElement>('[data-ref="btn-apply-all-pages"]');

    await withButtonLoading(btnApplyAll || document.createElement('button'), async () => {
      try {
        const editableStatuses = await checkPdfPagesEditableStatus(asset.url);
        let editableCount = 0;

        this.pageCount = count;
        this.pagePdfSources = Array(count).fill(null);
        this.pageTitles = Array(count).fill('').map((_, idx) => `Página ${idx + 1}`);
        this.pageBackgrounds = Array(count).fill('#ffffff');
        this.pageSizes = [];
        this.elements = [];

        for (let i = 0; i < count; i++) {
          const pageNum = i + 1;
          const isEditable = editableStatuses[i];

          if (isEditable) {
            editableCount++;
            const extracted = await extractEditablePdfPage(asset.url, pageNum, i);
            this.pageSizes.push(extracted.pageSize);
            for (const el of extracted.elements) {
              this.elements.push(el);
            }
            this.pagePdfSources[i] = null;
          } else {
            this.pagePdfSources[i] = {
              pageNumber: pageNum,
              pdfUrl: asset.url,
            };
            this.pageSizes.push({ ...this.docDefaultPageSize });
          }
        }

        if (this.pageSizes.length > 0 && this.pageSizes[0]) {
          this.docDefaultPageSize = { ...this.pageSizes[0] };
        }

        this.selectedPageIndex = 0;
        this.activePageIndex = 0;
        this.renderPages();
        this.setModified(true);
        this.recordHistory();
        this.broadcastDocSync();
        void this.flushAutoSave();

        if (editableCount === count) {
          showToast(`Se han importado las ${count} páginas como contenido editable`, 'success');
        } else if (editableCount > 0) {
          showToast(`Se importaron ${editableCount} páginas editables y ${count - editableCount} como imagen de fondo`, 'success');
        } else {
          showToast(`Se han aplicado las ${count} páginas como imagen de fondo (documento escaneado)`, 'info');
        }
      } catch {
        showToast('Error al importar las páginas del PDF.', 'error');
      }
    });
  }

  private async handleApplySinglePdfPage(asset: UploadedAsset, pageNum: number): Promise<void> {
    const targetIdx = this.selectedPageIndex !== null ? this.selectedPageIndex : this.activePageIndex;
    while (this.pagePdfSources.length <= targetIdx) {
      this.pagePdfSources.push(null);
    }
    while (this.pageSizes.length <= targetIdx) {
      this.pageSizes.push({ ...this.docDefaultPageSize });
    }

    try {
      const extracted = await extractEditablePdfPage(asset.url, pageNum, targetIdx);
      if (extracted.hasEditableContent && extracted.elements.length > 0) {
        const prevElements = this.elements.filter((el) => (el.pageIndex ?? 0) === targetIdx);
        this.elements = this.elements.filter((el) => (el.pageIndex ?? 0) !== targetIdx);
        for (const prev of prevElements) {
          if (!this.isCollabRoomFull) {
            wsService.send({
              action: 'delete',
              element: { id: prev.id },
              pageIndex: targetIdx,
              type: 'elementChange',
            });
          }
        }
        this.pageSizes[targetIdx] = extracted.pageSize;
        this.pagePdfSources[targetIdx] = null;
        for (const el of extracted.elements) {
          this.elements.push(el);
          if (!this.isCollabRoomFull) {
            wsService.send({
              action: 'add',
              element: el,
              pageIndex: targetIdx,
              type: 'elementChange',
            });
          }
        }
        this.renderPages();
        this.setModified(true);
        this.recordHistory();
        this.broadcastDocSync();
        void this.flushAutoSave();
        showToast(`Página ${pageNum} importada como contenido editable en página ${targetIdx + 1}`, 'success');
      } else {
        this.pagePdfSources[targetIdx] = {
          pageNumber: pageNum,
          pdfUrl: asset.url,
        };
        this.renderPages();
        this.setModified(true);
        this.recordHistory();
        this.broadcastDocSync();
        void this.flushAutoSave();
        showToast(`Página ${pageNum} aplicada como imagen de fondo (documento escaneado)`, 'info');
      }
    } catch {
      showToast('Error al procesar la página del PDF.', 'error');
    }
  }

  private pushElement(el: EditorElement, broadcast = true): void {
    this.elements.push(el);
    this.setModified(true);
    this.recordHistory();
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

  private addPeerPresenceBubble(peer: RemotePeer): void {
    addPeerPresenceBubble(this.container, peer);
  }

  private removePeerPresenceBubble(clientId: string): void {
    removePeerPresenceBubble(this.container, clientId);
  }

  private renderPresenceList(): void {
    if (!currentUser && !this.guestIdentity) {
      this.guestIdentity = getOrCreateGuestIdentity();
    }
    renderPresenceList(this.container, this.remotePeers, this.myColor, this.isCollabRoomFull, this.guestIdentity);
  }

  private renderRemoteCursor(msg: any): void {
    renderRemoteCursor(this.container, this.remoteCursorElements, this.remoteCursorTimers, this.remotePeers, msg);
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

  private openShareModal(openInDownloadView: boolean = false): void {
    if (this.isLocalOnly) {
      this.openLocalAuthModal();
      return;
    }

    if (this.sharePopoverElement) {
      if (openInDownloadView) {
        const viewMain = this.sharePopoverElement.querySelector<HTMLElement>('[data-ref="collab-share-view-main"]');
        const viewDownload = this.sharePopoverElement.querySelector<HTMLElement>('[data-ref="collab-share-view-download"]');
        if (viewMain && viewDownload) {
          viewMain.classList.add('is-hidden');
          viewDownload.classList.remove('is-hidden');
        }
        return;
      }
      this.closeSharePopover();
      return;
    }

    const handle = createCollabSharePopover({
      activePageIndex: this.activePageIndex,
      docAccessLevel: this.docAccessLevel,
      docId: this.docId,
      docMembers: this.docMembers,
      docTitle: this.docTitle,
      isDocOwner: this.isDocOwner,
      onAccessLevelChange: (level) => {
        this.docAccessLevel = level;
      },
      onClose: () => {
        this.closeSharePopover();
      },
      onMembersChange: (members) => {
        this.docMembers = members;
      },
      openInDownloadView,
      pageCount: this.pageCount,
      selectedPageIndex: this.selectedPageIndex,
    });

    this.sharePopoverElement = handle.element;
    this.cleanupSharePopover = () => {
      handle.cleanup();
      this.sharePopoverElement = null;
      this.cleanupSharePopover = null;
    };
  }

  private openLocalAuthModal(): void {
    if (this.shareModalElement) {
      this.shareModalElement.remove();
      this.shareModalElement = null;
    }

    const storeCurrentAsPending = () => {
      const draft = saveLocalDraft(this.docId, {
        content: {
          elements: this.elements,
          pageBackgrounds: this.pageBackgrounds,
          pageCount: this.pageCount,
          pagePdfSources: this.pagePdfSources,
          pageSize: { height: PAGE_HEIGHT, width: PAGE_WIDTH },
          pageTitles: this.pageTitles,
        },
        title: this.docTitle,
        userId: currentUser?.id ?? null,
      });
      setPendingCloudSyncDraft(draft);
    };

    this.shareModalElement = openLocalAuthModal(
      this.docId,
      storeCurrentAsPending,
      () => {
        this.shareModalElement = null;
      }
    );
  }

  private async createDocumentCopy(): Promise<void> {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc_${Date.now().toString(36)}`;
    const copyTitle = `${this.docTitle} (Copia)`;
    const content = this.getContentPayload();

    if (this.isLocalOnly || !currentUser) {
      saveLocalDraft(newId, {
        content,
        title: copyTitle,
        userId: currentUser?.id ?? null,
      });
      window.open(`/d/${newId}`, '_blank');
      showToast('Copia creada en una nueva pestaña', 'success');
    } else {
      try {
        const res = await postApi(API_ROUTES.collaborativeDocs.base, {
          content,
          id: newId,
          title: copyTitle,
        });
        if (res.ok) {
          window.open(`/d/${newId}`, '_blank');
          showToast('Copia creada en una nueva pestaña', 'success');
        } else {
          saveLocalDraft(newId, { content, title: copyTitle, userId: currentUser?.id ?? null });
          window.open(`/d/${newId}`, '_blank');
          showToast('Copia creada en una nueva pestaña', 'success');
        }
      } catch {
        saveLocalDraft(newId, { content, title: copyTitle, userId: currentUser?.id ?? null });
        window.open(`/d/${newId}`, '_blank');
        showToast('Copia creada en una nueva pestaña', 'success');
      }
    }
  }

  private downloadPdf(): void {
    this.openShareModal(true);
  }

  private toggleRulersAndGuides(): void {
    this.showRulersAndGuides = !this.showRulersAndGuides;
    this.updateRulersUI();
    this.renderPages();
  }

  private updateRulersUI(): void {
    const rulersWrapper = this.container.querySelector<HTMLElement>('[data-ref="collab-rulers-wrapper"]');
    const checkRulers = this.container.querySelector<HTMLElement>('[data-ref="check-sub-rulers"]');
    if (this.showRulersAndGuides) {
      rulersWrapper?.classList.remove('is-hidden');
      checkRulers?.classList.remove('is-hidden');
      this.updateRulers();
    } else {
      rulersWrapper?.classList.add('is-hidden');
      checkRulers?.classList.add('is-hidden');
    }
  }

  private updateRulers(): void {
    updateRulers(this.container, this.showRulersAndGuides, this.zoomLevel);
  }

  private toggleMargins(): void {
    this.showMargins = !this.showMargins;
    const checkMargins = this.container.querySelector<HTMLElement>('[data-ref="check-sub-margins"]');
    if (this.showMargins) {
      checkMargins?.classList.remove('is-hidden');
    } else {
      checkMargins?.classList.add('is-hidden');
    }
    this.renderPages();
  }

  private toggleBleed(): void {
    this.showBleed = !this.showBleed;
    const checkBleed = this.container.querySelector<HTMLElement>('[data-ref="check-sub-bleed"]');
    if (this.showBleed) {
      checkBleed?.classList.remove('is-hidden');
    } else {
      checkBleed?.classList.add('is-hidden');
    }
    this.renderPages();
  }

  private openGuidesModal(): void {
    const modal = this.container.querySelector<HTMLElement>('[data-ref="collab-guides-modal"]');
    modal?.classList.remove('is-hidden');
    if (!this.currentGuidesPreset) {
      this.currentGuidesPreset = '12-col';
    }
    const presetCards = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="card-guide-"]');
    presetCards.forEach((c) => {
      if (c.getAttribute('data-preset') === this.currentGuidesPreset) {
        c.classList.add('is-active');
      } else {
        c.classList.remove('is-active');
      }
    });
    if (!this.showRulersAndGuides) {
      this.showRulersAndGuides = true;
      this.updateRulersUI();
    }
    this.renderPages();
  }

  private renderPersistentGuidesSvg(pageIndex: number, width: number, height: number): SVGElement {
    return renderPersistentGuidesSvg(pageIndex, width, height, this.currentGuidesPreset, this.customGuideCols, this.customGuideRows);
  }

  private openFindReplace(): void {
    const card = this.container.querySelector<HTMLElement>('[data-ref="collab-find-replace-card"]');
    card?.classList.remove('is-hidden');
    const inputSearch = this.container.querySelector<HTMLInputElement>('[data-ref="input-find-search"]');
    inputSearch?.focus();
    inputSearch?.select();
    this.executeSearch();
  }

  private closeFindReplace(): void {
    const card = this.container.querySelector<HTMLElement>('[data-ref="collab-find-replace-card"]');
    card?.classList.add('is-hidden');
    this.findMatches = [];
    this.findCurrentIndex = -1;
  }

  private executeSearch(): void {
    const query = this.findSearchTerm;
    const statusEl = this.container.querySelector<HTMLElement>('[data-ref="txt-find-status"]');
    if (!query) {
      this.findMatches = [];
      this.findCurrentIndex = -1;
      if (statusEl) {
        statusEl.classList.add('is-hidden');
        statusEl.textContent = '';
      }
      return;
    }

    const matches = findSearchMatches(this.elements, query, this.findMatchCase);
    this.findMatches = matches;
    if (matches.length > 0) {
      if (this.findCurrentIndex < 0 || this.findCurrentIndex >= matches.length) {
        this.findCurrentIndex = 0;
      }
      this.highlightCurrentMatch();
    } else {
      this.findCurrentIndex = -1;
      if (statusEl) {
        statusEl.classList.remove('is-hidden');
        statusEl.textContent = 'Sin resultados';
      }
    }
  }

  private highlightCurrentMatch(): void {
    if (this.findCurrentIndex < 0 || this.findCurrentIndex >= this.findMatches.length) return;
    const match = this.findMatches[this.findCurrentIndex];
    const statusEl = this.container.querySelector<HTMLElement>('[data-ref="txt-find-status"]');
    if (statusEl) {
      statusEl.classList.remove('is-hidden');
      statusEl.textContent = `${this.findCurrentIndex + 1} de ${this.findMatches.length}`;
    }

    if (this.editorMode !== 'view') {
      this.selectElement(match.elementId);
    }

    const sheet = this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-${match.pageIndex}"]`);
    sheet?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private findNext(): void {
    if (this.findMatches.length === 0) return;
    this.findCurrentIndex = (this.findCurrentIndex + 1) % this.findMatches.length;
    this.highlightCurrentMatch();
  }

  private findPrev(): void {
    if (this.findMatches.length === 0) return;
    this.findCurrentIndex = (this.findCurrentIndex - 1 + this.findMatches.length) % this.findMatches.length;
    this.highlightCurrentMatch();
  }

  private replaceCurrent(): void {
    if (this.editorMode === 'view') {
      showToast('No se puede reemplazar en modo solo lectura', 'warning');
      return;
    }
    if (this.findCurrentIndex < 0 || this.findCurrentIndex >= this.findMatches.length) return;
    const match = this.findMatches[this.findCurrentIndex];

    this.recordHistory();
    const replaced = replaceCurrentMatch(this.elements, match, this.findSearchTerm, this.findReplaceTerm, this.findMatchCase);
    if (!replaced) return;

    this.renderPages();
    this.scheduleAutoSave();
    this.executeSearch();
  }

  private replaceAll(): void {
    if (this.editorMode === 'view') {
      showToast('No se puede reemplazar en modo solo lectura', 'warning');
      return;
    }
    if (this.findMatches.length === 0) return;

    this.recordHistory();
    const count = replaceAllMatches(this.elements, this.findSearchTerm, this.findReplaceTerm, this.findMatchCase);

    this.renderPages();
    this.scheduleAutoSave();
    this.executeSearch();
    showToast(`Se reemplazaron ${count} coincidencias`, 'success');
  }

  private confirmDeleteDocument(): void {
    openModal({
      cancelText: 'Cancelar',
      confirmClass: 'component-button--danger',
      confirmText: 'Eliminar',
      description: `¿Estás seguro de que deseas eliminar permanentemente "${this.docTitle}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        if (this.isLocalOnly || !currentUser) {
          removeLocalDraft(this.docId);
        } else {
          try {
            const res = await deleteApi(API_ROUTES.collaborativeDocs.byId(this.docId));
            if (!res.ok) {
              removeLocalDraft(this.docId);
            }
          } catch {
            removeLocalDraft(this.docId);
          }
        }
        showToast('Documento eliminado correctamente', 'info');
        navigate('/');
        return true;
      },
      title: 'Eliminar documento',
    });
  }

  private setEditorMode(mode: 'edit' | 'view'): void {
    this.editorMode = mode;
    const txtTopEdit = this.container.querySelector<HTMLElement>('[data-ref="txt-top-edit-current"]');
    const iconTopEdit = this.container.querySelector<SVGElement>('[data-ref="icon-top-edit-current"] use');
    const checkEdit = this.container.querySelector<HTMLElement>('[data-ref="check-mode-edit"]');
    const checkView = this.container.querySelector<HTMLElement>('[data-ref="check-mode-view"]');
    const btnModeEdit = this.container.querySelector<HTMLElement>('[data-ref="btn-menu-edit-mode-edit"]');
    const btnModeView = this.container.querySelector<HTMLElement>('[data-ref="btn-menu-edit-mode-view"]');
    const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');

    if (mode === 'view') {
      this.container.classList.add('collaborative-mode-view');
      if (txtTopEdit) txtTopEdit.textContent = 'Ver';
      iconTopEdit?.setAttribute('href', '/icons.svg#visibility');
      checkEdit?.classList.add('is-hidden');
      checkView?.classList.remove('is-hidden');
      btnModeEdit?.classList.remove('is-active');
      btnModeView?.classList.add('is-active');
      if (titleInput) titleInput.readOnly = true;
      this.selectedElementId = null;
      this.selectedElementIds.clear();
      this.closeSubtoolbars();
      this.updateSelection();
      this.renderTransformBox();
      showToast('Modo solo lectura activado', 'info');
    } else {
      this.container.classList.remove('collaborative-mode-view');
      if (txtTopEdit) txtTopEdit.textContent = 'Editar';
      iconTopEdit?.setAttribute('href', '/icons.svg#edit');
      checkEdit?.classList.remove('is-hidden');
      checkView?.classList.add('is-hidden');
      btnModeEdit?.classList.add('is-active');
      btnModeView?.classList.remove('is-active');
      if (titleInput) titleInput.readOnly = false;
      this.updateUndoRedoButtons();
      showToast('Modo de edición activado', 'info');
    }
  }

  private handleContextMenu(e: MouseEvent): void {
    if (this.editorMode === 'view') {
      return;
    }
    const target = e.target as HTMLElement | SVGElement | null;
    if (!target) return;

    const elementNode = target.closest<HTMLElement | SVGElement>('[data-element-id]');
    const pageSheet = target.closest<HTMLElement>('.collaborative-page-sheet, .collaborative-page-wrapper');

    const ctxElemSection = this.container.querySelector<HTMLElement>('[data-ref="ctx-section-element"]');
    const ctxPageSection = this.container.querySelector<HTMLElement>('[data-ref="ctx-section-page"]');
    const contextMenu = this.container.querySelector<HTMLElement>('[data-ref="collab-context-menu"]');

    if (!contextMenu || !ctxElemSection || !ctxPageSection) return;

    if (elementNode) {
      const elementId = elementNode.getAttribute('data-element-id');
      if (!elementId) return;
      e.preventDefault();
      this.contextMenuTargetElementId = elementId;
      const targetElem = this.elements.find((el) => el.id === elementId);
      this.contextMenuTargetPage = targetElem?.pageIndex ?? 0;
      this.selectElement(elementId);

      ctxElemSection.classList.remove('is-hidden');
      ctxPageSection.classList.add('is-hidden');
      this.positionContextMenu(e.clientX, e.clientY);
    } else if (pageSheet) {
      e.preventDefault();
      const pageIndexAttr = pageSheet.getAttribute('data-page-index');
      const pageIndex = pageIndexAttr !== null ? parseInt(pageIndexAttr, 10) : 0;
      this.contextMenuTargetPage = pageIndex;
      this.contextMenuTargetElementId = null;
      this.selectPage(pageIndex);

      const isLocked = this.lockedPages.has(pageIndex);
      const txtPageLock = this.container.querySelector<HTMLElement>('[data-ref="txt-ctx-page-lock"]');
      const btnPageLock = this.container.querySelector<HTMLElement>('[data-ref="ctx-page-lock"]');
      if (txtPageLock) {
        txtPageLock.textContent = isLocked ? 'Mostrar página' : 'Ocultar página';
      }
      const iconUse = btnPageLock?.querySelector('use');
      iconUse?.setAttribute('href', `/icons.svg#${isLocked ? 'visibility' : 'visibility_off'}`);

      ctxElemSection.classList.add('is-hidden');
      ctxPageSection.classList.remove('is-hidden');
      this.positionContextMenu(e.clientX, e.clientY);
    } else {
      this.closeContextMenu();
    }
  }

  private positionContextMenu(clientX: number, clientY: number): void {
    const contextMenu = this.container.querySelector<HTMLElement>('[data-ref="collab-context-menu"]');
    if (!contextMenu) return;

    contextMenu.classList.remove('is-hidden');
    contextMenu.style.left = `${clientX}px`;
    contextMenu.style.top = `${clientY}px`;

    const submenus = this.container.querySelectorAll<HTMLElement>('.collab-context-submenu');
    submenus.forEach((sub) => sub.classList.add('is-hidden'));

    requestAnimationFrame(() => {
      const rect = contextMenu.getBoundingClientRect();
      let left = clientX;
      let top = clientY;

      if (left + rect.width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - rect.width - 8);
      }
      if (top + rect.height > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - rect.height - 8);
      }

      if (left + rect.width + 210 > window.innerWidth) {
        contextMenu.classList.add('is-flip-submenus');
      } else {
        contextMenu.classList.remove('is-flip-submenus');
      }

      contextMenu.style.left = `${left}px`;
      contextMenu.style.top = `${top}px`;
    });
  }

  private closeContextMenu(): void {
    const contextMenu = this.container.querySelector<HTMLElement>('[data-ref="collab-context-menu"]');
    contextMenu?.classList.add('is-hidden');
    const submenus = this.container.querySelectorAll<HTMLElement>('.collab-context-submenu');
    submenus.forEach((sub) => sub.classList.add('is-hidden'));
  }

  private moveElementLayer(elementId: string, direction: 'back' | 'backward' | 'forward' | 'front'): void {
    const moved = moveElementLayer(this.elements, elementId, direction);
    if (!moved) return;

    this.recordHistory();
    this.setModified(true);
    this.renderPages();
    this.selectElement(elementId);
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
    showToast('Capa actualizada', 'info');
  }

  private reorderElementLayer(draggedId: string, targetId: string): void {
    const reordered = reorderElementLayer(this.elements, draggedId, targetId);
    if (!reordered) return;

    this.recordHistory();
    this.setModified(true);
    this.renderPages();
    this.selectElement(draggedId);
    if (this.isLayersPanelOpen) {
      this.renderLayersList();
    }
    showToast('Orden de capas actualizado', 'info');
  }

  private alignElementToPage(elementId: string, alignment: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top'): void {
    const elem = this.elements.find((el) => el.id === elementId);
    if (!elem) return;
    const p = elem.pageIndex ?? 0;
    const aligned = alignElementToPage(elem, alignment, this.getPageDimensions(p));
    if (!aligned) return;

    this.recordHistory();
    this.setModified(true);
    this.renderPages();
    this.selectElement(elementId);
    showToast('Elemento alineado', 'info');
  }

  private openLayersPanel(): void {
    this.isLayersPanelOpen = true;
    const panel = this.container.querySelector<HTMLElement>('[data-ref="collab-layers-panel"]');
    panel?.classList.remove('is-hidden');
    this.renderLayersList();
  }

  private closeLayersPanel(): void {
    this.isLayersPanelOpen = false;
    const panel = this.container.querySelector<HTMLElement>('[data-ref="collab-layers-panel"]');
    panel?.classList.add('is-hidden');
  }

  private renderLayersList(): void {
    renderLayersList({
      container: this.container,
      elements: this.elements,
      isLayersPanelOpen: this.isLayersPanelOpen,
      onDeleteElement: (id) => {
        this.selectElement(id);
        this.deleteSelectedElement();
        this.renderLayersList();
      },
      onMoveLayer: (id, direction) => {
        this.moveElementLayer(id, direction);
      },
      onReorderLayer: (draggedId, targetId) => {
        this.reorderElementLayer(draggedId, targetId);
      },
      onSelectElement: (id) => {
        this.selectElement(id);
      },
      selectedElementId: this.selectedElementId,
      selectedPageIndex: this.selectedPageIndex,
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

  private togglePagesCarousel(): void {
    this.isPagesCarouselOpen = !this.isPagesCarouselOpen;
    if (this.isPagesCarouselOpen && this.isGridViewOpen) {
      this.isGridViewOpen = false;
      this.renderGridView();
    }
    const filmstrip = this.container.querySelector<HTMLElement>('[data-ref="pages-filmstrip"]');
    const btnFooterPages = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-footer-pages"]');
    btnFooterPages?.classList.toggle('is-active', this.isPagesCarouselOpen);

    if (this.isPagesCarouselOpen) {
      filmstrip?.classList.remove('is-hidden');
      this.applySinglePageMode(true);
      this.renderPagesFilmstrip();
    } else {
      filmstrip?.classList.add('is-hidden');
      this.applySinglePageMode(false);
    }
  }

  private applySinglePageMode(enable: boolean): void {
    const pagesContainer = this.container.querySelector<HTMLElement>('[data-ref="pages-container"]');
    if (!pagesContainer) return;
    pagesContainer.classList.toggle('is-single-page-mode', enable);

    const activeIdx = this.selectedPageIndex !== null ? this.selectedPageIndex : (this.activePageIndex ?? 0);
    const headers = pagesContainer.querySelectorAll<HTMLElement>('.collaborative-page-header');
    const scalers = pagesContainer.querySelectorAll<HTMLElement>('.collaborative-page-sheet-scaler');

    headers.forEach((h) => {
      const p = parseInt(h.getAttribute('data-page-index') || '0', 10);
      h.classList.toggle('is-single-visible', !enable || p === activeIdx);
    });

    scalers.forEach((s) => {
      const p = parseInt(s.getAttribute('data-page-index') || '0', 10);
      s.classList.toggle('is-single-visible', !enable || p === activeIdx);
    });

    if (!enable) {
      this.scrollToPage(activeIdx);
    }
  }

  private renderPagesFilmstrip(): void {
    const track = this.container.querySelector<HTMLElement>('[data-ref="filmstrip-track"]');
    if (!track) return;
    track.innerHTML = '';

    const activeIdx = this.selectedPageIndex !== null ? this.selectedPageIndex : (this.activePageIndex ?? 0);

    for (let p = 0; p < this.pageCount; p++) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `collaborative-filmstrip-card${p === activeIdx ? ' is-active' : ''}`;
      card.setAttribute('data-ref', `filmstrip-card-${p}`);
      card.setAttribute('data-page-index', p.toString());

      const previewBox = document.createElement('div');
      previewBox.className = 'collaborative-filmstrip-card__preview';

      const canvas = document.createElement('canvas');
      canvas.className = 'collaborative-filmstrip-card__canvas';
      previewBox.appendChild(canvas);

      const numSpan = document.createElement('span');
      numSpan.className = 'collaborative-filmstrip-card__num';
      numSpan.textContent = (p + 1).toString();

      card.appendChild(previewBox);
      card.appendChild(numSpan);

      card.addEventListener('click', () => {
        this.activePageIndex = p;
        this.selectedPageIndex = p;
        this.applySinglePageMode(true);
        this.updateFooterPageInfo();
        track.querySelectorAll('.collaborative-filmstrip-card').forEach((c) => {
          const cardP = parseInt(c.getAttribute('data-page-index') || '0', 10);
          c.classList.toggle('is-active', cardP === p);
        });
      });

      track.appendChild(card);
      void this.renderPagePreviewToCanvas(p, canvas, 52);
    }

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'collaborative-filmstrip-add-btn';
    addBtn.setAttribute('data-ref', 'btn-filmstrip-add');
    addBtn.setAttribute('aria-label', 'Añadir página');
    addBtn.innerHTML = '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>';
    addBtn.addEventListener('click', () => {
      this.addPage();
      this.renderPagesFilmstrip();
    });
    track.appendChild(addBtn);
    renderIcons(track);
  }

  private toggleGridView(): void {
    this.isGridViewOpen = !this.isGridViewOpen;
    if (this.isGridViewOpen && this.isPagesCarouselOpen) {
      this.isPagesCarouselOpen = false;
      const filmstrip = this.container.querySelector<HTMLElement>('[data-ref="pages-filmstrip"]');
      filmstrip?.classList.add('is-hidden');
      const btnFooterPages = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-footer-pages"]');
      btnFooterPages?.classList.remove('is-active');
      this.applySinglePageMode(false);
    }
    this.renderGridView();
  }

  private renderGridView(): void {
    const gridView = this.container.querySelector<HTMLElement>('[data-ref="grid-view"]');
    const zoomWrapper = this.container.querySelector<HTMLElement>('[data-ref="collaborative-zoom-wrapper"]');
    const btnFooterGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-footer-grid"]');
    btnFooterGrid?.classList.toggle('is-active', this.isGridViewOpen);

    if (!this.isGridViewOpen) {
      gridView?.classList.add('is-hidden');
      zoomWrapper?.classList.remove('is-hidden');
      return;
    }

    gridView?.classList.remove('is-hidden');
    zoomWrapper?.classList.add('is-hidden');

    const grid = gridView?.querySelector<HTMLElement>('[data-ref="grid-view-grid"]');
    if (!grid) return;
    grid.innerHTML = '';

    const activeIdx = this.selectedPageIndex !== null ? this.selectedPageIndex : (this.activePageIndex ?? 0);

    for (let p = 0; p < this.pageCount; p++) {
      const card = document.createElement('div');
      card.className = `collaborative-grid-card${p === activeIdx ? ' is-active' : ''}`;
      card.setAttribute('data-ref', `grid-card-${p}`);
      card.setAttribute('data-page-index', p.toString());

      const preview = document.createElement('div');
      preview.className = 'collaborative-grid-card__preview';

      const canvas = document.createElement('canvas');
      canvas.className = 'collaborative-grid-card__canvas';
      preview.appendChild(canvas);

      const footer = document.createElement('div');
      footer.className = 'collaborative-grid-card__footer';
      const num = document.createElement('span');
      num.className = 'collaborative-grid-card__num';
      num.textContent = `Página ${p + 1}`;
      footer.appendChild(num);

      card.appendChild(preview);
      card.appendChild(footer);

      card.addEventListener('click', () => {
        this.activePageIndex = p;
        this.selectedPageIndex = p;
        grid.querySelectorAll('.collaborative-grid-card').forEach((c) => {
          const cardP = parseInt(c.getAttribute('data-page-index') || '0', 10);
          c.classList.toggle('is-active', cardP === p);
        });
      });

      card.addEventListener('dblclick', () => {
        this.activePageIndex = p;
        this.selectedPageIndex = p;
        this.isGridViewOpen = false;
        this.renderGridView();
        if (this.isPagesCarouselOpen) {
          this.applySinglePageMode(true);
          this.renderPagesFilmstrip();
        } else {
          this.scrollToPage(p);
        }
        this.updateFooterPageInfo();
      });

      grid.appendChild(card);
      void this.renderPagePreviewToCanvas(p, canvas, 180);
    }

    const addCard = document.createElement('button');
    addCard.type = 'button';
    addCard.className = 'collaborative-grid-card collaborative-grid-card--add';
    addCard.setAttribute('data-ref', 'btn-grid-add-page');
    addCard.innerHTML = `
      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
      <span>Añadir página</span>
    `;
    addCard.addEventListener('click', () => {
      this.addPage();
      this.renderGridView();
    });
    grid.appendChild(addCard);
    renderIcons(grid);
  }

  private async renderPagePreviewToCanvas(pageIndex: number, canvas: HTMLCanvasElement, targetWidth: number): Promise<void> {
    const dim = this.getPageDimensions(pageIndex);
    const targetHeight = Math.round(targetWidth * (dim.height / dim.width));
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    canvas.width = targetWidth * dpr;
    canvas.height = targetHeight * dpr;
    canvas.style.width = `${targetWidth}px`;
    canvas.style.height = `${targetHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const pdfSource = this.pagePdfSources[pageIndex];
    if (pdfSource && pdfSource.pdfUrl) {
      try {
        await renderPdfThumbnail(pdfSource.pdfUrl, canvas, {
          dpr: true,
          pageNum: pdfSource.pageNumber,
          targetWidth,
        });
      } catch {}
    } else {
      const bg = this.pageBackgrounds[pageIndex] || '#ffffff';
      ctx.fillStyle = bg.startsWith('linear-gradient') ? '#f3f4f6' : bg;
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    const scale = targetWidth / dim.width;
    const pageElements = this.elements.filter((el): el is ElementChart | ElementImage | ElementShape | ElementTable | ElementText => (el.pageIndex ?? 0) === pageIndex && el.type !== 'drawing');

    for (const el of pageElements) {
      ctx.save();
      const x = (el.x || 0) * scale;
      const y = (el.y || 0) * scale;
      const w = (el.width || 100) * scale;
      const h = (el.height || 40) * scale;

      if (el.type === 'text') {
        const fontSize = Math.max(4, Math.round((el.fontSize || 16) * scale));
        ctx.font = `${el.isBold ? 'bold ' : ''}${fontSize}px sans-serif`;
        ctx.fillStyle = el.color || '#000000';
        ctx.textBaseline = 'top';
        const text = (el.text || '').substring(0, 50);
        ctx.fillText(text, x, y);
      } else if (el.type === 'shape') {
        ctx.fillStyle = el.fillColor || 'transparent';
        ctx.strokeStyle = el.strokeColor || '#000000';
        ctx.lineWidth = Math.max(1, (el.strokeWidth || 1) * scale);
        if (el.shapeType === 'circle') {
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        }
      } else if (el.type === 'image' && el.url) {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(x, y, w, h);
      } else if (el.type === 'table') {
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
      }
      ctx.restore();
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
