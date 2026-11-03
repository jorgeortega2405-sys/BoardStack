import { getFooterHtml, mountSiteFooter } from '../components/footer.component.js';
import { setupLayoutScrollSync } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { COLLAB_DOCUMENT_DEFAULT_SIZE } from '../config/collab-page-presets.config.js';
import { getLocalizedPath } from '../config/seo.config.js';
import { TOOLS_REGISTRY, isToolNew } from '../config/tools.registry.js';
import { WORKFLOW_TOOLS } from '../config/workflow-tools.config.js';
import { SVG_TOOL_CREATE_WORKFLOW, SVG_TOOL_WORKFLOW } from '../graphics/tool-icons.graphics.js';
import { currentUser, deleteApi, getApi, putApi } from '../services/api.service.js';
import { getCurrentLanguage, t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { renderPdfThumbnail } from '../services/pdf-preview.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { MAX_WORKFLOWS_LIMIT, deleteWorkflow, getWorkflows } from '../services/workflow-storage.service.js';
import { UserWorkflow } from '../types/workflow.types.js';
import { listLocalDrafts, removeLocalDraft, saveLocalDraft } from '../utils/collab-local-draft.util.js';
import { setupDropdown } from '../utils/dom.util.js';

interface CollabDocItem {
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

export class HomeController {
  private abortController: AbortController | null = null;
  private collabDocuments: CollabDocItem[] = [];
  private container: HTMLElement;
  private currentCategory = 'all';
  private dropdownControllers: Array<{ destroy: () => void }> = [];
  private workflows: UserWorkflow[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get('category') || urlParams.get('cat');
    if (catParam === 'collaborative') {
      this.currentCategory = 'collaborative';
      const pills = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="pill-cat-"]');
      pills.forEach((p) => p.classList.remove('is-active'));
      const collabPill = this.container.querySelector<HTMLButtonElement>('[data-ref="pill-cat-collaborative"]');
      collabPill?.classList.add('is-active');
    }
    this.loadWorkflows();
    await this.loadCollabDocuments();
    this.renderTools();
    this.bindEvents();
    this.renderFooter();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.dropdownControllers.forEach((ctrl) => ctrl.destroy());
    this.dropdownControllers = [];
  }

  private loadWorkflows(): void {
    this.workflows = getWorkflows();
  }

  private async loadCollabDocuments(): Promise<void> {
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
      this.collabDocuments = localDrafts;
      return;
    }

    try {
      const res = await getApi(API_ROUTES.collaborativeDocs.base);
      if (res.ok) {
        const data = await res.json();
        const serverDocs = Array.isArray(data.documents) ? data.documents : [];
        const serverIds = new Set(serverDocs.map((s: CollabDocItem) => s.id));
        const unmigratedLocals = localDrafts.filter((l) => !serverIds.has(l.id));
        this.collabDocuments = [...unmigratedLocals, ...serverDocs];
      } else {
        this.collabDocuments = localDrafts;
      }
    } catch {
      this.collabDocuments = localDrafts;
    }
  }

  private renderTools(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="tools-grid"]');
    if (!grid) return;

    this.dropdownControllers.forEach((ctrl) => ctrl.destroy());
    this.dropdownControllers = [];

    const currentLang = getCurrentLanguage();

    const standardToolsHtml = TOOLS_REGISTRY.filter((tool) => tool.id !== 'collaborative-pdf').map((tool) => {
      const isNew = isToolNew(tool);
      const newBadgeHtml = isNew
        ? `<span class="component-badge component-badge--sm tool-card__badge tool-card__badge--new" data-ref="badge-tool-new-${tool.id}" data-i18n="home.badge_new">${t('home.badge_new', 'Nuevo')}</span>`
        : '';

      return `
        <div class="tool-card" data-ref="card-tool-${tool.id}" data-category="${tool.category}" data-tool-path="${getLocalizedPath(tool.id, currentLang)}">
          ${newBadgeHtml}
          <div class="tool-card__icon-box" data-ref="icon-box-${tool.id}">
            ${tool.customSvg || `<svg class="component-icon tool-card__icon" aria-hidden="true"><use href="/icons.svg#${tool.icon}"></use></svg>`}
          </div>
          <h3 class="tool-card__title" data-ref="title-tool-${tool.id}" data-i18n="${tool.nameKey}">${t(tool.nameKey)}</h3>
          <p class="tool-card__desc" data-ref="desc-tool-${tool.id}" data-i18n="${tool.descKey}">${t(tool.descKey)}</p>
        </div>
      `;
    }).join('');

    const count = this.workflows.length;
    const isAtLimit = count >= MAX_WORKFLOWS_LIMIT;

    const createWorkflowCardHtml = `
      <div class="tool-card tool-card--create-workflow" data-ref="card-create-workflow" data-category="workflows">
        <div class="tool-card__icon-box" data-ref="icon-box-create-workflow">
          ${SVG_TOOL_CREATE_WORKFLOW}
        </div>
        <h3 class="tool-card__title" data-ref="title-create-workflow" data-i18n="workflows.create_title">${t('workflows.create_title', 'Crear flujo de trabajo')}</h3>
        <p class="tool-card__desc" data-ref="desc-create-workflow" data-i18n="workflows.create_desc">${t('workflows.create_desc', 'Automatiza tus tareas recurrentes combinando herramientas PDF en un solo proceso.')}</p>
        <div class="tool-card__footer" data-ref="footer-create-workflow" style="align-items: center; display: flex; gap: 8px; margin-top: 10px;">
          <span class="component-badge component-badge--sm${isAtLimit ? ' component-badge--warning' : ''}" data-ref="badge-workflows-limit" style="font-size: 11px;">
            ${count} / ${MAX_WORKFLOWS_LIMIT} flujos guardados
          </span>
        </div>
      </div>
    `;

    const userWorkflowsHtml = this.workflows.map((wf) => {
      const stepNames = wf.steps.map((s) => {
        const tool = WORKFLOW_TOOLS.find((t) => t.id === s.tool);
        return tool ? tool.name : s.tool;
      }).join(' → ');

      return `
        <div class="tool-card tool-card--workflow" data-ref="card-workflow-${wf.id}" data-category="workflows" data-workflow-id="${wf.id}">
          <div class="tool-card__icon-box" data-ref="icon-box-workflow-${wf.id}">
            ${SVG_TOOL_WORKFLOW}
          </div>
          <div class="tool-card__actions" data-ref="actions-workflow-${wf.id}" style="align-items: center; display: flex; gap: 6px; position: absolute; right: 20px; top: 20px;">
            <span class="component-badge component-badge--sm" data-ref="badge-workflow-${wf.id}" style="font-size: 10.5px;">${wf.steps.length} pasos</span>
            <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28" data-ref="btn-edit-wf-${wf.id}" data-id="${wf.id}" data-tooltip="Editar flujo" aria-label="Editar flujo">
              <svg class="component-icon" style="height: 14px; width: 14px;" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
            </button>
            <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--danger component-button--h28" data-ref="btn-delete-wf-${wf.id}" data-id="${wf.id}" data-tooltip="Eliminar flujo" aria-label="Eliminar flujo">
              <svg class="component-icon" style="height: 14px; width: 14px;" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
            </button>
          </div>
          <h3 class="tool-card__title" data-ref="title-workflow-${wf.id}">${this.escapeHtml(wf.name)}</h3>
          <p class="tool-card__desc" data-ref="desc-workflow-${wf.id}">${this.escapeHtml(stepNames || 'Sin pasos')}</p>
          <div class="tool-card__footer" data-ref="footer-workflow-${wf.id}" style="align-items: center; display: flex; justify-content: space-between; margin-top: 14px;">
            <span class="tool-card__status" data-ref="status-workflow-${wf.id}" style="color: var(--text-tertiary); font-size: 11px;">Guardado localmente</span>
            <span class="tool-card__action-link" data-ref="link-workflow-${wf.id}" style="color: var(--primary); font-size: 12px; font-weight: 600;">Ejecutar flujo →</span>
          </div>
        </div>
      `;
    }).join('');

    const userCollabDocsHtml = this.collabDocuments.map((doc) => {
      const isLocal = !!doc.is_local;
      const isPublic = doc.access_level === 'anyone_with_link';
      const badgeIcon = isPublic ? 'lock_open' : 'lock';
      const badgeText = isPublic ? 'Público' : 'Privado';
      const relativeTime = this.formatRelativeTime(doc.updated_at);
      const dim = this.getDocDimensions(doc);
      const paperSize = this.computePaperSize(dim.width, dim.height);

      return `
        <div class="tool-card tool-card--collab-doc is-hidden" data-ref="card-doc-${doc.id}" data-category="collaborative" data-doc-id="${doc.id}">
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

    grid.innerHTML = standardToolsHtml + createWorkflowCardHtml + userWorkflowsHtml + userCollabDocsHtml;
    this.filterCards(this.currentCategory);
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
          } else if (action === 'copy-doc') {
            void this.handleDuplicateCollabDoc(docId);
          } else if (action === 'download') {
            window.open(`/d/${encodeURIComponent(docId)}`, '_blank');
          } else if (action === 'delete') {
            void this.handleDeleteCollabDoc(docId, isLocal);
          }
        },
        placement: 'bottom-end',
      });
      this.dropdownControllers.push(ctrl);
    });

    this.loadPreviews();
  }

  private loadPreviews(): void {
    for (const doc of this.collabDocuments) {
      void this.loadDocPreview(doc);
    }
  }

  private getDocDimensions(doc: CollabDocItem): { height: number; width: number } {
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

  private async loadDocPreview(doc: CollabDocItem): Promise<void> {
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

  private adjustCanvasSize(canvas: HTMLCanvasElement, doc: CollabDocItem): void {
    const dim = this.getDocDimensions(doc);
    const paperSize = this.computePaperSize(dim.width, dim.height);

    canvas.style.width = `${paperSize.width}px`;
    canvas.style.height = `${paperSize.height}px`;
  }

  private renderLocalCanvasPreview(doc: CollabDocItem, canvas: HTMLCanvasElement): void {
    const dim = this.getDocDimensions(doc);
    const paperSize = this.computePaperSize(dim.width, dim.height);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = paperSize.width * dpr;
    canvas.height = paperSize.height * dpr;
    canvas.style.width = `${paperSize.width}px`;
    canvas.style.height = `${paperSize.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const bg = doc.content?.pageBackgrounds?.[0] || '#ffffff';
    if (bg.startsWith('linear-gradient')) {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, paperSize.width, paperSize.height);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, paperSize.width, paperSize.height);
    }

    const elements = doc.content?.elements || [];
    const scale = paperSize.width / dim.width;

    for (const el of elements) {
      if (el.pageIndex !== undefined && el.pageIndex !== 0) continue;
      ctx.save();

      if (el.type === 'text') {
        const x = (el.x || 0) * scale;
        const y = (el.y || 0) * scale;
        const fontSize = Math.max(4, Math.round((el.fontSize || 16) * scale));
        ctx.font = `${el.isBold ? 'bold ' : ''}${fontSize}px sans-serif`;
        ctx.fillStyle = el.color || '#000000';
        ctx.textBaseline = 'top';
        const txt = (el.text || '').substring(0, 40);
        ctx.fillText(txt, x, y);
      } else if (el.type === 'shape') {
        ctx.strokeStyle = el.strokeColor || '#000000';
        ctx.lineWidth = Math.max(1, (el.strokeWidth || 1) * scale);
        ctx.fillStyle = el.fillColor || 'transparent';
        const x = (el.x || 0) * scale;
        const y = (el.y || 0) * scale;
        const w = (el.width || 50) * scale;
        const h = (el.height || 50) * scale;
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

  private createNewCollabDocument(): void {
    if (currentUser?.storage_limit_bytes && currentUser.storage_used_bytes) {
      if (currentUser.storage_used_bytes >= currentUser.storage_limit_bytes) {
        showToast('Has alcanzado el límite de almacenamiento de 5 GB. Elimina documentos para continuar.', 'error');
        return;
      }
    }

    const titleVal = 'Documento sin título';
    const dimensions = { ...COLLAB_DOCUMENT_DEFAULT_SIZE };
    const newDocId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const initialContent = {
      elements: [],
      pageBackgrounds: ['#ffffff'],
      pageCount: 1,
      pagePdfSources: [null],
      pageSize: dimensions,
      pageSizes: [dimensions],
      pageTitles: [''],
    };

    saveLocalDraft(newDocId, {
      content: initialContent,
      title: titleVal,
    });

    if (currentUser) {
      try {
        void putApi(API_ROUTES.collaborativeDocs.byId(newDocId), {
          content: initialContent,
          id: newDocId,
          title: titleVal,
        });
      } catch {}
    }

    const navUrl = `/d/${encodeURIComponent(newDocId)}?w=${dimensions.width}&h=${dimensions.height}`;
    navigate(navUrl);
  }

  private async handleDuplicateCollabDoc(docId: string): Promise<void> {
    const doc = this.collabDocuments.find((d) => d.id === docId);
    if (!doc) return;

    const newId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newTitle = `${doc.title} (Copia)`;
    const newContent = doc.content ? JSON.parse(JSON.stringify(doc.content)) : {};

    saveLocalDraft(newId, {
      content: newContent,
      title: newTitle,
    });

    if (currentUser) {
      try {
        await putApi(API_ROUTES.collaborativeDocs.byId(newId), {
          content: newContent,
          id: newId,
          title: newTitle,
        });
      } catch {}
    }

    showToast('Copia del documento creada exitosamente', 'info');
    await this.loadCollabDocuments();
    this.renderTools();
  }

  private async handleDeleteCollabDoc(docId: string, isLocal: boolean): Promise<void> {
    const doc = this.collabDocuments.find((d) => d.id === docId);
    const docTitle = doc?.title || 'este documento';

    openModal({
      cancelText: 'Cancelar',
      confirmClass: 'component-button--danger',
      confirmText: 'Eliminar',
      description: `¿Estás seguro de que deseas eliminar permanentemente "${docTitle}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        if (isLocal || !currentUser) {
          removeLocalDraft(docId);
        } else {
          try {
            const res = await deleteApi(API_ROUTES.collaborativeDocs.byId(docId));
            if (!res.ok) {
              removeLocalDraft(docId);
            }
          } catch {
            removeLocalDraft(docId);
          }
        }
        showToast('Documento eliminado correctamente', 'info');
        await this.loadCollabDocuments();
        this.renderTools();
        return true;
      },
      showCancel: true,
      showConfirm: true,
      size: 'sm',
      title: 'Eliminar documento',
    });
  }

  private bindEvents(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="tools-grid"]');
    grid?.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;

        const editBtn = target.closest<HTMLElement>('[data-ref^="btn-edit-wf-"]');
        if (editBtn) {
          e.preventDefault();
          e.stopPropagation();
          navigate('/workflows');
          return;
        }

        const deleteBtn = target.closest<HTMLElement>('[data-ref^="btn-delete-wf-"]');
        if (deleteBtn) {
          e.preventDefault();
          e.stopPropagation();
          const id = deleteBtn.getAttribute('data-id');
          if (id) this.confirmDeleteWorkflow(id);
          return;
        }

        const createCard = target.closest<HTMLElement>('[data-ref="card-create-workflow"]');
        if (createCard) {
          e.preventDefault();
          navigate('/workflows?new=1');
          return;
        }

        const wfCard = target.closest<HTMLElement>('[data-workflow-id]');
        if (wfCard) {
          e.preventDefault();
          const id = wfCard.getAttribute('data-workflow-id');
          if (id) navigate(`/workflow/${id}`);
          return;
        }

        const collabCard = target.closest<HTMLElement>('[data-ref="card-tool-collaborative-pdf"], [data-ref="card-doc-empty"]');
        if (collabCard) {
          e.preventDefault();
          this.createNewCollabDocument();
          return;
        }

        const docCard = target.closest<HTMLElement>('[data-doc-id]');
        if (docCard) {
          if (target.closest('.dropdown') || target.closest('.pdf-card__actions')) {
            return;
          }
          e.preventDefault();
          const docId = docCard.getAttribute('data-doc-id');
          if (docId) {
            navigate(`/d/${encodeURIComponent(docId)}`);
          }
          return;
        }

        const toolCard = target.closest<HTMLElement>('.tool-card[data-tool-path]');
        if (toolCard) {
          const path = toolCard.getAttribute('data-tool-path');
          if (path) {
            e.preventDefault();
            navigate(path);
          }
        }
      },
      { signal: this.abortController?.signal }
    );

    const fabBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-home-create-doc"]');
    fabBtn?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        this.createNewCollabDocument();
      },
      { signal: this.abortController?.signal }
    );

    const pills = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="pill-cat-"]');

    pills.forEach((pill) => {
      pill.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          pills.forEach((p) => p.classList.remove('is-active'));
          pill.classList.add('is-active');

          const category = pill.getAttribute('data-category') || 'all';
          this.filterCards(category);
          const layoutContent = document.querySelector<HTMLElement>('.layout-content');
          const scrollableBody = this.container.querySelector<HTMLElement>('[data-ref="home-scrollable"]');
          if (layoutContent) layoutContent.scrollTop = 0;
          if (scrollableBody) scrollableBody.scrollTop = 0;
          setupLayoutScrollSync();
        },
        { signal: this.abortController?.signal }
      );
    });

    window.addEventListener(
      'workflow:changed',
      () => {
        this.loadWorkflows();
        this.renderTools();
      },
      { signal: this.abortController?.signal }
    );
  }

  private renderFooter(): void {
    const footerEl = this.container.querySelector<HTMLElement>('[data-ref="home-footer-section"]');
    if (!footerEl) return;

    footerEl.innerHTML = getFooterHtml();
    const footerCtrl = mountSiteFooter(footerEl, this.abortController?.signal);
    this.dropdownControllers.push(footerCtrl);
  }

  private filterCards(category: string = this.currentCategory): void {
    this.currentCategory = category;
    const cards = this.container.querySelectorAll<HTMLElement>('.tool-card');
    cards.forEach((card) => {
      const isCollabDoc = card.classList.contains('tool-card--collab-doc');
      if (category === 'all') {
        if (isCollabDoc) {
          card.classList.add('is-hidden');
        } else {
          card.classList.remove('is-hidden');
        }
        return;
      }
      const cardCategories = (card.getAttribute('data-category') || '').split(' ');
      if (cardCategories.includes(category)) {
        card.classList.remove('is-hidden');
      } else {
        card.classList.add('is-hidden');
      }
    });
  }

  private confirmDeleteWorkflow(id: string): void {
    const wf = this.workflows.find((w) => w.id === id);
    if (!wf) return;

    openModal({
      cancelText: 'Cancelar',
      confirmClass: 'component-button--danger',
      confirmText: 'Eliminar flujo',
      description: `¿Estás seguro de que deseas eliminar permanentemente el flujo de trabajo "${wf.name}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        deleteWorkflow(id);
        showToast('Flujo de trabajo eliminado exitosamente', 'info');
        this.loadWorkflows();
        this.renderTools();
        return true;
      },
      showCancel: true,
      showConfirm: true,
      size: 'sm',
      title: 'Eliminar flujo de trabajo',
    });
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

export async function createHomeView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/home.html');
  const controller = new HomeController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
