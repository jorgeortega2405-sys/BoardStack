import { ManualGuide } from './collaborative-pdf.types.js';

const CM_TO_PX = 37.8;

interface RulerGuidesRenderOptions {
  activePageIndex?: number;
  container: HTMLElement;
  draggingGuide?: ManualGuide | null;
  guides: ManualGuide[];
  hoveredGuideId?: string | null;
  removingGuideId?: string | null;
  selectedGuideId: string | null;
  showRulersAndGuides: boolean;
  zoomLevel: number;
}

interface RulerGuidesInteractionOptions {
  canEdit: () => boolean;
  container: HTMLElement;
  getActivePageIndex: () => number;
  getGuides: () => ManualGuide[];
  getPageDimensions: (pageIndex: number) => { height: number; width: number };
  getSelectedGuideId: () => string | null;
  getShowRulers: () => boolean;
  getZoom: () => number;
  onChange: (nextGuides: ManualGuide[], selectedId: string | null, commit: boolean) => void;
  onSelect: (selectedId: string | null) => void;
}

interface RulerGuidesController {
  destroy: () => void;
  setPassthrough: (passthrough: boolean) => void;
  sync: (guides?: ManualGuide[], selectedId?: string | null) => void;
}

function getPrimaryReferenceSheet(
  container: HTMLElement,
  workspace: HTMLElement,
  activePageIndex = 0
): HTMLElement | null {
  const sheets = Array.from(container.querySelectorAll<HTMLElement>('.collaborative-page-sheet'));
  if (sheets.length === 0) return null;

  const wsRect = workspace.getBoundingClientRect();
  const visibleTop = wsRect.top + 20;
  let bestSheet: HTMLElement | null = null;
  let bestOverlap = -1;

  for (const sheet of sheets) {
    const rect = sheet.getBoundingClientRect();
    const overlap = Math.min(rect.bottom, wsRect.bottom) - Math.max(rect.top, visibleTop);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestSheet = sheet;
    }
  }

  if (bestSheet && bestOverlap > 0) {
    return bestSheet;
  }

  return (
    container.querySelector<HTMLElement>(`[data-ref="page-sheet-${activePageIndex}"]`) ||
    sheets[0]
  );
}

function resolveTargetPageForY(
  container: HTMLElement,
  workspace: HTMLElement,
  clientY: number,
  fallbackPageIndex: number
): { pageIndex: number; sheet: HTMLElement } | null {
  const sheets = Array.from(container.querySelectorAll<HTMLElement>('.collaborative-page-sheet'));
  if (sheets.length === 0) return null;

  for (const sheet of sheets) {
    const rect = sheet.getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) {
      const idx = parseInt(sheet.getAttribute('data-page-index') || '0', 10);
      return { pageIndex: isNaN(idx) ? 0 : idx, sheet };
    }
  }

  let closest: HTMLElement | null = null;
  let minDist = Infinity;
  for (const sheet of sheets) {
    const rect = sheet.getBoundingClientRect();
    const dist = clientY < rect.top ? rect.top - clientY : clientY - rect.bottom;
    if (dist < minDist) {
      minDist = dist;
      closest = sheet;
    }
  }

  const chosen = closest || getPrimaryReferenceSheet(container, workspace, fallbackPageIndex) || sheets[0];
  const idx = parseInt(chosen.getAttribute('data-page-index') || '0', 10);
  return { pageIndex: isNaN(idx) ? 0 : idx, sheet: chosen };
}

