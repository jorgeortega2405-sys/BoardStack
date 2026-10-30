import { showToast } from '../services/toast.service.js';
import { ToolSidebarModalController, hideElement, setupToolSidebarModal, showElement } from '../utils/dom.util.js';
import { ToolStatusManager } from './tool-status.component.js';

export interface ToolLayoutOptions {
  container: HTMLElement;
  dropzoneCardRef?: string;
  errorBannerRef?: string;
  onRetry?: () => void;
  selectedCardRef?: string;
  sidebarRef?: string;
  toolName: string;
  workspaceRef?: string;
}

export class ToolLayoutController {
  private abortController: AbortController | null = null;
  public readonly statusManager: ToolStatusManager;
  public sidebarModal: ToolSidebarModalController | null = null;

  constructor(private readonly options: ToolLayoutOptions) {
    const workspace = this.resolveWorkspace() || options.container;
    this.statusManager = new ToolStatusManager({
      container: workspace,
      onRetry: () => {
        this.statusManager.hide();
        if (this.options.onRetry) {
          this.options.onRetry();
        } else {
          this.showEmptyState();
        }
      },
      toolName: options.toolName,
    });
  }

  public get container(): HTMLElement {
    return this.options.container;
  }

  public resolveWorkspace(): HTMLElement | null {
    if (this.options.workspaceRef) {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${this.options.workspaceRef}"]`);
      if (el) return el;
    }
    return this.container.querySelector<HTMLElement>('[data-ref$="-workspace"], .tool-layout__workspace') || this.container;
  }

  public resolveDropzoneCard(): HTMLElement | null {
    if (this.options.dropzoneCardRef) {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${this.options.dropzoneCardRef}"]`);
      if (el) return el;
    }
    return this.container.querySelector<HTMLElement>('[data-ref*="dropzone-card"], [data-ref="pdf-dropzone"], .tool-workspace__canvas');
  }

  public resolveSelectedCard(): HTMLElement | null {
    if (this.options.selectedCardRef) {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${this.options.selectedCardRef}"]`);
      if (el) return el;
    }
    return this.container.querySelector<HTMLElement>('[data-ref*="selected-card"], [data-ref*="workspace-card"], [data-ref="pdf-items-card"], .pdf-items-view');
  }

  public resolveSidebar(): HTMLElement | null {
    if (this.options.sidebarRef) {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${this.options.sidebarRef}"]`);
      if (el) return el;
    }
    return this.container.querySelector<HTMLElement>('[data-ref$="-sidebar"], .tool-layout__sidebar');
  }

  public resolveErrorBanner(): HTMLElement | null {
    if (this.options.errorBannerRef) {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${this.options.errorBannerRef}"]`);
      if (el) return el;
    }
    return this.container.querySelector<HTMLElement>('[data-ref$="-error"], [data-ref*="error-banner"], .tool-sidebar__error-banner');
  }

  public resolveSettingsBtn(): HTMLElement | null {
    return this.container.querySelector<HTMLElement>('[data-ref="btn-tool-settings"], [data-ref*="settings"]')
      || document.querySelector<HTMLElement>('[data-ref="btn-tool-settings"]');
  }

  public resolveFab(): HTMLElement | null {
    return this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"], [data-ref="tool-fab-container"]');
  }

  public init(signal?: AbortSignal): void {
    this.abortController = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => this.destroy(), { once: true });
    }

    const sidebar = this.resolveSidebar();
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"], .tool-sidebar-backdrop');
    const closeBtn = sidebar?.querySelector<HTMLElement>('[data-ref="btn-sidebar-close"], [data-ref*="close"]');
    const dragZone = sidebar?.querySelector<HTMLElement>('[data-ref="modal-drag-zone"], [data-ref*="drag-zone"]');
    const settingsBtn = this.resolveSettingsBtn();

    if (sidebar) {
      this.sidebarModal = setupToolSidebarModal({
        backdrop,
        closeBtn,
        dragZone,
        settingsBtn,
        sidebar,
        signal: this.abortController.signal,
      });
    }
  }

  public showReadyState(): void {
    const dropzoneCard = this.resolveDropzoneCard();
    const selectedCard = this.resolveSelectedCard();
    const sidebar = this.resolveSidebar();
    const workspace = this.resolveWorkspace();
    const settingsBtn = this.resolveSettingsBtn();
    const fab = this.resolveFab();

    if (dropzoneCard) hideElement(dropzoneCard);
    if (selectedCard) showElement(selectedCard);
    if (sidebar) showElement(sidebar);
    if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
    if (settingsBtn) settingsBtn.classList.add('is-visible');
    if (fab) showElement(fab);
    this.hideError();
  }

  public showEmptyState(): void {
    const dropzoneCard = this.resolveDropzoneCard();
    const selectedCard = this.resolveSelectedCard();
    const sidebar = this.resolveSidebar();
    const workspace = this.resolveWorkspace();
    const settingsBtn = this.resolveSettingsBtn();
    const fab = this.resolveFab();

    if (dropzoneCard) showElement(dropzoneCard);
    if (selectedCard) hideElement(selectedCard);
    if (sidebar) hideElement(sidebar);
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (fab) hideElement(fab);
    if (this.sidebarModal) this.sidebarModal.close();
    this.hideError();
    this.statusManager.hide();
  }

  public showProcessingState(): void {
    const dropzoneCard = this.resolveDropzoneCard();
    const selectedCard = this.resolveSelectedCard();
    const sidebar = this.resolveSidebar();
    const workspace = this.resolveWorkspace();
    const settingsBtn = this.resolveSettingsBtn();
    const fab = this.resolveFab();

    if (dropzoneCard) hideElement(dropzoneCard);
    if (selectedCard) hideElement(selectedCard);
    if (sidebar) hideElement(sidebar);
    if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
    if (settingsBtn) settingsBtn.classList.remove('is-visible');
    if (fab) hideElement(fab);
    if (this.sidebarModal) this.sidebarModal.close();
    this.hideError();
    this.statusManager.showProcessingState();
  }

  public showError(msg: string): void {
    const errorBanner = this.resolveErrorBanner();
    if (errorBanner) {
      errorBanner.textContent = msg;
      showElement(errorBanner);
    }
    showToast(msg, 'danger');
  }

  public hideError(): void {
    const errorBanner = this.resolveErrorBanner();
    if (errorBanner) {
      errorBanner.textContent = '';
      hideElement(errorBanner);
    }
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
    this.statusManager.destroy();
  }
}
