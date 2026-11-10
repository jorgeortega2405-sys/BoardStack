import { UploadProgressInfo } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { hideElement, showElement } from '../utils/dom.util.js';

interface ToolStatusOptions {
  container: HTMLElement;
  onRetry?: () => void;
  toolId?: string;
  toolName: string;
}

class ToolStatusManager {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentPercent = 0;
  private currentStage: 'completing' | 'idle' | 'processing' | 'uploading' = 'idle';
  private currentTotalFiles = 1;
  private errorScreen: HTMLElement | null = null;
  private onRetry?: () => void;
  private processingInterval: number | null = null;
  private toolId: string;
  private toolName: string;
  private uploadScreen: HTMLElement | null = null;

  constructor(options: ToolStatusOptions | HTMLElement) {
    if (options instanceof HTMLElement) {
      this.container = options;
      this.toolId = 'default';
      this.toolName = t('tool_status.default_tool_name');
    } else {
      this.container = options.container;
      this.toolId = options.toolId || 'default';
      this.toolName = options.toolName || t('tool_status.default_tool_name');
      this.onRetry = options.onRetry;
    }
  }

  private resolveStageText(field: string): string {
    const toolKey = `tool_status.stages.${this.toolId}.${field}`;
    const value = t(toolKey);
    if (value !== toolKey) {
      return value;
    }
    return t(`tool_status.stages.default.${field}`);
  }

  private getOrCreateUploadScreen(): HTMLElement {
    let uploadEl = this.container.querySelector<HTMLElement>('[data-ref="tool-upload-screen"]');
    if (!uploadEl) {
      uploadEl = document.createElement('div');
      uploadEl.className = 'tool-upload-screen';
      uploadEl.setAttribute('data-ref', 'tool-upload-screen');
      hideElement(uploadEl);
      uploadEl.innerHTML = `
        <div class="tool-upload-screen__content" data-ref="upload-screen-content">
          <h2 class="tool-upload-screen__title" data-ref="upload-screen-title">${t('tool_status.uploading_title')}</h2>
          <p class="tool-upload-screen__subtitle" data-ref="upload-screen-subtitle">${t('tool_status.uploading_subtitle')}</p>
          <div class="tool-upload-screen__meta" data-ref="upload-screen-meta">
            <span data-ref="upload-screen-eta">${t('tool_status.eta_calculating')}</span>
            <span class="tool-upload-screen__meta-sep">·</span>
            <span data-ref="upload-screen-speed">${t('tool_status.speed_calculating')}</span>
          </div>
          <div class="tool-upload-screen__progress-wrapper" data-ref="upload-screen-progress">
            <div class="tool-upload-screen__fill" data-ref="upload-screen-fill"></div>
          </div>
          <div class="tool-upload-screen__percentage" data-ref="upload-screen-percent">0%</div>
          <span class="tool-upload-screen__badge" data-ref="upload-screen-badge">${t('tool_status.badge_uploading')}</span>
        </div>
      `;
      this.container.appendChild(uploadEl);
    }
    this.uploadScreen = uploadEl;
    return uploadEl;
  }

