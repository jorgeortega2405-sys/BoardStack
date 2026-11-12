import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { debounce } from '../utils/dom.util.js';
import { GOOGLE_FONTS_CATALOG, GoogleFontItem, loadGoogleFont, loadGoogleFontPreview } from '../views/design-pdf/config/design-pdf-fonts.config.js';

interface SelectedFontConfig {
  displayName: string;
  family: string;
  style: 'italic' | 'normal';
  weight: number;
}

interface FontDrawerOptions {
  initialFont?: Partial<SelectedFontConfig>;
  mountPoint: HTMLElement;
  onChange?: (font: SelectedFontConfig) => void;
  onClose?: () => void;
}

interface FontCatalogEntry {
  cssPreviewFamily: string;
  family: string;
  hasItalic: boolean;
  isStandard: boolean;
  labelKey?: string;
  weights: number[];
}

const STANDARD_FONT_ENTRIES: FontCatalogEntry[] = [
  {
    cssPreviewFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    family: 'Helvetica',
    hasItalic: true,
    isStandard: true,
    labelKey: 'tools.font_standard_helvetica',
    weights: [400, 700],
  },
  {
    cssPreviewFamily: "'Times New Roman', Times, Georgia, serif",
    family: 'Times-Roman',
    hasItalic: true,
    isStandard: true,
    labelKey: 'tools.font_standard_times',
    weights: [400, 700],
  },
  {
    cssPreviewFamily: "'Courier New', Courier, monospace",
    family: 'Courier',
    hasItalic: true,
    isStandard: true,
    labelKey: 'tools.font_standard_courier',
    weights: [400, 700],
  },
];

let drawerInstanceSeq = 0;

