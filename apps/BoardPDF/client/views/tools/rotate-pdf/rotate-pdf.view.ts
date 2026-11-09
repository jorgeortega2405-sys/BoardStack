import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument, loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { consumeTransferFile } from '../../../services/transfer.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { RotatePageItem, RotatePdfResponseData } from './rotate-pdf.types.js';

export class RotatePdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private isProcessing = false;
  private pages: RotatePageItem[] = [];
  private pdfDocument: any = null;
  private phaseManager: ToolPhaseManager | null = null;
  private sidebarModal: ToolSidebarModalController | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();

    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: 'Seleccionar PDF',
        desc: 'Gira tus páginas PDF permanentemente a 90, 180 o 270 grados en segundos.',
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files) => {
          if (files.length > 0) {
            void this.handleFileSelected(files[0]);
          }
        },
        title: 'Rotar PDF',
      },
      onRetry: () => {
        if (this.currentFile) {
          this.phaseManager?.setPhase('workspace');
        } else {
          this.resetToInitial();
        }
      },
      toolId: 'rotate-pdf',
      toolName: 'Rotar PDF',
    });

    await this.phaseManager.init();
    renderIcons(this.container);
    this.bindEvents();

    const transferred = consumeTransferFile();
    if (transferred) {
      void this.handleFileSelected(transferred);
    }
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.phaseManager) {
      this.phaseManager.destroy();
      this.phaseManager = null;
    }
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
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

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="rotate-pdf-sidebar"]');
    const sidebarBackdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const sidebarCloseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const sidebarDragZone = this.container.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');

    if (sidebar && sidebarBackdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({
        backdrop: sidebarBackdrop,
        closeBtn: sidebarCloseBtn,
        dragZone: sidebarDragZone,
        settingsBtn,
        sidebar,
        signal,
      });
    }

    const rotateAllRightBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-rotate-all-right"]');
    const rotateAllLeftBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-rotate-all-left"]');
    const resetRotationsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-reset-rotations"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-rotate"]');
    const pagesGrid = this.container.querySelector<HTMLElement>('[data-ref="rotate-pages-grid"]');

    rotateAllRightBtn?.addEventListener('click', () => this.rotateAll(90), { signal });
    rotateAllLeftBtn?.addEventListener('click', () => this.rotateAll(-90), { signal });
    resetRotationsBtn?.addEventListener('click', () => this.resetRotations(), { signal });

    pagesGrid?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const rightBtn = target.closest<HTMLElement>('[data-ref="btn-card-rotate-right"]');
      const leftBtn = target.closest<HTMLElement>('[data-ref="btn-card-rotate-left"]');
      const card = target.closest<HTMLElement>('[data-page-id]');
      if (!card) return;

      const pageId = card.getAttribute('data-page-id');
      if (!pageId) return;

      if (rightBtn) {
        e.stopPropagation();
        this.rotatePage(pageId, 90);
      } else if (leftBtn) {
        e.stopPropagation();
        this.rotatePage(pageId, -90);
      }
    }, { signal });

    executeBtn?.addEventListener('click', () => {
      void this.handleExecuteRotate(executeBtn);
    }, { signal });
  }

  private async handleFileSelected(file: File): Promise<void> {
    this.hideError();
    const limits = getCurrentUserToolLimits('rotate-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'rotate-pdf',
        toolName: 'Rotar PDF',
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-rotate"]');
    if (executeBtn) executeBtn.disabled = false;

    this.phaseManager?.setPhase('workspace');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}_rotado.pdf`;
    }

    await this.loadPdfPages(file);
  }

  private async loadPdfPages(file: File): Promise<void> {
    const pagesGrid = this.container.querySelector<HTMLElement>('[data-ref="rotate-pages-grid"]');
    if (!pagesGrid) return;
    pagesGrid.innerHTML = '';

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDocument = await loadPdfDocument(arrayBuffer);
      const count = this.pdfDocument.numPages || 1;

      this.pages = Array.from({ length: count }, (_, i) => ({
        id: `rot-page-${i + 1}`,
        originalIndex: i,
        pageNum: i + 1,
        rotation: 0,
      }));

      for (const item of this.pages) {
        const card = this.createPageCardElement(item);
        pagesGrid.appendChild(card);
        void this.renderPageThumbnail(item.pageNum, card);
      }
    } catch {
      this.showError('No se pudo leer el archivo PDF. Asegúrate de que no esté dañado ni protegido con contraseña.');
      this.resetToInitial();
    }
  }

  private createPageCardElement(item: RotatePageItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'pdf-card rotate-page-card';
    card.setAttribute('data-page-id', item.id);

    card.innerHTML = `
      <div class="pdf-card__sheet-wrapper">
        <div class="pdf-card__sheet" data-ref="page-sheet">
          <canvas class="pdf-card__canvas" data-ref="page-canvas"></canvas>
        </div>
      </div>
      <div class="rotate-card-hover-actions">
        <button type="button" class="component-button component-button--icon-only component-button--h32 rotate-card-btn" data-ref="btn-card-rotate-left" title="Rotar izquierda (-90°)" aria-label="Rotar izquierda">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#rotate_left"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--h32 rotate-card-btn" data-ref="btn-card-rotate-right" title="Rotar derecha (+90°)" aria-label="Rotar derecha">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#rotate_right"></use></svg>
        </button>
      </div>
      <span class="pdf-card__page-badge" data-ref="page-badge">${item.pageNum}</span>
    `;

    renderIcons(card);
    return card;
  }

  private async renderPageThumbnail(pageNum: number, card: HTMLElement): Promise<void> {
    if (!this.pdfDocument) return;
    try {
      const page = await this.pdfDocument.getPage(pageNum);
      const canvas = card.querySelector<HTMLCanvasElement>('[data-ref="page-canvas"]');
      if (!canvas) return;

      const viewport = page.getViewport({ scale: 0.3 });
      const dpr = window.devicePixelRatio || 1;
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

  private rotatePage(pageId: string, delta: number): void {
    const page = this.pages.find((p) => p.id === pageId);
    if (!page) return;

    page.rotation = (page.rotation + delta) % 360;
    if (page.rotation < 0) page.rotation += 360;

    const card = this.container.querySelector<HTMLElement>(`[data-page-id="${pageId}"]`);
    const sheet = card?.querySelector<HTMLElement>('[data-ref="page-sheet"]');
    if (sheet) {
      sheet.style.transform = `rotate(${page.rotation}deg)`;
    }
  }

  private rotateAll(delta: number): void {
    for (const page of this.pages) {
      this.rotatePage(page.id, delta);
    }
  }

  private resetRotations(): void {
    for (const page of this.pages) {
      page.rotation = 0;
      const card = this.container.querySelector<HTMLElement>(`[data-page-id="${page.id}"]`);
      const sheet = card?.querySelector<HTMLElement>('[data-ref="page-sheet"]');
      if (sheet) {
        sheet.style.transform = 'rotate(0deg)';
      }
    }
  }

  private async handleExecuteRotate(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
        const customFilename = outputNameInput?.value.trim();

        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        if (customFilename) {
          formData.append('filename', customFilename);
        }

        const optionsPayload = {
          pages: this.pages.map((p) => ({
            pageIndex: p.originalIndex,
            rotation: p.rotation,
          })),
        };

        formData.append('options', JSON.stringify(optionsPayload));

        const response = await postFormWithProgress(
          API_ROUTES.tools.rotatePdf.process,
          formData,
          (progress) => {
            this.phaseManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as {
          data?: RotatePdfResponseData;
          error?: string;
          success: boolean;
        };

        this.phaseManager?.showProcessing('Rotando páginas del PDF...');

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || 'Ocurrió un error al procesar la rotación del documento.');
        }

        const token = result.data.fileId;
        showToast('PDF rotado correctamente.', 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: customFilename || result.data.filename,
          returnText: 'Rotar otro archivo PDF',
          returnUrl: '/rotate-pdf',
          subtitle: `Las orientaciones de página para "${this.currentFile?.name}" se han aplicado correctamente.`,
          title: '¡PDF rotado con éxito!',
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Error inesperado al rotar el documento.';
        this.phaseManager?.showError(errorMessage);
        this.showError(errorMessage);
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private resetToInitial(): void {
    this.currentFile = null;
    this.pages = [];
    this.pdfDocument = null;
    this.isProcessing = false;

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-rotate"]');
    if (executeBtn) executeBtn.disabled = true;

    const pagesGrid = this.container.querySelector<HTMLElement>('[data-ref="rotate-pages-grid"]');
    if (pagesGrid) pagesGrid.innerHTML = '';

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = 'documento_rotado.pdf';

    this.sidebarModal?.close();
    this.phaseManager?.setPhase('dropzone');
    this.hideError();
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="rotate-global-error"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="rotate-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

export async function createRotatePdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/rotate-pdf/rotate-pdf.html');
  const controller = new RotatePdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
