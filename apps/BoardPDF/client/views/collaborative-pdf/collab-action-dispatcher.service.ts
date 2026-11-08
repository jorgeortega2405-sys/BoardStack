import { PageDimension } from '../../config/collab-page-presets.config.js';
import { wsService } from '../../services/websocket.service.js';
import { EditorElement, PagePdfSource } from './collaborative-pdf.types.js';

export type CollabActionType =
  | 'DOC_SYNC_FULL'
  | 'DOC_TITLE_CHANGE'
  | 'DRAWING_ADD'
  | 'DRAWING_ERASE'
  | 'ELEMENT_ADD'
  | 'ELEMENT_ALIGN'
  | 'ELEMENT_DELETE'
  | 'ELEMENT_DUPLICATE'
  | 'ELEMENT_LAYER_MOVE'
  | 'ELEMENT_LAYER_REORDER'
  | 'ELEMENT_MOVE'
  | 'ELEMENT_RESIZE'
  | 'ELEMENT_ROTATE'
  | 'ELEMENT_STYLE_UPDATE'
  | 'ELEMENT_UPDATE'
  | 'PAGE_ADD'
  | 'PAGE_DELETE'
  | 'PAGE_DUPLICATE'
  | 'PAGE_MOVE'
  | 'PAGE_SET_BG'
  | 'PAGE_SET_SIZE'
  | 'PAGE_SET_TITLE'
  | 'PAGE_TOGGLE_LOCK'
  | 'REDO'
  | 'UNDO';

export interface CollabAction<T = any> {
  pageIndex?: number;
  payload: T;
  senderClientId?: string;
  timestamp?: number;
  type: CollabActionType;
}

export interface DispatchOptions {
  localOnly?: boolean;
  skipBroadcast?: boolean;
  skipHistory?: boolean;
}

export type ActionCallback = (action: CollabAction) => void;

export interface CollabEditorDelegate {
  alignElementToPage: (elementId: string, alignment: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top') => boolean;
  canEdit: () => boolean;
  docDefaultPageSize: PageDimension;
  docTitle: string;
  elements: EditorElement[];
  flushAutoSave: () => Promise<void>;
  getPageDimensions: (pageIndex: number) => PageDimension;
  isCollabRoomFull: boolean;
  isLockedPage: (pageIndex: number) => boolean;
  moveElementLayer: (elementId: string, direction: 'back' | 'backward' | 'forward' | 'front') => boolean;
  pageBackgrounds: string[];
  pageCount: number;
  pagePdfSources: Array<PagePdfSource | null>;
  pageSizes: PageDimension[];
  pageTitles: string[];
  recordHistory: () => void;
  redo: () => void;
  renderLayersList?: () => void;
  renderPages: () => void;
  reorderElementLayer: (draggedId: string, targetId: string) => boolean;
  selectElement: (id: string | null) => void;
  selectedElementId: string | null;
  setDocTitle: (title: string) => void;
  setModified: (val: boolean) => void;
  undo: () => void;
  updateContextToolbar: () => void;
  updateTransformBoxPosition: () => void;
}

export class CollabActionDispatcher {
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private delegate: CollabEditorDelegate;
  private subscribers = new Set<ActionCallback>();

  constructor(delegate: CollabEditorDelegate) {
    this.delegate = delegate;
  }

  setDelegate(delegate: CollabEditorDelegate): void {
    this.delegate = delegate;
  }