function updateRulers(
  container: HTMLElement,
  showRulersAndGuides: boolean,
  zoomLevel = 1.0,
  activePageIndex = 0
): void {
  if (!showRulersAndGuides) return;
  const workspace = container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
  const canvasTop = container.querySelector<HTMLCanvasElement>('[data-ref="ruler-top"]');
  const canvasLeft = container.querySelector<HTMLCanvasElement>('[data-ref="ruler-left"]');
  if (!workspace || !canvasTop || !canvasLeft) return;

  const refSheet = getPrimaryReferenceSheet(container, workspace, activePageIndex);
  if (!refSheet) return;

  const wsRect = workspace.getBoundingClientRect();
  const pageRect = refSheet.getBoundingClientRect();

  const dpr = window.devicePixelRatio || 1;
  const topW = Math.max(100, Math.round(wsRect.width - 20));
  const leftH = Math.max(100, Math.round(wsRect.height - 20));

  if (canvasTop.width !== Math.round(topW * dpr) || canvasTop.height !== Math.round(20 * dpr)) {
    canvasTop.width = Math.round(topW * dpr);
    canvasTop.height = Math.round(20 * dpr);
    canvasTop.style.width = `${topW}px`;
    canvasTop.style.height = '20px';
  }
  if (canvasLeft.width !== Math.round(20 * dpr) || canvasLeft.height !== Math.round(leftH * dpr)) {
    canvasLeft.width = Math.round(20 * dpr);
    canvasLeft.height = Math.round(leftH * dpr);
    canvasLeft.style.width = '20px';
    canvasLeft.style.height = `${leftH}px`;
  }

  const ctxTop = canvasTop.getContext('2d');
  const ctxLeft = canvasLeft.getContext('2d');
  if (!ctxTop || !ctxLeft) return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bgFill = isDark ? '#1e293b' : '#f3f4f7';
  const textFill = isDark ? '#94a3b8' : '#6b7280';
  const strokeLine = isDark ? '#475569' : '#9ca3af';

  ctxTop.save();
  ctxTop.scale(dpr, dpr);
  ctxTop.clearRect(0, 0, topW, 20);
  ctxTop.fillStyle = bgFill;
  ctxTop.fillRect(0, 0, topW, 20);

  const cmPx = CM_TO_PX * (zoomLevel || 1.0);
  const originX = (pageRect.left - wsRect.left) - 20;

  ctxTop.fillStyle = textFill;
  ctxTop.strokeStyle = strokeLine;
  ctxTop.lineWidth = 1;
  ctxTop.font = '9px system-ui, sans-serif';
  ctxTop.textAlign = 'center';

  const startCm = Math.floor(-originX / cmPx) - 2;
  const endCm = Math.ceil((topW - originX) / cmPx) + 2;

  for (let cm = startCm; cm <= endCm; cm++) {
    const x = originX + cm * cmPx;
    if (x < 0 || x > topW) continue;

    if (cm % 2 === 0) {
      ctxTop.beginPath();
      ctxTop.moveTo(x, 8);
      ctxTop.lineTo(x, 20);
      ctxTop.stroke();
      if (cm >= 0 && x > 25) {
        ctxTop.fillText(cm.toString(), x, 7);
      }
    } else {
      ctxTop.beginPath();
      ctxTop.moveTo(x, 12);
      ctxTop.lineTo(x, 20);
      ctxTop.stroke();
    }

    for (let sub = 1; sub < 5; sub++) {
      const subX = x + (sub * 0.2) * cmPx;
      if (subX >= 0 && subX <= topW) {
        ctxTop.beginPath();
        ctxTop.moveTo(subX, 16);
        ctxTop.lineTo(subX, 20);
        ctxTop.stroke();
      }
    }
  }
  ctxTop.restore();

  ctxLeft.save();
  ctxLeft.scale(dpr, dpr);
  ctxLeft.clearRect(0, 0, 20, leftH);
  ctxLeft.fillStyle = bgFill;
  ctxLeft.fillRect(0, 0, 20, leftH);

  const originY = (pageRect.top - wsRect.top) - 20;
  ctxLeft.fillStyle = textFill;
  ctxLeft.strokeStyle = strokeLine;
  ctxLeft.lineWidth = 1;
  ctxLeft.font = '9px system-ui, sans-serif';
  ctxLeft.textAlign = 'right';

  const startCmY = Math.floor(-originY / cmPx) - 2;
  const endCmY = Math.ceil((leftH - originY) / cmPx) + 2;

  for (let cm = startCmY; cm <= endCmY; cm++) {
    const y = originY + cm * cmPx;
    if (y < 0 || y > leftH) continue;

    if (cm % 2 === 0) {
      ctxLeft.beginPath();
      ctxLeft.moveTo(8, y);
      ctxLeft.lineTo(20, y);
      ctxLeft.stroke();
      if (cm >= 0 && y > 25) {
        ctxLeft.fillText(cm.toString(), 7, y + 3);
      }
    } else {
      ctxLeft.beginPath();
      ctxLeft.moveTo(12, y);
      ctxLeft.lineTo(20, y);
      ctxLeft.stroke();
    }

    for (let sub = 1; sub < 5; sub++) {
      const subY = y + (sub * 0.2) * cmPx;
      if (subY >= 0 && subY <= leftH) {
        ctxLeft.beginPath();
        ctxLeft.moveTo(16, subY);
        ctxLeft.lineTo(20, subY);
        ctxLeft.stroke();
      }
    }
  }
  ctxLeft.restore();
}

