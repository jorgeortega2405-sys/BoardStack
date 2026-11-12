import { FontDrawerComponent, SelectedFontConfig } from '../../../components/font-drawer.component.js';
import { showUpgradeLimitModal } from '../../../components/modal.component.js';
import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { bindInlineControls, hideElement, setupDropdown, setupToolSidebarModal, showElement, toggleElement, ToolSidebarModalController, withButtonLoading } from '../../../utils/dom.util.js';
import { PageNumberMargin, PageNumberMode, PageNumberPosition, PageNumberResponseData, PageThumbnailItem } from './page-numbers.types.js';

class PageNumbersController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private dropdownControllers: Array<{ destroy: () => void }> = [];
  private firstPageIsCover = false;
  private fontDrawer: FontDrawerComponent | null = null;
  private fontFamily = 'Helvetica';
  private fontSize = 11;
  private fontStyle: 'italic' | 'normal' = 'normal';
  private fontWeight = 400;
  private formatMode: 'custom' | 'of' | 'only' | 'page' = 'only';
  private isProcessing = false;
  private margin: PageNumberMargin = 'recommended';
  private mode: PageNumberMode = 'single';
  private pages: PageThumbnailItem[] = [];
  private pdfDocument: any = null;
  private phaseManager: ToolPhaseManager | null = null;
  private position: PageNumberPosition = 'bottom-right';
  private sidebarModal: ToolSidebarModalController | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: t('tools.select_pdf'),
        desc: t('ui.anade_numeracion_de_paginas_en_cualquier'),
        hint: t('tools.drop_pdf_hint'),
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: t('ui.insertar_numeros_de_pagina'),
      },
      sidebarRef: 'page-numbers-sidebar',
      toolId: 'page-numbers',
      toolName: t('ui.insertar_numeros_de_pagina'),
      topHeaderRef: 'component-top',
      workspaceCardRef: 'pn-workspace-card',
    });
    await this.phaseManager.init();
    renderIcons(this.container);

    const customTextInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-text"]');
    if (customTextInput && !customTextInput.value) {
      customTextInput.value = t('tools.pn_format_page_n_of_p');
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
    const triggerBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-pn-font-drawer"]');
    const triggerLabel = this.container.querySelector<HTMLElement>('[data-ref="pn-font-selected-label"]');

    this.fontDrawer = new FontDrawerComponent({
      initialFont: {
        family: this.fontFamily,
        style: this.fontStyle,
        weight: this.fontWeight,
      },
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
    const sidebarDragZone = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-sidebar-drag-zone"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-sidebar"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-page-numbers"]');

    this.sidebarModal = setupToolSidebarModal({
      backdrop: sidebarBackdrop,
      closeBtn: sidebarCloseBtn,
      dragZone: sidebarDragZone,
      settingsBtn,
      sidebar,
      signal,
    });

    executeBtn?.addEventListener('click', () => {
      void this.handleExecutePageNumbers(executeBtn);
    }, { signal });

    const fontDrawerBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-pn-font-drawer"]');
    fontDrawerBtn?.addEventListener('click', () => {
      if (!this.fontDrawer) return;
      this.fontDrawer.toggle();
      fontDrawerBtn.classList.toggle('is-active', this.fontDrawer.isOpen());
    }, { signal });

    const modePill = this.container.querySelector<HTMLElement>('[data-ref="toggle-page-mode"]');
    const modeButtons = modePill?.querySelectorAll<HTMLButtonElement>('.component-tab, .component-button, button');
    modeButtons?.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        modeButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        modePill?.setAttribute('data-active', index.toString());
        this.mode = (btn.getAttribute('data-mode') || 'single') as PageNumberMode;
        this.renderPagesView();
      }, { signal });
    });

    const marginToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-margin"]');
    const marginButtons = marginToggle?.querySelectorAll<HTMLButtonElement>('.component-tab, .component-button, button');
    marginButtons?.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        marginButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        marginToggle?.setAttribute('data-active', index.toString());
        const val = btn.getAttribute('data-val');
        if (val) {
          this.margin = val as PageNumberMargin;
          this.updateIndicators();
        }
      }, { signal });
    });

    const posGrid = this.container.querySelector<HTMLElement>('[data-ref="grid-pn-position"]');
    const posCells = posGrid?.querySelectorAll<HTMLButtonElement>('.pn-position-cell:not(:disabled)');
    posCells?.forEach((cell) => {
      cell.addEventListener('click', () => {
        posCells.forEach((c) => c.classList.remove('is-selected'));
        cell.classList.add('is-selected');
        this.position = (cell.getAttribute('data-pos') || 'bottom-right') as PageNumberPosition;
        this.updateIndicators();
      }, { signal });
    });

    const coverCheck = this.container.querySelector<HTMLInputElement>('[data-ref="check-first-page-cover"]');
    coverCheck?.addEventListener('change', () => {
      this.firstPageIsCover = coverCheck.checked;
      this.updateIndicators();
    }, { signal });

    bindInlineControls(this.container, signal);
    this.setupDropdowns();
  }

  private setupDropdowns(): void {
    const formatWrap = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pn-format"]');
    const customTextBox = this.container.querySelector<HTMLElement>('[data-ref="box-custom-text"]');
    if (formatWrap) {
      const ctrl = setupDropdown(formatWrap, {
        isSelect: true,
        onSelect: (val: string, item?: HTMLElement) => {
          this.formatMode = (val || 'only') as 'custom' | 'of' | 'only' | 'page';
          const textEl = formatWrap.querySelector<HTMLElement>('[data-ref="pn-format-selected-text"]');
          const labelMap: Record<string, string> = {
            custom: t('tools.pn_format_custom'),
            of: t('tools.pn_format_page_n_of_p'),
            only: t('tools.pn_format_only_num'),
            page: t('tools.pn_format_page_n'),
          };
          if (textEl) {
            textEl.textContent = labelMap[this.formatMode] || t('tools.pn_format_only_num');
          }
          const checks = formatWrap.querySelectorAll<HTMLElement>('[data-ref^="check-format-"]');
          checks.forEach((icon) => icon.classList.add('is-hidden'));
          item?.querySelector<HTMLElement>('[data-ref^="check-format-"]')?.classList.remove('is-hidden');
          toggleElement(customTextBox, this.formatMode === 'custom');
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const sizeWrap = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pn-font-size"]');
    if (sizeWrap) {
      const ctrl = setupDropdown(sizeWrap, {
        isSelect: true,
        onSelect: (val: string, item?: HTMLElement) => {
          const parsed = Number(val) || 11;
          this.fontSize = parsed;
          const textEl = sizeWrap.querySelector<HTMLElement>('[data-ref="pn-font-size-selected-text"]');
          if (textEl) {
            textEl.textContent = `${parsed} pt`;
          }
          const checks = sizeWrap.querySelectorAll<HTMLElement>('[data-ref^="check-pn-size-"]');
          checks.forEach((icon) => icon.classList.add('is-hidden'));
          item?.querySelector<HTMLElement>('[data-ref^="check-pn-size-"]')?.classList.remove('is-hidden');
        },
      });
      this.dropdownControllers.push(ctrl);
    }
  }

  private resolveFormatTemplate(): string {
    if (this.formatMode === 'page') return t('tools.pn_format_page_n');
    if (this.formatMode === 'of') return t('tools.pn_format_page_n_of_p');
    if (this.formatMode === 'custom') {
      const customTextInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-text"]');
      return customTextInput?.value.trim() || t('tools.pn_format_page_n_of_p');
    }
    return '{n}';
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

    const limits = getCurrentUserToolLimits('page-numbers');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'page-numbers',
        toolName: t('ui.insertar_numeros_de_pagina'),
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-page-numbers"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-workspace"]');
    const filenameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');

    this.phaseManager?.setPhase('workspace');

    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
    if (filenameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      filenameInput.value = `${base}_${t('tools.pn_filename_suffix')}.pdf`;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDocument = await loadPdfDocument(arrayBuffer);
      const numPages = this.pdfDocument.numPages || 1;

      this.pages = Array.from({ length: numPages }, (_, i) => ({
        id: `pn-page-${i + 1}`,
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
      this.renderPagesView();
    } catch {
      this.showError(t('ui.no_se_pudo_leer_el_archivo_pdf_seleccion'));
      this.resetToInitial();
    }
  }

  private renderPagesView(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="pn-pages-grid"]');
    if (!grid) return;
    grid.innerHTML = '';

    const coverLabel = t('tools.pn_cover_badge');

    if (this.mode === 'single') {
      grid.className = 'pdf-items-grid pn-pages-grid';
      grid.innerHTML = this.pages.map((p) => {
        const showCoverBadge = this.firstPageIsCover && p.pageNum === 1;
        return `
          <div class="pdf-card pn-page-card" data-ref="card-page-${p.id}" data-page-num="${p.pageNum}">
            <div class="pdf-card__sheet-wrapper">
              <div class="pdf-card__sheet">
                <span class="pn-page-card__cover-badge${showCoverBadge ? '' : ' is-hidden'}" data-ref="cover-badge-${p.id}">${coverLabel}</span>
                <div class="pn-indicator-dot ${this.resolveDotClass(p.pageNum)}" data-ref="dot-${p.id}"></div>
                <canvas class="pdf-card__canvas" data-ref="canvas-${p.id}"></canvas>
              </div>
            </div>
            <div class="pdf-card__footer">
              <span class="pdf-card__title">${t('tools.rotate_page_label', { num: p.pageNum })}</span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      grid.className = 'pdf-items-grid pn-pages-grid pn-pages-grid--facing';
      let html = '';

      for (let i = 0; i < this.pages.length; i += 2) {
        const leftPage = this.pages[i];
        const rightPage = this.pages[i + 1];
        const showLeftCover = this.firstPageIsCover && leftPage.pageNum === 1;

        html += `<div class="pn-facing-pair" data-ref="facing-pair-${i / 2}">`;
        html += `
          <div class="pdf-card pn-page-card" data-ref="card-page-${leftPage.id}" data-page-num="${leftPage.pageNum}">
            <div class="pdf-card__sheet-wrapper">
              <div class="pdf-card__sheet">
                <span class="pn-page-card__cover-badge${showLeftCover ? '' : ' is-hidden'}" data-ref="cover-badge-${leftPage.id}">${coverLabel}</span>
                <div class="pn-indicator-dot ${this.resolveDotClass(leftPage.pageNum)}" data-ref="dot-${leftPage.id}"></div>
                <canvas class="pdf-card__canvas" data-ref="canvas-${leftPage.id}"></canvas>
              </div>
            </div>
            <div class="pdf-card__footer">
              <span class="pdf-card__title">${t('tools.rotate_page_label', { num: leftPage.pageNum })}</span>
            </div>
          </div>
        `;

        if (rightPage) {
          html += `
            <div class="pdf-card pn-page-card" data-ref="card-page-${rightPage.id}" data-page-num="${rightPage.pageNum}">
              <div class="pdf-card__sheet-wrapper">
                <div class="pdf-card__sheet">
                  <span class="pn-page-card__cover-badge is-hidden" data-ref="cover-badge-${rightPage.id}">${coverLabel}</span>
                  <div class="pn-indicator-dot ${this.resolveDotClass(rightPage.pageNum)}" data-ref="dot-${rightPage.id}"></div>
                  <canvas class="pdf-card__canvas" data-ref="canvas-${rightPage.id}"></canvas>
                </div>
              </div>
              <div class="pdf-card__footer">
                <span class="pdf-card__title">${t('tools.rotate_page_label', { num: rightPage.pageNum })}</span>
              </div>
            </div>
          `;
        }

        html += `</div>`;
      }

      grid.innerHTML = html;
    }

    for (const page of this.pages) {
      void this.renderThumbnail(page);
    }
  }

  private resolveDotClass(pageNum: number): string {
    if (this.firstPageIsCover && pageNum === 1) {
      return 'is-hidden';
    }

    if (this.mode === 'single') {
      return `is-pos-${this.position}`;
    }

    const isLeftPage = pageNum % 2 === 0;

    if (this.position === 'bottom-center' || this.position === 'top-center') {
      return `is-pos-${this.position}`;
    }

    if (isLeftPage) {
      return this.position.startsWith('top') ? 'is-pos-top-left' : 'is-pos-bottom-left';
    }
    return this.position.startsWith('top') ? 'is-pos-top-right' : 'is-pos-bottom-right';
  }

  private updateIndicators(): void {
    for (const page of this.pages) {
      const dot = this.container.querySelector<HTMLElement>(`[data-ref="dot-${page.id}"]`);
      const coverBadge = this.container.querySelector<HTMLElement>(`[data-ref="cover-badge-${page.id}"]`);

      if (dot) {
        dot.className = `pn-indicator-dot ${this.resolveDotClass(page.pageNum)}`;
      }
      if (coverBadge && page.pageNum === 1) {
        coverBadge.classList.toggle('is-hidden', !this.firstPageIsCover);
      }
    }
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

  private async handleExecutePageNumbers(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    const startNumberInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-start-number"]');
    const fromPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-from-page"]');
    const toPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-to-page"]');

    const format = this.resolveFormatTemplate();

    let optionsPayload: Record<string, unknown> = {
      firstPageIsCover: this.firstPageIsCover,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fontStyle: this.fontStyle,
      fontWeight: this.fontWeight,
      format,
      fromPage: Math.max(1, Number(fromPageInput?.value) || 1),
      margin: this.margin,
      mode: this.mode,
      position: this.position,
      startNumber: Math.max(1, Number(startNumberInput?.value) || 1),
      toPage: Math.max(1, Number(toPageInput?.value) || this.pages.length),
    };

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
        const customFilename = outputNameInput?.value.trim();

        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        if (customFilename) {
          optionsPayload = { ...optionsPayload, filename: customFilename };
        }
        formData.append('options', JSON.stringify(optionsPayload));

        const response = await postFormWithProgress(
          API_ROUTES.tools.pageNumbers.process,
          formData,
          (progress) => {
            this.phaseManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as {
          data?: PageNumberResponseData;
          error?: string;
          success: boolean;
        };

        this.phaseManager?.showProcessing(t('ui.insertando_numeros_de_pagina'), t('ui.renderizando_y_estampando_las_numeracion'));

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || t('ui.ocurrio_un_error_al_insertar_numeros_de_'));
        }

        const token = result.data.fileId;
        showToast(t('toasts.page_numbers_inserted'), 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: customFilename || result.data.filename,
          returnText: t('tools.pn_return_text'),
          returnUrl: '/page-numbers',
          subtitle: t('tools.page_numbers_success_prefix') + `"${this.currentFile?.name}".`,
          title: t('tools.pn_success_title'),
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : t('ui.error_inesperado_al_numerar_el_documento');
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

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-page-numbers"]');
    if (executeBtn) executeBtn.disabled = true;

    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-workspace"]');
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
    const sidebarBanner = this.container.querySelector<HTMLElement>('[data-ref="pn-error-banner"]');
    const globalBanner = this.container.querySelector<HTMLElement>('[data-ref="pn-global-error"]');
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
    const sidebarBanner = this.container.querySelector<HTMLElement>('[data-ref="pn-error-banner"]');
    const globalBanner = this.container.querySelector<HTMLElement>('[data-ref="pn-global-error"]');
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

async function createPageNumbersView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/page-numbers/page-numbers.html');
  const controller = new PageNumbersController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { PageNumbersController, createPageNumbersView };
