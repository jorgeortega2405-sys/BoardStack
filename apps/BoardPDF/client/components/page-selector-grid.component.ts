import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';

interface PageSelectorGridOptions {
  container: HTMLElement;
  onChange?: (selectedPages: Set<number>) => void;
  pageCount?: number;
  selectedPages?: Iterable<number>;
}

class PageSelectorGridComponent {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private lastClickedPage: number | null = null;
  private onChange?: (selectedPages: Set<number>) => void;
  private pageCount = 0;
  private selectedPages = new Set<number>();
  private thumbnails = new Map<number, string>();

  constructor(options: PageSelectorGridOptions) {
    this.container = options.container;
    this.onChange = options.onChange;
    this.pageCount = Math.max(0, options.pageCount || 0);
    if (options.selectedPages) {
      for (const p of options.selectedPages) {
        if (p >= 1 && p <= this.pageCount) {
          this.selectedPages.add(p);
        }
      }
    }
    this._boundClick = this._handleClick.bind(this);
    this._render();
    this._bindEvents();
  }

  private _boundClick: (e: MouseEvent) => void;

  public clearThumbnails(): void {
    this.thumbnails.clear();
    const cards = this.container.querySelectorAll<HTMLElement>('.collab-download-page-card');
    cards.forEach((card) => {
      const img = card.querySelector<HTMLImageElement>('.collab-download-page-card__img');
      const num = card.querySelector<HTMLElement>('.collab-download-page-card__num');
      if (img) {
        img.removeAttribute('src');
        img.classList.add('is-hidden');
      }
      num?.classList.remove('is-hidden');
    });
  }

  public destroy(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.thumbnails.clear();
    this.container.innerHTML = '';
  }

  public getSelected(): Set<number> {
    return new Set(this.selectedPages);
  }

  public setPageCount(count: number, selected?: Iterable<number>, resetThumbnails = false): void {
    const nextCount = Math.max(0, count);
    if (resetThumbnails || nextCount !== this.pageCount) {
      if (resetThumbnails) {
        this.thumbnails.clear();
      } else {
        for (const key of this.thumbnails.keys()) {
          if (key > nextCount) this.thumbnails.delete(key);
        }
      }
    }
    this.pageCount = nextCount;
    if (selected !== undefined) {
      this.selectedPages.clear();
      for (const p of selected) {
        if (p >= 1 && p <= this.pageCount) {
          this.selectedPages.add(p);
        }
      }
    } else {
      for (const p of Array.from(this.selectedPages)) {
        if (p < 1 || p > this.pageCount) {
          this.selectedPages.delete(p);
        }
      }
    }
    this.lastClickedPage = null;
    this._render();
  }

  public setSelected(selected: Iterable<number>): void {
    this.selectedPages.clear();
    for (const p of selected) {
      if (p >= 1 && p <= this.pageCount) {
        this.selectedPages.add(p);
      }
    }
    this._syncSelectionUi();
  }

  public setThumbnail(pageNum: number, dataUrl: string): void {
    if (pageNum < 1 || pageNum > this.pageCount || !dataUrl) return;
    this.thumbnails.set(pageNum, dataUrl);
    const card = this.container.querySelector<HTMLElement>(`[data-ref="card-page-${pageNum}"]`);
    if (!card) return;
    const img = card.querySelector<HTMLImageElement>('.collab-download-page-card__img');
    const num = card.querySelector<HTMLElement>('.collab-download-page-card__num');
    if (img) {
      img.src = dataUrl;
      img.classList.remove('is-hidden');
    }
    num?.classList.add('is-hidden');
  }

  private _bindEvents(): void {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.container.addEventListener('click', this._boundClick, { signal: this.abortController.signal });
  }

  private _handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const toggleAllBtn = target.closest<HTMLButtonElement>('[data-ref="btn-toggle-all-pages"]');
    if (toggleAllBtn) {
      e.preventDefault();
      if (this.pageCount === 0) return;
      if (this.selectedPages.size === this.pageCount) {
        this.selectedPages.clear();
      } else {
        for (let i = 1; i <= this.pageCount; i++) {
          this.selectedPages.add(i);
        }
      }
      this._syncSelectionUi();
      this.onChange?.(new Set(this.selectedPages));
      return;
    }

