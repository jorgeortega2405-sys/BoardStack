import { openModal } from '../../../components/modal.component.js';
import { ToolStatusManager } from '../../../components/tool-status.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { escapeHtml, postApi, postFormWithProgress } from '../../../services/api.service.js';
import { pickDropboxFiles } from '../../../services/dropbox.service.js';
import { pickGoogleDriveFiles } from '../../../services/google-drive.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { saveDownloadPayloadAndNavigate } from '../../../services/tool-flow.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, bindFileDropzone, hideElement, setupDropdown, setupToolSidebarModal, showElement, toggleElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { HtmlMargin, HtmlOrientation, HtmlScreenSize, JpgOrientation, JpgPageMargin, JpgPageSize, TO_PDF_CONFIGS, ToPdfRouteConfig, ToPdfSourceType } from './to-pdf-converter.types.js';

export class ToPdfConverterController implements ViewController {
  private abortController: AbortController | null = null;
  private config: ToPdfRouteConfig;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private currentUrl: string | null = null;
  private dropdownHtmlScreenCtrl: { close: () => void; destroy: () => void; update: () => void } | null = null;
  private dropdownJpgSizeCtrl: { close: () => void; destroy: () => void; update: () => void } | null = null;
  private htmlBlockAds = false;
  private htmlMargin: HtmlMargin = 'none';
  private htmlOrientation: HtmlOrientation = 'portrait';
  private htmlRemovePopups = true;
  private htmlScreen: HtmlScreenSize = 'screen';
  private htmlSinglePage = false;
  private htmlUrl = '';
  private imageFiles: File[] = [];
  private imagePreviewUrls: string[] = [];
  private isConverting = false;
  private jpgMargin: JpgPageMargin = 'none';
  private jpgMerge = true;
  private jpgOrientation: JpgOrientation = 'portrait';
  private jpgPageSize: JpgPageSize = 'fit';
  private previewImageUrl: string | null = null;
  private sidebarModal: ToolSidebarModalController | null = null;
  private statusManager: ToolStatusManager | null = null;