function renderManualGuides(options: RulerGuidesRenderOptions): void {
  const {
    activePageIndex = 0,
    container,
    draggingGuide = null,
    guides,
    hoveredGuideId = null,
    removingGuideId = null,
    selectedGuideId,
    showRulersAndGuides,
    zoomLevel,
  } = options;

  const wrapper = container.querySelector<HTMLElement>('[data-ref="collab-rulers-wrapper"]');
  const layer = container.querySelector<HTMLElement>('[data-ref="collab-ruler-guides-layer"]');
  const badgeTop = container.querySelector<HTMLElement>('[data-ref="ruler-badge-top"]');
  const badgeLeft = container.querySelector<HTMLElement>('[data-ref="ruler-badge-left"]');
  const workspace = container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');

  if (!wrapper || !layer || !workspace) return;

  if (!showRulersAndGuides) {
    layer.innerHTML = '';
    badgeTop?.classList.add('is-hidden');
    badgeLeft?.classList.add('is-hidden');
    return;
  }

  const scrollbarW = Math.max(0, workspace.offsetWidth - workspace.clientWidth);
  const scrollbarH = Math.max(0, workspace.offsetHeight - workspace.clientHeight);
  layer.style.right = `${scrollbarW}px`;
  layer.style.bottom = `${scrollbarH}px`;

  const wrapperRect = wrapper.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  const zoom = zoomLevel || 1.0;
  const fallbackSheet = getPrimaryReferenceSheet(container, workspace, activePageIndex);

  const itemsToRender: ManualGuide[] = [];
  let replacedByDrag = false;
  for (const g of guides) {
    if (draggingGuide && g.id === draggingGuide.id) {
      itemsToRender.push(draggingGuide);
      replacedByDrag = true;
    } else {
      itemsToRender.push(g);
    }
  }
  if (draggingGuide && !replacedByDrag) {
    itemsToRender.push(draggingGuide);
  }

  const existingNodes = new Map<string, HTMLElement>();
  layer.querySelectorAll<HTMLElement>('.collab-manual-guide').forEach((node) => {
    const id = node.getAttribute('data-guide-id');
    if (id) existingNodes.set(id, node);
  });

  const keepIds = new Set<string>();
  const activeBadgeId = draggingGuide?.id || hoveredGuideId || selectedGuideId;
  let shownTopBadge = false;
  let shownLeftBadge = false;

  for (const guide of itemsToRender) {
    const sheet =
      container.querySelector<HTMLElement>(`[data-ref="page-sheet-${guide.pageIndex}"]`) ||
      fallbackSheet;
    if (!sheet) continue;

    keepIds.add(guide.id);
    let node = existingNodes.get(guide.id);
    if (!node) {
      node = document.createElement('div');
      node.setAttribute('data-guide-id', guide.id);
      layer.appendChild(node);
    }

    const isDragging = draggingGuide?.id === guide.id;
    const isRemoving = removingGuideId === guide.id;
    const isSelected = selectedGuideId === guide.id;

    node.className = [
      'collab-manual-guide',
      guide.orientation === 'h' ? 'collab-manual-guide--h' : 'collab-manual-guide--v',
      isSelected ? 'is-selected' : '',
      isDragging ? 'is-dragging' : '',
      isRemoving ? 'is-removing' : '',
    ].filter(Boolean).join(' ');
    node.setAttribute('data-orientation', guide.orientation);

    const sheetRect = sheet.getBoundingClientRect();
    const cmText = (guide.position / CM_TO_PX).toFixed(1);

    if (guide.orientation === 'h') {
      const viewportY = sheetRect.top + guide.position * zoom;
      const layerY = viewportY - layerRect.top;
      node.style.left = '';
      node.style.top = `${layerY.toFixed(1)}px`;
      const outOfBounds = layerY < -4 || layerY > layerRect.height + 4;
      node.classList.toggle('is-hidden', outOfBounds && !isDragging);

      if (guide.id === activeBadgeId && badgeLeft) {
        const badgeTopPos = Math.max(34, Math.min(wrapperRect.height - scrollbarH - 16, viewportY - wrapperRect.top));
        badgeLeft.textContent = cmText;
        badgeLeft.style.top = `${badgeTopPos.toFixed(1)}px`;
        badgeLeft.classList.toggle('is-removing', isRemoving);
        badgeLeft.classList.remove('is-hidden');
        shownLeftBadge = true;
      }
    } else {
      const viewportX = sheetRect.left + guide.position * zoom;
      const layerX = viewportX - layerRect.left;
      node.style.top = '';
      node.style.left = `${layerX.toFixed(1)}px`;
      const outOfBounds = layerX < -4 || layerX > layerRect.width + 4;
      node.classList.toggle('is-hidden', outOfBounds && !isDragging);

      if (guide.id === activeBadgeId && badgeTop) {
        const badgeLeftPos = Math.max(34, Math.min(wrapperRect.width - scrollbarW - 18, viewportX - wrapperRect.left));
        badgeTop.textContent = cmText;
        badgeTop.style.left = `${badgeLeftPos.toFixed(1)}px`;
        badgeTop.classList.toggle('is-removing', isRemoving);
        badgeTop.classList.remove('is-hidden');
        shownTopBadge = true;
      }
    }
  }

  for (const [id, node] of existingNodes.entries()) {
    if (!keepIds.has(id)) {
      node.remove();
    }
  }

  if (!shownTopBadge && badgeTop) {
    badgeTop.classList.add('is-hidden');
    badgeTop.classList.remove('is-removing');
  }
  if (!shownLeftBadge && badgeLeft) {
    badgeLeft.classList.add('is-hidden');
    badgeLeft.classList.remove('is-removing');
  }
}

