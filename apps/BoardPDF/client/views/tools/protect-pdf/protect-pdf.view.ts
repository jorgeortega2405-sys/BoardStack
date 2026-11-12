import { openProtectPdfPasswordModal } from '../../../components/modal-dialogs.js';
import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { consumeTransferFile } from '../../../services/transfer.service.js';
import { ViewController } from '../../../types/common.types.js';
import { hideElement, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { ProtectPdfResponseData } from './protect-pdf.types.js';

class ProtectPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private isProcessing = false;
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
        buttonText: t('tools.select_pdf_btn'),
        desc: t('ui.anade_una_contrasena_robusta_y_cifra_tu_'),
        hint: t('tools.dropzone_hint_pdf'),
        multiselect: false,
        onFilesSelected: (files) => {
          if (files.length > 0) {
            void this.handleFileSelected(files[0]);
          }
        },
        title: t('tools.protect_pdf.title'),
      },
      onRetry: () => {
        if (this.currentFile) {
          this.phaseManager?.setPhase('workspace');
        } else {
          this.resetToInitial();
        }
      },
      toolId: 'protect-pdf',
      toolName: t('tools.protect_pdf.title'),
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
    if (this.phaseManager) {
      this.phaseManager.destroy();
      this.phaseManager = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.pdfDocument) {
      try {
        void this.pdfDocument.destroy();
      } catch {}
      this.pdfDocument = null;
    }
    this.currentFile = null;
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-protect"]');

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetToInitial();
    }, { signal });

    executeBtn?.addEventListener('click', () => {
      this.handleOpenPasswordModal(executeBtn);
    }, { signal });
  }

  private async handleFileSelected(file: File): Promise<void> {
    this.hideError();
    const limits = getCurrentUserToolLimits('protect-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'protect-pdf',
        toolName: t('tools.protect_pdf.title'),
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;

    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="txt-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="txt-file-size"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-protect"]');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (executeBtn) executeBtn.disabled = false;

    this.phaseManager?.setPhase('workspace');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
    if (outputNameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}${t('tools.protect_pdf.default_suffix')}.pdf`;
    }

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="protect-doc-canvas"]');
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

  private handleOpenPasswordModal(button: HTMLButtonElement): void {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    openProtectPdfPasswordModal({
      onConfirm: async (password, inst) => {
        inst.close();
        await this.executeProtectWithPassword(button, password);
        return true;
      },
    });
  }

  private async executeProtectWithPassword(button: HTMLButtonElement, password: string): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;

    const filenameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
    const customFilename = filenameInput?.value.trim() || undefined;

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        formData.append('options', JSON.stringify({ filename: customFilename, password }));

        const response = await postFormWithProgress(
          API_ROUTES.tools.protectPdf.process,
          formData,
          (progress) => {
            this.phaseManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as {
          data?: ProtectPdfResponseData;
          error?: string;
          success: boolean;
        };

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || t('ui.ocurrio_un_error_al_proteger_el_document'));
        }

        const token = result.data.fileId;
        showToast(t('toasts.pdf_protegido_correctamente'), 'success');
        await this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: result.data.filename,
          returnText: t('tools.protect_pdf.return_btn'),
          returnUrl: '/protect-pdf',
          subtitle: `${t('tools.protect_success_prefix')}"${this.currentFile?.name}".`,
          title: t('tools.protect_pdf.success_title'),
          token,
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : t('ui.no_se_pudo_aplicar_el_cifrado_de_segurid');
        this.showError(errMsg);
        this.phaseManager?.showError({
          boxText: t('tools.protect_pdf.error_box_text'),
          boxTitle: t('ui.error_al_cifrar_el_documento'),
          desc: t('ui.no_se_pudo_aplicar_el_cifrado_de_segurid'),
          retryText: t('tools.protect_pdf.retry_btn'),
          title: t('tools.protect_pdf.error_title'),
        });
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private resetToInitial(): void {
    this.currentFile = null;
    this.pdfDocument = null;
    this.isProcessing = false;

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-protect"]');
    if (executeBtn) executeBtn.disabled = true;

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="protect-doc-canvas"]');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    this.phaseManager?.setPhase('dropzone');
    this.hideError();
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="protect-global-error"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="protect-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

async function createProtectPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/protect-pdf/protect-pdf.html');
  const controller = new ProtectPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { ProtectPdfController, createProtectPdfView };
