import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormApi } from '../../../services/api.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { navigate } from '../../../services/navigation.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';

export class EditPdfController implements ViewController {
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
        buttonText: 'Seleccionar Archivo PDF',
        desc: 'Añade texto, imágenes, formas y dibujos, o edita texto existente en tu documento PDF con total libertad.',
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: 'Editar PDF',
      },
      toolId: 'edit-pdf',
      toolName: 'Editar PDF',
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
      showToast('Solo se permiten documentos en formato PDF.', 'error');
      return;
    }

    const limits = getCurrentUserToolLimits('edit-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showToast(`El archivo seleccionado supera el límite permitido de ${limits.maxFileSizeMB} MB.`, 'error');
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
          this.showError('No se pudo procesar el archivo PDF.');
          this.phaseManager?.setPhase('dropzone');
          return;
        }
        const docTitle = file.name.replace(/\.[^/.]+$/, '');
        const newDocId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc_${Date.now().toString(36)}`;
        sessionStorage.setItem('collab_auto_import', JSON.stringify({ asset, docTitle }));
        navigate(`/d/${newDocId}`);
      } else {
        this.showError('Ocurrió un error al subir el documento PDF.');
        this.phaseManager?.setPhase('dropzone');
      }
    } catch {
      this.showError('Error de red al procesar el archivo. Por favor intenta de nuevo.');
      this.phaseManager?.setPhase('dropzone');
    }
  }

  private showError(message: string): void {
    if (this.phaseManager?.statusManager) {
      this.phaseManager.statusManager.showError({
        boxText: message,
        boxTitle: 'Error de procesamiento',
        desc: message,
        title: 'No se pudo abrir el documento',
      });
    } else {
      showToast(message, 'error');
    }
  }
}

export async function createEditPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/edit-pdf/edit-pdf.html');
  const controller = new EditPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
