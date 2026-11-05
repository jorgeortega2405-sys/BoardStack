import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupDropdown, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
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
  private phaseManager: ToolPhaseManager | null = null;
  private powerpointOcr: OcrOption = 'no';
  private sidebarModal: ToolSidebarModalController | null = null;
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
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: 'Seleccionar PDF',
        desc: this.config.subtitle,
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) this.handleFileSelected(files[0]);
        },
        title: this.config.title,
      },
      sidebarRef: 'pdf-converter-sidebar',
      toolId: 'pdf-converter',
      toolName: this.config.title,
      topHeaderRef: 'component-top',
      workspaceCardRef: 'converter-selected-card',
    });
    await this.phaseManager.init();
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

  private applyConfiguration(): void {
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="converter-sidebar-title"]');
    if (titleEl) titleEl.textContent = this.config.title;

    const sections = this.container.querySelectorAll<HTMLElement>('[data-ref^="section-"]');
    sections.forEach((sec) => hideElement(sec));

    const activeSec = this.container.querySelector<HTMLElement>(`[data-ref="section-${this.config.targetType}-options"]`);
    if (activeSec) showElement(activeSec);

    const actionText = this.container.querySelector<HTMLElement>('[data-ref="txt-convert-action"]');
    if (actionText) actionText.textContent = this.config.actionText;
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="converter-sidebar-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');

    if (sidebar && backdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const convertBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-convert-action"]');

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetSelectedFile();
    }, { signal });

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
    const limits = getCurrentUserToolLimits('pdf-converter');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showToast(`El archivo excede el tamaño máximo permitido (${limits.maxFileSizeMB} MB).`, 'danger');
      return;
    }

    this.currentFile = file;

    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-workspace"]');
    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-size"]');
    const convertBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-convert-action"]');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (convertBtn) convertBtn.disabled = false;

    this.phaseManager?.setPhase('workspace');

    if (settingsBtn) settingsBtn.classList.add('is-visible');
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

    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="pdf-converter-workspace"]');
    const convertBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-convert-action"]');

    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    this.sidebarModal?.close();

    if (convertBtn) convertBtn.disabled = true;

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="doc-preview-canvas"]');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    this.phaseManager?.setPhase('dropzone');
  }

  private async handleConvert(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isConverting) return;

    this.isConverting = true;
    this.phaseManager?.showUploading(1, 1);

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
            this.phaseManager?.updateUploadProgress(progress, 1);
          },
          this.abortController?.signal
        );
        const result = (await response.json()) as { data?: { downloadToken: string }; error?: string; success: boolean };

        this.phaseManager?.showProcessing('Convirtiendo documento...', 'Por favor espera mientras finaliza la conversión');

        if (!response.ok || !result.success || !result.data?.downloadToken) {
          throw new Error(result.error || 'Error procesando la conversión.');
        }

        const token = result.data.downloadToken;
        showToast('Documento convertido exitosamente', 'success');
        this.phaseManager?.navigateToDownload({
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
        this.phaseManager?.showError('Ha ocurrido un error al convertir el documento. Por favor intenta más tarde.', () => {
          this.phaseManager?.setPhase('workspace');
        });
      } finally {
        this.isConverting = false;
      }
    });
  }
}

export async function createPdfConverterView(targetType?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/pdf-converter/pdf-converter.html');
  const controller = new PdfConverterController(container, targetType);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
