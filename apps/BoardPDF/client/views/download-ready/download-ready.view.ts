import { openShareDownloadModal, openThankYouShareModal } from '../../components/modal.component.js';
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
import { hideElement, setupDropdown, showElement } from '../../utils/dom.util.js';

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

class DownloadReadyController implements ViewController {
  private abortController: AbortController | null = null;
  private cachedBlob: Blob | null = null;
  private container: HTMLElement;
  private continueDropdownCtrl: { close: () => void; destroy: () => void; open: () => void; toggle: () => void } | null = null;
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
    if (this.continueDropdownCtrl) {
      this.continueDropdownCtrl.destroy();
      this.continueDropdownCtrl = null;
    }
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
              subtitle: t('ui.el_proceso_se_ha_completado_con_exito_y_'),
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
    const dropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-continue-tools"]');
    const listEl = this.container.querySelector<HTMLElement>('[data-ref="list-continue-tools"]');
    if (!dropdownWrapper || !listEl) return;

    if (!this.data || !this.data.downloadUrl) {
      dropdownWrapper.classList.add('is-hidden');
      return;
    }

    const currentReturn = this.data.returnUrl || '';
    const currentLang = getCurrentLanguage();
    const toolsToShow = CONTINUE_TOOL_IDS
      .map((id) => TOOLS_REGISTRY.find((tool) => tool.id === id))
      .filter((tool): tool is typeof TOOLS_REGISTRY[0] => tool !== undefined && !currentReturn.startsWith(tool.path));

    listEl.innerHTML = toolsToShow
      .map((tool) => {
        const toolName = t(tool.nameKey);
        const toolPath = getLocalizedPath(tool.id, currentLang);
        return `
        <button type="button" class="menu-item download-continue-item" data-ref="btn-continue-${tool.id}" data-tool-path="${toolPath}">
          ${tool.customSvg || `<svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#${tool.icon}"></use></svg>`}
          <span class="menu-item__text">${toolName}</span>
        </button>
      `;
      })
      .join('');

    renderIcons(listEl);

    this.continueDropdownCtrl = setupDropdown(dropdownWrapper, {
      placement: 'bottom-end',
    });

    const signal = this.abortController?.signal;
    const buttons = listEl.querySelectorAll<HTMLButtonElement>('.download-continue-item');
    buttons.forEach((btn) => {
      btn.addEventListener(
        'click',
        async () => {
          this.continueDropdownCtrl?.close();
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
    showToast(t('toasts.cargando_archivo_en_la_herramienta_selec'), 'info');

    try {
      let blob = this.cachedBlob;
      if (!blob) {
        const res = await fetch(this.data.downloadUrl);
        if (!res.ok) throw new Error(t('ui.no_se_pudo_recuperar_el_archivo_procesad'));
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
      showToast(t('ui.error_al_preparar_el_archivo_para_la_her'), 'danger');
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
      showToast(t('toasts.download_started_success'), 'success');
      setTimeout(() => this.openThankYouModal(), 1000);
    } catch {}
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    this.container.querySelector('[data-ref="btn-download-file"]')?.addEventListener(
      'click',
      () => {
        showToast(t('toasts.descargando_archivo'), 'info');
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
    openThankYouShareModal({ shareUrl });
  }

  private openShareModal(): void {
    if (!this.data) return;

    const downloadLink = this.data.token
      ? `${window.location.origin}/download/${this.data.token}`
      : this.data.downloadUrl.startsWith('http')
      ? this.data.downloadUrl
      : `${window.location.origin}${this.data.downloadUrl}`;

    openShareDownloadModal({ downloadLink });
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
        showToast(t('toasts.file_permanently_deleted'), 'success');
        this.renderDeletedState();
      } else {
        const errorMsg = json.error || t('ui.no_se_pudo_eliminar_el_archivo');
        showToast(errorMsg, 'danger');
      }
    } catch {
      showToast(t('ui.error_de_conexion_al_intentar_eliminar_e'), 'danger');
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
    if (expiredDesc) expiredDesc.textContent = t('ui.el_archivo_ha_sido_borrado_del_servidor_');
    if (expiredBadge) expiredBadge.textContent = 'Archivo eliminado';
    if (iconWrap) iconWrap.classList.add('download-expired-card__icon-wrap--danger');
    if (iconUse) iconUse.setAttribute('href', '/icons.svg#delete');
  }
}

async function createDownloadReadyView(token?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/download-ready/download-ready.html');
  const controller = new DownloadReadyController(container, token);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { DownloadReadyController, createDownloadReadyView };
