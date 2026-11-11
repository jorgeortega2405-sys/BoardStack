import { CollabFileGuidesPreset } from '../modals/design-pdf-file-modal.util.js';
import { ManualGuide } from '../types/design-pdf.types.js';
import { renderPersistentGuidesSvg, RulerGuidesController, updateRulers } from '../utils/design-pdf-rulers.util.js';

interface RulerManagerHost {
  activePageIndex: number;
  container: HTMLElement;
  manualGuides: ManualGuide[];
  renderPages: () => void;
  selectedGuideId: string | null;
  zoomLevel: number;
}

class DesignPdfRulerManager {
  committedGuidesPreset: CollabFileGuidesPreset = null;
  currentGuidesPreset: CollabFileGuidesPreset = null;
  customGuideCols = 4;
  customGuideRows = 4;
  rulerGuidesCtrl: RulerGuidesController | null = null;
  showBleed = false;
  showMargins = false;
  showRulersAndGuides = false;

  private host: RulerManagerHost;

  constructor(host: RulerManagerHost) {
    this.host = host;
  }

  toggleRulersAndGuides(): void {
    this.showRulersAndGuides = !this.showRulersAndGuides;
    this.updateRulersUI();
    this.host.renderPages();
  }

  updateRulersUI(): void {
    const rulersWrapper = this.host.container.querySelector<HTMLElement>('[data-ref="collab-rulers-wrapper"]');
    const checkRulers = this.host.container.querySelector<HTMLElement>('[data-ref="check-sub-rulers"]');
    if (this.showRulersAndGuides) {
      rulersWrapper?.classList.remove('is-hidden');
      checkRulers?.classList.remove('is-hidden');
      this.updateRulers();
    } else {
      this.host.selectedGuideId = null;
      rulersWrapper?.classList.add('is-hidden');
      checkRulers?.classList.add('is-hidden');
      this.rulerGuidesCtrl?.sync(this.host.manualGuides, null);
    }
  }

  updateRulers(): void {
    updateRulers(this.host.container, this.showRulersAndGuides, this.host.zoomLevel, this.host.activePageIndex);
    this.rulerGuidesCtrl?.sync(this.host.manualGuides, this.host.selectedGuideId);
  }

  toggleMargins(): void {
    this.showMargins = !this.showMargins;
    const checkMargins = this.host.container.querySelector<HTMLElement>('[data-ref="check-sub-margins"]');
    if (this.showMargins) {
      checkMargins?.classList.remove('is-hidden');
    } else {
      checkMargins?.classList.add('is-hidden');
    }
    this.host.renderPages();
  }

  toggleBleed(): void {
    this.showBleed = !this.showBleed;
    const checkBleed = this.host.container.querySelector<HTMLElement>('[data-ref="check-sub-bleed"]');
    if (this.showBleed) {
      checkBleed?.classList.remove('is-hidden');
    } else {
      checkBleed?.classList.add('is-hidden');
    }
    this.host.renderPages();
  }

  renderPersistentGuidesSvg(pageIndex: number, width: number, height: number): SVGElement {
    return renderPersistentGuidesSvg(pageIndex, width, height, this.currentGuidesPreset, this.customGuideCols, this.customGuideRows);
  }
}

export { DesignPdfRulerManager };
export type { RulerManagerHost };
