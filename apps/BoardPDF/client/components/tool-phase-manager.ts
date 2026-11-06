import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { saveDownloadPayloadAndNavigate, ToolDownloadPayload } from '../services/tool-flow.service.js';
import { hideElement, showElement } from '../utils/dom.util.js';
import { ToolDropzoneComponent, ToolDropzoneOptions } from './tool-dropzone.component.js';
import { ToolStatusManager } from './tool-status.component.js';
import { isLimitErrorMessage, showUpgradeLimitModal } from './upgrade-limit-modal.component.js';

export type ToolPhase = 'download' | 'dropzone' | 'processing' | 'workspace';

export interface ToolPhaseManagerOptions {
  container: HTMLElement;
  dropzone?: Omit<ToolDropzoneOptions, 'container'>;
  footerRef?: string;
  onRetry?: () => void;
  sidebarRef?: string;
  toolId: string;
  toolName: string;
  topHeaderRef?: string;
  workspaceCardRef?: string;
}

export class ToolPhaseManager {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentPhase: ToolPhase = 'dropzone';
  private dropzoneComponent: ToolDropzoneComponent | null = null;
  private dropzoneElement: HTMLElement | null = null;
  private options: ToolPhaseManagerOptions;
  private originalQuerySelector: ((selectors: string) => Element | null) | null = null;
  private originalQuerySelectorAll: ((selectors: string) => NodeListOf<Element>) | null = null;
  private processingElement: HTMLElement | null = null;
  public statusManager: ToolStatusManager;
  private workspaceElements: HTMLElement[] = [];

  constructor(options: ToolPhaseManagerOptions) {
    this.options = options;
    this.container = options.container;

    this.statusManager = new ToolStatusManager({
      container: this.container,
      onRetry: () => {
        this.statusManager.hide();
        if (this.options.onRetry) {
          this.options.onRetry();
        } else {
          this.setPhase('dropzone');
        }
      },
      toolName: options.toolName,
    });
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();

    this.workspaceElements = Array.from(this.container.children) as HTMLElement[];
    this.setupContainerQueryDelegation();

    if (this.options.dropzone) {
      this.dropzoneComponent = new ToolDropzoneComponent({
        ...this.options.dropzone,
        container: this.container,
      });
      this.dropzoneElement = await this.dropzoneComponent.init();
      this.dropzoneElement.remove();
    }

    try {
      this.processingElement = await loadTemplate('/views/components/tool-processing.html');
      hideElement(this.processingElement);
    } catch {}

    queueMicrotask(() => {
      if (this.currentPhase === 'dropzone') {
        this.setPhase('dropzone');
      }
    });
  }

  private setupContainerQueryDelegation(): void {
    this.originalQuerySelector = this.container.querySelector.bind(this.container);
    this.originalQuerySelectorAll = this.container.querySelectorAll.bind(this.container);
    const origQuery = this.originalQuerySelector;
    const origQueryAll = this.originalQuerySelectorAll;
    const self = this;

    (this.container as any).querySelector = function <E extends Element = Element>(selector: string): E | null {
      const found = origQuery(selector);
      if (found) return found as E;
      for (const el of self.workspaceElements) {
        if (el.matches(selector)) return el as unknown as E;
        const inner = el.querySelector<E>(selector);
        if (inner) return inner;
      }
      return null;
    };

    (this.container as any).querySelectorAll = function <E extends Element = Element>(selector: string): NodeListOf<E> {
      const found = origQueryAll(selector);
      if (found.length > 0) return found as NodeListOf<E>;
      const list: E[] = [];
      for (const el of self.workspaceElements) {
        if (el.matches(selector)) list.push(el as unknown as E);
        el.querySelectorAll<E>(selector).forEach((item) => list.push(item));
      }
      return list as unknown as NodeListOf<E>;
    };
  }

  public getPhase(): ToolPhase {
    return this.currentPhase;
  }

  public setPhase(phase: ToolPhase): void {
    this.currentPhase = phase;

    if (phase === 'dropzone') {
      this.statusManager.hide();
      if (this.processingElement?.parentNode) this.processingElement.remove();

      this.workspaceElements.forEach((el) => {
        if (el.parentNode === this.container) {
          el.remove();
        }
      });

      if (this.dropzoneElement && !this.container.contains(this.dropzoneElement)) {
        this.container.appendChild(this.dropzoneElement);
      }
      if (this.dropzoneElement) showElement(this.dropzoneElement);
      return;
    }

    if (phase === 'workspace') {
      this.statusManager.hide();
      if (this.processingElement?.parentNode) this.processingElement.remove();
      if (this.dropzoneElement?.parentNode) this.dropzoneElement.remove();

      this.workspaceElements.forEach((el) => {
        if (!this.container.contains(el)) {
          this.container.appendChild(el);
        }
      });

      const topBar = this.resolveTopBar();
      const sidebar = this.resolveSidebar();
      const workspace = this.resolveWorkspace();
      const workspaceCard = this.resolveWorkspaceCard();
      const settingsBtn = this.resolveSettingsBtn();
      const fabMore = this.resolveFabMore();
      const footer = this.resolveFooter();

      showElement(topBar);
      showElement(sidebar);
      showElement(workspaceCard);
      showElement(footer);
      if (settingsBtn) settingsBtn.classList.add('is-visible');
      showElement(fabMore);
      if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');

      const docTitleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
      if (docTitleInput && !docTitleInput.value.trim()) {
        docTitleInput.value = this.getGenericDocumentTitle();
      }

      renderIcons(this.container);
      return;
    }

    if (phase === 'processing') {
      if (this.dropzoneElement?.parentNode) this.dropzoneElement.remove();
      this.workspaceElements.forEach((el) => {
        if (el.parentNode === this.container) {
          el.remove();
        }
      });
      if (this.processingElement && !this.container.contains(this.processingElement)) {
        this.container.appendChild(this.processingElement);
      }
      if (this.processingElement) showElement(this.processingElement);
      return;
    }

    if (phase === 'download') {
      if (this.dropzoneElement?.parentNode) this.dropzoneElement.remove();
      if (this.processingElement?.parentNode) this.processingElement.remove();
      this.workspaceElements.forEach((el) => {
        if (el.parentNode === this.container) {
          el.remove();
        }
      });
    }
  }

