import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { ToolZoomController, applyPageScaler } from '../../../utils/tool-zoom.util.js';
import { CropBoxPercent, CropPdfResponseData } from './crop-pdf.types.js';

type CropDragMode = 'draw' | 'e' | 'move' | 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'w';

class CropPdfController implements ViewController {
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
        buttonText: t('tools.select_pdf_btn'),
        desc: t('ui.recorta_las_paginas_de_tu_documento_pdf_'),
        hint: t('tools.dropzone_hint_pdf'),
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: t('tools.crop_pdf_title'),
      },
      sidebarRef: 'crop-pdf-sidebar',
      toolId: 'crop-pdf',
      toolName: t('tools.crop_pdf_title'),
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
    const cropBox = this.container.querySelector<HTMLElement>('[data-ref="crop-box"]');
    const wrap = this.container.querySelector<HTMLElement>('[data-ref="crop-preview-wrap"]');
    if (!overlay || !cropBox || !wrap) return;

    let isDragging = false;
    let dragMode: CropDragMode = 'move';
    let captureEl: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let startAnchorX = 0;
    let startAnchorY = 0;
    let startCrop: CropBoxPercent = { ...this.cropPercent };

    const getPointerPercent = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const px = Math.max(0, Math.min(100, ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100));
      const py = Math.max(0, Math.min(100, ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100));
      return { px, py, rect };
    };

    cropBox.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as HTMLElement | null;
      const handleEl = target?.closest<HTMLElement>('.crop-handle[data-handle]');
      const handle = handleEl?.getAttribute('data-handle') as CropDragMode | null;

      dragMode = handle || 'move';
      isDragging = true;
      captureEl = cropBox;
      startX = e.clientX;
      startY = e.clientY;
      startCrop = { ...this.cropPercent };
      try {
        cropBox.setPointerCapture(e.pointerId);
      } catch {}
    }, { signal });

    overlay.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const { px, py } = getPointerPercent(e);
      dragMode = 'draw';
      isDragging = true;
      captureEl = overlay;
      startX = e.clientX;
      startY = e.clientY;
      startAnchorX = px;
      startAnchorY = py;
      startCrop = { ...this.cropPercent };
      try {
        overlay.setPointerCapture(e.pointerId);
      } catch {}
    }, { signal });

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const { px, py, rect } = getPointerPercent(e);
      const dx = ((e.clientX - startX) / Math.max(1, rect.width)) * 100;
      const dy = ((e.clientY - startY) / Math.max(1, rect.height)) * 100;
      const minSize = 10;

      if (dragMode === 'draw') {
        const left = Math.min(startAnchorX, px);
        const top = Math.min(startAnchorY, py);
        const right = Math.max(startAnchorX, px);
        const bottom = Math.max(startAnchorY, py);
        const width = Math.max(minSize, right - left);
        const height = Math.max(minSize, bottom - top);
        this.cropPercent = {
          height: Math.round(Math.min(100 - top, height)),
          width: Math.round(Math.min(100 - left, width)),
          x: Math.round(Math.min(100 - minSize, left)),
          y: Math.round(Math.min(100 - minSize, top)),
        };
        this.updateCropDisplay();
        return;
      }

      if (dragMode === 'move') {
        const newX = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + dx));
        const newY = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + dy));
        this.cropPercent = {
          height: startCrop.height,
          width: startCrop.width,
          x: Math.round(newX),
          y: Math.round(newY),
        };
        this.updateCropDisplay();
        return;
      }

      let left = startCrop.x;
      let top = startCrop.y;
      let right = startCrop.x + startCrop.width;
      let bottom = startCrop.y + startCrop.height;

      if (dragMode.includes('w')) {
        left = Math.max(0, Math.min(right - minSize, startCrop.x + dx));
      }
      if (dragMode.includes('e')) {
        right = Math.min(100, Math.max(left + minSize, startCrop.x + startCrop.width + dx));
      }
      if (dragMode.includes('n')) {
        top = Math.max(0, Math.min(bottom - minSize, startCrop.y + dy));
      }
      if (dragMode.includes('s')) {
        bottom = Math.min(100, Math.max(top + minSize, startCrop.y + startCrop.height + dy));
      }

      this.cropPercent = {
        height: Math.round(bottom - top),
        width: Math.round(right - left),
        x: Math.round(left),
        y: Math.round(top),
      };
      this.updateCropDisplay();
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (captureEl) {
        try {
          captureEl.releasePointerCapture(e.pointerId);
        } catch {}
        captureEl = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { signal });
    window.addEventListener('pointerup', handlePointerUp, { signal });
    window.addEventListener('pointercancel', handlePointerUp, { signal });
  }

  private updateCropDisplay(): void {
    const cropBox = this.container.querySelector<HTMLElement>('[data-ref="crop-box"]');
    const maskTop = this.container.querySelector<HTMLElement>('[data-ref="mask-top"]');
    const maskBottom = this.container.querySelector<HTMLElement>('[data-ref="mask-bottom"]');
    const maskLeft = this.container.querySelector<HTMLElement>('[data-ref="mask-left"]');
    const maskRight = this.container.querySelector<HTMLElement>('[data-ref="mask-right"]');

    if (!cropBox || !maskTop || !maskBottom || !maskLeft || !maskRight) return;

    const { height, width, x, y } = this.cropPercent;

    cropBox.style.top = `${y}%`;
    cropBox.style.left = `${x}%`;
    cropBox.style.width = `${width}%`;
    cropBox.style.height = `${height}%`;

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
    this.hideError();

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      showToast(t('ui.selecciona_unicamente_un_archivo_pdf_val'), 'danger');
      return;
    }

    const limits = getCurrentUserToolLimits('crop-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'crop-pdf',
        toolName: t('tools.crop_pdf_title'),
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
      filenameInput.value = `${base}${t('tools.crop_default_suffix')}.pdf`;
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
      showToast(t('ui.no_se_pudo_leer_el_archivo_pdf_seleccion'), 'danger');
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
        this.container.querySelectorAll('.pdf-editor-thumbnail').forEach((el) => el.classList.remove('is-active'));
        thumbItem.classList.add('is-active');
        this.zoomController?.updatePageInfo(this.currentPage, this.totalPages);
        void this.renderCurrentPage();
      }, { signal: this.abortController?.signal });

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
    thumbs.forEach((thumb, idx) => {
      thumb.classList.toggle('is-active', idx + 1 === this.currentPage);
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
    this.hideError();

    const filenameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    const customName = filenameInput?.value.trim() || undefined;

    const optionsPayload = {
      applyToAll: this.cropAllPages,
      cropBox: this.cropPercent,
      filename: customName,
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

        this.phaseManager?.showProcessing(
          t('tools.crop_processing_title'),
          t('tools.crop_processing_subtitle')
        );

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || t('ui.ocurrio_un_error_al_recortar_el_document'));
        }

        const token = result.data.fileId;
        showToast(t('toasts.pdf_cropped_success'), 'success');
        await this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: result.data.filename,
          returnText: t('tools.crop_return_btn'),
          returnUrl: '/crop-pdf',
          subtitle: `${t('tools.crop_success_prefix')}"${this.currentFile?.name}".`,
          title: t('tools.crop_success_title'),
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : t('ui.error_inesperado_al_recortar_el_document');
        this.showError(errorMessage);
        this.phaseManager?.showError(errorMessage, () => {
          this.phaseManager?.setPhase('workspace');
        });
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
    this.hideError();

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-crop"]');
    if (executeBtn) executeBtn.disabled = true;

    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="crop-pdf-workspace"]');
    const filenameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');

    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    if (filenameInput) filenameInput.value = '';
    if (this.sidebarModal) this.sidebarModal.close();

    this.phaseManager?.setPhase('dropzone');
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="crop-global-error"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="crop-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

async function createCropPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/crop-pdf/crop-pdf.html');
  const controller = new CropPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { CropPdfController, createCropPdfView };
