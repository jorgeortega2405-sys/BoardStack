import { openModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { getLocalizedPath } from '../../config/seo.config.js';
import { TOOLS_REGISTRY } from '../../config/tools.registry.js';
import { deleteApi, getApi } from '../../services/api.service.js';
import { exportToDropbox } from '../../services/dropbox.service.js';
import { exportToGoogleDrive } from '../../services/google-drive.service.js';
import { getCurrentLanguage, t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { setTransferFile } from '../../services/transfer.service.js';
import { ViewController } from '../../types/common.types.js';
import { hideElement, showElement } from '../../utils/dom.util.js';

interface DownloadReadyData {
  downloadUrl: string;
  fileSize?: number;
  filename: string;
  returnText?: string;
  returnUrl?: string;
  subtitle?: string;
  title?: string;
  token?: string;
}

const CONTINUE_TOOL_IDS = [
  'compress-pdf',
  'split-pdf',
  'merge-pdf',
  'organize-pdf',
  'edit-pdf',
  'protect-pdf',
  'page-numbers',
  'watermark-pdf',
  'rotate-pdf',
  'pdf-to-markdown',
  'summarize-pdf',
  'translate-pdf',
];

export class DownloadReadyController implements ViewController {
  private abortController: AbortController | null = null;
  private cachedBlob: Blob | null = null;
  private container: HTMLElement;
  private data: DownloadReadyData | null = null;
  private isDeleted = false;
  private thankYouModalOpened = false;
  private token: string | null = null;

  constructor(container: HTMLElement, token?: string) {
    this.container = container;
    this.token = token || null;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    await this.loadData();
    renderIcons(this.container);
    this.bindEvents();
    this.renderContinueWorkflow();
    this.triggerAutoDownload();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async loadData(): Promise<void> {
    let sessionData: DownloadReadyData | null = null;
    const raw = sessionStorage.getItem('download_ready_data');
    if (raw) {
      try {
        sessionData = JSON.parse(raw) as DownloadReadyData;
      } catch {
        sessionData = null;
      }
    }

    if (this.token) {
      const tokenMatches =
        sessionData &&
        (sessionData.token === this.token ||
          (sessionData.downloadUrl && sessionData.downloadUrl.includes(this.token)));

      if (tokenMatches) {
        this.data = sessionData;
      } else {
        try {
          const res = await getApi(API_ROUTES.download.info(this.token));
          const json = await res.json();
          if (res.ok && json.success && json.data) {
            this.data = {
              downloadUrl: json.data.downloadUrl || API_ROUTES.download.file(this.token),
              fileSize: json.data.fileSize,
              filename: json.data.filename,
              returnText: 'Volver a la herramienta',
              returnUrl: '/',
              subtitle: 'El proceso se ha completado con éxito y tu documento está listo para descargar.',
              title: '¡Tu archivo está listo para descargar!',
              token: this.token,
            };
          } else {
            this.data = null;
          }
        } catch {
          this.data = null;
        }
      }
    } else if (sessionData && sessionData.downloadUrl) {
      this.data = sessionData;
    }

    this.render();
  }

  private render(): void {
    const successScreen = this.container.querySelector<HTMLElement>('[data-ref="ready-success-screen"]');
    const expiredScreen = this.container.querySelector<HTMLElement>('[data-ref="ready-expired-screen"]');
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="ready-title"]');
    const subtitleEl = this.container.querySelector<HTMLElement>('[data-ref="ready-subtitle"]');
    const downloadBtn = this.container.querySelector<HTMLAnchorElement>('[data-ref="btn-download-file"]');
    const actionBtns = this.container.querySelector<HTMLElement>('[data-ref="ready-action-btns"]');

    if (!this.data || !this.data.downloadUrl) {
      hideElement(successScreen);
      showElement(expiredScreen);
      return;
    }

    showElement(successScreen);
    hideElement(expiredScreen);

    if (titleEl && this.data.title) titleEl.textContent = this.data.title;
    if (subtitleEl && this.data.subtitle) subtitleEl.textContent = this.data.subtitle;
    if (downloadBtn) {
      downloadBtn.href = this.data.downloadUrl;
      downloadBtn.download = this.data.filename;
      showElement(downloadBtn);
    }
    const btnTextEl = this.container.querySelector<HTMLElement>('[data-ref="ready-btn-text"]');
    if (btnTextEl && this.data.filename) {
      const ext = this.data.filename.split('.').pop()?.toLowerCase();
      if (ext === 'md') {
        btnTextEl.textContent = 'Descargar Markdown (.md)';
      } else if (ext === 'docx') {
        btnTextEl.textContent = 'Descargar Word (.docx)';
      } else if (ext === 'xlsx') {
        btnTextEl.textContent = 'Descargar Excel (.xlsx)';
      } else if (ext === 'pptx') {
        btnTextEl.textContent = 'Descargar PowerPoint (.pptx)';
      } else if (ext === 'zip') {
        btnTextEl.textContent = 'Descargar Archivo (.zip)';
      } else {
        btnTextEl.textContent = 'Descargar PDF';
      }
    }
    showElement(actionBtns);
  }

  private renderContinueWorkflow(): void {
    const gridEl = this.container.querySelector<HTMLElement>('[data-ref="continue-workflow-grid"]');
    if (!gridEl) return;

    if (!this.data || !this.data.downloadUrl) {
      gridEl.style.display = 'none';
      return;
    }

    const currentReturn = this.data.returnUrl || '';
    const currentLang = getCurrentLanguage();
    const toolsToShow = CONTINUE_TOOL_IDS
      .map((id) => TOOLS_REGISTRY.find((tool) => tool.id === id))
      .filter((tool): tool is typeof TOOLS_REGISTRY[0] => tool !== undefined && !currentReturn.startsWith(tool.path))
      .slice(0, 6);

    gridEl.innerHTML = toolsToShow
      .map((tool) => {
        const toolName = t(tool.nameKey);
        const toolPath = getLocalizedPath(tool.id, currentLang);
        return `
        <button type="button" class="component-badge component-badge--interactive download-tool-badge" data-ref="btn-continue-${tool.id}" data-tool-path="${toolPath}">
          ${tool.customSvg || `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${tool.icon}"></use></svg>`}
          <span class="component-badge__text">${toolName}</span>
        </button>
      `;
      })
      .join('');

    renderIcons(gridEl);

    const signal = this.abortController?.signal;
    const buttons = gridEl.querySelectorAll<HTMLButtonElement>('.download-tool-badge');
    buttons.forEach((btn) => {
      btn.addEventListener(
        'click',
        async () => {
          const targetPath = btn.getAttribute('data-tool-path');
          if (!targetPath) return;
          await this.handleContinueToTool(targetPath, btn);
        },
        { signal }
      );
    });
  }

  private async handleContinueToTool(targetPath: string, btn: HTMLButtonElement): Promise<void> {
    if (!this.data?.downloadUrl) return;
    btn.disabled = true;
    showToast('Cargando archivo en la herramienta seleccionada...', 'info');

    try {
      let blob = this.cachedBlob;
      if (!blob) {
        const res = await fetch(this.data.downloadUrl);
        if (!res.ok) throw new Error('No se pudo recuperar el archivo procesado.');
        blob = await res.blob();
        this.cachedBlob = blob;
      }

      const filename = this.data.filename || 'documento.pdf';
      const file = new File([blob], filename, {
        lastModified: Date.now(),
        type: blob.type || 'application/pdf',
      });

      setTransferFile(file);
      navigate(targetPath);
    } catch {
      showToast('Error al preparar el archivo para la herramienta.', 'danger');
      btn.disabled = false;
    }
  }

  private triggerAutoDownload(): void {
    if (!this.data?.downloadUrl) return;

    try {
      const a = document.createElement('a');
      a.href = this.data.downloadUrl;
      a.download = this.data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Descarga iniciada con éxito.', 'success');
      setTimeout(() => this.openThankYouModal(), 1000);
    } catch {}
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    this.container.querySelector('[data-ref="btn-download-file"]')?.addEventListener(
      'click',
      () => {
        showToast('Descargando archivo...', 'info');
        setTimeout(() => this.openThankYouModal(), 600);
      },
      { signal }
    );

    this.container.querySelector('[data-ref="btn-save-drive"]')?.addEventListener(
      'click',
      async () => {
        if (!this.data?.downloadUrl) return;
        await exportToGoogleDrive(this.data.downloadUrl, this.data.filename);
      },
      { signal }
    );

    this.container.querySelector('[data-ref="btn-save-dropbox"]')?.addEventListener(
      'click',
      async () => {
        if (!this.data?.downloadUrl) return;
        await exportToDropbox(this.data.downloadUrl, this.data.filename);
      },
      { signal }
    );

    this.container.querySelector('[data-ref="btn-copy-link"]')?.addEventListener(
      'click',
      () => {
        this.openShareModal();
      },
      { signal }
    );

    this.container.querySelector('[data-ref="btn-delete-file"]')?.addEventListener(
      'click',
      async () => {
        await this.handleDeleteFile();
      },
      { signal }
    );

    this.container.querySelector('[data-ref="btn-expired-home"]')?.addEventListener(
      'click',
      () => {
        navigate('/');
      },
      { signal }
    );

    this.container.querySelector('[data-ref="btn-expired-tools"]')?.addEventListener(
      'click',
      () => {
        navigate('/#tools');
      },
      { signal }
    );
  }

  private openThankYouModal(): void {
    if (this.thankYouModalOpened) return;
    this.thankYouModalOpened = true;

    const shareUrl = window.location.origin;
    const modalBody = document.createElement('div');
    modalBody.className = 'thankyou-modal';
    modalBody.setAttribute('data-ref', 'thankyou-modal-content');
    modalBody.innerHTML = `
      <div class="thankyou-modal__body" style="align-items: center; display: flex; flex-direction: column; gap: 16px; padding: 12px 8px; text-align: center;">
        <div style="align-items: center; background-color: var(--bg-hover); border-radius: 50%; display: flex; height: 52px; justify-content: center; margin-bottom: 2px; width: 52px;">
          <svg class="component-icon" style="color: #ef4444; height: 28px; width: 28px;" aria-hidden="true"><use href="/icons.svg#favorite"></use></svg>
        </div>
        <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.5; margin: 0; max-width: 420px;">
          Por favor, comparte la herramienta para inspirar a más personas y ayudarnos a seguir mejorando BoardPDF.
        </p>
        <div class="tool-thankyou-card__badges" style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 6px;">
          <button type="button" class="component-badge component-badge--interactive thankyou-badge thankyou-badge--trustpilot" data-ref="badge-modal-trustpilot" aria-label="Trustpilot">
            <svg class="component-badge__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2l2.9 8.9h9.3l-7.5 5.5 2.9 8.9L12 19.8l-7.6 5.5 2.9-8.9L-.2 10.9h9.3L12 2z" fill="#00B67A"/>
              <path d="M17.6 16.4l-5.6 3.4v-8.9l7.5-5.5h-9.3L12 2l2.9 8.9h9.3l-7.5 5.5 2.9 8.9-2-1.4z" fill="#005128"/>
            </svg>
            <span class="component-badge__text">Trustpilot</span>
          </button>
          <button type="button" class="component-badge component-badge--interactive thankyou-badge thankyou-badge--facebook" data-ref="badge-modal-facebook" aria-label="Facebook">
            <svg class="component-badge__icon" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span class="component-badge__text">Facebook</span>
          </button>
          <button type="button" class="component-badge component-badge--interactive thankyou-badge thankyou-badge--twitter" data-ref="badge-modal-twitter" aria-label="Twitter (X)">
            <svg class="component-badge__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span class="component-badge__text">Twitter (X)</span>
          </button>
          <button type="button" class="component-badge component-badge--interactive thankyou-badge thankyou-badge--linkedin" data-ref="badge-modal-linkedin" aria-label="LinkedIn">
            <svg class="component-badge__icon" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
            <span class="component-badge__text">LinkedIn</span>
          </button>
        </div>
      </div>
    `;

    const modal = openModal({
      bodyHtml: modalBody,
      cancelText: 'Cerrar',
      confirmClass: 'component-button--black',
      confirmText: 'Cerrar',
      description: '¡Haz correr la voz y comparte BoardPDF!',
      onConfirm: () => modal.close(),
      showCancel: false,
      showConfirm: true,
      size: 'sm',
      title: '¿Cómo nos puedes dar las gracias?',
    });

    renderIcons(modal.backdrop);

    modal.backdrop.querySelector('[data-ref="badge-modal-trustpilot"]')?.addEventListener('click', () => {
      window.open('https://www.trustpilot.com/review/boardpdf.com', '_blank', 'noopener,noreferrer');
    });
    modal.backdrop.querySelector('[data-ref="badge-modal-facebook"]')?.addEventListener('click', () => {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer');
    });
    modal.backdrop.querySelector('[data-ref="badge-modal-twitter"]')?.addEventListener('click', () => {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Gestiona y edita tus archivos PDF rápido y fácil con @BoardPDF')}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer');
    });
    modal.backdrop.querySelector('[data-ref="badge-modal-linkedin"]')?.addEventListener('click', () => {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer');
    });
  }

  private openShareModal(): void {
    if (!this.data) return;

    const downloadLink = this.data.token
      ? `${window.location.origin}/download/${this.data.token}`
      : this.data.downloadUrl.startsWith('http')
      ? this.data.downloadUrl
      : `${window.location.origin}${this.data.downloadUrl}`;

    const modal = openModal({
      bodyHtml: `
        <div class="share-modal" data-ref="share-modal-container">
          <div class="share-modal__input-row">
            <div class="share-modal__input-wrap">
              <input class="field__input share-modal__input" data-ref="input-share-url" type="text" readonly value="${downloadLink}" />
            </div>
            <button type="button" class="component-button component-button--black component-button--h44 share-modal__btn-copy" data-ref="btn-modal-copy-url">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
              <span data-ref="modal-copy-label">Copiar</span>
            </button>
          </div>
          <div class="share-modal__qr-section">
            <div class="share-modal__qr-frame">
              <div class="share-modal__qr-target" data-ref="share-qr-target"></div>
            </div>
            <p class="share-modal__qr-label">Escanea el código QR con cualquier dispositivo para descargar el archivo directamente.</p>
          </div>
        </div>
      `,
      showCancel: false,
      showConfirm: false,
      size: 'sm',
      title: 'Compartir enlace de descarga',
    });

    renderIcons(modal.backdrop);

    const inputEl = modal.backdrop.querySelector<HTMLInputElement>('[data-ref="input-share-url"]');
    inputEl?.addEventListener('click', () => inputEl.select());

    const copyBtn = modal.backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-copy-url"]');
    const copyLabel = modal.backdrop.querySelector<HTMLElement>('[data-ref="modal-copy-label"]');
    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(downloadLink);
        if (copyLabel) copyLabel.textContent = '¡Copiado!';
        showToast('Enlace de descarga copiado al portapapeles.', 'success');
        setTimeout(() => {
          if (copyLabel) copyLabel.textContent = 'Copiar';
        }, 2200);
      } catch {
        showToast('No se pudo copiar el enlace al portapapeles.', 'danger');
      }
    });

    void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      const qrTarget = modal.backdrop.querySelector<HTMLElement>('[data-ref="share-qr-target"]');
      if (!qrTarget) return;
      qrTarget.innerHTML = '';
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const qr = new QRCodeStyling({
        backgroundOptions: { color: isDark ? '#18181b' : '#ffffff' },
        cornersDotOptions: { color: isDark ? '#f4f4f5' : '#09090b', type: 'dot' },
        cornersSquareOptions: { color: isDark ? '#f4f4f5' : '#09090b', type: 'extra-rounded' },
        data: downloadLink,
        dotsOptions: { color: isDark ? '#f4f4f5' : '#09090b', type: 'rounded' },
        height: 190,
        margin: 2,
        type: 'svg',
        width: 190,
      });
      qr.append(qrTarget);
    });
  }

  private async handleDeleteFile(): Promise<void> {
    if (this.isDeleted) return;

    const token = this.token || this.data?.token;
    if (!token) {
      showToast('No se encontró el identificador del archivo.', 'danger');
      return;
    }

    try {
      const res = await deleteApi(API_ROUTES.download.delete(token));
      const json = await res.json();

      if (res.ok && json.success) {
        this.isDeleted = true;
        sessionStorage.removeItem('download_ready_data');
        showToast('Archivo eliminado permanentemente del servidor.', 'success');
        this.renderDeletedState();
      } else {
        const errorMsg = json.error || 'No se pudo eliminar el archivo.';
        showToast(errorMsg, 'danger');
      }
    } catch {
      showToast('Error de conexión al intentar eliminar el archivo.', 'danger');
    }
  }

  private renderDeletedState(): void {
    const successScreen = this.container.querySelector<HTMLElement>('[data-ref="ready-success-screen"]');
    const expiredScreen = this.container.querySelector<HTMLElement>('[data-ref="ready-expired-screen"]');
    const expiredTitle = this.container.querySelector<HTMLElement>('[data-ref="expired-title"]');
    const expiredDesc = this.container.querySelector<HTMLElement>('[data-ref="expired-desc"]');
    const expiredBadge = this.container.querySelector<HTMLElement>('[data-ref="expired-badge"]');
    const iconWrap = this.container.querySelector<HTMLElement>('[data-ref="expired-icon-wrap"]');
    const iconUse = this.container.querySelector<SVGUseElement>('[data-ref="expired-icon"] use');

    hideElement(successScreen);
    showElement(expiredScreen);
    if (expiredTitle) expiredTitle.textContent = 'Archivo eliminado';
    if (expiredDesc) expiredDesc.textContent = 'El archivo ha sido borrado del servidor de forma permanente a petición tuya.';
    if (expiredBadge) expiredBadge.textContent = 'Archivo eliminado';
    if (iconWrap) iconWrap.classList.add('download-expired-card__icon-wrap--danger');
    if (iconUse) iconUse.setAttribute('href', '/icons.svg#delete');
  }
}

export async function createDownloadReadyView(token?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/download-ready/download-ready.html');
  const controller = new DownloadReadyController(container, token);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