  public async navigateToDownload(payload: ToolDownloadPayload): Promise<void> {
    await this.statusManager.complete(payload.title, payload.subtitle);
    this.setPhase('download');
    saveDownloadPayloadAndNavigate(payload);
  }

  public showUploading(currentFileIndex = 1, totalFiles = 1): void {
    this.setPhase('processing');
    this.statusManager.showUploading(currentFileIndex, totalFiles);
  }

  public updateUploadProgress(info: any, totalOrFileIndex = 1): void {
    this.statusManager.updateUploadProgress(info, totalOrFileIndex);
  }

  public showProcessing(title?: string, subtitle?: string): void {
    this.setPhase('processing');
    this.statusManager.showProcessing(title, subtitle);
  }

  public showError(options: any, onRetry?: () => void): void {
    const rawMessage = typeof options === 'string' ? options : (options?.description || options?.message || options?.desc || '');
    if (isLimitErrorMessage(rawMessage)) {
      showUpgradeLimitModal({
        currentLimit: 25,
        toolName: this.options.toolName,
        type: 'files_count',
      });
      this.setPhase('workspace');
      return;
    }
    this.setPhase('processing');
    this.statusManager.showError(options, onRetry);
  }

  public resolveWorkspace(): HTMLElement {
    return this.container.querySelector<HTMLElement>('[data-ref$="-workspace"], .tool-layout__workspace') || this.container;
  }

  public resolveTopBar(): HTMLElement | null {
    if (this.options.topHeaderRef) {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${this.options.topHeaderRef}"]`);
      if (el) return el;
    }
    return this.container.querySelector<HTMLElement>('[data-ref="component-top"], .tool-top-bar');
  }

  public resolveSidebar(): HTMLElement | null {
    if (this.options.sidebarRef) {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${this.options.sidebarRef}"]`);
      if (el) return el;
    }
    return this.container.querySelector<HTMLElement>('[data-ref$="-sidebar"], .tool-layout__sidebar, .tool-sidebar-container');
  }

  public resolveWorkspaceCard(): HTMLElement | null {
    if (this.options.workspaceCardRef) {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${this.options.workspaceCardRef}"]`);
      if (el) return el;
    }
    return this.container.querySelector<HTMLElement>(
      '[data-ref$="-selected-card"], [data-ref$="-workspace-card"], [data-ref$="-editor-card"], [data-ref$="-viewer-card"], [data-ref="pdf-items-card"], .pdf-items-view, .pdf-viewer-workspace'
    );
  }

  public resolveSettingsBtn(): HTMLElement | null {
    return this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
  }

  public resolveFabMore(): HTMLElement | null {
    return this.container.querySelector<HTMLElement>('[data-ref="tool-fab-more"]');
  }

  public resolveFooter(): HTMLElement | null {
    if (this.options.footerRef) {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${this.options.footerRef}"]`);
      if (el) return el;
    }
    return this.container.querySelector<HTMLElement>('[data-ref="tool-footer"], .tool-footer, .collaborative-footer');
  }

  public getGenericDocumentTitle(): string {
    const titles: Record<string, string> = {
      'compare-pdf': 'BoardPDF_compared',
      'compress-pdf': 'BoardPDF_compressed',
      'crop-pdf': 'BoardPDF_cropped',
      'edit-pdf': 'BoardPDF_edited',
      'merge-pdf': 'BoardPDF_merged',
      'ocr-pdf': 'BoardPDF_ocr',
      'organize-pdf': 'BoardPDF_organized',
      'page-numbers': 'BoardPDF_numbered',
      'pdf-converter': 'BoardPDF_converted',
      'pdf-to-markdown': 'BoardPDF_markdown',
      'protect-pdf': 'BoardPDF_protected',
      'redact-pdf': 'BoardPDF_redacted',
      'remove-pdf-pages': 'BoardPDF_removed_pages',
      'repair-pdf': 'BoardPDF_repaired',
      'rotate-pdf': 'BoardPDF_rotated',
      'split-pdf': 'BoardPDF_split',
      'summarize-pdf': 'BoardPDF_summary',
      'to-pdf-converter': 'BoardPDF_converted',
      'translate-pdf': 'BoardPDF_translated',
      'unlock-pdf': 'BoardPDF_unlocked',
      'watermark-pdf': 'BoardPDF_watermarked',
    };
    return titles[this.options.toolId] || `BoardPDF_${(this.options.toolId || 'document').replace(/-/g, '_')}`;
  }

  public destroy(): void {
    if (this.originalQuerySelector) {
      this.container.querySelector = this.originalQuerySelector as any;
      this.originalQuerySelector = null;
    }
    if (this.originalQuerySelectorAll) {
      this.container.querySelectorAll = this.originalQuerySelectorAll as any;
      this.originalQuerySelectorAll = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.dropzoneComponent) {
      this.dropzoneComponent.destroy();
      this.dropzoneComponent = null;
    }
    if (this.processingElement) {
      this.processingElement.remove();
      this.processingElement = null;
    }
    this.statusManager.destroy();
    this.dropzoneElement = null;
    this.workspaceElements = [];
  }
}
