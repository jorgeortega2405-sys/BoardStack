import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { consumeTransferFile } from '../../../services/transfer.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { RepairResultData } from './repair-pdf.types.js';

export class RepairPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private isProcessing = false;
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
        desc: 'Recupera y repara datos de documentos PDF dañados o corruptos de forma rápida y segura.',
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files) => {
          if (files.length > 0) {
            this.handleFileSelected(files[0]);
          }
        },
        title: 'Reparar PDF',
      },
      onRetry: () => {
        if (this.currentFile) {
          this.phaseManager?.setPhase('workspace');
        } else {
          this.resetSelectedFile();
        }
      },
      toolId: 'repair-pdf',
      toolName: 'Reparar PDF',
    });

    await this.phaseManager.init();
    renderIcons(this.container);
    this.bindEvents();

    const transferred = consumeTransferFile();
    if (transferred) {
      this.handleFileSelected(transferred);
    }
  }

  public destroy(): void {
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
    this.currentFile = null;
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="repair-pdf-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="repair-sidebar-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');

    if (sidebar && backdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const repairBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-repair-action"]');

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetSelectedFile();
    }, { signal });

    repairBtn?.addEventListener('click', () => {
      void this.handleRepair(repairBtn);
    }, { signal });
  }

  private handleFileSelected(file: File): void {
    this.hideError();
    const limits = getCurrentUserToolLimits('repair-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      this.showError(`El archivo excede el tamaño máximo permitido (${limits.maxFileSizeMB} MB).`);
      return;
    }

    this.currentFile = file;

    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-size"]');
    const repairBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-repair-action"]');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (repairBtn) repairBtn.disabled = false;

    this.phaseManager?.setPhase('workspace');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
    if (outputNameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}_reparado.pdf`;
    }

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="doc-preview-canvas"]');
    if (canvas) {
      void this.renderThumbnail(file, canvas);
    }
  }

  private async renderThumbnail(file: File, canvas: HTMLCanvasElement): Promise<void> {
    let pdf: any = null;
    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const targetWidth = 180;
      const origViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / origViewport.width;
      const viewport = page.getViewport({ scale });
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
    } catch {
    } finally {
      try {
        if (pdf) await pdf.destroy();
      } catch {}
    }
  }

  private resetSelectedFile(): void {
    this.currentFile = null;

    const repairBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-repair-action"]');
    if (repairBtn) repairBtn.disabled = true;

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="doc-preview-canvas"]');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = 'documento_reparado.pdf';

    this.sidebarModal?.close();
    this.phaseManager?.setPhase('dropzone');
    this.hideError();
  }

  private async handleRepair(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
        const customFilename = outputNameInput?.value.trim();

        const formData = new FormData();
        formData.append('pdf', this.currentFile as Blob, this.currentFile?.name);
        if (customFilename) {
          formData.append('filename', customFilename);
        }

        const response = await postFormWithProgress(
          API_ROUTES.tools.repairPdf.repair,
          formData,
          (progress) => {
            this.phaseManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as { data?: RepairResultData; error?: string; success: boolean };

        this.phaseManager?.showProcessing(
          'Analizando y reparando archivo PDF...',
          'Reconstruyendo la tabla de referencias cruzadas y flujos de contenido'
        );

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || 'Error al reparar el archivo PDF.');
        }

        const token = result.data.fileId;
        showToast('PDF reparado con éxito.', 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.repairedSize,
          filename: result.data.filename,
          returnText: 'Reparar otro archivo PDF',
          returnUrl: '/repair-pdf',
          subtitle: 'Tu archivo ha sido analizado y reparado con éxito.',
          title: '¡PDF reparado con éxito!',
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Error inesperado al reparar el archivo PDF.';
        this.phaseManager?.showError({
          boxText: 'Comprueba que el documento no esté dañado irreparablemente o que el formato sea un PDF estándar.',
          boxTitle: 'Error de reparación',
          desc: errorMessage,
          retryText: 'Reintentar Reparar PDF',
          title: '¡Oh no! No hemos podido reparar tu archivo.',
        });
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private showError(msg: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="repair-global-error"]');
    if (errorEl) {
      errorEl.textContent = msg;
      showElement(errorEl);
    }
    showToast(msg, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="repair-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

export async function createRepairPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/repair-pdf/repair-pdf.html');
  const controller = new RepairPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
