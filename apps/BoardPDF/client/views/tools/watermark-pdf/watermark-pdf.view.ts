import { ToolStatusManager } from '../../../components/tool-status.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { pickDropboxFiles } from '../../../services/dropbox.service.js';
import { pickGoogleDriveFiles } from '../../../services/google-drive.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument, loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { saveDownloadPayloadAndNavigate } from '../../../services/tool-flow.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, bindFileDropzone, bindInlineControls, hideElement, setupDropdown, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { PageThumbnailItem, WatermarkPdfResponseData, WatermarkPosition, WatermarkType } from './watermark-pdf.types.js';

export class WatermarkPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private activeTab: WatermarkType = 'text';
  private container: HTMLElement;
  private currentFile: File | null = null;
  private dropdownControllers: Array<{ destroy: () => void }> = [];
  private fontFamily = 'Helvetica';
  private fontSize = 36;
  private isMosaic = false;
  private isProcessing = false;
  private layer: 'over' | 'under' = 'over';
  private pages: PageThumbnailItem[] = [];
  private pdfDocument: any = null;
  private position: WatermarkPosition = 'center';
  private rotation = 0;
  private sidebarModal: ToolSidebarModalController | null = null;
  private statusManager: ToolStatusManager | null = null;
  private transparency = 0;
  private watermarkImageFile: File | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-workspace"]');
    this.statusManager = new ToolStatusManager(workspace || this.container);
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.statusManager) {
      this.statusManager.destroy();
      this.statusManager = null;
    }
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
    this.dropdownControllers.forEach((ctrl) => ctrl.destroy());
    this.dropdownControllers = [];
    if (this.pdfDocument) {
      try {
        void this.pdfDocument.destroy();
      } catch {}
      this.pdfDocument = null;
    }
  }

  private async handleDriveImport(): Promise<void> {
    if (this.isProcessing) return;
    this.hideError();
    try {
      const files = await pickGoogleDriveFiles({ multiselect: false });
      if (files.length > 0) {
        await this.handleFileSelected(files[0]);
      }
    } catch (err: any) {
      this.showError(err?.message || 'Error al importar archivo desde Google Drive.');
    }
  }

  private async handleDropboxImport(): Promise<void> {
    if (this.isProcessing) return;
    this.hideError();
    try {
      const files = await pickDropboxFiles({ multiselect: false });
      if (files.length > 0) {
        await this.handleFileSelected(files[0]);
      }
    } catch (err: any) {
      this.showError(err?.message || 'Error al importar archivo desde Dropbox.');
    }
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    const imageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-watermark-image"]');
    const dropzone = this.container.querySelector<HTMLElement>('[data-ref="wm-dropzone"]');
    const browseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-browse-pdf"]');
    const heroDriveBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-drive"]');
    const heroDropboxBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-dropbox"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const sidebarBackdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const sidebarCloseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const sidebarDragZone = this.container.querySelector<HTMLElement>('[data-ref="wm-sidebar-drag-zone"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-sidebar"]');
    const pickImageBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pick-image"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-watermark"]');
    const fabAddBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-wm-fab-add"]');

    this.sidebarModal = setupToolSidebarModal({
      backdrop: sidebarBackdrop,
      closeBtn: sidebarCloseBtn,
      dragZone: sidebarDragZone,
      settingsBtn,
      sidebar,
      signal,
    });

    browseBtn?.addEventListener('click', () => fileInput?.click(), { signal });
    fabAddBtn?.addEventListener('click', () => fileInput?.click(), { signal });

    heroDriveBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.handleDriveImport();
    }, { signal });

    heroDropboxBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.handleDropboxImport();
    }, { signal });

    const secText = this.container.querySelector<HTMLElement>('[data-ref="section-text-options"]');
    const secImage = this.container.querySelector<HTMLElement>('[data-ref="section-image-options"]');
    const checkMosaic = this.container.querySelector<HTMLInputElement>('[data-ref="check-mosaic"]');

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="wm-dropzone-card"]');

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        void this.handleFileSelected(file);
      }
      fileInput.value = '';
    }, { signal });

    if (dropzoneCard) {
      bindFileDropzone({
        dropTarget: dropzoneCard,
        onFiles: (files) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        signal,
        visualTarget: dropzoneCard,
      });
    }

    const wmTypeToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-watermark-type"]');
    wmTypeToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]');
      if (!btn) return;
      const tab = btn.getAttribute('data-tab') as 'text' | 'image';
      if (!tab) return;
      this.activeTab = tab;
      wmTypeToggle.setAttribute('data-active', tab === 'text' ? '0' : '1');
      wmTypeToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      if (tab === 'text') {
        showElement(secText);
        hideElement(secImage);
      } else {
        hideElement(secText);
        showElement(secImage);
      }
    }, { signal });

    pickImageBtn?.addEventListener('click', () => imageInput?.click(), { signal });

    imageInput?.addEventListener('change', () => {
      const img = imageInput.files?.[0];
      if (img) {
        this.watermarkImageFile = img;
        const txtEl = this.container.querySelector<HTMLElement>('[data-ref="txt-picked-image"]');
        if (txtEl) txtEl.textContent = `Imagen: ${img.name}`;
      }
    }, { signal });

    const posCells = this.container.querySelectorAll<HTMLElement>('.wm-position-cell[data-pos]');
    posCells.forEach((cell) => {
      cell.addEventListener('click', () => {
        posCells.forEach((c) => c.classList.remove('is-selected'));
        cell.classList.add('is-selected');
        this.position = (cell.getAttribute('data-pos') as WatermarkPosition) || 'center';
        this.updateIndicators();
      }, { signal });
    });

    checkMosaic?.addEventListener('change', () => {
      this.isMosaic = checkMosaic.checked;
      this.updateIndicators();
    }, { signal });

    const layerToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-layer"]');
    layerToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-layer]');
      if (!btn) return;
      const val = btn.getAttribute('data-layer') as 'over' | 'under';
      if (!val) return;
      this.layer = val;
      layerToggle.setAttribute('data-active', val === 'over' ? '0' : '1');
      layerToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    }, { signal });

    const wrapperFont = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-wm-font"]');
    if (wrapperFont) {
      const ctrl = setupDropdown(wrapperFont, {
        onSelect: (val: string) => {
          this.fontFamily = val || 'Helvetica';
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const wrapperSize = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-wm-size"]');
    if (wrapperSize) {
      const ctrl = setupDropdown(wrapperSize, {
        onSelect: (val: string) => {
          this.fontSize = Number(val) || 36;
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const wrapperTransparency = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-transparency"]');
    if (wrapperTransparency) {
      const ctrl = setupDropdown(wrapperTransparency, {
        onSelect: (val: string) => {
          this.transparency = Number(val) || 0;
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const wrapperRotation = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-rotation"]');
    if (wrapperRotation) {
      const ctrl = setupDropdown(wrapperRotation, {
        onSelect: (val: string) => {
          this.rotation = Number(val) || 0;
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    executeBtn?.addEventListener('click', () => {
      if (this.currentFile) {
        void this.handleExecuteWatermark(executeBtn);
      }
    }, { signal });

    bindInlineControls(this.container, signal);
  }

  private async handleFileSelected(file: File): Promise<void> {
    if (this.isProcessing) return;
    this.hideError();

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      this.showError('Selecciona únicamente un archivo PDF válido.');
      return;
    }

    const limits = getCurrentUserToolLimits('watermark-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      this.showError(`El archivo PDF supera el tamaño máximo permitido de ${limits.maxFileSizeMB} MB.`);
      return;
    }

    this.currentFile = file;

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="wm-dropzone-card"]');
    const workspaceCard = this.container.querySelector<HTMLElement>('[data-ref="wm-workspace-card"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-watermark"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-workspace"]');
    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');

    hideElement(dropzoneCard);
    showElement(workspaceCard);
    showElement(sidebar);
    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

    if (outputNameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}_marca_de_agua.pdf`;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDocument = await loadPdfDocument(arrayBuffer);
      const count = this.pdfDocument.numPages || 1;

      this.pages = Array.from({ length: count }, (_, i) => ({
        id: `wm-page-${i + 1}`,
        originalIndex: i,
        pageNum: i + 1,
      }));

      const toPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-to-page"]');
      if (toPageInput) {
        toPageInput.value = String(count);
        toPageInput.max = String(count);
      }

      const fromPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-from-page"]');
      if (fromPageInput) {
        fromPageInput.max = String(count);
      }

      if (executeBtn) executeBtn.disabled = false;

      const countBadge = this.container.querySelector<HTMLElement>('[data-ref="pdf-count-badge"]');
      if (countBadge) countBadge.textContent = String(count);

      this.renderPagesGrid();
    } catch {
      this.showError('No se pudo procesar el archivo PDF. Asegúrate de que no esté dañado ni protegido.');
      this.resetToInitial();
    }
  }

  private renderPagesGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="wm-pages-grid"]');
    if (!grid) return;

    grid.innerHTML = this.pages.map((p) => `
      <div class="pdf-card wm-page-card" data-ref="card-page-${p.id}">
        <div class="pdf-card__sheet-wrapper">
          <div class="pdf-card__sheet">
            ${this.isMosaic
              ? `<div class="wm-mosaic-overlay" data-ref="mosaic-${p.id}">
                   ${Array.from({ length: 9 }).map(() => '<div class="wm-mosaic-dot"></div>').join('')}
                 </div>`
              : `<div class="wm-indicator-dot is-pos-${this.position}" data-ref="dot-${p.id}"></div>`
            }
            <canvas class="pdf-card__canvas" data-ref="canvas-${p.id}"></canvas>
          </div>
        </div>
      </div>
    `).join('');

    for (const page of this.pages) {
      void this.renderThumbnail(page);
    }
  }

  private updateIndicators(): void {
    this.renderPagesGrid();
  }

  private async renderThumbnail(item: PageThumbnailItem): Promise<void> {
    if (!this.pdfDocument) return;
    try {
      const page = await this.pdfDocument.getPage(item.originalIndex + 1);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = this.container.querySelector<HTMLCanvasElement>(`[data-ref="canvas-${item.id}"]`);
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch {}
  }

  private async handleExecuteWatermark(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    if (this.activeTab === 'image' && !this.watermarkImageFile) {
      this.showError('Por favor selecciona una imagen para usarla como marca de agua.');
      return;
    }

    const textInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-wm-text"]');
    const fromPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-from-page"]');
    const toPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-to-page"]');

    let optionsPayload: any = {
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fromPage: Math.max(1, Number(fromPageInput?.value) || 1),
      layer: this.layer,
      mosaic: this.isMosaic,
      position: this.position,
      rotation: this.rotation,
      text: textInput?.value || 'CONFIDENCIAL',
      toPage: Math.max(1, Number(toPageInput?.value) || this.pages.length),
      transparency: this.transparency,
      type: this.activeTab,
    };

    this.isProcessing = true;
    const workspaceCard = this.container.querySelector<HTMLElement>('[data-ref="wm-workspace-card"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-sidebar"]');
    hideElement(workspaceCard);
    hideElement(sidebar);
    this.statusManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
        const customFilename = outputNameInput?.value.trim();

        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        if (this.activeTab === 'image' && this.watermarkImageFile) {
          formData.append('watermarkImage', this.watermarkImageFile, this.watermarkImageFile.name);
        }
        if (customFilename) {
          optionsPayload = { ...optionsPayload, filename: customFilename } as any;
        }
        formData.append('options', JSON.stringify(optionsPayload));

        const response = await postFormWithProgress(
          API_ROUTES.tools.watermarkPdf.process,
          formData,
          (progress) => {
            this.statusManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as {
          data?: WatermarkPdfResponseData;
          error?: string;
          success: boolean;
        };

        this.statusManager?.showProcessingState({
          subtitle: 'Estampando elementos con la opacidad y posición configuradas',
          title: 'Insertando marca de agua en el PDF...',
        });

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || 'Ocurrió un error al insertar la marca de agua.');
        }

        const token = result.data.fileId;
        showToast('Marca de agua insertada con éxito.', 'success');
        saveDownloadPayloadAndNavigate({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: customFilename || result.data.filename,
          returnText: 'Insertar otra marca de agua',
          returnUrl: '/watermark-pdf',
          subtitle: `Se ha aplicado exitosamente la marca de agua en "${this.currentFile?.name}".`,
          title: '¡Marca de agua insertada!',
          token,
        });
      } catch (err: unknown) {
        showElement(workspaceCard);
        showElement(sidebar);
        this.isProcessing = false;
        const errorMessage = err instanceof Error ? err.message : 'Error inesperado al insertar la marca de agua.';
        this.statusManager?.showError(errorMessage, () => {
          this.statusManager?.hide();
        });
        this.showError(errorMessage);
      }
    });
  }

  private resetToInitial(): void {
    this.currentFile = null;
    this.pages = [];
    this.pdfDocument = null;
    this.isProcessing = false;
    this.watermarkImageFile = null;
    this.statusManager?.hide();

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    const imageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-watermark-image"]');
    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="wm-dropzone-card"]');
    const workspaceCard = this.container.querySelector<HTMLElement>('[data-ref="wm-workspace-card"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-watermark"]');
    const txtImgEl = this.container.querySelector<HTMLElement>('[data-ref="txt-picked-image"]');

    if (fileInput) fileInput.value = '';
    if (imageInput) imageInput.value = '';
    showElement(dropzoneCard);
    hideElement(workspaceCard);
    if (executeBtn) executeBtn.disabled = true;
    if (txtImgEl) txtImgEl.textContent = 'Añadir Imagen (PNG/JPG)';

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-workspace"]');
    hideElement(sidebar);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = 'documento_marca_de_agua.pdf';
    if (this.sidebarModal) this.sidebarModal.close();
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="wm-global-error"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="wm-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

export async function createWatermarkPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/watermark-pdf/watermark-pdf.html');
  const controller = new WatermarkPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
