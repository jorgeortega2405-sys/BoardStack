import { openUnlockPdfPasswordModal, showUpgradeLimitModal } from '../../../components/modal.component.js';
import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { consumeTransferFile } from '../../../services/transfer.service.js';
import { ModalInstance, ViewController } from '../../../types/common.types.js';
import { hideElement, showElement } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { UnlockPdfResponseData } from './unlock-pdf.types.js';

class UnlockPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private isPasswordRequired = false;
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
        buttonText: t('tools.select_pdf'),
        desc: t('ui.elimina_la_contrasena_de_seguridad_de_tu'),
        hint: t('tools.dropzone_hint_pdf'),
        multiselect: false,
        onFilesSelected: (files) => {
          if (files.length > 0) {
            void this.handleFileSelected(files[0]);
          }
        },
        title: t('tools.unlock_pdf.title'),
      },
      onRetry: () => {
        if (this.currentFile) {
          this.phaseManager?.setPhase('workspace');
        } else {
          this.resetToInitial();
        }
      },
      toolId: 'unlock-pdf',
      toolName: t('tools.unlock_pdf.title'),
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
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-unlock"]');

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetToInitial();
    }, { signal });

    executeBtn?.addEventListener('click', () => {
      if (this.isProcessing) return;
      if (this.isPasswordRequired) {
        this.promptPasswordAndUnlock(executeBtn);
      } else {
        void this.processUnlock('', executeBtn);
      }
    }, { signal });
  }

  private async handleFileSelected(file: File): Promise<void> {
    this.hideError();
    const limits = getCurrentUserToolLimits('unlock-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'unlock-pdf',
        toolName: t('tools.unlock_pdf.title'),
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;

    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="txt-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="txt-file-size"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-unlock"]');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (executeBtn) executeBtn.disabled = false;

    this.phaseManager?.setPhase('workspace');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}${t('tools.unlock_pdf.default_suffix')}.pdf`;
    }

    await this.inspectAndRenderPdf(file);
  }

  private async inspectAndRenderPdf(file: File): Promise<void> {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="unlock-doc-canvas"]');
    const lockedPlaceholder = this.container.querySelector<HTMLElement>('[data-ref="unlock-locked-placeholder"]');

    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();

      try {
        this.pdfDocument = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        this.isPasswordRequired = false;
        if (canvas) {
          showElement(canvas);
          void this.renderThumbnail(this.pdfDocument, canvas);
        }
        if (lockedPlaceholder) hideElement(lockedPlaceholder);
      } catch (err: any) {
        if (err?.name === 'PasswordException') {
          this.isPasswordRequired = true;
          if (canvas) hideElement(canvas);
          if (lockedPlaceholder) showElement(lockedPlaceholder);
        } else {
          this.isPasswordRequired = false;
          if (canvas) hideElement(canvas);
          if (lockedPlaceholder) hideElement(lockedPlaceholder);
        }
      }
    } catch {
      this.isPasswordRequired = false;
    }
  }

  private async renderThumbnail(pdf: any, canvas: HTMLCanvasElement): Promise<void> {
    try {
      const page = await pdf.getPage(1);
      const targetWidth = 180;
      const origViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / origViewport.width;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    } catch {}
  }

  private promptPasswordAndUnlock(button: HTMLButtonElement): void {
    const modal = openUnlockPdfPasswordModal({
      onConfirm: async (password: string, inst: any) => {
        await this.processUnlock(password, button, inst);
        return false;
      },
    });

    const input = modal.body.querySelector<HTMLInputElement>('[data-ref="input-unlock-password"]');
    input?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        modal.confirmBtn?.click();
      }
    });
  }

  private async processUnlock(password: string, button: HTMLButtonElement, modal?: ModalInstance): Promise<void> {
    if (!this.currentFile) return;

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    const customFilename = outputNameInput?.value.trim() || undefined;

    if (modal) {
      modal.setConfirmLoading(true);
      modal.clearError();
    } else {
      this.isProcessing = true;
      this.phaseManager?.showUploading(1, 1);
    }

    try {
      const formData = new FormData();
      formData.append('file', this.currentFile as Blob, this.currentFile?.name);
      formData.append('options', JSON.stringify({ filename: customFilename, password }));

      const response = await postFormWithProgress(
        API_ROUTES.tools.unlockPdf.process,
        formData,
        (progress) => {
          if (!modal) {
            this.phaseManager?.updateUploadProgress(progress);
          }
        }
      );

      const result = (await response.json()) as {
        data?: UnlockPdfResponseData;
        error?: string;
        requiresPassword?: boolean;
        success: boolean;
      };

      if (!response.ok || !result.success || !result.data?.downloadUrl) {
        if (result.requiresPassword || response.status === 400) {
          this.isPasswordRequired = true;
          if (modal) {
            modal.setConfirmLoading(false);
            modal.showError(t('ui.la_contrasena_introducida_es_incorrecta_'));
            return;
          }
          this.phaseManager?.setPhase('workspace');
          this.promptPasswordAndUnlock(button);
          return;
        }
        throw new Error(result.error || t('ui.ocurrio_un_error_al_desbloquear_el_docum'));
      }

      if (modal) {
        modal.close();
      }

      const token = result.data.fileId;
      showToast(t('toasts.pdf_desbloqueado_correctamente'), 'success');
      this.phaseManager?.navigateToDownload({
        downloadUrl: `/api/download/${token}`,
        fileSize: result.data.fileSize,
        filename: result.data.filename,
        returnText: t('tools.unlock_pdf.return_btn'),
        returnUrl: '/unlock-pdf',
        subtitle: `${t('tools.unlock_success_prefix')}"${this.currentFile?.name}".`,
        title: t('tools.unlock_pdf.success_title'),
        token,
      });
    } catch {
      if (modal) {
        modal.setConfirmLoading(false);
        modal.showError(t('ui.error_al_desbloquear_el_documento_verifi'));
      } else {
        this.phaseManager?.showError({
          boxText: t('ui.comprueba_que_la_contrasena_ingresada_se'),
          boxTitle: t('ui.error_al_desbloquear_el_documento'),
          desc: t('ui.no_se_pudo_eliminar_la_proteccion_del_ar'),
          retryText: t('tools.unlock_pdf.retry_btn'),
          title: t('tools.unlock_pdf.error_title'),
        });
      }
    } finally {
      if (!modal) {
        this.isProcessing = false;
      }
    }
  }

  private resetToInitial(): void {
    this.currentFile = null;
    this.pdfDocument = null;
    this.isPasswordRequired = false;
    this.isProcessing = false;

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-unlock"]');
    if (executeBtn) executeBtn.disabled = true;

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="unlock-doc-canvas"]');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    this.phaseManager?.setPhase('dropzone');
    this.hideError();
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="unlock-global-error"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="unlock-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

async function createUnlockPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/unlock-pdf/unlock-pdf.html');
  const controller = new UnlockPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { UnlockPdfController, createUnlockPdfView };
