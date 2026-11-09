interface ToolZoomOptions {
  container: HTMLElement;
  initialZoom?: number;
  maxZoom?: number;
  minZoom?: number;
  onZoomChange?: (zoomLevel: number) => void;
  scrollContainer?: HTMLElement | null;
  signal?: AbortSignal;
}

class ToolZoomController {
  private btnReset: HTMLButtonElement | null = null;
  private container: HTMLElement;
  private footer: HTMLElement | null = null;
  private maxZoom: number;
  private minZoom: number;
  private onZoomChange?: (zoomLevel: number) => void;
  private scrollContainer: HTMLElement | null = null;
  private slider: HTMLInputElement | null = null;
  private txtLevel: HTMLElement | null = null;
  private txtPage: HTMLElement | null = null;
  private zoomLevel = 1.0;

  constructor(options: ToolZoomOptions) {
    this.container = options.container;
    this.minZoom = options.minZoom ?? 0.10;
    this.maxZoom = options.maxZoom ?? 3.0;
    this.zoomLevel = options.initialZoom ?? 1.0;
    this.onZoomChange = options.onZoomChange;
    this.scrollContainer = options.scrollContainer ?? null;

    this.resolveElements();
    this.bindEvents(options.signal);
    this.updateControls();
  }

  private resolveElements(): void {
    this.footer = this.container.querySelector<HTMLElement>('[data-ref="tool-footer"]');
    this.slider = this.container.querySelector<HTMLInputElement>('[data-ref="slider-zoom"]');
    this.txtLevel = this.container.querySelector<HTMLElement>('[data-ref="txt-zoom-level"]');
    this.btnReset = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-reset"]');
    this.txtPage = this.container.querySelector<HTMLElement>('[data-ref="txt-footer-page-info"]');
  }

  private bindEvents(signal?: AbortSignal): void {
    if (this.slider) {
      this.slider.addEventListener('input', () => {
        const val = parseFloat(this.slider!.value);
        if (!isNaN(val)) {
          this.setZoom(val / 100, true);
        }
      }, { signal });
    }

    if (this.btnReset) {
      this.btnReset.addEventListener('click', (e) => {
        e.preventDefault();
        this.reset();
      }, { signal });
    }

    const scrollTarget = this.scrollContainer || this.container.querySelector<HTMLElement>('.pdf-viewer-canvas-container, .pdf-editor-canvas-container, .tool-layout__workspace');
    if (scrollTarget) {
      scrollTarget.addEventListener('wheel', (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          this.setZoom(this.zoomLevel + delta, true);
        }
      }, { passive: false, signal });
    }
  }

  public getZoom(): number {
    return this.zoomLevel;
  }

  public setZoom(level: number, triggerCallback = true): void {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, Math.round(level * 100) / 100));
    this.zoomLevel = clamped;
    this.updateControls();

    if (triggerCallback && this.onZoomChange) {
      this.onZoomChange(this.zoomLevel);
    }
  }

  public zoomIn(delta = 0.15): void {
    this.setZoom(this.zoomLevel + delta, true);
  }

  public zoomOut(delta = 0.15): void {
    this.setZoom(this.zoomLevel - delta, true);
  }

  public reset(): void {
    this.setZoom(1.0, true);
  }

  public showFooter(visible = true): void {
    if (!this.footer) {
      this.resolveElements();
    }
    if (this.footer) {
      this.footer.classList.toggle('is-hidden', !visible);
    }
  }

  public hideFooter(): void {
    this.showFooter(false);
  }

  public destroy(): void {
    this.footer = null;
    this.slider = null;
    this.txtLevel = null;
    this.btnReset = null;
    this.txtPage = null;
    this.scrollContainer = null;
    this.onZoomChange = undefined;
  }

  public updatePageInfo(current: number, total: number): void {
    if (!this.txtPage) {
      this.resolveElements();
    }
    if (this.txtPage) {
      this.txtPage.textContent = `${current} de ${total}`;
    }
  }

  private updateControls(): void {
    if (this.txtLevel) {
      this.txtLevel.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }

    if (this.slider) {
      const zoomInt = Math.round(this.zoomLevel * 100);
      if (document.activeElement !== this.slider) {
        this.slider.value = `${zoomInt}`;
      }
      const minVal = parseFloat(this.slider.min) || 10;
      const maxVal = parseFloat(this.slider.max) || 300;
      const pct = Math.max(0, Math.min(100, ((zoomInt - minVal) / (maxVal - minVal)) * 100));
      this.slider.style.setProperty('--slider-pct', `${pct}%`);
    }
  }
}

function applyPageScaler(
  scalerEl: HTMLElement,
  sheetEl: HTMLElement,
  baseWidth: number,
  baseHeight: number,
  zoomLevel: number,
  origin = 'top left'
): void {
  const scaledW = Math.round(baseWidth * zoomLevel);
  const scaledH = Math.round(baseHeight * zoomLevel);
  scalerEl.style.width = `${scaledW}px`;
  scalerEl.style.height = `${scaledH}px`;
  sheetEl.style.transform = `scale(${zoomLevel})`;
  sheetEl.style.transformOrigin = origin;
}

export { ToolZoomController, applyPageScaler };
export type { ToolZoomOptions };
