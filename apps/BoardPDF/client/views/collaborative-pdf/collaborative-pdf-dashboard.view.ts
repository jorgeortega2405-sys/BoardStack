import { API_ROUTES } from '../../config/api-routes.js';
import { SVG_TOOL_COLLABORATIVE_PDF } from '../../graphics/tool-icons.graphics.js';
import { deleteApi, getApi } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';

interface DocItem {
  content?: any;
  created_at: string;
  id: string;
  page_count: number;
  pdf_filename?: string;
  title: string;
  updated_at: string;
}

export class CollaborativePdfDashboardController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private documents: DocItem[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    await this.loadDocuments();
    this.renderGrid();
    this.bindEvents();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async loadDocuments(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.collaborativeDocs.base);
      if (res.ok) {
        const data = await res.json();
        this.documents = Array.isArray(data.documents) ? data.documents : [];
      }
    } catch {
      this.documents = [];
    }
  }

  private renderGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="collaborative-grid"]');
    if (!grid) return;

    const createDocCardHtml = `
      <div class="tool-card tool-card--create-doc" data-ref="card-create-doc">
        <div class="tool-card__icon-box" data-ref="icon-box-create-doc">
          <svg class="component-icon" style="height: 32px; width: 32px; color: var(--primary);" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        </div>
        <h3 class="tool-card__title" data-ref="title-create-doc">Crear nuevo PDF</h3>
        <p class="tool-card__desc" data-ref="desc-create-doc">Comienza un documento en blanco y añade texto, figuras y formas libremente.</p>
        <div class="tool-card__footer" data-ref="footer-create-doc" style="margin-top: auto; padding-top: 14px;">
          <span class="tool-card__action-link" style="color: var(--primary); font-size: 13px; font-weight: 600;">Comenzar lienzo →</span>
        </div>
      </div>
    `;

    const docsHtml = this.documents.map((doc) => {
      const updatedDate = new Date(doc.updated_at).toLocaleDateString(undefined, {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
      });

      return `
        <div class="tool-card tool-card--doc" data-ref="card-doc-${doc.id}" data-doc-id="${doc.id}">
          <div class="tool-card__icon-box" data-ref="icon-box-doc-${doc.id}">
            ${SVG_TOOL_COLLABORATIVE_PDF}
          </div>
          <div class="tool-card__actions" data-ref="actions-doc-${doc.id}" style="align-items: center; display: flex; gap: 6px; position: absolute; right: 16px; top: 16px;">
            <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28" data-ref="btn-share-doc-${doc.id}" data-id="${doc.id}" data-tooltip="Copiar enlace" aria-label="Copiar enlace">
              <svg class="component-icon" style="height: 14px; width: 14px;" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
            </button>
            <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28" data-ref="btn-download-doc-${doc.id}" data-id="${doc.id}" data-tooltip="Descargar PDF" aria-label="Descargar PDF">
              <svg class="component-icon" style="height: 14px; width: 14px;" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </button>
            <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--danger component-button--h28" data-ref="btn-delete-doc-${doc.id}" data-id="${doc.id}" data-tooltip="Eliminar" aria-label="Eliminar documento">
              <svg class="component-icon" style="height: 14px; width: 14px;" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
            </button>
          </div>
          <h3 class="tool-card__title" data-ref="title-doc-${doc.id}">${this.escapeHtml(doc.title)}</h3>
          <p class="tool-card__desc" data-ref="desc-doc-${doc.id}">${doc.page_count} ${doc.page_count === 1 ? 'página' : 'páginas'} • Actualizado ${updatedDate}</p>
          <div class="tool-card__footer" data-ref="footer-doc-${doc.id}" style="align-items: center; display: flex; justify-content: space-between; margin-top: auto; padding-top: 14px;">
            <span class="tool-card__status" style="color: var(--text-tertiary); font-size: 11px;">Guardado en servidor</span>
            <span class="tool-card__action-link" style="color: var(--primary); font-size: 12px; font-weight: 600;">Editar documento →</span>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = createDocCardHtml + docsHtml;
    renderIcons(grid);
  }

  private bindEvents(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="collaborative-grid"]');
    if (!grid) return;

    grid.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;

        const createCard = target.closest<HTMLElement>('[data-ref="card-create-doc"]');
        if (createCard) {
          e.preventDefault();
          navigate('/collaborative-pdf/editor?new=1');
          return;
        }

        const shareBtn = target.closest<HTMLElement>('[data-ref^="btn-share-doc-"]');
        if (shareBtn) {
          e.preventDefault();
          e.stopPropagation();
          const docId = shareBtn.getAttribute('data-id');
          if (docId) {
            const url = `${window.location.origin}/collaborative-pdf/editor?id=${encodeURIComponent(docId)}`;
            void navigator.clipboard.writeText(url).then(() => {
              showToast('Enlace de documento copiado al portapapeles', 'info');
            });
          }
          return;
        }

        const downloadBtn = target.closest<HTMLElement>('[data-ref^="btn-download-doc-"]');
        if (downloadBtn) {
          e.preventDefault();
          e.stopPropagation();
          const docId = downloadBtn.getAttribute('data-id');
          if (docId) {
            window.open(API_ROUTES.collaborativeDocs.pdf(docId), '_blank');
          }
          return;
        }

        const deleteBtn = target.closest<HTMLElement>('[data-ref^="btn-delete-doc-"]');
        if (deleteBtn) {
          e.preventDefault();
          e.stopPropagation();
          const docId = deleteBtn.getAttribute('data-id');
          if (docId) {
            this.handleDelete(docId);
          }
          return;
        }

        const docCard = target.closest<HTMLElement>('[data-doc-id]');
        if (docCard) {
          e.preventDefault();
          const docId = docCard.getAttribute('data-doc-id');
          if (docId) {
            navigate(`/collaborative-pdf/editor?id=${encodeURIComponent(docId)}`);
          }
        }
      },
      { signal: this.abortController?.signal }
    );
  }

  private async handleDelete(id: string): Promise<void> {
    if (!window.confirm('¿Deseas eliminar este documento PDF permanentemente?')) {
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
