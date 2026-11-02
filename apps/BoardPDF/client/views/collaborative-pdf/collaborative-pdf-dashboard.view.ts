import { openModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { COLLAB_PAGE_PRESETS, inToPx, mmToPx, PagePreset } from '../../config/collab-page-presets.config.js';
import { currentUser, deleteApi, getApi, putApi } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { renderPdfThumbnail } from '../../services/pdf-preview.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';
import { listLocalDrafts, removeLocalDraft, saveLocalDraft } from '../../utils/collab-local-draft.util.js';
import { setupDropdown } from '../../utils/dom.util.js';

interface DocItem {
  access_level?: string;
  content?: any;
  created_at: string;
  id: string;
  is_local?: boolean;
  page_count: number;
  pdf_filename?: string;
  title: string;
  updated_at: string;
}

export class CollaborativePdfDashboardController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private documents: DocItem[] = [];
  private dropdownControllers: Array<{ destroy: () => void }> = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    await this.loadDocuments();
    this.renderGrid();
    renderIcons(this.container);
    this.bindEvents();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.dropdownControllers.forEach((ctrl) => ctrl.destroy());
    this.dropdownControllers = [];
  }

  private async loadDocuments(): Promise<void> {
    const localDrafts = listLocalDrafts().map((d) => ({
      access_level: 'restricted',
      content: d.content,
      created_at: d.createdAt,
      id: d.id,
      is_local: true,
      page_count: d.content?.pageCount || 1,
      title: d.title,
      updated_at: d.updatedAt,
    }));

    if (!currentUser) {
      this.documents = localDrafts;
      return;
    }

    try {
      const res = await getApi(API_ROUTES.collaborativeDocs.base);
      if (res.ok) {
        const data = await res.json();
        const serverDocs = Array.isArray(data.documents) ? data.documents : [];
        const serverIds = new Set(serverDocs.map((s: DocItem) => s.id));
        const unmigratedLocals = localDrafts.filter((l) => !serverIds.has(l.id));
        this.documents = [...unmigratedLocals, ...serverDocs];
      } else {
        this.documents = localDrafts;
      }
    } catch {
      this.documents = localDrafts;
    }
  }

  private renderGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="collaborative-grid"]');
    if (!grid) return;

    this.dropdownControllers.forEach((ctrl) => ctrl.destroy());
    this.dropdownControllers = [];

    if (this.documents.length === 0) {
      grid.innerHTML = `
        <div class="collaborative-empty-state" data-ref="collaborative-empty-state">
          <div class="collaborative-empty-state__icon" data-ref="empty-icon">
            <svg class="component-icon" style="height: 48px; width: 48px; color: var(--text-tertiary);" aria-hidden="true"><use href="/icons.svg#picture_as_pdf"></use></svg>
          </div>
          <h3 class="collaborative-empty-state__title" data-ref="empty-title">Aún no tienes documentos PDF</h3>
          <p class="collaborative-empty-state__desc" data-ref="empty-desc">Crea tu primer documento desde cero o colabora en tiempo real con otros usuarios.</p>
          <button type="button" class="component-button component-button--primary component-button--h40" data-ref="btn-empty-create-pdf">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            <span>Crear nuevo PDF</span>
          </button>
        </div>
      `;
      renderIcons(grid);
      return;
    }

    const docsHtml = this.documents.map((doc) => {
      const isLocal = !!doc.is_local;
      const isPublic = doc.access_level === 'anyone_with_link';
      const badgeIcon = isPublic ? 'lock_open' : 'lock';
      const badgeText = isPublic ? 'Público' : 'Privado';
      const relativeTime = this.formatRelativeTime(doc.updated_at);
      const dim = this.getDocDimensions(doc);
      const paperSize = this.computePaperSize(dim.width, dim.height);

      return `
        <div class="tool-card tool-card--collab-doc" data-ref="card-doc-${doc.id}" data-doc-id="${doc.id}">
          <div class="tool-card__preview-box" data-ref="thumb-box-${doc.id}">
            <div class="pdf-card__actions" data-ref="actions-doc-${doc.id}">
              <button type="button" class="component-button component-button--icon-only pdf-card__btn-action" data-ref="btn-bookmark-pdf" data-id="${doc.id}" data-tooltip="Guardar" aria-label="Guardar">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#bookmark"></use></svg>
              </button>
              <div class="dropdown" data-ref="dropdown-doc-${doc.id}">
                <button type="button" class="component-button component-button--icon-only pdf-card__btn-action dropdown-trigger" data-ref="btn-more-pdf" data-id="${doc.id}" data-tooltip="Más opciones" aria-label="Más opciones">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#more_vert"></use></svg>
                </button>
                <div class="menu-panel menu-panel--dropdown menu-panel--w-220 menu-panel--doc-actions" data-ref="menu-doc-${doc.id}">
                  <div class="menu-panel__list" data-ref="list-actions-${doc.id}">
                    <button type="button" class="menu-item" data-ref="item-open-tab-${doc.id}" data-action="open-tab" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
                      <span class="menu-item__text">Abrir en una pestaña nueva</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="item-copy-doc-${doc.id}" data-action="copy-doc" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                      <span class="menu-item__text">Crear una copia</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="item-download-${doc.id}" data-action="download" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                      <span class="menu-item__text">Descargar</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="item-share-${doc.id}" data-action="share" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
                      <span class="menu-item__text">Compartir</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="item-copy-link-${doc.id}" data-action="copy-link" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#link"></use></svg>
                      <span class="menu-item__text">Copiar el enlace</span>
                    </button>
                    <div class="menu-divider" data-ref="divider-delete-${doc.id}"></div>
                    <button type="button" class="menu-item menu-item--danger" data-ref="item-delete-${doc.id}" data-action="delete" data-id="${doc.id}" data-is-local="${isLocal ? '1' : '0'}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                      <span class="menu-item__text">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="tool-card__paper" data-ref="paper-${doc.id}" style="height: ${paperSize.height}px; width: ${paperSize.width}px;">
              <canvas class="tool-card__canvas is-hidden" data-ref="canvas-doc-${doc.id}" style="height: ${paperSize.height}px; width: ${paperSize.width}px;"></canvas>
              <div class="tool-card__placeholder" data-ref="placeholder-doc-${doc.id}">
                <svg class="component-icon tool-card__placeholder-icon" aria-hidden="true"><use href="/icons.svg#picture_as_pdf"></use></svg>
                <div class="tool-card__placeholder-lines" data-ref="placeholder-lines-${doc.id}">
                  <span class="tool-card__placeholder-line"></span>
                  <span class="tool-card__placeholder-line tool-card__placeholder-line--short"></span>
                  <span class="tool-card__placeholder-line"></span>
                </div>
              </div>
            </div>
          </div>

          <div class="tool-card__bottom" data-ref="info-doc-${doc.id}">
            <div class="tool-card__title-row" data-ref="title-row-${doc.id}">
              <h3 class="tool-card__title" data-ref="title-doc-${doc.id}" title="${this.escapeHtml(doc.title)}">${this.escapeHtml(doc.title)}</h3>
              <span class="tool-card__badge-pill" data-ref="badge-doc-${doc.id}">
                <svg class="component-icon" style="height: 12px; width: 12px;" aria-hidden="true"><use href="/icons.svg#${badgeIcon}"></use></svg>
                <span>${badgeText}</span>
              </span>
            </div>
            <div class="tool-card__meta-row" data-ref="meta-row-${doc.id}">
              <span class="tool-card__meta-text" data-ref="meta-doc-${doc.id}">${relativeTime}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = docsHtml;
    renderIcons(grid);

    const dropdownWrappers = grid.querySelectorAll<HTMLElement>('[data-ref^="dropdown-doc-"]');
    dropdownWrappers.forEach((wrapper) => {
      const ctrl = setupDropdown(wrapper, {
        isSelect: false,
        matchWidth: false,
        onClose: () => {
          const card = wrapper.closest<HTMLElement>('.tool-card');
          card?.classList.remove('has-open-dropdown');
        },
        onOpen: () => {
          const card = wrapper.closest<HTMLElement>('.tool-card');
          card?.classList.add('has-open-dropdown');
        },
        onSelect: (_val, item) => {
          if (!item) return;
          const action = item.getAttribute('data-action');
          const docId = item.getAttribute('data-id');
          const isLocal = item.getAttribute('data-is-local') === '1';
          if (!docId) return;

          if (action === 'open-tab') {
            window.open(`/d/${encodeURIComponent(docId)}`, '_blank');
          } else if (action === 'copy-link') {
            const url = `${window.location.origin}/d/${encodeURIComponent(docId)}`;
            void navigator.clipboard.writeText(url).then(() => {
              showToast('Enlace de documento copiado al portapapeles', 'info');
            });
          } else if (action === 'delete') {
            void this.handleDelete(docId, isLocal);
          }
        },
        placement: 'bottom-end',
      });
      this.dropdownControllers.push(ctrl);
    });

    this.loadPreviews();
  }

  private loadPreviews(): void {
    for (const doc of this.documents) {
      void this.loadDocPreview(doc);
    }
  }

  private getDocDimensions(doc: DocItem): { height: number; width: number } {
    const w = doc.content?.pageSizes?.[0]?.width || doc.content?.pageSize?.width || 794;
    const h = doc.content?.pageSizes?.[0]?.height || doc.content?.pageSize?.height || 1123;
    return { height: Math.max(50, Number(h) || 1123), width: Math.max(50, Number(w) || 794) };
  }

  private computePaperSize(docW: number, docH: number): { height: number; width: number } {
    const maxW = 196;
    const maxH = 156;
    const scale = Math.min(maxW / docW, maxH / docH);
    return {
      height: Math.max(40, Math.round(docH * scale)),
      width: Math.max(40, Math.round(docW * scale)),
    };
  }

  private async loadDocPreview(doc: DocItem): Promise<void> {
    const canvas = this.container.querySelector<HTMLCanvasElement>(`[data-ref="canvas-doc-${doc.id}"]`);
    const placeholder = this.container.querySelector<HTMLElement>(`[data-ref="placeholder-doc-${doc.id}"]`);
    const paper = this.container.querySelector<HTMLElement>(`[data-ref="paper-${doc.id}"]`);
    if (!canvas) return;

    const dim = this.getDocDimensions(doc);
    const paperSize = this.computePaperSize(dim.width, dim.height);

    if (paper) {
      paper.style.width = `${paperSize.width}px`;
      paper.style.height = `${paperSize.height}px`;
    }

    this.renderLocalCanvasPreview(doc, canvas);
    canvas.classList.remove('is-hidden');
    if (placeholder) placeholder.classList.add('is-hidden');

    const pdfBgUrl = doc.content?.pagePdfSources?.[0]?.pdfUrl;
    if (pdfBgUrl) {
      try {
        const pageNum = doc.content.pagePdfSources[0].pageNumber || 1;
        await renderPdfThumbnail(pdfBgUrl, canvas, { pageNum, targetWidth: paperSize.width });
        this.adjustCanvasSize(canvas, doc);
      } catch {
      }
    }
  }

  private adjustCanvasSize(canvas: HTMLCanvasElement, doc: DocItem): void {
    const dim = this.getDocDimensions(doc);
    const paperSize = this.computePaperSize(dim.width, dim.height);

    canvas.style.width = `${paperSize.width}px`;
    canvas.style.height = `${paperSize.height}px`;

    const paper = this.container.querySelector<HTMLElement>(`[data-ref="paper-${doc.id}"]`);
    if (paper) {
      paper.style.width = `${paperSize.width}px`;
      paper.style.height = `${paperSize.height}px`;
    }
  }

  private renderLocalCanvasPreview(doc: DocItem, canvas: HTMLCanvasElement): void {
    const dim = this.getDocDimensions(doc);
    const paperSize = this.computePaperSize(dim.width, dim.height);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(paperSize.width * dpr);
    canvas.height = Math.floor(paperSize.height * dpr);
    canvas.style.width = `${paperSize.width}px`;
    canvas.style.height = `${paperSize.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (dpr !== 1) {
      ctx.scale(dpr, dpr);
    }

    const bg = doc.content?.pageBackgrounds?.[0] || '#ffffff';
    if (bg.startsWith('#') || bg.startsWith('rgb')) {
      ctx.fillStyle = bg;
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillRect(0, 0, paperSize.width, paperSize.height);

    const scale = paperSize.width / dim.width;
    const elements = (doc.content?.elements || []).filter((el: any) => (el.pageIndex ?? 0) === 0);

    for (const el of elements) {
      ctx.save();
      if (el.type === 'text') {
        ctx.fillStyle = el.color || '#1e293b';
        const fontSize = Math.max(4, Math.round((el.fontSize || 16) * scale));
        ctx.font = `${el.bold ? 'bold ' : ''}${fontSize}px sans-serif`;
        ctx.fillText(el.text || '', (el.x || 0) * scale, ((el.y || 0) + (el.fontSize || 16) * 0.85) * scale);
      } else if (el.type === 'shape') {
        ctx.strokeStyle = el.strokeColor || '#4f46e5';
        ctx.lineWidth = Math.max(1, (el.strokeWidth || 1) * scale);
        ctx.fillStyle = el.fillColor || 'transparent';
        const w = (el.width || 60) * scale;
        const h = (el.height || 60) * scale;
        const x = (el.x || 0) * scale;
        const y = (el.y || 0) * scale;
        if (el.shapeType === 'circle' || el.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
          if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();
        } else {
          if (el.fillColor && el.fillColor !== 'transparent') ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        }
      }
      ctx.restore();
    }
  }

  private formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Editado hace un momento';
    if (diffMin < 60) return `Editado hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
    if (diffHours < 24) return `Editado hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays === 1) return 'Editado ayer';
    if (diffDays < 30) return `Editado hace ${diffDays} días`;
    return `Editado el ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    const btnCreateTop = this.container.querySelector<HTMLElement>('[data-ref="btn-create-pdf"]');
    btnCreateTop?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        this.createNewDocument();
      },
      { signal }
    );

    const grid = this.container.querySelector<HTMLElement>('[data-ref="collaborative-grid"]');
    if (!grid) return;

    grid.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;

        const btnEmptyCreate = target.closest<HTMLElement>('[data-ref="btn-empty-create-pdf"]');
        if (btnEmptyCreate) {
          e.preventDefault();
          this.createNewDocument();
          return;
        }

        const bookmarkBtn = target.closest<HTMLElement>('[data-ref="btn-bookmark-pdf"]');
        if (bookmarkBtn) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        const dropdownEl = target.closest<HTMLElement>('.dropdown');
        if (dropdownEl) {
          e.stopPropagation();
          return;
        }

        const docCard = target.closest<HTMLElement>('[data-doc-id]');
        if (docCard) {
          e.preventDefault();
          const docId = docCard.getAttribute('data-doc-id');
          if (docId) {
            navigate(`/d/${encodeURIComponent(docId)}`);
          }
        }
      },
      { signal }
    );
  }

  private createNewDocument(): void {
    if (currentUser?.storage_limit_bytes && currentUser.storage_used_bytes) {
      if (currentUser.storage_used_bytes >= currentUser.storage_limit_bytes) {
        showToast('Has alcanzado el límite de almacenamiento de 5 GB. Elimina documentos para continuar.', 'error');
        return;
      }
    }

    let selectedPresetId = 'a4';
    let currentOrientation: 'landscape' | 'portrait' = 'portrait';
    let customUnit: 'in' | 'mm' | 'px' = 'px';

    const modalBody = document.createElement('div');
    modalBody.className = 'collab-size-modal';
    modalBody.setAttribute('data-ref', 'collab-create-modal-body');

    modalBody.innerHTML = `
      <label class="field" data-ref="field-new-doc-title">
        <input class="field__input" data-ref="input-new-doc-title" type="text" placeholder=" " value="Documento sin título" />
        <span class="field__label">Título del documento</span>
      </label>

      <div class="collab-size-modal__section" data-ref="section-presets">
        <h4 class="collab-size-modal__section-title">Tamaño inicial</h4>
        <div class="collab-size-grid" data-ref="grid-presets">
          ${COLLAB_PAGE_PRESETS.map((p) => `
            <div class="collab-size-card${p.id === 'a4' ? ' is-selected' : ''}" data-ref="preset-card-${p.id}" data-preset-id="${p.id}">
              <div class="collab-size-card__icon-box" data-ref="icon-box-${p.id}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${p.icon}"></use></svg>
              </div>
              <div class="collab-size-card__info" data-ref="info-${p.id}">
                <span class="collab-size-card__name">${p.name}</span>
                <span class="collab-size-card__desc">${p.description}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="collab-orientation-wrapper" data-ref="wrapper-orientation">
        <span class="collab-size-modal__section-title">Orientación</span>
        <div class="collab-orientation-toggle" data-ref="toggle-orientation">
          <button type="button" class="collab-orientation-btn is-active" data-ref="btn-orient-portrait" data-orient="portrait">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
            <span>Vertical</span>
          </button>
          <button type="button" class="collab-orientation-btn" data-ref="btn-orient-landscape" data-orient="landscape">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#slideshow"></use></svg>
            <span>Horizontal</span>
          </button>
        </div>
      </div>

      <div class="collab-custom-wrapper" data-ref="wrapper-custom" style="display: none;">
        <span class="collab-size-modal__section-title">Dimensiones personalizadas</span>
        <div class="collab-custom-inputs" data-ref="custom-inputs">
          <label class="field" data-ref="field-custom-w">
            <input class="field__input field__input--h36" data-ref="input-custom-w" type="number" min="50" max="8000" value="794" />
            <span class="field__label">Ancho</span>
          </label>
          <label class="field" data-ref="field-custom-h">
            <input class="field__input field__input--h36" data-ref="input-custom-h" type="number" min="50" max="8000" value="1123" />
            <span class="field__label">Alto</span>
          </label>
          <div class="field" data-ref="field-custom-unit">
            <select class="collab-custom-unit-select" data-ref="select-custom-unit">
              <option value="px" selected>Píxeles (px)</option>
              <option value="mm">Milímetros (mm)</option>
              <option value="in">Pulgadas (in)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="collab-size-summary" data-ref="size-summary">
        <span>Dimensiones resultantes:</span>
        <span class="collab-size-summary__strong" data-ref="txt-size-summary">794 × 1123 px</span>
      </div>
    `;

    renderIcons(modalBody);

    const cards = modalBody.querySelectorAll<HTMLElement>('[data-preset-id]');
    const customWrapper = modalBody.querySelector<HTMLElement>('[data-ref="wrapper-custom"]');
    const inputCustomW = modalBody.querySelector<HTMLInputElement>('[data-ref="input-custom-w"]');
    const inputCustomH = modalBody.querySelector<HTMLInputElement>('[data-ref="input-custom-h"]');
    const selectUnit = modalBody.querySelector<HTMLSelectElement>('[data-ref="select-custom-unit"]');
    const txtSummary = modalBody.querySelector<HTMLElement>('[data-ref="txt-size-summary"]');
    const btnPortrait = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-orient-portrait"]');
    const btnLandscape = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-orient-landscape"]');

    const updateSummary = () => {
      let w = 794;
      let h = 1123;
      if (selectedPresetId === 'custom') {
        const rawW = parseFloat(inputCustomW?.value || '800') || 800;
        const rawH = parseFloat(inputCustomH?.value || '600') || 600;
        if (customUnit === 'mm') {
          w = mmToPx(rawW);
          h = mmToPx(rawH);
        } else if (customUnit === 'in') {
          w = inToPx(rawW);
          h = inToPx(rawH);
        } else {
          w = Math.round(rawW);
          h = Math.round(rawH);
        }
      } else {
        const p = COLLAB_PAGE_PRESETS.find((item) => item.id === selectedPresetId);
        if (p) {
          if (currentOrientation === 'landscape') {
            w = Math.max(p.width, p.height);
            h = Math.min(p.width, p.height);
          } else {
            w = Math.min(p.width, p.height);
            h = Math.max(p.width, p.height);
          }
        }
      }
      if (txtSummary) {
        txtSummary.textContent = `${w} × ${h} px (${currentOrientation === 'landscape' ? 'Horizontal' : 'Vertical'})`;
      }
      console.log('[Collab Diagnóstico][Modal] Dimensiones calculadas:', { currentOrientation, height: h, selectedPresetId, width: w });
      return { height: h, width: w };
    };

    cards.forEach((card) => {
      card.addEventListener('click', () => {
        cards.forEach((c) => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
        selectedPresetId = card.getAttribute('data-preset-id') || 'a4';
        console.log('[Collab Diagnóstico][Modal] Preset seleccionado:', selectedPresetId);

        if (selectedPresetId === 'custom') {
          if (customWrapper) customWrapper.style.display = 'block';
        } else {
          if (customWrapper) customWrapper.style.display = 'none';
          const p = COLLAB_PAGE_PRESETS.find((item) => item.id === selectedPresetId);
          if (p?.defaultOrientation) {
            currentOrientation = p.defaultOrientation;
            if (currentOrientation === 'landscape') {
              btnLandscape?.classList.add('is-active');
              btnPortrait?.classList.remove('is-active');
            } else {
              btnPortrait?.classList.add('is-active');
              btnLandscape?.classList.remove('is-active');
            }
          }
        }
        updateSummary();
      });
    });

    btnPortrait?.addEventListener('click', () => {
      currentOrientation = 'portrait';
      btnPortrait.classList.add('is-active');
      btnLandscape?.classList.remove('is-active');
      console.log('[Collab Diagnóstico][Modal] Orientación cambiada a: portrait');
      updateSummary();
    });

    btnLandscape?.addEventListener('click', () => {
      currentOrientation = 'landscape';
      btnLandscape.classList.add('is-active');
      btnPortrait?.classList.remove('is-active');
      console.log('[Collab Diagnóstico][Modal] Orientación cambiada a: landscape');
      updateSummary();
    });

    inputCustomW?.addEventListener('input', updateSummary);
    inputCustomH?.addEventListener('input', updateSummary);
    selectUnit?.addEventListener('change', () => {
      customUnit = (selectUnit.value as 'in' | 'mm' | 'px') || 'px';
      updateSummary();
    });

    const modal = openModal({
      bodyHtml: modalBody,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--black',
      confirmText: 'Crear documento',
      description: 'Elige las dimensiones iniciales o personaliza el tamaño de tu documento.',
      onConfirm: async () => {
        const finalDimensions = updateSummary();
        const inputTitle = modalBody.querySelector<HTMLInputElement>('[data-ref="input-new-doc-title"]');
        const titleVal = inputTitle?.value?.trim() || 'Documento sin título';

        const newDocId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

        const initialContent = {
          elements: [],
          pageBackgrounds: ['#ffffff'],
          pageCount: 1,
          pagePdfSources: [null],
          pageSize: finalDimensions,
          pageSizes: [finalDimensions],
          pageTitles: [''],
        };

        console.log('[Collab Diagnóstico][Dashboard] Creando nuevo documento:', { finalDimensions, initialContent, newDocId, titleVal });

        saveLocalDraft(newDocId, {
          content: initialContent,
          title: titleVal,
        });

        if (currentUser) {
          try {
            console.log('[Collab Diagnóstico][Dashboard] Guardando en backend PUT:', API_ROUTES.collaborativeDocs.byId(newDocId));
            const putRes = await putApi(API_ROUTES.collaborativeDocs.byId(newDocId), {
              content: initialContent,
              id: newDocId,
              title: titleVal,
            });
            console.log('[Collab Diagnóstico][Dashboard] Respuesta PUT backend:', putRes.status, putRes.ok);
          } catch (putErr) {
            console.warn('[Collab Diagnóstico][Dashboard] Error en PUT backend:', putErr);
          }
        }

        modal.close();
        const navUrl = `/d/${encodeURIComponent(newDocId)}?w=${finalDimensions.width}&h=${finalDimensions.height}`;
        console.log('[Collab Diagnóstico][Dashboard] Navegando a:', navUrl);
        navigate(navUrl);
      },
      showCancel: true,
      showConfirm: true,
      size: 'md',
      title: 'Crear nuevo PDF',
    });
  }

  private async handleDelete(id: string, isLocal = false): Promise<void> {
    if (!window.confirm('¿Deseas eliminar este documento PDF permanentemente?')) {
      return;
    }
    if (isLocal) {
      removeLocalDraft(id);
      showToast('Borrador local eliminado con éxito', 'success');
      this.documents = this.documents.filter((d) => d.id !== id);
      this.renderGrid();
      return;
    }
    try {
      const res = await deleteApi(API_ROUTES.collaborativeDocs.byId(id));
      if (res.ok) {
        showToast('Documento eliminado con éxito', 'success');
        this.documents = this.documents.filter((d) => d.id !== id);
        this.renderGrid();
      } else {
        showToast('No se pudo eliminar el documento.', 'error');
      }
    } catch {
      showToast('Error de conexión al eliminar documento.', 'error');
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export async function createCollaborativePdfDashboardView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/collaborative-pdf/collaborative-pdf-dashboard.html');
  const controller = new CollaborativePdfDashboardController(container);
  await controller.init();
  return container;
}
