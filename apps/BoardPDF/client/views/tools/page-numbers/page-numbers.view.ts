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
import { ToolSidebarModalController, bindFileDropzone, bindInlineControls, hideElement, setupDropdown, setupToolSidebarModal, showElement, toggleElement, withButtonLoading } from '../../../utils/dom.util.js';
import { PageNumberMargin, PageNumberMode, PageNumberPosition, PageNumberResponseData, PageThumbnailItem } from './page-numbers.types.js';

export class PageNumbersController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private dropdownControllers: Array<{ destroy: () => void }> = [];
  private firstPageIsCover = false;
  private fontFamily = 'Helvetica';
  private fontSize = 11;
  private format = '{n}';
  private isProcessing = false;
  private margin: PageNumberMargin = 'recommended';
  private mode: PageNumberMode = 'single';
  private pages: PageThumbnailItem[] = [];
  private pdfDocument: any = null;
  private position: PageNumberPosition = 'bottom-right';
  private sidebarModal: ToolSidebarModalController | null = null;
  private statusManager: ToolStatusManager | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-workspace"]');
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
    const dropzone = this.container.querySelector<HTMLElement>('[data-ref="pn-dropzone"]');
    const browseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-browse-pdf"]');
    const heroDriveBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-drive"]');
    const heroDropboxBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-dropbox"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const sidebarBackdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const sidebarCloseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const sidebarDragZone = this.container.querySelector<HTMLElement>('[data-ref="pn-sidebar-drag-zone"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-sidebar"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-page-numbers"]');
    const fabAddBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pn-fab-add"]');

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

    const checkCover = this.container.querySelector<HTMLInputElement>('[data-ref="check-cover"]');
    const customTextBox = this.container.querySelector<HTMLElement>('[data-ref="box-custom-text"]');

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="pn-dropzone-card"]');

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

    const pageModeToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-page-mode"]');
    pageModeToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as 'single' | 'double';
      if (!val || val === this.mode) return;
      this.mode = val;
      pageModeToggle.setAttribute('data-active', val === 'single' ? '0' : '1');
      pageModeToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      this.renderPagesGrid();
    }, { signal });

    checkCover?.addEventListener('change', () => {
      this.firstPageIsCover = checkCover.checked;
      this.updateIndicators();
    }, { signal });

    const marginToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-margin"]');
    marginToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as PageNumberMargin;
      if (!val) return;
      this.margin = val;
      const idx = val === 'recommended' ? '0' : val === 'small' ? '1' : '2';
      marginToggle.setAttribute('data-active', idx);
      marginToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    }, { signal });

    const wrapperFormat = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-format"]');
    if (wrapperFormat) {
      const ctrl = setupDropdown(wrapperFormat, {
        onSelect: (val: string) => {
          this.format = val || '{n}';
          if (customTextBox) {
            toggleElement(customTextBox, val === 'custom');
          }
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const wrapperFontFamily = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-font-family"]');
    if (wrapperFontFamily) {
      const ctrl = setupDropdown(wrapperFontFamily, {
        onSelect: (val: string) => {
          this.fontFamily = val || 'Helvetica';
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const wrapperFontSize = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-font-size"]');
    if (wrapperFontSize) {
      const ctrl = setupDropdown(wrapperFontSize, {
        onSelect: (val: string) => {
          this.fontSize = Number(val) || 11;
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const posCells = this.container.querySelectorAll<HTMLElement>('.pn-position-cell[data-pos]');
    posCells.forEach((cell) => {
      cell.addEventListener('click', () => {
        posCells.forEach((c) => c.classList.remove('is-selected'));
        cell.classList.add('is-selected');
        this.position = (cell.getAttribute('data-pos') as PageNumberPosition) || 'bottom-right';
        this.updateIndicators();
      }, { signal });
    });

    executeBtn?.addEventListener('click', () => {
      if (this.currentFile) {
        void this.handleExecutePageNumbers(executeBtn);
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

    const limits = getCurrentUserToolLimits('page-numbers');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      this.showError(`El archivo PDF supera el tamaño máximo permitido de ${limits.maxFileSizeMB} MB.`);
      return;
    }

    this.currentFile = file;

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="pn-dropzone-card"]');
    const workspaceCard = this.container.querySelector<HTMLElement>('[data-ref="pn-workspace-card"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-page-numbers"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-workspace"]');
    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');

    hideElement(dropzoneCard);
    showElement(workspaceCard);
    showElement(sidebar);
    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

    if (outputNameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}_numerado.pdf`;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDocument = await loadPdfDocument(arrayBuffer);
      const count = this.pdfDocument.numPages || 1;

      this.pages = Array.from({ length: count }, (_, i) => ({
        id: `pn-page-${i + 1}`,
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
      this.showError('No se pudo procesar el archivo PDF. Asegúrate de que no esté dañado ni protegido por contraseña.');
      this.resetToInitial();
    }
  }

  private renderPagesGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="pn-pages-grid"]');
    if (!grid) return;

    if (this.mode === 'single') {
      grid.className = 'pdf-items-grid pn-pages-grid';
      grid.innerHTML = this.pages.map((p) => `
        <div class="pdf-card pn-page-card" data-ref="card-page-${p.id}" data-page-num="${p.pageNum}">
          <div class="pdf-card__sheet-wrapper">
            <div class="pdf-card__sheet">
              <span class="pn-page-card__cover-badge" data-ref="cover-badge-${p.id}" style="${this.firstPageIsCover && p.pageNum === 1 ? '' : 'display: none;'}">Portada</span>
              <div class="pn-indicator-dot ${this.resolveDotClass(p.pageNum)}" data-ref="dot-${p.id}"></div>
              <canvas class="pdf-card__canvas" data-ref="canvas-${p.id}"></canvas>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      grid.className = 'pn-pages-grid pn-pages-grid--double';
      let html = '';

      for (let i = 0; i < this.pages.length; i += 2) {
        const leftPage = this.pages[i];
        const rightPage = this.pages[i + 1];

        html += `<div class="pn-spread-pair">`;

        html += `
          <div class="pdf-card pn-page-card" data-ref="card-page-${leftPage.id}" data-page-num="${leftPage.pageNum}" style="width: 170px;">
            <div class="pdf-card__sheet-wrapper">
              <div class="pdf-card__sheet">
                <span class="pn-page-card__cover-badge" data-ref="cover-badge-${leftPage.id}" style="${this.firstPageIsCover && leftPage.pageNum === 1 ? '' : 'display: none;'}">Portada</span>
                <div class="pn-indicator-dot ${this.resolveDotClass(leftPage.pageNum)}" data-ref="dot-${leftPage.id}"></div>
                <canvas class="pdf-card__canvas" data-ref="canvas-${leftPage.id}"></canvas>
              </div>
            </div>
          </div>
        `;

        if (rightPage) {
          html += `
            <div class="pdf-card pn-page-card" data-ref="card-page-${rightPage.id}" data-page-num="${rightPage.pageNum}" style="width: 170px;">
              <div class="pdf-card__sheet-wrapper">
                <div class="pdf-card__sheet">
                  <span class="pn-page-card__cover-badge" data-ref="cover-badge-${rightPage.id}" style="display: none;">Portada</span>
                  <div class="pn-indicator-dot ${this.resolveDotClass(rightPage.pageNum)}" data-ref="dot-${rightPage.id}"></div>
                  <canvas class="pdf-card__canvas" data-ref="canvas-${rightPage.id}"></canvas>
                </div>
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
    } else {
      return this.position.startsWith('top') ? 'is-pos-top-right' : 'is-pos-bottom-right';
    }
  }

  private updateIndicators(): void {
    for (const page of this.pages) {
      const dot = this.container.querySelector<HTMLElement>(`[data-ref="dot-${page.id}"]`);
      const coverBadge = this.container.querySelector<HTMLElement>(`[data-ref="cover-badge-${page.id}"]`);

      if (dot) {
        dot.className = `pn-indicator-dot ${this.resolveDotClass(page.pageNum)}`;
      }
      if (coverBadge && page.pageNum === 1) {
        toggleElement(coverBadge, this.firstPageIsCover);
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

    const workspaceCard = this.container.querySelector<HTMLElement>('[data-ref="pn-workspace-card"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-sidebar"]');

    const startNumberInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-start-number"]');
    const fromPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-from-page"]');
    const toPageInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-to-page"]');
    const customTextInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-text"]');

    let format = this.format;
    if (format === 'custom') {
      format = customTextInput?.value.trim() || 'Página {n} de {p}';
    }

    let optionsPayload: any = {
      firstPageIsCover: this.firstPageIsCover,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      format,
      fromPage: Math.max(1, Number(fromPageInput?.value) || 1),
      margin: this.margin,
      mode: this.mode,
      position: this.position,
      startNumber: Math.max(1, Number(startNumberInput?.value) || 1),
      toPage: Math.max(1, Number(toPageInput?.value) || this.pages.length),
    };

    this.isProcessing = true;
    hideElement(workspaceCard);
    hideElement(sidebar);
    this.statusManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
        const customFilename = outputNameInput?.value.trim();

        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        if (customFilename) {
          optionsPayload = { ...optionsPayload, filename: customFilename } as any;
        }
        formData.append('options', JSON.stringify(optionsPayload));

        const response = await postFormWithProgress(
          API_ROUTES.tools.pageNumbers.process,
          formData,
          (progress) => {
            this.statusManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as {
          data?: PageNumberResponseData;
          error?: string;
          success: boolean;
        };

        this.statusManager?.showProcessingState({
          subtitle: 'Renderizando y estampando las numeraciones en el documento PDF',
          title: 'Insertando números de página...',
        });

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || 'Ocurrió un error al insertar números de página.');
        }

        const token = result.data.fileId;
        showToast('Números de página insertados con éxito.', 'success');
        saveDownloadPayloadAndNavigate({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: customFilename || result.data.filename,
          returnText: 'Numerar otro documento PDF',
          returnUrl: '/page-numbers',
          subtitle: `Se han insertado exitosamente los números de página en "${this.currentFile?.name}".`,
          title: '¡Números de página insertados!',
          token,
        });
      } catch (err: unknown) {
        showElement(workspaceCard);
        showElement(sidebar);
        this.isProcessing = false;
        const errorMessage = err instanceof Error ? err.message : 'Error inesperado al numerar el documento.';
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
    this.statusManager?.hide();

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="pn-dropzone-card"]');
    const workspaceCard = this.container.querySelector<HTMLElement>('[data-ref="pn-workspace-card"]');
    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-page-numbers"]');

    if (fileInput) fileInput.value = '';
    showElement(dropzoneCard);
    hideElement(workspaceCard);
    if (executeBtn) executeBtn.disabled = true;

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-workspace"]');
    hideElement(sidebar);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = 'documento_numerado.pdf';
    if (this.sidebarModal) this.sidebarModal.close();
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="pn-global-error"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="pn-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

export async function createPageNumbersView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/page-numbers/page-numbers.html');
  const controller = new PageNumbersController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