function initRulerGuidesInteraction(options: RulerGuidesInteractionOptions): RulerGuidesController {
  const {
    canEdit,
    container,
    getActivePageIndex,
    getGuides,
    getPageDimensions,
    getSelectedGuideId,
    getShowRulers,
    getZoom,
    onChange,
    onSelect,
  } = options;

  const wrapper = container.querySelector<HTMLElement>('[data-ref="collab-rulers-wrapper"]');
  const rulerTop = container.querySelector<HTMLElement>('[data-ref="ruler-top"]');
  const rulerLeft = container.querySelector<HTMLElement>('[data-ref="ruler-left"]');
  const layer = container.querySelector<HTMLElement>('[data-ref="collab-ruler-guides-layer"]');
  const workspace = container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');

  let hoveredGuideId: string | null = null;
  let activeDrag: {
    draft: ManualGuide;
    hasEnteredCanvas: boolean;
    isNew: boolean;
    moved: boolean;
    removing: boolean;
  } | null = null;
  let cleanupDragListeners: (() => void) | null = null;
  const ac = new AbortController();

  const getVisibleDraggingGuide = (): ManualGuide | null => {
    if (!activeDrag) return null;
    if (activeDrag.isNew && !activeDrag.hasEnteredCanvas) return null;
    return activeDrag.draft;
  };

  const renderOverlay = () => {
    renderManualGuides({
      activePageIndex: getActivePageIndex(),
      container,
      draggingGuide: getVisibleDraggingGuide(),
      guides: getGuides(),
      hoveredGuideId,
      removingGuideId: activeDrag?.removing ? activeDrag.draft.id : null,
      selectedGuideId: getSelectedGuideId(),
      showRulersAndGuides: getShowRulers(),
      zoomLevel: getZoom(),
    });
  };

  const beginDrag = (draft: ManualGuide, isNew: boolean, startX: number, startY: number) => {
    cleanupDragListeners?.();
    activeDrag = {
      draft: { ...draft },
      hasEnteredCanvas: !isNew,
      isNew,
      moved: false,
      removing: false,
    };

    const bodyClass = draft.orientation === 'h' ? 'is-dragging-guide-h' : 'is-dragging-guide-v';
    document.body.classList.add(bodyClass);

    if (!isNew) {
      onSelect(draft.id);
    }
    renderOverlay();

    const updateFromPointer = (clientX: number, clientY: number) => {
      if (!activeDrag || !wrapper || !workspace) return;
      if (Math.hypot(clientX - startX, clientY - startY) >= 2) {
        activeDrag.moved = true;
      }

      const wrapperRect = wrapper.getBoundingClientRect();
      const zoom = getZoom() || 1.0;

      if (activeDrag.draft.orientation === 'h') {
        const insideCanvas = clientY > wrapperRect.top + 20;
        if (insideCanvas) {
          activeDrag.hasEnteredCanvas = true;
        }
        const resolved = resolveTargetPageForY(container, workspace, clientY, activeDrag.draft.pageIndex);
        if (resolved) {
          const dim = getPageDimensions(resolved.pageIndex);
          const rect = resolved.sheet.getBoundingClientRect();
          const rawPos = (clientY - rect.top) / zoom;
          const clamped = Math.max(0, Math.min(dim.height, rawPos));
          activeDrag.draft.pageIndex = resolved.pageIndex;
          activeDrag.draft.position = Math.round(clamped * 2) / 2;
        }
        activeDrag.removing = !insideCanvas;
      } else {
        const insideCanvas = clientX > wrapperRect.left + 20;
        if (insideCanvas) {
          activeDrag.hasEnteredCanvas = true;
        }
        const sheet =
          container.querySelector<HTMLElement>(`[data-ref="page-sheet-${activeDrag.draft.pageIndex}"]`) ||
          getPrimaryReferenceSheet(container, workspace, getActivePageIndex());
        if (sheet) {
          const sheetIdx = parseInt(sheet.getAttribute('data-page-index') || '0', 10);
          const safeIdx = isNaN(sheetIdx) ? 0 : sheetIdx;
          const dim = getPageDimensions(safeIdx);
          const rect = sheet.getBoundingClientRect();
          const rawPos = (clientX - rect.left) / zoom;
          const clamped = Math.max(0, Math.min(dim.width, rawPos));
          activeDrag.draft.pageIndex = safeIdx;
          activeDrag.draft.position = Math.round(clamped * 2) / 2;
        }
        activeDrag.removing = !insideCanvas;
      }

      renderOverlay();
    };

    const finishDrag = (commit: boolean, clientX: number, clientY: number) => {
      document.body.classList.remove(bodyClass);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      cleanupDragListeners = null;

      const finished = activeDrag;
      activeDrag = null;
      if (!finished) return;

      if (!commit || !wrapper) {
        renderOverlay();
        return;
      }

      const wrapperRect = wrapper.getBoundingClientRect();
      const inDeleteZone = finished.draft.orientation === 'h'
        ? clientY <= wrapperRect.top + 20
        : clientX <= wrapperRect.left + 20;

      const currentGuides = getGuides();
      if (finished.isNew) {
        if (!inDeleteZone && (finished.hasEnteredCanvas || finished.moved)) {
          const next = [...currentGuides, { ...finished.draft }];
          onChange(next, finished.draft.id, true);
        } else {
          renderOverlay();
        }
      } else if (inDeleteZone) {
        const next = currentGuides.filter((g) => g.id !== finished.draft.id);
        onChange(next, null, true);
      } else if (finished.moved) {
        const next = currentGuides.map((g) => (g.id === finished.draft.id ? { ...finished.draft } : g));
        onChange(next, finished.draft.id, true);
      } else {
        onSelect(finished.draft.id);
        renderOverlay();
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      updateFromPointer(ev.clientX, ev.clientY);
    };

    const onPointerUp = (ev: PointerEvent) => {
      finishDrag(true, ev.clientX, ev.clientY);
    };

    const onPointerCancel = () => {
      finishDrag(false, startX, startY);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    cleanupDragListeners = () => {
      document.body.classList.remove(bodyClass);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      activeDrag = null;
    };
  };

  rulerTop?.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 || !getShowRulers() || !canEdit()) return;
    e.preventDefault();
    e.stopPropagation();
    const id = `guide_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    beginDrag({ id, orientation: 'h', pageIndex: getActivePageIndex(), position: 0 }, true, e.clientX, e.clientY);
  }, { signal: ac.signal });

  rulerLeft?.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 || !getShowRulers() || !canEdit()) return;
    e.preventDefault();
    e.stopPropagation();
    const id = `guide_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const targetPage = workspace
      ? parseInt(getPrimaryReferenceSheet(container, workspace, getActivePageIndex())?.getAttribute('data-page-index') || String(getActivePageIndex()), 10)
      : getActivePageIndex();
    beginDrag({ id, orientation: 'v', pageIndex: isNaN(targetPage) ? 0 : targetPage, position: 0 }, true, e.clientX, e.clientY);
  }, { signal: ac.signal });

  layer?.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 || !getShowRulers() || !canEdit()) return;
    const guideNode = (e.target as HTMLElement)?.closest<HTMLElement>('.collab-manual-guide');
    if (!guideNode) return;
    const guideId = guideNode.getAttribute('data-guide-id');
    const existing = guideId ? getGuides().find((g) => g.id === guideId) : null;
    if (!existing) return;
    e.preventDefault();
    e.stopPropagation();
    beginDrag(existing, false, e.clientX, e.clientY);
  }, { signal: ac.signal });

  layer?.addEventListener('pointerover', (e: PointerEvent) => {
    if (activeDrag || !getShowRulers()) return;
    const guideNode = (e.target as HTMLElement)?.closest<HTMLElement>('.collab-manual-guide');
    const guideId = guideNode?.getAttribute('data-guide-id') || null;
    if (guideId && hoveredGuideId !== guideId) {
      hoveredGuideId = guideId;
      renderOverlay();
    }
  }, { signal: ac.signal });

  layer?.addEventListener('pointerout', (e: PointerEvent) => {
    if (activeDrag || !getShowRulers()) return;
    const related = (e.relatedTarget as HTMLElement)?.closest<HTMLElement>('.collab-manual-guide');
    const nextId = related?.getAttribute('data-guide-id') || null;
    if (hoveredGuideId !== nextId) {
      hoveredGuideId = nextId;
      renderOverlay();
    }
  }, { signal: ac.signal });

  return {
    destroy: () => {
      cleanupDragListeners?.();
      ac.abort();
      hoveredGuideId = null;
    },
    setPassthrough: (passthrough: boolean) => {
      layer?.classList.toggle('is-passthrough', passthrough);
    },
    sync: (guides?: ManualGuide[], selectedId?: string | null) => {
      renderManualGuides({
        activePageIndex: getActivePageIndex(),
        container,
        draggingGuide: getVisibleDraggingGuide(),
        guides: guides ?? getGuides(),
        hoveredGuideId,
        removingGuideId: activeDrag?.removing ? activeDrag.draft.id : null,
        selectedGuideId: selectedId !== undefined ? selectedId : getSelectedGuideId(),
        showRulersAndGuides: getShowRulers(),
        zoomLevel: getZoom(),
      });
    },
  };
}

