import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { isLimitErrorMessage, showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { pickDropboxFiles } from '../../../services/dropbox.service.js';
import { pickGoogleDriveFiles } from '../../../services/google-drive.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { hideElement, setupDropdown, setupSortableGrid, setupToolSidebarModal, showElement, SortableGridController, ToolSidebarModalController } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { MergePdfResponseData, SelectedPdfItem } from './merge-pdf.types.js';

async function estimatePdfPages(file: File): Promise<number> {
  try {
    const headBuffer = await file.slice(0, Math.min(file.size, 128 * 1024)).arrayBuffer();
    const headText = new TextDecoder('latin1').decode(headBuffer);
    const countMatch = headText.match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/);
    if (countMatch && countMatch[1]) {
      const count = parseInt(countMatch[1], 10);
      if (count > 0) return count;
    }
    const tailBuffer = await file.slice(Math.max(0, file.size - 128 * 1024)).arrayBuffer();
    const tailText = new TextDecoder('latin1').decode(tailBuffer);
    const tailCountMatch = tailText.match(/\/Count\s+(\d+)/);
    if (tailCountMatch && tailCountMatch[1]) {
      const count = parseInt(tailCountMatch[1], 10);
      if (count > 0) return count;
    }
  } catch {}
  return 1;
}

class MergePdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentResult: MergePdfResponseData | null = null;
  private dropdownControllers: Array<{ destroy: () => void }> = [];
  private isProcessing = false;
  private phaseManager: ToolPhaseManager | null = null;
  private selectedFiles: SelectedPdfItem[] = [];
  private sidebarModal: ToolSidebarModalController | null = null;
  private sortable: SortableGridController | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: 'Seleccionar archivos PDF',
        desc: t('ui.une_pdfs_y_ponlos_en_el_orden_que_prefie'),
        hint: 'o arrastra y suelta los PDF aquí',
        multiselect: true,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFilesAdded(files);
        },
        title: 'Unir archivos PDF',
      },
      sidebarRef: 'pdf-merger-sidebar',
      toolId: 'merge-pdf',
      toolName: 'Unir PDF',
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
    if (this.phaseManager) {
      this.phaseManager.destroy();
      this.phaseManager = null;
    }
    if (this.sortable) {
      this.sortable.destroy();
      this.sortable = null;
    }
    this.dropdownControllers.forEach((ctrl) => ctrl.destroy());
    this.dropdownControllers = [];
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const addMoreInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-add-more-pdf"]');
    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const itemsGrid = this.container.querySelector<HTMLElement>('[data-ref="pdf-items-grid"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const sidebarBackdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const sidebarCloseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const sidebarDragZone = this.container.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="pdf-merger-sidebar"]');

    this.sidebarModal = setupToolSidebarModal({
      backdrop: sidebarBackdrop,
      closeBtn: sidebarCloseBtn,
      dragZone: sidebarDragZone,
      settingsBtn,
      sidebar,
      signal,
    });

    const addFilesDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-add-files"]');
    if (addFilesDropdownWrapper) {
      const ctrl = setupDropdown(addFilesDropdownWrapper, {
        isSelect: false,
        matchWidth: false,
      });
      this.dropdownControllers.push(ctrl);
    }

    const menuAddDevice = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-add-device"]');
    const menuAddDrive = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-add-drive"]');
    const menuAddDropbox = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-menu-add-dropbox"]');

    menuAddDevice?.addEventListener('click', (e) => {
      e.stopPropagation();
      addMoreInput?.click();
    }, { signal });

    menuAddDrive?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.handleDriveImport();
    }, { signal });

    menuAddDropbox?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.handleDropboxImport();
    }, { signal });

    addMoreInput?.addEventListener('change', () => {
      if (addMoreInput.files && addMoreInput.files.length > 0) {
        void this.handleFilesAdded(addMoreInput.files);
      }
      addMoreInput.value = '';
    }, { signal });

    itemsGrid?.addEventListener('click', (e) => {
      const removeBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ref="btn-remove-pdf"]');
      if (removeBtn) {
        const id = removeBtn.getAttribute('data-id');
        if (id) {
          this.removeFile(id);
        }
      }
    }, { signal });

    mainActionBtn?.addEventListener('click', () => {
      if (this.selectedFiles.length >= 2) {
        void this.executeMergePdf();
      }
    }, { signal });
  }

  private async handleDriveImport(): Promise<void> {
    if (this.isProcessing) return;
    try {
      const files = await pickGoogleDriveFiles({ multiselect: true });
      if (files.length > 0) {
        await this.handleFilesAdded(files);
      }
    } catch {
      showToast('Error al importar archivos desde Google Drive.', 'danger');
    }
  }

  private async handleDropboxImport(): Promise<void> {
    if (this.isProcessing) return;
    try {
      const files = await pickDropboxFiles({ multiselect: true });
      if (files.length > 0) {
        await this.handleFilesAdded(files);
      }
    } catch {
      showToast('Error al importar archivos desde Dropbox.', 'danger');
    }
  }

  public async handleFilesAdded(files: FileList | File[]): Promise<void> {
    const limits = getCurrentUserToolLimits('merge-pdf');
    const fileArray = Array.from(files);

    const validPdfs: File[] = [];
    for (const file of fileArray) {
      const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
      const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
      if (!isPdfExt && !isPdfMime) {
        showToast(`El archivo "${file.name}" no es un documento PDF válido.`, 'warning');
        continue;
      }

      const maxFileSizeBytes = limits.maxFileSizeMB * 1024 * 1024;
      if (file.size > maxFileSizeBytes) {
        showUpgradeLimitModal({
          currentLimit: limits.maxFileSizeMB,
          fileName: file.name,
          proLimit: '1,000 MB',
          toolName: 'Unir PDF',
          type: 'file_size',
        });
        return;
      }
      validPdfs.push(file);
    }

    if (validPdfs.length === 0) return;

    if (this.selectedFiles.length + validPdfs.length > limits.maxFiles) {
      showUpgradeLimitModal({
        currentCount: this.selectedFiles.length + validPdfs.length,
        currentLimit: limits.maxFiles,
        proLimit: 500,
        toolName: 'Unir PDF',
        type: 'files_count',
      });
      return;
    }

    const currentTotalSize = this.selectedFiles.reduce((acc, item) => acc + item.size, 0);
    const incomingTotalSize = validPdfs.reduce((acc, f) => acc + f.size, 0);
    const maxTotalSizeBytes = limits.maxTotalSizeMB * 1024 * 1024;
    if (currentTotalSize + incomingTotalSize > maxTotalSizeBytes) {
      showUpgradeLimitModal({
        currentLimit: limits.maxTotalSizeMB,
        proLimit: '2,000 MB',
        toolName: 'Unir PDF',
        type: 'total_size',
      });
      return;
    }

    const newItems: SelectedPdfItem[] = [];

    for (const file of validPdfs) {
      try {
        const initialPages = await estimatePdfPages(file);
        const item: SelectedPdfItem = {
          file,
          id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          pageCount: initialPages,
          size: file.size,
        };
        this.selectedFiles.push(item);
        newItems.push(item);
      } catch {
        showToast(`El archivo "${file.name}" está dañado o protegido con contraseña.`, 'danger');
      }
    }

    this.renderFilesList();
    this.updateSummary();

    for (const item of newItems) {
      void this.generateThumbnailForItem(item);
    }
  }

  private async generateThumbnailForItem(item: SelectedPdfItem): Promise<void> {
    let pdfDoc: any = null;
    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await item.file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        cMapPacked: true,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        data: new Uint8Array(arrayBuffer),
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
      });
      pdfDoc = await loadingTask.promise;
      item.pageCount = pdfDoc.numPages || item.pageCount;

      const page = await pdfDoc.getPage(1);
      const origViewport = page.getViewport({ scale: 1 });
      const targetWidth = 280;
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

        item.thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.88);

        const sheet = this.container.querySelector<HTMLElement>(`[data-ref="sheet-${item.id}"]`);
        if (sheet && item.thumbnailDataUrl) {
          sheet.innerHTML = `<img class="pdf-card__preview-img" data-ref="img-preview-${item.id}" src="${item.thumbnailDataUrl}" alt="${item.name}" />`;
        }

        const metaEl = this.container.querySelector<HTMLElement>(`[data-ref="meta-${item.id}"]`);
        if (metaEl) {
          const pagesLabel = item.pageCount === 1 ? '1 pág.' : `${item.pageCount} págs.`;
          metaEl.textContent = `${pagesLabel} • ${formatBytes(item.size)}`;
        }
      }
    } catch {
    } finally {
      try {
        if (pdfDoc) await pdfDoc.destroy();
      } catch {}
    }

    this.updateSummary();
  }

  private renderFilesList(): void {
    const itemsGrid = this.container.querySelector<HTMLElement>('[data-ref="pdf-items-grid"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="pdf-merger-workspace"]');
    const badge = this.container.querySelector<HTMLElement>('[data-ref="pdf-count-badge"]');

    if (!itemsGrid) return;

    if (this.selectedFiles.length === 0) {
      this.resetToInitial();
      return;
    }

    this.phaseManager?.setPhase('workspace');

    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
    if (badge) badge.textContent = this.selectedFiles.length.toString();

    itemsGrid.innerHTML = this.selectedFiles
      .map((item, index) => this.renderCardHtml(item, index))
      .join('');

    renderIcons(itemsGrid);
    this.initSortable();
    this.updateActionButtons();
  }

  private renderCardHtml(item: SelectedPdfItem, index: number): string {
    const pagesLabel = item.pageCount === 1 ? '1 pág.' : `${item.pageCount} págs.`;

    const sheetContent = item.thumbnailDataUrl
      ? `<img class="pdf-card__preview-img" src="${item.thumbnailDataUrl}" alt="${item.name}" />`
      : `
        <div class="pdf-card__placeholder">
          <svg class="component-icon pdf-card__placeholder-icon" aria-hidden="true"><use href="/icons.svg#picture_as_pdf"></use></svg>
          <div class="pdf-card__placeholder-lines">
            <span class="pdf-card__placeholder-line"></span>
            <span class="pdf-card__placeholder-line pdf-card__placeholder-line--short"></span>
            <span class="pdf-card__placeholder-line"></span>
          </div>
        </div>
      `;

    return `
      <div class="pdf-card" data-ref="card-pdf-${item.id}" data-id="${item.id}">
        <div class="pdf-card__actions">
          <button type="button" class="component-button pdf-card__btn-remove" data-ref="btn-remove-pdf" data-id="${item.id}" title="Eliminar archivo" aria-label="Eliminar archivo">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>

        <div class="pdf-card__sheet-wrapper" data-ref="sheet-wrapper-${item.id}">
          <div class="pdf-card__sheet" data-ref="sheet-${item.id}">
            ${sheetContent}
          </div>
        </div>

        <div class="pdf-card__footer">
          <span class="pdf-card__title" title="${item.name}">${index + 1}. ${item.name}</span>
          <span class="pdf-card__meta" data-ref="meta-${item.id}">${pagesLabel} • ${formatBytes(item.size)}</span>
        </div>
      </div>
    `;
  }

  private initSortable(): void {
    const itemsGrid = this.container.querySelector<HTMLElement>('[data-ref="pdf-items-grid"]');
    if (!itemsGrid) return;

    if (this.sortable) {
      this.sortable.destroy();
      this.sortable = null;
    }

    this.sortable = setupSortableGrid(itemsGrid, {
      animation: 200,
      onEnd: () => {
        const cards = Array.from(itemsGrid.querySelectorAll<HTMLElement>('.pdf-card[data-id]'));
        const newOrderedFiles: SelectedPdfItem[] = [];
        cards.forEach((card) => {
          const id = card.getAttribute('data-id');
          const found = this.selectedFiles.find((f) => f.id === id);
          if (found) {
            newOrderedFiles.push(found);
          }
        });
        this.selectedFiles = newOrderedFiles;
        this.refreshCardIndices();
      },
    });
  }

  private refreshCardIndices(): void {
    const itemsGrid = this.container.querySelector<HTMLElement>('[data-ref="pdf-items-grid"]');
    if (!itemsGrid) return;

    const cards = itemsGrid.querySelectorAll<HTMLElement>('.pdf-card');
    cards.forEach((card, index) => {
      const titleEl = card.querySelector<HTMLElement>('.pdf-card__title');
      const id = card.getAttribute('data-id');
      const item = this.selectedFiles.find((f) => f.id === id);
      if (titleEl && item) {
        titleEl.textContent = `${index + 1}. ${item.name}`;
      }
    });
  }

  private removeFile(id: string): void {
    this.selectedFiles = this.selectedFiles.filter((item) => item.id !== id);
    if (this.selectedFiles.length === 0) {
      this.resetToInitial();
    } else {
      this.renderFilesList();
      this.updateSummary();
    }
  }

  private updateActionButtons(): void {
    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const txtMainAction = this.container.querySelector<HTMLElement>('[data-ref="txt-main-action"]');

    if (mainActionBtn && txtMainAction) {
      if (this.selectedFiles.length === 0) {
        txtMainAction.textContent = t('tools.merge_pdf_btn_select') || 'Unir PDF';
        mainActionBtn.disabled = true;
      } else if (this.selectedFiles.length === 1) {
        txtMainAction.textContent = t('tools.merge_pdf_btn_select') || 'Unir PDF';
        mainActionBtn.disabled = true;
      } else {
        txtMainAction.textContent = t('tools.merge_pdf_btn_action') || 'Unir PDF';
        mainActionBtn.disabled = this.isProcessing;
      }
    }
  }

  private updateSummary(): void {
    const totalFiles = this.selectedFiles.length;
    const totalBytes = this.selectedFiles.reduce((acc, item) => acc + item.size, 0);
    const totalPages = this.selectedFiles.reduce((acc, item) => acc + item.pageCount, 0);

    const txtTotalFiles = this.container.querySelector<HTMLElement>('[data-ref="txt-total-files"]');
    const txtTotalSize = this.container.querySelector<HTMLElement>('[data-ref="txt-total-size"]');
    const txtTotalPages = this.container.querySelector<HTMLElement>('[data-ref="txt-total-pages"]');
    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');

    if (txtTotalFiles) txtTotalFiles.textContent = totalFiles.toString();
    if (txtTotalSize) txtTotalSize.textContent = formatBytes(totalBytes);
    if (txtTotalPages) txtTotalPages.textContent = totalPages.toString();

    if (outputNameInput && !outputNameInput.value.trim()) {
      outputNameInput.value = 'BoardPDF_merged';
    }
  }

  private async executeMergePdf(): Promise<void> {
    if (this.selectedFiles.length < 2 || this.isProcessing) return;

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    let customFilename = outputNameInput?.value.trim() || 'BoardPDF_merged';
    if (!customFilename.toLowerCase().endsWith('.pdf')) {
      customFilename += '.pdf';
    }

    const formData = new FormData();
    formData.append('filename', customFilename);

    for (const item of this.selectedFiles) {
      formData.append('pdfs', item.file, item.name);
    }

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    try {
      const response = await postFormWithProgress(
        API_ROUTES.tools.mergePdf.merge,
        formData,
        (progress) => {
          this.phaseManager?.updateUploadProgress(progress, 1);
        },
        this.abortController?.signal
      );

      const json = await response.json();

      this.phaseManager?.showProcessing('Uniendo documentos PDF...', t('ui.generando_archivo_unificado_con_el_orden'));

      if (!response.ok || !json.success) {
        throw new Error(json.error || t('ui.no_se_pudieron_unir_los_documentos_pdf_i'));
      }

      this.currentResult = json.data as MergePdfResponseData;
      const token = this.currentResult.fileId;
      showToast(t('toasts.pdf_merged_success'), 'success');
      this.phaseManager?.navigateToDownload({
        downloadUrl: `/api/download/${token}`,
        fileSize: this.currentResult.fileSize,
        filename: this.currentResult.filename,
        returnText: 'Unir más archivos PDF',
        returnUrl: '/merge-pdf',
        subtitle: t('ui.se_han_unido_exitosamente_archivos_en_un'),
        title: '¡PDFs unidos con éxito!',
        token,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('ui.error_al_procesar_la_union_de_archivos');
      if (isLimitErrorMessage(msg)) {
        showUpgradeLimitModal({
          currentCount: this.selectedFiles.length,
          currentLimit: getCurrentUserToolLimits('merge-pdf').maxFiles,
          proLimit: 500,
          toolName: 'Unir PDF',
          type: 'files_count',
        });
        this.phaseManager?.setPhase('workspace');
        return;
      }
      this.phaseManager?.showError(msg, () => {
        this.phaseManager?.setPhase('workspace');
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private resetToInitial(): void {
    this.selectedFiles = [];
    this.currentResult = null;
    this.isProcessing = false;

    if (this.sortable) {
      this.sortable.destroy();
      this.sortable = null;
    }

    const itemsGrid = this.container.querySelector<HTMLElement>('[data-ref="pdf-items-grid"]');
    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="pdf-merger-workspace"]');

    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    if (outputNameInput) outputNameInput.value = '';
    if (itemsGrid) itemsGrid.innerHTML = '';

    this.phaseManager?.setPhase('dropzone');
  }
}

async function createMergePdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/merge-pdf/merge-pdf.html');
  const controller = new MergePdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { MergePdfController, createMergePdfView };
