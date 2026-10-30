import { getCurrentUserToolLimits } from '../config/tools-limits.config.js';
import { bindFileDropzone } from '../utils/dom.util.js';
import { pickDropboxFiles } from './dropbox.service.js';
import { pickGoogleDriveFiles } from './google-drive.service.js';
import { navigate } from './navigation.service.js';
import { showToast } from './toast.service.js';

export interface ToolDownloadPayload {
  downloadUrl?: string;
  fileSize?: number;
  filename: string;
  returnText?: string;
  returnUrl: string;
  subtitle?: string;
  title?: string;
  token?: string;
}

export interface ToolFileFlowOptions {
  container: HTMLElement;
  dropzoneRef?: string;
  multiselect?: boolean;
  onFile?: (file: File) => void | Promise<void>;
  onFiles?: (files: File[]) => void | Promise<void>;
  signal: AbortSignal;
  toolId: string;
}

export function saveDownloadPayloadAndNavigate(payload: ToolDownloadPayload): void {
  const token = payload.token || '';
  const downloadUrl = payload.downloadUrl || (token ? `/api/download/${token}` : '');
  const data = {
    downloadUrl,
    fileSize: payload.fileSize || 0,
    filename: payload.filename,
    returnText: payload.returnText || 'Volver a la herramienta',
    returnUrl: payload.returnUrl,
    subtitle: payload.subtitle || 'El proceso se ha completado con éxito y tu documento está listo para descargar.',
    title: payload.title || '¡Tu archivo está listo para descargar!',
    token,
  };
  sessionStorage.setItem('download_ready_data', JSON.stringify(data));
  const targetPath = token ? `/download/${token}` : '/download';
  navigate(targetPath);
}

export function validatePdfFile(file: File, toolId: string): { error?: string; valid: boolean } {
  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf' || file.type === 'application/x-pdf';
  if (!isPdf) {
    return { error: 'Selecciona únicamente un documento en formato PDF.', valid: false };
  }
  const limits = getCurrentUserToolLimits(toolId);
  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { error: `El archivo seleccionado supera el límite permitido de ${limits.maxFileSizeMB} MB.`, valid: false };
  }
  return { valid: true };
}

export function setupToolFileFlow(options: ToolFileFlowOptions): void {
  const { container, multiselect = false, onFile, onFiles, signal, toolId } = options;

  const validateIncoming = (file: File): { error?: string; valid: boolean } => {
    if (toolId === 'to-pdf-converter') {
      const limits = getCurrentUserToolLimits(toolId);
      if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
        return { error: `El archivo seleccionado supera el límite permitido de ${limits.maxFileSizeMB} MB.`, valid: false };
      }
      return { valid: true };
    }
    return validatePdfFile(file, toolId);
  };

  const handleIncomingFiles = async (rawFiles: File[]): Promise<void> => {
    if (!rawFiles || rawFiles.length === 0) return;
    const limits = getCurrentUserToolLimits(toolId);

    if (!multiselect) {
      const file = rawFiles[0];
      const validation = validateIncoming(file);
      if (!validation.valid) {
        showToast(validation.error || 'Selecciona únicamente un documento en formato PDF.', 'danger');
        return;
      }
      if (onFile) {
        await onFile(file);
      } else if (onFiles) {
        await onFiles([file]);
      }
      return;
    }

    let filesToProcess = rawFiles;
    if (limits.maxFiles && filesToProcess.length > limits.maxFiles) {
      showToast(`El número máximo de archivos permitidos es ${limits.maxFiles}.`, 'danger');
      filesToProcess = filesToProcess.slice(0, limits.maxFiles);
    }

    const validFiles: File[] = [];
    for (const file of filesToProcess) {
      const validation = validateIncoming(file);
      if (!validation.valid) {
        showToast(validation.error || `El archivo ${file.name} no es válido.`, 'danger');
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) return;

    if (onFiles) {
      await onFiles(validFiles);
    } else if (onFile) {
      for (const file of validFiles) {
        await onFile(file);
      }
    }
  };

  const fileInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
  fileInputs.forEach((fileInput) => {
    fileInput.addEventListener('change', () => {
      const files = fileInput.files ? Array.from(fileInput.files) : [];
      fileInput.value = '';
      if (files.length > 0) {
        void handleIncomingFiles(files);
      }
    }, { signal });
  });

  const browseBtns = container.querySelectorAll<HTMLElement>('[data-ref*="btn-browse"], [data-ref*="btn-select"]');
  browseBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const firstInput = container.querySelector<HTMLInputElement>('input[type="file"]');
      firstInput?.click();
    }, { signal });
  });

  const fabAddMoreBtns = container.querySelectorAll<HTMLElement>('[data-ref="btn-fab-add-more"]');
  fabAddMoreBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = container.querySelector<HTMLInputElement>('[data-ref="input-add-more-pdf"]')
        || container.querySelector<HTMLInputElement>('input[type="file"]');
      input?.click();
    }, { signal });
  });

  const driveBtns = container.querySelectorAll<HTMLElement>('[data-ref="btn-hero-drive"], [data-ref="btn-fab-drive"]');
  driveBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickGoogleDriveFiles({ multiselect });
      if (files && files.length > 0) {
        void handleIncomingFiles(files);
      }
    }, { signal });
  });

  const dropboxBtns = container.querySelectorAll<HTMLElement>('[data-ref="btn-hero-dropbox"], [data-ref="btn-fab-dropbox"]');
  dropboxBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickDropboxFiles({ multiselect });
      if (files && files.length > 0) {
        void handleIncomingFiles(files);
      }
    }, { signal });
  });

  const dropTarget = (options.dropzoneRef ? container.querySelector<HTMLElement>(`[data-ref="${options.dropzoneRef}"]`) : null)
    || container.querySelector<HTMLElement>('[data-ref*="dropzone-card"], [data-ref*="dropzone"], .tool-hero-dropzone, .pdf-dropzone');

  if (dropTarget) {
    bindFileDropzone({
      dropTarget,
      onFiles: (fileList) => {
        const files = Array.from(fileList);
        if (files.length > 0) {
          void handleIncomingFiles(files);
        }
      },
      signal,
      visualTarget: dropTarget,
    });
  }
}
