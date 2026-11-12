import { showAuthGateModal, showUpgradeLimitModal } from '../../../components/modal.component.js';
import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { currentUser, postFormWithProgress, updateUserAiTokens } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupDropdown, setupToolSidebarModal, showElement, toggleElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { OCR_LANGUAGES } from '../ocr-pdf/ocr-pdf.types.js';
import { TranslatePdfResultData } from './translate-pdf.types.js';

const CLEAN_LANGUAGES = OCR_LANGUAGES.filter(
  (lang) => !lang.code.includes('_') && lang.code !== 'equ' && !lang.name.includes('antiguo')
);

class TranslatePdfViewController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private dropdownControllers: Array<{ destroy: () => void }> = [];
  private isProcessing = false;
  private phaseManager: ToolPhaseManager | null = null;
  private selectedLayout: 'preserve' | 'text_only' = 'preserve';
  private sidebarModal: ToolSidebarModalController | null = null;
  private sourceLang = '';
  private targetLang = 'spa';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: t('tools.select_pdf_btn'),
        desc: t('ui.traduce_documentos_completos_conservando'),
        hint: t('tools.dropzone_hint_pdf'),
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) this.handleFileSelected(files[0]);
        },
        title: t('tools.translate_pdf_title'),
      },
      onRetry: () => {
        const translateBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-translate-action"]');
        if (translateBtn) void this.handleTranslate(translateBtn);
      },
      sidebarRef: 'translate-pdf-sidebar',
      toolId: 'translate-pdf',
      toolName: t('tools.translate_pdf_title'),
      topHeaderRef: 'component-top',
      workspaceCardRef: 'translate-selected-card',
    });
    await this.phaseManager.init();
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
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
    this.dropdownControllers.forEach((ctrl) => ctrl.destroy());
    this.dropdownControllers = [];
    this.currentFile = null;
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="translate-pdf-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="translate-sidebar-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');

    if (sidebar && backdrop) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const removeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
    const translateBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-translate-action"]');

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetSelectedFile();
    }, { signal });

    translateBtn?.addEventListener('click', () => {
      void this.handleTranslate(translateBtn);
    }, { signal });

    const btnPreserve = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layout-preserve"]');
    const btnText = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layout-text"]');

    btnPreserve?.addEventListener('click', () => this.setLayoutMode('preserve'), { signal });
    btnText?.addEventListener('click', () => this.setLayoutMode('text_only'), { signal });

    this.bindLanguageDropdowns(signal);
  }

  private bindLanguageDropdowns(signal: AbortSignal): void {
    const sourceWrapper = this.container.querySelector<HTMLElement>('[data-ref="wrapper-source-lang"]');
    const targetWrapper = this.container.querySelector<HTMLElement>('[data-ref="wrapper-target-lang"]');

    if (sourceWrapper) {
      const listEl = sourceWrapper.querySelector<HTMLElement>('[data-ref="list-source-lang"]');
      const emptyEl = sourceWrapper.querySelector<HTMLElement>('[data-ref="empty-source-lang"]');
      const searchInput = sourceWrapper.querySelector<HTMLInputElement>('[data-ref="input-search-source-lang"]');
      const labelEl = sourceWrapper.querySelector<HTMLElement>('[data-ref="txt-selected-source-lang"]');

      if (listEl) this.renderSourceLanguages(listEl);

      const ctrl = setupDropdown(sourceWrapper, {
        backdrop: sourceWrapper.querySelector<HTMLElement>('[data-ref="backdrop-source-lang"]'),
        isSelect: true,
        matchWidth: true,
        menu: sourceWrapper.querySelector<HTMLElement>('[data-ref="menu-source-lang"]'),
        offset: [0, 8],
        onSelect: (_val, item) => {
          const langCode = item?.getAttribute('data-lang') ?? '';
          this.sourceLang = langCode;
          if (labelEl && item) {
            const text = item.querySelector('.menu-item__text')?.textContent || '';
            labelEl.removeAttribute('data-i18n');
            labelEl.textContent = text;
          }
          listEl?.querySelectorAll('.menu-item').forEach((menuItem) => {
            const isMatch = (menuItem.getAttribute('data-lang') || '') === this.sourceLang;
            menuItem.classList.toggle('is-active', isMatch);
            menuItem.querySelector('.menu-item__check')?.classList.toggle('is-hidden', !isMatch);
          });
        },
        trigger: sourceWrapper.querySelector<HTMLElement>('[data-ref="btn-trigger-source-lang"]'),
      });
      this.dropdownControllers.push(ctrl);

      searchInput?.addEventListener('input', () => {
        if (listEl) this.filterLanguages(listEl, emptyEl, searchInput.value);
      }, { signal });
    }

    if (targetWrapper) {
      const listEl = targetWrapper.querySelector<HTMLElement>('[data-ref="list-target-lang"]');
      const emptyEl = targetWrapper.querySelector<HTMLElement>('[data-ref="empty-target-lang"]');
      const searchInput = targetWrapper.querySelector<HTMLInputElement>('[data-ref="input-search-target-lang"]');
      const labelEl = targetWrapper.querySelector<HTMLElement>('[data-ref="txt-selected-target-lang"]');

      if (listEl) this.renderTargetLanguages(listEl);

      const ctrl = setupDropdown(targetWrapper, {
        backdrop: targetWrapper.querySelector<HTMLElement>('[data-ref="backdrop-target-lang"]'),
        isSelect: true,
        matchWidth: true,
        menu: targetWrapper.querySelector<HTMLElement>('[data-ref="menu-target-lang"]'),
        offset: [0, 8],
        onSelect: (val, item) => {
          const langCode = val || item?.getAttribute('data-lang') || '';
          if (!langCode) return;
          this.targetLang = langCode;
          if (labelEl && item) {
            const text = item.querySelector('.menu-item__text')?.textContent || '';
            labelEl.removeAttribute('data-i18n');
            labelEl.textContent = text;
          }
          listEl?.querySelectorAll('.menu-item').forEach((menuItem) => {
            const isMatch = (menuItem.getAttribute('data-lang') || '') === this.targetLang;
            menuItem.classList.toggle('is-active', isMatch);
            menuItem.querySelector('.menu-item__check')?.classList.toggle('is-hidden', !isMatch);
          });
        },
        trigger: targetWrapper.querySelector<HTMLElement>('[data-ref="btn-trigger-target-lang"]'),
      });
      this.dropdownControllers.push(ctrl);

      searchInput?.addEventListener('input', () => {
        if (listEl) this.filterLanguages(listEl, emptyEl, searchInput.value);
      }, { signal });
    }
  }

  private renderSourceLanguages(container: HTMLElement): void {
    const items = [
      { code: '', name: t('tools.translate_auto_detect') },
      ...CLEAN_LANGUAGES,
    ];
    container.innerHTML = items.map((lang) => {
      const isActive = this.sourceLang === lang.code;
      return `
        <button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="item-source-lang-${lang.code || 'auto'}" data-lang="${lang.code}" data-value="${lang.code}">
          <span class="menu-item__text">${lang.name}</span>
          <svg class="component-icon menu-item__check${isActive ? '' : ' is-hidden'}" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
        </button>
      `;
    }).join('');
    renderIcons(container);
  }

  private renderTargetLanguages(container: HTMLElement): void {
    container.innerHTML = CLEAN_LANGUAGES.map((lang) => {
      const isActive = this.targetLang === lang.code;
      return `
        <button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="item-target-lang-${lang.code}" data-lang="${lang.code}" data-value="${lang.code}">
          <span class="menu-item__text">${lang.name}</span>
          <svg class="component-icon menu-item__check${isActive ? '' : ' is-hidden'}" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
        </button>
      `;
    }).join('');
    renderIcons(container);
  }

  private filterLanguages(listEl: HTMLElement, emptyEl: HTMLElement | null, query: string): void {
    const cleanQuery = query.toLowerCase().trim();
    let matchesCount = 0;
    const items = listEl.querySelectorAll<HTMLElement>('.menu-item');
    items.forEach((item) => {
      const name = item.querySelector('.menu-item__text')?.textContent?.toLowerCase() || '';
      const code = (item.getAttribute('data-lang') || '').toLowerCase();
      const match = !cleanQuery || name.includes(cleanQuery) || code.includes(cleanQuery);
      toggleElement(item, match);
      if (match) matchesCount++;
    });
    if (emptyEl) {
      toggleElement(emptyEl, matchesCount === 0);
    }
  }

  private setLayoutMode(mode: 'preserve' | 'text_only'): void {
    this.selectedLayout = mode;
    const toggle = this.container.querySelector<HTMLElement>('[data-ref="translate-layout-toggle"]');
    if (toggle) {
      toggle.setAttribute('data-active', mode === 'preserve' ? '0' : '1');
    }

    const btnPreserve = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layout-preserve"]');
    const btnText = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layout-text"]');
    if (btnPreserve) btnPreserve.classList.toggle('is-active', mode === 'preserve');
    if (btnText) btnText.classList.toggle('is-active', mode === 'text_only');

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="translate-layout-title"]');
    const descEl = this.container.querySelector<HTMLElement>('[data-ref="translate-layout-desc"]');
    if (titleEl) {
      titleEl.removeAttribute('data-i18n');
      titleEl.textContent = mode === 'preserve'
        ? t('tools.translate_layout_preserve_title')
        : t('tools.translate_layout_text_title');
    }
    if (descEl) {
      descEl.removeAttribute('data-i18n');
      descEl.textContent = mode === 'preserve'
        ? t('tools.translate_layout_preserve_desc')
        : t('tools.translate_layout_text_desc');
    }
  }

  private handleFileSelected(file: File): void {
    if (!currentUser) {
      showAuthGateModal({ featureKey: 'ai_tools', returnUrl: '/translate-pdf' });
      return;
    }

    this.hideError();

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.showError(t('tools.only_pdf_allowed'));
      return;
    }

    const limits = getCurrentUserToolLimits('translate-pdf');
    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'translate-pdf',
        toolName: t('tools.translate_pdf_title'),
        type: 'file_size',
      });
      return;
    }

    this.currentFile = file;
    this.renderSelectedState(file);
  }

  private renderSelectedState(file: File): void {
    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="selected-file-size"]');
    const translateBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-translate-action"]');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (translateBtn) translateBtn.disabled = false;

    this.phaseManager?.setPhase('workspace');

    const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
    if (titleInput) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      titleInput.value = `${base}${t('tools.translate_default_suffix')}.pdf`;
    }

    void this.renderThumbnail(file);
  }

  private async renderThumbnail(file: File): Promise<void> {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="doc-preview-canvas"]');
    if (!canvas) return;

    let pdf: any = null;
    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const targetWidth = 140;
      const origViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / origViewport.width;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

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
    const translateBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-translate-action"]');
    if (translateBtn) translateBtn.disabled = true;

    this.sidebarModal?.close();
    this.phaseManager?.setPhase('dropzone');
    this.hideError();
  }

  private async handleTranslate(button: HTMLButtonElement): Promise<void> {
    if (!this.currentFile || this.isProcessing) return;
    this.hideError();

    this.isProcessing = true;
    this.phaseManager?.showUploading(1, 1);

    await withButtonLoading(button, async () => {
      try {
        const formData = new FormData();
        formData.append('file', this.currentFile as Blob, this.currentFile?.name);
        formData.append('pdf', this.currentFile as Blob, this.currentFile?.name);
        formData.append('targetLang', this.targetLang);
        if (this.sourceLang) {
          formData.append('sourceLang', this.sourceLang);
        }
        formData.append('layoutMode', this.selectedLayout);

        const response = await postFormWithProgress(
          API_ROUTES.tools.translatePdf.translate,
          formData,
          (progress) => {
            this.phaseManager?.updateUploadProgress(progress, 1);
          }
        );
        const res = (await response.json()) as { data?: TranslatePdfResultData; error?: string; success: boolean };

        this.phaseManager?.showProcessing(
          t('tools.translate_processing_title'),
          this.selectedLayout === 'preserve'
            ? t('ui.conservando_formato_tipografia_y_tablas_')
            : t('ui.generando_documento_con_texto_traducido_')
        );

        if (!response.ok || !res.success || !res.data) {
          throw new Error(res.error || t('ui.error_al_traducir_el_documento_pdf'));
        }

        const token = res.data.fileId;
        if ((res as any).aiTokens?.balance !== undefined) {
          updateUserAiTokens((res as any).aiTokens.balance);
        }
        showToast(t('toasts.documento_traducido_con_exito'), 'success');
        await this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: res.data.size,
          filename: res.data.filename,
          returnText: t('tools.translate_return_btn'),
          returnUrl: '/translate-pdf',
          subtitle: `${t('tools.translate_success_prefix')}"${this.currentFile?.name}".`,
          title: t('tools.translate_success_title'),
          token,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : t('ui.error_al_conectar_con_el_servidor');
        this.showError(errorMessage);
        this.phaseManager?.showError(errorMessage);
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private showError(message: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="translate-error-banner"]');
    if (errorEl) {
      errorEl.textContent = message;
      showElement(errorEl);
    }
    showToast(message, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="translate-error-banner"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

async function createTranslatePdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/translate-pdf/translate-pdf.html');
  const controller = new TranslatePdfViewController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { TranslatePdfViewController, createTranslatePdfView };
