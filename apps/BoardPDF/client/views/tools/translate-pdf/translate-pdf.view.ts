import { ToolStatusManager } from '../../../components/tool-status.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { pickDropboxFiles } from '../../../services/dropbox.service.js';
import { pickGoogleDriveFiles } from '../../../services/google-drive.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { saveDownloadPayloadAndNavigate } from '../../../services/tool-flow.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, bindFileDropzone, hideElement, setupDropdown, setupToolSidebarModal, showElement, toggleElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { OCR_LANGUAGES } from '../ocr-pdf/ocr-pdf.types.js';
import { TranslatePdfResultData } from './translate-pdf.types.js';

const CLEAN_LANGUAGES = OCR_LANGUAGES.filter(
  (lang) => !lang.code.includes('_') && lang.code !== 'equ' && !lang.name.includes('antiguo')
);

const SOURCE_LANG_ITEMS = [
  { code: '', name: 'Detección automática (Recomendado)' },
  ...CLEAN_LANGUAGES,
];

const TARGET_LANG_ITEMS = [...CLEAN_LANGUAGES];

export class TranslatePdfViewController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private dropdownControllers: Array<{ destroy: () => void }> = [];
  private isProcessing = false;
  private selectedLayout: 'preserve' | 'text_only' = 'preserve';
  private sidebarModal: ToolSidebarModalController | null = null;
  private sourceLang = '';
  private statusManager: ToolStatusManager | null = null;
  private targetLang = 'spa';

  private readonly layoutDetails = {
    preserve: {
      desc: 'El PDF procesado mantendrá el diseño lo más cercano posible al PDF original.',
      title: 'Mantener el diseño',
    },
    text_only: {
      desc: 'El PDF procesado contiene solo texto y su jerarquía.',
      title: 'Solo texto',
    },
  };

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="translate-pdf-workspace"]');
    this.statusManager = new ToolStatusManager(workspace || this.container);
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
    if (this.statusManager) {
      this.statusManager.destroy();
      this.statusManager = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.dropdownControllers.forEach((ctrl) => ctrl.destroy());
    this.dropdownControllers = [];
    this.currentFile = null;
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="translate-pdf-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="translate-sidebar-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');

    if (sidebar && backdrop) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="translate-dropzone-card"]');
    const browseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-browse-file"]');
    const heroDriveBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-drive"]');
    const heroDropboxBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-dropbox"]');
    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const translateBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-translate-action"]');

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    }, { signal });

    heroDriveBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickGoogleDriveFiles({ multiselect: false });
      if (files && files.length > 0) {
        this.handleFileSelected(files[0]);
      }
    }, { signal });

    heroDropboxBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickDropboxFiles({ multiselect: false });
      if (files && files.length > 0) {
        this.handleFileSelected(files[0]);
      }
    }, { signal });

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetSelectedFile();
    }, { signal });

    fileInput?.addEventListener('change', () => {
      const files = fileInput.files;
      if (files && files.length > 0) {
        this.handleFileSelected(files[0]);
      }
    }, { signal });

    if (dropzoneCard) {
      bindFileDropzone({
        dropTarget: dropzoneCard,
        onFiles: (files) => {
          if (files.length > 0) this.handleFileSelected(files[0]);
        },
        signal,
        visualTarget: dropzoneCard,
      });
    }

    const wrapperSource = this.container.querySelector<HTMLElement>('[data-ref="wrapper-source-lang"]');
    const listSource = this.container.querySelector<HTMLElement>('[data-ref="list-source-lang"]');
    const inputSearchSource = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-source-lang"]');
    const emptySource = this.container.querySelector<HTMLElement>('[data-ref="empty-source-lang"]');
    const txtSelectedSource = this.container.querySelector<HTMLElement>('[data-ref="txt-selected-source-lang"]');

    if (listSource) {
      this.renderSourceLanguages(listSource);
    }

    inputSearchSource?.addEventListener('input', (e) => {
      if (listSource) {
        this.filterLanguages(listSource, emptySource, (e.target as HTMLInputElement).value);
      }
    }, { signal });

    if (wrapperSource) {
      const ctrl = setupDropdown(wrapperSource, {
        backdrop: this.container.querySelector<HTMLElement>('[data-ref="backdrop-source-lang"]'),
        menu: this.container.querySelector<HTMLElement>('[data-ref="menu-source-lang"]'),
        onSelect: (val: string) => {
          this.sourceLang = val || '';
          const found = SOURCE_LANG_ITEMS.find((l) => l.code === val);
          if (txtSelectedSource) {
            txtSelectedSource.textContent = found ? found.name : 'Detección automática (Recomendado)';
          }
          if (listSource) {
            this.renderSourceLanguages(listSource);
            if (inputSearchSource) {
              inputSearchSource.value = '';
              this.filterLanguages(listSource, emptySource, '');
            }
          }
        },
        trigger: this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-source-lang"]'),
      });
      this.dropdownControllers.push(ctrl);
    }

    const wrapperTarget = this.container.querySelector<HTMLElement>('[data-ref="wrapper-target-lang"]');
    const listTarget = this.container.querySelector<HTMLElement>('[data-ref="list-target-lang"]');
    const inputSearchTarget = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-target-lang"]');
    const emptyTarget = this.container.querySelector<HTMLElement>('[data-ref="empty-target-lang"]');
    const txtSelectedTarget = this.container.querySelector<HTMLElement>('[data-ref="txt-selected-target-lang"]');

    if (listTarget) {
      this.renderTargetLanguages(listTarget);
    }

    inputSearchTarget?.addEventListener('input', (e) => {
      if (listTarget) {
        this.filterLanguages(listTarget, emptyTarget, (e.target as HTMLInputElement).value);
      }
    }, { signal });

    if (wrapperTarget) {
      const ctrl = setupDropdown(wrapperTarget, {
        backdrop: this.container.querySelector<HTMLElement>('[data-ref="backdrop-target-lang"]'),
        menu: this.container.querySelector<HTMLElement>('[data-ref="menu-target-lang"]'),
        onSelect: (val: string) => {
          this.targetLang = val || 'spa';
          const found = TARGET_LANG_ITEMS.find((l) => l.code === val);
          if (txtSelectedTarget) {
            txtSelectedTarget.textContent = found ? found.name : 'Español';
          }
          if (listTarget) {
            this.renderTargetLanguages(listTarget);
            if (inputSearchTarget) {
              inputSearchTarget.value = '';
              this.filterLanguages(listTarget, emptyTarget, '');
            }
          }
        },
        trigger: this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-target-lang"]'),
      });
      this.dropdownControllers.push(ctrl);
    }

    const btnPreserve = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layout-preserve"]');
    const btnText = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layout-text"]');

    btnPreserve?.addEventListener('click', () => {
      this.setLayoutMode('preserve');
    }, { signal });

    btnText?.addEventListener('click', () => {
      this.setLayoutMode('text_only');
    }, { signal });

    translateBtn?.addEventListener('click', () => {
      void this.handleTranslate(translateBtn);
    }, { signal });
  }

  private renderSourceLanguages(container: HTMLElement): void {
    container.innerHTML = SOURCE_LANG_ITEMS.map((l) => {
      const isActive = this.sourceLang === l.code;
      return `
        <button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="item-source-lang" data-lang="${l.code}" data-value="${l.code}">
          <span class="menu-item__text">${l.name}</span>
        </button>
      `;
    }).join('');
  }

  private renderTargetLanguages(container: HTMLElement): void {
    container.innerHTML = TARGET_LANG_ITEMS.map((l) => {
      const isActive = this.targetLang === l.code;
      return `
        <button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="item-target-lang" data-lang="${l.code}" data-value="${l.code}">
          <span class="menu-item__text">${l.name}</span>
        </button>
      `;
    }).join('');
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

  private setLayoutMode(mode: 'preserve' | 'text_only'): void {
    this.selectedLayout = mode;
    const toggle = this.container.querySelector<HTMLElement>('[data-ref="translate-layout-toggle"]');
    if (toggle) {
      toggle.setAttribute('data-active', mode === 'preserve' ? '0' : '1');
    }

    const btnPreserve = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layout-preserve"]');
    const btnText = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layout-text"]');
    if (btnPreserve) btnPreserve.classList.toggle('is-active', mode === 'preserve');
    if (btnText) btnText.classList.toggle('is-active', mode === 'text_only');

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="translate-layout-title"]');
    const descEl = this.container.querySelector<HTMLElement>('[data-ref="translate-layout-desc"]');
    const detail = this.layoutDetails[mode];
    if (titleEl && detail) titleEl.textContent = detail.title;
    if (descEl && detail) descEl.textContent = detail.desc;
  }

  private handleFileSelected(file: File): void {
    this.hideError();

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.showError('Solo se permiten documentos en formato PDF.');
      return;
    }

    const limits = getCurrentUserToolLimits('translate-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      this.showError(`El archivo PDF excede el límite máximo de ${limits.maxFileSizeMB} MB.`);
      return;
    }

    this.currentFile = file;
    this.renderSelectedState(file);
  }

  private renderSelectedState(file: File): void {
    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="translate-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="translate-selected-card"]');
    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-size"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="translate-pdf-sidebar"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="translate-pdf-workspace"]');
    const translateBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-translate-action"]');

    hideElement(dropzoneCard);
    showElement(selectedCard);

    showElement(sidebar);
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (translateBtn) translateBtn.disabled = false;

    void this.renderThumbnail(file);
  }

  private async renderThumbnail(file: File): Promise<void> {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="doc-preview-canvas"]');
    if (!canvas) return;

    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const targetWidth = 140;
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
    } catch {}
  }

  private resetSelectedFile(): void {
    this.currentFile = null;
    this.statusManager?.hide();
    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    if (fileInput) fileInput.value = '';

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="translate-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="translate-selected-card"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="translate-pdf-sidebar"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="translate-pdf-workspace"]');
    const translateBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-translate-action"]');

    showElement(dropzoneCard);
    hideElement(selectedCard);

    hideElement(sidebar);
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    if (translateBtn) translateBtn.disabled = true;

    this.hideError();
  }

  private async handleTranslate(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    this.isProcessing = true;
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="translate-selected-card"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="translate-pdf-sidebar"]');
    hideElement(selectedCard);
    hideElement(sidebar);
    this.statusManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        formData.append('pdf', this.currentFile as Blob, this.currentFile?.name);
        formData.append('targetLang', this.targetLang);
        if (this.sourceLang) {
          formData.append('sourceLang', this.sourceLang);
        }
        formData.append('layoutMode', this.selectedLayout);

        const response = await postFormWithProgress(
          API_ROUTES.tools.translatePdf.translate,
          formData,
          (progress) => {
            this.statusManager?.updateUploadProgress(progress);
          }
        );
        const res = (await response.json()) as { data?: TranslatePdfResultData; error?: string; success: boolean };

        this.statusManager?.showProcessingState({
          subtitle: this.selectedLayout === 'preserve'
            ? 'Conservando formato, tipografía y tablas en el idioma de destino'
            : 'Generando documento con texto traducido estructurado',
          title: 'Traduciendo documento...',
        });

        if (!response.ok || !res.success || !res.data) {
          throw new Error(res.error || 'Error al traducir el documento PDF.');
        }

        const token = res.data.fileId;
        showToast('Documento traducido con éxito.', 'success');
        saveDownloadPayloadAndNavigate({
          downloadUrl: `/api/download/${token}`,
          fileSize: res.data.size,
          filename: res.data.filename,
          returnText: 'Traducir otro documento',
          returnUrl: '/translate-pdf',
          subtitle: `Se ha traducido exitosamente "${this.currentFile?.name}".`,
          title: '¡PDF traducido con éxito!',
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Error al conectar con el servidor.';
        this.statusManager?.showError(errorMessage, () => {
          this.statusManager?.hide();
          showElement(selectedCard);
          showElement(sidebar);
        });
        this.showError(errorMessage);
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="translate-error-banner"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="translate-error-banner"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

export async function createTranslatePdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/translate-pdf/translate-pdf.html');
  const controller = new TranslatePdfViewController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
