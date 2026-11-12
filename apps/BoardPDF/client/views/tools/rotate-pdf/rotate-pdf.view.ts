import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { consumeTransferFile } from '../../../services/transfer.service.js';
import { ViewController } from '../../../types/common.types.js';
import { hideElement, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { RotatePageItem, RotatePdfResponseData } from './rotate-pdf.types.js';

class RotatePdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private isProcessing = false;
  private pages: RotatePageItem[] = [];
  private pdfDocument: any = null;
  private phaseManager: ToolPhaseManager | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();

    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: t('tools.select_pdf'),
        desc: t('ui.gira_tus_paginas_pdf_permanentemente_a_9'),
        hint: t('tools.drop_pdf_hint'),
        multiselect: false,
        onFilesSelected: (files) => {
          if (files.length > 0) {
            void this.handleFileSelected(files[0]);
          }
        },
        title: t('tools.rotate_pdf_title'),
      },
      onRetry: () => {
        if (this.currentFile) {
          this.phaseManager?.setPhase('workspace');
        } else {
          this.resetToInitial();
        }
      },
      toolId: 'rotate-pdf',
      toolName: t('tools.rotate_pdf_title'),
      topHeaderRef: 'component-top',
      workspaceCardRef: 'rotate-workspace-card',
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

  private setToolbarButtonsDisabled(disabled: boolean): void {
    const refs = ['btn-execute-rotate', 'btn-rotate-all-left', 'btn-rotate-all-right', 'btn-reset-rotations'];
    for (const ref of refs) {
      const btn = this.container.querySelector<HTMLButtonElement>(`[data-ref="${ref}"]`);
      if (btn) btn.disabled = disabled;
    }
  }

  private async handleFileSelected(file: File): Promise<void> {
    this.hideError();
    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      this.showError(t('tools.only_pdf_allowed'));
      return;
    }

    const limits = getCurrentUserToolLimits('rotate-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'rotate-pdf',
        toolName: t('tools.rotate_pdf_title'),
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;
    this.setToolbarButtonsDisabled(false);
    this.phaseManager?.setPhase('workspace');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}_${t('tools.rotate_filename_suffix')}.pdf`;
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
        void this.renderPageThumbnail(item.pageNum, item.id, card);
      }
    } catch {
      this.showError(t('ui.no_se_pudo_leer_el_archivo_pdf_asegurate'));
      this.resetToInitial();
    }
  }

  private createPageCardElement(item: RotatePageItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'pdf-card rotate-page-card';
    card.setAttribute('data-ref', `card-${item.id}`);
    card.setAttribute('data-page-id', item.id);

    card.innerHTML = `
      <div class="pdf-card__actions">
        <button type="button" class="component-button pdf-card__btn-rotate" data-ref="btn-card-rotate-left" title="${t('tools.rotate_left_aria')}" aria-label="${t('tools.rotate_left_aria')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#undo"></use></svg>
        </button>
        <button type="button" class="component-button pdf-card__btn-rotate" data-ref="btn-card-rotate-right" title="${t('tools.rotate_right_aria')}" aria-label="${t('tools.rotate_right_aria')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#redo"></use></svg>
        </button>
      </div>
      <div class="pdf-card__sheet-wrapper">
        <div class="pdf-card__sheet" data-ref="page-sheet">
          <div class="pdf-card__spinner"></div>
        </div>
      </div>
      <div class="pdf-card__footer">
        <span class="pdf-card__title">${t('tools.rotate_page_label', { num: item.pageNum })}</span>
        <span class="rotate-page-card__rot-badge is-hidden" data-ref="rot-badge-${item.id}"></span>
      </div>
    `;

    renderIcons(card);
    return card;
  }

  private async renderPageThumbnail(pageNum: number, pageId: string, card: HTMLElement): Promise<void> {
    if (!this.pdfDocument) return;
    try {
      const page = await this.pdfDocument.getPage(pageNum);
      const sheet = card.querySelector<HTMLElement>('[data-ref="page-sheet"]');
      if (!sheet) return;

      const origViewport = page.getViewport({ scale: 1 });
      const targetWidth = 220;
      const scale = targetWidth / Math.max(origViewport.width, 1);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        sheet.innerHTML = `<img class="pdf-card__canvas" data-ref="img-${pageId}" src="${dataUrl}" alt="${t('tools.rotate_page_label', { num: pageNum })}" />`;
      }
    } catch {}
  }

  private updateCardVisualRotation(item: RotatePageItem): void {
    const card = this.container.querySelector<HTMLElement>(`[data-page-id="${item.id}"]`);
    if (!card) return;

    const sheet = card.querySelector<HTMLElement>('[data-ref="page-sheet"]');
    if (sheet) {
      if (item.rotation === 0) {
        sheet.removeAttribute('data-rotation');
      } else {
        sheet.setAttribute('data-rotation', item.rotation.toString());
      }
    }

    const badge = card.querySelector<HTMLElement>(`[data-ref="rot-badge-${item.id}"]`);
    if (badge) {
      if (item.rotation === 0) {
        badge.textContent = '';
        badge.classList.remove('is-rotated');
        badge.classList.add('is-hidden');
      } else {
        badge.textContent = `+${item.rotation}°`;
        badge.classList.add('is-rotated');
        badge.classList.remove('is-hidden');
      }
    }
  }

  private rotatePage(pageId: string, delta: number): void {
    const page = this.pages.find((p) => p.id === pageId);
    if (!page) return;

    page.rotation = (page.rotation + delta) % 360;
    if (page.rotation < 0) page.rotation += 360;

    this.updateCardVisualRotation(page);
  }

  private rotateAll(delta: number): void {
    for (const page of this.pages) {
      this.rotatePage(page.id, delta);
    }
  }

  private resetRotations(): void {
    for (const page of this.pages) {
      page.rotation = 0;
      this.updateCardVisualRotation(page);
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

        this.phaseManager?.showProcessing(t('tools.rotate_processing_title'), t('tools.rotate_processing_desc'));

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || t('ui.ocurrio_un_error_al_procesar_la_rotacion'));
        }

        const token = result.data.fileId;
        showToast(t('toasts.pdf_rotado_correctamente'), 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: customFilename || result.data.filename,
          returnText: t('tools.rotate_return_text'),
          returnUrl: '/rotate-pdf',
          subtitle: t('tools.rotate_success_prefix') + `"${this.currentFile?.name}".`,
          title: t('tools.rotate_success_title'),
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : t('ui.error_inesperado_al_rotar_el_documento');
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

    this.setToolbarButtonsDisabled(true);

    const pagesGrid = this.container.querySelector<HTMLElement>('[data-ref="rotate-pages-grid"]');
    if (pagesGrid) pagesGrid.innerHTML = '';

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = '';

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

async function createRotatePdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/rotate-pdf/rotate-pdf.html');
  const controller = new RotatePdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { RotatePdfController, createRotatePdfView };
