import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupDropdown, setupToolSidebarModal, showElement, toggleElement, withButtonLoading } from '../../../utils/dom.util.js';
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
        buttonText: 'Seleccionar PDF',
        desc: 'Añade numeración de páginas en cualquier posición, formato y tipografía a tu documento PDF.',
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: 'Insertar números de página',
      },
      sidebarRef: 'page-numbers-sidebar',
      toolId: 'page-numbers',
      toolName: 'Insertar números de página',
      topHeaderRef: 'component-top',
      workspaceCardRef: 'pn-workspace-card',
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
    const posCells = posGrid?.querySelectorAll<HTMLButtonElement>('.pn-position-cell');
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

    this.setupDropdowns(signal);
  }

  private setupDropdowns(signal: AbortSignal): void {
    const marginWrap = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pn-margin"]');
    if (marginWrap) {
      const ctrl = setupDropdown(marginWrap, {
        isSelect: true,
        onSelect: (val) => {
          this.margin = val as PageNumberMargin;
          const text = marginWrap.querySelector<HTMLElement>('[data-ref="pn-margin-selected-text"]');
          if (text) {
            text.textContent = val === 'small' ? 'Pequeño' : val === 'recommended' ? 'Recomendado' : 'Grande';
          }
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const formatWrap = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pn-format"]');
    const customTextGroup = this.container.querySelector<HTMLElement>('[data-ref="group-custom-text"]');
    if (formatWrap) {
      const ctrl = setupDropdown(formatWrap, {
        isSelect: true,
        onSelect: (val) => {
          this.format = val;
          const text = formatWrap.querySelector<HTMLElement>('[data-ref="pn-format-selected-text"]');
          if (text) {
            text.textContent = val === '{n}' ? 'Solo número de página' : val === '{n}/{p}' ? 'Página {n} de {p}' : 'Texto personalizado';
          }
          toggleElement(customTextGroup, val === 'custom');
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    const fontWrap = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pn-font"]');
    if (fontWrap) {
      const ctrl = setupDropdown(fontWrap, {
        isSelect: true,
        onSelect: (val) => {
          this.fontFamily = val;
          const text = fontWrap.querySelector<HTMLElement>('[data-ref="pn-font-selected-text"]');
          if (text) text.textContent = val;
        },
      });
      this.dropdownControllers.push(ctrl);
    }
  }

  private async handleFileSelected(file: File): Promise<void> {
    if (this.isProcessing) return;

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      showToast('Selecciona únicamente un archivo PDF válido.', 'danger');
      return;
    }

    const limits = getCurrentUserToolLimits('page-numbers');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showToast(`El archivo PDF supera el tamaño máximo permitido de ${limits.maxFileSizeMB} MB.`, 'danger');
      return;
    }

    this.currentFile = file;

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-page-numbers"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="page-numbers-workspace"]');
    const filenameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');

    this.phaseManager?.setPhase('workspace');

    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
    if (filenameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      filenameInput.value = `${base}_numerado.pdf`;
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
      if (toPageInput) toPageInput.value = numPages.toString();

      if (executeBtn) executeBtn.disabled = false;
      this.renderPagesView();
    } catch {
      showToast('No se pudo leer el archivo PDF seleccionado. Asegúrate de que no esté dañado ni protegido.', 'danger');
      this.resetToInitial();
    }
  }

  private renderPagesView(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="pn-pages-grid"]');
    if (!grid) return;
    grid.innerHTML = '';

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
          <span class="pdf-card__title">Página ${p.pageNum}</span>
        </div>
      `).join('');
    } else {
      grid.className = 'pdf-items-grid pn-pages-grid pn-pages-grid--facing';
      let html = '';

      for (let i = 0; i < this.pages.length; i += 2) {
        const leftPage = this.pages[i];
        const rightPage = this.pages[i + 1];

        html += `<div class="pn-facing-pair" data-ref="facing-pair-${i / 2}">`;
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
    this.phaseManager?.showUploading(1, 1);

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
            this.phaseManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as {
          data?: PageNumberResponseData;
          error?: string;
          success: boolean;
        };

        this.phaseManager?.showProcessing('Insertando números de página...', 'Renderizando y estampando las numeraciones en el documento PDF');

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || 'Ocurrió un error al insertar números de página.');
        }

        const token = result.data.fileId;
        showToast('Números de página insertados con éxito.', 'success');
        this.phaseManager?.navigateToDownload({
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
        const errorMessage = err instanceof Error ? err.message : 'Error inesperado al numerar el documento.';
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

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = 'documento_numerado.pdf';
    if (this.sidebarModal) this.sidebarModal.close();

    this.phaseManager?.setPhase('dropzone');
  }
}

export async function createPageNumbersView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/page-numbers/page-numbers.html');
  const controller = new PageNumbersController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
