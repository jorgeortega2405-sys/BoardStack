import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, getCsrfToken } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { navigate } from '../services/navigation.service.js';
import { showToast } from '../services/toast.service.js';

let isInitialized = false;
let dragCounter = 0;
let overlayEl: HTMLElement | null = null;

function hasFiles(e: DragEvent): boolean {
  if (!e.dataTransfer || !e.dataTransfer.types) return false;
  return Array.from(e.dataTransfer.types).includes('Files');
}

function showOverlay(): void {
  if (overlayEl) {
    overlayEl.classList.add('is-active');
  }
}

function hideOverlay(): void {
  dragCounter = 0;
  if (overlayEl) {
    overlayEl.classList.remove('is-active');
  }
}

async function handleGeneralFilesUpload(files: File[]): Promise<void> {
  if (!currentUser) {
    showToast(t('auth.login_required_upload', 'Inicia sesión para subir archivos a tu cuenta'), 'warning');
    return;
  }

  showToast(t('projects.uploading_files', 'Subiendo archivo a tu cuenta...'), 'info');
  try {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const csrf = getCsrfToken();
    const headers: Record<string, string> = {};
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }

    const response = await fetch(API_ROUTES.collaborativeDocs.upload, {
      body: formData,
      headers,
      method: 'POST',
    });

    if (response.ok) {
      showToast(t('projects.upload_success', 'Archivo subido correctamente'), 'success');
      navigate('/projects');
    } else {
      const data = await response.json().catch(() => null);
      showToast(data?.error || t('errors.unexpected', 'Error al procesar la solicitud'), 'danger');
    }
  } catch {
    showToast(t('errors.unexpected', 'Error al procesar la solicitud'), 'danger');
  }
}

export function initGlobalDropzone(): void {
  if (isInitialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  isInitialized = true;

  overlayEl = document.createElement('div');
  overlayEl.className = 'global-dropzone-overlay';
  overlayEl.setAttribute('data-ref', 'global-dropzone-overlay');
  overlayEl.innerHTML = `
    <div class="global-dropzone-box" data-ref="global-dropzone-box">
      <div class="global-dropzone-icon" data-ref="global-dropzone-icon">
        <svg class="component-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </div>
      <h3 class="global-dropzone-title" data-ref="global-dropzone-title" data-i18n="common.drop_file_overlay"></h3>
      <p class="global-dropzone-desc" data-ref="global-dropzone-desc" data-i18n="common.drop_file_hint"></p>
    </div>
  `;

  document.body.appendChild(overlayEl);
  translateElement(overlayEl);

  window.addEventListener('dragenter', (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounter++;
    showOverlay();
  });

  window.addEventListener('dragover', (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    showOverlay();
  });

  window.addEventListener('dragleave', (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      hideOverlay();
    }
  });

  window.addEventListener('drop', (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    hideOverlay();

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;

    const activeEl = document.querySelector<HTMLElement>('.layout-content > *');
    const controller = (activeEl as any)?.__controller;

    if (controller && typeof controller.handleFilesAdded === 'function') {
      void controller.handleFilesAdded(files);
      return;
    }
    if (controller && typeof controller.handleFileSelected === 'function') {
      void controller.handleFileSelected(files[0]);
      return;
    }
    if (controller && typeof controller.handleUploadFiles === 'function') {
      void controller.handleUploadFiles(files);
      return;
    }

    void handleGeneralFilesUpload(files);
  });
}
