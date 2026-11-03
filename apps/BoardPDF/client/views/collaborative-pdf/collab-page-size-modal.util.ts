import { openModal } from '../../components/modal.component.js';
import { COLLAB_PAGE_PRESETS, PageDimension } from '../../config/collab-page-presets.config.js';
import { renderIcons } from '../../services/icon.service.js';
import { setupDropdown } from '../../utils/dom.util.js';

export interface CollabPageSizeResult {
  applyToAll?: boolean;
  dimensions: PageDimension;
  title?: string;
}

export interface CollabPageSizeModalOptions {
  currentDimensions?: PageDimension;
  initialTitle?: string;
  mode?: 'create' | 'resize';
  onConfirm: (result: CollabPageSizeResult) => Promise<void> | void;
  pageIndex?: number;
}

export function openCollabPageSizeModal(options: CollabPageSizeModalOptions): void {
  const initialDim = options.currentDimensions || { height: 1123, width: 794 };

  const matchingPreset = COLLAB_PAGE_PRESETS.find((p) => {
    return (p.width === initialDim.width && p.height === initialDim.height) ||
      (p.width === initialDim.height && p.height === initialDim.width);
  });

  let selectedPresetId = matchingPreset?.id || 'a4';
  const initialPreset = COLLAB_PAGE_PRESETS.find((p) => p.id === selectedPresetId) || COLLAB_PAGE_PRESETS[0];

  const modalBody = document.createElement('div');
  modalBody.className = 'collab-page-size-form';
  modalBody.setAttribute('data-ref', 'collab-page-size-form');

  modalBody.innerHTML = `
    <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-paper-size">
      <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-paper-size" aria-label="Seleccionar tamaño de papel">
        <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-paper-size">
          <svg class="component-icon dropdown-trigger__icon" data-ref="icon-paper-size" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
          <span class="dropdown-trigger__text" data-ref="txt-selected-paper-size">${initialPreset.name} (${initialPreset.description})</span>
        </div>
        <svg class="component-icon dropdown-trigger__chevron" data-ref="icon-paper-size-chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
      </button>

      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-paper-size"></div>
      <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-paper-size">
        <div class="menu-panel__list" data-ref="list-paper-size">
          ${COLLAB_PAGE_PRESETS.map((p) => `
            <button type="button" class="menu-item ${p.id === selectedPresetId ? 'is-selected' : ''}" data-ref="item-size-${p.id}" data-preset-id="${p.id}">
              <div class="menu-item__icon-wrapper">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
              </div>
              <div class="menu-item__text-group">
                <span class="menu-item__title">${p.name}</span>
                <span class="menu-item__subtitle">${p.description}</span>
              </div>
              <svg class="component-icon menu-item__check ${p.id === selectedPresetId ? '' : 'is-hidden'}" data-ref="check-size-${p.id}" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
            </button>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="collab-page-size-checkbox-wrap" data-ref="wrap-apply-all">
      <label class="collab-resize-checkbox-label" data-ref="label-apply-all">
        <input class="checkbox" data-ref="chk-apply-all" type="checkbox" />
        <span>Aplicar a todas las páginas</span>
      </label>
    </div>
  `;

  renderIcons(modalBody);

  const dropdownWrapper = modalBody.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-paper-size"]');
  const btnTrigger = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-paper-size"]');
  const txtSelectedSize = modalBody.querySelector<HTMLElement>('[data-ref="txt-selected-paper-size"]');
  const chkApplyAll = modalBody.querySelector<HTMLInputElement>('[data-ref="chk-apply-all"]');

  const dropdownCtrl = setupDropdown(dropdownWrapper, {
    backdrop: dropdownWrapper?.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-paper-size"]'),
    menu: dropdownWrapper?.querySelector<HTMLElement>('[data-ref="dropdown-menu-paper-size"]'),
    onSelect: (_val, item) => {
      if (!item) return;
      const pid = item.getAttribute('data-preset-id') || 'a4';
      selectedPresetId = pid;
      const p = COLLAB_PAGE_PRESETS.find((x) => x.id === pid) || COLLAB_PAGE_PRESETS[0];
      if (txtSelectedSize) {
        txtSelectedSize.textContent = `${p.name} (${p.description})`;
      }
      const items = modalBody.querySelectorAll<HTMLElement>('[data-preset-id]');
      items.forEach((it) => {
        const isCurrent = it.getAttribute('data-preset-id') === pid;
        it.classList.toggle('is-selected', isCurrent);
        const checkIcon = it.querySelector<HTMLElement>('.menu-item__check');
        checkIcon?.classList.toggle('is-hidden', !isCurrent);
      });
    },
    placement: 'bottom-start',
    trigger: btnTrigger,
  });

  const pageNum = (options.pageIndex ?? 0) + 1;
  openModal({
    bodyHtml: modalBody,
    cancelText: 'Cancelar',
    confirmClass: 'component-button--black',
    confirmText: 'Aplicar tamaño',
    description: 'Selecciona el formato de papel estándar para tu documento.',
    onClose: () => {
      dropdownCtrl.destroy();
    },
    onConfirm: async () => {
      const preset = COLLAB_PAGE_PRESETS.find((p) => p.id === selectedPresetId) || COLLAB_PAGE_PRESETS[0];
      const isLandscape = initialDim.width > initialDim.height;
      const width = isLandscape ? preset.height : preset.width;
      const height = isLandscape ? preset.width : preset.height;

      dropdownCtrl.destroy();
      await options.onConfirm({
        applyToAll: Boolean(chkApplyAll?.checked),
        dimensions: { height, width },
        title: options.initialTitle || 'Documento sin título',
      });
      return true;
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: `Tamaño de página (Página ${pageNum})`,
  });
}
