import { ToolStatusManager } from '../../../components/tool-status.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { pickDropboxFiles } from '../../../services/dropbox.service.js';
import { pickGoogleDriveFiles } from '../../../services/google-drive.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { saveDownloadPayloadAndNavigate } from '../../../services/tool-flow.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, bindFileDropzone, hideElement, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { RepairResultData } from './repair-pdf.types.js';

export class RepairPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private isProcessing = false;
  private sidebarModal: ToolSidebarModalController | null = null;
  private statusManager: ToolStatusManager | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="repair-pdf-workspace"]');
    this.statusManager = new ToolStatusManager(workspace || this.container);
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
    if (this.statusManager) {
      this.statusManager.destroy();
      this.statusManager = null;
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

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    const dropzone = this.container.querySelector<HTMLElement>('[data-ref="repair-dropzone"]');
    const browseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-browse-file"]');
    const fabAddBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-repair-fab-add"]');
    const heroDriveBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-drive"]');
    const heroDropboxBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-dropbox"]');
    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const repairBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-repair-action"]');

    fabAddBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    }, { signal });

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    }, { signal });

    heroDriveBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickGoogleDriveFiles({ multiselect: false });
      if (files && files.length > 0) {
        this.handleFileSelected(files[0]);
      }
    }, { signal });

    heroDropboxBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickDropboxFiles({ multiselect: false });
      if (files && files.length > 0) {
        this.handleFileSelected(files[0]);
      }
    }, { signal });

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetSelectedFile();
    }, { signal });

    fileInput?.addEventListener('change', () => {
      const files = fileInput.files;
      if (files && files.length > 0) {
        this.handleFileSelected(files[0]);
      }
    }, { signal });

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="repair-dropzone-card"]');
    const dropTarget = dropzoneCard || dropzone;
    bindFileDropzone({
      dropTarget,
      onFiles: (files) => {
        if (files.length > 0) {
          this.handleFileSelected(files[0]);
        }
      },
      signal,
      visualTarget: dropTarget,
    });

    repairBtn?.addEventListener('click', () => {
      void this.handleRepair(repairBtn);
    }, { signal });
  }

  private handleFileSelected(file: File): void {
    this.hideError();

    const limits = getCurrentUserToolLimits('repair-pdf');
    const maxSizeBytes = limits.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      this.showError(`El archivo supera el límite de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar archivos de mayor tamaño.`);
      return;
    }

    this.currentFile = file;
    this.renderSelectedState(file);
  }

  private renderSelectedState(file: File): void {
    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="repair-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="repair-selected-card"]');
    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-size"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="repair-pdf-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="repair-pdf-workspace"]');
    const repairBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-repair-action"]');

    hideElement(dropzoneCard);
    showElement(selectedCard);

    showElement(sidebar);
    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (repairBtn) repairBtn.disabled = false;

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
      // Ignore preview errors for corrupted files
    } finally {
      try {
        if (pdf) await pdf.destroy();
      } catch {}
    }
  }

  private resetSelectedFile(): void {
    this.currentFile = null;
    this.statusManager?.hide();
    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    if (fileInput) fileInput.value = '';

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="repair-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="repair-selected-card"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="repair-pdf-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="repair-pdf-workspace"]');
    const repairBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-repair-action"]');

    showElement(dropzoneCard);
    hideElement(selectedCard);

    hideElement(sidebar);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    this.sidebarModal?.close();

    if (repairBtn) repairBtn.disabled = true;

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="doc-preview-canvas"]');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = 'documento_reparado.pdf';

    this.hideError();
  }

  private async handleRepair(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    this.isProcessing = true;
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="repair-selected-card"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="repair-pdf-sidebar"]');
    hideElement(selectedCard);
    hideElement(sidebar);
    this.statusManager?.showUploading(1, 1);

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
            this.statusManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as { data?: RepairResultData; error?: string; success: boolean };

        this.statusManager?.showProcessingState({
          subtitle: 'Reconstruyendo la tabla de referencias cruzadas y flujos de contenido',
          title: 'Analizando y reparando archivo PDF...',
        });

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || 'Error al reparar el archivo PDF.');
        }

        const token = result.data.fileId;
        showToast('PDF reparado con éxito.', 'success');
        saveDownloadPayloadAndNavigate({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.repairedSize,
          filename: customFilename || result.data.filename,
          returnText: 'Reparar otro documento PDF',
          returnUrl: '/repair-pdf',
          subtitle: `Se ha reparado exitosamente el archivo "${this.currentFile?.name}".`,
          title: '¡PDF reparado con éxito!',
          token,
        });
      } catch (err: unknown) {
        showElement(selectedCard);
        showElement(sidebar);
        const errorMessage = err instanceof Error ? err.message : 'Error inesperado al reparar el PDF.';
        this.statusManager?.showError(errorMessage, () => {
          this.statusManager?.hide();
        });
        this.showError(errorMessage);
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="repair-global-error"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
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