function renderPersistentGuidesSvg(
  pageIndex: number,
  width: number,
  height: number,
  currentGuidesPreset: '12-col' | '3-col' | '3x3' | 'custom' | null,
  customGuideCols: number,
  customGuideRows: number
): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'collaborative-persistent-guides-svg');
  svg.setAttribute('data-ref', `persistent-guides-svg-${pageIndex}`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  if (currentGuidesPreset === '12-col') {
    const margin = 38;
    const gutter = 16;
    const totalGutters = 11 * gutter;
    const availableWidth = width - 2 * margin - totalGutters;
    const colWidth = Math.max(1, availableWidth / 12);

    for (let i = 0; i < 12; i++) {
      const x1 = margin + i * (colWidth + gutter);
      const x2 = x1 + colWidth;

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('class', 'collaborative-persistent-guide-line');
      line1.setAttribute('x1', x1.toFixed(1));
      line1.setAttribute('y1', '0');
      line1.setAttribute('x2', x1.toFixed(1));
      line1.setAttribute('y2', height.toString());
      svg.appendChild(line1);

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('class', 'collaborative-persistent-guide-line');
      line2.setAttribute('x1', x2.toFixed(1));
      line2.setAttribute('y1', '0');
      line2.setAttribute('x2', x2.toFixed(1));
      line2.setAttribute('y2', height.toString());
      svg.appendChild(line2);
    }
  } else if (currentGuidesPreset === '3-col') {
    const margin = 38;
    const gutter = 24;
    const availableWidth = width - 2 * margin - 2 * gutter;
    const colWidth = Math.max(1, availableWidth / 3);

    for (let i = 0; i < 3; i++) {
      const x1 = margin + i * (colWidth + gutter);
      const x2 = x1 + colWidth;

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('class', 'collaborative-persistent-guide-line');
      line1.setAttribute('x1', x1.toFixed(1));
      line1.setAttribute('y1', '0');
      line1.setAttribute('x2', x1.toFixed(1));
      line1.setAttribute('y2', height.toString());
      svg.appendChild(line1);

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('class', 'collaborative-persistent-guide-line');
      line2.setAttribute('x1', x2.toFixed(1));
      line2.setAttribute('y1', '0');
      line2.setAttribute('x2', x2.toFixed(1));
      line2.setAttribute('y2', height.toString());
      svg.appendChild(line2);
    }
  } else if (currentGuidesPreset === '3x3') {
    const y1 = (height / 3).toFixed(1);
    const y2 = ((2 * height) / 3).toFixed(1);
    const x1 = (width / 3).toFixed(1);
    const x2 = ((2 * width) / 3).toFixed(1);

    for (const y of [y1, y2]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'collaborative-persistent-guide-line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y);
      line.setAttribute('x2', width.toString());
      line.setAttribute('y2', y);
      svg.appendChild(line);
    }

    for (const x of [x1, x2]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'collaborative-persistent-guide-line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', '0');
      line.setAttribute('x2', x);
      line.setAttribute('y2', height.toString());
      svg.appendChild(line);
    }
  } else if (currentGuidesPreset === 'custom') {
    const cols = Math.max(1, customGuideCols);
    const rows = Math.max(1, customGuideRows);

    for (let i = 1; i < cols; i++) {
      const x = ((i * width) / cols).toFixed(1);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'collaborative-persistent-guide-line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', '0');
      line.setAttribute('x2', x);
      line.setAttribute('y2', height.toString());
      svg.appendChild(line);
    }

    for (let j = 1; j < rows; j++) {
      const y = ((j * height) / rows).toFixed(1);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'collaborative-persistent-guide-line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y);
      line.setAttribute('x2', width.toString());
      line.setAttribute('y2', y);
      svg.appendChild(line);
    }
  }

  return svg;
}

export { initRulerGuidesInteraction, renderManualGuides, renderPersistentGuidesSvg, updateRulers };
export type { RulerGuidesController, RulerGuidesInteractionOptions, RulerGuidesRenderOptions };
