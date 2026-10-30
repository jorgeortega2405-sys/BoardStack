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
import { ToolSidebarModalController, bindFileDropzone, hideElement, setupDropdown, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { CONVERSION_CONFIGS, ConversionRouteConfig, ExcelSheetsOption, JpgConversionMode, JpgQuality, OcrOption, PdfALevel } from './pdf-converter.types.js';

const PDFA_LEGENDS: Record<PdfALevel, string> = {
  '1a': '<p>Basado en un PDF 1.4. Nivel A (accesible) conforme con requisitos estándar adicionales:</p><ul><li>Especificación de idioma</li><li>Estructura jerárquica del documento</li><li>Separaciones de texto etiquetado y texto descriptivo para imágenes y símbolos</li><li>Mapeado de caracteres a Unicode</li></ul><p>También lista de <a class="link" href="https://en.wikipedia.org/wiki/PDF/A#Description" target="_blank" rel="noopener">elementos prohibidos</a>.</p>',
  '1b': '<p>Basado en un PDF 1.4. Nivel B (básico) de conformidad con los requisitos obligatorios:</p><ul><li>Incrustar fuentes</li><li>Incluir guías de gestión del color</li><li>Incluir metadatos</li></ul><p>También lista de <a class="link" href="https://en.wikipedia.org/wiki/PDF/A#Description" target="_blank" rel="noopener">elementos prohibidos</a>.</p>',
  '2a': '<p>Basado en ISO 32000-1 (PDF 1.7). Nivel A (accesible) completo:</p><ul><li>Todos los requisitos del nivel PDF/A-2b y PDF/A-2u</li><li>Estructura lógica y lectura accesible para lectores de pantalla</li><li>Metadatos semánticos y orden de lectura</li></ul>',
  '2b': '<p>Basado en ISO 32000-1 (PDF 1.7). Nivel B (básico) para preservación visual:</p><ul><li>Soporte de compresión JPEG2000</li><li>Compatibilidad con capas y transparencias</li><li>Incrustación de fuentes OpenType</li><li>Incrustación de adjuntos conformes con PDF/A</li></ul>',
  '2u': '<p>Basado en ISO 32000-1 (PDF 1.7). Nivel U (Unicode) para búsqueda y extracción:</p><ul><li>Todos los requisitos del nivel PDF/A-2b</li><li>Mapeado garantizado de texto a Unicode</li><li>Garantía de búsqueda y copiado de texto fiel</li></ul>',
  '3a': '<p>Basado en ISO 32000-1 (PDF 1.7). Nivel A (accesible) avanzado:</p><ul><li>Máximo nivel de accesibilidad, estructura y preservación</li><li>Permite adjuntar cualquier formato de archivo</li><li>Estructura lógica etiquetada completa</li></ul>',
  '3b': '<p>Basado en ISO 32000-1 (PDF 1.7). Nivel B (básico) con adjuntos de cualquier formato:</p><ul><li>Requisitos de preservación visual de PDF/A-2b</li><li>Permite incrustar archivos en formatos no PDF (XML, CSV, CAD, etc.)</li><li>Idóneo para facturación electrónica (Factur-X / ZUGFeRD)</li></ul>',
  '3u': '<p>Basado en ISO 32000-1 (PDF 1.7). Nivel U (Unicode):</p><ul><li>Todos los requisitos de PDF/A-3b</li><li>Mapeado garantizado de texto a Unicode</li><li>Soporte para adjuntos de cualquier formato con búsqueda de texto</li></ul>',
};

export class PdfConverterController implements ViewController {
  private abortController: AbortController | null = null;
  private allowDowngrade = true;
  private config: ConversionRouteConfig;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private dropdownPdfaLevelCtrl: { close: () => void; destroy: () => void; update: () => void } | null = null;
  private excelOcr: OcrOption = 'no';
  private excelSheets: ExcelSheetsOption = 'single';
  private isConverting = false;
  private jpgMode: JpgConversionMode = 'pages';
  private jpgQuality: JpgQuality = 'normal';
  private pdfaLevel: PdfALevel = '1b';
  private powerpointOcr: OcrOption = 'no';
  private sidebarModal: ToolSidebarModalController | null = null;
  private statusManager: ToolStatusManager | null = null;
  private wordOcr: OcrOption = 'no';

  constructor(container: HTMLElement, targetType?: string) {
    this.container = container;
    const currentPath = window.location.pathname;
    this.config = CONVERSION_CONFIGS[currentPath] ||
      Object.values(CONVERSION_CONFIGS).find((c) => c.targetType === targetType) ||
      CONVERSION_CONFIGS['/pdf-to-word'];
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-workspace"]') || this.container;
    this.statusManager = new ToolStatusManager({
      container: workspace,
      onRetry: () => {
        this.statusManager?.hide();
        if (this.currentFile) {
          const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-card"]');
          const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="converter-selected-card"]');
          const sidebar = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-sidebar"]');
          const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
          const fabMore = this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"]');
          const ws = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-workspace"]');

          hideElement(dropzoneCard);
          showElement(selectedCard);
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
    if (this.dropdownPdfaLevelCtrl) {
      this.dropdownPdfaLevelCtrl.destroy();
      this.dropdownPdfaLevelCtrl = null;
    }
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
  }

  private applyConfiguration(): void {
    const heroTitleEl = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-title"]');
    if (heroTitleEl) heroTitleEl.textContent = this.config.title;

    const heroDescEl = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-desc"]');
    if (heroDescEl) heroDescEl.textContent = this.config.subtitle;

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="converter-sidebar-title"]');
    if (titleEl) titleEl.textContent = this.config.title;

    const subtitleEl = this.container.querySelector<HTMLElement>('[data-ref="converter-sidebar-subtitle"]');
    if (subtitleEl) subtitleEl.textContent = this.config.subtitle;

    const actionTextEl = this.container.querySelector<HTMLElement>('[data-ref="txt-convert-action"]');
    if (actionTextEl) actionTextEl.textContent = this.config.actionText;

    const sectionMap: Record<string, string> = {
      'pdf-to-excel': 'section-pdf-to-excel-options',
      'pdf-to-jpg': 'section-pdf-to-jpg-options',
      'pdf-to-pdfa': 'section-pdf-to-pdfa-options',
      'pdf-to-powerpoint': 'section-pdf-to-powerpoint-options',
      'pdf-to-word': 'section-pdf-to-word-options',
    };

    const targetSectionRef = sectionMap[this.config.targetType];
    Object.values(sectionMap).forEach((ref) => {
      const sectionEl = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (sectionEl) {
        if (ref === targetSectionRef) {
          showElement(sectionEl);
        } else {
          hideElement(sectionEl);
        }
      }
    });

    const genericNotice = this.container.querySelector<HTMLElement>('[data-ref="converter-sidebar-notice"]');
    if (genericNotice) {
      if (this.config.targetType === 'pdf-to-pdfa') {
        hideElement(genericNotice);
      } else {
        showElement(genericNotice);
      }
    }

    const pdfaLegend = this.container.querySelector<HTMLElement>('[data-ref="pdfa-legend-content"]');
    if (pdfaLegend && PDFA_LEGENDS[this.pdfaLevel]) {
      pdfaLegend.innerHTML = PDFA_LEGENDS[this.pdfaLevel];
    }
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');

    if (sidebar && backdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
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
      fileInput?.click();
    }, { signal });

    fabAddMoreBtn?.addEventListener('click', (e) => {
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

    fabDriveBtn?.addEventListener('click', async (e) => {
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

    fabDropboxBtn?.addEventListener('click', async (e) => {
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

    if (dropzone) {
      bindFileDropzone({
        dropTarget: dropzone,
        visualTarget: dropzone,
        onFiles: (files) => {
          if (files.length > 0) {
            this.handleFileSelected(files[0]);
          }
        },
        signal,
      });
    }

    convertBtn?.addEventListener('click', () => {
      void this.handleConvert(convertBtn);
    }, { signal });

    const jpgModeToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-jpg-mode"]');
    const jpgModeDesc = this.container.querySelector<HTMLElement>('[data-ref="jpg-mode-desc-text"]');
    jpgModeToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as JpgConversionMode;
      if (!val) return;
      this.jpgMode = val;
      jpgModeToggle.setAttribute('data-active', val === 'pages' ? '0' : '1');
      jpgModeToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      if (jpgModeDesc) {
        jpgModeDesc.textContent = val === 'pages'
          ? 'Cada página del PDF se convertirá en una imagen JPG.'
          : 'Todas las imágenes dentro del archivo PDF se extraerán y se convertirán a JPG.';
      }
    }, { signal });

    const jpgQualityToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-jpg-quality"]');
    jpgQualityToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as JpgQuality;
      if (!val) return;
      this.jpgQuality = val;
      jpgQualityToggle.setAttribute('data-active', val === 'normal' ? '0' : '1');
      jpgQualityToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    }, { signal });

    const wordOcrToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-word-ocr"]');
    wordOcrToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as OcrOption;
      if (!val) return;
      this.wordOcr = val;
      wordOcrToggle.setAttribute('data-active', val === 'no' ? '0' : '1');
      wordOcrToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    }, { signal });

    const powerpointOcrToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-powerpoint-ocr"]');
    powerpointOcrToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as OcrOption;
      if (!val) return;
      this.powerpointOcr = val;
      powerpointOcrToggle.setAttribute('data-active', val === 'no' ? '0' : '1');
      powerpointOcrToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    }, { signal });

    const excelOcrToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-excel-ocr"]');
    excelOcrToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as OcrOption;
      if (!val) return;
      this.excelOcr = val;
      excelOcrToggle.setAttribute('data-active', val === 'no' ? '0' : '1');
      excelOcrToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    }, { signal });

    const excelSheetsToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-excel-sheets"]');
    excelSheetsToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-val]');
      if (!btn) return;
      const val = btn.getAttribute('data-val') as ExcelSheetsOption;
      if (!val) return;
      this.excelSheets = val;
      excelSheetsToggle.setAttribute('data-active', val === 'single' ? '0' : '1');
      excelSheetsToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    }, { signal });

    const pdfaDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pdfa-level"]');
    const pdfaText = this.container.querySelector<HTMLElement>('[data-ref="pdfa-level-selected-text"]');
    const pdfaLegend = this.container.querySelector<HTMLElement>('[data-ref="pdfa-legend-content"]');
    if (pdfaDropdown) {
      this.dropdownPdfaLevelCtrl = setupDropdown(pdfaDropdown, {
        backdrop: pdfaDropdown.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-pdfa-level"]'),
        isSelect: true,
        matchWidth: true,
        menu: pdfaDropdown.querySelector<HTMLElement>('[data-ref="dropdown-menu-pdfa-level"]'),
        offset: [0, 6],
        placement: 'bottom-start',
        onSelect: (val: string, item?: HTMLElement) => {
          if (!val) return;
          this.pdfaLevel = val as PdfALevel;
          if (pdfaText) {
            pdfaText.textContent = `PDF/A-${val.toUpperCase()}`;
          }
          const checkIcons = pdfaDropdown.querySelectorAll<HTMLElement>('[data-ref^="check-pdfa-"]');
          checkIcons.forEach((icon) => icon.classList.add('is-hidden'));
          const activeCheck = item?.querySelector<HTMLElement>('[data-ref^="check-pdfa-"]');
          if (activeCheck) activeCheck.classList.remove('is-hidden');
          if (pdfaLegend && PDFA_LEGENDS[this.pdfaLevel]) {
            pdfaLegend.innerHTML = PDFA_LEGENDS[this.pdfaLevel];
          }
        },
      });
    }

    const allowDowngradeCheck = this.container.querySelector<HTMLInputElement>('[data-ref="check-allow-downgrade"]');
    allowDowngradeCheck?.addEventListener('change', () => {
      this.allowDowngrade = allowDowngradeCheck.checked;
    }, { signal });
  }

  private handleFileSelected(file: File): void {
    this.hideError();
    const limits = getCurrentUserToolLimits('pdf-converter');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      this.showError(`El archivo excede el tamaño máximo permitido (${limits.maxFileSizeMB} MB).`);
      return;
    }

    this.currentFile = file;

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="converter-selected-card"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const fabMore = this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-workspace"]');
    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-size"]');
    const convertBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-convert-action"]');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (convertBtn) convertBtn.disabled = false;

    hideElement(dropzoneCard);
    showElement(selectedCard);

    showElement(sidebar);
    if (settingsBtn) settingsBtn.classList.add('is-visible');
    showElement(fabMore);
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="doc-preview-canvas"]');
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
    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    if (fileInput) fileInput.value = '';

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="converter-selected-card"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const fabMore = this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-workspace"]');
    const convertBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-convert-action"]');

    showElement(dropzoneCard);
    hideElement(selectedCard);

    hideElement(sidebar);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    hideElement(fabMore);
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    this.sidebarModal?.close();

    if (convertBtn) convertBtn.disabled = true;

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="doc-preview-canvas"]');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    this.statusManager?.hide();
    this.hideError();
  }

  private showProcessingState(): void {
    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="converter-dropzone-card"]');
    const selectedCard = this.container.querySelector<HTMLElement>('[data-ref="converter-selected-card"]');
    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-sidebar"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-settings"]');
    const fabMore = this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-workspace"]');

    hideElement(sidebar);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    hideElement(fabMore);
    this.sidebarModal?.close();
    hideElement(dropzoneCard);
    hideElement(selectedCard);
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
  }

  private async handleConvert(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isConverting) return;
    this.hideError();

    this.isConverting = true;
    this.showProcessingState();
    this.statusManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        formData.append('targetType', this.config.targetType);

        if (this.config.targetType === 'pdf-to-jpg') {
          formData.append('jpgMode', this.jpgMode);
          formData.append('jpgQuality', this.jpgQuality);
        } else if (this.config.targetType === 'pdf-to-word') {
          formData.append('ocr', this.wordOcr);
        } else if (this.config.targetType === 'pdf-to-powerpoint') {
          formData.append('ocr', this.powerpointOcr);
        } else if (this.config.targetType === 'pdf-to-excel') {
          formData.append('ocr', this.excelOcr);
          formData.append('excelSheets', this.excelSheets);
        } else if (this.config.targetType === 'pdf-to-pdfa') {
          formData.append('pdfaLevel', this.pdfaLevel);
          formData.append('allowDowngrade', String(this.allowDowngrade));
        }

        const response = await postFormWithProgress(
          API_ROUTES.tools.pdfConverter.convert,
          formData,
          (progress) => {
            this.statusManager?.updateUploadProgress(progress, 1);
          },
          this.abortController?.signal
        );
        const result = (await response.json()) as { data?: { downloadToken: string }; error?: string; success: boolean };

        if (!response.ok || !result.success || !result.data?.downloadToken) {
          throw new Error(result.error || 'Error procesando la conversión.');
        }

        const token = result.data.downloadToken;
        showToast('Documento convertido exitosamente', 'success');
        saveDownloadPayloadAndNavigate({
          downloadUrl: `/api/download/${token}`,
          fileSize: this.currentFile?.size || 0,
          filename: `${(this.currentFile?.name || 'documento').replace(/\.[^/.]+$/, '')}${this.config.targetExtension}`,
          returnText: this.config.title,
          returnUrl: window.location.pathname,
          subtitle: `Tu documento PDF ha sido convertido a formato ${this.config.targetBadge} con total precisión.`,
          title: `¡${this.config.title} completada con éxito!`,
          token,
        });
      } catch {
        this.statusManager?.showError({
          boxText: 'Comprueba que el documento PDF sea válido, no esté bloqueado o protegido por contraseña, y vuelve a intentarlo.',
          boxTitle: 'Error en la conversión',
          desc: 'Ha ocurrido un error inesperado al convertir el documento. Por favor intenta más tarde.',
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
}

export async function createPdfConverterView(targetType?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/pdf-converter/pdf-converter.html');
  const controller = new PdfConverterController(container, targetType);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
