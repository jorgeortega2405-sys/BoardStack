import { renderCollabPageSizeModalBody } from '../../components/modal-templates.js';
import { openModal } from '../../components/modal.component.js';
import { COLLAB_PAGE_PRESETS, PageDimension } from '../../config/collab-page-presets.config.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { setupDropdown } from '../../utils/dom.util.js';

interface CollabPageSizeResult {
  applyToAll?: boolean;
  dimensions: PageDimension;
  title?: string;
}

interface CollabPageSizeModalOptions {
  currentDimensions?: PageDimension;
  initialTitle?: string;
  mode?: 'create' | 'resize';
  onConfirm: (result: CollabPageSizeResult) => Promise<void> | void;
  pageIndex?: number;
}

function openCollabPageSizeModal(options: CollabPageSizeModalOptions): void {
  const initialDim = options.currentDimensions || { height: 1123, width: 794 };

  const matchingPreset = COLLAB_PAGE_PRESETS.find((p) => {
    return (p.width === initialDim.width && p.height === initialDim.height) ||
      (p.width === initialDim.height && p.height === initialDim.width);
  });

  let selectedPresetId = matchingPreset?.id || 'a4';

  const modalBody = document.createElement('div');
  modalBody.className = 'collab-page-size-form';
  modalBody.setAttribute('data-ref', 'collab-page-size-form');
  modalBody.innerHTML = renderCollabPageSizeModalBody(selectedPresetId, COLLAB_PAGE_PRESETS);

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
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('ui.aplicar_tamano') || t('modals_catalog.sample_collab_size_btn') || 'Aplicar tamaño',
    description: t('ui.selecciona_el_formato_de_papel_estandar_'),
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
    title: `${t('modals_catalog.item_08_name') || 'Tamaño de página'} (${t('common.pages') || 'Página'} ${pageNum})`,
  });
}

export { openCollabPageSizeModal };
export type { CollabPageSizeModalOptions, CollabPageSizeResult };