  private getOrCreateErrorScreen(): HTMLElement {
    let errorEl = this.container.querySelector<HTMLElement>('[data-ref="tool-error-screen"]');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'tool-error-screen';
      errorEl.setAttribute('data-ref', 'tool-error-screen');
      hideElement(errorEl);
      errorEl.innerHTML = `
        <div class="tool-error-screen__body" data-ref="error-screen-body">
          <div class="tool-error-screen__content" data-ref="error-screen-content">
            <h2 class="tool-error-screen__title" data-ref="error-screen-title">${t('tool_status.error_title')}</h2>
            <p class="tool-error-screen__desc" data-ref="error-screen-desc">${t('tool_status.error_desc')}</p>
            <div class="tool-error-screen__card" data-ref="error-screen-card">
              <div class="tool-error-screen__card-header" data-ref="error-screen-card-header">
                <svg class="component-icon tool-error-screen__card-icon" aria-hidden="true"><use href="/icons.svg#warning"></use></svg>
                <span class="tool-error-screen__card-title" data-ref="error-screen-box-title">${t('tool_status.error_box_title')}</span>
              </div>
              <p class="tool-error-screen__card-text" data-ref="error-screen-box-text">${t('tool_status.error_box_text')}</p>
            </div>
            <div class="tool-error-screen__actions" data-ref="error-screen-actions">
              <button type="button" class="component-button component-button--black component-button--h48 tool-error-screen__btn-retry" data-ref="btn-retry-tool">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg>
                <span data-ref="txt-retry-btn">${t('tool_status.error_retry', { toolName: this.toolName })}</span>
              </button>
            </div>
          </div>
          <div class="tool-error-screen__graphic" data-ref="error-screen-graphic" aria-hidden="true">
            <div class="tool-error-illustration" data-ref="error-illustration">
              <svg class="tool-error-illustration__svg" viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g class="tool-error-illustration__server">
                  <path d="M70 120 L160 70 L250 120 L160 170 Z" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="2"/>
                  <path d="M70 120 L70 140 L160 190 L160 170 Z" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="2"/>
                  <path d="M250 120 L250 140 L160 190 L160 170 Z" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="2"/>
                  <path d="M70 90 L160 40 L250 90 L160 140 Z" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="2"/>
                  <path d="M70 90 L70 110 L160 160 L160 140 Z" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="2"/>
                  <path d="M250 90 L250 110 L160 160 L160 140 Z" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="2"/>
                </g>
                <g class="tool-error-illustration__badge" transform="translate(110, 80)">
                  <polygon points="50,10 90,85 10,85" fill="#ef4444" stroke="#dc2626" stroke-width="3" stroke-linejoin="round"/>
                  <circle cx="50" cy="74" r="3" fill="#ffffff"/>
                  <rect x="47.5" y="38" width="5" height="24" rx="2.5" fill="#ffffff"/>
                </g>
                <g class="tool-error-illustration__doc" transform="translate(40, 140)">
                  <rect x="0" y="0" width="46" height="58" rx="6" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="2"/>
                  <line x1="10" y1="16" x2="36" y2="16" stroke="var(--text-tertiary)" stroke-width="2.5" stroke-linecap="round"/>
                  <line x1="10" y1="26" x2="30" y2="26" stroke="var(--text-tertiary)" stroke-width="2.5" stroke-linecap="round"/>
                  <line x1="10" y1="36" x2="24" y2="36" stroke="var(--text-tertiary)" stroke-width="2.5" stroke-linecap="round"/>
                </g>
              </svg>
            </div>
          </div>
        </div>
      `;
      this.container.appendChild(errorEl);
      this.bindRetryEvent(errorEl);
      renderIcons(errorEl);
    }
    this.errorScreen = errorEl;
    return errorEl;
  }

  private bindRetryEvent(errorEl: HTMLElement): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const retryBtn = errorEl.querySelector<HTMLButtonElement>('[data-ref="btn-retry-tool"]');
    retryBtn?.addEventListener('click', () => {
      this.hide();
      if (this.onRetry) {
        this.onRetry();
      }
    }, { signal });
  }

  private stopProcessingInterval(): void {
    if (this.processingInterval !== null) {
      window.clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  public showUploading(currentFileIndex = 1, totalFiles = 1): void {
    this.stopProcessingInterval();
    this.currentStage = 'uploading';
    this.currentPercent = 0;
    this.currentTotalFiles = totalFiles;

    const uploadScreen = this.getOrCreateUploadScreen();
    const layoutEl = this.container.querySelector<HTMLElement>('.tool-layout');
    if (layoutEl) hideElement(layoutEl);
    if (this.errorScreen) hideElement(this.errorScreen);
    showElement(uploadScreen);

    const titleEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-title"]');
    const subEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-subtitle"]');
    const etaEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-eta"]');
    const speedEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-speed"]');
    const fillEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-fill"]');
    const percentEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-percent"]');
    const badgeEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-badge"]');

    if (titleEl) {
      titleEl.textContent = totalFiles > 1
        ? t('tool_status.uploading_file_of', { current: String(currentFileIndex), total: String(totalFiles) })
        : t('tool_status.uploading_title');
    }
    if (subEl) subEl.textContent = t('tool_status.uploading_subtitle');
    if (etaEl) etaEl.textContent = t('tool_status.eta_calculating');
    if (speedEl) speedEl.textContent = t('tool_status.speed_calculating');
    if (fillEl) {
      fillEl.classList.remove('is-processing');
      fillEl.style.setProperty('--progress', '0%');
    }
    if (percentEl) percentEl.textContent = '0%';
    if (badgeEl) badgeEl.textContent = t('tool_status.badge_uploading');
  }

  public updateUploadProgress(info: UploadProgressInfo | number, totalOrFileIndex = 1): void {
    if (typeof info === 'number') {
      const loaded = info;
      const total = totalOrFileIndex > 0 ? totalOrFileIndex : 1;
      const percent = Math.min(100, Math.round((loaded / total) * 100));
      this.updateUploadProgress({
        etaSeconds: 0,
        loaded,
        percent,
        speedBytesPerSec: 0,
        total,
      });
      return;
    }

    if (!this.uploadScreen || this.currentStage === 'completing') return;

    if (info.percent >= 100) {
      this.startProcessingProgress();
      return;
    }

    const titleEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-title"]');
    const etaEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-eta"]');
    const speedEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-speed"]');
    const fillEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-fill"]');
    const percentEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-percent"]');

    const mappedPercent = Math.min(30, Math.max(this.currentPercent, Math.round((info.percent / 100) * 30)));
    this.currentPercent = mappedPercent;

    if (titleEl && this.currentTotalFiles > 1) {
      const currentIdx = typeof totalOrFileIndex === 'number' && totalOrFileIndex > 0 ? totalOrFileIndex : 1;
      titleEl.textContent = t('tool_status.uploading_file_of', {
        current: String(currentIdx),
        total: String(this.currentTotalFiles),
      });
    }
    if (fillEl) fillEl.style.setProperty('--progress', `${mappedPercent}%`);
    if (percentEl) percentEl.textContent = `${mappedPercent}%`;

    if (etaEl) {
      etaEl.textContent = info.etaSeconds > 0
        ? t('tool_status.eta_remaining', { seconds: String(info.etaSeconds) })
        : t('tool_status.eta_calculating');
    }

    if (speedEl && info.speedBytesPerSec > 0) {
      const mbps = (info.speedBytesPerSec / (1024 * 1024)).toFixed(1);
      speedEl.textContent = t('tool_status.speed_value', { mbps });
    }
  }

  public showProcessing(title?: string, subtitle?: string): void {
    this.startProcessingProgress(title, subtitle);
  }

  public showProcessingState(opts?: { subtitle?: string; title?: string } | string, subtitle?: string): void {
    if (typeof opts === 'object' && opts !== null) {
      this.showProcessing(opts.title, opts.subtitle);
    } else {
      this.showProcessing(opts, subtitle);
    }
  }

  private startProcessingProgress(title?: string, subtitle?: string): void {
    if (this.currentStage === 'processing' || this.currentStage === 'completing') return;
    this.currentStage = 'processing';
    this.stopProcessingInterval();

    const uploadScreen = this.getOrCreateUploadScreen();
    const layoutEl = this.container.querySelector<HTMLElement>('.tool-layout');
    if (layoutEl) hideElement(layoutEl);
    if (this.errorScreen) hideElement(this.errorScreen);
    showElement(uploadScreen);

    const titleEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-title"]');
    const subEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-subtitle"]');
    const etaEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-eta"]');
    const speedEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-speed"]');
    const fillEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-fill"]');
    const percentEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-percent"]');
    const badgeEl = uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-badge"]');

    if (titleEl) titleEl.textContent = title || this.resolveStageText('title');
    if (subEl) subEl.textContent = subtitle || this.resolveStageText('s1_sub');
    if (etaEl) etaEl.textContent = this.resolveStageText('s1_eta');
    if (speedEl) speedEl.textContent = this.resolveStageText('s1_speed');
    if (badgeEl) badgeEl.textContent = t('tool_status.badge_processing');
    if (fillEl) fillEl.classList.add('is-processing');

    this.currentPercent = Math.max(30, this.currentPercent);
    if (fillEl) fillEl.style.setProperty('--progress', `${Math.floor(this.currentPercent)}%`);
    if (percentEl) percentEl.textContent = `${Math.floor(this.currentPercent)}%`;

    this.processingInterval = window.setInterval(() => {
      if (this.currentStage !== 'processing') {
        this.stopProcessingInterval();
        return;
      }

      if (this.currentPercent < 52) {
        this.currentPercent += 0.85;
        if (subEl) subEl.textContent = this.resolveStageText('s1_sub');
        if (etaEl) etaEl.textContent = this.resolveStageText('s1_eta');
        if (speedEl) speedEl.textContent = this.resolveStageText('s1_speed');
      } else if (this.currentPercent < 76) {
        this.currentPercent += 0.45;
        if (subEl) subEl.textContent = this.resolveStageText('s2_sub');
        if (etaEl) etaEl.textContent = this.resolveStageText('s2_eta');
        if (speedEl) speedEl.textContent = this.resolveStageText('s2_speed');
      } else if (this.currentPercent < 90) {
        this.currentPercent += 0.22;
        if (subEl) subEl.textContent = this.resolveStageText('s3_sub');
        if (etaEl) etaEl.textContent = this.resolveStageText('s3_eta');
        if (speedEl) speedEl.textContent = this.resolveStageText('s3_speed');
      } else if (this.currentPercent < 93) {
        this.currentPercent += 0.04;
        if (subEl) subEl.textContent = this.resolveStageText('s4_sub');
        if (etaEl) etaEl.textContent = this.resolveStageText('s4_eta');
        if (speedEl) speedEl.textContent = this.resolveStageText('s4_speed');
      }

      const displayPercent = Math.min(93, Math.floor(this.currentPercent));
      if (fillEl) fillEl.style.setProperty('--progress', `${displayPercent}%`);
      if (percentEl) percentEl.textContent = `${displayPercent}%`;
    }, 60);
  }

  public async complete(successTitle?: string, successSubtitle?: string): Promise<void> {
    this.stopProcessingInterval();
    this.currentStage = 'completing';
    this.currentPercent = 100;

    if (!this.uploadScreen) return;

    const titleEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-title"]');
    const subEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-subtitle"]');
    const etaEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-eta"]');
    const speedEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-speed"]');
    const fillEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-fill"]');
    const percentEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-percent"]');
    const badgeEl = this.uploadScreen.querySelector<HTMLElement>('[data-ref="upload-screen-badge"]');

    if (titleEl) titleEl.textContent = successTitle || t('tool_status.complete_title');
    if (subEl) subEl.textContent = successSubtitle || t('tool_status.complete_subtitle');
    if (badgeEl) badgeEl.textContent = t('tool_status.badge_completed');
    if (etaEl) etaEl.textContent = t('tool_status.complete_eta');
    if (speedEl) speedEl.textContent = t('tool_status.complete_speed');
    if (fillEl) {
      fillEl.classList.remove('is-processing');
      fillEl.style.setProperty('--progress', '100%');
    }
    if (percentEl) percentEl.textContent = '100%';

    await new Promise((resolve) => setTimeout(resolve, 240));
  }

  public showError(options: {
    boxText?: string;
    boxTitle?: string;
    desc?: string;
    retryText?: string;
    title?: string;
  } | string = {}, onRetry?: () => void): void {
    this.stopProcessingInterval();
    this.currentStage = 'idle';

    if (onRetry) {
      this.onRetry = onRetry;
    }
    const opt = typeof options === 'string' ? { desc: options } : options;
    const errorScreen = this.getOrCreateErrorScreen();
    const layoutEl = this.container.querySelector<HTMLElement>('.tool-layout');
    if (layoutEl) hideElement(layoutEl);
    if (this.uploadScreen) hideElement(this.uploadScreen);
    showElement(errorScreen);
    const titleEl = errorScreen.querySelector<HTMLElement>('[data-ref="error-screen-title"]');
    const descEl = errorScreen.querySelector<HTMLElement>('[data-ref="error-screen-desc"]');
    const boxTitleEl = errorScreen.querySelector<HTMLElement>('[data-ref="error-screen-box-title"]');
    const boxTextEl = errorScreen.querySelector<HTMLElement>('[data-ref="error-screen-box-text"]');
    const retryTextEl = errorScreen.querySelector<HTMLElement>('[data-ref="txt-retry-btn"]');

    if (titleEl) titleEl.textContent = opt.title || t('tool_status.error_title');
    if (descEl) descEl.textContent = opt.desc || t('tool_status.error_desc');
    if (boxTitleEl) boxTitleEl.textContent = opt.boxTitle || t('tool_status.error_box_title');
    if (boxTextEl) boxTextEl.textContent = opt.boxText || t('tool_status.error_box_text');
    if (retryTextEl) retryTextEl.textContent = opt.retryText || t('tool_status.error_retry', { toolName: this.toolName });
  }

  public hide(): void {
    this.stopProcessingInterval();
    this.currentStage = 'idle';
    const layoutEl = this.container.querySelector<HTMLElement>('.tool-layout');
    if (layoutEl) showElement(layoutEl);
    if (this.uploadScreen) {
      hideElement(this.uploadScreen);
      this.uploadScreen.remove();
      this.uploadScreen = null;
    }
    if (this.errorScreen) {
      hideElement(this.errorScreen);
      this.errorScreen.remove();
      this.errorScreen = null;
    }
  }

  public destroy(): void {
    this.stopProcessingInterval();
    this.currentStage = 'idle';
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    const layoutEl = this.container.querySelector<HTMLElement>('.tool-layout');
    if (layoutEl) showElement(layoutEl);
    if (this.uploadScreen) {
      this.uploadScreen.remove();
      this.uploadScreen = null;
    }
    if (this.errorScreen) {
      this.errorScreen.remove();
      this.errorScreen = null;
    }
  }
}

export { ToolStatusManager };
export type { ToolStatusOptions };