    const card = target.closest<HTMLButtonElement>('.collab-download-page-card[data-page]');
    if (!card) return;
    e.preventDefault();
    const pageNum = Number(card.getAttribute('data-page'));
    if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > this.pageCount) return;

    const shouldSelect = !this.selectedPages.has(pageNum);
    if (e.shiftKey && this.lastClickedPage !== null && this.lastClickedPage !== pageNum) {
      const start = Math.min(this.lastClickedPage, pageNum);
      const end = Math.max(this.lastClickedPage, pageNum);
      for (let i = start; i <= end; i++) {
        if (shouldSelect) {
          this.selectedPages.add(i);
        } else {
          this.selectedPages.delete(i);
        }
      }
    } else if (shouldSelect) {
      this.selectedPages.add(pageNum);
    } else {
      this.selectedPages.delete(pageNum);
    }
    this.lastClickedPage = pageNum;
    this._syncSelectionUi();
    this.onChange?.(new Set(this.selectedPages));
  }

  private _render(): void {
    const cardsHtml: string[] = [];
    for (let i = 1; i <= this.pageCount; i++) {
      const isSelected = this.selectedPages.has(i);
      const thumbUrl = this.thumbnails.get(i) || '';
      const hasThumb = Boolean(thumbUrl);
      cardsHtml.push(
        `<button type="button" class="collab-download-page-card${isSelected ? ' is-selected' : ''}" data-ref="card-page-${i}" data-page="${i}">` +
          '<div class="collab-download-page-card__preview">' +
            `<img class="collab-download-page-card__img${hasThumb ? '' : ' is-hidden'}" data-ref="img-page-${i}"${hasThumb ? ` src="${thumbUrl}"` : ''} alt="" loading="lazy" />` +
            `<span class="collab-download-page-card__num${hasThumb ? ' is-hidden' : ''}">${i}</span>` +
            '<div class="collab-download-page-card__checkbox">' +
              '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>' +
            '</div>' +
          '</div>' +
          `<span class="collab-download-page-card__label">${t('tools.page_short', { num: i })}</span>` +
        '</button>'
      );
    }

    this.container.innerHTML =
      '<div class="collab-download-custom-container" data-ref="container-custom-pages">' +
        '<div class="collab-download-custom-header">' +
          '<span class="collab-download-custom-count" data-ref="txt-selected-pages-count"></span>' +
          '<button type="button" class="collab-download-toggle-all" data-ref="btn-toggle-all-pages"></button>' +
        '</div>' +
        `<div class="collab-download-pages-grid" data-ref="grid-download-pages">${cardsHtml.join('')}</div>` +
      '</div>';

    this._syncSelectionUi();
    renderIcons(this.container);
  }

  private _syncSelectionUi(): void {
    const countEl = this.container.querySelector<HTMLElement>('[data-ref="txt-selected-pages-count"]');
    if (countEl) {
      countEl.textContent = t('tools.selected_pages_of_total', {
        selected: this.selectedPages.size,
        total: this.pageCount,
      });
    }

    const toggleBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-all-pages"]');
    if (toggleBtn) {
      const allSelected = this.pageCount > 0 && this.selectedPages.size === this.pageCount;
      toggleBtn.textContent = allSelected ? t('tools.deselect_all') : t('tools.select_all');
      toggleBtn.disabled = this.pageCount === 0;
    }

    const cards = this.container.querySelectorAll<HTMLElement>('.collab-download-page-card[data-page]');
    cards.forEach((card) => {
      const pageNum = Number(card.getAttribute('data-page'));
      card.classList.toggle('is-selected', this.selectedPages.has(pageNum));
    });
  }
}

export { PageSelectorGridComponent };
export type { PageSelectorGridOptions };
