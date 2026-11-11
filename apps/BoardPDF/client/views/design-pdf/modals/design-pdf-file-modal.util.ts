import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';

type CollabFileGuidesPreset = '12-col' | '3-col' | '3x3' | 'custom' | null;

type CollabFilePopoverView = 'guides';

interface CollabFileRulersState {
  committedGuidesPreset: CollabFileGuidesPreset;
  currentGuidesPreset: CollabFileGuidesPreset;
  customGuideCols: number;
  customGuideRows: number;
}

interface CollabFileModalOptions extends CollabFileRulersState {
  initialView?: CollabFilePopoverView;
  onCancelGuidesPreview: () => void;
  onClearGuidesPreset: () => void;
  onClose: () => void;
  onConfirmGuides: () => void;
  onCustomGridChange: (cols: number, rows: number) => void;
  onSelectGuidesPreset: (preset: Exclude<CollabFileGuidesPreset, null>) => void;
}

interface CollabFilePopoverHandle {
  cleanup: () => void;
  element: HTMLElement;
  getActiveView: () => CollabFilePopoverView;
  openView: (view: CollabFilePopoverView) => void;
  syncState: (state: Partial<CollabFileRulersState>) => void;
}

function createCollabFilePopover(options: CollabFileModalOptions): CollabFilePopoverHandle {
  const {
    initialView = 'guides',
    onCancelGuidesPreview,
    onClearGuidesPreset,
    onClose,
    onConfirmGuides,
    onCustomGridChange,
    onSelectGuidesPreset,
  } = options;

  let currentState: CollabFileRulersState = {
    committedGuidesPreset: options.committedGuidesPreset,
    currentGuidesPreset: options.currentGuidesPreset,
    customGuideCols: options.customGuideCols,
    customGuideRows: options.customGuideRows,
  };

  const popover = document.createElement('div');
  popover.className = 'tool-sidebar-container tool-sidebar-container--file collab-file-dropdown is-open';
  popover.setAttribute('data-ref', 'collab-file-popover');

  popover.innerHTML = `
    <aside class="tool-layout__sidebar tool-layout__sidebar--absolute is-open collab-share-card" data-ref="collab-file-card">
      <div class="tool-sidebar__panel" data-ref="collab-file-view-guides">
        <div class="tool-sidebar__header">
          <h2 class="tool-sidebar__title">${t('collaborative.guides_title')}</h2>
          <button type="button" class="tool-sidebar__close-btn" data-ref="btn-guides-close" data-i18n-aria="common.close" aria-label="${t('common.close')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>

        <div class="tool-sidebar__body">
          <div class="tool-sidebar__section">
            <div class="collab-download-custom-header">
              <div class="tool-sidebar__section-title">${t('collaborative.guides_section_presets')}</div>
              <button type="button" class="collab-download-toggle-all is-hidden" data-ref="btn-guides-clear">${t('collaborative.guides_clear_btn')}</button>
            </div>
            <div class="collab-guides-presets" data-ref="collab-guides-presets">
              <button type="button" class="collab-download-page-card collab-guide-preset-card" data-ref="card-guide-12-col" data-preset="12-col">
                <div class="collab-download-page-card__preview collab-guide-preset-card__preview">
                  <svg class="collab-guide-preset-svg" viewBox="0 0 36 44" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="30" height="36" rx="2" stroke="currentColor" stroke-width="1.2" opacity="0.35"></rect>
                    <line x1="9" y1="4" x2="9" y2="40" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"></line>
                    <line x1="15" y1="4" x2="15" y2="40" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"></line>
                    <line x1="21" y1="4" x2="21" y2="40" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"></line>
                    <line x1="27" y1="4" x2="27" y2="40" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"></line>
                  </svg>
                  <div class="collab-download-page-card__checkbox">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  </div>
                </div>
                <span class="collab-download-page-card__label">${t('collaborative.guides_preset_12_col')}</span>
              </button>

              <button type="button" class="collab-download-page-card collab-guide-preset-card" data-ref="card-guide-3-col" data-preset="3-col">
                <div class="collab-download-page-card__preview collab-guide-preset-card__preview">
                  <svg class="collab-guide-preset-svg" viewBox="0 0 36 44" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="30" height="36" rx="2" stroke="currentColor" stroke-width="1.2" opacity="0.35"></rect>
                    <line x1="13" y1="4" x2="13" y2="40" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"></line>
                    <line x1="23" y1="4" x2="23" y2="40" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"></line>
                  </svg>
                  <div class="collab-download-page-card__checkbox">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  </div>
                </div>
                <span class="collab-download-page-card__label">${t('collaborative.guides_preset_3_col')}</span>
              </button>

              <button type="button" class="collab-download-page-card collab-guide-preset-card" data-ref="card-guide-3x3" data-preset="3x3">
                <div class="collab-download-page-card__preview collab-guide-preset-card__preview">
                  <svg class="collab-guide-preset-svg" viewBox="0 0 36 44" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="30" height="36" rx="2" stroke="currentColor" stroke-width="1.2" opacity="0.35"></rect>
                    <line x1="13" y1="4" x2="13" y2="40" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"></line>
                    <line x1="23" y1="4" x2="23" y2="40" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"></line>
                    <line x1="3" y1="16" x2="33" y2="16" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"></line>
                    <line x1="3" y1="28" x2="33" y2="28" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"></line>
                  </svg>
                  <div class="collab-download-page-card__checkbox">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  </div>
                </div>
                <span class="collab-download-page-card__label">${t('collaborative.guides_preset_3x3')}</span>
              </button>

              <button type="button" class="collab-download-page-card collab-guide-preset-card" data-ref="card-guide-custom" data-preset="custom">
                <div class="collab-download-page-card__preview collab-guide-preset-card__preview">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
                  <div class="collab-download-page-card__checkbox">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  </div>
                </div>
                <span class="collab-download-page-card__label">${t('collaborative.guides_preset_custom')}</span>
              </button>
            </div>
          </div>

          <div class="tool-sidebar__section is-hidden" data-ref="collab-guides-custom-fields">
            <div class="tool-sidebar__section-title">${t('collaborative.guides_custom_section')}</div>
            <div class="collab-guides-custom-fields">
              <label class="field collab-guides-field" data-ref="field-guides-cols">
                <input class="field__input" data-ref="input-guides-custom-cols" type="number" min="1" max="24" value="${currentState.customGuideCols}" placeholder=" " />
                <span class="field__label">${t('collaborative.guides_cols_label')}</span>
              </label>
              <label class="field collab-guides-field" data-ref="field-guides-rows">
                <input class="field__input" data-ref="input-guides-custom-rows" type="number" min="1" max="24" value="${currentState.customGuideRows}" placeholder=" " />
                <span class="field__label">${t('collaborative.guides_rows_label')}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="tool-sidebar__footer">
          <div class="collab-share-find-actions">
            <button type="button" class="component-button component-button--secondary component-button--h44 collab-share-find-action-btn" data-ref="btn-guides-cancel">${t('common.cancel')}</button>
            <button type="button" class="component-button component-button--black component-button--h44 collab-share-find-action-btn" data-ref="btn-guides-confirm">${t('collaborative.guides_confirm_btn')}</button>
          </div>
        </div>
      </div>
    </aside>
  `;

  document.body.appendChild(popover);
  renderIcons(popover);

  const viewGuides = popover.querySelector<HTMLElement>('[data-ref="collab-file-view-guides"]');
  const customFieldsSection = popover.querySelector<HTMLElement>('[data-ref="collab-guides-custom-fields"]');
  const inputCols = popover.querySelector<HTMLInputElement>('[data-ref="input-guides-custom-cols"]');
  const inputRows = popover.querySelector<HTMLInputElement>('[data-ref="input-guides-custom-rows"]');
  const btnGuidesClear = popover.querySelector<HTMLButtonElement>('[data-ref="btn-guides-clear"]');
  const presetCards = popover.querySelectorAll<HTMLButtonElement>('[data-ref^="card-guide-"]');

  let activeView: CollabFilePopoverView = initialView;

  const syncUiFromState = () => {
    if (inputCols && document.activeElement !== inputCols) {
      inputCols.value = String(currentState.customGuideCols);
    }
    if (inputRows && document.activeElement !== inputRows) {
      inputRows.value = String(currentState.customGuideRows);
    }
    const activePreset = currentState.currentGuidesPreset;
    presetCards.forEach((card) => {
      const preset = card.getAttribute('data-preset');
      const isSelected = !!activePreset && preset === activePreset;
      card.classList.toggle('is-active', isSelected);
      card.classList.toggle('is-selected', isSelected);
    });
    customFieldsSection?.classList.toggle('is-hidden', activePreset !== 'custom');
    btnGuidesClear?.classList.toggle('is-hidden', !activePreset && !currentState.committedGuidesPreset);
  };

  const openView = (view: CollabFilePopoverView) => {
    activeView = view;
    viewGuides?.classList.toggle('is-hidden', view !== 'guides');
    syncUiFromState();
  };

  openView(initialView);

  const closePopover = (revertGuidesPreview: boolean) => {
    if (revertGuidesPreview && activeView === 'guides') {
      onCancelGuidesPreview();
    }
    cleanup();
    onClose();
  };

  const onOutsidePointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (
      popover &&
      !popover.contains(target) &&
      !target.closest('[data-ref="btn-sub-add-guides"]')
    ) {
      closePopover(true);
    }
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', onOutsidePointerDown);
  }, 10);

  const onEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePopover(true);
    }
  };
  document.addEventListener('keydown', onEscapeKey);

  const cleanup = () => {
    document.removeEventListener('pointerdown', onOutsidePointerDown);
    document.removeEventListener('keydown', onEscapeKey);
    popover.remove();
  };

  popover.querySelector<HTMLButtonElement>('[data-ref="btn-guides-close"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover(true);
  });

  popover.querySelector<HTMLButtonElement>('[data-ref="btn-guides-cancel"]')?.addEventListener('click', () => {
    closePopover(true);
  });

  presetCards.forEach((card) => {
    card.addEventListener('click', () => {
      const preset = card.getAttribute('data-preset') as Exclude<CollabFileGuidesPreset, null>;
      onSelectGuidesPreset(preset);
    });
  });

  btnGuidesClear?.addEventListener('click', () => {
    onClearGuidesPreset();
  });

  inputCols?.addEventListener('input', () => {
    const cols = Math.max(1, Math.min(24, parseInt(inputCols.value || '1', 10) || 1));
    const rows = Math.max(1, Math.min(24, parseInt(inputRows?.value || String(currentState.customGuideRows), 10) || 1));
    onCustomGridChange(cols, rows);
  });

  inputRows?.addEventListener('input', () => {
    const cols = Math.max(1, Math.min(24, parseInt(inputCols?.value || String(currentState.customGuideCols), 10) || 1));
    const rows = Math.max(1, Math.min(24, parseInt(inputRows.value || '1', 10) || 1));
    onCustomGridChange(cols, rows);
  });

  popover.querySelector<HTMLButtonElement>('[data-ref="btn-guides-confirm"]')?.addEventListener('click', () => {
    onConfirmGuides();
    closePopover(false);
  });

  const syncState = (nextState: Partial<CollabFileRulersState>) => {
    currentState = { ...currentState, ...nextState };
    syncUiFromState();
  };

  return {
    cleanup,
    element: popover,
    getActiveView: () => activeView,
    openView,
    syncState,
  };
}

export { createCollabFilePopover };
export type { CollabFileGuidesPreset, CollabFileModalOptions, CollabFilePopoverHandle, CollabFilePopoverView, CollabFileRulersState };