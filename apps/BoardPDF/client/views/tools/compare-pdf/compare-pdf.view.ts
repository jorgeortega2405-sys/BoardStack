import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { pickDropboxFiles } from '../../../services/dropbox.service.js';
import { pickGoogleDriveFiles } from '../../../services/google-drive.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument, loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupToolSidebarModal, showElement, toggleElement, withButtonLoading } from '../../../utils/dom.util.js';
import { ToolZoomController, applyPageScaler } from '../../../utils/tool-zoom.util.js';
import { ClientDiffItem, ClientPageComparison, ComparePdfResultData, CompareViewMode } from './compare-pdf.types.js';
import { t } from '../../../services/i18n.service.js';

class ComparePdfController implements ViewController {
  private abortController: AbortController | null = null;
  private comparisonResult: ComparePdfResultData | null = null;
  private container: HTMLElement;
  private currentFile1: File | null = null;
  private currentFile2: File | null = null;
  private currentMode: CompareViewMode = 'semantic';
  private isComparing = false;
  private isSyncingScroll = false;
  private overlayOpacity = 0.5;
  private pageDimensions1: Array<{ height: number; width: number }> = [];
  private pageDimensions2: Array<{ height: number; width: number }> = [];
  private pageScales1: number[] = [];
  private pageScales2: number[] = [];
  private pdfDocument1: any = null;
  private pdfDocument2: any = null;
  private phaseManager: ToolPhaseManager | null = null;
  private searchQuery = '';
  private sidebarModal: ToolSidebarModalController | null = null;
  private syncScroll = true;
  private zoom1 = 1.0;
  private zoom2 = 1.0;
  private zoomController: ToolZoomController | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: 'Seleccionar Primer PDF',
        desc: t('ui.compara_dos_archivos_pdf_uno_al_lado_del'),
        hint: 'o arrastra y suelta el PDF aquí para comenzar la comparación',
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFile1Selected(files[0]);
        },
        title: 'Comparar PDF',
      },
      onRetry: () => {
        void this.runComparison();
      },
      sidebarRef: 'compare-pdf-sidebar',
      toolId: 'compare-pdf',
      toolName: 'Comparar PDF',
      topHeaderRef: 'component-top',
      workspaceCardRef: 'compare-workspace-card',
    });
    await this.phaseManager.init();
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.zoomController) {
      this.zoomController.destroy();
      this.zoomController = null;
    }
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
    if (this.phaseManager) {
      this.phaseManager.destroy();
      this.phaseManager = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.pdfDocument1) {
      try {
        void this.pdfDocument1.destroy();
      } catch {}
      this.pdfDocument1 = null;
    }
    if (this.pdfDocument2) {
      try {
        void this.pdfDocument2.destroy();
      } catch {}
      this.pdfDocument2 = null;
    }
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="compare-pdf-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="compare-sidebar-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');

    if (sidebar && backdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const fileInput2 = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file2"]');
    const browseBtn2 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-browse-file2"]');

    const heroDriveBtn2 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-drive2"]');
    const heroDropboxBtn2 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-dropbox2"]');

    const removeDoc1Btn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-doc1"]');
    const removeDoc2Btn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-doc2"]');
    const syncScrollBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sync-scroll"]');

    const zoomOutBtn1 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-out-left"]');
    const zoomInBtn1 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-in-left"]');
    const zoomOutBtn2 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-out-right"]');
    const zoomInBtn2 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-in-right"]');

    const tabSemanticBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tab-semantic"]');
    const tabOverlayBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tab-overlay"]');
    const opacitySlider = this.container.querySelector<HTMLInputElement>('[data-ref="input-overlay-opacity"]');
    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-changes"]');

    const downloadReportBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-download-report"]');

    if (browseBtn2 && fileInput2) {
      browseBtn2.addEventListener('click', () => fileInput2.click(), { signal });
    }

    if (fileInput2) {
      fileInput2.addEventListener('change', async () => {
        if (fileInput2.files && fileInput2.files.length > 0) {
          await this.handleFile2Selected(fileInput2.files[0]);
        }
      }, { signal });
    }

    const dropzoneDoc2 = this.container.querySelector<HTMLElement>('[data-ref="dropzone-doc2"]');
    if (dropzoneDoc2) {
      dropzoneDoc2.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzoneDoc2.classList.add('is-dragover');
      }, { signal });

      dropzoneDoc2.addEventListener('dragleave', () => {
        dropzoneDoc2.classList.remove('is-dragover');
      }, { signal });

      dropzoneDoc2.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzoneDoc2.classList.remove('is-dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          await this.handleFile2Selected(e.dataTransfer.files[0]);
        }
      }, { signal });
    }

    if (heroDriveBtn2) {
      heroDriveBtn2.addEventListener('click', async () => {
        await this.handleCloudImport(2, 'drive');
      }, { signal });
    }

    if (heroDropboxBtn2) {
      heroDropboxBtn2.addEventListener('click', async () => {
        await this.handleCloudImport(2, 'dropbox');
      }, { signal });
    }

    if (removeDoc1Btn) {
      removeDoc1Btn.addEventListener('click', () => {
        this.resetAll();
      }, { signal });
    }

    if (removeDoc2Btn) {
      removeDoc2Btn.addEventListener('click', () => {
        this.resetFile2();
      }, { signal });
    }

    if (syncScrollBtn) {
      syncScrollBtn.addEventListener('click', () => {
        this.syncScroll = !this.syncScroll;
        syncScrollBtn.classList.toggle('is-active', this.syncScroll);
        showToast(
          this.syncScroll ? 'Desplazamiento sincronizado activado.' : 'Desplazamiento independiente activado.',
          'info'
        );
      }, { signal });
    }

    this.bindScrollSynchronization();

    this.zoomController = new ToolZoomController({
      container: this.container,
      initialZoom: 1.0,
      maxZoom: 3.0,
      minZoom: 0.1,
      onZoomChange: (level) => this.applyZoom(level),
      scrollContainer: this.container.querySelector<HTMLElement>('[data-ref="compare-main-layout"]'),
      signal,
    });

    if (zoomInBtn1) {
      zoomInBtn1.addEventListener('click', () => this.changeZoom(1, 0.15), { signal });
    }
    if (zoomOutBtn1) {
      zoomOutBtn1.addEventListener('click', () => this.changeZoom(1, -0.15), { signal });
    }

    if (zoomInBtn2) {
      zoomInBtn2.addEventListener('click', () => this.changeZoom(2, 0.15), { signal });
    }
    if (zoomOutBtn2) {
      zoomOutBtn2.addEventListener('click', () => this.changeZoom(2, -0.15), { signal });
    }

    if (tabSemanticBtn && tabOverlayBtn) {
      tabSemanticBtn.addEventListener('click', () => {
        this.switchMode('semantic');
      }, { signal });

      tabOverlayBtn.addEventListener('click', () => {
        this.switchMode('overlay');
      }, { signal });
    }

    if (opacitySlider) {
      opacitySlider.addEventListener('input', () => {
        const val = parseInt(opacitySlider.value, 10) || 50;
        this.overlayOpacity = val / 100;
        const valEl = this.container.querySelector<HTMLElement>('[data-ref="val-overlay-opacity"]');
        if (valEl) valEl.textContent = `${val}%`;
        this.applyOverlayOpacity();
      }, { signal });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value.trim().toLowerCase();
        this.renderChangesList();
      }, { signal });
    }

    if (downloadReportBtn) {
      downloadReportBtn.addEventListener('click', async () => {
        await this.handleDownloadReport();
      }, { signal });
    }
  }

  private bindScrollSynchronization(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const scrollLeft = this.container.querySelector<HTMLElement>('[data-ref="scroll-container-left"]');
    const scrollRight = this.container.querySelector<HTMLElement>('[data-ref="scroll-container-right"]');

    if (!scrollLeft || !scrollRight) return;

    scrollLeft.addEventListener('scroll', () => {
      if (!this.syncScroll || this.isSyncingScroll || !this.currentFile2) return;
      this.isSyncingScroll = true;
      const maxLeft = scrollLeft.scrollHeight - scrollLeft.clientHeight;
      const maxRight = scrollRight.scrollHeight - scrollRight.clientHeight;
      if (maxLeft > 0 && maxRight > 0) {
        const ratio = scrollLeft.scrollTop / maxLeft;
        scrollRight.scrollTop = ratio * maxRight;
      }
      this.isSyncingScroll = false;
    }, { signal });

    scrollRight.addEventListener('scroll', () => {
      if (!this.syncScroll || this.isSyncingScroll || !this.currentFile1) return;
      this.isSyncingScroll = true;
      const maxLeft = scrollLeft.scrollHeight - scrollLeft.clientHeight;
      const maxRight = scrollRight.scrollHeight - scrollRight.clientHeight;
      if (maxLeft > 0 && maxRight > 0) {
        const ratio = scrollRight.scrollTop / maxRight;
        scrollLeft.scrollTop = ratio * maxLeft;
      }
      this.isSyncingScroll = false;
    }, { signal });
  }

  private switchMode(mode: CompareViewMode): void {
    this.currentMode = mode;
    const tabSemantic = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tab-semantic"]');
    const tabOverlay = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tab-overlay"]');
    const overlayControls = this.container.querySelector<HTMLElement>('[data-ref="section-overlay-controls"]');

    if (tabSemantic && tabOverlay) {
      tabSemantic.classList.toggle('is-active', mode === 'semantic');
      tabOverlay.classList.toggle('is-active', mode === 'overlay');
    }

    if (overlayControls) {
      toggleElement(overlayControls, mode === 'overlay');
    }

    this.applyOverlayOpacity();
  }

  private applyOverlayOpacity(): void {
    const rightCards = this.container.querySelectorAll<HTMLElement>('[data-ref="pages-wrapper-right"] .compare-page-card');
    rightCards.forEach((card) => {
      if (this.currentMode === 'overlay') {
        card.style.opacity = `${this.overlayOpacity}`;
      } else {
        card.style.opacity = '1';
      }
    });
  }

  private applyZoom(level: number, pane?: 1 | 2): void {
    if (!pane || pane === 1) {
      this.zoom1 = level;
      const valEl = this.container.querySelector<HTMLElement>('[data-ref="val-zoom-left"]');
      if (valEl) valEl.textContent = `${Math.round(level * 100)}%`;
      const scalers = this.container.querySelectorAll<HTMLElement>('[data-scaler-left]');
      scalers.forEach((scaler) => {
        const pageIndex = parseInt(scaler.getAttribute('data-scaler-left') || '0', 10);
        const dims = this.pageDimensions1[pageIndex];
        if (!dims) return;
        const baseWidth = 520;
        const baseHeight = Math.floor((dims.height / dims.width) * baseWidth);
        const sheet = scaler.querySelector<HTMLElement>('.compare-page-card');
        if (sheet) applyPageScaler(scaler, sheet, baseWidth, baseHeight, level);
      });
    }

    if (!pane || pane === 2) {
      this.zoom2 = level;
      const valEl = this.container.querySelector<HTMLElement>('[data-ref="val-zoom-right"]');
      if (valEl) valEl.textContent = `${Math.round(level * 100)}%`;
      const scalers = this.container.querySelectorAll<HTMLElement>('[data-scaler-right]');
      scalers.forEach((scaler) => {
        const pageIndex = parseInt(scaler.getAttribute('data-scaler-right') || '0', 10);
        const dims = this.pageDimensions2[pageIndex];
        if (!dims) return;
        const baseWidth = 520;
        const baseHeight = Math.floor((dims.height / dims.width) * baseWidth);
        const sheet = scaler.querySelector<HTMLElement>('.compare-page-card');
        if (sheet) applyPageScaler(scaler, sheet, baseWidth, baseHeight, level);
      });
    }
  }

  private changeZoom(pane: 1 | 2, delta: number): void {
    if (pane === 1) {
      const newZoom = Math.min(3.0, Math.max(0.1, Math.round((this.zoom1 + delta) * 100) / 100));
      this.applyZoom(newZoom, 1);
    } else {
      const newZoom = Math.min(3.0, Math.max(0.1, Math.round((this.zoom2 + delta) * 100) / 100));
      this.applyZoom(newZoom, 2);
    }
  }

  private async handleCloudImport(docIndex: 1 | 2, provider: 'drive' | 'dropbox'): Promise<void> {
    this.hideError();
    try {
      const files = provider === 'drive'
        ? await pickGoogleDriveFiles({ multiselect: false })
        : await pickDropboxFiles({ multiselect: false });

      if (files.length > 0) {
        if (docIndex === 1) {
          await this.handleFile1Selected(files[0]);
        } else {
          await this.handleFile2Selected(files[0]);
        }
      }
    } catch (err: any) {
      this.showError(err?.message || `Error al importar archivo desde ${provider === 'drive' ? 'Google Drive' : 'Dropbox'}.`);
    }
  }

  private async handleFile1Selected(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.showError(t('ui.por_favor_selecciona_un_archivo_pdf_vali'));
      return;
    }
    const limits = getCurrentUserToolLimits('compare-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolName: 'Comparar PDF',
        type: 'file_size',
      });
      return;
    }

    this.hideError();
    this.currentFile1 = file;

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="title-doc-left"]');
    if (titleEl) titleEl.textContent = file.name;

    this.phaseManager?.setPhase('workspace');

    const topControls = this.container.querySelector<HTMLElement>('[data-ref="compare-top-controls"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    showElement(topControls);
    if (settingsBtn) settingsBtn.classList.add('is-visible');

    try {
      const buffer = await file.arrayBuffer();
      this.pdfDocument1 = await loadPdfDocument(buffer);

      this.pageDimensions1 = [];
      this.pageScales1 = [];
      const numPages = this.pdfDocument1.numPages;

      for (let i = 1; i <= numPages; i++) {
        const page = await this.pdfDocument1.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        this.pageDimensions1.push({ height: vp.height, width: vp.width });
      }

      this.zoomController?.showFooter();
      this.zoomController?.updatePageInfo(1, numPages);
      await this.renderDocument1Pages();

      if (this.currentFile2) {
        await this.runComparison();
      }
    } catch {
      this.showError('Error al leer el archivo PDF 1. Verifica que no esté protegido o dañado.');
      this.resetAll();
    }
  }

  private async handleFile2Selected(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.showError(t('ui.por_favor_selecciona_un_archivo_pdf_vali'));
      return;
    }
    const limits = getCurrentUserToolLimits('compare-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolName: 'Comparar PDF',
        type: 'file_size',
      });
      return;
    }

    this.hideError();
    this.currentFile2 = file;

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="title-doc-right"]');
    if (titleEl) titleEl.textContent = file.name;

    const dropzoneDoc2 = this.container.querySelector<HTMLElement>('[data-ref="dropzone-doc2"]');
    const scrollRight = this.container.querySelector<HTMLElement>('[data-ref="scroll-container-right"]');
    const pillRight = this.container.querySelector<HTMLElement>('[data-ref="floating-pill-right"]');
    const removeBtn2 = this.container.querySelector<HTMLElement>('[data-ref="btn-remove-doc2"]');

    hideElement(dropzoneDoc2);
    showElement(scrollRight);
    showElement(pillRight);
    showElement(removeBtn2);

    try {
      const buffer = await file.arrayBuffer();
      this.pdfDocument2 = await loadPdfDocument(buffer);

      this.pageDimensions2 = [];
      this.pageScales2 = [];
      const numPages = this.pdfDocument2.numPages;

      for (let i = 1; i <= numPages; i++) {
        const page = await this.pdfDocument2.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        this.pageDimensions2.push({ height: vp.height, width: vp.width });
      }

      const totalPages = Math.max(this.pdfDocument1?.numPages || 0, numPages);
      this.zoomController?.updatePageInfo(1, totalPages);

      await this.renderDocument2Pages();
      await this.runComparison();
    } catch {
      this.showError('Error al leer el archivo PDF 2. Verifica que no esté protegido o dañado.');
      this.resetFile2();
    }
  }

  private resetFile2(): void {
    this.currentFile2 = null;
    this.pdfDocument2 = null;
    this.comparisonResult = null;

    const dropzoneDoc2 = this.container.querySelector<HTMLElement>('[data-ref="dropzone-doc2"]');
    const scrollRight = this.container.querySelector<HTMLElement>('[data-ref="scroll-container-right"]');
    const pillRight = this.container.querySelector<HTMLElement>('[data-ref="floating-pill-right"]');
    const removeBtn2 = this.container.querySelector<HTMLElement>('[data-ref="btn-remove-doc2"]');
    const fileInput2 = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file2"]');
    const pagesWrapper2 = this.container.querySelector<HTMLElement>('[data-ref="pages-wrapper-right"]');

    if (fileInput2) fileInput2.value = '';
    if (pagesWrapper2) pagesWrapper2.innerHTML = '';
    showElement(dropzoneDoc2);
    hideElement(scrollRight);
    hideElement(pillRight);
    hideElement(removeBtn2);

    this.updateSimilarityPill(null);
    this.renderChangesList();

    const totalPages = this.pdfDocument1?.numPages || 0;
    if (totalPages > 0) {
      this.zoomController?.updatePageInfo(1, totalPages);
    } else {
      this.zoomController?.hideFooter();
      this.zoomController?.setZoom(1.0);
    }
  }

  private resetAll(): void {
    this.zoomController?.hideFooter();
    this.zoomController?.setZoom(1.0);
    this.currentFile1 = null;
    this.currentFile2 = null;
    this.pdfDocument1 = null;
    this.pdfDocument2 = null;
    this.comparisonResult = null;
    this.sidebarModal?.close();

    const fileInput2 = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file2"]');
    const pagesWrapper1 = this.container.querySelector<HTMLElement>('[data-ref="pages-wrapper-left"]');
    const pagesWrapper2 = this.container.querySelector<HTMLElement>('[data-ref="pages-wrapper-right"]');

    if (fileInput2) fileInput2.value = '';
    if (pagesWrapper1) pagesWrapper1.innerHTML = '';
    if (pagesWrapper2) pagesWrapper2.innerHTML = '';

    const topControls = this.container.querySelector<HTMLElement>('[data-ref="compare-top-controls"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    hideElement(topControls);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');

    this.updateSimilarityPill(null);
    this.renderChangesList();
    this.phaseManager?.setPhase('dropzone');
    this.hideError();
  }

  private async renderDocument1Pages(): Promise<void> {
    if (!this.pdfDocument1) return;
    const pagesWrapper = this.container.querySelector<HTMLElement>('[data-ref="pages-wrapper-left"]');
    if (!pagesWrapper) return;
    pagesWrapper.innerHTML = '';

    const numPages = this.pdfDocument1.numPages;

    for (let i = 1; i <= numPages; i++) {
      const pageIndex = i - 1;
      const page = await this.pdfDocument1.getPage(i);
      const dims = this.pageDimensions1[pageIndex];

      const baseWidth = 520;
      const displayScale = baseWidth / dims.width;
      this.pageScales1[pageIndex] = displayScale;

      const displayWidth = Math.floor(baseWidth);
      const displayHeight = Math.floor((dims.height / dims.width) * baseWidth);

      const scaler = document.createElement('div');
      scaler.className = 'tool-viewport-scaler';
      scaler.setAttribute('data-scaler-left', `${pageIndex}`);
      scaler.style.width = `${Math.floor(displayWidth * this.zoom1)}px`;
      scaler.style.height = `${Math.floor(displayHeight * this.zoom1)}px`;
      scaler.style.marginBottom = '20px';

      const pageCard = document.createElement('div');
      pageCard.className = 'compare-page-card tool-viewport-sheet';
      pageCard.setAttribute('data-page-left', `${pageIndex}`);
      pageCard.style.width = `${displayWidth}px`;
      pageCard.style.height = `${displayHeight}px`;
      pageCard.style.transform = `scale(${this.zoom1})`;
      pageCard.style.transformOrigin = 'top left';

      const canvas = document.createElement('canvas');
      canvas.className = 'compare-page-canvas';
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        const viewport = page.getViewport({ scale: displayScale });
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
      pageCard.appendChild(canvas);

      const textLayer = document.createElement('div');
      textLayer.className = 'compare-text-layer';
      textLayer.setAttribute('data-textlayer-left', `${pageIndex}`);
      pageCard.appendChild(textLayer);

      scaler.appendChild(pageCard);
      pagesWrapper.appendChild(scaler);
    }
  }

  private async renderDocument2Pages(): Promise<void> {
    if (!this.pdfDocument2) return;
    const pagesWrapper = this.container.querySelector<HTMLElement>('[data-ref="pages-wrapper-right"]');
    if (!pagesWrapper) return;
    pagesWrapper.innerHTML = '';

    const numPages = this.pdfDocument2.numPages;

    for (let i = 1; i <= numPages; i++) {
      const pageIndex = i - 1;
      const page = await this.pdfDocument2.getPage(i);
      const dims = this.pageDimensions2[pageIndex];

      const baseWidth = 520;
      const displayScale = baseWidth / dims.width;
      this.pageScales2[pageIndex] = displayScale;

      const displayWidth = Math.floor(baseWidth);
      const displayHeight = Math.floor((dims.height / dims.width) * baseWidth);

      const scaler = document.createElement('div');
      scaler.className = 'tool-viewport-scaler';
      scaler.setAttribute('data-scaler-right', `${pageIndex}`);
      scaler.style.width = `${Math.floor(displayWidth * this.zoom2)}px`;
      scaler.style.height = `${Math.floor(displayHeight * this.zoom2)}px`;
      scaler.style.marginBottom = '20px';

      const pageCard = document.createElement('div');
      pageCard.className = 'compare-page-card tool-viewport-sheet';
      pageCard.setAttribute('data-page-right', `${pageIndex}`);
      pageCard.style.width = `${displayWidth}px`;
      pageCard.style.height = `${displayHeight}px`;
      pageCard.style.transform = `scale(${this.zoom2})`;
      pageCard.style.transformOrigin = 'top left';

      const canvas = document.createElement('canvas');
      canvas.className = 'compare-page-canvas';
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        const viewport = page.getViewport({ scale: displayScale });
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
      pageCard.appendChild(canvas);

      const textLayer = document.createElement('div');
      textLayer.className = 'compare-text-layer';
      textLayer.setAttribute('data-textlayer-right', `${pageIndex}`);
      pageCard.appendChild(textLayer);

      scaler.appendChild(pageCard);
      pagesWrapper.appendChild(scaler);
    }
  }

  private async runComparison(): Promise<void> {
    if (!this.currentFile1 || !this.currentFile2 || this.isComparing) return;
    this.isComparing = true;
    this.hideError();
    this.phaseManager?.showUploading(2, 2);

    try {
      const formData = new FormData();
      formData.append('file1', this.currentFile1);
      formData.append('file2', this.currentFile2);
      formData.append('comparisonMode', this.currentMode);

      const response = await postFormWithProgress(
        API_ROUTES.tools.comparePdf.compare,
        formData,
        (progress) => {
          this.phaseManager?.updateUploadProgress(progress, 2);
        }
      );
      const result = (await response.json()) as {
        data?: ComparePdfResultData;
        error?: string;
        message?: string;
        success: boolean;
      };

      this.phaseManager?.showProcessing(
        'Comparando documentos PDF...',
        t('ui.analizando_estructura_de_texto_semantico')
      );

      if (response.ok && result.success && result.data) {
        this.comparisonResult = result.data;
        this.updateSimilarityPill(result.data.similarityPercentage);
        this.renderChangesList();
        this.renderDiffMarkers();
        this.phaseManager?.setPhase('workspace');
        showToast(t('toasts.comparacion_completada_exitosamente'), 'success');
      } else {
        throw new Error(result.error || result.message || t('ui.error_al_procesar_la_comparacion'));
      }
    } catch (err: any) {
      const message = err?.message || t('ui.ha_ocurrido_un_error_al_comparar_los_doc');
      this.phaseManager?.showError(message);
      this.showError(message);
    } finally {
      this.isComparing = false;
    }
  }

  private updateSimilarityPill(sim: number | null): void {
    const pill = this.container.querySelector<HTMLElement>('[data-ref="pill-similarity"]');
    const val = this.container.querySelector<HTMLElement>('[data-ref="txt-similarity-val"]');
    const downloadBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-download-report"]');

    if (sim === null) {
      if (val) val.textContent = '-';
      if (downloadBtn) downloadBtn.disabled = true;
    } else {
      if (val) val.textContent = `${sim}%`;
      if (downloadBtn) downloadBtn.disabled = false;
    }
  }

  private renderChangesList(): void {
    const listContainer = this.container.querySelector<HTMLElement>('[data-ref="changes-list-container"]');
    const countBadge = this.container.querySelector<HTMLElement>('[data-ref="val-total-changes"]');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!this.comparisonResult || !this.currentFile2) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'compare-changes-list__empty';
      emptyMsg.setAttribute('data-ref', 'changes-empty-msg');
      emptyMsg.textContent = t('ui.sube_el_segundo_documento_para_analizar_');
      listContainer.appendChild(emptyMsg);
      if (countBadge) countBadge.textContent = '0';
      return;
    }

    const pages = this.comparisonResult.pageComparisons || [];
    let displayedCount = 0;

    pages.forEach((pageComp) => {
      const filteredChanges = pageComp.changes.filter((ch) => {
        if (!this.searchQuery) return true;
        const oldMatch = ch.oldText?.toLowerCase().includes(this.searchQuery);
        const newMatch = ch.newText?.toLowerCase().includes(this.searchQuery);
        return Boolean(oldMatch || newMatch);
      });

      filteredChanges.forEach((change) => {
        displayedCount++;
        const card = document.createElement('div');
        card.className = 'compare-change-card';
        card.setAttribute('data-ref', `diff-card-${change.id}`);

        const header = document.createElement('div');
        header.className = 'compare-change-card__header';
        header.innerHTML = `<span>Página ${pageComp.pageIndex + 1}</span><span>${change.type}</span>`;
        card.appendChild(header);

        if (change.oldText) {
          const secOld = document.createElement('div');
          secOld.className = 'compare-change-card__section compare-change-card__section--old';

          const label = document.createElement('div');
          label.className = 'compare-change-card__label--old';
          label.innerHTML = `<span>Archivo antiguo</span><span>-${change.oldText.length}</span>`;
          secOld.appendChild(label);

          const text = document.createElement('div');
          text.className = 'compare-change-card__text--old';
          text.textContent = change.oldText;
          secOld.appendChild(text);

          card.appendChild(secOld);
        }

        if (change.newText) {
          const secNew = document.createElement('div');
          secNew.className = 'compare-change-card__section compare-change-card__section--new';

          const label = document.createElement('div');
          label.className = 'compare-change-card__label--new';
          label.innerHTML = `<span>Archivo nuevo</span><span>+${change.newText.length}</span>`;
          secNew.appendChild(label);

          const text = document.createElement('div');
          text.className = 'compare-change-card__text--new';
          text.textContent = change.newText;
          secNew.appendChild(text);

          card.appendChild(secNew);
        }

        card.addEventListener('click', () => {
          this.scrollToPage(pageComp.pageIndex);
        });

        listContainer.appendChild(card);
      });
    });

    if (countBadge) {
      countBadge.textContent = `${this.comparisonResult.totalChanges}`;
    }

    if (displayedCount === 0) {
      const noMatch = document.createElement('p');
      noMatch.className = 'compare-changes-list__empty';
      noMatch.textContent = this.searchQuery
        ? t('ui.no_se_encontraron_cambios_que_coincidan_')
        : 'Los documentos son 100% idénticos. No se detectaron diferencias.';
      listContainer.appendChild(noMatch);
    }
  }

  private renderDiffMarkers(): void {
    if (!this.comparisonResult) return;
    const pages = this.comparisonResult.pageComparisons || [];

    pages.forEach((pageComp) => {
      const pageIndex = pageComp.pageIndex;
      const leftPageCard = this.container.querySelector<HTMLElement>(`[data-page-left="${pageIndex}"]`);
      const rightPageCard = this.container.querySelector<HTMLElement>(`[data-page-right="${pageIndex}"]`);

      if (pageComp.hasDifferences) {
        if (leftPageCard && !leftPageCard.querySelector('.compare-diff-marker')) {
          const marker = document.createElement('div');
          marker.className = 'compare-diff-marker compare-diff-marker--deletion';
          leftPageCard.appendChild(marker);
        }

        if (rightPageCard && !rightPageCard.querySelector('.compare-diff-marker')) {
          const marker = document.createElement('div');
          marker.className = 'compare-diff-marker compare-diff-marker--addition';
          rightPageCard.appendChild(marker);
        }
      }
    });
  }

  private scrollToPage(pageIndex: number): void {
    const leftCard = this.container.querySelector<HTMLElement>(`[data-scaler-left="${pageIndex}"], [data-page-left="${pageIndex}"]`);
    const rightCard = this.container.querySelector<HTMLElement>(`[data-scaler-right="${pageIndex}"], [data-page-right="${pageIndex}"]`);

    if (leftCard) {
      leftCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (rightCard) {
      rightCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private async handleDownloadReport(): Promise<void> {
    if (!this.comparisonResult) {
      showToast(t('toasts.por_favor_carga_y_compara_dos_archivos_p'), 'warning');
      return;
    }

    const token = this.comparisonResult.fileId;
    this.phaseManager?.navigateToDownload({
      downloadUrl: this.comparisonResult.downloadUrl || `/api/download/${token}`,
      fileSize: 0,
      filename: this.comparisonResult.filename || 'informe_comparacion.pdf',
      returnText: 'Volver a Comparar PDF',
      returnUrl: '/compare-pdf',
      subtitle: t('ui.tu_informe_detallado_de_diferencias_y_an'),
      title: '¡Informe de comparación listo!',
      token,
    });
  }

  private showError(msg: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="compare-global-error"]');
    if (errorEl) {
      errorEl.textContent = msg;
      showElement(errorEl);
    }
    showToast(msg, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="compare-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

async function createComparePdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/compare-pdf/compare-pdf.html');
  const controller = new ComparePdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { ComparePdfController, createComparePdfView };
