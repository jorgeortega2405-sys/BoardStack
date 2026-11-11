import { PageDimension } from '../../../config/collab-page-presets.config.js';
import { t } from '../../../services/i18n.service.js';
import { showToast } from '../../../services/toast.service.js';
import { EditorElement, ManualGuide, PagePdfSource } from '../types/design-pdf.types.js';

interface HistoryManagerHost {
  broadcastDocSync: () => void;
  canEditDoc: boolean;
  container: HTMLElement;
  docDefaultPageSize: PageDimension;
  docId: string;
  docTitle: string;
  elements: EditorElement[];
  flushAutoSave: () => Promise<void>;
  isAiLocked: boolean;
  isLoadingDocument: boolean;
  isModified: boolean;
  manualGuides: ManualGuide[];
  pageBackgrounds: string[];
  pageCount: number;
  pagePdfSources: Array<PagePdfSource | null>;
  pageSizes: PageDimension[];
  pageTitles: string[];
  removeTransformBox: () => void;
  renderPages: () => void;
  rulerGuidesCtrl?: { sync: (guides: ManualGuide[], selectedId: string | null) => void } | null;
  selectedElementId: string | null;
  selectedElementIds: Set<string>;
  selectedGuideId: string | null;
  setSaveStatus: (status: 'error' | 'saved' | 'saving') => void;
  updateContextToolbar: () => void;
}

class DesignPdfHistoryManager {
  private autoSaveMaxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private hasPendingSave = false;
  private host: HistoryManagerHost;
  private isApplyingHistory = false;
  private maxHistoryStates = 50;
  private redoStack: string[] = [];
  private undoStack: string[] = [];

  constructor(host: HistoryManagerHost) {
    this.host = host;
  }

  getPendingSave(): boolean {
    return this.hasPendingSave;
  }

  setPendingSave(val: boolean): void {
    this.hasPendingSave = val;
  }

  clearTimers(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.autoSaveMaxWaitTimer) {
      clearTimeout(this.autoSaveMaxWaitTimer);
      this.autoSaveMaxWaitTimer = null;
    }
  }

  writeLocalWal(): void {
    if (this.host.isLoadingDocument || !this.host.docId) return;
    try {
      const walData = {
        elements: this.host.elements,
        guides: this.host.manualGuides,
        pageBackgrounds: this.host.pageBackgrounds,
        pageCount: this.host.pageCount,
        pagePdfSources: this.host.pagePdfSources,
        pageSize: this.host.docDefaultPageSize,
        pageSizes: this.host.pageSizes,
        pageTitles: this.host.pageTitles,
        timestamp: Date.now(),
        title: this.host.docTitle,
      };
      localStorage.setItem(`boardpdf_wal_${this.host.docId}`, JSON.stringify(walData));
    } catch {}
  }

  setModified(val: boolean): void {
    if (this.host.isAiLocked) return;
    this.host.isModified = val;
    if (val) {
      this.writeLocalWal();
      this.scheduleAutoSave();
    } else {
      try {
        localStorage.removeItem(`boardpdf_wal_${this.host.docId}`);
      } catch {}
    }
  }

  scheduleAutoSave(delayMs = 350): void {
    if (this.host.isAiLocked || !this.host.docId || !this.host.canEditDoc) return;
    this.writeLocalWal();
    this.host.setSaveStatus('saving');
    this.hasPendingSave = true;

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    if (!this.autoSaveMaxWaitTimer) {
      this.autoSaveMaxWaitTimer = setTimeout(() => {
        this.autoSaveMaxWaitTimer = null;
        void this.host.flushAutoSave();
      }, 1200);
    }

    this.autoSaveTimer = setTimeout(() => {
      if (this.autoSaveMaxWaitTimer) {
        clearTimeout(this.autoSaveMaxWaitTimer);
        this.autoSaveMaxWaitTimer = null;
      }
      void this.host.flushAutoSave();
    }, delayMs);
  }

  recordHistory(): void {
    if (this.isApplyingHistory) return;
    const snapshot = JSON.stringify({
      elements: this.host.elements,
      guides: this.host.manualGuides,
      pageBackgrounds: this.host.pageBackgrounds,
      pageCount: this.host.pageCount,
      pageSizes: this.host.pageSizes,
    });
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snapshot) {
      return;
    }
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistoryStates) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateUndoRedoButtons();
  }

  undo(): void {
    if (this.host.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (this.undoStack.length <= 1) return;
    const currentState = this.undoStack.pop();
    if (currentState) {
      this.redoStack.push(currentState);
    }
    const previousState = this.undoStack[this.undoStack.length - 1];
    if (previousState) {
      this.applyHistoryState(previousState);
    }
    this.updateUndoRedoButtons();
  }

  redo(): void {
    if (this.host.isAiLocked) {
      showToast(t('collaborative.ai_lock_blocked_action'), 'warning');
      return;
    }
    if (this.redoStack.length === 0) return;
    const nextState = this.redoStack.pop();
    if (nextState) {
      this.undoStack.push(nextState);
      this.applyHistoryState(nextState);
    }
    this.updateUndoRedoButtons();
  }

  applyHistoryState(stateJson: string): void {
    try {
      this.isApplyingHistory = true;
      const parsed = JSON.parse(stateJson);
      this.host.elements = Array.isArray(parsed.elements) ? parsed.elements : [];
      this.host.manualGuides = Array.isArray(parsed.guides) ? parsed.guides : [];
      if (typeof parsed.pageCount === 'number') this.host.pageCount = parsed.pageCount;
      if (Array.isArray(parsed.pageSizes)) this.host.pageSizes = parsed.pageSizes;
      if (Array.isArray(parsed.pageBackgrounds)) this.host.pageBackgrounds = parsed.pageBackgrounds;

      this.host.selectedElementId = null;
      this.host.selectedElementIds.clear();
      this.host.selectedGuideId = null;
      this.host.removeTransformBox();
      this.host.renderPages();
      this.host.updateContextToolbar();
      this.host.rulerGuidesCtrl?.sync(this.host.manualGuides, null);
      this.setModified(true);
      this.host.broadcastDocSync();
      void this.host.flushAutoSave();
    } finally {
      this.isApplyingHistory = false;
    }
  }

  updateUndoRedoButtons(): void {
    const undoBtn = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    const redoBtn = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    if (undoBtn) undoBtn.disabled = this.undoStack.length <= 1;
    if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
  }
}

export { DesignPdfHistoryManager };
export type { HistoryManagerHost };