  constructor(container: HTMLElement, sourceType?: ToPdfSourceType) {
    this.container = container;
    const currentPath = window.location.pathname;
    this.config = TO_PDF_CONFIGS[currentPath] ||
      Object.values(TO_PDF_CONFIGS).find((c) => c.sourceType === sourceType) ||
      TO_PDF_CONFIGS['/word-to-pdf'];
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-workspace"]') || this.container;
    this.statusManager = new ToolStatusManager({
      container: workspace,
      onRetry: () => {
        this.statusManager?.hide();
        if (this.currentFile || this.currentUrl || this.imageFiles.length > 0) {
          const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-card"]');
          const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="converter-selected-card"]');
          const htmlPreviewView = this.container.querySelector<HTMLElement>('[data-ref="html-preview-view"]');
          const sidebar = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-sidebar"]');
          const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
          const fabMore = this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"]');
          const ws = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-workspace"]');

          hideElement(dropzoneCard);
          if (this.config.sourceType === 'html-to-pdf') {
            showElement(htmlPreviewView);
            hideElement(selectedCard);
          } else {
            showElement(selectedCard);
            hideElement(htmlPreviewView);
          }
          showElement(sidebar);
          if (settingsBtn) settingsBtn.classList.add('is-visible');
          showElement(fabMore);
          if (ws) ws.classList.add('tool-layout__workspace--top-aligned');
        } else {
          this.resetSelectedFile();
        }
      },
      toolName: this.config.title,
    });
    this.applyConfiguration();
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.dropdownJpgSizeCtrl) {
      this.dropdownJpgSizeCtrl.destroy();
      this.dropdownJpgSizeCtrl = null;
    }
    if (this.dropdownHtmlScreenCtrl) {
      this.dropdownHtmlScreenCtrl.destroy();
      this.dropdownHtmlScreenCtrl = null;
    }
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
    if (this.statusManager) {
      this.statusManager.destroy();
      this.statusManager = null;
    }
    if (this.previewImageUrl) {
      URL.revokeObjectURL(this.previewImageUrl);
      this.previewImageUrl = null;
    }
    for (const url of this.imagePreviewUrls) {
      URL.revokeObjectURL(url);
    }
    this.imagePreviewUrls = [];
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private applyConfiguration(): void {
    const heroTitleEl = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-title"]');
    if (heroTitleEl) heroTitleEl.textContent = this.config.title;

    const heroDescEl = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-desc"]');
    if (heroDescEl) heroDescEl.textContent = this.config.subtitle;

    const browseTextEl = this.container.querySelector<HTMLElement>('[data-ref="txt-browse-file"]');
    if (browseTextEl) browseTextEl.textContent = this.config.browseText || 'Seleccionar Archivo';

    const hintEl = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-hint"]');
    if (hintEl) hintEl.textContent = this.config.hintText || 'o arrastra y suelta tu archivo aquí';

    const cloudBtns = this.container.querySelector<HTMLElement>('[data-ref="hero-cloud-btns"]');
    if (cloudBtns) {
      toggleElement(cloudBtns, !this.config.isUrlMode);
    }

    const fabAddMoreBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-fab-add-more"]');
    if (fabAddMoreBtn && this.config.isUrlMode) {
      fabAddMoreBtn.setAttribute('data-tooltip', 'Cambiar URL');
      fabAddMoreBtn.setAttribute('aria-label', 'Cambiar URL');
    }

    const fabOptions = this.container.querySelector<HTMLElement>('[data-ref="tool-fab-options"]');
    if (fabOptions && this.config.isUrlMode) {
      hideElement(fabOptions);
    }

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="converter-sidebar-title"]');
    if (titleEl) titleEl.textContent = this.config.title;

    const subtitleEl = this.container.querySelector<HTMLElement>('[data-ref="converter-sidebar-subtitle"]');
    if (subtitleEl) subtitleEl.textContent = this.config.subtitle;

    const actionTextEl = this.container.querySelector<HTMLElement>('[data-ref="txt-convert-action"]');
    if (actionTextEl) actionTextEl.textContent = this.config.actionText;

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-source-file"]');
    if (fileInput) {
      fileInput.accept = this.config.accept;
      fileInput.multiple = this.config.sourceType === 'jpg-to-pdf';
    }

    const iconBoxUse = this.container.querySelector<SVGElement>('[data-ref="selected-file-symbol"] use');
    if (iconBoxUse) iconBoxUse.setAttribute('href', `/icons.svg#${this.config.icon}`);

    const jpgSection = this.container.querySelector<HTMLElement>('[data-ref="section-jpg-options"]');
    const htmlSection = this.container.querySelector<HTMLElement>('[data-ref="section-html-options"]');
    const sidebarNotice = this.container.querySelector<HTMLElement>('[data-ref="converter-sidebar-notice"]');

    if (this.config.sourceType === 'jpg-to-pdf') {
      showElement(jpgSection);
      hideElement(htmlSection);
      showElement(sidebarNotice);
    } else if (this.config.sourceType === 'html-to-pdf') {
      hideElement(jpgSection);
      showElement(htmlSection);
      hideElement(sidebarNotice);

      const userScreenOpt = this.container.querySelector<HTMLElement>('[data-ref="txt-option-screen-user"]');
      const userScreenText = `Tu pantalla (${window.screen.width}x${window.screen.height})`;
      if (userScreenOpt) userScreenOpt.textContent = userScreenText;

      const screenSelectedText = this.container.querySelector<HTMLElement>('[data-ref="html-screen-selected-text"]');
      if (screenSelectedText) screenSelectedText.textContent = userScreenText;

      const previewBadge = this.container.querySelector<HTMLElement>('[data-ref="html-preview-badge"]');
      if (previewBadge) previewBadge.textContent = userScreenText;
    } else {
      hideElement(jpgSection);
      hideElement(htmlSection);
      showElement(sidebarNotice);
    }
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');

    if (sidebar && backdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-source-file"]');
    const dropzone = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone"]');
    const browseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-browse-file"]');
    const heroDriveBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-drive"]');
    const heroDropboxBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-hero-dropbox"]');
    const fabAddMoreBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-fab-add-more"]');
    const fabDriveBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-fab-drive"]');
    const fabDropboxBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-fab-dropbox"]');
    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const convertBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-convert-action"]');

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.config.isUrlMode) {
        this.openUrlModal();
      } else {
        fileInput?.click();
      }
    }, { signal });

    fabAddMoreBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.config.isUrlMode) {
        this.openUrlModal();
      } else {
        fileInput?.click();
      }
    }, { signal });

    heroDriveBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickGoogleDriveFiles({ multiselect: this.config.sourceType === 'jpg-to-pdf' });
      if (files && files.length > 0) {
        this.handleFilesReceived(files);
      }
    }, { signal });

    fabDriveBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickGoogleDriveFiles({ multiselect: this.config.sourceType === 'jpg-to-pdf' });
      if (files && files.length > 0) {
        this.handleFilesReceived(files);
      }
    }, { signal });

    heroDropboxBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickDropboxFiles({ multiselect: this.config.sourceType === 'jpg-to-pdf' });
      if (files && files.length > 0) {
        this.handleFilesReceived(files);
      }
    }, { signal });

    fabDropboxBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickDropboxFiles({ multiselect: this.config.sourceType === 'jpg-to-pdf' });
      if (files && files.length > 0) {
        this.handleFilesReceived(files);
      }
    }, { signal });

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetSelectedFile();
    }, { signal });

    fileInput?.addEventListener('change', () => {
      const files = fileInput.files;
      if (files && files.length > 0) {
        this.handleFilesReceived(Array.from(files));
      }
    }, { signal });

    if (dropzone && !this.config.isUrlMode) {
      bindFileDropzone({
        dropTarget: dropzone,
        onFiles: (files) => {
          if (files.length > 0) {
            this.handleFilesReceived(Array.from(files));
          }
        },
        signal,
        visualTarget: dropzone,
      });
    }

    this.bindJpgOptions(signal);
    this.bindHtmlOptions(signal);

    convertBtn?.addEventListener('click', () => {
      void this.handleConvert(convertBtn);
    }, { signal });
  }

  private bindJpgOptions(signal: AbortSignal): void {
    const jpgOrientToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-jpg-orientation"]');
    jpgOrientToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as JpgOrientation;
      if (!val) return;
      this.jpgOrientation = val;
      const isLandscape = val === 'landscape';
      jpgOrientToggle.setAttribute('data-active', isLandscape ? '1' : '0');
      jpgOrientToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    }, { signal });

    const jpgSizeDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-jpg-page-size"]');
    const jpgSizeText = this.container.querySelector<HTMLElement>('[data-ref="jpg-page-size-selected-text"]');
    if (jpgSizeDropdown) {
      this.dropdownJpgSizeCtrl = setupDropdown(jpgSizeDropdown, {
        backdrop: jpgSizeDropdown.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-jpg-page-size"]'),
        isSelect: true,
        matchWidth: true,
        menu: jpgSizeDropdown.querySelector<HTMLElement>('[data-ref="dropdown-menu-jpg-page-size"]'),
        offset: [0, 6],
        placement: 'bottom-start',
        onSelect: (val: string, item?: HTMLElement) => {
          if (!val) return;
          this.jpgPageSize = val as JpgPageSize;
          const labels: Record<JpgPageSize, string> = {
            a4: 'A4 297x210 mm',
            fit: 'Ajustado (mismo tamaño de pagina de la imagen)',
            letter: 'US Letter 215x279.4mm',
          };
          if (jpgSizeText) {
            jpgSizeText.textContent = labels[this.jpgPageSize] || val;
          }
          const checkIcons = jpgSizeDropdown.querySelectorAll<HTMLElement>('[data-ref^="check-jpg-size-"]');
          checkIcons.forEach((icon) => icon.classList.add('is-hidden'));
          const activeCheck = item?.querySelector<HTMLElement>('[data-ref^="check-jpg-size-"]');
          if (activeCheck) activeCheck.classList.remove('is-hidden');
        },
      });
    }

    const jpgMarginToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-jpg-margin"]');
    jpgMarginToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as JpgPageMargin;
      if (!val) return;
      this.jpgMargin = val;
      const idx = val === 'none' ? '0' : val === 'small' ? '1' : '2';
      jpgMarginToggle.setAttribute('data-active', idx);
      jpgMarginToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    }, { signal });

    const mergeCheck = this.container.querySelector<HTMLInputElement>('[data-ref="check-merge-images"]');
    mergeCheck?.addEventListener('change', () => {
      this.jpgMerge = mergeCheck.checked;
    }, { signal });
  }

  private bindHtmlOptions(signal: AbortSignal): void {
    const htmlUrlInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-html-url"]');
    htmlUrlInput?.addEventListener('input', () => {
      const val = htmlUrlInput.value.trim();
      this.htmlUrl = val;
      this.currentUrl = val;
    }, { signal });

    const refreshBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-refresh-html-preview"]');
    const toolbarRefreshBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toolbar-refresh-preview"]');
    const handleRefresh = () => {
      const targetUrl = this.htmlUrl || this.currentUrl;
      if (!targetUrl) {
        this.showError('Debes ingresar la dirección URL de una página web.');
        return;
      }
      void this.fetchUrlPreview(targetUrl, this.htmlScreen);
    };

    refreshBtn?.addEventListener('click', handleRefresh, { signal });
    toolbarRefreshBtn?.addEventListener('click', handleRefresh, { signal });

    const htmlScreenDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-html-screen"]');
    const htmlScreenText = this.container.querySelector<HTMLElement>('[data-ref="html-screen-selected-text"]');
    const previewBadge = this.container.querySelector<HTMLElement>('[data-ref="html-preview-badge"]');
    const browserFrame = this.container.querySelector<HTMLElement>('[data-ref="html-browser-frame"]');

    if (htmlScreenDropdown) {
      this.dropdownHtmlScreenCtrl = setupDropdown(htmlScreenDropdown, {
        backdrop: htmlScreenDropdown.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-html-screen"]'),
        isSelect: true,
        matchWidth: true,
        menu: htmlScreenDropdown.querySelector<HTMLElement>('[data-ref="dropdown-menu-html-screen"]'),
        offset: [0, 6],
        placement: 'bottom-start',
        onSelect: (val: string, item?: HTMLElement) => {
          if (!val) return;
          this.htmlScreen = val as HtmlScreenSize;
          const userScreenLabel = `Tu pantalla (${window.screen.width}x${window.screen.height})`;
          const labels: Record<HtmlScreenSize, string> = {
            '1440': 'Escritorio (1440px)',
            '1920': 'Escritorio HD (1920px)',
            '320': 'Móvil (320px)',
            '768': 'Tableta (768px)',
            screen: userScreenLabel,
          };
          const selectedLabel = labels[this.htmlScreen] || val;
          if (htmlScreenText) htmlScreenText.textContent = selectedLabel;
          if (previewBadge) previewBadge.textContent = selectedLabel;
          if (browserFrame) browserFrame.setAttribute('data-screen', val);

          const checkIcons = htmlScreenDropdown.querySelectorAll<HTMLElement>('[data-ref^="check-screen-"]');
          checkIcons.forEach((icon) => icon.classList.add('is-hidden'));
          const activeCheck = item?.querySelector<HTMLElement>('[data-ref^="check-screen-"]');
          if (activeCheck) activeCheck.classList.remove('is-hidden');
        },
      });
    }

    const singlePageCheck = this.container.querySelector<HTMLInputElement>('[data-ref="check-html-single-page"]');
    singlePageCheck?.addEventListener('change', () => {
      this.htmlSinglePage = singlePageCheck.checked;
    }, { signal });

    const htmlOrientToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-html-orientation"]');
    htmlOrientToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as HtmlOrientation;
      if (!val) return;
      this.htmlOrientation = val;
      const isLandscape = val === 'landscape';
      htmlOrientToggle.setAttribute('data-active', isLandscape ? '1' : '0');
      htmlOrientToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      if (browserFrame) browserFrame.setAttribute('data-orientation', val);
    }, { signal });

    const htmlMarginToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-html-margin"]');
    htmlMarginToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as HtmlMargin;
      if (!val) return;
      this.htmlMargin = val;
      const idx = val === 'none' ? '0' : val === 'small' ? '1' : '2';
      htmlMarginToggle.setAttribute('data-active', idx);
      htmlMarginToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    }, { signal });

    const blockAdsCheck = this.container.querySelector<HTMLInputElement>('[data-ref="check-html-block-ads"]');
    blockAdsCheck?.addEventListener('change', () => {
      this.htmlBlockAds = blockAdsCheck.checked;
    }, { signal });

    const removePopupsCheck = this.container.querySelector<HTMLInputElement>('[data-ref="check-html-remove-popups"]');
    removePopupsCheck?.addEventListener('change', () => {
      this.htmlRemovePopups = removePopupsCheck.checked;
    }, { signal });
  }

  private openUrlModal(): void {
    const currentVal = this.currentUrl || '';
    const modal = openModal({
      bodyHtml: `
        <label class="field" data-ref="field-web-url">
          <input class="field__input" data-ref="input-web-url" type="url" placeholder=" " value="${escapeHtml(currentVal)}" autocomplete="off" spellcheck="false" />
          <span class="field__label">URL de la página web (ej. https://ejemplo.com)</span>
        </label>
      `,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--black',
      confirmText: 'Añadir URL',
      description: 'Escribe la URL de la página web que deseas convertir a PDF.',
      onConfirm: async (m) => {
        const input = m.body.querySelector<HTMLInputElement>('[data-ref="input-web-url"]');
        let raw = (input?.value || '').trim();
        if (!raw) {
          m.showError('Debes ingresar la URL de una página web.');
          return false;
        }
        if (!/^https?:\/\//i.test(raw)) {
          raw = `https://${raw}`;
        }
        try {
          const parsed = new URL(raw);
          if (!parsed.hostname || !parsed.hostname.includes('.')) {
            m.showError('Por favor ingresa una URL válida (ej. https://ejemplo.com).');
            return false;
          }
        } catch {
          m.showError('Por favor ingresa una URL válida con formato https://...');
          return false;
        }

        this.handleUrlSelected(raw);
        return true;
      },
      size: 'sm',
      title: 'Añadir URL',
    });

    setTimeout(() => {
      const input = modal.body.querySelector<HTMLInputElement>('[data-ref="input-web-url"]');
      if (input) {
        input.focus();
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            modal.confirmBtn?.click();
          }
        });
      }
    }, 60);
  }

  private handleUrlSelected(url: string): void {
    this.hideError();
    this.currentUrl = url;
    this.htmlUrl = url;
    this.currentFile = null;

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="converter-selected-card"]');
    const htmlPreviewView = this.container.querySelector<HTMLElement>('[data-ref="html-preview-view"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const fabMore = this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-workspace"]');
    const convertBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-convert-action"]');
    const htmlUrlInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-html-url"]');

    if (htmlUrlInput) htmlUrlInput.value = url;
    if (convertBtn) convertBtn.disabled = false;

    hideElement(dropzoneCard);
    hideElement(selectedCard);
    showElement(htmlPreviewView);

    showElement(sidebar);
    if (settingsBtn) settingsBtn.classList.add('is-visible');
    showElement(fabMore);
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

    void this.fetchUrlPreview(url, this.htmlScreen);
  }

  private handleFilesReceived(files: File[]): void {
    if (this.config.sourceType === 'jpg-to-pdf') {
      const validImages = files.filter((f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(f.name));
      if (validImages.length === 0) {
        this.showError('Por favor selecciona archivos de imagen válidos (JPG, JPEG, PNG, WEBP).');
        return;
      }
      this.imageFiles.push(...validImages);
      this.handleFileSelected(this.imageFiles[0]);
    } else {
      if (files.length > 0) {
        this.handleFileSelected(files[0]);
      }
    }
  }

  private handleFileSelected(file: File): void {
    this.hideError();
    const limits = getCurrentUserToolLimits('to-pdf-converter');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      this.showError(`El archivo excede el tamaño máximo permitido (${limits.maxFileSizeMB} MB).`);
      return;
    }

    this.currentFile = file;
    this.currentUrl = null;

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="converter-selected-card"]');
    const htmlPreviewView = this.container.querySelector<HTMLElement>('[data-ref="html-preview-view"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const fabMore = this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-workspace"]');
    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-size"]');
    const convertBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-convert-action"]');
    const imgEl = this.container.querySelector<HTMLImageElement>('[data-ref="doc-preview-img"]');
    const iconEl = this.container.querySelector<HTMLElement>('[data-ref="doc-preview-icon"]');
    const fabBadge = this.container.querySelector<HTMLElement>('[data-ref="badge-fab-count"]');

    const count = this.config.sourceType === 'jpg-to-pdf' && this.imageFiles.length > 0 ? this.imageFiles.length : 1;
    if (fabBadge) fabBadge.textContent = String(count);

    if (fileNameEl) {
      fileNameEl.textContent = count > 1 ? `${count} imágenes seleccionadas` : file.name;
    }
    if (fileSizeEl) {
      const totalSize = this.config.sourceType === 'jpg-to-pdf' && this.imageFiles.length > 0
        ? this.imageFiles.reduce((acc, f) => acc + f.size, 0)
        : file.size;
      fileSizeEl.textContent = formatBytes(totalSize);
    }
    if (convertBtn) convertBtn.disabled = false;

    if (this.previewImageUrl) {
      URL.revokeObjectURL(this.previewImageUrl);
      this.previewImageUrl = null;
    }

    if (file.type.startsWith('image/')) {
      this.previewImageUrl = URL.createObjectURL(file);
      if (imgEl) {
        imgEl.src = this.previewImageUrl;
        showElement(imgEl);
      }
      hideElement(iconEl);
    } else {
      if (imgEl) {
        imgEl.removeAttribute('src');
        hideElement(imgEl);
      }
      showElement(iconEl);
    }

    hideElement(dropzoneCard);
    hideElement(htmlPreviewView);
    showElement(selectedCard);

    showElement(sidebar);
    if (settingsBtn) settingsBtn.classList.add('is-visible');
    showElement(fabMore);
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
  }

  private resetSelectedFile(): void {
    this.currentFile = null;
    this.currentUrl = null;
    this.htmlUrl = '';
    this.imageFiles = [];

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-source-file"]');
    if (fileInput) fileInput.value = '';

    if (this.previewImageUrl) {
      URL.revokeObjectURL(this.previewImageUrl);
      this.previewImageUrl = null;
    }
    for (const url of this.imagePreviewUrls) {
      URL.revokeObjectURL(url);
    }
    this.imagePreviewUrls = [];

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="converter-selected-card"]');
    const htmlPreviewView = this.container.querySelector<HTMLElement>('[data-ref="html-preview-view"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const fabMore = this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-workspace"]');
    const convertBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-convert-action"]');
    const imgEl = this.container.querySelector<HTMLImageElement>('[data-ref="doc-preview-img"]');
    const iconEl = this.container.querySelector<HTMLElement>('[data-ref="doc-preview-icon"]');

    if (imgEl) {
      imgEl.removeAttribute('src');
      hideElement(imgEl);
    }
    showElement(iconEl);

    const htmlImg = this.container.querySelector<HTMLImageElement>('[data-ref="html-preview-img"]');
    const htmlLoader = this.container.querySelector<HTMLElement>('[data-ref="html-preview-loader"]');
    if (htmlImg) {
      htmlImg.removeAttribute('src');
      hideElement(htmlImg);
    }
    hideElement(htmlLoader);

    showElement(dropzoneCard);
    hideElement(selectedCard);
    hideElement(htmlPreviewView);

    hideElement(sidebar);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    hideElement(fabMore);
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    this.sidebarModal?.close();

    if (convertBtn) convertBtn.disabled = true;
    this.statusManager?.hide();
    this.hideError();
  }

  private showProcessingState(): void {
    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="converter-selected-card"]');
    const htmlPreviewView = this.container.querySelector<HTMLElement>('[data-ref="html-preview-view"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const fabMore = this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="to-pdf-converter-workspace"]');

    hideElement(sidebar);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    hideElement(fabMore);
    this.sidebarModal?.close();
    hideElement(dropzoneCard);
    hideElement(selectedCard);
    hideElement(htmlPreviewView);
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
  }

  private async handleConvert(button: HTMLButtonElement): Promise<void> {
    if ((!this.currentFile && !this.currentUrl && this.imageFiles.length === 0) || this.isConverting) return;
    this.hideError();

    this.isConverting = true;
    this.showProcessingState();
    this.statusManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const formData = new FormData();
        formData.append('sourceType', this.config.sourceType);

        if (this.config.sourceType === 'html-to-pdf') {
          const finalUrl = this.htmlUrl || this.currentUrl;
          if (!finalUrl) throw new Error('Debes ingresar una dirección URL válida.');
          formData.append('url', finalUrl);
          formData.append('screen', this.htmlScreen);
          formData.append('singlePage', this.htmlSinglePage ? 'true' : 'false');
          formData.append('orientation', this.htmlOrientation);
          formData.append('margin', this.htmlMargin);
          formData.append('blockAds', this.htmlBlockAds ? 'true' : 'false');
          formData.append('removePopups', this.htmlRemovePopups ? 'true' : 'false');
        } else if (this.config.sourceType === 'jpg-to-pdf') {
          if (this.imageFiles.length === 0 && this.currentFile) {
            this.imageFiles = [this.currentFile];
          }
          if (this.imageFiles.length === 0) throw new Error('Debes seleccionar al menos una imagen.');
          for (const img of this.imageFiles) {
            formData.append('files', img, img.name);
          }
          formData.append('orientation', this.jpgOrientation);
          formData.append('pageSize', this.jpgPageSize);
          formData.append('margin', this.jpgMargin);
          formData.append('merge', this.jpgMerge ? 'true' : 'false');
        } else {
          if (!this.currentFile) throw new Error('Debes seleccionar un archivo para convertir.');
          formData.append('file', this.currentFile as Blob, this.currentFile.name);
        }

        const response = await postFormWithProgress(
          API_ROUTES.tools.toPdfConverter.convert,
          formData,
          (progress) => {
            this.statusManager?.updateUploadProgress(progress, 1);
          },
          this.abortController?.signal
        );
        const result = (await response.json()) as {
          data?: { downloadToken: string; downloadUrl: string; fileSize: number; filename: string };
          error?: string;
          success: boolean;
        };

        if (!response.ok || !result.success || !result.data?.downloadUrl) {
          throw new Error(result.error || 'Error procesando la conversión.');
        }

        const data = result.data;
        showToast('Documento convertido exitosamente', 'success');
        saveDownloadPayloadAndNavigate({
          downloadUrl: data.downloadUrl,
          fileSize: data.fileSize,
          filename: data.filename,
          returnText: this.config.title,
          returnUrl: window.location.pathname,
          subtitle: this.currentUrl || this.config.sourceType === 'html-to-pdf'
            ? 'La página web ha sido transformada en un documento PDF con la máxima calidad y fidelidad.'
            : 'Tu archivo ha sido transformado en PDF con la máxima calidad y fidelidad.',
          title: `¡${this.config.title} completada con éxito!`,
          token: data.downloadToken,
        });
      } catch (err: unknown) {
        const errorDetail = err instanceof Error ? err.message : '';
        this.statusManager?.showError({
          boxText: errorDetail || (this.currentUrl
            ? 'Comprueba que la dirección URL sea accesible públicamente y no requiera inicio de sesión. Si el problema continúa, contacta a soporte.'
            : 'Comprueba el formato del documento seleccionado o intenta con un archivo más ligero. Si el problema continúa, contacta a soporte.'),
          boxTitle: 'Error en la conversión a PDF',
          desc: 'Ha ocurrido un error inesperado al procesar la conversión. Por favor intenta más tarde.',
          retryText: 'Reintentar Conversión',
          title: '¡Oh no! No hemos podido convertir tu archivo.',
        });
      } finally {
        this.isConverting = false;
      }
    });
  }

  private showError(msg: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="converter-global-error"]');
    if (errorEl) {
      errorEl.textContent = msg;
      showElement(errorEl);
    }
    showToast(msg, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="converter-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }

  private async fetchUrlPreview(url: string, screen?: HtmlScreenSize): Promise<void> {
    let cleanUrl = (url || '').trim();
    if (!cleanUrl) return;
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const loader = this.container.querySelector<HTMLElement>('[data-ref="html-preview-loader"]');
    const img = this.container.querySelector<HTMLImageElement>('[data-ref="html-preview-img"]');
    const browserFrame = this.container.querySelector<HTMLElement>('[data-ref="html-browser-frame"]');

    if (browserFrame && screen) {
      browserFrame.setAttribute('data-screen', screen);
    }
    showElement(loader);

    try {
      const response = await postApi(API_ROUTES.tools.toPdfConverter.preview, {
        screen: screen || this.htmlScreen,
        url: cleanUrl,
      });

      const result = (await response.json()) as {
        data?: { previewImage: string };
        error?: string;
        success: boolean;
      };

      if (!response.ok || !result.success || !result.data?.previewImage) {
        throw new Error(result.error || 'No se pudo generar la vista previa');
      }

      if (img) {
        img.src = result.data.previewImage;
        showElement(img);
      }
    } catch {
      showToast('No se pudo generar la vista previa de la página web.', 'warning');
    } finally {
      hideElement(loader);
    }
  }
}

export async function createToPdfConverterView(sourceType?: ToPdfSourceType): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/to-pdf-converter/to-pdf-converter.html');
  const controller = new ToPdfConverterController(container, sourceType);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
