import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, getCsrfToken } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { navigate } from '../services/navigation.service.js';
import { showToast } from '../services/toast.service.js';

let isInitialized = false;
let dragCounter = 0;
let overlayEl: HTMLElement | null = null;

function isToolView(): boolean {
  if (typeof document === 'undefined') return false;
  const toolEl = document.querySelector(
    '.tool-layout-wrapper, .tool-layout, .tool-workspace, [data-ref="tool-workspace"], .tool-hero-dropzone, .collaborative-editor-wrapper'
  );
  if (toolEl) return true;

  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/d/') || path === '/d' || path.startsWith('/collaborative-pdf/editor')) return true;

  const toolPaths = [
    '/merge-pdf', '/split-pdf', '/remove-pdf-pages', '/extract-pdf-pages', '/organize-pdf',
    '/compress-pdf', '/repair-pdf', '/ocr-pdf', '/jpg-to-pdf', '/word-to-pdf',
    '/powerpoint-to-pdf', '/excel-to-pdf', '/html-to-pdf', '/pdf-to-jpg', '/pdf-to-word',
    '/pdf-to-powerpoint', '/pdf-to-excel', '/pdf-to-pdfa', '/rotate-pdf', '/page-numbers',
    '/add-page-numbers', '/watermark-pdf', '/add-watermark', '/crop-pdf', '/edit-pdf',
    '/unlock-pdf', '/protect-pdf', '/redact-pdf', '/compare-pdf', '/summarize-pdf',
    '/translate-pdf', '/pdf-to-markdown', '/to-pdf'
  ];
  return toolPaths.some((p) => path === p || path.startsWith(`${p}/`));
}

function hasFiles(e: DragEvent): boolean {
  if (!e.dataTransfer || !e.dataTransfer.types) return false;
  return Array.from(e.dataTransfer.types).includes('Files');
}

function showOverlay(): void {
  if (!overlayEl || isToolView()) return;
  const targetWrapper = document.querySelector<HTMLElement>('.layout-content .component-wrapper, .component-wrapper');
  if (targetWrapper) {
    if (overlayEl.parentElement !== targetWrapper) {
      targetWrapper.appendChild(overlayEl);
    }
  } else {
    const layoutContent = document.querySelector<HTMLElement>('.layout-content');
    if (layoutContent && overlayEl.parentElement !== layoutContent) {
      layoutContent.appendChild(overlayEl);
    }
  }
  overlayEl.classList.add('is-active');
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
  overlayEl.innerHTML = '<span class="global-dropzone-text" data-ref="global-dropzone-text" data-i18n="common.drop_file_overlay"></span>';

  const initialWrapper = document.querySelector<HTMLElement>('.layout-content .component-wrapper, .component-wrapper');
  if (initialWrapper) {
    initialWrapper.appendChild(overlayEl);
  } else {
    document.body.appendChild(overlayEl);
  }
  translateElement(overlayEl);

  window.addEventListener('dragenter', (e: DragEvent) => {
    if (isToolView() || !hasFiles(e)) return;
    e.preventDefault();
    dragCounter++;
    showOverlay();
  });

  window.addEventListener('dragover', (e: DragEvent) => {
    if (isToolView() || !hasFiles(e)) {
      if (overlayEl?.classList.contains('is-active')) {
        hideOverlay();
      }
      return;
    }
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    showOverlay();
  });

  window.addEventListener('dragleave', (e: DragEvent) => {
    if (isToolView() || !hasFiles(e)) return;
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      hideOverlay();
    }
  });

  window.addEventListener('drop', (e: DragEvent) => {
    if (isToolView() || !hasFiles(e)) return;
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
