import { showAuthGateModal } from '../../../components/auth-gate-modal.component.js';
import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { currentUser, postFormWithProgress, updateUserAiTokens } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, animateTypewriter, hideElement, setupToolSidebarModal, showElement } from '../../../utils/dom.util.js';
import { ToolZoomController, applyPageScaler } from '../../../utils/tool-zoom.util.js';
import { SummarizePdfResultData } from './summarize-pdf.types.js';

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderSimpleMarkdown(md: string): string {
  const lines = md.split('\n');
  let html = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }

    if (line.startsWith('### ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h3>${formatInlineMarkdown(line.slice(4))}</h3>`;
      continue;
    }

    if (line.startsWith('## ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h2>${formatInlineMarkdown(line.slice(3))}</h2>`;
      continue;
    }

    if (line.startsWith('# ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h1>${formatInlineMarkdown(line.slice(2))}</h1>`;
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${formatInlineMarkdown(line.slice(2))}</li>`;
      continue;
    }

    if (inList) {
      html += '</ul>';
      inList = false;
    }

    html += `<p>${formatInlineMarkdown(line)}</p>`;
  }

  if (inList) {
    html += '</ul>';
  }

  return html;
}

class SummarizePdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private currentResult: SummarizePdfResultData | null = null;
  private isProcessing = false;
  private isRenderingPages = false;
  private pageDimensions: Array<{ height: number; width: number }> = [];
  private pageObserver: IntersectionObserver | null = null;
  private pdfDocument: any = null;
  private phaseManager: ToolPhaseManager | null = null;
  private selectedMode: 'standard' = 'standard';
  private sidebarModal: ToolSidebarModalController | null = null;
  private zoomController: ToolZoomController | null = null;
  private zoomScale = 1.0;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: t('tools.select_pdf_btn'),
        desc: t('ui.lee_comprende_y_sintetiza_cualquier_docu'),
        hint: t('tools.dropzone_hint_pdf'),
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: t('tools.summarize_pdf_title'),
      },
      sidebarRef: 'summarize-pdf-sidebar',
      toolId: 'summarize-pdf',
      toolName: t('tools.summarize_pdf_title'),
      topHeaderRef: 'component-top',
      workspaceCardRef: 'summarize-viewer-card',
    });
    await this.phaseManager.init();
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.pageObserver) {
      this.pageObserver.disconnect();
      this.pageObserver = null;
    }
    if (this.zoomController) {
      this.zoomController.destroy();
      this.zoomController = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
    if (this.phaseManager) {
      this.phaseManager.destroy();
      this.phaseManager = null;
    }
    if (this.pdfDocument) {
      try {
        void this.pdfDocument.destroy();
      } catch {}
      this.pdfDocument = null;
    }
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const sidebarBackdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const sidebarCloseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const sidebarDragZone = this.container.querySelector<HTMLElement>('[data-ref="summarize-sidebar-drag-zone"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-sidebar"]');

    this.sidebarModal = setupToolSidebarModal({
      backdrop: sidebarBackdrop,
      closeBtn: sidebarCloseBtn,
      dragZone: sidebarDragZone,
      settingsBtn,
      sidebar,
      signal,
    });

    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const sidebarActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-summarize-action"]');

    mainActionBtn?.addEventListener('click', () => {
      void this.startSummarize();
    }, { signal });

    sidebarActionBtn?.addEventListener('click', () => {
      void this.startSummarize();
    }, { signal });

    const viewSummaryBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-view-summary"]');
    const drawerCollapseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-summary-drawer-collapse"]');
    const drawerMobileCloseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-summary-drawer-mobile-close"]');

    viewSummaryBtn?.addEventListener('click', () => {
      this.toggleSummaryDrawer();
    }, { signal });

    drawerCollapseBtn?.addEventListener('click', () => {
      this.closeSummaryDrawer();
    }, { signal });

    drawerMobileCloseBtn?.addEventListener('click', () => {
      this.closeSummaryDrawer();
    }, { signal });

    const copyBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-copy-summary"]');
    const clearBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-summary"]');

    copyBtn?.addEventListener('click', () => {
      void this.handleCopySummary();
    }, { signal });

    clearBtn?.addEventListener('click', () => {
      this.handleClearSummary();
    }, { signal });

    this.zoomController = new ToolZoomController({
      container: this.container,
      initialZoom: 1.0,
      maxZoom: 3.0,
      minZoom: 0.1,
      onZoomChange: (level) => this.applyZoom(level),
      scrollContainer: this.container.querySelector<HTMLElement>('[data-ref="viewer-scroll-container"]'),
      signal,
    });
  }

  private applyZoom(level: number): void {
    this.zoomScale = level;
    const scalers = this.container.querySelectorAll<HTMLElement>('.tool-viewport-scaler');
    scalers.forEach((scaler) => {
      const pageIndex = parseInt(scaler.getAttribute('data-page-index') || '0', 10);
      const dims = this.pageDimensions[pageIndex];
      if (!dims) return;
      const baseWidth = 760;
      const baseHeight = Math.floor((dims.height / dims.width) * baseWidth);
      const sheet = scaler.querySelector<HTMLElement>('.pdf-viewer-page-card');
      if (sheet) applyPageScaler(scaler, sheet, baseWidth, baseHeight, level);
    });
  }

  public async handleFileSelected(file: File): Promise<void> {
    if (!currentUser) {
      showAuthGateModal({ featureKey: 'ai_tools', returnUrl: '/summarize-pdf' });
      return;
    }

    this.hideError();

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast(t('tools.only_pdf_allowed'), 'danger');
      return;
    }

    const limits = getCurrentUserToolLimits('summarize-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'summarize-pdf',
        toolName: t('tools.summarize_pdf_title'),
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;
    this.currentResult = null;
    this.handleClearSummary();
    this.closeSummaryDrawer();

    try {
      const buffer = await file.arrayBuffer();
      this.pdfDocument = await loadPdfDocument(buffer);

      this.renderViewerState();
      this.zoomController?.showFooter();
      this.zoomController?.updatePageInfo(1, this.pdfDocument.numPages);
      void this.renderAllPages();
    } catch {
      showToast(t('ui.no_se_pudo_leer_el_archivo_pdf_seleccion'), 'danger');
      this.resetSelectedFile();
    }
  }

  private renderViewerState(): void {
    this.phaseManager?.setPhase('workspace');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const viewSummaryBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-view-summary"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-workspace"]');
    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const sidebarActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-summarize-action"]');

    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (viewSummaryBtn) viewSummaryBtn.classList.add('is-visible');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
    if (mainActionBtn) mainActionBtn.disabled = false;
    if (sidebarActionBtn) sidebarActionBtn.disabled = false;
  }

  private async renderAllPages(): Promise<void> {
    if (!this.pdfDocument || this.isRenderingPages) return;
    this.isRenderingPages = true;

    if (this.pageObserver) {
      this.pageObserver.disconnect();
      this.pageObserver = null;
    }

    const scrollContainer = this.container.querySelector<HTMLElement>('[data-ref="viewer-scroll-container"]');
    const pagesWrapper = this.container.querySelector<HTMLElement>('[data-ref="pages-wrapper"]') || scrollContainer;
    if (!pagesWrapper) {
      this.isRenderingPages = false;
      return;
    }

    pagesWrapper.innerHTML = '';
    const numPages = this.pdfDocument.numPages;
    this.pageDimensions = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageIndex = pageNum - 1;
      const page = await this.pdfDocument.getPage(pageNum);
      const origViewport = page.getViewport({ scale: 1 });
      this.pageDimensions.push({ height: origViewport.height, width: origViewport.width });

      const baseWidth = 760;
      const displayScale = baseWidth / origViewport.width;
      const baseHeight = Math.floor(origViewport.height * displayScale);
      const viewport = page.getViewport({ scale: displayScale });
      const dpr = Math.max(window.devicePixelRatio || 1, 2);

      const scaler = document.createElement('div');
      scaler.className = 'tool-viewport-scaler';
      scaler.setAttribute('data-page-index', `${pageIndex}`);
      scaler.style.width = `${Math.floor(baseWidth * this.zoomScale)}px`;
      scaler.style.height = `${Math.floor(baseHeight * this.zoomScale)}px`;

      const pageCard = document.createElement('div');
      pageCard.className = 'pdf-viewer-page-card tool-viewport-sheet';
      pageCard.setAttribute('data-ref', `page-card-${pageNum}`);
      pageCard.setAttribute('data-page-index', `${pageIndex}`);
      pageCard.style.width = `${baseWidth}px`;
      pageCard.style.height = `${baseHeight}px`;
      pageCard.style.transform = `scale(${this.zoomScale})`;

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-viewer-page-canvas';
      canvas.setAttribute('data-ref', `page-canvas-${pageNum}`);
      canvas.width = Math.floor(baseWidth * dpr);
      canvas.height = Math.floor(baseHeight * dpr);
      canvas.style.width = `${baseWidth}px`;
      canvas.style.height = `${baseHeight}px`;

      pageCard.appendChild(canvas);
      scaler.appendChild(pageCard);
      pagesWrapper.appendChild(scaler);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        try {
          await page.render({ canvasContext: ctx, viewport }).promise;
        } catch {}
      }
    }

    this.setupPageScrollObserver();
    this.isRenderingPages = false;
  }

  private setupPageScrollObserver(): void {
    const scrollContainer = this.container.querySelector<HTMLElement>('[data-ref="viewer-scroll-container"]');
    if (!scrollContainer || !this.abortController) return;

    this.pageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageIndex = parseInt(entry.target.getAttribute('data-page-index') || '0', 10);
          this.zoomController?.updatePageInfo(pageIndex + 1, this.pdfDocument?.numPages || 1);
        }
      });
    }, {
      root: scrollContainer,
      threshold: 0.5,
    });

    const scalers = this.container.querySelectorAll<HTMLElement>('.tool-viewport-scaler');
    scalers.forEach((scaler) => this.pageObserver?.observe(scaler));
  }

  private resetSelectedFile(): void {
    if (this.pageObserver) {
      this.pageObserver.disconnect();
      this.pageObserver = null;
    }
    this.zoomController?.hideFooter();
    this.zoomController?.setZoom(1.0);
    this.currentFile = null;
    this.currentResult = null;
    this.pdfDocument = null;
    this.zoomScale = 1.0;
    this.hideError();

    const pagesWrapper = this.container.querySelector<HTMLElement>('[data-ref="pages-wrapper"]');
    if (pagesWrapper) pagesWrapper.innerHTML = '';

    const resultSection = this.container.querySelector<HTMLElement>('[data-ref="section-summary-result"]');
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="summary-empty-state"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const viewSummaryBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-view-summary"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-workspace"]');
    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const sidebarActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-summarize-action"]');

    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (viewSummaryBtn) viewSummaryBtn.classList.remove('is-visible', 'is-active');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    if (mainActionBtn) mainActionBtn.disabled = true;
    if (sidebarActionBtn) sidebarActionBtn.disabled = true;

    hideElement(resultSection);
    showElement(emptyState);
    this.closeSummaryDrawer();
    this.sidebarModal?.close();
    this.phaseManager?.setPhase('dropzone');
  }

  private async startSummarize(): Promise<void> {
    if (!currentUser) {
      showAuthGateModal({ featureKey: 'ai_tools', returnUrl: '/summarize-pdf' });
      return;
    }
    if (!this.currentFile || this.isProcessing) return;

    this.hideError();
    this.isProcessing = true;
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const viewSummaryBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-view-summary"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-workspace"]');

    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (viewSummaryBtn) viewSummaryBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    this.sidebarModal?.close();

    this.phaseManager?.showUploading(1, 1);

    try {
      const formData = new FormData();
      formData.append('pdf', this.currentFile as Blob, this.currentFile?.name);
      formData.append('mode', this.selectedMode);

      const response = await postFormWithProgress(
        API_ROUTES.tools.summarizePdf.summarize,
        formData,
        (progress) => {
          this.phaseManager?.updateUploadProgress(progress);
        }
      );
      const result = (await response.json()) as { data?: SummarizePdfResultData; error?: string; success: boolean };

      this.phaseManager?.showProcessing(
        t('tools.summarize_processing_title'),
        t('tools.summarize_processing_subtitle')
      );

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || t('ui.error_al_generar_el_resumen_del_document'));
      }

      this.currentResult = result.data;
      if ((result as any).aiTokens?.balance !== undefined) {
        updateUserAiTokens((result as any).aiTokens.balance);
      }
      this.phaseManager?.setPhase('workspace');
      if (settingsBtn) settingsBtn.classList.add('is-visible');
      if (viewSummaryBtn) viewSummaryBtn.classList.add('is-visible');
      if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
      showToast(t('toasts.summary_generated_success'), 'success');
      this.openSummaryDrawer();
      this.renderSummaryResult(result.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('ui.error_inesperado_al_resumir_el_pdf');
      this.showError(errorMessage);
      this.phaseManager?.showError(errorMessage, () => {
        this.phaseManager?.setPhase('workspace');
        if (settingsBtn) settingsBtn.classList.add('is-visible');
        if (viewSummaryBtn) viewSummaryBtn.classList.add('is-visible');
        if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private renderSummaryResult(data: SummarizePdfResultData): void {
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="summary-empty-state"]');
    const resultSection = this.container.querySelector<HTMLElement>('[data-ref="section-summary-result"]');
    const renderedTextEl = this.container.querySelector<HTMLElement>('[data-ref="summary-rendered-text"]');

    hideElement(emptyState);
    showElement(resultSection);

    if (renderedTextEl) {
      renderedTextEl.scrollTop = 0;
      void animateTypewriter(renderedTextEl, data.summary, {
        onChunk: () => {
          renderedTextEl.scrollTop = renderedTextEl.scrollHeight;
        },
        renderHtml: renderSimpleMarkdown,
        signal: this.abortController?.signal,
      });
    }
  }

  private openSummaryDrawer(): void {
    const drawer = this.container.querySelector<HTMLElement>('[data-ref="summarize-drawer"]');
    const viewBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-view-summary"]');
    drawer?.classList.add('is-open');
    viewBtn?.classList.add('is-active');
  }

  private closeSummaryDrawer(): void {
    const drawer = this.container.querySelector<HTMLElement>('[data-ref="summarize-drawer"]');
    const viewBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-view-summary"]');
    drawer?.classList.remove('is-open');
    viewBtn?.classList.remove('is-active');
  }

  private toggleSummaryDrawer(): void {
    const drawer = this.container.querySelector<HTMLElement>('[data-ref="summarize-drawer"]');
    if (!drawer) return;
    if (drawer.classList.contains('is-open')) {
      this.closeSummaryDrawer();
    } else {
      this.openSummaryDrawer();
    }
  }

  private async handleCopySummary(): Promise<void> {
    if (!this.currentResult?.summary) return;
    try {
      await navigator.clipboard.writeText(this.currentResult.summary);
      showToast(t('toasts.summary_copied'), 'success');
    } catch {
      showToast(t('toasts.copy_failed'), 'danger');
    }
  }

  private handleClearSummary(): void {
    this.currentResult = null;
    const renderedTextEl = this.container.querySelector<HTMLElement>('[data-ref="summary-rendered-text"]');
    const resultSection = this.container.querySelector<HTMLElement>('[data-ref="section-summary-result"]');
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="summary-empty-state"]');
    if (renderedTextEl) renderedTextEl.innerHTML = '';
    hideElement(resultSection);
    showElement(emptyState);
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="summarize-error-banner"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="summarize-error-banner"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

async function createSummarizePdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/summarize-pdf/summarize-pdf.html');
  const controller = new SummarizePdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { SummarizePdfController, createSummarizePdfView };
