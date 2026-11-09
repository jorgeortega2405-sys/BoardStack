import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { escapeHtml, postFormWithProgress } from '../../../services/api.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { saveDownloadPayloadAndNavigate } from '../../../services/tool-flow.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupDropdown, setupToolSidebarModal, showElement, toggleElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { OCR_LANGUAGES, OcrResultData } from './ocr-pdf.types.js';

export class OcrPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private dropdownCtrl: { close: () => void; destroy: () => void; update: () => void } | null = null;
  private isProcessing = false;
  private phaseManager: ToolPhaseManager | null = null;
  private selectedLanguages: string[] = ['spa'];
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
        desc: 'Convierte PDFs escaneados o basados en imágenes en documentos con texto seleccionable, indexable y editable.',
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) this.handleFileSelected(files[0]);
        },
        title: 'Reconocer texto OCR',
      },
      sidebarRef: 'ocr-pdf-sidebar',
      toolId: 'ocr-pdf',
      toolName: 'Reconocer texto OCR',
      topHeaderRef: 'component-top',
      workspaceCardRef: 'ocr-workspace-card',
    });
    await this.phaseManager.init();
    renderIcons(this.container);
    this.bindEvents();
    this.updateTriggerLabel();
  }

  public destroy(): void {
    if (this.dropdownCtrl) {
      this.dropdownCtrl.destroy();
      this.dropdownCtrl = null;
    }
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
    if (this.phaseManager) {
      this.phaseManager.destroy();
      this.phaseManager = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.currentFile = null;
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="ocr-pdf-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="ocr-sidebar-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');

    if (sidebar && backdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const ocrBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-ocr-action"]');

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetSelectedFile();
    }, { signal });

    const langDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-ocr-language"]');
    const langListEl = this.container.querySelector<HTMLElement>('[data-ref="list-ocr-languages"]');
    const langSearchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-ocr-language"]');
    const langEmptyEl = this.container.querySelector<HTMLElement>('[data-ref="empty-ocr-languages"]');

    if (langSearchInput && langListEl) {
      langSearchInput.addEventListener('input', (e: Event) => {
        this.filterLanguages(langListEl, langEmptyEl, (e.target as HTMLInputElement).value);
        this.dropdownCtrl?.update();
      }, { signal });
    }

    if (langDropdown && langListEl) {
      this.dropdownCtrl = setupDropdown(langDropdown, {
        backdrop: langDropdown.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-ocr-language"]'),
        isSelect: true,
        matchWidth: true,
        menu: langDropdown.querySelector<HTMLElement>('[data-ref="dropdown-menu-ocr-language"]'),
        offset: [0, 6],
        placement: 'bottom-start',
        onClose: () => {
          if (langSearchInput) {
            langSearchInput.value = '';
            this.filterLanguages(langListEl, langEmptyEl, '');
          }
        },
        onOpen: () => {
          this.renderLanguagesList(langListEl);
          if (langSearchInput) {
            langSearchInput.value = '';
            this.filterLanguages(langListEl, langEmptyEl, '');
            setTimeout(() => langSearchInput.focus(), 60);
          }
        },
        onSelect: (langCode: string, item?: HTMLElement) => {
          if (!langCode) return false;
          const idx = this.selectedLanguages.indexOf(langCode);
          if (idx !== -1) {
            if (this.selectedLanguages.length <= 1) {
              showToast('Debes seleccionar al menos un idioma.', 'warning');
              return false;
            }
            this.selectedLanguages.splice(idx, 1);
            if (item) {
              item.classList.remove('is-active');
              const checkIcon = item.querySelector<HTMLElement>('[data-ref^="icon-check-"]');
              if (checkIcon) checkIcon.classList.add('is-hidden');
            }
          } else {
            if (this.selectedLanguages.length >= 3) {
              showToast('Puedes seleccionar un máximo de 3 idiomas.', 'warning');
              return false;
            }
            this.selectedLanguages.push(langCode);
            if (item) {
              item.classList.add('is-active');
              const checkIcon = item.querySelector<HTMLElement>('[data-ref^="icon-check-"]');
              if (checkIcon) checkIcon.classList.remove('is-hidden');
            }
          }
          this.updateTriggerLabel();
          return false;
        },
      });
    }

    ocrBtn?.addEventListener('click', () => {
      void this.handleOcr(ocrBtn);
    }, { signal });
  }

  private updateTriggerLabel(): void {
    const triggerTextEl = this.container.querySelector<HTMLElement>('[data-ref="ocr-language-selected-text"]');
    if (!triggerTextEl) return;
    const names = this.selectedLanguages
      .map((code) => OCR_LANGUAGES.find((item) => item.code === code)?.name || code);
    triggerTextEl.textContent = names.join(', ') || 'Español';
  }

  private renderLanguagesList(container: HTMLElement): void {
    container.innerHTML = OCR_LANGUAGES.map((l) => {
      const isActive = this.selectedLanguages.includes(l.code);
      return `<button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="option-ocr-lang-${l.code}" data-lang="${l.code}">
        <span class="menu-item__text">${escapeHtml(l.name)}</span>
        <svg class="component-icon menu-item__icon${isActive ? '' : ' is-hidden'}" data-ref="icon-check-${l.code}" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
      </button>`;
    }).join('');
    renderIcons(container);
  }

  private filterLanguages(listEl: HTMLElement, emptyEl: HTMLElement | null, query: string): void {
    const cleanQuery = query.toLowerCase().trim();
    let matchesCount = 0;
    const items = listEl.querySelectorAll<HTMLElement>('.menu-item');
    items.forEach((item) => {
      const name = item.querySelector('.menu-item__text')?.textContent?.toLowerCase() || '';
      const code = (item.getAttribute('data-lang') || '').toLowerCase();
      const match = !cleanQuery || name.includes(cleanQuery) || code.includes(cleanQuery);
      toggleElement(item, match);
      if (match) matchesCount++;
    });
    if (emptyEl) {
      toggleElement(emptyEl, matchesCount === 0);
    }
  }

  private handleFileSelected(file: File): void {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast('Solo se permiten archivos en formato PDF.', 'danger');
      return;
    }

    const limits = getCurrentUserToolLimits('ocr-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'ocr-pdf',
        toolName: 'OCR PDF',
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;
    this.renderSelectedState(file);
  }

  private renderSelectedState(file: File): void {
    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="txt-file-name"], [data-ref="selected-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="txt-file-size"], [data-ref="selected-file-size"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="ocr-pdf-workspace"]');
    const ocrBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-ocr-action"]');

    this.phaseManager?.setPhase('workspace');

    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (ocrBtn) ocrBtn.disabled = false;

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${base}_ocr.pdf`;
    }

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="ocr-doc-canvas"], [data-ref="doc-preview-canvas"]');
    if (canvas) {
      void this.renderThumbnail(file, canvas);
    }
  }

  private async renderThumbnail(file: File, canvas: HTMLCanvasElement): Promise<void> {
    let pdf: any = null;
    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const targetWidth = 180;
      const origViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / origViewport.width;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    } catch {
    } finally {
      try {
        if (pdf) await pdf.destroy();
      } catch {}
    }
  }

  private resetSelectedFile(): void {
    this.currentFile = null;
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="ocr-pdf-workspace"]');
    const ocrBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-ocr-action"]');

    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    this.sidebarModal?.close();

    if (ocrBtn) ocrBtn.disabled = true;

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="ocr-doc-canvas"], [data-ref="doc-preview-canvas"]');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) outputNameInput.value = 'documento_ocr.pdf';

    this.selectedLanguages = ['spa'];
    this.updateTriggerLabel();
    this.phaseManager?.setPhase('dropzone');
  }

  private async handleOcr(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
        const customFilename = outputNameInput?.value.trim();

        const formData = new FormData();
        formData.append('pdf', this.currentFile as Blob, this.currentFile?.name);
        formData.append('language', this.selectedLanguages.join('+'));
        formData.append('deskew', 'false');
        if (customFilename) {
          formData.append('filename', customFilename);
        }

        const response = await postFormWithProgress(
          API_ROUTES.tools.ocrPdf.process,
          formData,
          (progress) => {
            this.phaseManager?.updateUploadProgress(progress);
          }
        );
        const result = (await response.json()) as { data?: OcrResultData; error?: string; success: boolean };

        this.phaseManager?.showProcessing('Reconociendo texto óptico (OCR)...', 'Escaneando páginas y generando capa de texto indexable y seleccionable');

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || 'Error al procesar el reconocimiento óptico de texto.');
        }

        const token = result.data.fileId;
        showToast('Texto reconocido y documento generado con éxito.', 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.processedSize,
          filename: customFilename || result.data.filename,
          returnText: 'Reconocer texto en otro PDF',
          returnUrl: '/ocr-pdf',
          subtitle: `Se ha aplicado reconocimiento óptico de texto exitosamente a "${this.currentFile?.name}".`,
          title: '¡Texto reconocido con éxito!',
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Error inesperado al aplicar OCR.';
        this.phaseManager?.showError(errorMessage, () => {
          this.phaseManager?.setPhase('workspace');
        });
        showToast(errorMessage, 'danger');
      } finally {
        this.isProcessing = false;
      }
    });
  }
}

export async function createOcrPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/ocr-pdf/ocr-pdf.html');
  const controller = new OcrPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
