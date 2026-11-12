import { showUpgradeLimitModal } from '../../../components/modal.component.js';
import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormApi } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { navigate } from '../../../services/navigation.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';

interface CollabDropzoneConfig {
  descKey: string;
  mode?: 'compare' | 'crop' | 'redact';
  titleKey: string;
  toolId: 'compare-pdf' | 'crop-pdf' | 'edit-pdf' | 'redact-pdf';
}

class EditPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private config: CollabDropzoneConfig;
  private container: HTMLElement;
  private phaseManager: ToolPhaseManager | null = null;

  constructor(container: HTMLElement, config?: CollabDropzoneConfig) {
    this.container = container;
    this.config = config || {
      descKey: 'home.tool_edit_pdf_desc',
      titleKey: 'home.tool_edit_pdf_title',
      toolId: 'edit-pdf',
    };
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: t('tools.select_pdf_file'),
        desc: t(this.config.descKey),
        hint: t('tools.dropzone_hint_pdf'),
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: t(this.config.titleKey),
      },
      toolId: this.config.toolId,
      toolName: t(this.config.titleKey),
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

    const limits = getCurrentUserToolLimits(this.config.toolId);
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: this.config.toolId,
        toolName: t(this.config.titleKey),
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
        const modeParam = this.config.mode ? `?mode=${this.config.mode}` : '';
        navigate(`/d/${newDocId}${modeParam}`);
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
        boxTitle: t('tools.edit_pdf_error_box_title'),
        desc: message,
        title: t('ui.no_se_pudo_abrir_el_documento'),
      });
    } else {
      showToast(message, 'error');
    }
  }
}

async function createCollabDropzoneView(config: CollabDropzoneConfig): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/edit-pdf/edit-pdf.html');
  const controller = new EditPdfController(container, config);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export function createEditPdfView(): Promise<HTMLElement> {
  return createCollabDropzoneView({
    descKey: 'home.tool_edit_pdf_desc',
    titleKey: 'home.tool_edit_pdf_title',
    toolId: 'edit-pdf',
  });
}

export function createCropPdfView(): Promise<HTMLElement> {
  return createCollabDropzoneView({
    descKey: 'home.tool_crop_pdf_desc',
    mode: 'crop',
    titleKey: 'home.tool_crop_pdf_title',
    toolId: 'crop-pdf',
  });
}

export function createRedactPdfView(): Promise<HTMLElement> {
  return createCollabDropzoneView({
    descKey: 'home.tool_redact_pdf_desc',
    mode: 'redact',
    titleKey: 'home.tool_redact_pdf_title',
    toolId: 'redact-pdf',
  });
}

export function createComparePdfView(): Promise<HTMLElement> {
  return createCollabDropzoneView({
    descKey: 'home.tool_compare_pdf_desc',
    mode: 'compare',
    titleKey: 'home.tool_compare_pdf_title',
    toolId: 'compare-pdf',
  });
}

export { EditPdfController };
