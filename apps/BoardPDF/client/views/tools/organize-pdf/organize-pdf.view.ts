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
import { ViewController } from '../../../types/common.types.js';
import { SortableGridController, ToolSidebarModalController, hideElement, setupSortableGrid, setupToolSidebarModal, showElement } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { OrganizePageItem, OrganizePdfResponseData } from './organize-pdf.types.js';

export class OrganizePdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private currentResult: OrganizePdfResponseData | null = null;
  private isProcessing = false;
  private originalPages: OrganizePageItem[] = [];
  private pages: OrganizePageItem[] = [];
  private pdfDocument: any = null;
  private phaseManager: ToolPhaseManager | null = null;
  private sidebarModal: ToolSidebarModalController | null = null;
  private sortableInstance: SortableGridController | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: 'Seleccionar PDF',
        desc: 'Ordena, reorganiza y gira las páginas de tu documento PDF a tu gusto.',
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: 'Ordenar PDF',
      },
      toolId: 'organize-pdf',
      toolName: 'Ordenar PDF',
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
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
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

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="organize-pdf-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="organize-sidebar-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');

    this.sidebarModal = setupToolSidebarModal({
      backdrop,
      closeBtn,
      dragZone,
      settingsBtn,
      sidebar,
      signal,
    });

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

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      showToast('Selecciona únicamente un documento en formato PDF.', 'danger');
      return;
    }

    const limits = getCurrentUserToolLimits('organize-pdf');
    const maxSizeBytes = limits.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolName: 'Organizar PDF',
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
      showToast('No se pudo cargar el documento PDF. Comprueba que no esté protegido o dañado.', 'danger');
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
          const isRotated = item.rotation !== 0;
          sheet.innerHTML = `<img class="pdf-card__canvas" data-ref="img-${item.id}" src="${item.thumbnailDataUrl}" alt="Página ${item.pageNum}" style="${isRotated ? `transform: rotate(${item.rotation}deg);` : ''}" />`;
        }
      }
    } catch {}
  }

  private renderFilesView(): void {
    this.phaseManager?.setPhase('workspace');

    const workspace = this.container.querySelector<HTMLElement>('[data-ref="organize-pdf-workspace"]');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    if (settingsBtn) settingsBtn.classList.add('is-visible');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
    if (outputNameInput && this.currentFile) {
      const base = this.currentFile.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}_organizado.pdf`;
    }

    const countBadge = this.container.querySelector<HTMLElement>('[data-ref="pdf-count-badge"]');
    if (countBadge) {
      countBadge.textContent = `${this.pages.length} págs.`;
    }

    this.renderPagesGrid();
    this.initSortable();
    this.updateActionButtons();
    this.updateSummary();
  }

  private renderPagesGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="organize-pages-grid"]');
    if (!grid) return;

    grid.innerHTML = this.pages.map((p, index) => {
      const isMoved = p.originalIndex !== index;
      const isRotated = p.rotation !== 0;
      return `
        <div class="pdf-card organize-page-card" data-ref="card-${p.id}" data-page-id="${p.id}" data-page-index="${index}">
          <div class="pdf-card__actions">
            <button type="button" class="component-button pdf-card__btn-rotate" data-ref="btn-rotate-${p.id}" data-action="rotate" data-page-id="${p.id}" title="Girar página" aria-label="Girar página">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#rotate_right"></use></svg>
            </button>
            <button type="button" class="component-button pdf-card__btn-remove" data-ref="btn-remove-${p.id}" data-action="remove" data-page-id="${p.id}" title="Eliminar página" aria-label="Eliminar página">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
          <div class="pdf-card__sheet-wrapper">
            <div class="pdf-card__sheet" data-ref="sheet-${p.id}">
              ${
                p.thumbnailDataUrl
                  ? `<img class="pdf-card__canvas" data-ref="img-${p.id}" src="${p.thumbnailDataUrl}" alt="Página ${p.pageNum}" style="${isRotated ? `transform: rotate(${p.rotation}deg);` : ''}" />`
                  : `<div class="pdf-card__spinner"></div>`
              }
            </div>
          </div>
          <div class="pdf-card__footer">
            <span class="pdf-card__title">${t('tools.organize_pdf_page') || 'Página'} ${index + 1}</span>
            ${isMoved ? `<span class="pdf-card__sub">(orig. ${p.originalIndex + 1})</span>` : ''}
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
          pageTitle.textContent = `${t('tools.organize_pdf_page') || 'Página'} ${index + 1}`;
        }
        let origSub = card.querySelector<HTMLElement>('.pdf-card__sub');
        if (p.originalIndex !== index) {
          if (!origSub) {
            origSub = document.createElement('span');
            origSub.className = 'pdf-card__sub';
            card.querySelector('.pdf-card__footer')?.appendChild(origSub);
          }
          origSub.textContent = `(orig. ${p.originalIndex + 1})`;
        } else if (origSub) {
          origSub.remove();
        }
      }
    });
  }

  private rotatePage(pageId: string): void {
    const item = this.pages.find((p) => p.id === pageId);
    if (!item) return;

    item.rotation = (item.rotation + 90) % 360;

    const img = this.container.querySelector<HTMLElement>(`[data-ref="img-${item.id}"]`);
    if (img) {
      img.style.transform = item.rotation !== 0 ? `rotate(${item.rotation}deg)` : '';
    }

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

  private rotateAllPages(): void {
    if (this.pages.length === 0) return;
    this.pages.forEach((p) => {
      p.rotation = (p.rotation + 90) % 360;
      const img = this.container.querySelector<HTMLElement>(`[data-ref="img-${p.id}"]`);
      if (img) {
        img.style.transform = p.rotation !== 0 ? `rotate(${p.rotation}deg)` : '';
      }
      const card = this.container.querySelector<HTMLElement>(`[data-ref="card-${p.id}"]`);
      if (card) {
        let rotBadge = card.querySelector<HTMLElement>(`[data-ref="rot-badge-${p.id}"]`);
        if (p.rotation !== 0) {
          if (!rotBadge) {
            rotBadge = document.createElement('span');
            rotBadge.className = 'pdf-card__badge';
            rotBadge.setAttribute('data-ref', `rot-badge-${p.id}`);
            card.querySelector('.pdf-card__footer')?.appendChild(rotBadge);
          }
          rotBadge.textContent = `+${p.rotation}°`;
        } else if (rotBadge) {
          rotBadge.remove();
        }
      }
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
      showToast('Debes mantener al menos una página en el documento.', 'warning');
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

    const countBadge = this.container.querySelector<HTMLElement>('[data-ref="pdf-count-badge"]');
    if (countBadge) {
      countBadge.textContent = `${this.pages.length} págs.`;
    }
  }

  private updateSummary(): void {
    const countBadge = this.container.querySelector<HTMLElement>('[data-ref="pdf-count-badge"]');
    if (countBadge) {
      countBadge.textContent = `${this.pages.length} págs.`;
    }
  }

  private updateActionButtons(): void {
    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const txtMainAction = this.container.querySelector<HTMLElement>('[data-ref="txt-main-action"]');

    if (mainActionBtn && txtMainAction) {
      if (!this.currentFile) {
        txtMainAction.textContent = t('tools.organize_pdf_btn_select') || 'Seleccionar PDF';
        mainActionBtn.disabled = true;
      } else {
        txtMainAction.textContent = t('tools.organize_pdf_btn_action') || 'Ordenar PDF';
        mainActionBtn.disabled = this.isProcessing;
      }
    }
  }

  private async executeOrganizePdf(): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;

    if (this.pages.length === 0) {
      showToast('Debes incluir al menos una página en el orden final.', 'warning');
      return;
    }

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
    const customFilename = outputNameInput?.value.trim() || `${this.currentFile.name.replace(/\.pdf$/i, '')}_organizado.pdf`;

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

      this.phaseManager?.showProcessing('Organizando páginas del PDF...', 'Aplicando el nuevo orden y rotaciones');

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Error al procesar la solicitud.');
      }

      this.currentResult = json.data as OrganizePdfResponseData;
      const token = this.currentResult.fileId;
      showToast('Documento PDF organizado con éxito.', 'success');
      this.phaseManager?.navigateToDownload({
        downloadUrl: `/api/download/${token}`,
        fileSize: this.currentResult.fileSize,
        filename: this.currentResult.filename,
        returnText: 'Organizar otro documento PDF',
        returnUrl: '/organize-pdf',
        subtitle: `Se ha reorganizado exitosamente el archivo "${this.currentFile?.name}".`,
        title: '¡PDF organizado con éxito!',
        token,
      });
    } catch {
      this.phaseManager?.showError('No se pudo aplicar el nuevo orden a las páginas. Por favor intenta de nuevo.', () => {
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

    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="organize-pdf-workspace"]');

    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    this.sidebarModal?.close();

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = '';

    const grid = this.container.querySelector<HTMLElement>('[data-ref="organize-pages-grid"]');
    if (grid) grid.innerHTML = '';

    this.phaseManager?.setPhase('dropzone');
  }
}

export async function createOrganizePdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/organize-pdf/organize-pdf.html');
  const controller = new OrganizePdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
