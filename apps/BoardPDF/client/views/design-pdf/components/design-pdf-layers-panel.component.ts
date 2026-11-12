import { t } from '../../../services/i18n.service.js';
import { EditorElement } from '../types/design-pdf.types.js';

interface CollabLayersPanelOptions {
  container: HTMLElement;
  elements: EditorElement[];
  isLayersPanelOpen: boolean;
  onDeleteElement: (id: string) => void;
  onMoveLayer: (id: string, direction: 'backward' | 'forward') => void;
  onReorderLayer: (draggedId: string, targetId: string) => void;
  onSelectElement: (id: string) => void;
  selectedElementId: string | null;
  selectedPageIndex: number | null;
}

function renderLayersList(options: CollabLayersPanelOptions): void {
  const {
    container,
    elements,
    isLayersPanelOpen,
    onDeleteElement,
    onMoveLayer,
    onReorderLayer,
    onSelectElement,
    selectedElementId,
    selectedPageIndex,
  } = options;

  if (!isLayersPanelOpen) return;
  const listEl = container.querySelector<HTMLElement>('[data-ref="collab-layers-list"]');
  if (!listEl) return;

  let targetPage = selectedPageIndex;
  if (targetPage === null && selectedElementId) {
    const curElem = elements.find((el) => el.id === selectedElementId);
    targetPage = curElem?.pageIndex ?? 0;
  }
  if (targetPage === null) targetPage = 0;

  const pageBadge = container.querySelector<HTMLElement>('[data-ref="txt-layers-page-badge"]');
  if (pageBadge) {
    pageBadge.textContent = t('common.page_n', { page: targetPage + 1 });
  }

  listEl.innerHTML = '';
  const pageElements = elements.filter((el) => (el.pageIndex ?? 0) === targetPage);

  if (pageElements.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'collab-layers-empty';
    emptyDiv.textContent = t('ui.no_hay_elementos_en_esta_pagina');
    listEl.appendChild(emptyDiv);
    return;
  }

  const reversed = [...pageElements].reverse();

  reversed.forEach((el, revIndex) => {
    const layerNum = pageElements.length - revIndex;
    const isSelected = el.id === selectedElementId;

    let iconName = 'apps';
    let nameText = t('collaborative.layer_element');

    if (el.type === 'text') {
      iconName = 'text_fields';
      const txt = (el as any).text?.trim();
      nameText = txt ? (txt.length > 22 ? `${txt.substring(0, 22)}...` : txt) : t('collaborative.elements_text');
    } else if (el.type === 'shape') {
      iconName = 'apps';
      const st = (el as any).shapeType || 'forma';
      const map: Record<string, string> = {
        arrow: 'Flecha',
        circle: t('collaborative.shape_circle'),
        diamond: 'Rombo',
        line: t('collaborative.shape_line_solid'),
        'line-flexible': t('collaborative.line_flexible'),
        'line-multiconnect': 'Conector',
        rect: t('collaborative.shape_rect'),
        roundedRect: t('collaborative.shape_rounded_rect'),
        star: 'Estrella',
        triangle: t('collaborative.shape_triangle'),
      };
      nameText = map[st] || `Forma (${st})`;
    } else if (el.type === 'image') {
      iconName = 'photo_library';
      nameText = t('collaborative.tab_images');
    } else if (el.type === 'table') {
      iconName = 'table_chart';
      nameText = t('collaborative.elements_tables');
    } else if (el.type === 'chart') {
      iconName = 'bar_chart';
      nameText = t('collaborative.elements_charts');
    }

    const item = document.createElement('div');
    item.className = `collab-layer-item${isSelected ? ' is-active' : ''}`;
    item.setAttribute('data-layer-id', el.id);
    item.draggable = true;

    const isTop = revIndex === 0;
    const isBottom = revIndex === reversed.length - 1;

    item.innerHTML = `
      <div class="collab-layer-item__drag" title="${t('collaborative.drag_reorder_layer')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#swap_vert"></use></svg>
      </div>
      <div class="collab-layer-item__icon">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${iconName}"></use></svg>
      </div>
      <div class="collab-layer-item__content">
        <span class="collab-layer-item__name">${nameText}</span>
        <span class="collab-layer-item__badge">${t('collaborative.layer')} ${layerNum}</span>
      </div>
      <div class="collab-layer-item__actions">
        <button type="button" class="collab-layer-btn" data-layer-action="up" data-element-id="${el.id}" title="${t('collaborative.layer_up')}" aria-label="${t('collaborative.layer_up')}"${isTop ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#expand_less"></use></svg>
        </button>
        <button type="button" class="collab-layer-btn" data-layer-action="down" data-element-id="${el.id}" title="${t('collaborative.layer_down')}" aria-label="${t('collaborative.layer_down')}"${isBottom ? ' disabled' : ''}>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
        <button type="button" class="collab-layer-btn" data-layer-action="delete" data-element-id="${el.id}" title="${t('collaborative.delete_element')}" aria-label="${t('collaborative.delete_element')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
        </button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-layer-action]');
      if (btn) return;
      onSelectElement(el.id);
    });

    item.addEventListener('dragstart', (e: DragEvent) => {
      item.classList.add('is-dragging');
      e.dataTransfer?.setData('text/plain', el.id);
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('is-dragging');
    });

    item.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
    });

    item.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const draggedId = e.dataTransfer?.getData('text/plain');
      if (draggedId && draggedId !== el.id) {
        onReorderLayer(draggedId, el.id);
      }
    });

    const btnUp = item.querySelector<HTMLButtonElement>('[data-layer-action="up"]');
    btnUp?.addEventListener('click', (e) => {
      e.stopPropagation();
      onMoveLayer(el.id, 'forward');
    });

    const btnDown = item.querySelector<HTMLButtonElement>('[data-layer-action="down"]');
    btnDown?.addEventListener('click', (e) => {
      e.stopPropagation();
      onMoveLayer(el.id, 'backward');
    });

    const btnDel = item.querySelector<HTMLButtonElement>('[data-layer-action="delete"]');
    btnDel?.addEventListener('click', (e) => {
      e.stopPropagation();
      onDeleteElement(el.id);
    });

    listEl.appendChild(item);
  });
}

export { renderLayersList };
export type { CollabLayersPanelOptions };
