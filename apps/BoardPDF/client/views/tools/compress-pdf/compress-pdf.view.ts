import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
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
import { ClientPdfCompressLevel, CompressResultData } from './compress-pdf.types.js';
import { t } from '../../../services/i18n.service.js';

class CompressPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private isProcessing = false;
  private phaseManager: ToolPhaseManager | null = null;
  private selectedLevel: ClientPdfCompressLevel = 'recommended';
  private sidebarModal: ToolSidebarModalController | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();

    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: 'Seleccionar archivo PDF',
        desc: t('ui.reduce_el_tamano_de_tus_archivos_pdf_opt'),
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files) => {
          if (files.length > 0) {
            this.handleFileSelected(files[0]);
          }
        },
        title: 'Comprimir PDF',
      },
      onRetry: () => {
        if (this.currentFile) {
          this.phaseManager?.setPhase('workspace');
        } else {
          this.resetSelectedFile();
        }
      },
      toolId: 'compress-pdf',
      toolName: 'Comprimir PDF',
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

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="compress-pdf-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');

    if (sidebar && backdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const compressBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-compress-action"]');

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetSelectedFile();
    }, { signal });

    const levelToggle = this.container.querySelector<HTMLElement>('[data-ref="compress-level-toggle"]');
    levelToggle?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLButtonElement>('button[data-level]');
      if (!btn) return;

      const level = btn.getAttribute('data-level') as ClientPdfCompressLevel;
      if (level) {
        this.setCompressLevel(level);
      }
    }, { signal });

    compressBtn?.addEventListener('click', () => {
      void this.handleCompress(compressBtn);
    }, { signal });
  }

  private readonly qualityDetails: Record<ClientPdfCompressLevel, { desc: string; title: string }> = {
    extreme: {
      desc: t('ui.menor_calidad_de_imagen_maxima_reduccion'),
      title: 'Compresión extrema',
    },
    low: {
      desc: t('ui.alta_calidad_visual_menor_reduccion_de_t'),
      title: 'Baja compresión',
    },
    recommended: {
      desc: t('ui.buena_calidad_visual_reduccion_sustancia'),
      title: 'Compresión recomendada',
    },
  };

  private setCompressLevel(level: ClientPdfCompressLevel): void {
    this.selectedLevel = level;

    const toggle = this.container.querySelector<HTMLElement>('[data-ref="compress-level-toggle"]');
    if (toggle) {
      toggle.setAttribute('data-level', level);
      const activeIdx = level === 'extreme' ? 0 : level === 'recommended' ? 1 : 2;
      toggle.setAttribute('data-active', activeIdx.toString());
    }

    const btns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-compress-"]');
    btns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-level') === level);
    });

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="compress-quality-title"]');
    const descEl = this.container.querySelector<HTMLElement>('[data-ref="compress-quality-desc"]');
    const detail = this.qualityDetails[level];
    if (titleEl && detail) titleEl.textContent = detail.title;
    if (descEl && detail) descEl.textContent = detail.desc;
  }

  private handleFileSelected(file: File): void {
    this.hideError();
    const limits = getCurrentUserToolLimits('compress-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolName: 'Comprimir PDF',
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;

    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-size"]');
    const compressBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-compress-action"]');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (compressBtn) compressBtn.disabled = false;

    this.phaseManager?.setPhase('workspace');

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

    const compressBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-compress-action"]');
    if (compressBtn) compressBtn.disabled = true;

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="doc-preview-canvas"]');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    this.sidebarModal?.close();
    this.setCompressLevel('recommended');
    this.phaseManager?.setPhase('dropzone');
    this.hideError();
  }

  private async handleCompress(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const formData = new FormData();
        formData.append('pdf', this.currentFile as Blob, this.currentFile?.name);
        formData.append('level', this.selectedLevel);

        const docTitleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
        let customFilename = docTitleInput?.value.trim();
        if (customFilename) {
          if (!customFilename.toLowerCase().endsWith('.pdf')) customFilename += '.pdf';
          formData.append('filename', customFilename);
        }

        const response = await postFormWithProgress(
          API_ROUTES.tools.compressPdf.compress,
          formData,
          (progress) => {
            this.phaseManager?.updateUploadProgress(progress, 1);
          },
          this.abortController?.signal
        );
        const result = (await response.json()) as { data?: CompressResultData; error?: string; success: boolean };

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || t('ui.error_al_comprimir_el_archivo_pdf'));
        }

        const token = result.data.fileId;
        showToast(t('toasts.pdf_comprimido_con_exito'), 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.compressedSize,
          filename: customFilename || result.data.filename,
          returnText: 'Comprimir otro documento PDF',
          returnUrl: '/compress-pdf',
          subtitle: `El archivo "${this.currentFile?.name}" se ha comprimido exitosamente.`,
          title: '¡PDF comprimido con éxito!',
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : t('ui.error_inesperado_al_comprimir_el_pdf');
        this.phaseManager?.showError({
          boxText: t('ui.comprueba_que_el_documento_no_este_prote'),
          boxTitle: 'Error de compresión',
          desc: errorMessage,
          retryText: 'Reintentar Comprimir PDF',
          title: '¡Oh no! No hemos podido comprimir tu archivo.',
        });
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private showError(msg: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="compress-global-error"]');
    if (errorEl) {
      errorEl.textContent = msg;
      showElement(errorEl);
    }
    showToast(msg, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="compress-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

async function createCompressPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/compress-pdf/compress-pdf.html');
  const controller = new CompressPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { CompressPdfController, createCompressPdfView };