  subscribe(callback: ActionCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  destroy(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.subscribers.clear();
  }

  dispatch<T = any>(action: CollabAction<T>, options?: DispatchOptions): boolean {
    const isMutation = action.type !== 'UNDO' && action.type !== 'REDO';

    if (isMutation && action.type !== 'PAGE_TOGGLE_LOCK' && !this.delegate.canEdit()) {
      return false;
    }

    if (action.pageIndex !== undefined && action.type !== 'PAGE_TOGGLE_LOCK' && this.delegate.isLockedPage(action.pageIndex)) {
      return false;
    }

    const executed = this.executeAction(action);
    if (!executed) {
      return false;
    }

    if (!options?.skipHistory && isMutation && action.type !== 'DOC_SYNC_FULL') {
      this.delegate.recordHistory();
      this.delegate.setModified(true);
    }

    if (!options?.skipBroadcast && !options?.localOnly && !this.delegate.isCollabRoomFull) {
      this.broadcastAction(action);
    }

    for (const sub of this.subscribers) {
      try {
        sub(action);
      } catch {}
    }

    if (isMutation) {
      this.debounceAutoSave();
    }

    return true;
  }

  private debounceAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.delegate.flushAutoSave();
    }, 600);
  }

  private executeAction(action: CollabAction): boolean {
    switch (action.type) {
      case 'ELEMENT_ADD': {
        this.delegate.elements.push(action.payload);
        this.delegate.renderPages();
        return true;
      }

      case 'ELEMENT_UPDATE': {
        const target = action.payload;
        const idx = this.delegate.elements.findIndex((e) => e.id === target.id);
        if (idx >= 0) {
          this.delegate.elements[idx] = { ...this.delegate.elements[idx], ...target };
          this.delegate.renderPages();
          this.delegate.updateContextToolbar();
          this.delegate.updateTransformBoxPosition();
          return true;
        }
        return false;
      }

      case 'ELEMENT_DELETE': {
        const targetId = action.payload.id;
        const prevLen = this.delegate.elements.length;
        const nextElements = this.delegate.elements.filter((e) => e.id !== targetId);
        this.delegate.elements.length = 0;
        this.delegate.elements.push(...nextElements);
        if (this.delegate.selectedElementId === targetId) {
          this.delegate.selectElement(null);
        }
        this.delegate.renderPages();
        return this.delegate.elements.length < prevLen;
      }

      case 'ELEMENT_DUPLICATE': {
        this.delegate.elements.push(action.payload);
        this.delegate.renderPages();
        this.delegate.selectElement(action.payload.id);
        return true;
      }

      case 'ELEMENT_MOVE': {
        const el = this.delegate.elements.find((e) => e.id === action.payload.id);
        if (el && 'x' in el && 'y' in el) {
          el.x = action.payload.x;
          el.y = action.payload.y;
          this.delegate.updateTransformBoxPosition();
          return true;
        }
        return false;
      }

      case 'ELEMENT_RESIZE': {
        const el = this.delegate.elements.find((e) => e.id === action.payload.id);
        if (el) {
          Object.assign(el, action.payload);
          this.delegate.updateTransformBoxPosition();
          return true;
        }
        return false;
      }

      case 'ELEMENT_ROTATE': {
        const el = this.delegate.elements.find((e) => e.id === action.payload.id);
        if (el && 'rotation' in el) {
          el.rotation = action.payload.rotation;
          this.delegate.updateTransformBoxPosition();
          return true;
        }
        return false;
      }

      case 'ELEMENT_LAYER_MOVE': {
        const moved = this.delegate.moveElementLayer(action.payload.elementId, action.payload.direction);
        if (!moved) return false;
        this.delegate.renderPages();
        this.delegate.selectElement(action.payload.elementId);
        this.delegate.renderLayersList?.();
        return true;
      }

      case 'ELEMENT_LAYER_REORDER': {
        const reordered = this.delegate.reorderElementLayer(action.payload.draggedId, action.payload.targetId);
        if (!reordered) return false;
        this.delegate.renderPages();
        this.delegate.selectElement(action.payload.draggedId);
        this.delegate.renderLayersList?.();
        return true;
      }

      case 'ELEMENT_ALIGN': {
        const aligned = this.delegate.alignElementToPage(action.payload.elementId, action.payload.alignment);
        if (!aligned) return false;
        this.delegate.renderPages();
        this.delegate.selectElement(action.payload.elementId);
        return true;
      }

      case 'ELEMENT_STYLE_UPDATE': {
        const el = this.delegate.elements.find((e) => e.id === action.payload.id);
        if (el) {
          Object.assign(el, action.payload);
          this.delegate.renderPages();
          this.delegate.updateContextToolbar();
          this.delegate.updateTransformBoxPosition();
          return true;
        }
        return false;
      }

      case 'DRAWING_ADD': {
        this.delegate.elements.push(action.payload);
        this.delegate.renderPages();
        return true;
      }

      case 'DRAWING_ERASE': {
        const eraseId = action.payload.id;
        const nextElements = this.delegate.elements.filter((e) => e.id !== eraseId);
        this.delegate.elements.length = 0;
        this.delegate.elements.push(...nextElements);
        this.delegate.renderPages();
        return true;
      }

      case 'PAGE_ADD': {
        const targetIndex = action.payload?.afterIndex !== undefined
          ? action.payload.afterIndex + 1
          : this.delegate.pageCount;
        this.delegate.elements.forEach((el) => {
          if ((el.pageIndex ?? 0) >= targetIndex) {
            el.pageIndex = (el.pageIndex ?? 0) + 1;
          }
        });
        const customDim = action.payload?.customDim;
        const inheritedDim = action.payload?.afterIndex !== undefined && this.delegate.pageSizes[action.payload.afterIndex]
          ? { ...this.delegate.pageSizes[action.payload.afterIndex] }
          : { ...this.delegate.docDefaultPageSize };
        this.delegate.pageSizes.splice(targetIndex, 0, customDim ? { ...customDim } : inheritedDim);
        this.delegate.pageTitles.splice(targetIndex, 0, '');
        this.delegate.pageBackgrounds.splice(targetIndex, 0, '#ffffff');
        this.delegate.pagePdfSources.splice(targetIndex, 0, null);
        this.delegate.pageCount++;
        this.delegate.renderPages();
        return true;
      }

      case 'PAGE_DELETE': {
        const pageIdx = action.payload.pageIndex;
        if (this.delegate.pageCount <= 1) return false;
        const nextElements = this.delegate.elements.filter((el) => (el.pageIndex ?? 0) !== pageIdx);
        this.delegate.elements.length = 0;
        this.delegate.elements.push(...nextElements);
        this.delegate.elements.forEach((el) => {
          if ((el.pageIndex ?? 0) > pageIdx) {
            el.pageIndex = (el.pageIndex ?? 0) - 1;
          }
        });
        this.delegate.pageSizes.splice(pageIdx, 1);
        this.delegate.pageTitles.splice(pageIdx, 1);
        this.delegate.pageBackgrounds.splice(pageIdx, 1);
        this.delegate.pagePdfSources.splice(pageIdx, 1);
        this.delegate.pageCount--;
        this.delegate.renderPages();
        return true;
      }

      case 'PAGE_DUPLICATE': {
        const srcIdx = action.payload.pageIndex;
        const dstIdx = srcIdx + 1;
        this.delegate.elements.forEach((el) => {
          if ((el.pageIndex ?? 0) >= dstIdx) {
            el.pageIndex = (el.pageIndex ?? 0) + 1;
          }
        });
        const pageEls = this.delegate.elements.filter((el) => (el.pageIndex ?? 0) === srcIdx);
        for (const el of pageEls) {
          const clone = JSON.parse(JSON.stringify(el));
          clone.id = `${clone.type}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
          clone.pageIndex = dstIdx;
          this.delegate.elements.push(clone);
        }
        const copyDim = this.delegate.pageSizes[srcIdx]
          ? { ...this.delegate.pageSizes[srcIdx] }
          : { ...this.delegate.docDefaultPageSize };
        this.delegate.pageSizes.splice(dstIdx, 0, copyDim);
        this.delegate.pageTitles.splice(dstIdx, 0, this.delegate.pageTitles[srcIdx] ? `${this.delegate.pageTitles[srcIdx]} (Copia)` : '');
        this.delegate.pageBackgrounds.splice(dstIdx, 0, this.delegate.pageBackgrounds[srcIdx] || '#ffffff');
        const srcPdf = this.delegate.pagePdfSources[srcIdx];
        this.delegate.pagePdfSources.splice(dstIdx, 0, srcPdf ? { ...srcPdf } : null);
        this.delegate.pageCount++;
        this.delegate.renderPages();
        return true;
      }

      case 'PAGE_MOVE': {
        const fromIdx = action.payload.fromIndex;
        const toIdx = action.payload.toIndex;
        if (fromIdx < 0 || toIdx < 0 || fromIdx >= this.delegate.pageCount || toIdx >= this.delegate.pageCount) {
          return false;
        }
        this.delegate.elements.forEach((el) => {
          if ((el.pageIndex ?? 0) === fromIdx) {
            el.pageIndex = toIdx;
          } else if ((el.pageIndex ?? 0) === toIdx) {
            el.pageIndex = fromIdx;
          }
        });
        const tmpSize = this.delegate.pageSizes[fromIdx];
        this.delegate.pageSizes[fromIdx] = this.delegate.pageSizes[toIdx];
        this.delegate.pageSizes[toIdx] = tmpSize;
        const tmpTitle = this.delegate.pageTitles[fromIdx];
        this.delegate.pageTitles[fromIdx] = this.delegate.pageTitles[toIdx];
        this.delegate.pageTitles[toIdx] = tmpTitle;
        const tmpBg = this.delegate.pageBackgrounds[fromIdx];
        this.delegate.pageBackgrounds[fromIdx] = this.delegate.pageBackgrounds[toIdx];
        this.delegate.pageBackgrounds[toIdx] = tmpBg;
        const tmpPdf = this.delegate.pagePdfSources[fromIdx];
        this.delegate.pagePdfSources[fromIdx] = this.delegate.pagePdfSources[toIdx];
        this.delegate.pagePdfSources[toIdx] = tmpPdf;
        this.delegate.renderPages();
        return true;
      }

      case 'PAGE_SET_SIZE': {
        if (action.payload.allPages) {
          this.delegate.pageSizes = Array.from({ length: this.delegate.pageCount }, () => ({ ...action.payload.dimension }));
        } else if (action.payload.pageIndex !== undefined) {
          this.delegate.pageSizes[action.payload.pageIndex] = { ...action.payload.dimension };
        }
        this.delegate.renderPages();
        return true;
      }

      case 'PAGE_SET_BG': {
        if (action.payload.pageIndex !== undefined) {
          this.delegate.pageBackgrounds[action.payload.pageIndex] = action.payload.color;
          this.delegate.renderPages();
          return true;
        }
        return false;
      }

      case 'PAGE_SET_TITLE': {
        if (action.payload.pageIndex !== undefined) {
          this.delegate.pageTitles[action.payload.pageIndex] = action.payload.title;
          return true;
        }
        return false;
      }

      case 'PAGE_TOGGLE_LOCK': {
        return true;
      }

      case 'DOC_TITLE_CHANGE': {
        this.delegate.setDocTitle(action.payload.title);
        return true;
      }

      case 'DOC_SYNC_FULL': {
        if (Array.isArray(action.payload.elements)) {
          const incoming = [...action.payload.elements];
          this.delegate.elements.length = 0;
          this.delegate.elements.push(...incoming);
        }
        if (Array.isArray(action.payload.pageBackgrounds)) {
          const incoming = [...action.payload.pageBackgrounds];
          this.delegate.pageBackgrounds.length = 0;
          this.delegate.pageBackgrounds.push(...incoming);
        }
        if (typeof action.payload.pageCount === 'number') {
          this.delegate.pageCount = action.payload.pageCount;
        }
        if (Array.isArray(action.payload.pageSizes)) {
          const incoming = [...action.payload.pageSizes];
          this.delegate.pageSizes.length = 0;
          this.delegate.pageSizes.push(...incoming);
        }
        if (typeof action.payload.title === 'string') {
          this.delegate.setDocTitle(action.payload.title);
        }
        this.delegate.renderPages();
        return true;
      }

      case 'UNDO': {
        this.delegate.undo();
        return true;
      }

      case 'REDO': {
        this.delegate.redo();
        return true;
      }

      default:
        return false;
    }
  }

  private broadcastAction(action: CollabAction): void {
    switch (action.type) {
      case 'ELEMENT_ADD':
      case 'DRAWING_ADD':
      case 'ELEMENT_DUPLICATE': {
        const el = action.payload;
        wsService.send({
          action: 'add',
          element: el,
          pageIndex: action.pageIndex ?? el.pageIndex,
          type: 'elementChange',
        });
        break;
      }

      case 'ELEMENT_UPDATE':
      case 'ELEMENT_MOVE':
      case 'ELEMENT_RESIZE':
      case 'ELEMENT_ROTATE':
      case 'ELEMENT_STYLE_UPDATE': {
        const el = action.payload;
        wsService.send({
          action: 'update',
          element: el,
          pageIndex: action.pageIndex ?? el.pageIndex,
          type: 'elementChange',
        });
        break;
      }

      case 'ELEMENT_ALIGN': {
        const elem = this.delegate.elements.find((e) => e.id === action.payload.elementId);
        if (elem) {
          wsService.send({
            action: 'update',
            element: elem,
            pageIndex: elem.pageIndex,
            type: 'elementChange',
          });
        }
        break;
      }

      case 'ELEMENT_DELETE':
      case 'DRAWING_ERASE': {
        wsService.send({
          action: 'delete',
          element: { id: action.payload.id },
          pageIndex: action.pageIndex,
          type: 'elementChange',
        });
        break;
      }

      case 'ELEMENT_LAYER_MOVE':
      case 'ELEMENT_LAYER_REORDER':
      case 'PAGE_ADD':
      case 'PAGE_DELETE':
      case 'PAGE_DUPLICATE':
      case 'PAGE_MOVE':
      case 'PAGE_SET_SIZE':
      case 'PAGE_SET_BG':
      case 'PAGE_SET_TITLE':
      case 'DOC_SYNC_FULL': {
        wsService.send({
          elements: this.delegate.elements,
          pageBackgrounds: this.delegate.pageBackgrounds,
          pageCount: this.delegate.pageCount,
          pageSize: this.delegate.docDefaultPageSize,
          pageSizes: this.delegate.pageSizes,
          title: this.delegate.docTitle,
          type: 'docSync',
        });
        break;
      }

      case 'DOC_TITLE_CHANGE': {
        wsService.send({
          title: action.payload.title,
          type: 'titleChange',
        });
        break;
      }

      default:
        break;
    }
  }
}
