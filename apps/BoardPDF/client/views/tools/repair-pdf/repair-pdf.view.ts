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
import { RepairResultData } from './repair-pdf.types.js';

class RepairPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private isProcessing = false;
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
        desc: t('ui.recupera_y_repara_datos_de_documentos_pd'),
        hint: t('tools.drop_pdf_hint'),
        multiselect: false,
        onFilesSelected: (files) => {
          if (files.length > 0) {
            this.handleFileSelected(files[0]);
          }
        },
        title: t('home.tool_repair_pdf_title'),
      },
      onRetry: () => {
        if (this.currentFile) {
          this.phaseManager?.setPhase('workspace');
        } else {
          this.resetSelectedFile();
        }
      },
      toolId: 'repair-pdf',
      toolName: t('home.tool_repair_pdf_title'),
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
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'repair-pdf',
        toolName: t('home.tool_repair_pdf_title'),
        type: 'file_size',
      });
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

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}_${t('tools.repair_filename_suffix')}.pdf`;
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

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = '';

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
        const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
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
          t('tools.repair_pdf_processing'),
          t('ui.reconstruyendo_la_tabla_de_referencias_c')
        );

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || t('ui.error_al_reparar_el_archivo_pdf'));
        }

        const token = result.data.fileId;
        showToast(t('toasts.pdf_reparado_con_exito'), 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.repairedSize,
          filename: result.data.filename,
          returnText: t('tools.repair_pdf_return_text'),
          returnUrl: '/repair-pdf',
          subtitle: t('ui.tu_archivo_ha_sido_analizado_y_reparado_'),
          title: t('tools.repair_pdf_completed_title'),
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : t('ui.error_inesperado_al_reparar_el_archivo_p');
        this.showError(errorMessage);
        this.phaseManager?.showError({
          boxText: t('ui.comprueba_que_el_documento_no_este_danad'),
          boxTitle: t('tools.repair_error_box_title'),
          desc: errorMessage,
          retryText: t('tools.repair_retry_btn'),
          title: t('tools.repair_error_title'),
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

async function createRepairPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/repair-pdf/repair-pdf.html');
  const controller = new RepairPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { RepairPdfController, createRepairPdfView };
