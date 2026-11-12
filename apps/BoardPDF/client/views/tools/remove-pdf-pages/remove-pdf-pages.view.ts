import { showUpgradeLimitModal } from '../../../components/modal.component.js';
import { PageSelectorGridComponent } from '../../../components/page-selector-grid.component.js';
import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { escapeHtml, postFormWithProgress } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupToolSidebarModal, showElement } from '../../../utils/dom.util.js';
import { RemovePageItem, RemovePdfResponseData } from './remove-pdf-pages.types.js';

class RemovePdfPagesController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private currentResult: RemovePdfResponseData | null = null;
  private isProcessing = false;
  private lastClickedPageIndex: number | null = null;
  private pageSelector: PageSelectorGridComponent | null = null;
  private pages: RemovePageItem[] = [];
  private pdfDocument: any = null;
  private phaseManager: ToolPhaseManager | null = null;
  private removedPages: Set<number> = new Set();
  private sidebarModal: ToolSidebarModalController | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: t('tools.remove_pdf_pages_btn_select'),
        desc: t('ui.selecciona_y_elimina_las_paginas_que_no_'),
        hint: t('common.drop_file_hint'),
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: t('tools.remove_pdf_pages_title'),
      },
      sidebarRef: 'remove-pages-sidebar',
      toolId: 'remove-pdf-pages',
      toolName: t('tools.remove_pdf_pages_title'),
      topHeaderRef: 'component-top',
      workspaceCardRef: 'pdf-items-card',
    });
    await this.phaseManager.init();
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.pageSelector) {
      this.pageSelector.destroy();
      this.pageSelector = null;
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

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="remove-pages-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="remove-sidebar-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const pagesGrid = this.container.querySelector<HTMLElement>('[data-ref="remove-pages-grid"]');
    const selectorContainer = this.container.querySelector<HTMLElement>('[data-ref="remove-pages-selector"]');

    this.sidebarModal = setupToolSidebarModal({
      backdrop,
      closeBtn,
      dragZone,
      settingsBtn,
      sidebar,
      signal,
    });

    if (selectorContainer) {
      this.pageSelector = new PageSelectorGridComponent({
        container: selectorContainer,
        onChange: (selected) => {
          this.hideError();
          this.removedPages = new Set(selected);
          this.updateCardsState();
          this.updateSummary();
        },
      });
    }

    pagesGrid?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-page-index]');
      if (!card) return;
      this.hideError();
      const index = parseInt(card.getAttribute('data-page-index') || '0', 10);
      const pageNum = index + 1;

      if ((e as MouseEvent).shiftKey && this.lastClickedPageIndex !== null) {
        const from = Math.min(this.lastClickedPageIndex, index);
        const to = Math.max(this.lastClickedPageIndex, index);
        const shouldRemove = !this.removedPages.has(pageNum);

        for (let i = from; i <= to; i++) {
          const p = i + 1;
          if (shouldRemove) {
            this.removedPages.add(p);
          } else {
            this.removedPages.delete(p);
          }
        }
      } else {
        if (this.removedPages.has(pageNum)) {
          this.removedPages.delete(pageNum);
        } else {
          this.removedPages.add(pageNum);
        }
        this.lastClickedPageIndex = index;
      }

      this.pageSelector?.setSelected(this.removedPages);
      this.updateCardsState();
      this.updateSummary();
    }, { signal });

    mainActionBtn?.addEventListener('click', () => {
      if (this.currentFile) {
        void this.executeRemovePages();
      }
    }, { signal });
  }

  public async handleFileSelected(file: File): Promise<void> {
    if (this.isProcessing) return;
    this.hideError();

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      this.showError(t('ui.selecciona_unicamente_un_documento_en_fo'));
      return;
    }

    const limits = getCurrentUserToolLimits('remove-pdf-pages');
    const maxSizeBytes = limits.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'remove-pdf-pages',
        toolName: t('tools.remove_pdf_pages_title'),
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;
    this.removedPages.clear();
    this.lastClickedPageIndex = null;

    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        cMapPacked: true,
        cMapUrl: '/vendor/pdfjs/cmaps/',
        data: new Uint8Array(arrayBuffer),
        standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
      });

      this.pdfDocument = await loadingTask.promise;
      const numPages = this.pdfDocument.numPages;

      this.pages = [];
      for (let i = 1; i <= numPages; i++) {
        this.pages.push({
          id: `page-${i}`,
          num: i,
          thumbnailDataUrl: undefined,
        });
      }

      this.pageSelector?.setPageCount(numPages, [], true);
      this.renderFilesView();

      for (const item of this.pages) {
        void this.generatePageThumbnail(item);
      }
    } catch {
      this.showError(t('ui.no_se_pudo_cargar_el_documento_pdf_compr'));
      this.resetToInitial();
    }
  }

  private async generatePageThumbnail(item: RemovePageItem): Promise<void> {
    if (!this.pdfDocument) return;
    try {
      const page = await this.pdfDocument.getPage(item.num);
      const origViewport = page.getViewport({ scale: 1 });
      const targetWidth = 220;
      const scale = targetWidth / Math.max(origViewport.width, 1);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        }).promise;

        item.thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        this.pageSelector?.setThumbnail(item.num, item.thumbnailDataUrl);

        const sheet = this.container.querySelector<HTMLElement>(`[data-ref="sheet-page-${item.num}"]`);
        if (sheet) {
          sheet.innerHTML = `<img class="pdf-card__canvas" data-ref="img-page-${item.num}" src="${item.thumbnailDataUrl}" alt="${escapeHtml(t('tools.page_label', { num: item.num }))}" />`;
        }
      }
    } catch {}
  }

  private renderFilesView(): void {
    this.phaseManager?.setPhase('workspace');

    const workspace = this.container.querySelector<HTMLElement>('[data-ref="remove-pages-workspace"]');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    if (settingsBtn) settingsBtn.classList.add('is-visible');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput && this.currentFile) {
      const base = this.currentFile.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}${t('tools.remove_pdf_pages_default_suffix')}`;
    }

    const countBadge = this.container.querySelector<HTMLElement>('[data-ref="pdf-count-badge"]');
    if (countBadge) {
      countBadge.textContent = t('tools.page_short_plural', { count: this.pages.length });
    }

    this.renderPagesGrid();
    this.updateActionButtons();
  }

  private renderPagesGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="remove-pages-grid"]');
    if (!grid) return;

    const removePageLabel = escapeHtml(t('tools.remove_pdf_pages_remove_page_label'));
    grid.innerHTML = this.pages.map((p, index) => {
      const isRemoved = this.removedPages.has(p.num);
      const pageTitle = escapeHtml(t('tools.page_label', { num: p.num }));
      return `
        <div class="pdf-card remove-page-card ${isRemoved ? 'is-marked-remove' : ''}" data-ref="page-card-${p.num}" data-page-index="${index}" data-page-num="${p.num}">
          <div class="pdf-card__actions">
            <button type="button" class="component-button pdf-card__btn-remove" data-ref="btn-toggle-${p.num}" title="${removePageLabel}" aria-label="${removePageLabel}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
          <div class="remove-page-card__overlay" data-ref="overlay-page-${p.num}">
            <div class="remove-page-card__remove-badge">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete_sweep"></use></svg>
            </div>
          </div>
          <div class="pdf-card__sheet-wrapper">
            <div class="pdf-card__sheet" data-ref="sheet-page-${p.num}">
              ${
                p.thumbnailDataUrl
                  ? `<img class="pdf-card__canvas" data-ref="img-page-${p.num}" src="${p.thumbnailDataUrl}" alt="${pageTitle}" />`
                  : `<div class="pdf-card__spinner"></div>`
              }
            </div>
          </div>
          <div class="pdf-card__footer">
            <span class="pdf-card__title">${pageTitle}</span>
          </div>
        </div>
      `;
    }).join('');

    renderIcons(grid);
  }

  private updateCardsState(): void {
    this.pages.forEach((p) => {
      const card = this.container.querySelector<HTMLElement>(`[data-ref="page-card-${p.num}"]`);
      if (card) {
        card.classList.toggle('is-marked-remove', this.removedPages.has(p.num));
      }
    });
  }

  private updateSummary(): void {
    const total = this.pages.length;
    const removed = this.removedPages.size;

    if (this.currentFile) {
      if (removed >= total) {
        showToast(t('toasts.cannot_delete_all_pages'), 'warning');
      }
    }
  }

  private updateActionButtons(): void {
    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const txtMainAction = this.container.querySelector<HTMLElement>('[data-ref="txt-main-action"]');

    if (mainActionBtn && txtMainAction) {
      if (!this.currentFile) {
        txtMainAction.textContent = t('tools.remove_pdf_pages_btn_select');
        mainActionBtn.disabled = true;
      } else {
        txtMainAction.textContent = t('tools.remove_pdf_pages_btn_action');
        mainActionBtn.disabled = this.isProcessing;
      }
    }
  }

  private async executeRemovePages(): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    const total = this.pages.length;
    const removedCount = this.removedPages.size;

    if (removedCount === 0) {
      this.showError(t('toasts.debes_seleccionar_al_menos_una_pagina_pa'));
      return;
    }

    if (removedCount >= total) {
      this.showError(t('tools.remove_pages_at_least_one'));
      return;
    }

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    const customFilename = outputNameInput?.value.trim() || `${this.currentFile.name.replace(/\.pdf$/i, '')}${t('tools.remove_pdf_pages_default_suffix')}`;

    const formData = new FormData();
    formData.append('pdf', this.currentFile);
    formData.append('pagesToRemove', JSON.stringify(Array.from(this.removedPages)));
    formData.append('filename', customFilename);

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    try {
      const response = await postFormWithProgress(
        API_ROUTES.tools.removePdfPages.remove,
        formData,
        (progress) => {
          this.phaseManager?.updateUploadProgress(progress);
        }
      );
      const json = await response.json();

      this.phaseManager?.showProcessing(t('tools.remove_pdf_pages_processing'), t('ui.generando_nuevo_documento_sin_las_pagina'));

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error || t('ui.error_al_procesar_la_solicitud'));
      }

      this.currentResult = json.data as RemovePdfResponseData;
      const token = this.currentResult.fileId;
      showToast(t('toasts.pages_deleted_success'), 'success');
      this.phaseManager?.navigateToDownload({
        downloadUrl: `/api/download/${token}`,
        fileSize: this.currentResult.fileSize,
        filename: this.currentResult.filename,
        returnText: t('tools.remove_pdf_pages_btn_another'),
        returnUrl: '/remove-pdf-pages',
        subtitle: t('tools.remove_pdf_pages_success_desc', { count: this.currentResult.removedPages, name: this.currentFile?.name || '' }),
        title: t('tools.remove_pdf_pages_completed_title'),
        token,
      });
    } catch {
      this.phaseManager?.showError(t('ui.no_se_pudieron_eliminar_las_paginas_sele'), () => {
        this.phaseManager?.setPhase('workspace');
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private resetToInitial(): void {
    this.currentFile = null;
    this.currentResult = null;
    this.pages = [];
    this.removedPages.clear();
    this.lastClickedPageIndex = null;
    this.pdfDocument = null;
    this.isProcessing = false;
    this.pageSelector?.setPageCount(0, [], true);

    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="remove-pages-workspace"]');

    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    this.sidebarModal?.close();

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = '';

    const grid = this.container.querySelector<HTMLElement>('[data-ref="remove-pages-grid"]');
    if (grid) grid.innerHTML = '';

    this.hideError();
    this.phaseManager?.setPhase('dropzone');
  }

  private showError(msg: string): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="remove-global-error"]');
    if (banner) {
      banner.textContent = msg;
      showElement(banner);
    }
    showToast(msg, 'danger');
  }

  private hideError(): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="remove-global-error"]');
    if (banner) {
      banner.textContent = '';
      hideElement(banner);
    }
  }
}

async function createRemovePdfPagesView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/remove-pdf-pages/remove-pdf-pages.html');
  const controller = new RemovePdfPagesController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { RemovePdfPagesController, createRemovePdfPagesView };
