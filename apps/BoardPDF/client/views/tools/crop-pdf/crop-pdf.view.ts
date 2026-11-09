import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { ToolZoomController, applyPageScaler } from '../../../utils/tool-zoom.util.js';
import { CropBoxPercent, CropPdfResponseData } from './crop-pdf.types.js';

export class CropPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private cropAllPages = true;
  private cropPercent: CropBoxPercent = { height: 90, width: 90, x: 5, y: 5 };
  private currentBaseHeight = 0;
  private currentBaseWidth = 0;
  private currentFile: File | null = null;
  private currentPage = 1;
  private isProcessing = false;
  private pdfDocument: any = null;
  private phaseManager: ToolPhaseManager | null = null;
  private sidebarModal: ToolSidebarModalController | null = null;
  private totalPages = 1;
  private zoomController: ToolZoomController | null = null;
  private zoomLevel = 1.0;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: 'Seleccionar PDF',
        desc: 'Recorta las páginas de tu documento PDF de forma interactiva y ajusta los márgenes a tu medida.',
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: 'Recortar PDF',
      },
      sidebarRef: 'crop-pdf-sidebar',
      toolId: 'crop-pdf',
      toolName: 'Recortar PDF',
      topHeaderRef: 'component-top',
      workspaceCardRef: 'crop-workspace-card',
    });
    await this.phaseManager.init();
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.zoomController) {
      this.zoomController.destroy();
      this.zoomController = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.phaseManager) {
      this.phaseManager.destroy();
      this.phaseManager = null;
    }
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
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

    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const sidebarBackdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const sidebarCloseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const sidebarDragZone = this.container.querySelector<HTMLElement>('[data-ref="crop-sidebar-drag-zone"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="crop-pdf-sidebar"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-crop"]');

    this.sidebarModal = setupToolSidebarModal({
      backdrop: sidebarBackdrop,
      closeBtn: sidebarCloseBtn,
      dragZone: sidebarDragZone,
      settingsBtn,
      sidebar,
      signal,
    });

    executeBtn?.addEventListener('click', () => {
      void this.handleExecuteCrop(executeBtn);
    }, { signal });

    const radioAll = this.container.querySelector<HTMLInputElement>('[data-ref="radio-crop-all"]');
    const radioCurrent = this.container.querySelector<HTMLInputElement>('[data-ref="radio-crop-current"]');
    radioAll?.addEventListener('change', () => {
      this.cropAllPages = true;
    }, { signal });
    radioCurrent?.addEventListener('change', () => {
      this.cropAllPages = false;
    }, { signal });

    const btnCropAll = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-crop-all"]');
    const btnCropCurrent = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-crop-current"]');
    const cropModeToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-crop-mode"]');
    btnCropAll?.addEventListener('click', () => {
      this.cropAllPages = true;
      btnCropAll.classList.add('is-active', 'active');
      btnCropCurrent?.classList.remove('is-active', 'active');
      cropModeToggle?.setAttribute('data-active', '0');
    }, { signal });
    btnCropCurrent?.addEventListener('click', () => {
      this.cropAllPages = false;
      btnCropCurrent.classList.add('is-active', 'active');
      btnCropAll?.classList.remove('is-active', 'active');
      cropModeToggle?.setAttribute('data-active', '1');
    }, { signal });

    const inputMarginTop = this.container.querySelector<HTMLInputElement>('[data-ref="input-margin-top"]');
    const inputMarginBottom = this.container.querySelector<HTMLInputElement>('[data-ref="input-margin-bottom"]');
    const inputMarginLeft = this.container.querySelector<HTMLInputElement>('[data-ref="input-margin-left"]');
    const inputMarginRight = this.container.querySelector<HTMLInputElement>('[data-ref="input-margin-right"]');

    const handleMarginChange = () => {
      const top = Math.max(0, Math.min(45, parseInt(inputMarginTop?.value || '5', 10)));
      const bottom = Math.max(0, Math.min(45, parseInt(inputMarginBottom?.value || '5', 10)));
      const left = Math.max(0, Math.min(45, parseInt(inputMarginLeft?.value || '5', 10)));
      const right = Math.max(0, Math.min(45, parseInt(inputMarginRight?.value || '5', 10)));

      this.cropPercent = {
        height: 100 - top - bottom,
        width: 100 - left - right,
        x: left,
        y: top,
      };
      this.updateCropDisplay();
    };

    [inputMarginTop, inputMarginBottom, inputMarginLeft, inputMarginRight].forEach((input) => {
      input?.addEventListener('input', handleMarginChange, { signal });
    });

    this.zoomController = new ToolZoomController({
      container: this.container,
      initialZoom: 1.0,
      maxZoom: 3.0,
      minZoom: 0.1,
      onZoomChange: (level) => this.applyZoom(level),
      scrollContainer: this.container.querySelector<HTMLElement>('[data-ref="crop-scroll-container"]'),
      signal,
    });

    this.bindCropHandles(signal);
  }

  private applyZoom(level: number): void {
    this.zoomLevel = level;
    const scaler = this.container.querySelector<HTMLElement>('[data-ref="crop-scaler"]');
    const wrap = this.container.querySelector<HTMLElement>('[data-ref="crop-preview-wrap"]');
    if (scaler && wrap && this.currentBaseWidth && this.currentBaseHeight) {
      applyPageScaler(scaler, wrap, this.currentBaseWidth, this.currentBaseHeight, level);
    }
  }

  private bindCropHandles(signal: AbortSignal): void {
    const overlay = this.container.querySelector<HTMLElement>('[data-ref="crop-overlay"]');
    const wrap = this.container.querySelector<HTMLElement>('[data-ref="crop-preview-wrap"]');
    if (!overlay || !wrap) return;

    let isDragging = false;
    let dragMode: 'move' | 'se' | 'sw' | 'ne' | 'nw' = 'move';
    let startX = 0;
    let startY = 0;
    let startCrop = { ...this.cropPercent };

    overlay.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startCrop = { ...this.cropPercent };

      const rect = overlay.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const handleZone = 24;

      if (clickX < handleZone && clickY < handleZone) dragMode = 'nw';
      else if (clickX > rect.width - handleZone && clickY < handleZone) dragMode = 'ne';
      else if (clickX < handleZone && clickY > rect.height - handleZone) dragMode = 'sw';
      else if (clickX > rect.width - handleZone && clickY > rect.height - handleZone) dragMode = 'se';
      else dragMode = 'move';

      overlay.setPointerCapture(e.pointerId);
    }, { signal });

    overlay.addEventListener('pointermove', (e: PointerEvent) => {
      if (!isDragging) return;
      const wrapRect = wrap.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - startX) / wrapRect.width) * 100;
      const deltaYPercent = ((e.clientY - startY) / wrapRect.height) * 100;

      if (dragMode === 'move') {
        let newX = startCrop.x + deltaXPercent;
        let newY = startCrop.y + deltaYPercent;
        newX = Math.max(0, Math.min(100 - startCrop.width, newX));
        newY = Math.max(0, Math.min(100 - startCrop.height, newY));
        this.cropPercent.x = Math.round(newX);
        this.cropPercent.y = Math.round(newY);
      } else if (dragMode === 'se') {
        let newW = startCrop.width + deltaXPercent;
        let newH = startCrop.height + deltaYPercent;
        newW = Math.max(10, Math.min(100 - startCrop.x, newW));
        newH = Math.max(10, Math.min(100 - startCrop.y, newH));
        this.cropPercent.width = Math.round(newW);
        this.cropPercent.height = Math.round(newH);
      }

      this.updateCropDisplay();
    }, { signal });

    const handlePointerUp = (e: PointerEvent) => {
      if (isDragging) {
        isDragging = false;
        try {
          overlay.releasePointerCapture(e.pointerId);
        } catch {}
      }
    };

    overlay.addEventListener('pointerup', handlePointerUp, { signal });
    overlay.addEventListener('pointercancel', handlePointerUp, { signal });
  }

  private updateCropDisplay(): void {
    const overlay = this.container.querySelector<HTMLElement>('[data-ref="crop-overlay"]');
    const maskTop = this.container.querySelector<HTMLElement>('[data-ref="mask-top"]');
    const maskBottom = this.container.querySelector<HTMLElement>('[data-ref="mask-bottom"]');
    const maskLeft = this.container.querySelector<HTMLElement>('[data-ref="mask-left"]');
    const maskRight = this.container.querySelector<HTMLElement>('[data-ref="mask-right"]');

    if (!overlay || !maskTop || !maskBottom || !maskLeft || !maskRight) return;

    const { height, width, x, y } = this.cropPercent;

    overlay.style.top = `${y}%`;
    overlay.style.left = `${x}%`;
    overlay.style.width = `${width}%`;
    overlay.style.height = `${height}%`;

    maskTop.style.top = '0';
    maskTop.style.height = `${y}%`;
    maskTop.style.left = '0';
    maskTop.style.width = '100%';

    maskBottom.style.top = `${y + height}%`;
    maskBottom.style.height = `${100 - (y + height)}%`;
    maskBottom.style.left = '0';
    maskBottom.style.width = '100%';

    maskLeft.style.top = `${y}%`;
    maskLeft.style.height = `${height}%`;
    maskLeft.style.left = '0';
    maskLeft.style.width = `${x}%`;

    maskRight.style.top = `${y}%`;
    maskRight.style.height = `${height}%`;
    maskRight.style.left = `${x + width}%`;
    maskRight.style.width = `${100 - (x + width)}%`;
  }

  private async handleFileSelected(file: File): Promise<void> {
    if (this.isProcessing) return;

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      showToast('Selecciona únicamente un archivo PDF válido.', 'danger');
      return;
    }

    const limits = getCurrentUserToolLimits('crop-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'crop-pdf',
        toolName: 'Recortar PDF',
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;
    this.currentPage = 1;
    this.cropPercent = { height: 90, width: 90, x: 5, y: 5 };

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-crop"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="crop-pdf-workspace"]');
    const filenameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');

    this.phaseManager?.setPhase('workspace');

    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
    if (filenameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      filenameInput.value = `${base}_recortado.pdf`;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDocument = await loadPdfDocument(arrayBuffer);
      this.totalPages = this.pdfDocument.numPages || 1;
      if (executeBtn) executeBtn.disabled = false;

      this.zoomController?.showFooter();
      this.zoomController?.updatePageInfo(this.currentPage, this.totalPages);

      await this.renderThumbnails();
      await this.renderCurrentPage();
      this.updateCropDisplay();
    } catch {
      showToast('No se pudo leer el archivo PDF seleccionado. Asegúrate de que no esté dañado ni protegido.', 'danger');
      this.resetToInitial();
    }
  }

  private async renderThumbnails(): Promise<void> {
    if (!this.pdfDocument) return;
    const container = this.container.querySelector<HTMLElement>('[data-ref="crop-thumbnails-container"]');
    if (!container) return;
    container.innerHTML = '';

    const numPages = this.pdfDocument.numPages;
    for (let i = 1; i <= numPages; i++) {
      const pageNum = i;
      const thumbItem = document.createElement('div');
      thumbItem.className = `pdf-editor-thumbnail ${pageNum === this.currentPage ? 'is-active' : ''}`;
      thumbItem.setAttribute('data-ref', `crop-thumb-page-${pageNum}`);

      const sheet = document.createElement('div');
      sheet.className = 'pdf-editor-thumbnail__sheet';

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-editor-thumbnail__canvas';
      sheet.appendChild(canvas);

      const badge = document.createElement('span');
      badge.className = 'pdf-editor-thumbnail__badge';
      badge.textContent = `#${i}`;

      thumbItem.appendChild(sheet);
      thumbItem.appendChild(badge);
      container.appendChild(thumbItem);

      thumbItem.addEventListener('click', () => {
        if (this.currentPage === pageNum) return;
        this.currentPage = pageNum;
        this.container.querySelectorAll('.pdf-editor-thumbnail').forEach((t) => t.classList.remove('is-active'));
        thumbItem.classList.add('is-active');
        this.zoomController?.updatePageInfo(this.currentPage, this.totalPages);
        void this.renderCurrentPage();
      });

      try {
        const page = await this.pdfDocument.getPage(i);
        const origVp = page.getViewport({ scale: 1 });
        const thumbScale = 100 / origVp.width;
        const vp = page.getViewport({ scale: thumbScale });
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.floor(vp.width * dpr);
        canvas.height = Math.floor(vp.height * dpr);
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
        }
      } catch {}
    }
  }

  private async renderCurrentPage(): Promise<void> {
    if (!this.pdfDocument) return;

    const thumbs = this.container.querySelectorAll<HTMLElement>('.pdf-editor-thumbnail');
    thumbs.forEach((t, idx) => {
      t.classList.toggle('is-active', idx + 1 === this.currentPage);
    });

    try {
      const page = await this.pdfDocument.getPage(this.currentPage);
      const origVp = page.getViewport({ scale: 1 });
      const baseWidth = 760;
      const displayScale = baseWidth / origVp.width;
      const baseHeight = Math.floor(origVp.height * displayScale);
      const viewport = page.getViewport({ scale: displayScale });
      const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="crop-canvas"]');
      const wrap = this.container.querySelector<HTMLElement>('[data-ref="crop-preview-wrap"]');
      if (!canvas || !wrap) return;

      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(baseWidth * dpr);
      canvas.height = Math.floor(baseHeight * dpr);
      canvas.style.width = `${baseWidth}px`;
      canvas.style.height = `${baseHeight}px`;

      wrap.style.width = `${baseWidth}px`;
      wrap.style.height = `${baseHeight}px`;

      this.currentBaseWidth = baseWidth;
      this.currentBaseHeight = baseHeight;
      this.applyZoom(this.zoomLevel);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    } catch {}
  }

  private async handleExecuteCrop(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;

    const optionsPayload = {
      applyToAll: this.cropAllPages,
      cropBox: this.cropPercent,
      targetPageIndex: this.currentPage - 1,
    };

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        formData.append('options', JSON.stringify(optionsPayload));

        const response = await postFormWithProgress(
          API_ROUTES.tools.cropPdf.process,
          formData,
          (progress) => {
            this.phaseManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as {
          data?: CropPdfResponseData;
          error?: string;
          success: boolean;
        };

        this.phaseManager?.showProcessing('Recortando páginas del documento PDF...', 'Ajustando los márgenes visuales y vectoriales del documento');

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || 'Ocurrió un error al recortar el documento.');
        }

        const token = result.data.fileId;
        showToast('PDF recortado correctamente.', 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: result.data.filename,
          returnText: 'Recortar otro documento PDF',
          returnUrl: '/crop-pdf',
          subtitle: `Se ha aplicado exitosamente el área de recorte a "${this.currentFile?.name}".`,
          title: '¡PDF recortado con éxito!',
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Error inesperado al recortar el documento.';
        this.phaseManager?.showError(errorMessage, () => {
          this.phaseManager?.setPhase('workspace');
        });
        showToast(errorMessage, 'danger');
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private resetToInitial(): void {
    this.zoomController?.hideFooter();
    this.zoomController?.setZoom(1.0);
    this.currentFile = null;
    this.pdfDocument = null;
    this.isProcessing = false;
    this.currentPage = 1;
    this.totalPages = 1;
    this.cropPercent = { height: 90, width: 90, x: 5, y: 5 };

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-crop"]');
    if (executeBtn) executeBtn.disabled = true;

    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="crop-pdf-workspace"]');
    const filenameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');

    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    if (filenameInput) filenameInput.value = 'documento_recortado.pdf';
    if (this.sidebarModal) this.sidebarModal.close();

    this.phaseManager?.setPhase('dropzone');
  }
}

export async function createCropPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/crop-pdf/crop-pdf.html');
  const controller = new CropPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
