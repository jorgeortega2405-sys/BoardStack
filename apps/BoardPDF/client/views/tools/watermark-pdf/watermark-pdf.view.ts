import { FontDrawerComponent, SelectedFontConfig } from '../../../components/font-drawer.component.js';
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
import { bindInlineControls, hideElement, setupDropdown, setupToolSidebarModal, showElement, ToolSidebarModalController, withButtonLoading } from '../../../utils/dom.util.js';
import { PageThumbnailItem, WatermarkPdfResponseData, WatermarkPosition, WatermarkType } from './watermark-pdf.types.js';

class WatermarkPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private activeTab: WatermarkType = 'text';
  private container: HTMLElement;
  private currentFile: File | null = null;
  private dropdownControllers: Array<{ destroy: () => void }> = [];
  private fontDrawer: FontDrawerComponent | null = null;
  private fontFamily = 'Helvetica';
  private fontSize = 36;
  private fontStyle: 'italic' | 'normal' = 'normal';
  private fontWeight = 400;
  private isMosaic = false;
  private isProcessing = false;
  private layer: 'over' | 'under' = 'over';
  private pages: PageThumbnailItem[] = [];
  private pdfDocument: any = null;
  private phaseManager: ToolPhaseManager | null = null;
  private position: WatermarkPosition = 'center';
  private rotation = 0;
  private sidebarModal: ToolSidebarModalController | null = null;
  private transparency = 0;
  private watermarkImageFile: File | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: t('tools.select_pdf'),
        desc: t('ui.anade_marcas_de_agua_personalizadas_de_t'),
        hint: t('tools.drop_pdf_hint'),
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: t('tools.watermark_pdf_title'),
      },
      sidebarRef: 'watermark-pdf-sidebar',
      toolId: 'watermark-pdf',
      toolName: t('tools.watermark_pdf_title'),
      topHeaderRef: 'component-top',
      workspaceCardRef: 'wm-workspace-card',
    });
    await this.phaseManager.init();
    renderIcons(this.container);

    const textInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-wm-text"]');
    if (textInput && !textInput.value) {
      textInput.value = t('tools.watermark_default_text');
    }

    this.initFontDrawer();
    this.bindEvents();
  }

  public destroy(): void {
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
    if (this.fontDrawer) {
      this.fontDrawer.destroy();
      this.fontDrawer = null;
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

  private initFontDrawer(): void {
    const layoutEl = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-layout"]');
    const triggerBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-wm-font-drawer"]');
    const triggerLabel = this.container.querySelector<HTMLElement>('[data-ref="wm-font-selected-label"]');
    if (!layoutEl) return;

    this.fontDrawer = new FontDrawerComponent({
      initialFont: {
        family: this.fontFamily,
        style: this.fontStyle,
        weight: this.fontWeight,
      },
      mountPoint: layoutEl,
      onChange: (font: SelectedFontConfig) => {
        this.fontFamily = font.family;
        this.fontWeight = font.weight;
        this.fontStyle = font.style;
        if (triggerLabel) {
          triggerLabel.textContent = font.displayName;
        }
        this.updateIndicators();
      },
      onClose: () => {
        triggerBtn?.classList.remove('is-active');
      },
    });
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const sidebarBackdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const sidebarCloseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const sidebarDragZone = this.container.querySelector<HTMLElement>('[data-ref="wm-sidebar-drag-zone"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-sidebar"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-watermark"]');

    this.sidebarModal = setupToolSidebarModal({
      backdrop: sidebarBackdrop,
      closeBtn: sidebarCloseBtn,
      dragZone: sidebarDragZone,
      settingsBtn,
      sidebar,
      signal,
    });

    executeBtn?.addEventListener('click', () => {
      void this.handleExecuteWatermark(executeBtn);
    }, { signal });

    const fontDrawerBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-wm-font-drawer"]');
    fontDrawerBtn?.addEventListener('click', () => {
      if (!this.fontDrawer) return;
      this.fontDrawer.toggle();
      fontDrawerBtn.classList.toggle('is-active', this.fontDrawer.isOpen());
    }, { signal });

    const typePill = this.container.querySelector<HTMLElement>('[data-ref="toggle-watermark-type"]');
    const typeButtons = typePill?.querySelectorAll<HTMLButtonElement>('.component-tab, .component-button, button');
    typeButtons?.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        typeButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        typePill?.setAttribute('data-active', index.toString());
        this.activeTab = (btn.getAttribute('data-type') || 'text') as WatermarkType;

        const textSection = this.container.querySelector<HTMLElement>('[data-ref="section-text-options"]');
        const imgSection = this.container.querySelector<HTMLElement>('[data-ref="section-image-options"]');
        if (this.activeTab === 'text') {
          showElement(textSection);
          hideElement(imgSection);
        } else {
          hideElement(textSection);
          showElement(imgSection);
          this.fontDrawer?.close();
        }
      }, { signal });
    });

    const textInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-wm-text"]');
    textInput?.addEventListener('input', () => {
      this.updateIndicators();
    }, { signal });

    const layerToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-layer"]');
    const layerButtons = layerToggle?.querySelectorAll<HTMLButtonElement>('.component-tab, .component-button, button');
    layerButtons?.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        layerButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        layerToggle?.setAttribute('data-active', index.toString());
        this.layer = (btn.getAttribute('data-layer') || 'over') as 'over' | 'under';
      }, { signal });
    });

    const posGrid = this.container.querySelector<HTMLElement>('[data-ref="wm-position-box"]');
    const posCells = posGrid?.querySelectorAll<HTMLButtonElement>('.wm-position-cell');
    posCells?.forEach((cell) => {
      cell.addEventListener('click', () => {
        posCells.forEach((c) => c.classList.remove('is-selected'));
        cell.classList.add('is-selected');
        this.position = (cell.getAttribute('data-pos') || 'center') as WatermarkPosition;
        this.updateIndicators();
      }, { signal });
    });

    const mosaicCheck = this.container.querySelector<HTMLInputElement>('[data-ref="check-mosaic"]');
    mosaicCheck?.addEventListener('change', () => {
      this.isMosaic = mosaicCheck.checked;
      this.updateIndicators();
    }, { signal });

    const imageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-watermark-image"]');
    const btnPickImage = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pick-image"]');
    btnPickImage?.addEventListener('click', () => imageInput?.click(), { signal });

    imageInput?.addEventListener('change', () => {
      const file = imageInput.files?.[0];
      if (file) {
        this.watermarkImageFile = file;
        const txtImgEl = this.container.querySelector<HTMLElement>('[data-ref="txt-picked-image"]');
        if (txtImgEl) txtImgEl.textContent = file.name;
      }
    }, { signal });

    bindInlineControls(this.container, signal);
    this.setupDropdowns();
  }

  private setupDropdowns(): void {
    const rotWrap = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-rotation"]');
    if (rotWrap) {
      const ctrl = setupDropdown(rotWrap, {
        isSelect: true,
        onSelect: (val: string, item?: HTMLElement) => {
          this.rotation = Number(val) || 0;
          const text = rotWrap.querySelector<HTMLElement>('[data-ref="wm-rotation-selected-text"]');
          if (text) {
            text.textContent = val === '0' ? t('tools.watermark_rotation_none') : `${val}°`;
          }
          rotWrap.querySelectorAll<HTMLElement>('[data-ref^="check-rot-"]').forEach((c) => c.classList.add('is-hidden'));
          item?.querySelector<HTMLElement>('[data-ref^="check-rot-"]')?.classList.remove('is-hidden');
          this.updateIndicators();
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const transWrap = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-transparency"]');
    if (transWrap) {
      const ctrl = setupDropdown(transWrap, {
        isSelect: true,
        onSelect: (val: string, item?: HTMLElement) => {
          this.transparency = Number(val) || 0;
          const text = transWrap.querySelector<HTMLElement>('[data-ref="wm-transparency-selected-text"]');
          if (text) {
            text.textContent = val === '0' ? t('tools.watermark_transparency_none') : `${val}%`;
          }
          transWrap.querySelectorAll<HTMLElement>('[data-ref^="check-trans-"]').forEach((c) => c.classList.add('is-hidden'));
          item?.querySelector<HTMLElement>('[data-ref^="check-trans-"]')?.classList.remove('is-hidden');
          this.updateIndicators();
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const sizeWrap = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-wm-size"]');
    if (sizeWrap) {
      const ctrl = setupDropdown(sizeWrap, {
        isSelect: true,
        onSelect: (val: string, item?: HTMLElement) => {
          const parsed = Number(val) || 36;
          this.fontSize = parsed;
          const text = sizeWrap.querySelector<HTMLElement>('[data-ref="wm-size-selected-text"]');
          if (text) {
            text.textContent = `${parsed} pt`;
          }
          sizeWrap.querySelectorAll<HTMLElement>('[data-ref^="check-wm-size-"]').forEach((c) => c.classList.add('is-hidden'));
          item?.querySelector<HTMLElement>('[data-ref^="check-wm-size-"]')?.classList.remove('is-hidden');
          this.updateIndicators();
        },
      });
      this.dropdownControllers.push(ctrl);
    }
  }

  private async handleFileSelected(file: File): Promise<void> {
    if (this.isProcessing) return;
    this.hideError();

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      this.showError(t('ui.selecciona_unicamente_un_archivo_pdf_val'));
      return;
    }

    const limits = getCurrentUserToolLimits('watermark-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'watermark-pdf',
        toolName: t('tools.watermark_pdf_title'),
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-watermark"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-workspace"]');
    const filenameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');

    this.phaseManager?.setPhase('workspace');

    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
    if (filenameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      filenameInput.value = `${base}_${t('tools.watermark_filename_suffix')}.pdf`;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDocument = await loadPdfDocument(arrayBuffer);
      const numPages = this.pdfDocument.numPages || 1;

      this.pages = Array.from({ length: numPages }, (_, i) => ({
        id: `wm-page-${i + 1}`,
        originalIndex: i,
        pageNum: i + 1,
      }));

      const toPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-to-page"]');
      if (toPageInput) {
        toPageInput.max = numPages.toString();
        toPageInput.value = numPages.toString();
      }
      const fromPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-from-page"]');
      if (fromPageInput) {
        fromPageInput.max = numPages.toString();
      }

      if (executeBtn) executeBtn.disabled = false;
      this.renderPagesGrid();
    } catch {
      this.showError(t('ui.no_se_pudo_leer_el_archivo_pdf_seleccion'));
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
        <div class="pdf-card__footer">
          <span class="pdf-card__title">${t('tools.rotate_page_label', { num: p.pageNum })}</span>
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
      const msg = t('toasts.select_watermark_image');
      this.showError(msg);
      return;
    }

    const textInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-wm-text"]');
    const fromPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-from-page"]');
    const toPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-to-page"]');

    let optionsPayload: Record<string, unknown> = {
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fontStyle: this.fontStyle,
      fontWeight: this.fontWeight,
      fromPage: Math.max(1, Number(fromPageInput?.value) || 1),
      isBold: this.fontWeight >= 600,
      isItalic: this.fontStyle === 'italic',
      layer: this.layer,
      mosaic: this.isMosaic,
      position: this.position,
      rotation: this.rotation,
      text: textInput?.value?.trim() || t('tools.watermark_default_text'),
      toPage: Math.max(1, Number(toPageInput?.value) || this.pages.length),
      transparency: this.transparency,
      type: this.activeTab,
    };

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
        const customFilename = outputNameInput?.value.trim();

        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        if (this.activeTab === 'image' && this.watermarkImageFile) {
          formData.append('watermarkImage', this.watermarkImageFile, this.watermarkImageFile.name);
        }
        if (customFilename) {
          optionsPayload = { ...optionsPayload, filename: customFilename };
        }
        formData.append('options', JSON.stringify(optionsPayload));

        const response = await postFormWithProgress(
          API_ROUTES.tools.watermarkPdf.process,
          formData,
          (progress) => {
            this.phaseManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as {
          data?: WatermarkPdfResponseData;
          error?: string;
          success: boolean;
        };

        this.phaseManager?.showProcessing(t('ui.insertando_marca_de_agua_en_el_pdf'), t('ui.estampando_elementos_con_la_opacidad_y_p'));

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || t('ui.ocurrio_un_error_al_insertar_la_marca_de'));
        }

        const token = result.data.fileId;
        showToast(t('toasts.marca_de_agua_insertada_con_exito'), 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: customFilename || result.data.filename,
          returnText: t('ui.insertar_otra_marca_de_agua'),
          returnUrl: '/watermark-pdf',
          subtitle: t('tools.watermark_success_prefix') + `"${this.currentFile?.name}".`,
          title: t('tools.watermark_success_title'),
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : t('ui.error_inesperado_al_insertar_la_marca_de');
        this.phaseManager?.showError(errorMessage, () => {
          this.phaseManager?.setPhase('workspace');
        });
        this.showError(errorMessage);
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private resetToInitial(): void {
    this.currentFile = null;
    this.pages = [];
    this.pdfDocument = null;
    this.isProcessing = false;
    this.watermarkImageFile = null;

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-watermark"]');
    const txtImgEl = this.container.querySelector<HTMLElement>('[data-ref="txt-picked-image"]');
    const textInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-wm-text"]');

    if (executeBtn) executeBtn.disabled = true;
    if (txtImgEl) txtImgEl.textContent = t('tools.watermark_pick_image');
    if (textInput) textInput.value = t('tools.watermark_default_text');

    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="watermark-pdf-workspace"]');
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = '';
    if (this.sidebarModal) this.sidebarModal.close();
    this.fontDrawer?.close();

    this.hideError();
    this.phaseManager?.setPhase('dropzone');
  }

  private showError(message: string): void {
    const sidebarBanner = this.container.querySelector<HTMLElement>('[data-ref="wm-error-banner"]');
    const globalBanner = this.container.querySelector<HTMLElement>('[data-ref="wm-global-error"]');
    if (sidebarBanner) {
      sidebarBanner.textContent = message;
      showElement(sidebarBanner);
    }
    if (globalBanner) {
      globalBanner.textContent = message;
      showElement(globalBanner);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const sidebarBanner = this.container.querySelector<HTMLElement>('[data-ref="wm-error-banner"]');
    const globalBanner = this.container.querySelector<HTMLElement>('[data-ref="wm-global-error"]');
    if (sidebarBanner) {
      sidebarBanner.textContent = '';
      hideElement(sidebarBanner);
    }
    if (globalBanner) {
      globalBanner.textContent = '';
      hideElement(globalBanner);
    }
  }
}

async function createWatermarkPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/watermark-pdf/watermark-pdf.html');
  const controller = new WatermarkPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { WatermarkPdfController, createWatermarkPdfView };
