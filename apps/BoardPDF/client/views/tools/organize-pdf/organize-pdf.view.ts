import { showUpgradeLimitModal } from '../../../components/modal.component.js';
import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { SortableGridController, hideElement, setupSortableGrid, showElement } from '../../../utils/dom.util.js';
import { OrganizePageItem, OrganizePdfResponseData } from './organize-pdf.types.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class OrganizePdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private currentResult: OrganizePdfResponseData | null = null;
  private isProcessing = false;
  private originalPages: OrganizePageItem[] = [];
  private pages: OrganizePageItem[] = [];
  private pdfDocument: any = null;
  private phaseManager: ToolPhaseManager | null = null;
  private sortableInstance: SortableGridController | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: t('tools.select_pdf'),
        desc: t('ui.ordena_reorganiza_y_gira_las_paginas_de_'),
        hint: t('tools.drop_pdf_hint'),
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: t('tools.organize_pdf_title'),
      },
      onRetry: () => {
        if (this.currentFile) {
          this.phaseManager?.setPhase('workspace');
        } else {
          this.resetToInitial();
        }
      },
      toolId: 'organize-pdf',
      toolName: t('tools.organize_pdf_title'),
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
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }
    if (this.phaseManager) {
      this.phaseManager.destroy();
      this.phaseManager = null;
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

    const rotateAllBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-rotate-all"]');
    const resetOrderBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-reset-order"]');
    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const pagesGrid = this.container.querySelector<HTMLElement>('[data-ref="organize-pages-grid"]');

    rotateAllBtn?.addEventListener('click', () => {
      this.rotateAllPages();
    }, { signal });

    resetOrderBtn?.addEventListener('click', () => {
      this.resetOrder();
    }, { signal });

    mainActionBtn?.addEventListener('click', () => {
      if (this.currentFile) {
        void this.executeOrganizePdf();
      }
    }, { signal });

    pagesGrid?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      const rotateBtn = target.closest<HTMLButtonElement>('[data-action="rotate"]');
      if (rotateBtn) {
        const pageId = rotateBtn.getAttribute('data-page-id');
        if (pageId) {
          this.rotatePage(pageId);
        }
        return;
      }

      const removeBtn = target.closest<HTMLButtonElement>('[data-action="remove"]');
      if (removeBtn) {
        const pageId = removeBtn.getAttribute('data-page-id');
        if (pageId) {
          this.removePage(pageId);
        }
        return;
      }
    }, { signal });
  }

  public async handleFileSelected(file: File): Promise<void> {
    if (this.isProcessing) return;
    this.hideError();

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      this.showError(t('tools.only_pdf_allowed'));
      return;
    }

    const limits = getCurrentUserToolLimits('organize-pdf');
    const maxSizeBytes = limits.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'organize-pdf',
        toolName: t('tools.organize_pdf_title'),
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;

    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        cMapPacked: true,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        data: new Uint8Array(arrayBuffer),
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
      });

      this.pdfDocument = await loadingTask.promise;
      const numPages = this.pdfDocument.numPages;

      this.pages = [];
      this.originalPages = [];

      for (let i = 1; i <= numPages; i++) {
        const item: OrganizePageItem = {
          id: `page-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          originalIndex: i - 1,
          pageNum: i,
          rotation: 0,
          thumbnailDataUrl: undefined,
        };
        this.pages.push(item);
        this.originalPages.push({ ...item });
      }

      this.renderFilesView();

      for (const item of this.pages) {
        void this.generatePageThumbnail(item);
      }
    } catch {
      this.showError(t('ui.no_se_pudo_cargar_el_documento_pdf_compr'));
      this.resetToInitial();
    }
  }

  private async generatePageThumbnail(item: OrganizePageItem): Promise<void> {
    if (!this.pdfDocument) return;
    try {
      const page = await this.pdfDocument.getPage(item.pageNum);
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

        const sheet = this.container.querySelector<HTMLElement>(`[data-ref="sheet-${item.id}"]`);
        if (sheet) {
          this.applySheetRotation(sheet, item.rotation);
          const altText = escapeHtml(t('tools.page_label', { num: item.pageNum }));
          sheet.innerHTML = `<img class="pdf-card__canvas" data-ref="img-${item.id}" src="${item.thumbnailDataUrl}" alt="${altText}" />`;
        }
      }
    } catch {}
  }

  private applySheetRotation(sheet: HTMLElement | null, rotation: number): void {
    if (!sheet) return;
    if (rotation === 0) {
      sheet.removeAttribute('data-rotation');
    } else {
      sheet.setAttribute('data-rotation', rotation.toString());
    }
  }

  private renderFilesView(): void {
    this.phaseManager?.setPhase('workspace');

    const workspace = this.container.querySelector<HTMLElement>('[data-ref="organize-pdf-workspace"]');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput && this.currentFile) {
      const base = this.currentFile.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}_${t('tools.organize_filename_suffix')}.pdf`;
    }

    this.renderPagesGrid();
    this.initSortable();
    this.updateActionButtons();
    this.updateSummary();
  }

  private renderPagesGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="organize-pages-grid"]');
    if (!grid) return;

    const rotateLabel = escapeHtml(t('tools.organize_rotate_page_aria'));
    const removeLabel = escapeHtml(t('tools.organize_remove_page_aria'));

    grid.innerHTML = this.pages.map((p, index) => {
      const isMoved = p.originalIndex !== index;
      const isRotated = p.rotation !== 0;
      const rotationAttr = isRotated ? ` data-rotation="${p.rotation}"` : '';
      const altText = escapeHtml(t('tools.page_label', { num: p.pageNum }));
      return `
        <div class="pdf-card organize-page-card" data-ref="card-${p.id}" data-page-id="${p.id}" data-page-index="${index}">
          <div class="pdf-card__actions">
            <button type="button" class="component-button pdf-card__btn-rotate" data-ref="btn-rotate-${p.id}" data-action="rotate" data-page-id="${p.id}" title="${rotateLabel}" aria-label="${rotateLabel}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#redo"></use></svg>
            </button>
            <button type="button" class="component-button pdf-card__btn-remove" data-ref="btn-remove-${p.id}" data-action="remove" data-page-id="${p.id}" title="${removeLabel}" aria-label="${removeLabel}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
          <div class="pdf-card__sheet-wrapper">
            <div class="pdf-card__sheet" data-ref="sheet-${p.id}"${rotationAttr}>
              ${
                p.thumbnailDataUrl
                  ? `<img class="pdf-card__canvas" data-ref="img-${p.id}" src="${p.thumbnailDataUrl}" alt="${altText}" />`
                  : `<div class="pdf-card__spinner"></div>`
              }
            </div>
          </div>
          <div class="pdf-card__footer">
            <span class="pdf-card__title">${escapeHtml(t('tools.page_label', { num: index + 1 }))}</span>
            ${isMoved ? `<span class="pdf-card__sub">${escapeHtml(t('tools.organize_origin_label', { num: p.originalIndex + 1 }))}</span>` : ''}
            ${isRotated ? `<span class="pdf-card__badge" data-ref="rot-badge-${p.id}">+${p.rotation}°</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    renderIcons(grid);
  }

  private initSortable(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="organize-pages-grid"]');
    if (!grid) return;

    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }

    this.sortableInstance = setupSortableGrid(grid, {
      onEnd: () => {
        const cards = Array.from(grid.querySelectorAll<HTMLElement>('.pdf-card[data-page-id]'));
        const newOrderedPages: OrganizePageItem[] = [];
        cards.forEach((card) => {
          const id = card.getAttribute('data-page-id');
          const found = this.pages.find((p) => p.id === id);
          if (found) {
            newOrderedPages.push(found);
          }
        });
        this.pages = newOrderedPages;
        this.refreshCardBadges();
        this.updateSummary();
      },
    });
  }

  private refreshCardBadges(): void {
    this.pages.forEach((p, index) => {
      const card = this.container.querySelector<HTMLElement>(`[data-ref="card-${p.id}"]`);
      if (card) {
        card.setAttribute('data-page-index', `${index}`);
        const pageTitle = card.querySelector<HTMLElement>('.pdf-card__title');
        if (pageTitle) {
          pageTitle.textContent = t('tools.page_label', { num: index + 1 });
        }
        let origSub = card.querySelector<HTMLElement>('.pdf-card__sub');
        if (p.originalIndex !== index) {
          if (!origSub) {
            origSub = document.createElement('span');
            origSub.className = 'pdf-card__sub';
            card.querySelector('.pdf-card__footer')?.appendChild(origSub);
          }
          origSub.textContent = t('tools.organize_origin_label', { num: p.originalIndex + 1 });
        } else if (origSub) {
          origSub.remove();
        }
      }
    });
  }

  private updatePageRotationVisual(item: OrganizePageItem): void {
    const sheet = this.container.querySelector<HTMLElement>(`[data-ref="sheet-${item.id}"]`);
    this.applySheetRotation(sheet, item.rotation);

    const card = this.container.querySelector<HTMLElement>(`[data-ref="card-${item.id}"]`);
    if (card) {
      let rotBadge = card.querySelector<HTMLElement>(`[data-ref="rot-badge-${item.id}"]`);
      if (item.rotation !== 0) {
        if (!rotBadge) {
          rotBadge = document.createElement('span');
          rotBadge.className = 'pdf-card__badge';
          rotBadge.setAttribute('data-ref', `rot-badge-${item.id}`);
          card.querySelector('.pdf-card__footer')?.appendChild(rotBadge);
        }
        rotBadge.textContent = `+${item.rotation}°`;
      } else if (rotBadge) {
        rotBadge.remove();
      }
    }
  }

  private rotatePage(pageId: string): void {
    const item = this.pages.find((p) => p.id === pageId);
    if (!item) return;

    item.rotation = (item.rotation + 90) % 360;
    this.updatePageRotationVisual(item);
  }

  private rotateAllPages(): void {
    if (this.pages.length === 0) return;
    this.pages.forEach((p) => {
      p.rotation = (p.rotation + 90) % 360;
      this.updatePageRotationVisual(p);
    });
  }

  private resetOrder(): void {
    if (this.originalPages.length === 0) return;
    this.pages = this.originalPages.map((p) => ({ ...p, rotation: 0 }));
    this.renderPagesGrid();
    this.initSortable();
    this.updateSummary();
  }

  private removePage(pageId: string): void {
    if (this.pages.length <= 1) {
      showToast(t('toasts.keep_at_least_one_page'), 'warning');
      return;
    }

    const index = this.pages.findIndex((p) => p.id === pageId);
    if (index === -1) return;

    this.pages.splice(index, 1);

    const card = this.container.querySelector<HTMLElement>(`[data-ref="card-${pageId}"]`);
    if (card) {
      card.remove();
    }

    this.refreshCardBadges();
    this.updateSummary();
  }

  private updateSummary(): void {
    const countBadge = this.container.querySelector<HTMLElement>('[data-ref="pdf-count-badge"]');
    if (countBadge) {
      countBadge.textContent = t('tools.page_count_short', { count: this.pages.length });
    }
  }

  private updateActionButtons(): void {
    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const rotateAllBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-rotate-all"]');
    const resetOrderBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-reset-order"]');
    const txtMainAction = this.container.querySelector<HTMLElement>('[data-ref="txt-main-action"]');

    const disabled = !this.currentFile || this.isProcessing;
    if (rotateAllBtn) rotateAllBtn.disabled = disabled;
    if (resetOrderBtn) resetOrderBtn.disabled = disabled;

    if (mainActionBtn && txtMainAction) {
      if (!this.currentFile) {
        txtMainAction.textContent = t('tools.organize_pdf_btn_select');
        mainActionBtn.disabled = true;
      } else {
        txtMainAction.textContent = t('tools.organize_pdf_btn_action');
        mainActionBtn.disabled = this.isProcessing;
      }
    }
  }

  private async executeOrganizePdf(): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    if (this.pages.length === 0) {
      showToast(t('toasts.debes_incluir_al_menos_una_pagina_en_el_'), 'warning');
      return;
    }

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    const customFilename = outputNameInput?.value.trim() || `${this.currentFile.name.replace(/\.pdf$/i, '')}_${t('tools.organize_filename_suffix')}.pdf`;

    const pagesOrder = this.pages.map((p) => ({
      pageIndex: p.originalIndex,
      rotation: p.rotation,
    }));

    const formData = new FormData();
    formData.append('pdf', this.currentFile);
    formData.append('pagesOrder', JSON.stringify(pagesOrder));
    formData.append('filename', customFilename);

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    try {
      const response = await postFormWithProgress(
        API_ROUTES.tools.organizePdf.organize,
        formData,
        (progress) => {
          this.phaseManager?.updateUploadProgress(progress);
        }
      );
      const json = await response.json();

      this.phaseManager?.showProcessing(
        t('tools.organize_pdf_processing'),
        t('tools.organize_pdf_processing_subtitle')
      );

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error || t('ui.error_al_procesar_la_solicitud'));
      }

      this.currentResult = json.data as OrganizePdfResponseData;
      const token = this.currentResult.fileId;
      showToast(t('toasts.documento_pdf_organizado_con_exito'), 'success');
      this.phaseManager?.navigateToDownload({
        downloadUrl: `/api/download/${token}`,
        fileSize: this.currentResult.fileSize,
        filename: this.currentResult.filename,
        returnText: t('tools.organize_pdf_btn_another'),
        returnUrl: '/organize-pdf',
        subtitle: t('tools.organize_success_prefix') + `"${this.currentFile?.name}".`,
        title: t('tools.organize_pdf_completed_title'),
        token,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('ui.no_se_pudo_aplicar_el_nuevo_orden_a_las_');
      this.showError(msg);
      this.phaseManager?.showError(t('ui.no_se_pudo_aplicar_el_nuevo_orden_a_las_'), () => {
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
    this.originalPages = [];
    this.pdfDocument = null;
    this.isProcessing = false;

    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }

    const workspace = this.container.querySelector<HTMLElement>('[data-ref="organize-pdf-workspace"]');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = '';

    const grid = this.container.querySelector<HTMLElement>('[data-ref="organize-pages-grid"]');
    if (grid) grid.innerHTML = '';

    this.updateActionButtons();
    this.hideError();
    this.phaseManager?.setPhase('dropzone');
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="organize-global-error"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="organize-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

async function createOrganizePdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/organize-pdf/organize-pdf.html');
  const controller = new OrganizePdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { OrganizePdfController, createOrganizePdfView };
