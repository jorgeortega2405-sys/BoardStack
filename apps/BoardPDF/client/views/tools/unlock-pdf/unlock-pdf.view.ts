import { openModal } from '../../../components/modal.component.js';
import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { consumeTransferFile } from '../../../services/transfer.service.js';
import { ModalInstance, ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { UnlockPdfResponseData } from './unlock-pdf.types.js';

export class UnlockPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private isPasswordRequired = false;
  private isProcessing = false;
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
        desc: 'Elimina la contraseña de seguridad de tu documento PDF para poder abrirlo, editarlo e imprimirlo libremente.',
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files) => {
          if (files.length > 0) {
            void this.handleFileSelected(files[0]);
          }
        },
        title: 'Desbloquear PDF',
      },
      onRetry: () => {
        if (this.currentFile) {
          this.phaseManager?.setPhase('workspace');
        } else {
          this.resetToInitial();
        }
      },
      toolId: 'unlock-pdf',
      toolName: 'Desbloquear PDF',
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

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="unlock-pdf-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');

    if (sidebar && backdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-unlock"]');

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetToInitial();
    }, { signal });

    executeBtn?.addEventListener('click', () => {
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
      this.showError(`El archivo seleccionado supera el límite permitido de ${limits.maxFileSizeMB} MB.`);
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
      outputNameInput.value = `${base}_desbloqueado.pdf`;
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
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    } catch {}
  }

  private promptPasswordAndUnlock(button: HTMLButtonElement): void {
    const modal = openModal({
      bodyHtml: `
        <div class="modal-form-stack" style="display: flex; flex-direction: column; gap: 16px;">
          <label class="field">
            <input class="field__input field__input--has-action" data-ref="modal-input-password" type="password" placeholder=" " autocomplete="current-password" autofocus />
            <span class="field__label">Introduce la contraseña del PDF</span>
            <button type="button" class="field__action" data-ref="btn-modal-toggle-password" data-tooltip="Mostrar contraseña" aria-label="Mostrar contraseña">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
            </button>
          </label>
        </div>
      `,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--black',
      confirmText: 'Desbloquear PDF',
      description: 'Este archivo PDF requiere una contraseña de apertura para poder desbloquearlo.',
      onConfirm: async () => {
        const input = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-password"]');
        const password = input?.value.trim() || '';
        if (!password) {
          modal.showError('Debes ingresar la contraseña del archivo PDF.');
          return false;
        }
        await this.processUnlock(password, button, modal);
        return false;
      },
      size: 'sm',
      title: 'Contraseña requerida',
    });

    const toggleBtn = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-toggle-password"]');
    const input = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-password"]');

    toggleBtn?.addEventListener('click', () => {
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const useEl = toggleBtn.querySelector('use');
      if (useEl) {
        useEl.setAttribute('href', isPassword ? '/icons.svg#visibility_off' : '/icons.svg#visibility');
      }
    });

    input?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        modal.confirmBtn?.click();
      }
    });
  }

  private async processUnlock(password: string, button: HTMLButtonElement, modal?: ModalInstance): Promise<void> {
    if (!this.currentFile) return;

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
      formData.append('options', JSON.stringify({ password }));

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
            modal.showError('La contraseña introducida es incorrecta. Inténtalo de nuevo.');
            return;
          }
          this.phaseManager?.setPhase('workspace');
          this.promptPasswordAndUnlock(button);
          return;
        }
        throw new Error(result.error || 'Ocurrió un error al desbloquear el documento PDF.');
      }

      if (modal) {
        modal.close();
      }

      const token = result.data.fileId;
      showToast('PDF desbloqueado correctamente.', 'success');
      this.phaseManager?.navigateToDownload({
        downloadUrl: `/api/download/${token}`,
        fileSize: result.data.fileSize,
        filename: result.data.filename,
        returnText: 'Desbloquear otro documento PDF',
        returnUrl: '/unlock-pdf',
        subtitle: `Se han eliminado exitosamente las restricciones del documento "${this.currentFile?.name}".`,
        title: '¡PDF desbloqueado con éxito!',
        token,
      });
    } catch {
      if (modal) {
        modal.setConfirmLoading(false);
        modal.showError('Error al desbloquear el documento. Verifica los datos e inténtalo de nuevo.');
      } else {
        this.phaseManager?.showError({
          boxText: 'Comprueba que la contraseña ingresada sea la correcta o que el archivo PDF no esté dañado.',
          boxTitle: 'Error al desbloquear el documento',
          desc: 'No se pudo eliminar la protección del archivo PDF. Por favor verifica los datos.',
          retryText: 'Reintentar Desbloqueo',
          title: '¡Oh no! No hemos podido desbloquear tu archivo.',
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

    this.sidebarModal?.close();
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

export async function createUnlockPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/unlock-pdf/unlock-pdf.html');
  const controller = new UnlockPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
