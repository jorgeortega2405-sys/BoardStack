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
import { ProtectPdfResponseData } from './protect-pdf.types.js';

export class ProtectPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
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
        desc: 'Añade una contraseña robusta y cifra tu documento PDF con tecnología AES-256.',
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files) => {
          if (files.length > 0) {
            void this.handleFileSelected(files[0]);
          }
        },
        title: 'Proteger PDF',
      },
      onRetry: () => {
        if (this.currentFile) {
          this.phaseManager?.setPhase('workspace');
        } else {
          this.resetToInitial();
        }
      },
      toolId: 'protect-pdf',
      toolName: 'Proteger PDF',
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

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="protect-pdf-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');

    if (sidebar && backdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-protect"]');
    const togglePasswordBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-password"]');
    const toggleConfirmBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-confirm-password"]');

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetToInitial();
    }, { signal });

    togglePasswordBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = this.container.querySelector<HTMLInputElement>('[data-ref="input-password"]');
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const useEl = togglePasswordBtn.querySelector('use');
      if (useEl) {
        useEl.setAttribute('href', isPassword ? '/icons.svg#visibility_off' : '/icons.svg#visibility');
      }
    }, { signal });

    toggleConfirmBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = this.container.querySelector<HTMLInputElement>('[data-ref="input-confirm-password"]');
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const useEl = toggleConfirmBtn.querySelector('use');
      if (useEl) {
        useEl.setAttribute('href', isPassword ? '/icons.svg#visibility_off' : '/icons.svg#visibility');
      }
    }, { signal });

    executeBtn?.addEventListener('click', () => {
      void this.handleExecuteProtect(executeBtn);
    }, { signal });
  }

  private async handleFileSelected(file: File): Promise<void> {
    this.hideError();
    const limits = getCurrentUserToolLimits('protect-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      this.showError(`El archivo seleccionado supera el límite permitido de ${limits.maxFileSizeMB} MB.`);
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
      outputNameInput.value = `${base}_protegido.pdf`;
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

  private async handleExecuteProtect(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    const passwordInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-password"]');
    const confirmInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-confirm-password"]');
    const password = passwordInput?.value ?? '';
    const confirm = confirmInput?.value ?? '';

    if (!password) {
      this.showError('Introduce una contraseña para proteger el documento.');
      return;
    }

    if (password !== confirm) {
      this.showError('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        formData.append('options', JSON.stringify({ password }));

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
          throw new Error(result.error || 'Ocurrió un error al proteger el documento PDF.');
        }

        const token = result.data.fileId;
        showToast('PDF protegido correctamente.', 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: result.data.filename,
          returnText: 'Proteger otro documento PDF',
          returnUrl: '/protect-pdf',
          subtitle: `Se ha protegido y cifrado exitosamente el documento "${this.currentFile?.name}".`,
          title: '¡PDF protegido con éxito!',
          token,
        });
      } catch {
        this.phaseManager?.showError({
          boxText: 'Comprueba que el archivo PDF no esté protegido o dañado y vuelve a intentarlo.',
          boxTitle: 'Error al cifrar el documento',
          desc: 'No se pudo aplicar el cifrado de seguridad al documento PDF. Por favor intenta más tarde.',
          retryText: 'Reintentar Protección',
          title: '¡Oh no! No hemos podido proteger tu archivo.',
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
    const passwordInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-password"]');
    const confirmInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-confirm-password"]');

    if (passwordInput) passwordInput.value = '';
    if (confirmInput) confirmInput.value = '';
    if (executeBtn) executeBtn.disabled = true;

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="protect-doc-canvas"]');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    this.sidebarModal?.close();
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

export async function createProtectPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/protect-pdf/protect-pdf.html');
  const controller = new ProtectPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