function buildCombinedFontCatalog(): FontCatalogEntry[] {
  const googleEntries: FontCatalogEntry[] = GOOGLE_FONTS_CATALOG.map((item: GoogleFontItem) => {
    const safeFamily = item.family.replace(/['"\\;{}]/g, '');
    const fallback = item.category === 'serif'
      ? 'serif'
      : item.category === 'monospace'
        ? 'monospace'
        : 'sans-serif';
    return {
      cssPreviewFamily: `'${safeFamily}', ${fallback}`,
      family: item.family,
      hasItalic: item.hasItalic,
      isStandard: false,
      weights: item.weights,
    };
  });
  return [...STANDARD_FONT_ENTRIES, ...googleEntries];
}

class FontDrawerComponent {
  private abortController: AbortController | null = null;
  private catalog: FontCatalogEntry[] = buildCombinedFontCatalog();
  private drawerEl: HTMLElement | null = null;
  private expandedFamily: string | null = null;
  private fontObserver: IntersectionObserver | null = null;
  private isOpened = false;
  private listAbortController: AbortController | null = null;
  private mountPoint: HTMLElement;
  private onChange?: (font: SelectedFontConfig) => void;
  private onClose?: () => void;
  private searchQuery = '';
  private selected: SelectedFontConfig;
  private styleEl: HTMLStyleElement | null = null;
  private uid: string;

  constructor(options: FontDrawerOptions) {
    drawerInstanceSeq += 1;
    this.uid = `font-drawer-${drawerInstanceSeq}`;
    this.mountPoint = options.mountPoint;
    this.onChange = options.onChange;
    this.onClose = options.onClose;
    const initFamily = options.initialFont?.family || 'Helvetica';
    const initWeight = Number(options.initialFont?.weight) || 400;
    const initStyle = options.initialFont?.style === 'italic' ? 'italic' : 'normal';
    this.selected = {
      displayName: this._resolveDisplayName(initFamily, initWeight, initStyle),
      family: initFamily,
      style: initStyle,
      weight: initWeight,
    };
    this.expandedFamily = initFamily;
    this._mount();
    this._bindEvents();
    this._renderList();
  }

  public close(): void {
    if (!this.drawerEl || !this.isOpened) return;
    this.isOpened = false;
    this.drawerEl.classList.remove('is-open');
    this.onClose?.();
  }

  public destroy(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.listAbortController?.abort();
    this.listAbortController = null;
    this.fontObserver?.disconnect();
    this.fontObserver = null;
    this.styleEl?.remove();
    this.styleEl = null;
    this.drawerEl?.remove();
    this.drawerEl = null;
  }

  public getSelectedFont(): SelectedFontConfig {
    return { ...this.selected };
  }

  public isOpen(): boolean {
    return this.isOpened;
  }

  public open(): void {
    if (!this.drawerEl || this.isOpened) return;
    this.isOpened = true;
    this.drawerEl.classList.add('is-open');
    const selectedCard = this.drawerEl.querySelector<HTMLElement>('.collaborative-font-card.is-selected');
    selectedCard?.scrollIntoView({ block: 'nearest' });
  }

  public toggle(): void {
    if (this.isOpened) {
      this.close();
    } else {
      this.open();
    }
  }

  private _bindEvents(): void {
    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    if (!this.drawerEl) return;

    const collapseBtn = this.drawerEl.querySelector<HTMLButtonElement>('[data-ref="btn-font-drawer-collapse"]');
    const mobileCloseBtn = this.drawerEl.querySelector<HTMLButtonElement>('[data-ref="btn-font-drawer-mobile-close"]');
    collapseBtn?.addEventListener('click', () => this.close(), { signal });
    mobileCloseBtn?.addEventListener('click', () => this.close(), { signal });

    const searchInput = this.drawerEl.querySelector<HTMLInputElement>('[data-ref="input-search-fonts"]');
    const clearSearchBtn = this.drawerEl.querySelector<HTMLButtonElement>('[data-ref="btn-clear-fonts-search"]');

    const debouncedRender = debounce(() => {
      this._renderList();
    }, 120);

    searchInput?.addEventListener(
      'input',
      () => {
        this.searchQuery = searchInput.value.trim();
        clearSearchBtn?.classList.toggle('is-hidden', this.searchQuery.length === 0);
        debouncedRender();
      },
      { signal }
    );

    clearSearchBtn?.addEventListener(
      'click',
      () => {
        if (!searchInput) return;
        searchInput.value = '';
        this.searchQuery = '';
        clearSearchBtn.classList.add('is-hidden');
        this._renderList();
        searchInput.focus();
      },
      { signal }
    );
  }

  private _emitSelection(next: SelectedFontConfig): void {
    this.selected = next;
    this.onChange?.({ ...this.selected });
  }

  private _ensurePreviewStyles(): void {
    if (this.styleEl) return;
    const style = document.createElement('style');
    style.setAttribute('data-ref', `style-${this.uid}`);
    const rules = this.catalog.map(
      (entry, index) => `[data-font-drawer="${this.uid}"] [data-font-idx="${index}"] { font-family: ${entry.cssPreviewFamily}; }`
    );
    style.textContent = rules.join('\n');
    document.head.appendChild(style);
    this.styleEl = style;
  }

  private _findEntry(family: string): FontCatalogEntry | undefined {
    const target = family.trim().toLowerCase();
    return this.catalog.find((entry) => entry.family.toLowerCase() === target);
  }

  private _getDisplayLabel(entry: FontCatalogEntry): string {
    return entry.labelKey ? t(entry.labelKey) : entry.family;
  }

  private _mount(): void {
    this._ensurePreviewStyles();

    const drawer = document.createElement('aside');
    drawer.className = 'layout-drawer tool-font-drawer';
    drawer.setAttribute('data-ref', 'tool-font-drawer');
    drawer.setAttribute('data-font-drawer', this.uid);

    drawer.innerHTML =
      '<div class="layout-drawer__collapse-wrapper">' +
        `<button type="button" class="layout-drawer__collapse-pill" data-ref="btn-font-drawer-collapse" aria-label="${t('common.close')}">` +
          '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_left"></use></svg>' +
        '</button>' +
      '</div>' +
      '<div class="layout-drawer__header collaborative-drawer-header" data-ref="font-drawer-header">' +
        '<div class="collaborative-drawer-header__left" data-ref="font-drawer-header-left">' +
          '<div class="component-title-badge" data-ref="font-drawer-title-badge">' +
            `<h1 class="component-title-badge__text" data-ref="font-drawer-title">${t('tools.fonts_drawer_title')}</h1>` +
          '</div>' +
        '</div>' +
        `<button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 tool-drawer__mobile-close" data-ref="btn-font-drawer-mobile-close" aria-label="${t('common.close')}">` +
          '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>' +
        '</button>' +
      '</div>' +
      '<div class="layout-drawer__body tool-font-drawer__body" data-ref="font-drawer-body">' +
        '<div class="collaborative-fonts-panel" data-ref="fonts-panel-wrapper">' +
          '<div class="collaborative-fonts-search" data-ref="fonts-search-container">' +
            '<div class="component-search component-search--full" data-ref="fonts-search-box">' +
              '<div class="component-search__icon" data-ref="fonts-search-icon">' +
                '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>' +
              '</div>' +
              '<div class="component-search__input-box" data-ref="fonts-search-input-box">' +
                `<input class="component-search__input" data-ref="input-search-fonts" placeholder="${t('tools.search_fonts_placeholder')}" type="text" autocomplete="off" />` +
              '</div>' +
              `<button type="button" class="component-button component-button--h34 component-button--icon-only is-hidden" data-ref="btn-clear-fonts-search" aria-label="${t('common.clear_search')}">` +
                '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="collaborative-font-list" data-ref="font-list-container"></div>' +
        '</div>' +
      '</div>';

    this.mountPoint.prepend(drawer);
    this.drawerEl = drawer;
    renderIcons(drawer);
  }

  private _renderList(): void {
    const listContainer = this.drawerEl?.querySelector<HTMLElement>('[data-ref="font-list-container"]');
    if (!listContainer) return;

    this.listAbortController?.abort();
    this.listAbortController = new AbortController();
    const signal = this.listAbortController.signal;

    this.fontObserver?.disconnect();
    this.fontObserver = null;

    const query = this.searchQuery.toLowerCase();
    const filtered = this.catalog
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => {
        if (!query) return true;
        const label = this._getDisplayLabel(entry).toLowerCase();
        return entry.family.toLowerCase().includes(query) || label.includes(query);
      });

    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="tool-font-empty" data-ref="font-drawer-empty">${t('tools.fonts_not_found')}</div>`;
      return;
    }

    listContainer.innerHTML = filtered
      .map(({ entry, idx }) => {
        const isSelected = entry.family.toLowerCase() === this.selected.family.toLowerCase();
        const isExpanded = this.expandedFamily?.toLowerCase() === entry.family.toLowerCase();
        const slug = entry.family.replace(/\s+/g, '-');
        const label = this._getDisplayLabel(entry);

        const variantsHtml = isExpanded
          ? '<div class="collaborative-font-variants-inline">' +
              '<div class="collaborative-font-weights-menu">' +
                entry.weights
                  .map((w) => {
                    const isWeightActive = isSelected && this.selected.weight === w;
                    const weightLabel = t(`tools.font_weight_${w}`);
                    return (
                      `<button type="button" class="menu-item collaborative-weight-pill${isWeightActive ? ' is-active' : ''}" data-font-family="${entry.family}" data-weight="${w}" data-font-idx="${idx}">` +
                        `<span class="menu-item__text font-weight-${w}">${weightLabel}</span>` +
                        (isWeightActive
                          ? '<svg class="component-icon menu-item__check" aria-hidden="true"><use href="/icons.svg#check"></use></svg>'
                          : '') +
                      '</button>'
                    );
                  })
                  .join('') +
                (entry.hasItalic
                  ? `<button type="button" class="menu-item collaborative-weight-pill${isSelected && this.selected.style === 'italic' ? ' is-active' : ''}" data-font-family="${entry.family}" data-action="toggle-italic" data-font-idx="${idx}">` +
                      `<span class="menu-item__text font-style-italic">${t('tools.font_style_italic')}</span>` +
                      (isSelected && this.selected.style === 'italic'
                        ? '<svg class="component-icon menu-item__check" aria-hidden="true"><use href="/icons.svg#check"></use></svg>'
                        : '') +
                    '</button>'
                  : '') +
              '</div>' +
            '</div>'
          : '';

        return (
          `<div class="collaborative-font-card${isSelected ? ' is-selected' : ''}${isExpanded ? ' is-expanded' : ''}" data-ref="font-card-${slug}" data-font-family="${entry.family}">` +
            `<button type="button" class="menu-item collaborative-font-card__header" data-ref="font-item-${slug}" data-font-family="${entry.family}" data-font-idx="${idx}" data-is-standard="${entry.isStandard ? '1' : '0'}">` +
              `<span class="menu-item__text">${label}</span>` +
              '<svg class="component-icon collaborative-font-card__chevron menu-item__arrow" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>' +
            '</button>' +
            variantsHtml +
          '</div>'
        );
      })
      .join('');

    renderIcons(listContainer);

    this.fontObserver = new IntersectionObserver(
      (entries) => {
        for (const item of entries) {
          if (!item.isIntersecting) continue;
          const fam = item.target.getAttribute('data-font-family');
          const isStd = item.target.getAttribute('data-is-standard') === '1';
          if (fam && !isStd) {
            loadGoogleFontPreview(fam);
          }
          this.fontObserver?.unobserve(item.target);
        }
      },
      { root: listContainer, rootMargin: '80px' }
    );

    const headers = listContainer.querySelectorAll<HTMLButtonElement>('.collaborative-font-card__header');
    headers.forEach((btn) => {
      this.fontObserver?.observe(btn);
    });

    listContainer.addEventListener(
      'click',
      async (e) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;

        const headerBtn = target.closest<HTMLButtonElement>('.collaborative-font-card__header');
        if (headerBtn) {
          const family = headerBtn.getAttribute('data-font-family');
          if (!family) return;
          const entry = this._findEntry(family);
          if (!entry) return;

          const wasSameFamily = this.selected.family.toLowerCase() === entry.family.toLowerCase();
          const nextWeight = entry.weights.includes(this.selected.weight)
            ? this.selected.weight
            : entry.weights.includes(400)
              ? 400
              : entry.weights[0] || 400;
          const nextStyle: 'italic' | 'normal' = entry.hasItalic && wasSameFamily ? this.selected.style : 'normal';

          if (!entry.isStandard) {
            await loadGoogleFont(entry.family, entry.weights, entry.hasItalic);
          }

          this.expandedFamily =
            this.expandedFamily?.toLowerCase() === entry.family.toLowerCase() ? null : entry.family;

          this._emitSelection({
            displayName: this._resolveDisplayName(entry.family, nextWeight, nextStyle),
            family: entry.family,
            style: nextStyle,
            weight: nextWeight,
          });
          this._renderList();
          return;
        }

        const pill = target.closest<HTMLButtonElement>('.collaborative-weight-pill');
        if (!pill) return;
        e.stopPropagation();
        const family = pill.getAttribute('data-font-family');
        if (!family) return;
        const entry = this._findEntry(family);
        if (!entry) return;

        const action = pill.getAttribute('data-action');
        if (action === 'toggle-italic') {
          const nextStyle: 'italic' | 'normal' = this.selected.style === 'italic' ? 'normal' : 'italic';
          const nextWeight = entry.weights.includes(this.selected.weight)
            ? this.selected.weight
            : entry.weights.includes(400)
              ? 400
              : entry.weights[0] || 400;

          if (!entry.isStandard) {
            await loadGoogleFont(entry.family, [nextWeight], true);
          }

          this._emitSelection({
            displayName: this._resolveDisplayName(entry.family, nextWeight, nextStyle),
            family: entry.family,
            style: nextStyle,
            weight: nextWeight,
          });
          this._renderList();
          return;
        }

        const weightAttr = pill.getAttribute('data-weight');
        if (!weightAttr) return;
        const nextWeight = Number(weightAttr) || 400;
        const nextStyle: 'italic' | 'normal' = entry.hasItalic ? this.selected.style : 'normal';

        if (!entry.isStandard) {
          await loadGoogleFont(entry.family, [nextWeight], nextStyle === 'italic');
        }

        this._emitSelection({
          displayName: this._resolveDisplayName(entry.family, nextWeight, nextStyle),
          family: entry.family,
          style: nextStyle,
          weight: nextWeight,
        });
        this._renderList();
      },
      { signal }
    );
  }

  private _resolveDisplayName(family: string, weight: number, style: 'italic' | 'normal'): string {
    const entry = this._findEntry(family);
    const baseName = entry ? this._getDisplayLabel(entry) : family;
    const parts: string[] = [baseName];
    if (weight !== 400) {
      parts.push(t(`tools.font_weight_${weight}`));
    }
    if (style === 'italic') {
      parts.push(t('tools.font_style_italic'));
    }
    return parts.join(' ');
  }
}

export { FontDrawerComponent };
export type { FontDrawerOptions, SelectedFontConfig };
