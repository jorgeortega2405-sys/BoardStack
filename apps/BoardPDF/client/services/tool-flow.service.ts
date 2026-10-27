import { getCurrentUserToolLimits } from '../config/tools-limits.config.js';
import { bindFileDropzone } from '../utils/dom.util.js';
import { pickDropboxFiles } from './dropbox.service.js';
import { pickGoogleDriveFiles } from './google-drive.service.js';
import { navigate } from './navigation.service.js';

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

export function setupToolDropzoneEvents(options: {
  browseBtnRef?: string;
  container: HTMLElement;
  dropboxBtnRef?: string;
  dropzoneCardRef?: string;
  dropzoneRef?: string;
  driveBtnRef?: string;
  fileInputRef?: string;
  multiselect?: boolean;
  onFiles: (files: File[]) => void;
  signal?: AbortSignal;
}): void {
  const {
    browseBtnRef = 'btn-browse-file',
    container,
    dropboxBtnRef = 'btn-hero-dropbox',
    dropzoneCardRef,
    dropzoneRef,
    driveBtnRef = 'btn-hero-drive',
    fileInputRef = 'input-pdf-file',
    multiselect = false,
    onFiles,
    signal,
  } = options;

  const fileInput = container.querySelector<HTMLInputElement>(`[data-ref="${fileInputRef}"]`);
  const browseBtn = container.querySelector<HTMLButtonElement>(`[data-ref="${browseBtnRef}"]`);
  const heroDriveBtn = container.querySelector<HTMLButtonElement>(`[data-ref="${driveBtnRef}"]`);
  const heroDropboxBtn = container.querySelector<HTMLButtonElement>(`[data-ref="${dropboxBtnRef}"]`);

  browseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput?.click();
  }, { signal });

  fileInput?.addEventListener('change', () => {
    const files = fileInput.files;
    if (files && files.length > 0) {
      onFiles(Array.from(files));
    }
  }, { signal });

  heroDriveBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const files = await pickGoogleDriveFiles({ multiselect });
    if (files && files.length > 0) {
      onFiles(files);
    }
  }, { signal });

  heroDropboxBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const files = await pickDropboxFiles({ multiselect });
    if (files && files.length > 0) {
      onFiles(files);
    }
  }, { signal });

  const dropTarget = (dropzoneCardRef ? container.querySelector<HTMLElement>(`[data-ref="${dropzoneCardRef}"]`) : null)
    || (dropzoneRef ? container.querySelector<HTMLElement>(`[data-ref="${dropzoneRef}"]`) : null);

  if (dropTarget) {
    bindFileDropzone({
      dropTarget,
      onFiles: (fileList) => {
        if (fileList.length > 0) {
          onFiles(Array.from(fileList));
        }
      },
      signal,
      visualTarget: dropTarget,
    });
  }
}
