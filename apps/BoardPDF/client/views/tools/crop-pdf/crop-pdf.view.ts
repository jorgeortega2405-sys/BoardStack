import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormApi } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { navigate } from '../../../services/navigation.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';

class CropPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private phaseManager: ToolPhaseManager | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: t('tools.select_pdf_file'),
        desc: t('home.tool_crop_pdf_desc'),
        hint: t('tools.dropzone_hint_pdf'),
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: t('home.tool_crop_pdf_title'),
      },
      toolId: 'crop-pdf',
      toolName: t('home.tool_crop_pdf_title'),
    });
    await this.phaseManager.init();
    renderIcons(this.container);
    this.bindEvents();
  }

  public bindEvents(): void {}

  public destroy(): void {
    if (this.phaseManager) {
      this.phaseManager.destroy();
      this.phaseManager = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async handleFileSelected(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast(t('toasts.solo_se_permiten_documentos_en_formato_p'), 'error');
      return;
    }

    const limits = getCurrentUserToolLimits('crop-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'crop-pdf',
        toolName: t('home.tool_crop_pdf_title'),
        type: 'file_size',
      });
      return;
    }

    this.phaseManager?.setPhase('processing');

    try {
      const formData = new FormData();
      formData.append('files', file);
      const res = await postFormApi(API_ROUTES.collaborativeDocs.upload, formData);
      if (res.ok) {
        const data = await res.json();
        const newFiles = data.files || (data.file ? [data.file] : []);
        const asset = newFiles[0];
        if (!asset || !asset.url) {
          this.showError(t('ui.no_se_pudo_procesar_el_archivo_pdf'));
          this.phaseManager?.setPhase('dropzone');
          return;
        }
        const docTitle = file.name.replace(/\.[^/.]+$/, '');
        const newDocId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc_${Date.now().toString(36)}`;
        sessionStorage.setItem('collab_auto_import', JSON.stringify({ asset, docTitle }));
        navigate(`/d/${newDocId}?mode=crop`);
      } else {
        this.showError(t('ui.ocurrio_un_error_al_subir_el_documento_p'));
        this.phaseManager?.setPhase('dropzone');
      }
    } catch {
      this.showError(t('ui.error_de_red_al_procesar_el_archivo_por_'));
      this.phaseManager?.setPhase('dropzone');
    }
  }

  private showError(message: string): void {
    if (this.phaseManager?.statusManager) {
      this.phaseManager.statusManager.showError({
        boxText: message,
        boxTitle: t('errors.unexpected'),
        desc: message,
        title: t('ui.no_se_pudo_abrir_el_documento'),
      });
    } else {
      showToast(message, 'error');
    }
  }
}

async function createCropPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/crop-pdf/crop-pdf.html');
  const controller = new CropPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { CropPdfController, createCropPdfView };
