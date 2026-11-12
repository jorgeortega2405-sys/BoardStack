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
import { ToolSidebarModalController, hideElement, setupDropdown, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { CONVERSION_CONFIGS, ConversionRouteConfig, ExcelSheetsOption, JpgConversionMode, JpgQuality, OcrOption, PdfALevel } from './pdf-converter.types.js';

class PdfConverterController implements ViewController {
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
        buttonText: t('tools.pdf_converter_btn_select'),
        desc: t(this.config.subtitleKey),
        hint: t('common.drop_file_hint'),
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) this.handleFileSelected(files[0]);
        },
        title: t(this.config.titleKey),
      },
      sidebarRef: 'pdf-converter-sidebar',
      toolId: this.config.targetType,
      toolName: t(this.config.titleKey),
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

  private renderPdfaLegend(container: HTMLElement | null, level: PdfALevel): void {
    if (!container) return;
    container.innerHTML = '';

    const titleKey = `tools.pdfa_legend_${level}_title`;
    const titleEl = document.createElement('strong');
    titleEl.textContent = t(titleKey);
    container.appendChild(titleEl);

    const listEl = document.createElement('ul');
    for (let i = 1; i <= 3; i++) {
      const itemKey = `tools.pdfa_legend_${level}_item_${i}`;
      const itemText = t(itemKey);
      if (itemText && itemText !== itemKey) {
        const li = document.createElement('li');
        li.textContent = itemText;
        listEl.appendChild(li);
      }
    }
    if (listEl.childElementCount > 0) {
      container.appendChild(listEl);
    }
  }

  private applyConfiguration(): void {
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="converter-sidebar-title"]');
    if (titleEl) titleEl.textContent = t(this.config.titleKey);

    const sections = this.container.querySelectorAll<HTMLElement>('[data-ref^="section-"]');
    sections.forEach((sec) => hideElement(sec));

    const activeSec = this.container.querySelector<HTMLElement>(`[data-ref="section-${this.config.targetType}-options"]`);
    if (activeSec) showElement(activeSec);

    const actionText = this.container.querySelector<HTMLElement>('[data-ref="txt-convert-action"]');
    if (actionText) actionText.textContent = t(this.config.actionTextKey);

    if (this.config.targetType === 'pdf-to-jpg') {
      const jpgModeDesc = this.container.querySelector<HTMLElement>('[data-ref="jpg-mode-desc-text"]');
      if (jpgModeDesc) {
        jpgModeDesc.textContent = this.jpgMode === 'pages'
          ? t('ui.cada_pagina_del_pdf_se_convertira_en_una')
          : t('tools.pdf_to_jpg_mode_extract_desc');
      }
      const jpgQualityDesc = this.container.querySelector<HTMLElement>('[data-ref="jpg-quality-desc-text"]');
      if (jpgQualityDesc) {
        jpgQualityDesc.textContent = this.jpgQuality === 'high'
          ? t('tools.pdf_to_jpg_quality_high_desc')
          : t('tools.pdf_to_jpg_quality_normal_desc');
      }
    }

    if (this.config.targetType === 'pdf-to-pdfa') {
      const pdfaLegend = this.container.querySelector<HTMLElement>('[data-ref="pdfa-legend-content"]');
      this.renderPdfaLegend(pdfaLegend, this.pdfaLevel);
    }
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
          ? t('ui.cada_pagina_del_pdf_se_convertira_en_una')
          : t('tools.pdf_to_jpg_mode_extract_desc');
      }
    }, { signal });

    const jpgQualityToggle = this.container.querySelector<HTMLElement>('[data-ref="toggle-jpg-quality"]');
    const jpgQualityDesc = this.container.querySelector<HTMLElement>('[data-ref="jpg-quality-desc-text"]');
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
      if (jpgQualityDesc) {
        jpgQualityDesc.textContent = val === 'high'
          ? t('tools.pdf_to_jpg_quality_high_desc')
          : t('tools.pdf_to_jpg_quality_normal_desc');
      }
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
          if (pdfaLegend) {
            this.renderPdfaLegend(pdfaLegend, this.pdfaLevel);
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

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      this.showError(t('ui.selecciona_unicamente_un_documento_en_fo'));
      return;
    }

    const limits = getCurrentUserToolLimits(this.config.targetType);
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: this.config.targetType,
        toolName: t(this.config.titleKey),
        type: 'file_size',
      });
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

    const docTitleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (docTitleInput) docTitleInput.value = '';

    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="doc-preview-canvas"]');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    this.hideError();
    this.phaseManager?.setPhase('dropzone');
  }

  private showError(msg: string): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="converter-global-error"]');
    if (banner) {
      banner.textContent = msg;
      showElement(banner);
    }
    showToast(msg, 'danger');
  }

  private hideError(): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="converter-global-error"]');
    if (banner) {
      banner.textContent = '';
      hideElement(banner);
    }
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

        this.phaseManager?.showProcessing(t('tools.converting_document'), t('ui.por_favor_espera_mientras_finaliza_la_co'));

        if (!response.ok || !result.success || !result.data?.downloadToken) {
          throw new Error(result.error || t('ui.error_procesando_la_conversion'));
        }

        const token = result.data.downloadToken;
        showToast(t('toasts.documento_convertido_exitosamente'), 'success');
        const docTitleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
        const customTitle = docTitleInput?.value.trim();
        const baseName = customTitle || (this.currentFile?.name || t('common.default_document_base')).replace(/\.[^/.]+$/, '');
        const finalFilename = `${baseName}${this.config.targetExtension}`;

        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: this.currentFile?.size || 0,
          filename: finalFilename,
          returnText: t(this.config.titleKey),
          returnUrl: window.location.pathname,
          subtitle: t('ui.tu_documento_pdf_ha_sido_convertido_a_fo'),
          title: t('tools.conversion_completed_title', { title: t(this.config.titleKey) }),
          token,
        });
      } catch {
        this.phaseManager?.showError(t('ui.ha_ocurrido_un_error_al_convertir_el_doc'), () => {
          this.phaseManager?.setPhase('workspace');
        });
      } finally {
        this.isConverting = false;
      }
    });
  }
}

async function createPdfConverterView(targetType?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/pdf-converter/pdf-converter.html');
  const controller = new PdfConverterController(container, targetType);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { PdfConverterController, createPdfConverterView };
