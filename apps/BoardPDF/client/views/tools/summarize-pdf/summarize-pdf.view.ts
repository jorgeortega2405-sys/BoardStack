import { ToolStatusManager } from '../../../components/tool-status.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { pickDropboxFiles } from '../../../services/dropbox.service.js';
import { pickGoogleDriveFiles } from '../../../services/google-drive.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, animateTypewriter, bindFileDropzone, hideElement, setupToolSidebarModal, showElement } from '../../../utils/dom.util.js';
import { SummarizePdfResultData } from './summarize-pdf.types.js';

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

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export class SummarizePdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private currentResult: SummarizePdfResultData | null = null;
  private isProcessing = false;
  private isRenderingPages = false;
  private pdfDocument: any = null;
  private sidebarModal: ToolSidebarModalController | null = null;
  private statusManager: ToolStatusManager | null = null;
  private zoomScale = 1.0;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-workspace"]');
    this.statusManager = new ToolStatusManager(workspace || this.container);
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
    if (this.statusManager) {
      this.statusManager.destroy();
      this.statusManager = null;
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

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    const dropzone = this.container.querySelector<HTMLElement>('[data-ref="summarize-dropzone"]');
    const browseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-browse-file"]');
    const heroDriveBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-drive"]');
    const heroDropboxBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-dropbox"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
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

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    }, { signal });

    heroDriveBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.handleDriveImport();
    }, { signal });

    heroDropboxBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.handleDropboxImport();
    }, { signal });

    fileInput?.addEventListener('change', () => {
      const files = fileInput.files;
      if (files && files.length > 0) {
        void this.handleFileSelected(files[0]);
      }
    }, { signal });

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="summarize-dropzone-card"]');
    const dropTarget = dropzoneCard || dropzone;
    bindFileDropzone({
      dropTarget,
      visualTarget: dropTarget,
      onFiles: (files) => {
        if (files.length > 0) {
          void this.handleFileSelected(files[0]);
        }
      },
      signal,
    });
  }

  private async handleDriveImport(): Promise<void> {
    if (this.isProcessing) return;
    try {
      const files = await pickGoogleDriveFiles({ multiselect: false });
      if (files.length > 0) {
        await this.handleFileSelected(files[0]);
      }
    } catch {
      showToast('Error al importar archivo desde Google Drive.', 'danger');
    }
  }

  private async handleDropboxImport(): Promise<void> {
    if (this.isProcessing) return;
    try {
      const files = await pickDropboxFiles({ multiselect: false });
      if (files.length > 0) {
        await this.handleFileSelected(files[0]);
      }
    } catch {
      showToast('Error al importar archivo desde Dropbox.', 'danger');
    }
  }

  public async handleFileSelected(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast('Solo se permiten documentos en formato PDF.', 'danger');
      return;
    }

    const limits = getCurrentUserToolLimits('summarize-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showToast(`El archivo PDF excede el límite máximo de ${limits.maxFileSizeMB} MB.`, 'danger');
      return;
    }

    this.currentFile = file;

    try {
      const buffer = await file.arrayBuffer();
      this.pdfDocument = await loadPdfDocument(buffer);

      this.renderViewerState();
      void this.renderAllPages();
      await this.startSummarize();
    } catch {
      showToast('No se pudo leer el archivo PDF seleccionado. Asegúrate de que no esté protegido o dañado.', 'danger');
      this.resetSelectedFile();
    }
  }

  private renderViewerState(): void {
    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="summarize-dropzone-card"]');
    const viewerCard = this.container.querySelector<HTMLElement>('[data-ref="summarize-viewer-card"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-settings"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-sidebar"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-workspace"]');

    hideElement(dropzoneCard);
    showElement(viewerCard);
    showElement(sidebar);
    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
  }

  private async renderAllPages(): Promise<void> {
    if (!this.pdfDocument || this.isRenderingPages) return;
    this.isRenderingPages = true;

    const scrollContainer = this.container.querySelector<HTMLElement>('[data-ref="viewer-scroll-container"]');
    const pagesWrapper = this.container.querySelector<HTMLElement>('[data-ref="pages-wrapper"]') || scrollContainer;
    if (!pagesWrapper) {
      this.isRenderingPages = false;
      return;
    }

    pagesWrapper.innerHTML = '';
    const numPages = this.pdfDocument.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageIndex = pageNum - 1;
      const pageCard = document.createElement('div');
      pageCard.className = 'pdf-viewer-page-card';
      pageCard.setAttribute('data-ref', `page-card-${pageNum}`);
      pageCard.setAttribute('data-page-index', `${pageIndex}`);

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-viewer-page-canvas';
      canvas.setAttribute('data-ref', `page-canvas-${pageNum}`);
      pageCard.appendChild(canvas);

      pagesWrapper.appendChild(pageCard);

      try {
        const page = await this.pdfDocument.getPage(pageNum);
        const origViewport = page.getViewport({ scale: 1 });
        const targetWidth = Math.min(scrollContainer?.clientWidth ? scrollContainer.clientWidth - 48 : 800, 800);
        const scale = (targetWidth / origViewport.width) * this.zoomScale;
        const viewport = page.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch {}
    }

    this.isRenderingPages = false;
  }

  private resetSelectedFile(): void {
    this.currentFile = null;
    this.currentResult = null;
    this.pdfDocument = null;
    this.zoomScale = 1.0;
    this.statusManager?.hide();

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    if (fileInput) fileInput.value = '';

    const scrollContainer = this.container.querySelector<HTMLElement>('[data-ref="viewer-scroll-container"]');
    const pagesWrapper = this.container.querySelector<HTMLElement>('[data-ref="pages-wrapper"]');
    if (pagesWrapper) pagesWrapper.innerHTML = '';
    else if (scrollContainer) scrollContainer.innerHTML = '';

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="summarize-dropzone-card"]');
    const viewerCard = this.container.querySelector<HTMLElement>('[data-ref="summarize-viewer-card"]');
    const resultSection = this.container.querySelector<HTMLElement>('[data-ref="section-summary-result"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-settings"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-sidebar"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-workspace"]');

    showElement(dropzoneCard);
    hideElement(viewerCard);
    hideElement(sidebar);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    if (scrollContainer) scrollContainer.innerHTML = '';
    hideElement(resultSection);
    this.sidebarModal?.close();
  }

  private async startSummarize(): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;

    this.isProcessing = true;
    const viewerCard = this.container.querySelector<HTMLElement>('[data-ref="summarize-viewer-card"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="summarize-pdf-workspace"]');

    hideElement(viewerCard);
    hideElement(sidebar);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    this.sidebarModal?.close();

    this.statusManager?.showUploading(1, 1);

    try {
      const formData = new FormData();
      formData.append('pdf', this.currentFile as Blob, this.currentFile?.name);

      const response = await postFormWithProgress(
        API_ROUTES.tools.summarizePdf.summarize,
        formData,
        (progress) => {
          this.statusManager?.updateUploadProgress(progress);
        }
      );
      const result = (await response.json()) as { data?: SummarizePdfResultData; error?: string; success: boolean };

      this.statusManager?.showProcessingState({
        subtitle: 'Leyendo documento y sintetizando puntos clave con IA',
        title: 'Resumiendo documento PDF...',
      });

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Error al generar el resumen del documento.');
      }

      this.currentResult = result.data;
      this.statusManager?.hide();
      showElement(viewerCard);
      showElement(sidebar);
      if (settingsBtn) settingsBtn.classList.add('is-visible');
      if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
      showToast('Resumen generado exitosamente.', 'success');
      this.renderSummaryResult(result.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error inesperado al resumir el PDF.';
      this.statusManager?.showError(errorMessage, () => {
        this.statusManager?.hide();
        showElement(viewerCard);
        showElement(sidebar);
        if (settingsBtn) settingsBtn.classList.add('is-visible');
        if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
      });
      showToast(errorMessage, 'danger');
    } finally {
      this.isProcessing = false;
    }
  }

  private renderSummaryResult(data: SummarizePdfResultData): void {
    const resultSection = this.container.querySelector<HTMLElement>('[data-ref="section-summary-result"]');
    const renderedTextEl = this.container.querySelector<HTMLElement>('[data-ref="summary-rendered-text"]');

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
}

export async function createSummarizePdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/summarize-pdf/summarize-pdf.html');
  const controller = new SummarizePdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
