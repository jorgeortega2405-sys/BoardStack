import { showAuthGateModal } from '../../components/auth-gate-modal.component.js';
import { openDeleteDocModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { COLLAB_PAGE_PRESETS, PageDimension, PagePreset, inToPx, mmToPx } from '../../config/collab-page-presets.config.js';
import { currentUser, deleteApi, escapeHtml, getApi, hasSubscriptionFeature, onAuthChange, patchApi, postApi, postFormApi, putApi, updateUserAiTokens } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
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
import { getLocalDraft, saveLocalDraft } from '../../utils/collab-local-draft.util.js';
import { debounce, hideElement, setupDropdown, showElement, withButtonLoading } from '../../utils/dom.util.js';
import { applyAvatarTier } from '../../utils/tier.util.js';
import { bindChartInspectorEvents, renderChartSpreadsheet, switchChartAxisTab, switchChartInspectorTab, syncChartInspector } from './components/design-pdf-chart-inspector.component.js';
import { alignElementToPage, moveElementLayer, reorderElementLayer } from './components/design-pdf-context-menu.component.js';
import { renderLayersList } from './components/design-pdf-layers-panel.component.js';
import { GOOGLE_FONTS_CATALOG, GoogleFontItem, loadGoogleFont, loadGoogleFontPreview, WEIGHT_LABELS } from './config/design-pdf-fonts.config.js';
import { SHAPES_CATALOG } from './config/design-pdf-shapes.config.js';
import { DesignPdfCanvasManager } from './managers/design-pdf-canvas.manager.js';
import { DesignPdfHistoryManager } from './managers/design-pdf-history.manager.js';
import { DesignPdfRulerManager } from './managers/design-pdf-ruler.manager.js';
import { DesignPdfSyncManager } from './managers/design-pdf-sync.manager.js';
import { openCollabAiGenerateModal } from './modals/design-pdf-ai-modal.util.js';
import { CollabFileGuidesPreset, CollabFilePopoverHandle, createCollabFilePopover } from './modals/design-pdf-file-modal.util.js';
import { openCollabPageSizeModal } from './modals/design-pdf-page-size-modal.util.js';
import { CollabShareFindState, CollabSharePopoverHandle, createCollabSharePopover } from './modals/design-pdf-share-modal.util.js';
import { applyChartPalette, renderChartSvg } from './renderers/design-pdf-chart-renderer.util.js';
import { renderShapeGeometry, renderShapeInner } from './renderers/design-pdf-shape-renderer.util.js';
import { CollabActionDispatcher } from './services/design-pdf-dispatcher.service.js';
import { createCollaborativeDrawerElement, renderFullGradientSwatchesHtml, renderFullSolidSwatchesHtml } from './templates/design-pdf-drawer.template.js';
import { applyListFormatting, CHART_PALETTES, ChartType, DocMember, EditorElement, ElementChart, ElementChartDataSeries, ElementChartOptions, ElementDrawing, ElementImage, ElementShape, ElementTable, ElementTableCell, ElementText, ManualGuide, PAGE_HEIGHT, PAGE_WIDTH, PagePdfSource, RemotePeer, UploadedAsset } from './types/design-pdf.types.js';
import { findSearchMatches, replaceAllMatches, replaceCurrentMatch } from './utils/design-pdf-find-replace.util.js';
import { addPeerPresenceBubble, removePeerPresenceBubble, renderPresenceList, renderRemoteCursor } from './utils/design-pdf-presence.util.js';
import { initRulerGuidesInteraction, renderPersistentGuidesSvg, RulerGuidesController, updateRulers } from './utils/design-pdf-rulers.util.js';
import { applySmartGuides, clearSmartGuides, renderActiveSmartGuides } from './utils/design-pdf-smart-guides.util.js';

class DesignPdfEditorController implements ViewController {
  private canvasManager!: DesignPdfCanvasManager;
  private historyManager!: DesignPdfHistoryManager;
  private rulerManager!: DesignPdfRulerManager;
  private syncManager!: DesignPdfSyncManager;
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
  private activeTool: 'draw' | 'lines' | 'select' | 'shapes' | 'stickynotes' | 'text' = 'select';
  private activeUploadFilter: 'all' | 'images' | 'pdfs' = 'all';
  private canEditDoc = true;
  private collabCleanup: (() => void) | null = null;
  private container: HTMLElement;
  private dispatcher!: CollabActionDispatcher;
  private docAccessLevel: 'anyone_with_link' | 'restricted' = 'restricted';
  private docCustomSlug: string | null = null;
  private docTeamAccess: 'editor' | 'viewer' | 'none' = 'none';
  private docTeamId: number | null = null;
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
  private isDestroyed = false;
  private isDocOwner = true;
  private isLocalOnly = false;
  private isModified = false;
  private isRestrictedAccess = false;
  private lastCursorBroadcast = 0;
  private lastSavedTimestamp = 0;
  private lockedPages = new Set<number>();
  private myClientId = '';
  private myColor = '#111827';
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
  private manualGuides: ManualGuide[] = [];
  private rulerGuidesCtrl: RulerGuidesController | null = null;
  private selectedGuideId: string | null = null;
  private selectedPageIndex: number | null = null;
  private sharePopoverHandle: CollabSharePopoverHandle | null = null;
  private selectedPdfAsset: UploadedAsset | null = null;
  private activeContextDropdowns: Array<{ close: () => void; destroy: () => void }> = [];
  private editDropdownCtrl: { close: () => void; destroy: () => void } | null = null;
  private fileDropdownCtrl: { close: () => void; destroy: () => void } | null = null;
  private filePopoverHandle: CollabFilePopoverHandle | null = null;
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
  private contextMenuTargetTableId: string | null = null;
  private contextMenuTargetRowIndex = 0;
  private contextMenuTargetColIndex = 0;
  private drawOpacity = 1.0;
  private isLayersPanelOpen = false;
  private aiLockPollTimer: ReturnType<typeof setInterval> | null = null;
  private aiLockedBy: string | null = null;
  private isAiLocked = false;
  private isLocalAiGenerating = false;
  private pendingAiLock: { locked: boolean; lockedBy?: string | null } | null = null;

  constructor(container: HTMLElement, docId?: string, queryParams?: URLSearchParams) {
    this.container = container;
    this.docId = docId || '';
    this.queryParams = queryParams;
    this.canvasManager = new DesignPdfCanvasManager(this as any);
    this.historyManager = new DesignPdfHistoryManager(this as any);
    this.rulerManager = new DesignPdfRulerManager(this as any);
    this.syncManager = new DesignPdfSyncManager(this as any);
    this.initDispatcher();
  }

  private initDispatcher(): void {
    const self = this;
    this.dispatcher = new CollabActionDispatcher({
      alignElementToPage: (elementId, alignment) => {
        const elem = self.elements.find((el) => el.id === elementId);
        if (!elem) return false;
        return alignElementToPage(elem, alignment, self.getPageDimensions(elem.pageIndex ?? 0));
      },
      canEdit: () => !self.isAiLocked && self.editorMode !== 'view' && self.canEditDoc,
      get docDefaultPageSize() { return self.docDefaultPageSize; },
      get docTitle() { return self.docTitle; },
      get elements() { return self.elements; },
      flushAutoSave: () => self.flushAutoSave(),
      getPageDimensions: (pageIndex) => self.getPageDimensions(pageIndex),
      get isCollabRoomFull() { return self.isCollabRoomFull; },
      isLockedPage: (pageIndex) => self.lockedPages.has(pageIndex),
      get manualGuides() { return self.manualGuides; },
      moveElementLayer: (elementId, direction) => moveElementLayer(self.elements, elementId, direction),
      pageBackgrounds: self.pageBackgrounds,
      get pageCount() { return self.pageCount; },
      set pageCount(val: number) { self.pageCount = val; },
      pagePdfSources: self.pagePdfSources,
      pageSizes: self.pageSizes,
      pageTitles: self.pageTitles,
      recordHistory: () => self.recordHistory(),
      redo: () => self.redo(),
      renderLayersList: () => {
        if (self.isLayersPanelOpen) self.renderLayersList();
      },
      renderPages: () => self.renderPages(),
      reorderElementLayer: (draggedId, targetId) => reorderElementLayer(self.elements, draggedId, targetId),
      selectElement: (id) => {
        if (id) {
          self.selectElement(id);
        } else {
          self.selectedElementId = null;
          self.selectedElementIds.clear();
          self.removeTransformBox();
        }
      },
      get selectedElementId() { return self.selectedElementId; },
      setDocTitle: (title) => {
        self.docTitle = title;
        const titleInput = self.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
        if (titleInput && document.activeElement !== titleInput) titleInput.value = title;
      },
      setModified: (val) => self.setModified(val),
      undo: () => self.undo(),
      updateContextToolbar: () => self.updateContextToolbar(),
      updateTransformBoxPosition: () => self.updateTransformBoxPosition(),
    });
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
    if (!loaded || this.isDestroyed) return;
    this.initCollabWebSocket();
    this.renderPages();
    this.bindEvents();
    if (this.pendingAiLock?.locked) {
      this.setAiLock(true, this.pendingAiLock.lockedBy || undefined);
      this.pendingAiLock = null;
    }
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
        guides: this.manualGuides,
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
    this.isDestroyed = true;
    const layoutNav = document.querySelector<HTMLElement>('.layout-nav');
    const layoutContent = document.querySelector<HTMLElement>('.layout-content');
    if (layoutNav) layoutNav.style.display = '';
    if (layoutContent) layoutContent.style.paddingLeft = '';
    document.body.classList.remove('is-dragging-element');
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
    this.closeFilePopover();
    this.editDropdownCtrl?.destroy();
    this.editDropdownCtrl = null;
    this.rulerGuidesCtrl?.destroy();
    this.rulerGuidesCtrl = null;
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
    if (this.aiLockPollTimer) {
      clearInterval(this.aiLockPollTimer);
      this.aiLockPollTimer = null;
    }
    if (this.isLocalAiGenerating) {
      wsService.send({ locked: false, type: 'aiLock' });
      this.isLocalAiGenerating = false;
    }
    this.isAiLocked = false;
    if (this.collabCleanup) {
      this.collabCleanup();
      this.collabCleanup = null;
    }
    this.dispatcher?.destroy();
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
      const chartInspector = this.queryPanel<HTMLElement>('[data-ref="panel-section-chart-inspector"]');
      const panelElements = this.queryPanel<HTMLElement>('[data-ref="panel-section-elements"]');
      if (chartInspector) hideElement(chartInspector);
      if (panelElements) showElement(panelElements);
      if (elemShapesView) hideElement(elemShapesView);
      const catView = this.queryPanel<HTMLElement>('[data-ref="elements-shapes-category-view"]');
      if (catView) hideElement(catView);
      if (elemTablesView) hideElement(elemTablesView);
      if (elemChartsView) hideElement(elemChartsView);
      if (elemMainView) showElement(elemMainView);
      const titleEl = this.queryPanel<HTMLElement>('[data-ref="side-panel-title"]');
      if (titleEl) titleEl.textContent = t('collaborative.elements');
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

    const colorsContainer = this.queryPanel<HTMLElement>('[data-ref="colors-container"]');
    const colorsCatView = this.queryPanel<HTMLElement>('[data-ref="colors-category-view"]');
    const colorsCatTitle = this.queryPanel<HTMLElement>('[data-ref="colors-cat-title"]');
    const colorsCatContent = this.queryPanel<HTMLElement>('[data-ref="colors-cat-content"]');
    const btnColorsCatBack = this.queryPanel<HTMLButtonElement>('[data-ref="btn-colors-cat-back"]');

    const openColorsCategory = (title: string, swatchesHtml: string) => {
      if (!colorsContainer || !colorsCatView || !colorsCatTitle || !colorsCatContent) return;
      colorsCatTitle.textContent = title;
      colorsCatContent.innerHTML = swatchesHtml;
      colorsContainer.classList.add('is-hidden');
      colorsCatView.classList.remove('is-hidden');
      const swatches = colorsCatContent.querySelectorAll<HTMLButtonElement>('.collaborative-color-swatch[data-color]');
      swatches.forEach((sw) => {
        sw.addEventListener('click', () => {
          const c = sw.getAttribute('data-color');
          if (c) this.applyColorToCurrentTarget(c);
        });
      });
    };

    const closeColorsCategory = () => {
      colorsCatView?.classList.add('is-hidden');
      colorsContainer?.classList.remove('is-hidden');
    };

    btnColorsCatBack?.addEventListener('click', closeColorsCategory, { signal });

    const btnSolidColorsMore = this.queryPanel<HTMLButtonElement>('[data-ref="btn-solid-colors-more"]');
    btnSolidColorsMore?.addEventListener('click', () => {
      openColorsCategory(t('collaborative.colors_default_solids'), renderFullSolidSwatchesHtml());
    }, { signal });

    const btnGradientColorsMore = this.queryPanel<HTMLButtonElement>('[data-ref="btn-gradient-colors-more"]');
    btnGradientColorsMore?.addEventListener('click', () => {
      openColorsCategory(t('collaborative.colors_default_gradients'), renderFullGradientSwatchesHtml());
    }, { signal });

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
        if (this.isAiLocked) {
          showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
          return;
        }
        const color = btn.getAttribute('data-color');
        if (color) {
          this.applyColorToCurrentTarget(color);
        }
      }, { signal });
    });

    const btnCustomPicker = this.queryPanel<HTMLButtonElement>('[data-ref="btn-color-custom-picker"]');
    const inputCustomColor = this.queryPanel<HTMLInputElement>('[data-ref="input-custom-color"]');
    btnCustomPicker?.addEventListener('click', () => {
      if (this.isAiLocked) {
        showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
        return;
      }
      inputCustomColor?.click();
    }, { signal });

    inputCustomColor?.addEventListener('input', () => {
      if (this.isAiLocked) return;
      if (inputCustomColor.value) {
        this.applyColorToCurrentTarget(inputCustomColor.value);
      }
    }, { signal });

    const btnEyedropper = this.queryPanel<HTMLButtonElement>('[data-ref="btn-color-eyedropper"]');
    btnEyedropper?.addEventListener('click', () => {
      if (this.isAiLocked) {
        showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
        return;
      }
      void this.activateZoomEyeDropper();
    }, { signal });

    const btnTransparent = this.queryPanel<HTMLButtonElement>('[data-ref="btn-color-transparent"]');
    btnTransparent?.addEventListener('click', () => {
      if (this.isAiLocked) {
        showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
        return;
      }
      this.applyColorToCurrentTarget('transparent');
    }, { signal });

    const btnUpload = this.queryPanel<HTMLButtonElement>('[data-ref="btn-upload-file"]');
    const fileInput = this.queryPanel<HTMLInputElement>('[data-ref="input-file-upload"]');

    btnUpload?.addEventListener('click', () => {
      if (this.isAiLocked) {
        showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
        return;
      }
      if (!currentUser || this.isLocalOnly) {
        showAuthGateModal({ featureKey: 'cloud_uploads', returnUrl: window.location.pathname });
        return;
      }
      fileInput?.click();
    }, { signal });

    fileInput?.addEventListener('change', async () => {
      if (this.isAiLocked) {
        fileInput.value = '';
        return;
      }
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
          showToast(t('toasts.no_se_pudo_subir_el_archivo'), 'error');
        }
      } catch {
        showToast(t('toasts.error_de_red_al_subir_archivo'), 'error');
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
    this.rulerGuidesCtrl?.setPassthrough(tool !== 'select');
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
      guides: this.manualGuides,
      pageBackgrounds: this.pageBackgrounds,
      pageCount: this.pageCount,
      pagePdfSources: this.pagePdfSources,
      pageSize: this.docDefaultPageSize,
      pageSizes: this.pageSizes,
      pageTitles: this.pageTitles,
    };
  }

  private addPage(afterIndex?: number, customDim?: PageDimension): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (this.editorMode === 'view') return;
    const targetIndex = afterIndex !== undefined ? afterIndex + 1 : this.pageCount;
    const success = this.dispatcher.dispatch({
      payload: { afterIndex, customDim },
      type: 'PAGE_ADD',
    });
    if (success) {
      this.activePageIndex = targetIndex;
      this.selectPage(targetIndex);
      this.scrollToPage(targetIndex);
      showToast(t('toasts.pagina_anadida'), 'success');
    }
  }

  private scrollToPage(pageIndex: number): void {
    requestAnimationFrame(() => {
      const pageEl = this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-scaler-${pageIndex}"], [data-ref="page-sheet-${pageIndex}"]`);
      pageEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  private togglePageLock(pageIndex: number): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (this.lockedPages.has(pageIndex)) {
      this.lockedPages.delete(pageIndex);
      showToast(t('toasts.pagina_desbloqueada'), 'info');
    } else {
      this.lockedPages.add(pageIndex);
      showToast(t('toasts.pagina_bloqueada'), 'info');
    }
    this.renderPages();
  }

  private duplicatePage(pageIndex: number): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    const targetIndex = pageIndex + 1;
    const success = this.dispatcher.dispatch({
      payload: { pageIndex },
      type: 'PAGE_DUPLICATE',
    });
    if (success) {
      this.activePageIndex = targetIndex;
      this.selectPage(targetIndex);
      this.scrollToPage(targetIndex);
      showToast(t('toasts.pagina_duplicada'), 'success');
    }
  }

  private deletePage(pageIndex: number): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (this.pageCount <= 1) {
      showToast(t('toasts.el_documento_debe_tener_al_menos_una_pag'), 'info');
      return;
    }
    const success = this.dispatcher.dispatch({
      payload: { pageIndex },
      type: 'PAGE_DELETE',
    });
    if (success) {
      this.activePageIndex = Math.max(0, Math.min(this.pageCount - 1, pageIndex));
      this.selectPage(this.activePageIndex);
      showToast(t('toasts.pagina_eliminada'), 'info');
    }
  }

  private movePageUp(pageIndex: number): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (pageIndex <= 0) return;
    const prev = pageIndex - 1;
    const success = this.dispatcher.dispatch({
      payload: { fromIndex: pageIndex, toIndex: prev },
      type: 'PAGE_MOVE',
    });
    if (success) {
      this.activePageIndex = prev;
      this.selectPage(prev);
    }
  }

  private movePageDown(pageIndex: number): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (pageIndex >= this.pageCount - 1) return;
    const next = pageIndex + 1;
    const success = this.dispatcher.dispatch({
      payload: { fromIndex: pageIndex, toIndex: next },
      type: 'PAGE_MOVE',
    });
    if (success) {
      this.activePageIndex = next;
      this.selectPage(next);
    }
  }

  private rotatePage(pageIndex: number): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
        showToast(applyToAll ? t('ui.tamano_aplicado_a_todas_las_paginas') : `Tamaño de página ${pageIndex + 1} actualizado`, 'success');
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
          this.docTitle = localDraft.title || t('collaborative.untitled_doc');
          this.docAccessLevel = 'restricted';
          this.docCustomSlug = null;
          this.isDocOwner = true;
          this.canEditDoc = true;
          this.docMembers = [];
          this.pageCount = Math.max(1, localDraft.content?.pageCount || 1);
          this.elements = Array.isArray(localDraft.content?.elements) ? localDraft.content.elements : [];
          this.manualGuides = Array.isArray(localDraft.content?.guides) ? localDraft.content.guides : [];
          this.pageTitles = Array.isArray(localDraft.content?.pageTitles) && localDraft.content.pageTitles.length > 0 ? localDraft.content.pageTitles : [''];
          this.pageBackgrounds = Array.isArray(localDraft.content?.pageBackgrounds) && localDraft.content.pageBackgrounds.length > 0 ? localDraft.content.pageBackgrounds : ['#ffffff'];
          this.pagePdfSources = Array.isArray(localDraft.content?.pagePdfSources) && localDraft.content.pagePdfSources.length > 0 ? localDraft.content.pagePdfSources : [null];
          this.initPageSizesFromContent(localDraft.content);
        } else {
          try {
            const getUrl = API_ROUTES.collaborativeDocs.byId(this.docId) + (this.initialUrlDimensions ? `?w=${this.initialUrlDimensions.width}&h=${this.initialUrlDimensions.height}` : '');
            const res = await getApi(getUrl);
            if (res.ok) {
              const data = await res.json();
              serverDoc = data.document;
              if (data.document) {
                this.isLocalOnly = false;
                this.docTitle = data.document.title || t('collaborative.untitled_doc');
                this.docAccessLevel = data.document.access_level || 'anyone_with_link';
                this.docCustomSlug = data.document.custom_slug || null;
                this.docTeamId = data.document.team_id ? Number(data.document.team_id) : null;
                this.docTeamAccess = data.document.team_access || 'none';
                this.isDocOwner = false;
                this.canEditDoc = data.canEdit ?? (this.docAccessLevel === 'anyone_with_link');
                this.docMembers = Array.isArray(data.document.members) ? data.document.members : [];
                this.pageCount = Math.max(1, data.document.page_count || data.document.content?.pageCount || 1);
                this.elements = Array.isArray(data.document.content?.elements) ? data.document.content.elements : [];
                this.manualGuides = Array.isArray(data.document.content?.guides) ? data.document.content.guides : [];
                this.pageTitles = Array.isArray(data.document.content?.pageTitles) && data.document.content.pageTitles.length > 0 ? data.document.content.pageTitles : [''];
                this.pageBackgrounds = Array.isArray(data.document.content?.pageBackgrounds) && data.document.content.pageBackgrounds.length > 0 ? data.document.content.pageBackgrounds : ['#ffffff'];
                this.pagePdfSources = Array.isArray(data.document.content?.pagePdfSources) && data.document.content.pagePdfSources.length > 0 ? data.document.content.pagePdfSources : [null];
                this.initPageSizesFromContent(data.document.content);
                if (data.aiLock?.locked) {
                  this.pendingAiLock = { locked: true, lockedBy: data.aiLock.lockedBy || null };
                }
              }
            } else if (res.status === 403) {
              this.isRestrictedAccess = true;
              this.renderRestrictedScreen();
              return false;
            } else {
              this.isLocalOnly = true;
              this.docTitle = t('collaborative.untitled_doc');
              this.docAccessLevel = 'restricted';
              this.docCustomSlug = null;
              this.docTeamId = null;
              this.docTeamAccess = 'none';
              this.isDocOwner = true;
              this.canEditDoc = true;
              this.docMembers = [];
              saveLocalDraft(this.docId, {
                content: this.getContentPayload(),
                id: this.docId,
                title: this.docTitle,
              });
            }
          } catch {
            this.isLocalOnly = true;
            this.docTitle = t('collaborative.untitled_doc');
            this.docAccessLevel = 'restricted';
            this.docCustomSlug = null;
            this.docTeamId = null;
            this.docTeamAccess = 'none';
            this.isDocOwner = true;
            this.canEditDoc = true;
            this.docMembers = [];
            saveLocalDraft(this.docId, {
              content: this.getContentPayload(),
              id: this.docId,
              title: this.docTitle,
            });
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
              this.docTitle = data.document.title || t('collaborative.untitled_doc');
              this.docAccessLevel = data.document.access_level || 'restricted';
              this.docCustomSlug = data.document.custom_slug || null;
              this.docTeamId = data.document.team_id ? Number(data.document.team_id) : null;
              this.docTeamAccess = data.document.team_access || 'none';
              this.isDocOwner = data.isOwner ?? true;
              this.canEditDoc = data.canEdit ?? true;
              this.docMembers = Array.isArray(data.document.members) ? data.document.members : [];
              this.pageCount = Math.max(1, data.document.page_count || data.document.content?.pageCount || 1);
              this.elements = Array.isArray(data.document.content?.elements) ? data.document.content.elements : [];
              this.manualGuides = Array.isArray(data.document.content?.guides) ? data.document.content.guides : [];
              this.pageTitles = Array.isArray(data.document.content?.pageTitles) && data.document.content.pageTitles.length > 0 ? data.document.content.pageTitles : [''];
              this.pageBackgrounds = Array.isArray(data.document.content?.pageBackgrounds) && data.document.content.pageBackgrounds.length > 0 ? data.document.content.pageBackgrounds : ['#ffffff'];
              this.pagePdfSources = Array.isArray(data.document.content?.pagePdfSources) && data.document.content.pagePdfSources.length > 0 ? data.document.content.pagePdfSources : [null];
              this.initPageSizesFromContent(data.document.content);
              if (data.aiLock?.locked) {
                this.pendingAiLock = { locked: true, lockedBy: data.aiLock.lockedBy || null };
              }
            }
          } else {
            showToast(t('collaborative.doc_not_found'), 'danger');
            navigate('/projects');
            return false;
          }
        } catch {
          showToast(t('collaborative.doc_not_found'), 'danger');
          navigate('/projects');
          return false;
        }
      }

      try {
        const walRaw = localStorage.getItem(`boardpdf_wal_${this.docId}`);
        if (walRaw) {
          const wal = JSON.parse(walRaw);
          const serverTime = serverDoc?.updated_at ? new Date(serverDoc.updated_at).getTime() : 0;
          const hasWalData = wal && (
            (Array.isArray(wal.elements) && wal.elements.length > 0) ||
            (Array.isArray(wal.guides) && wal.guides.length > 0)
          );
          if (hasWalData && (!serverDoc || wal.timestamp > serverTime)) {
            if (Array.isArray(wal.elements)) this.elements = wal.elements;
            if (Array.isArray(wal.guides)) this.manualGuides = wal.guides;
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
      } catch {}

      const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
      if (titleInput) {
        titleInput.value = this.docTitle;
      }
      if (this.isLocalOnly) {
        const shareBtnText = this.container.querySelector<HTMLElement>('[data-ref="btn-share-text"]');
        if (shareBtnText) {
          shareBtnText.textContent = t('collaborative.download');
        }
        const shareBtnIconUse = this.container.querySelector<SVGUseElement>('[data-ref="btn-share-icon"] use');
        shareBtnIconUse?.setAttribute('href', '/icons.svg#download');
      }
      this.setSaveStatus('saved');
      return true;
    } finally {
      this.isLoadingDocument = false;
    }
  }

  private renderRestrictedScreen(): void {
    this.container.innerHTML = `
      <div class="component-wrapper component-wrapper--full view-wrapper collab-restricted-wrapper">
        <div class="collab-share-card collab-restricted-card">
          <div class="collab-access-icon-circle collab-restricted-icon-circle">
            <svg class="component-icon collab-restricted-icon" aria-hidden="true"><use href="/icons.svg#shield"></use></svg>
          </div>
          <h2 class="collab-share-title" data-i18n="collaborative.restricted_title"></h2>
          <p class="collab-restricted-desc" data-i18n="collaborative.restricted_desc"></p>
          <a class="component-button component-button--black component-button--h44 component-button--w-full" href="/projects" data-i18n="collaborative.back_to_projects"></a>
        </div>
      </div>
    `;
    translateElement(this.container);
    renderIcons(this.container);
  }

  private writeLocalWal(): void {
    if (this.isLoadingDocument || !this.docId) return;
    try {
      const walData = {
        elements: this.elements,
        guides: this.manualGuides,
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
    if (this.isAiLocked) return;
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
        cloudBtn.setAttribute('data-tooltip', t('ui.error_al_sincronizar_clic_para_reintenta'));
        cloudBtn.setAttribute('aria-label', 'Error al sincronizar');
      } else {
        cloudBtn.classList.remove('is-error');
        if (this.isLocalOnly) {
          iconUse?.setAttribute('href', '/icons.svg#devices');
          if (status === 'saving') {
            cloudBtn.setAttribute('data-tooltip', t('collaborative.saving_local', 'Guardando en este dispositivo...'));
            cloudBtn.setAttribute('aria-label', t('collaborative.saving_local', 'Guardando en este dispositivo...'));
          } else {
            cloudBtn.setAttribute('data-tooltip', t('collaborative.local_saved_tooltip', 'Guardado en este dispositivo (Modo local)'));
            cloudBtn.setAttribute('aria-label', t('collaborative.local_saved_tooltip', 'Guardado en este dispositivo (Modo local)'));
          }
        } else {
          iconUse?.setAttribute('href', '/icons.svg#cloud');
          if (status === 'saving') {
            cloudBtn.setAttribute('data-tooltip', t('ui.sincronizando_con_la_nube', 'Guardando cambios automáticamente...'));
            cloudBtn.setAttribute('aria-label', t('ui.guardando', 'Guardando cambios...'));
          } else {
            cloudBtn.setAttribute('data-tooltip', t('ui.cambios_guardados_en_la_nube', 'Cambios guardados'));
            cloudBtn.setAttribute('aria-label', t('collaborative.footer_status_saved', 'Documento guardado'));
          }
        }
      }
    }

    if (footerStatus) {
      if (this.isLocalOnly) {
        footerStatus.textContent =
          status === 'saving' ? t('collaborative.saving_local', 'Guardando...') :
          status === 'saved' ? t('collaborative.local_mode_badge', 'Local') :
          t('ui.error_de_sincronizacion', 'Error');
      } else {
        footerStatus.textContent =
          status === 'saving' ? t('ui.guardando', 'Guardando...') :
          status === 'saved' ? t('collaborative.footer_status_saved', 'Guardado') :
          t('ui.error_de_sincronizacion', 'Error de sincronización');
      }
    }
  }

  private scheduleAutoSave(delayMs = 350): void {
    if (this.isAiLocked || !this.docId || !this.canEditDoc) return;
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

    if (this.isAiLocked || !this.docId || !this.canEditDoc) return;
    if (this.isAutoSaving) {
      this.hasPendingSave = true;
      return;
    }

    this.isAutoSaving = true;
    this.hasPendingSave = false;
    this.setSaveStatus('saving');



    const payload = {
      content: this.getContentPayload(),
      id: this.docId,
      title: this.docTitle,
    };

    if (this.isLocalOnly) {
      try {
        saveLocalDraft(this.docId, {
          content: payload.content,
          id: this.docId,
          title: this.docTitle,
        });
        this.writeLocalWal();
        this.lastSavedTimestamp = Date.now();
        this.isModified = false;
        this.setSaveStatus('saved');
      } catch {
        this.setSaveStatus('error');
      } finally {
        this.isAutoSaving = false;
        if (this.hasPendingSave) {
          this.scheduleAutoSave(200);
        }
      }
      return;
    }

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
      input.readOnly = this.isAiLocked || this.editorMode === 'view';
      input.addEventListener('input', () => {
        if (this.isAiLocked) return;
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
      const isDocAiLocked = this.isAiLocked;

      actions.innerHTML = `
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${(isFirst || isDocAiLocked) ? ' is-disabled' : ''}" data-ref="btn-page-up-${p}" data-page-action="up" data-page-index="${p}" data-tooltip="Subir página" aria-label="Subir página"${(isFirst || isDocAiLocked) ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#expand_less"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${(isLast || isDocAiLocked) ? ' is-disabled' : ''}" data-ref="btn-page-down-${p}" data-page-action="down" data-page-index="${p}" data-tooltip="Bajar página" aria-label="Bajar página"${(isLast || isDocAiLocked) ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${isDocAiLocked ? ' is-disabled' : ''}" data-ref="btn-page-lock-${p}" data-page-action="lock" data-page-index="${p}" data-tooltip="Bloquear u ocultar página" aria-label="Bloquear página"${isDocAiLocked ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${this.lockedPages.has(p) ? 'lock' : 'visibility_off'}"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${isDocAiLocked ? ' is-disabled' : ''}" data-ref="btn-page-dup-${p}" data-page-action="dup" data-page-index="${p}" data-tooltip="Duplicar página" aria-label="Duplicar página"${isDocAiLocked ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${(isOnlyOne || isDocAiLocked) ? ' is-disabled' : ''}" data-ref="btn-page-del-${p}" data-page-action="del" data-page-index="${p}" data-tooltip="Eliminar página" aria-label="Eliminar página"${(isOnlyOne || isDocAiLocked) ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${isDocAiLocked ? ' is-disabled' : ''}" data-ref="btn-page-rotate-${p}" data-page-action="rotate" data-page-index="${p}" data-tooltip="Rotar orientación" aria-label="Rotar orientación"${isDocAiLocked ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#swap_horiz"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${isDocAiLocked ? ' is-disabled' : ''}" data-ref="btn-page-resize-${p}" data-page-action="resize" data-page-index="${p}" data-tooltip="Tamaño de página" aria-label="Tamaño de página"${isDocAiLocked ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28 collaborative-page-action-btn${isDocAiLocked ? ' is-disabled' : ''}" data-ref="btn-page-add-${p}" data-page-action="add" data-page-index="${p}" data-tooltip="Añadir página" aria-label="Añadir página"${isDocAiLocked ? ' disabled' : ''}>
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

      const elementsContainer = document.createElement('div');
      elementsContainer.className = 'collaborative-page-elements';
      elementsContainer.setAttribute('data-ref', `page-elements-${p}`);

      const pageElements = this.elements.filter((el) => (el.pageIndex ?? 0) === p);
      for (const el of pageElements) {
        if (el.type === 'text') {
          elementsContainer.appendChild(this.createTextElement(el));
        } else if (el.type === 'shape') {
          if (el.shapeType === 'line' || el.shapeType === 'line-flexible' || el.shapeType === 'line-multiconnect') {
            svg.appendChild(this.createLineSvgElement(el));
          } else {
            elementsContainer.appendChild(this.createShapeElement(el));
          }
        } else if (el.type === 'image') {
          elementsContainer.appendChild(this.createImageElement(el));
        } else if (el.type === 'table') {
          elementsContainer.appendChild(this.createTableElement(el));
        } else if (el.type === 'chart') {
          elementsContainer.appendChild(this.createChartElement(el));
        }
      }
      sheet.appendChild(elementsContainer);

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
        if (this.isAiLocked || this.editorMode === 'view') return;
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
          if (this.isAiLocked) return;
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
          if (this.isAiLocked) return;
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
      <button type="button" class="component-button component-button--ghost collaborative-add-page-btn${this.isAiLocked ? ' is-disabled' : ''}" data-ref="btn-add-page-bottom"${this.isAiLocked ? ' disabled' : ''}>
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
        if (this.isAiLocked) {
          showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
          return;
        }
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
      if (this.isAiLocked || this.editorMode === 'view') return;
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
      if (this.isAiLocked || !isDrawing || this.activeTool !== 'draw') return;
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
      ctx.globalAlpha = (this.drawMode === 'highlighter' ? 0.35 : 1.0) * this.drawOpacity;
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
      if (!this.isAiLocked && this.activeTool === 'draw' && this.drawMode !== 'eraser' && currentStroke.length >= 2) {
        const newDrawing: ElementDrawing = {
          color: this.drawColor,
          id: `draw_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
          opacity: (this.drawMode === 'highlighter' ? 0.35 : 1.0) * this.drawOpacity,
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
        if (this.isAiLocked) return;
        el.text = bodyEl.innerText;
        this.setModified(true);
        this.broadcastElementUpdate(el);
        if (this.selectedElementId === el.id) {
          this.updateTransformBoxPosition();
        }
      });

      bodyEl.addEventListener('blur', () => {
        bodyEl.contentEditable = 'false';
        div.classList.remove('is-editing');
        if (this.isAiLocked) return;
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
        if (this.isAiLocked || this.editorMode === 'view') return;
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
        if (this.isAiLocked) return;
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
        if (this.isAiLocked || this.editorMode === 'view') return;
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
        if (this.isAiLocked) return;
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
      if (this.isAiLocked || this.editorMode === 'view') return;
      this.selectElement(el.id);
      this.openChartInspector(el, 'data');
    });

    this.makeDraggable(div, el);
    return div;
  }

  private openChartInspector(el?: ElementChart, tab: 'customize' | 'data' = 'data'): void {
    this.ensureDrawerMounted();
    const inspector = this.queryPanel<HTMLElement>('[data-ref="panel-section-chart-inspector"]');
    if (!inspector) return;

    this.activePanelTab = 'elements';
    if (this.drawer) {
      this.drawer.classList.add('is-open');
    }

    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');
    if (collabCenter) {
      const btns = collabCenter.querySelectorAll<HTMLElement>('[data-panel-tab]:not([data-panel-tab="tools"])');
      btns.forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-panel-tab') === 'elements');
      });
    }

    const backBtn = this.queryPanel<HTMLElement>('[data-ref="btn-drawer-back"]');
    if (backBtn) {
      hideElement(backBtn);
    }

    const iconEl = this.drawer?.querySelector<SVGElement>('[data-ref="drawer-header-icon"]');
    if (iconEl) {
      const useEl = iconEl.querySelector('use');
      if (useEl) {
        useEl.setAttribute('href', '/icons.svg#category');
      }
    }

    const titleEl = this.queryPanel<HTMLElement>('[data-ref="side-panel-title"]');
    if (titleEl) titleEl.textContent = t('collaborative.elements');

    const sections = this.queryPanelAll<HTMLElement>('.collaborative-panel-section');
    sections.forEach((sec) => hideElement(sec));
    showElement(inspector);

    const targetEl = el || (this.selectedElementId ? (this.elements.find((e) => e.id === this.selectedElementId && e.type === 'chart') as ElementChart) : undefined);
    if (targetEl) {
      this.syncChartInspector(targetEl);
      this.switchChartInspectorTab(tab);
      this.switchChartAxisTab('xaxis');
    }
    if (this.drawer) {
      renderIcons(this.drawer);
    }
  }

  private switchChartInspectorTab(tab: 'customize' | 'data'): void {
    switchChartInspectorTab(tab, (ref) => this.queryPanel(ref));
  }

  private switchChartAxisTab(axis: 'xaxis' | 'yaxis'): void {
    switchChartAxisTab(axis, (ref) => this.queryPanel(ref));
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
        if (this.isAiLocked || this.editorMode === 'view') return;
        this.selectElement(el.id);
        if (!cellEl.isContentEditable) {
          div.classList.add('is-editing');
          cellEl.classList.add('is-editing');
          cellEl.contentEditable = 'true';
          cellEl.focus();
        }
      });

      cellEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (this.isAiLocked || this.editorMode === 'view' || cellEl.isContentEditable) return;
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
        if (this.isAiLocked) return;
        cellData.text = cellEl.innerText;
        this.setModified(true);
        this.broadcastElementUpdate(el);
        if (this.selectedElementId === el.id) {
          this.updateTransformBoxPosition();
        }
      });

      cellEl.addEventListener('blur', () => {
        cellEl.contentEditable = 'false';
        cellEl.classList.remove('is-editing');
        div.classList.remove('is-editing');
        if (this.isAiLocked) return;
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
        if (this.isAiLocked || this.editorMode === 'view') return;
        e.stopPropagation();
        e.preventDefault();
        divider.classList.add('is-dragging');
        const startY = e.clientY;
        const startHeight = el.rowHeights[r] || 40;

        const onPointerMove = (ev: PointerEvent) => {
          if (this.isAiLocked) return;
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
          if (this.isAiLocked) return;
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

  private addImageElement(asset: UploadedAsset, dims?: { height: number; width: number }): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (this.editorMode === 'view') return;
    const id = `img_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const pageIdx = this.selectedPageIndex !== null ? this.selectedPageIndex : this.activePageIndex;
    const pageDim = this.getPageDimensions(pageIdx);
    const width = dims?.width || 280;
    const height = dims?.height || 200;
    const offsetX = (this.elements.length % 5) * 20;
    const offsetY = (this.elements.length % 5) * 20;
    const x = dims
      ? Math.max(20, Math.min(pageDim.width - width - 20, Math.round((pageDim.width - width) / 2) + offsetX))
      : 140 + offsetX;
    const y = dims
      ? Math.max(20, Math.min(pageDim.height - height - 20, Math.round((pageDim.height - height) / 2) + offsetY))
      : 180 + offsetY;

    const newImg: ElementImage = {
      height,
      id,
      name: asset.name,
      pageIndex: pageIdx,
      rotation: 0,
      type: 'image',
      url: asset.url,
      width,
      x,
      y,
    };

    this.pushElement(newImg);
    this.renderPages();
    this.selectElement(id);
    this.activateSelectTool();
    this.setModified(true);
  }

  private measureImageDimensions(src: string): Promise<{ height: number; width: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || 280;
        let h = img.naturalHeight || 200;
        const maxW = 340;
        const maxH = 340;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        resolve({
          height: Math.max(40, h),
          width: Math.max(40, w),
        });
      };
      img.onerror = () => {
        resolve({ height: 200, width: 280 });
      };
      img.src = src;
    });
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
    let hasMoved = false;
    const initialPositions = new Map<string, { x: number; y: number }>();
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');

    const updatePosition = (clientX: number, clientY: number) => {
      if (this.isAiLocked || this.activeTool !== 'select') return;
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
      if (this.isAiLocked || this.activeTool !== 'select') return;
      if (!hasMoved) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
        hasMoved = true;
        document.body.classList.add('is-dragging-element');
      }
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
      if (this.isAiLocked || !hasMoved) return;

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
      if (this.isAiLocked || this.editorMode === 'view') return;
      if (element.classList.contains('is-editing')) return;
      const target = e.target as HTMLElement;
      if (target?.isContentEditable || target?.closest('.collaborative-table-row-divider') || target?.closest('.is-editing')) return;
      if (e.button !== 0) return;
      hasMoved = false;
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
      if (this.isAiLocked || this.activeTool !== 'select') return;
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
      if (this.isAiLocked) return;

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
      if (this.isAiLocked || this.editorMode === 'view') return;
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
    if ((this.isAiLocked || this.editorMode === 'view') && id !== null) {
      return;
    }
    this.selectedElementId = id;
    this.selectedPageIndex = null;
    this.selectedGuideId = null;
    this.rulerGuidesCtrl?.sync(undefined, null);
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
    if (this.isAiLocked && pageIndex !== null) {
      return;
    }
    this.selectedElementId = null;
    this.removeTransformBox();
    this.selectedPageIndex = pageIndex;
    this.selectedGuideId = null;
    this.rulerGuidesCtrl?.sync(undefined, null);

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
      if (this.isAiLocked || this.editorMode === 'view') return;
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
        if (this.isAiLocked) return;
        ev.preventDefault();
        lastClientX = ev.clientX;
        lastClientY = ev.clientY;
        updateMultiDrag(ev.clientX, ev.clientY);
      };

      const onScroll = () => {
        if (this.isAiLocked) return;
        updateMultiDrag(lastClientX, lastClientY);
      };

      const onMouseUp = () => {
        document.body.classList.remove('is-dragging-element');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        workspace?.removeEventListener('scroll', onScroll);
        if (this.isAiLocked) return;
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
    if (elNode) {
      const renderedW = elNode.offsetWidth;
      const renderedH = elNode.offsetHeight;
      if (renderedW > 0 && Math.abs((el.width || 0) - renderedW) > 1) {
        el.width = renderedW;
      }
      if (renderedH > 0 && Math.abs((el.height || 0) - renderedH) > 1) {
        el.height = renderedH;
      }
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
        if (this.isAiLocked || this.editorMode === 'view') return;
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
      if (this.isAiLocked) return;
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
      if (this.isAiLocked) return;
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
      if (this.isAiLocked) return;
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
        const minW = el.type === 'text' && el.isStickyNote ? 80 : (el.type === 'table' ? 60 : 10);
        const minH = el.type === 'text' && el.isStickyNote ? 50 : (el.type === 'table' ? 40 : 10);

        if (handleType === 'se') {
          el.x = initialX;
          el.y = initialY;
          el.width = Math.max(minW, initialW + dx);
          el.height = Math.max(minH, initialH + dy);
        } else if (handleType === 'ne') {
          const nextH = Math.max(minH, initialH - dy);
          el.x = initialX;
          el.y = (initialY + initialH) - nextH;
          el.width = Math.max(minW, initialW + dx);
          el.height = nextH;
        } else if (handleType === 'sw') {
          const nextW = Math.max(minW, initialW - dx);
          el.x = (initialX + initialW) - nextW;
          el.y = initialY;
          el.width = nextW;
          el.height = Math.max(minH, initialH + dy);
        } else if (handleType === 'nw') {
          const nextW = Math.max(minW, initialW - dx);
          const nextH = Math.max(minH, initialH - dy);
          el.x = (initialX + initialW) - nextW;
          el.y = (initialY + initialH) - nextH;
          el.width = nextW;
          el.height = nextH;
        } else if (handleType === 'e') {
          el.x = initialX;
          el.width = Math.max(minW, initialW + dx);
        } else if (handleType === 'w') {
          const nextW = Math.max(minW, initialW - dx);
          el.x = (initialX + initialW) - nextW;
          el.width = nextW;
        } else if (handleType === 's') {
          el.y = initialY;
          el.height = Math.max(minH, initialH + dy);
        } else if (handleType === 'n') {
          const nextH = Math.max(minH, initialH - dy);
          el.y = (initialY + initialH) - nextH;
          el.height = nextH;
        }

        elNode.style.width = `${el.width}px`;
        elNode.style.height = `${el.height}px`;
        const renderedW = elNode.offsetWidth;
        const renderedH = elNode.offsetHeight;
        if (renderedW > (el.width ?? 0)) {
          el.width = renderedW;
          if (handleType === 'w' || handleType === 'sw' || handleType === 'nw') {
            el.x = (initialX + initialW) - renderedW;
          }
        }
        if (renderedH > (el.height ?? 0)) {
          el.height = renderedH;
          if (handleType === 'n' || handleType === 'ne' || handleType === 'nw') {
            el.y = (initialY + initialH) - renderedH;
          }
        }
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
      if (this.isAiLocked) return;
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
    return applySmartGuides(
      item,
      rawX,
      rawY,
      this.elements,
      this.getPageDimensions(item.pageIndex ?? 0),
      this.container,
      this.showRulersAndGuides ? this.manualGuides : [],
      this.pageSizes
    );
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
    renderActiveSmartGuides(
      pageIndex,
      x,
      y,
      width,
      height,
      otherElements,
      this.getPageDimensions(pageIndex),
      this.container,
      this.showRulersAndGuides ? this.manualGuides : [],
      this.pageSizes
    );
  }

  private clearSmartGuides(pageIndex?: number): void {
    clearSmartGuides(this.container, pageIndex);
  }

  private recordHistory(): void {
    if (this.isApplyingHistory) return;
    const snapshot = JSON.stringify({
      elements: this.elements,
      guides: this.manualGuides,
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (this.undoStack.length <= 1) return;
    const currentState = this.undoStack.pop()!;
    this.redoStack.push(currentState);
    const previousState = this.undoStack[this.undoStack.length - 1];
    this.applyHistoryState(previousState);
    this.updateUndoRedoButtons();
  }

  private redo(): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
      this.manualGuides = Array.isArray(parsed.guides) ? parsed.guides : [];
      if (typeof parsed.pageCount === 'number') this.pageCount = parsed.pageCount;
      if (Array.isArray(parsed.pageSizes)) this.pageSizes = parsed.pageSizes;
      if (Array.isArray(parsed.pageBackgrounds)) this.pageBackgrounds = parsed.pageBackgrounds;

      this.selectedElementId = null;
      this.selectedElementIds.clear();
      this.selectedGuideId = null;
      this.removeTransformBox();
      this.renderPages();
      this.updateContextToolbar();
      this.rulerGuidesCtrl?.sync(this.manualGuides, null);
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
      btnUndo.disabled = this.isAiLocked || this.undoStack.length <= 1;
    }
    if (btnRedo) {
      btnRedo.disabled = this.isAiLocked || this.redoStack.length === 0;
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
          if (el.fillColor === 'transparent') {
            previewFill.style.backgroundImage = 'none';
            previewFill.style.backgroundColor = 'transparent';
            previewFill.classList.add('is-transparent');
          } else if (el.fillColor?.startsWith('linear-gradient')) {
            previewFill.style.backgroundImage = el.fillColor;
            previewFill.style.backgroundColor = 'transparent';
            previewFill.classList.remove('is-transparent');
          } else {
            previewFill.style.backgroundImage = 'none';
            previewFill.style.backgroundColor = el.fillColor || '#000000';
            previewFill.classList.remove('is-transparent');
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
        if (btnBorderWidth) btnBorderWidth.setAttribute('data-tooltip', t('ui.grosor_de_borde_px'));

        const btnSpacing = toolbar.querySelector<HTMLElement>('[data-ref="btn-table-spacing"]');
        if (btnSpacing) btnSpacing.setAttribute('data-tooltip', t('ui.espaciado_de_celdas_px'));

        const btnPadding = toolbar.querySelector<HTMLElement>('[data-ref="btn-table-padding"]');
        if (btnPadding) btnPadding.setAttribute('data-tooltip', t('ui.relleno_de_celdas_px'));
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
    } else if (this.selectedGuideId) {
      const targetGuideId = this.selectedGuideId;
      this.manualGuides = this.manualGuides.filter((g) => g.id !== targetGuideId);
      this.selectedGuideId = null;
      this.rulerGuidesCtrl?.sync(this.manualGuides, null);
      this.setModified(true);
      this.recordHistory();
      this.broadcastDocSync();
      void this.flushAutoSave();
    } else if (this.selectedPageIndex !== null) {
      this.deletePage(this.selectedPageIndex);
    }
  }

  private duplicateSelected(): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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

  private async processPastedImageFile(file: File): Promise<void> {
    if (currentUser && !this.isLocalOnly) {
      const formData = new FormData();
      formData.append('file', file);
      if (this.docId) {
        formData.append('docId', this.docId);
      }
      try {
        const res = await postFormApi(API_ROUTES.collaborativeDocs.upload, formData);
        if (res.ok) {
          const data = await res.json();
          const uploaded = data.file || (data.files && data.files[0]);
          if (uploaded && uploaded.url) {
            const dims = await this.measureImageDimensions(uploaded.url);
            this.addImageElement({
              id: uploaded.id || `pasted_${Date.now()}`,
              name: uploaded.name || file.name || 'image',
              size: uploaded.size || file.size || 0,
              type: 'image',
              url: uploaded.url,
            }, dims);
            void this.loadUploadedAssets();
            showToast(t('collaborative.image_pasted'), 'info');
          }
        } else {
          if (res.status === 401) {
            showToast(t('collaborative.login_required_upload'), 'danger');
          } else if (res.status === 413) {
            showToast(t('collaborative.storage_quota_exceeded'), 'danger');
          } else {
            showToast(t('collaborative.upload_failed'), 'danger');
          }
        }
      } catch {
        showToast(t('collaborative.upload_failed'), 'danger');
      }
    } else {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const dims = await this.measureImageDimensions(dataUrl);
        this.addImageElement({
          id: `pasted_${Date.now()}`,
          name: file.name || 'image',
          size: file.size || 0,
          type: 'image',
          url: dataUrl,
        }, dims);
        showToast(t('collaborative.image_pasted_local'), 'info');
      } catch {
        showToast(t('collaborative.upload_failed'), 'danger');
      }
    }
  }

  private async pasteFromClipboard(overrideText?: string, overrideFiles?: FileList | File[] | null): Promise<void> {
    if (this.isAiLocked || this.editorMode === 'view') {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
          await this.processPastedImageFile(file);
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

    if (text === undefined && !files && navigator.clipboard && 'read' in navigator.clipboard) {
      try {
        const clipItems = await navigator.clipboard.read();
        for (const item of clipItems) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const file = new File([blob], `pasted_image_${Date.now()}.${imgType.split('/')[1] || 'png'}`, { type: imgType });
            await this.processPastedImageFile(file);
            return;
          }
        }
      } catch {}
    }

    if (text === undefined && navigator.clipboard?.readText) {
      try {
        text = await navigator.clipboard.readText();
      } catch {
        showToast(t('toasts.para_pegar_contenido_externo_usa_el_ataj'), 'info');
        return;
      }
    }

    if (text && (text.startsWith('http://') || text.startsWith('https://')) && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(text.trim())) {
      const imgUrl = text.trim();
      const dims = await this.measureImageDimensions(imgUrl);
      this.addImageElement({
        id: `pasted_${Date.now()}`,
        name: 'image',
        size: 0,
        type: 'image',
        url: imgUrl,
      }, dims);
      showToast(t('collaborative.image_pasted_local'), 'info');
      return;
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
      showToast(t('toasts.texto_pegado'), 'info');
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
          <div class="collaborative-font-weights-menu">
            ${f.weights.map((w) => {
              const isAct = w === curWeight;
              const label = WEIGHT_LABELS[w] || `${w}`;
              return `<button type="button" class="menu-item collaborative-weight-pill${isAct ? ' is-active' : ''}" data-font-family="${f.family}" data-weight="${w}">
                <span class="menu-item__text" style="font-family: '${f.family}', sans-serif; font-weight: ${w};">${label}</span>
                ${isAct ? '<svg class="component-icon menu-item__check" aria-hidden="true"><use href="/icons.svg#check"></use></svg>' : ''}
              </button>`;
            }).join('')}
            ${f.hasItalic ? `
              <button type="button" class="menu-item collaborative-weight-pill${isItalic ? ' is-active' : ''}" data-font-family="${f.family}" data-action="toggle-italic">
                <span class="menu-item__text" style="font-family: '${f.family}', sans-serif; font-style: italic;">Cursiva</span>
                ${isItalic ? '<svg class="component-icon menu-item__check" aria-hidden="true"><use href="/icons.svg#check"></use></svg>' : ''}
              </button>
            ` : ''}
          </div>
        </div>
      ` : '';

      return `
        <div class="collaborative-font-card${isSelected ? ' is-selected' : ''}${isExpanded ? ' is-expanded' : ''}" data-ref="font-card-${f.family.replace(/\s+/g, '-')}" data-font-family="${f.family}">
          <button type="button" class="menu-item collaborative-font-card__header" data-ref="font-item-${f.family.replace(/\s+/g, '-')}" data-font-family="${f.family}">
            <span class="menu-item__text" style="font-family: '${f.family}', sans-serif;">${f.family}</span>
            <svg class="component-icon collaborative-font-card__chevron menu-item__arrow" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
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

    const iconUse = this.drawer?.querySelector<SVGElement>('[data-ref="drawer-header-icon"]')?.querySelector('use');
    if (iconUse) {
      iconUse.setAttribute('href', '/icons.svg#palette');
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

    const btnTransparent = this.queryPanel<HTMLElement>('[data-ref="btn-color-transparent"]');
    if (btnTransparent) {
      if (target === 'shape-fill') {
        btnTransparent.classList.remove('is-hidden');
      } else {
        btnTransparent.classList.add('is-hidden');
      }
    }

    this.highlightActiveColorSwatch();
    if (this.drawer) {
      renderIcons(this.drawer);
    }
  }

  private applyColorToCurrentTarget(color: string): void {
    if (this.isAiLocked || !this.currentColorTarget) return;


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
          if (color === 'transparent') {
            preview.style.backgroundImage = 'none';
            preview.style.backgroundColor = 'transparent';
            preview.classList.add('is-transparent');
          } else if (color.startsWith('linear-gradient')) {
            preview.style.backgroundImage = color;
            preview.style.backgroundColor = 'transparent';
            preview.classList.remove('is-transparent');
          } else {
            preview.style.backgroundImage = 'none';
            preview.style.backgroundColor = color;
            preview.classList.remove('is-transparent');
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

    const normalizeColor = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedActive = normalizeColor(activeColor);
    const swatches = this.queryPanelAll<HTMLButtonElement>('[data-ref="swatch-color"]');
    swatches.forEach((sw) => {
      const color = sw.getAttribute('data-color');
      sw.classList.toggle('is-active', !!color && normalizeColor(color) === normalizedActive);
    });

    const btnTransparent = this.queryPanel<HTMLButtonElement>('[data-ref="btn-color-transparent"]');
    if (btnTransparent) {
      btnTransparent.classList.toggle('is-active', normalizedActive === 'transparent');
    }
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
      if (this.isAiLocked) {
        showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
        return;
      }
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

    const btnMenuFileDesktop = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-file-desktop"]');
    btnMenuFileDesktop?.addEventListener('click', () => {
      this.fileDropdownCtrl?.close();
      if (this.docId) {
        window.location.href = `boardpdf://d/${encodeURIComponent(this.docId)}`;
      }
    }, { signal });

    const btnMenuFileDelete = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-file-delete"]');
    btnMenuFileDelete?.addEventListener('click', () => {
      this.fileDropdownCtrl?.close();
      this.confirmDeleteDocument();
    }, { signal });

    this.rulerGuidesCtrl?.destroy();
    this.rulerGuidesCtrl = initRulerGuidesInteraction({
      canEdit: () => !this.isAiLocked && this.editorMode !== 'view' && this.canEditDoc,
      container: this.container,
      getActivePageIndex: () => this.activePageIndex,
      getGuides: () => this.manualGuides,
      getPageDimensions: (pageIndex) => this.getPageDimensions(pageIndex),
      getSelectedGuideId: () => this.selectedGuideId,
      getShowRulers: () => this.showRulersAndGuides,
      getZoom: () => this.zoomLevel,
      onChange: (nextGuides, selectedId, commit) => {
        this.manualGuides = nextGuides;
        this.selectedGuideId = selectedId;
        if (selectedId) {
          this.selectedElementId = null;
          this.selectedElementIds.clear();
          this.selectedPageIndex = null;
          this.container.querySelectorAll('.collaborative-page-sheet').forEach((s) => s.classList.remove('is-page-selected'));
          this.removeTransformBox();
          this.updateSelection();
          this.updateContextToolbar();
        }
        this.rulerGuidesCtrl?.sync(this.manualGuides, this.selectedGuideId);
        if (commit) {
          this.setModified(true);
          this.recordHistory();
          this.broadcastDocSync();
          void this.flushAutoSave();
        }
      },
      onSelect: (selectedId) => {
        if (selectedId) {
          const activeEl = document.activeElement as HTMLElement | null;
          if (activeEl && this.container.contains(activeEl) && typeof activeEl.blur === 'function') {
            activeEl.blur();
          }
          this.selectedElementId = null;
          this.selectedElementIds.clear();
          this.selectedPageIndex = null;
          this.container.querySelectorAll('.collaborative-page-sheet').forEach((s) => s.classList.remove('is-page-selected'));
          this.removeTransformBox();
          this.updateSelection();
          this.updateContextToolbar();
        }
        this.selectedGuideId = selectedId;
        this.rulerGuidesCtrl?.sync(this.manualGuides, this.selectedGuideId);
      },
    });
    this.rulerGuidesCtrl.setPassthrough(this.activeTool !== 'select');

    window.addEventListener('resize', () => {
      if (this.showRulersAndGuides) {
        this.updateRulers();
      }
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
      if (this.isAiLocked) {
        titleInput.value = this.docTitle;
        return;
      }
      this.docTitle = titleInput.value.trim() || 'Documento sin título';
      this.setModified(true);
      wsService.send({ title: this.docTitle, type: 'titleChange' });
    }, { signal });

    const btnAiGenerate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-ai-generate"]');
    btnAiGenerate?.addEventListener('click', () => {
      this.handleOpenAiGenerateModal();
    }, { signal });

    const cloudBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cloud-status"]');
    cloudBtn?.addEventListener('click', () => {
      if (this.isLocalOnly) {
        showToast(t('collaborative.local_saved_toast', 'Documento guardado localmente en este dispositivo.'), 'info');
      }
    }, { signal });

    const shareBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-link"]');
    shareBtn?.addEventListener('click', () => {
      if (this.isAiLocked) {
        showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
        return;
      }
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
      if (this.isAiLocked) return;
      this.writeLocalWal();
      if (this.isLocalOnly) {
        saveLocalDraft(this.docId, {
          content: this.getContentPayload(),
          id: this.docId,
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
      if (!this.isAiLocked && document.visibilityState === 'hidden' && (this.hasPendingSave || this.autoSaveTimer)) {
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
        if (this.isAiLocked) {
          showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
          return;
        }
        const tool = btn.getAttribute('data-tool') as any;
        toolbarButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        this.activeTool = tool;
        this.rulerGuidesCtrl?.setPassthrough(tool !== 'select');

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
        if (this.isAiLocked) {
          showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
          return;
        }
        drawButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.drawMode = (btn.getAttribute('data-draw-mode') as any) || 'pen';
      }, { signal });
    });

    const btnDrawColor = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-draw-color"]');
    btnDrawColor?.addEventListener('click', () => {
      if (this.isAiLocked) {
        showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
        return;
      }
      this.openColorMenu('draw-color');
    }, { signal });

    const btnDrawThickness = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-draw-thickness"]');
    const dotThickness = this.container.querySelector<HTMLElement>('[data-ref="dot-thickness"]');
    const popoverDrawThickness = this.container.querySelector<HTMLElement>('[data-ref="popover-draw-thickness"]');
    const sliderDrawThickness = this.container.querySelector<HTMLInputElement>('[data-ref="slider-draw-thickness"]');
    const inputDrawThickness = this.container.querySelector<HTMLInputElement>('[data-ref="input-draw-thickness"]');
    const sliderDrawOpacity = this.container.querySelector<HTMLInputElement>('[data-ref="slider-draw-opacity"]');
    const inputDrawOpacity = this.container.querySelector<HTMLInputElement>('[data-ref="input-draw-opacity"]');

    const updateDrawThicknessUI = () => {
      if (sliderDrawThickness) sliderDrawThickness.value = `${this.drawThickness}`;
      if (inputDrawThickness) inputDrawThickness.value = `${this.drawThickness}`;
      if (sliderDrawOpacity) sliderDrawOpacity.value = `${Math.round(this.drawOpacity * 100)}`;
      if (inputDrawOpacity) inputDrawOpacity.value = `${Math.round(this.drawOpacity * 100)}`;
      if (dotThickness) {
        const sz = Math.min(18, Math.max(4, this.drawThickness * 1.5));
        dotThickness.style.width = `${sz}px`;
        dotThickness.style.height = `${sz}px`;
        dotThickness.style.opacity = `${this.drawOpacity}`;
      }
    };

    btnDrawThickness?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isAiLocked) return;
      if (popoverDrawThickness) {
        popoverDrawThickness.classList.toggle('is-hidden');
        if (!popoverDrawThickness.classList.contains('is-hidden')) {
          updateDrawThicknessUI();
        }
      }
    }, { signal });

    sliderDrawThickness?.addEventListener('input', () => {
      this.drawThickness = Math.max(1, parseInt(sliderDrawThickness.value, 10) || 2);
      if (inputDrawThickness) inputDrawThickness.value = `${this.drawThickness}`;
      updateDrawThicknessUI();
    }, { signal });

    inputDrawThickness?.addEventListener('input', () => {
      this.drawThickness = Math.max(1, Math.min(100, parseInt(inputDrawThickness.value, 10) || 2));
      if (sliderDrawThickness) sliderDrawThickness.value = `${this.drawThickness}`;
      updateDrawThicknessUI();
    }, { signal });

    sliderDrawOpacity?.addEventListener('input', () => {
      const val = Math.max(0, Math.min(100, parseInt(sliderDrawOpacity.value, 10) || 100));
      this.drawOpacity = val / 100;
      if (inputDrawOpacity) inputDrawOpacity.value = `${val}`;
      updateDrawThicknessUI();
    }, { signal });

    inputDrawOpacity?.addEventListener('input', () => {
      const val = Math.max(0, Math.min(100, parseInt(inputDrawOpacity.value, 10) || 100));
      this.drawOpacity = val / 100;
      if (sliderDrawOpacity) sliderDrawOpacity.value = `${val}`;
      updateDrawThicknessUI();
    }, { signal });

    window.addEventListener('pointerdown', (e) => {
      if (popoverDrawThickness && !popoverDrawThickness.classList.contains('is-hidden')) {
        if (!popoverDrawThickness.contains(e.target as Node) && !btnDrawThickness?.contains(e.target as Node)) {
          popoverDrawThickness.classList.add('is-hidden');
        }
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
        if (this.showRulersAndGuides) {
          this.updateRulers();
        }
        if (this.isLayersPanelOpen) {
          this.renderLayersList();
        }
        this.dispatcher.dispatch({
          pageIndex: el.pageIndex,
          payload: { fontSize: el.fontSize, height: el.height, id: el.id, width: el.width },
          type: 'ELEMENT_STYLE_UPDATE',
        });
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
        if (this.showRulersAndGuides) {
          this.updateRulers();
        }
        if (this.isLayersPanelOpen) {
          this.renderLayersList();
        }
        this.dispatcher.dispatch({
          pageIndex: el.pageIndex,
          payload: { fontSize: el.fontSize, height: el.height, id: el.id, width: el.width },
          type: 'ELEMENT_STYLE_UPDATE',
        });
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
      showToast(t('toasts.opciones_de_configuracion_avanzada_de_te'), 'info');
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
        showAuthGateModal({ featureKey: 'ai_bg_remove', returnUrl: window.location.pathname });
        return;
      }
      if (!hasSubscriptionFeature('pro')) {
        showToast(t('toasts.la_eliminacion_de_fondos_con_ia_es_exclu'), 'warning');
        navigate('/precios');
        return;
      }
      if (!this.selectedElementId) return;
      const el = this.elements.find((e) => e.id === this.selectedElementId);
      if (!el || el.type !== 'image' || !el.url) {
        showToast(t('toasts.selecciona_una_imagen_valida'), 'warning');
        return;
      }

      await withButtonLoading(btnImageRemoveBg, async () => {
        try {
          const res = await postApi(API_ROUTES.collaborativeDocs.removeBackground, { imageUrl: el.url });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.success) {
            showToast(data?.error || t('ui.no_se_pudo_eliminar_el_fondo_de_la_image'), 'error');
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
          showToast(t('toasts.fondo_eliminado_exitosamente_con_ia'), 'success');
        } catch {
          showToast(t('toasts.error_de_conexion_al_eliminar_el_fondo'), 'error');
        }
      });
    }, { signal });

    const btnImageCrop = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-image-crop"]');
    btnImageCrop?.addEventListener('click', () => {
      showToast(t('toasts.herramienta_de_recorte_proximamente_disp'), 'info');
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

      if (this.isAiLocked || this.editorMode === 'view') {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
          const blockedKey = e.key.toLowerCase();
          if (blockedKey === 'z' || blockedKey === 'y' || blockedKey === 'v' || blockedKey === 'x' || blockedKey === 'd') {
            e.preventDefault();
            return;
          }
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
          if (key === 'd') {
            e.preventDefault();
            this.duplicateSelected();
            return;
          }
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isEditing) return;
        if (this.selectedElementId || this.selectedElementIds.size > 0 || this.selectedPageIndex !== null || this.selectedGuideId) {
          e.preventDefault();
          this.deleteSelectedElement();
        }
      }
    }, { signal });

    window.addEventListener('dragover', (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
      }
    }, { signal });

    window.addEventListener('drop', (e: DragEvent) => {
      if (this.isAiLocked || this.editorMode === 'view') return;
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const imgFiles: File[] = [];
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith('image/')) {
            imgFiles.push(files[i]);
          }
        }
        if (imgFiles.length > 0) {
          e.preventDefault();
          void this.pasteFromClipboard(undefined, imgFiles);
        }
      }
    }, { signal });

    window.addEventListener('paste', (e: ClipboardEvent) => {
      if (this.isAiLocked || this.editorMode === 'view') return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isEditing = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;
      if (isEditing) return;

      const filesList: File[] = [];
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          const f = e.clipboardData.files[i];
          if (f.type.startsWith('image/')) filesList.push(f);
        }
      }
      if (filesList.length === 0 && e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const f = item.getAsFile();
            if (f) filesList.push(f);
          }
        }
      }

      if (filesList.length > 0) {
        e.preventDefault();
        void this.pasteFromClipboard(undefined, filesList);
        return;
      }

      const html = e.clipboardData?.getData('text/html');
      if (html && html.includes('<img')) {
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) {
          const imgSrc = match[1];
          if (imgSrc.startsWith('data:image/')) {
            e.preventDefault();
            void (async () => {
              try {
                const res = await fetch(imgSrc);
                const blob = await res.blob();
                const file = new File([blob], `pasted_image_${Date.now()}.png`, { type: blob.type || 'image/png' });
                await this.processPastedImageFile(file);
              } catch {
                void this.pasteFromClipboard(imgSrc);
              }
            })();
            return;
          }
        }
      }

      const text = e.clipboardData?.getData('text/plain');
      e.preventDefault();
      void this.pasteFromClipboard(text, null);
    }, { signal });

    const workspace = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
    workspace?.addEventListener('click', (e) => {
      if (this.isAiLocked) return;
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
        this.setZoom(this.zoomLevel + delta, { clientX: e.clientX, clientY: e.clientY });
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

    const tableActions = [
      'copy', 'paste', 'duplicate', 'delete-table',
      'add-row', 'delete-row', 'move-row-up', 'move-row-down', 'fit-row',
      'add-col', 'delete-col', 'move-col-left', 'move-col-right', 'fit-col',
    ];
    for (const act of tableActions) {
      const btn = this.container.querySelector<HTMLButtonElement>(`[data-ref="ctx-table-${act}"]`);
      btn?.addEventListener('click', () => {
        this.handleTableAction(act);
        this.closeContextMenu();
      }, { signal });
    }

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
          showToast(t('toasts.pagina_elementos_copiada'), 'info');
        } else {
          showToast(t('toasts.pagina_copiada'), 'info');
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

  private setZoom(level: number, anchor?: { clientX: number; clientY: number }): void {
    const oldZoom = this.zoomLevel || 1.0;
    const clamped = Math.max(0.10, Math.min(3.0, Math.round(level * 100) / 100));
    if (Math.abs(clamped - oldZoom) < 0.001) return;

    const workspace = this.container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
    let pivotX = 0;
    let pivotY = 0;
    let scrollAnchorX = 0;
    let scrollAnchorY = 0;

    if (workspace) {
      if (anchor) {
        const rect = workspace.getBoundingClientRect();
        scrollAnchorX = anchor.clientX - rect.left;
        scrollAnchorY = anchor.clientY - rect.top;
      } else {
        scrollAnchorX = workspace.clientWidth / 2;
        scrollAnchorY = workspace.clientHeight / 2;
      }
      pivotX = (workspace.scrollLeft + scrollAnchorX) / oldZoom;
      pivotY = (workspace.scrollTop + scrollAnchorY) / oldZoom;
    }

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

    if (workspace) {
      workspace.scrollLeft = Math.max(0, Math.round(pivotX * this.zoomLevel - scrollAnchorX));
      workspace.scrollTop = Math.max(0, Math.round(pivotY * this.zoomLevel - scrollAnchorY));
    }

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
    const btnUpload = this.queryPanel<HTMLElement>('[data-ref="btn-upload-file"]');
    const tabs = this.queryPanel<HTMLElement>('[data-ref="upload-tabs"]');
    if (!grid) return;

    if (!currentUser) {
      if (btnUpload) showElement(btnUpload);
      if (tabs) hideElement(tabs);
      if (emptyState) showElement(emptyState);
      grid.innerHTML = '';
      return;
    }

    if (btnUpload) showElement(btnUpload);
    if (tabs) showElement(tabs);

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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
          showToast(t('toasts.se_han_importado_las_paginas_como_conten'), 'success');
        } else if (editableCount > 0) {
          showToast(t('toasts.se_importaron_paginas_editables_y_como_i'), 'success');
        } else {
          showToast(t('toasts.se_han_aplicado_las_paginas_como_imagen_'), 'info');
        }
      } catch {
        showToast(t('toasts.error_al_importar_las_paginas_del_pdf'), 'error');
      }
    });
  }

  private async handleApplySinglePdfPage(asset: UploadedAsset, pageNum: number): Promise<void> {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
        showToast(t('toasts.pagina_importada_como_contenido_editable'), 'success');
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
        showToast(t('toasts.pagina_aplicada_como_imagen_de_fondo_doc'), 'info');
      }
    } catch {
      showToast(t('toasts.error_al_procesar_la_pagina_del_pdf'), 'error');
    }
  }

  private pushElement(el: EditorElement, broadcast = true): void {
    this.dispatcher.dispatch({
      pageIndex: el.pageIndex,
      payload: el,
      type: 'ELEMENT_ADD',
    }, { skipBroadcast: !broadcast });
  }

  private broadcastElementUpdate(el: EditorElement): void {
    this.dispatcher.dispatch({
      pageIndex: el.pageIndex,
      payload: el,
      type: 'ELEMENT_UPDATE',
    }, { skipHistory: true });
  }

  private broadcastElementDelete(id: string, pageIndex: number): void {
    this.dispatcher.dispatch({
      pageIndex,
      payload: { id },
      type: 'ELEMENT_DELETE',
    }, { skipHistory: true });
  }

  private broadcastDocSync(): void {
    if (this.isCollabRoomFull) return;
    wsService.send({
      elements: this.elements,
      guides: this.manualGuides,
      pageBackgrounds: this.pageBackgrounds,
      pageCount: this.pageCount,
      pageSize: this.docDefaultPageSize,
      pageSizes: this.pageSizes,
      pageTitles: this.pageTitles,
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
        showToast(t('toasts.se_unio_al_diseno'), 'info');
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
        if (Array.isArray(msg.guides)) {
          this.manualGuides = msg.guides;
          if (this.selectedGuideId && !this.manualGuides.some((g) => g.id === this.selectedGuideId)) {
            this.selectedGuideId = null;
          }
        }
        if (Array.isArray(msg.pageBackgrounds)) this.pageBackgrounds = msg.pageBackgrounds;
        if (typeof msg.pageCount === 'number') this.pageCount = msg.pageCount;
        if (Array.isArray(msg.pageSizes)) this.pageSizes = msg.pageSizes;
        if (Array.isArray(msg.pageTitles)) this.pageTitles = msg.pageTitles;
        if (msg.pageSize) this.docDefaultPageSize = msg.pageSize;
        if (typeof msg.title === 'string') {
          this.docTitle = msg.title;
          const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
          if (titleInput && document.activeElement !== titleInput) titleInput.value = msg.title;
        }
        this.renderPages();
        this.updateFooterPageInfo();
      }
    } else if (msg.type === 'titleChange') {
      if (msg.senderClientId !== this.myClientId && typeof msg.title === 'string') {
        this.docTitle = msg.title;
        const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
        if (titleInput && document.activeElement !== titleInput) {
          titleInput.value = msg.title;
        }
      }
    } else if (msg.type === 'aiLock') {
      if (msg.locked) {
        if (!this.isLocalAiGenerating) {
          this.setAiLock(true, typeof msg.lockedBy === 'string' ? msg.lockedBy : undefined);
        }
      } else if (!this.isLocalAiGenerating) {
        this.setAiLock(false);
      }
    } else if (msg.type === 'roomFull') {
      this.isCollabRoomFull = true;
      showToast(msg.message || t('ui.la_sala_colaborativa_ha_alcanzado_el_lim'), 'warning');
      this.renderPresenceList();
    } else if (msg.type === 'rateLimited') {
      showToast(msg.message || t('ui.demasiadas_acciones_por_segundo_por_favo'), 'warning');
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
    } else if (action === 'update' || action === 'align') {
      const idx = this.elements.findIndex((e) => e.id === element.id);
      if (idx >= 0) {
        this.elements[idx] = { ...this.elements[idx], ...element };
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
    const handle = this.sharePopoverHandle;
    this.sharePopoverHandle = null;
    if (handle) {
      handle.cleanup();
    }
    this.findMatches = [];
    this.findCurrentIndex = -1;
  }

  private getShareFindStatusText(): string {
    if (!this.findSearchTerm) {
      return '';
    }
    if (this.findMatches.length === 0) {
      return t('collaborative.find_no_results');
    }
    return t('collaborative.find_status_count', {
      current: String(this.findCurrentIndex + 1),
      total: String(this.findMatches.length),
    });
  }

  private getShareFindState(): CollabShareFindState {
    return {
      canReplace: !this.isAiLocked && this.editorMode !== 'view' && this.canEditDoc,
      hasMatches: this.findMatches.length > 0,
      matchCase: this.findMatchCase,
      replaceTerm: this.findReplaceTerm,
      searchTerm: this.findSearchTerm,
      statusText: this.getShareFindStatusText(),
    };
  }

  private syncShareFindState(): void {
    this.sharePopoverHandle?.syncFindState(this.getShareFindState());
  }

  private closeFilePopover(): void {
    const handle = this.filePopoverHandle;
    this.filePopoverHandle = null;
    if (handle) {
      if (handle.getActiveView() === 'guides' && this.currentGuidesPreset !== this.committedGuidesPreset) {
        this.currentGuidesPreset = this.committedGuidesPreset;
        this.renderPages();
      }
      handle.cleanup();
    }
  }

  private syncFileRulersState(): void {
    this.filePopoverHandle?.syncState({
      committedGuidesPreset: this.committedGuidesPreset,
      currentGuidesPreset: this.currentGuidesPreset,
      customGuideCols: this.customGuideCols,
      customGuideRows: this.customGuideRows,
    });
  }

  private openGuidesModal(): void {
    this.closeSharePopover();
    this.editDropdownCtrl?.close();
    this.fileDropdownCtrl?.close();

    if (!this.currentGuidesPreset) {
      this.currentGuidesPreset = '12-col';
    }
    if (!this.showRulersAndGuides) {
      this.showRulersAndGuides = true;
      this.updateRulersUI();
    }
    this.renderPages();

    if (this.filePopoverHandle) {
      this.filePopoverHandle.openView('guides');
      this.syncFileRulersState();
      return;
    }

    const handle = createCollabFilePopover({
      committedGuidesPreset: this.committedGuidesPreset,
      currentGuidesPreset: this.currentGuidesPreset,
      customGuideCols: this.customGuideCols,
      customGuideRows: this.customGuideRows,
      initialView: 'guides',
      onCancelGuidesPreview: () => {
        if (this.currentGuidesPreset !== this.committedGuidesPreset) {
          this.currentGuidesPreset = this.committedGuidesPreset;
          this.renderPages();
        }
        this.syncFileRulersState();
      },
      onClearGuidesPreset: () => {
        this.currentGuidesPreset = null;
        this.committedGuidesPreset = null;
        this.renderPages();
        this.syncFileRulersState();
      },
      onClose: () => {
        this.filePopoverHandle = null;
      },
      onConfirmGuides: () => {
        const hadPreset = this.currentGuidesPreset !== null;
        this.committedGuidesPreset = this.currentGuidesPreset;
        this.renderPages();
        this.syncFileRulersState();
        if (hadPreset) {
          showToast(t('toasts.guias_agregadas_al_documento'), 'success');
        }
      },
      onCustomGridChange: (cols, rows) => {
        this.customGuideCols = Math.max(1, Math.min(24, cols));
        this.customGuideRows = Math.max(1, Math.min(24, rows));
        if (this.currentGuidesPreset === 'custom') {
          this.renderPages();
        }
        this.syncFileRulersState();
      },
      onSelectGuidesPreset: (preset: Exclude<CollabFileGuidesPreset, null>) => {
        this.currentGuidesPreset = preset;
        if (!this.showRulersAndGuides) {
          this.showRulersAndGuides = true;
          this.updateRulersUI();
        }
        this.renderPages();
        this.syncFileRulersState();
      },
    });

    this.filePopoverHandle = handle;
  }

  private openShareModal(initialView: 'download' | 'find-replace' | 'main' = 'main'): void {
    if (initialView === 'main' && this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    const effectiveInitialView: 'download' | 'find-replace' | 'main' =
      (!currentUser || this.isLocalOnly) && initialView === 'main' ? 'download' : initialView;

    this.closeFilePopover();
    this.fileDropdownCtrl?.close();
    this.editDropdownCtrl?.close();

    if (this.sharePopoverHandle) {
      if (this.sharePopoverHandle.getActiveView() === effectiveInitialView) {
        this.closeSharePopover();
        return;
      }
      this.sharePopoverHandle.openView(effectiveInitialView);
      if (effectiveInitialView === 'find-replace') {
        this.syncShareFindState();
      }
      return;
    }

    const handle = createCollabSharePopover({
      activePageIndex: this.activePageIndex,
      customSlug: this.docCustomSlug,
      docAccessLevel: this.docAccessLevel,
      docId: this.docId,
      docMembers: this.docMembers,
      docTitle: this.docTitle,
      findReplace: {
        ...this.getShareFindState(),
        onMatchCaseChange: (matchCase) => {
          this.findMatchCase = matchCase;
          this.executeSearch();
        },
        onNext: () => {
          this.findNext();
        },
        onPrev: () => {
          this.findPrev();
        },
        onReplaceAll: () => {
          this.replaceAll();
        },
        onReplaceOne: () => {
          this.replaceCurrent();
        },
        onReplaceTermChange: (term) => {
          this.findReplaceTerm = term;
        },
        onSearchTermChange: (term) => {
          this.findSearchTerm = term;
          this.executeSearch();
        },
      },
      getContent: () => this.getContentPayload(),
      initialView: effectiveInitialView,
      isDocOwner: this.isDocOwner,
      isLocalOnly: this.isLocalOnly,
      onAccessLevelChange: (level) => {
        this.docAccessLevel = level;
      },
      onClose: () => {
        this.sharePopoverHandle = null;
        this.findMatches = [];
        this.findCurrentIndex = -1;
      },
      onCustomSlugChange: (slug) => {
        this.docCustomSlug = slug;
      },
      onFindOpen: () => {
        this.executeSearch();
      },
      onMembersChange: (members) => {
        this.docMembers = members;
      },
      onTeamAccessChange: (access) => {
        this.docTeamAccess = access;
      },
      pageCount: this.pageCount,
      selectedPageIndex: this.selectedPageIndex,
      teamAccess: this.docTeamAccess,
      teamId: this.docTeamId,
    });

    this.sharePopoverHandle = handle;
  }

  private openLocalAuthModal(): void {
    navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  }

  private async createDocumentCopy(): Promise<void> {
    if (this.isLocalOnly) {
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc_${Date.now().toString(36)}`;
      const copyTitle = `${this.docTitle} (Copia)`;
      const content = this.getContentPayload();
      saveLocalDraft(newId, { content, id: newId, title: copyTitle });
      showToast(t('toasts.copia_creada_en_una_nueva_pestana'), 'success');
      window.open(`/d/${encodeURIComponent(newId)}`, '_blank');
      return;
    }
    if (!currentUser) {
      showToast(t('collaborative.login_required_duplicate'), 'warning');
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc_${Date.now().toString(36)}`;
    const copyTitle = `${this.docTitle} (Copia)`;
    const content = this.getContentPayload();

    try {
      const res = await postApi(API_ROUTES.collaborativeDocs.base, {
        content,
        id: newId,
        title: copyTitle,
      });
      if (res.ok) {
        window.open(`/d/${newId}`, '_blank');
        showToast(t('toasts.copia_creada_en_una_nueva_pestana'), 'success');
      } else {
        showToast(t('ui.no_se_pudo_duplicar_el_documento_en_la_n'), 'danger');
      }
    } catch {
      showToast(t('errors.network_error'), 'danger');
    }
  }

  private downloadPdf(): void {
    this.openShareModal('download');
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
      this.selectedGuideId = null;
      rulersWrapper?.classList.add('is-hidden');
      checkRulers?.classList.add('is-hidden');
      this.rulerGuidesCtrl?.sync(this.manualGuides, null);
    }
  }

  private updateRulers(): void {
    updateRulers(this.container, this.showRulersAndGuides, this.zoomLevel, this.activePageIndex);
    this.rulerGuidesCtrl?.sync(this.manualGuides, this.selectedGuideId);
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

  private renderPersistentGuidesSvg(pageIndex: number, width: number, height: number): SVGElement {
    return renderPersistentGuidesSvg(pageIndex, width, height, this.currentGuidesPreset, this.customGuideCols, this.customGuideRows);
  }

  private openFindReplace(): void {
    this.openShareModal('find-replace');
  }

  private closeFindReplace(): void {
    if (this.sharePopoverHandle?.getActiveView() === 'find-replace') {
      this.closeSharePopover();
    } else {
      this.findMatches = [];
      this.findCurrentIndex = -1;
    }
  }

  private executeSearch(): void {
    const query = this.findSearchTerm;
    if (!query) {
      this.findMatches = [];
      this.findCurrentIndex = -1;
      this.syncShareFindState();
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
      this.syncShareFindState();
    }
  }

  private highlightCurrentMatch(): void {
    if (this.findCurrentIndex < 0 || this.findCurrentIndex >= this.findMatches.length) {
      this.syncShareFindState();
      return;
    }
    const match = this.findMatches[this.findCurrentIndex];
    this.syncShareFindState();

    if (this.editorMode !== 'view' && !this.isAiLocked && this.canEditDoc) {
      this.selectElement(match.elementId);
    }

    const targetNode =
      this.container.querySelector<HTMLElement>(`[data-element-id="${match.elementId}"]`) ||
      this.container.querySelector<HTMLElement>(`[data-ref="page-sheet-${match.pageIndex}"]`);
    targetNode?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (this.editorMode === 'view' || !this.canEditDoc) {
      showToast(t('toasts.read_only_no_replace'), 'warning');
      return;
    }
    if (this.findCurrentIndex < 0 || this.findCurrentIndex >= this.findMatches.length) return;
    const match = this.findMatches[this.findCurrentIndex];

    const replaced = replaceCurrentMatch(this.elements, match, this.findSearchTerm, this.findReplaceTerm, this.findMatchCase);
    if (!replaced) return;

    this.renderPages();
    const updatedEl = this.elements.find((e) => e.id === match.elementId);
    if (updatedEl) {
      this.broadcastElementUpdate(updatedEl);
    }
    this.recordHistory();
    this.setModified(true);
    void this.flushAutoSave();
    showToast(t('collaborative.find_replaced_one'), 'success');
    this.executeSearch();
  }

  private replaceAll(): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (this.editorMode === 'view' || !this.canEditDoc) {
      showToast(t('toasts.no_se_puede_reemplazar_en_modo_solo_lect'), 'warning');
      return;
    }
    if (this.findMatches.length === 0) return;

    const count = replaceAllMatches(this.elements, this.findSearchTerm, this.findReplaceTerm, this.findMatchCase);
    if (count <= 0) return;

    this.renderPages();
    this.broadcastDocSync();
    this.recordHistory();
    this.setModified(true);
    void this.flushAutoSave();
    this.executeSearch();
    showToast(t('collaborative.find_replaced_all', { count: String(count) }), 'success');
  }

  private confirmDeleteDocument(): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    openDeleteDocModal({
      docTitle: this.docTitle,
      onConfirm: async () => {
        if (this.isAiLocked) {
          showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
          return true;
        }
        if (!currentUser || !this.isDocOwner) {
          showToast(t('ui.solo_el_creador_del_documento_puede_eliminarlo') || 'Solo el creador del documento puede eliminarlo', 'danger');
          return true;
        }
        try {
          const res = await deleteApi(API_ROUTES.collaborativeDocs.byId(this.docId));
          if (res.ok) {
            showToast(t('toasts.doc_deleted_correctly'), 'info');
            navigate('/projects');
          } else if (res.status === 423) {
            showToast(t('collaborative.ai_doc_locked_error'), 'warning');
          } else {
            showToast(t('ui.no_se_pudo_eliminar_el_documento'), 'danger');
          }
        } catch {
          showToast(t('errors.network_error') || 'Error de red al eliminar documento', 'danger');
        }
        return true;
      },
    });
  }

  private setEditorMode(mode: 'edit' | 'view'): void {
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
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
      const layoutNav = document.querySelector<HTMLElement>('.layout-nav');
      const layoutContent = document.querySelector<HTMLElement>('.layout-content');
      if (layoutNav) layoutNav.style.display = 'none';
      if (layoutContent) layoutContent.style.paddingLeft = '6px';
      if (txtTopEdit) txtTopEdit.textContent = 'Ver';
      iconTopEdit?.setAttribute('href', '/icons.svg#visibility');
      checkEdit?.classList.add('is-hidden');
      checkView?.classList.remove('is-hidden');
      btnModeEdit?.classList.remove('is-active');
      btnModeView?.classList.add('is-active');
      if (titleInput) titleInput.readOnly = true;
      this.selectedElementId = null;
      this.selectedElementIds.clear();
      this.selectedGuideId = null;
      this.closeSubtoolbars();
      this.updateSelection();
      this.renderTransformBox();
      this.rulerGuidesCtrl?.sync(this.manualGuides, null);
      showToast(t('toasts.read_only_mode_enabled'), 'info');
    } else {
      this.container.classList.remove('collaborative-mode-view');
      const layoutNav = document.querySelector<HTMLElement>('.layout-nav');
      const layoutContent = document.querySelector<HTMLElement>('.layout-content');
      if (layoutNav) layoutNav.style.display = '';
      if (layoutContent) layoutContent.style.paddingLeft = '';
      if (txtTopEdit) txtTopEdit.textContent = 'Editar';
      iconTopEdit?.setAttribute('href', '/icons.svg#edit');
      checkEdit?.classList.remove('is-hidden');
      checkView?.classList.add('is-hidden');
      btnModeEdit?.classList.add('is-active');
      btnModeView?.classList.remove('is-active');
      if (titleInput) titleInput.readOnly = this.isAiLocked;
      this.updateUndoRedoButtons();
      showToast(t('toasts.modo_de_edicion_activado'), 'info');
    }
    this.syncShareFindState();
  }

  private handleTableAction(action: string): void {
    if (this.isAiLocked || this.editorMode === 'view') return;
    if (!this.contextMenuTargetTableId) return;
    const tableEl = this.elements.find((e): e is ElementTable => e.id === this.contextMenuTargetTableId && e.type === 'table');
    if (!tableEl) return;
    if (!tableEl.colWidths || tableEl.colWidths.length !== tableEl.cols) {
      tableEl.colWidths = Array.from({ length: tableEl.cols }, () => Math.round(tableEl.width / tableEl.cols));
    }
    const r = Math.max(0, Math.min(tableEl.rows - 1, this.contextMenuTargetRowIndex));
    const c = Math.max(0, Math.min(tableEl.cols - 1, this.contextMenuTargetColIndex));
    switch (action) {
      case 'copy': {
        this.selectElement(tableEl.id);
        this.copySelectedElements();
        break;
      }
      case 'paste': {
        void this.pasteFromClipboard();
        break;
      }
      case 'duplicate': {
        const dup = JSON.parse(JSON.stringify(tableEl)) as ElementTable;
        dup.id = `table_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        dup.x += 24;
        dup.y += 24;
        this.pushElement(dup);
        this.renderPages();
        this.selectElement(dup.id);
        this.setModified(true);
        this.recordHistory();
        void this.flushAutoSave();
        break;
      }
      case 'delete-table': {
        this.elements = this.elements.filter((e) => e.id !== tableEl.id);
        this.selectedElementId = null;
        this.selectedElementIds.clear();
        this.removeTransformBox();
        this.renderPages();
        this.setModified(true);
        this.recordHistory();
        this.broadcastElementDelete(tableEl.id, tableEl.pageIndex ?? 0);
        void this.flushAutoSave();
        break;
      }
      case 'add-row': {
        const newRow: ElementTableCell[] = Array.from({ length: tableEl.cols }, () => ({ text: '' }));
        tableEl.cells.splice(r + 1, 0, newRow);
        tableEl.rowHeights.splice(r + 1, 0, 40);
        tableEl.rows++;
        tableEl.height = tableEl.rowHeights.reduce((a, b) => a + b, 0) + (tableEl.rows + 1) * tableEl.cellSpacing;
        this.renderPages();
        this.selectElement(tableEl.id);
        this.setModified(true);
        this.recordHistory();
        this.broadcastElementUpdate(tableEl);
        void this.flushAutoSave();
        break;
      }
      case 'delete-row': {
        if (tableEl.rows <= 1) {
          showToast(t('collaborative.table_min_rows_warning') || 'La tabla debe tener al menos una fila', 'warning');
          return;
        }
        tableEl.cells.splice(r, 1);
        tableEl.rowHeights.splice(r, 1);
        tableEl.rows--;
        tableEl.height = tableEl.rowHeights.reduce((a, b) => a + b, 0) + (tableEl.rows + 1) * tableEl.cellSpacing;
        this.renderPages();
        this.selectElement(tableEl.id);
        this.setModified(true);
        this.recordHistory();
        this.broadcastElementUpdate(tableEl);
        void this.flushAutoSave();
        break;
      }
      case 'move-row-up': {
        if (r > 0) {
          const tempCells = tableEl.cells[r];
          tableEl.cells[r] = tableEl.cells[r - 1];
          tableEl.cells[r - 1] = tempCells;
          const tempH = tableEl.rowHeights[r];
          tableEl.rowHeights[r] = tableEl.rowHeights[r - 1];
          tableEl.rowHeights[r - 1] = tempH;
          this.contextMenuTargetRowIndex = r - 1;
          this.renderPages();
          this.selectElement(tableEl.id);
          this.setModified(true);
          this.recordHistory();
          this.broadcastElementUpdate(tableEl);
          void this.flushAutoSave();
        }
        break;
      }
      case 'move-row-down': {
        if (r < tableEl.rows - 1) {
          const tempCells = tableEl.cells[r];
          tableEl.cells[r] = tableEl.cells[r + 1];
          tableEl.cells[r + 1] = tempCells;
          const tempH = tableEl.rowHeights[r];
          tableEl.rowHeights[r] = tableEl.rowHeights[r + 1];
          tableEl.rowHeights[r + 1] = tempH;
          this.contextMenuTargetRowIndex = r + 1;
          this.renderPages();
          this.selectElement(tableEl.id);
          this.setModified(true);
          this.recordHistory();
          this.broadcastElementUpdate(tableEl);
          void this.flushAutoSave();
        }
        break;
      }
      case 'fit-row': {
        const domTable = this.container.querySelector<HTMLElement>(`[data-element-id="${tableEl.id}"]`);
        const trs = domTable?.querySelectorAll<HTMLTableRowElement>('tr');
        if (trs && trs[r]) {
          tableEl.rowHeights[r] = Math.max(32, trs[r].offsetHeight);
          tableEl.height = tableEl.rowHeights.reduce((a, b) => a + b, 0) + (tableEl.rows + 1) * tableEl.cellSpacing;
          this.renderPages();
          this.selectElement(tableEl.id);
          this.setModified(true);
          this.recordHistory();
          this.broadcastElementUpdate(tableEl);
          void this.flushAutoSave();
        }
        break;
      }
      case 'add-col': {
        const colWidths = tableEl.colWidths;
        tableEl.cells.forEach((row) => row.splice(c + 1, 0, { text: '' }));
        const defaultW = Math.round(tableEl.width / (tableEl.cols + 1));
        colWidths.splice(c + 1, 0, defaultW);
        tableEl.cols++;
        tableEl.width = colWidths.reduce((a: number, b: number) => a + b, 0) + (tableEl.cols + 1) * tableEl.cellSpacing;
        this.renderPages();
        this.selectElement(tableEl.id);
        this.setModified(true);
        this.recordHistory();
        this.broadcastElementUpdate(tableEl);
        void this.flushAutoSave();
        break;
      }
      case 'delete-col': {
        if (tableEl.cols <= 1) {
          showToast(t('collaborative.table_min_cols_warning') || 'La tabla debe tener al menos una columna', 'warning');
          return;
        }
        const colWidths = tableEl.colWidths;
        tableEl.cells.forEach((row) => row.splice(c, 1));
        colWidths.splice(c, 1);
        tableEl.cols--;
        tableEl.width = colWidths.reduce((a: number, b: number) => a + b, 0) + (tableEl.cols + 1) * tableEl.cellSpacing;
        this.renderPages();
        this.selectElement(tableEl.id);
        this.setModified(true);
        this.recordHistory();
        this.broadcastElementUpdate(tableEl);
        void this.flushAutoSave();
        break;
      }
      case 'move-col-left': {
        const colWidths = tableEl.colWidths;
        if (c > 0) {
          tableEl.cells.forEach((row) => {
            const tempCell = row[c];
            row[c] = row[c - 1];
            row[c - 1] = tempCell;
          });
          const tempW = colWidths[c];
          colWidths[c] = colWidths[c - 1];
          colWidths[c - 1] = tempW;
          this.contextMenuTargetColIndex = c - 1;
          this.renderPages();
          this.selectElement(tableEl.id);
          this.setModified(true);
          this.recordHistory();
          this.broadcastElementUpdate(tableEl);
          void this.flushAutoSave();
        }
        break;
      }
      case 'move-col-right': {
        const colWidths = tableEl.colWidths;
        if (c < tableEl.cols - 1) {
          tableEl.cells.forEach((row) => {
            const tempCell = row[c];
            row[c] = row[c + 1];
            row[c + 1] = tempCell;
          });
          const tempW = colWidths[c];
          colWidths[c] = colWidths[c + 1];
          colWidths[c + 1] = tempW;
          this.contextMenuTargetColIndex = c + 1;
          this.renderPages();
          this.selectElement(tableEl.id);
          this.setModified(true);
          this.recordHistory();
          this.broadcastElementUpdate(tableEl);
          void this.flushAutoSave();
        }
        break;
      }
      case 'fit-col': {
        const colWidths = tableEl.colWidths;
        const maxLen = Math.max(...tableEl.cells.map((row) => (row[c]?.text || '').length), 4);
        colWidths[c] = Math.max(50, Math.min(300, maxLen * 10 + 24));
        tableEl.width = colWidths.reduce((a: number, b: number) => a + b, 0) + (tableEl.cols + 1) * tableEl.cellSpacing;
        this.renderPages();
        this.selectElement(tableEl.id);
        this.setModified(true);
        this.recordHistory();
        this.broadcastElementUpdate(tableEl);
        void this.flushAutoSave();
        break;
      }
    }
  }

  private handleContextMenu(e: MouseEvent): void {
    if (this.isAiLocked || this.editorMode === 'view') {
      return;
    }
    const target = e.target as HTMLElement | SVGElement | null;
    if (!target) return;

    const elementNode = target.closest<HTMLElement | SVGElement>('[data-element-id]');
    const pageSheet = target.closest<HTMLElement>('.collaborative-page-sheet, .collaborative-page-wrapper');
    const targetCell = target.closest<HTMLTableCellElement>('.collaborative-table-cell');
    const tableElemNode = target.closest<HTMLElement>('.collaborative-table-item');

    const ctxElemSection = this.container.querySelector<HTMLElement>('[data-ref="ctx-section-element"]');
    const ctxPageSection = this.container.querySelector<HTMLElement>('[data-ref="ctx-section-page"]');
    const ctxTableSection = this.container.querySelector<HTMLElement>('[data-ref="ctx-section-table"]');
    const contextMenu = this.container.querySelector<HTMLElement>('[data-ref="collab-context-menu"]');

    if (!contextMenu || !ctxElemSection || !ctxPageSection) return;

    if (tableElemNode) {
      const tableId = tableElemNode.getAttribute('data-element-id');
      const tableEl = this.elements.find((el): el is ElementTable => el.id === tableId && el.type === 'table');
      if (tableEl) {
        e.preventDefault();
        this.contextMenuTargetTableId = tableEl.id;
        this.contextMenuTargetElementId = tableEl.id;
        this.contextMenuTargetPage = tableEl.pageIndex ?? 0;
        this.selectElement(tableEl.id);

        if (targetCell) {
          const rowEl = targetCell.closest('tr');
          const rowIdx = rowEl ? Array.from(rowEl.parentElement?.children || []).indexOf(rowEl) : 0;
          const actualRowIdx = rowEl?.parentElement?.tagName.toLowerCase() === 'tbody' ? rowIdx + 1 : rowIdx;
          const colIdx = Array.from(rowEl?.children || []).indexOf(targetCell);
          this.contextMenuTargetRowIndex = Math.max(0, actualRowIdx);
          this.contextMenuTargetColIndex = Math.max(0, colIdx);
        } else {
          this.contextMenuTargetRowIndex = 0;
          this.contextMenuTargetColIndex = 0;
        }

        ctxTableSection?.classList.remove('is-hidden');
        ctxElemSection?.classList.add('is-hidden');
        ctxPageSection?.classList.add('is-hidden');
        this.positionContextMenu(e.clientX, e.clientY);
        return;
      }
    }

    if (elementNode) {
      const elementId = elementNode.getAttribute('data-element-id');
      if (!elementId) return;
      e.preventDefault();
      this.contextMenuTargetElementId = elementId;
      this.contextMenuTargetTableId = null;
      const targetElem = this.elements.find((el) => el.id === elementId);
      this.contextMenuTargetPage = targetElem?.pageIndex ?? 0;
      this.selectElement(elementId);

      ctxTableSection?.classList.add('is-hidden');
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
    this.container.querySelector('[data-ref="ctx-section-table"]')?.classList.add('is-hidden');
    const submenus = this.container.querySelectorAll<HTMLElement>('.collab-context-submenu');
    submenus.forEach((sub) => sub.classList.add('is-hidden'));
  }

  private moveElementLayer(elementId: string, direction: 'back' | 'backward' | 'forward' | 'front'): void {
    const success = this.dispatcher.dispatch({
      payload: { direction, elementId },
      type: 'ELEMENT_LAYER_MOVE',
    });
    if (success) {
      showToast(t('toasts.capa_actualizada'), 'info');
    }
  }

  private reorderElementLayer(draggedId: string, targetId: string): void {
    const success = this.dispatcher.dispatch({
      payload: { draggedId, targetId },
      type: 'ELEMENT_LAYER_REORDER',
    });
    if (success) {
      showToast(t('toasts.orden_de_capas_actualizado'), 'info');
    }
  }

  private alignElementToPage(elementId: string, alignment: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top'): void {
    const success = this.dispatcher.dispatch({
      payload: { alignment, elementId },
      type: 'ELEMENT_ALIGN',
    });
    if (success) {
      showToast(t('toasts.elemento_alineado'), 'info');
    }
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
    if (this.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    await this.flushAutoSave();
    showToast(t('collaborative.doc_saved_cloud'), 'success');
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
    addBtn.className = `collaborative-filmstrip-add-btn${this.isAiLocked ? ' is-disabled' : ''}`;
    addBtn.disabled = this.isAiLocked;
    addBtn.setAttribute('data-ref', 'btn-filmstrip-add');
    addBtn.setAttribute('aria-label', 'Añadir página');
    addBtn.innerHTML = '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>';
    addBtn.addEventListener('click', () => {
      if (this.isAiLocked) {
        showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
        return;
      }
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
    this.container.classList.toggle('has-grid-view', this.isGridViewOpen);

    if (!this.isGridViewOpen) {
      gridView?.classList.add('is-hidden');
      zoomWrapper?.classList.remove('is-hidden');
      return;
    }

    this.closeContextMenu();
    this.activeContextDropdowns.forEach((d) => d.close());
    gridView?.classList.remove('is-hidden');
    zoomWrapper?.classList.add('is-hidden');

    const grid = gridView?.querySelector<HTMLElement>('[data-ref="grid-view-grid"]');
    if (!grid) return;
    grid.innerHTML = '';

    const activeIdx = this.selectedPageIndex !== null ? this.selectedPageIndex : (this.activePageIndex ?? 0);

    for (let p = 0; p < this.pageCount; p++) {
      const item = document.createElement('div');
      item.className = 'collaborative-grid-item';

      const card = document.createElement('div');
      card.className = `collaborative-grid-card${p === activeIdx ? ' is-active' : ''}`;
      card.setAttribute('data-ref', `grid-card-${p}`);
      card.setAttribute('data-page-index', p.toString());

      const preview = document.createElement('div');
      preview.className = 'collaborative-grid-card__preview';

      const canvas = document.createElement('canvas');
      canvas.className = 'collaborative-grid-card__canvas';
      preview.appendChild(canvas);

      card.appendChild(preview);

      const num = document.createElement('span');
      num.className = 'collaborative-grid-card__num';
      num.textContent = (p + 1).toString();

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

      item.appendChild(card);
      item.appendChild(num);
      grid.appendChild(item);
      void this.renderPagePreviewToCanvas(p, canvas, 180);
    }

    const addItem = document.createElement('div');
    addItem.className = 'collaborative-grid-item';

    const addCard = document.createElement('button');
    addCard.type = 'button';
    addCard.className = `collaborative-grid-card collaborative-grid-card--add${this.isAiLocked ? ' is-disabled' : ''}`;
    addCard.disabled = this.isAiLocked;
    addCard.setAttribute('data-ref', 'btn-grid-add-page');
    addCard.innerHTML = `
      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
      <span>Añadir página</span>
    `;
    addCard.addEventListener('click', () => {
      if (this.isAiLocked) {
        showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
        return;
      }
      this.addPage();
      this.renderGridView();
    });
    addItem.appendChild(addCard);
    grid.appendChild(addItem);
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

  private setAiLock(locked: boolean, lockedBy?: string): void {
    this.isAiLocked = locked;
    this.aiLockedBy = locked ? (lockedBy?.trim() || null) : null;

    this.container.classList.toggle('is-ai-locked', locked);
    const banner = this.container.querySelector<HTMLElement>('[data-ref="collab-ai-lock-banner"]');
    const bannerText = this.container.querySelector<HTMLElement>('[data-ref="txt-ai-lock-message"]');
    const shield = this.container.querySelector<HTMLElement>('[data-ref="collab-ai-lock-shield"]');

    banner?.classList.toggle('is-hidden', !locked);
    shield?.classList.toggle('is-hidden', !locked);

    if (bannerText) {
      bannerText.textContent = locked
        ? (this.aiLockedBy
          ? t('collaborative.ai_lock_active_by', { name: this.aiLockedBy })
          : t('collaborative.ai_lock_active'))
        : '';
    }

    if (locked) {
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }
      if (this.autoSaveMaxWaitTimer) {
        clearTimeout(this.autoSaveMaxWaitTimer);
        this.autoSaveMaxWaitTimer = null;
      }

      this.closeContextMenu();
      this.closeSubtoolbars();
      this.closeSidePanel();
      this.closeSharePopover();
      this.closeFindReplace();
      this.fileDropdownCtrl?.close();
      this.closeFilePopover();
      this.editDropdownCtrl?.close();
      this.activeContextDropdowns.forEach((d) => d.close());

      const editingNodes = this.container.querySelectorAll<HTMLElement>('.is-editing, [contenteditable="true"]');
      editingNodes.forEach((node) => {
        node.classList.remove('is-editing');
        node.contentEditable = 'false';
      });

      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && this.container.contains(activeEl) && typeof activeEl.blur === 'function') {
        activeEl.blur();
      }

      this.selectedElementId = null;
      this.selectedElementIds.clear();
      this.selectedPageIndex = null;
      this.selectedGuideId = null;
      this.removeTransformBox();
      this.updateSelection();
      this.updateContextToolbar();
      this.rulerGuidesCtrl?.sync(this.manualGuides, null);

      if (!this.isLocalAiGenerating) {
        this.startAiLockPolling();
      }
    } else {
      this.stopAiLockPolling();
    }

    const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
    if (titleInput) {
      titleInput.readOnly = locked || this.editorMode === 'view';
    }

    const disableRefs = [
      'btn-top-ai-generate',
      'btn-top-edit',
      'btn-cloud-status',
      'btn-share-link',
      'btn-add-page-bottom',
      'btn-filmstrip-add',
      'btn-grid-add-page',
    ];
    for (const ref of disableRefs) {
      const btn = this.container.querySelector<HTMLButtonElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.disabled = locked;
        btn.classList.toggle('is-disabled', locked);
      }
    }

    const pageInputs = this.container.querySelectorAll<HTMLInputElement>('.collaborative-page-header__input');
    pageInputs.forEach((inp) => {
      inp.readOnly = locked || this.editorMode === 'view';
    });

    const pageActionBtns = this.container.querySelectorAll<HTMLButtonElement>('.collaborative-page-action-btn');
    pageActionBtns.forEach((btn) => {
      const action = btn.getAttribute('data-page-action');
      const pIdx = parseInt(btn.getAttribute('data-page-index') || '0', 10);
      const isNaturalDisabled =
        (action === 'up' && pIdx === 0) ||
        (action === 'down' && pIdx >= this.pageCount - 1) ||
        (action === 'del' && this.pageCount <= 1);
      const shouldDisable = locked || isNaturalDisabled;
      btn.disabled = shouldDisable;
      btn.classList.toggle('is-disabled', shouldDisable);
    });

    const collabCenter = document.querySelector<HTMLElement>('[data-ref="rail-center-collaborative"]');
    collabCenter?.querySelectorAll<HTMLButtonElement>('.rail-btn').forEach((btn) => {
      btn.disabled = locked;
      btn.classList.toggle('is-disabled', locked);
    });

    this.updateUndoRedoButtons();
  }

  private startAiLockPolling(): void {
    if (this.aiLockPollTimer || this.isDestroyed || this.isLocalOnly || !this.docId) return;
    this.aiLockPollTimer = setInterval(async () => {
      if (this.isDestroyed || !this.isAiLocked || this.isLocalAiGenerating) {
        this.stopAiLockPolling();
        return;
      }
      try {
        const res = await getApi(API_ROUTES.collaborativeDocs.byId(this.docId));
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data?.aiLock?.locked && this.isAiLocked && !this.isLocalAiGenerating && !this.isDestroyed) {
          if (data?.document?.content) {
            this.docTitle = data.document.title || this.docTitle;
            this.pageCount = Math.max(1, data.document.page_count || data.document.content.pageCount || 1);
            this.elements = Array.isArray(data.document.content.elements) ? data.document.content.elements : [];
            this.manualGuides = Array.isArray(data.document.content.guides) ? data.document.content.guides : [];
            this.pageTitles = Array.isArray(data.document.content.pageTitles) && data.document.content.pageTitles.length > 0
              ? data.document.content.pageTitles
              : Array(this.pageCount).fill('');
            this.pageBackgrounds = Array.isArray(data.document.content.pageBackgrounds) && data.document.content.pageBackgrounds.length > 0
              ? data.document.content.pageBackgrounds
              : Array(this.pageCount).fill('#ffffff');
            this.pagePdfSources = Array.isArray(data.document.content.pagePdfSources) && data.document.content.pagePdfSources.length > 0
              ? data.document.content.pagePdfSources
              : Array(this.pageCount).fill(null);
            this.initPageSizesFromContent(data.document.content);
            const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
            if (titleInput) titleInput.value = this.docTitle;
          }
          this.setAiLock(false);
          this.renderPages();
          this.updateFooterPageInfo();
        }
      } catch {}
    }, 3000);
  }

  private stopAiLockPolling(): void {
    if (this.aiLockPollTimer) {
      clearInterval(this.aiLockPollTimer);
      this.aiLockPollTimer = null;
    }
  }

  private handleOpenAiGenerateModal(): void {
    if (this.isAiLocked || this.isLocalAiGenerating) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (!currentUser) {
      showAuthGateModal({ featureKey: 'ai_designer', returnUrl: window.location.pathname });
      return;
    }
    if (!this.canEditDoc || this.editorMode === 'view') {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }

    const hasExistingContent = this.elements.length > 0 || this.pageCount > 1 || this.pagePdfSources.some(Boolean);

    openCollabAiGenerateModal({
      hasExistingContent,
      onSubmit: async ({ mode, prompt }) => {
        if (this.isAiLocked || this.isLocalAiGenerating) {
          showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
          return;
        }

        const requesterName = (currentUser?.username || '').trim();
        this.isLocalAiGenerating = true;
        this.setAiLock(true, requesterName || undefined);
        if (!this.isCollabRoomFull) {
          wsService.send({
            locked: true,
            lockedBy: requesterName || undefined,
            type: 'aiLock',
          });
        }

        let lockHandled = false;
        let keepRemoteLock = false;
        let remoteLockOwner: string | undefined;

        try {
          const res = await postApi(API_ROUTES.collaborativeDocs.aiGenerate(this.docId), {
            currentContent: this.getContentPayload(),
            currentTitle: this.docTitle,
            mode,
            prompt,
          });
          const data = await res.json().catch(() => null);

          if (!res.ok || !data?.success || !data?.document) {
            if (res.status === 401) {
              showToast(t('collaborative.ai_login_required'), 'warning');
            } else if (res.status === 402) {
              if (typeof data?.currentBalance === 'number') {
                updateUserAiTokens(data.currentBalance);
              }
              showToast(data?.error || t('collaborative.ai_insufficient_tokens'), 'warning');
            } else if (res.status === 423) {
              if (data?.aiLock?.locked) {
                keepRemoteLock = true;
                remoteLockOwner = typeof data.aiLock.lockedBy === 'string' ? data.aiLock.lockedBy : undefined;
              }
              showToast(t('collaborative.ai_doc_locked_error'), 'warning');
            } else {
              showToast(data?.error || t('collaborative.ai_generate_error'), 'error');
            }
            return;
          }

          const docContent = data.document.content || {};
          this.docTitle = data.document.title || this.docTitle;
          this.pageCount = Math.max(1, data.document.page_count || docContent.pageCount || 1);
          this.elements = Array.isArray(docContent.elements) ? docContent.elements : [];
          this.manualGuides = Array.isArray(docContent.guides) ? docContent.guides : [];
          this.pageBackgrounds = Array.isArray(docContent.pageBackgrounds) && docContent.pageBackgrounds.length > 0
            ? docContent.pageBackgrounds
            : Array(this.pageCount).fill('#ffffff');
          this.pagePdfSources = Array.isArray(docContent.pagePdfSources) && docContent.pagePdfSources.length > 0
            ? docContent.pagePdfSources
            : Array(this.pageCount).fill(null);
          this.pageTitles = Array.isArray(docContent.pageTitles) && docContent.pageTitles.length > 0
            ? docContent.pageTitles
            : Array(this.pageCount).fill('');
          this.initPageSizesFromContent(docContent);

          const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
          if (titleInput) {
            titleInput.value = this.docTitle;
          }

          if (typeof data?.aiTokens?.balance === 'number') {
            updateUserAiTokens(data.aiTokens.balance);
          }

          this.broadcastDocSync();
          this.isLocalAiGenerating = false;
          if (!this.isCollabRoomFull) {
            wsService.send({ locked: false, type: 'aiLock' });
          }
          this.setAiLock(false);
          lockHandled = true;

          this.renderPages();
          this.updateFooterPageInfo();
          this.recordHistory();
          this.writeLocalWal();
          this.isModified = false;
          this.hasPendingSave = false;
          this.setSaveStatus('saved');
          this.scrollToPage(0);

          const pagesGenerated = String(data?.generated?.generatedPageCount || this.pageCount);
          const tokensSpent = String(data?.aiTokens?.consumed || 0);
          showToast(t('collaborative.ai_generate_success', { pages: pagesGenerated, tokens: tokensSpent }), 'success');
        } catch {
          showToast(t('collaborative.ai_generate_error'), 'error');
        } finally {
          if (!lockHandled) {
            this.isLocalAiGenerating = false;
            if (!this.isCollabRoomFull) {
              wsService.send({ locked: false, type: 'aiLock' });
            }
            if (keepRemoteLock) {
              this.setAiLock(true, remoteLockOwner);
            } else {
              this.setAiLock(false);
            }
          }
        }
      },
    });
  }

}

async function createDesignPdfEditorView(docId?: string, query?: URLSearchParams): Promise<HTMLElement> {
  const container = await loadTemplate('/views/design-pdf/design-pdf-editor.html');
  const controller = new DesignPdfEditorController(container, docId, query);
  (container as any).__controller = controller;
  await controller.init();
  return container;
}

const createCollaborativePdfEditorView = createDesignPdfEditorView;
const CollaborativePdfEditorController = DesignPdfEditorController;

export {
  CollaborativePdfEditorController,
  DesignPdfEditorController,
  createCollaborativePdfEditorView,
  createDesignPdfEditorView,
};
