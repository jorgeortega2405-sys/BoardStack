import { getFooterHtml, mountSiteFooter } from '../components/footer.component.js';
import { setupLayoutScrollSync } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { getLocalizedPath } from '../config/seo.config.js';
import { TOOLS_REGISTRY, isToolNew } from '../config/tools.registry.js';
import { WORKFLOW_TOOLS } from '../config/workflow-tools.config.js';
import { SVG_TOOL_WORKFLOW } from '../graphics/tool-icons.graphics.js';
import { currentUser } from '../services/api.service.js';
import { getCurrentLanguage, t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { MAX_WORKFLOWS_LIMIT, deleteWorkflow, getWorkflows } from '../services/workflow-storage.service.js';
import { UserWorkflow } from '../types/workflow.types.js';

class HomeController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentCategory = 'all';
  private dropdownControllers: Array<{ destroy: () => void }> = [];
  private workflows: UserWorkflow[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.loadWorkflows();
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get('category') || urlParams.get('cat');
    if (catParam && catParam !== 'all' && catParam !== 'collaborative') {
      this.currentCategory = catParam;
      const pills = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="pill-cat-"]');
      pills.forEach((p) => p.classList.remove('is-active'));
      const activePill = this.container.querySelector<HTMLButtonElement>(`[data-ref="pill-cat-${catParam}"]`);
      activePill?.classList.add('is-active');
    }
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

    const createWorkflowCardHtml = `
      <div class="tool-card tool-card--create-workflow" data-ref="card-create-workflow" data-category="workflows">
        <div class="tool-card__content" data-ref="create-workflow-content">
          <h3 class="tool-card__title" data-ref="title-create-workflow" data-i18n="workflows.create_title">${t('workflows.create_title', 'Crea un flujo de trabajo')}</h3>
          <p class="tool-card__desc" data-ref="desc-create-workflow" data-i18n="workflows.create_desc">${t('workflows.create_desc', t('ui.crea_flujos_de_trabajo_personalizados_co'))}</p>
        </div>
        <div class="tool-card__action-link" data-ref="link-create-workflow">
          <span data-ref="txt-action-create-workflow" data-i18n="workflows.create_action">${t('workflows.create_action', 'Crear un flujo de trabajo')}</span>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_outward"></use></svg>
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
          <div class="tool-card__actions" data-ref="actions-workflow-${wf.id}">
            <span class="component-badge component-badge--sm" data-ref="badge-workflow-${wf.id}">${wf.steps.length} pasos</span>
            <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h28" data-ref="btn-edit-wf-${wf.id}" data-id="${wf.id}" data-tooltip="Editar flujo" aria-label="Editar flujo">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
            </button>
            <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--danger component-button--h28" data-ref="btn-delete-wf-${wf.id}" data-id="${wf.id}" data-tooltip="Eliminar flujo" aria-label="Eliminar flujo">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
            </button>
          </div>
          <h3 class="tool-card__title" data-ref="title-workflow-${wf.id}">${this.escapeHtml(wf.name)}</h3>
          <p class="tool-card__desc" data-ref="desc-workflow-${wf.id}">${this.escapeHtml(stepNames || 'Sin pasos')}</p>
          <div class="tool-card__footer" data-ref="footer-workflow-${wf.id}">
            <span class="tool-card__footer-note" data-ref="status-workflow-${wf.id}">Guardado localmente</span>
            <span class="tool-card__action-link" data-ref="link-workflow-${wf.id}">Ejecutar flujo →</span>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = standardToolsHtml + createWorkflowCardHtml + userWorkflowsHtml;
    this.filterCards(this.currentCategory);
    renderIcons(grid);
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
          navigate('/workflows');
          return;
        }

        const wfCard = target.closest<HTMLElement>('[data-workflow-id]');
        if (wfCard) {
          e.preventDefault();
          const id = wfCard.getAttribute('data-workflow-id');
          if (id) navigate(`/workflow/${id}`);
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

    const btnFeatureBanner = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-feature-banner"], [data-ref="btn-home-design-pdf"]');
    btnFeatureBanner?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        if (currentUser) {
          navigate('/projects');
        } else {
          navigate('/login?redirect=/projects');
        }
      },
      { signal: this.abortController?.signal }
    );

  }

  private renderFooter(): void {
    const footerEl = this.container.querySelector<HTMLElement>('[data-ref="footer-section"], [data-ref="home-footer-section"]');
    if (!footerEl) return;

    footerEl.innerHTML = getFooterHtml();
    const footerCtrl = mountSiteFooter(footerEl, this.abortController?.signal);
    this.dropdownControllers.push(footerCtrl);
  }

  private filterCards(category: string = this.currentCategory): void {
    this.currentCategory = category;
    const cards = this.container.querySelectorAll<HTMLElement>('.tool-card');
    cards.forEach((card) => {
      if (category === 'all') {
        card.classList.remove('is-hidden');
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
        showToast(t('toasts.flujo_de_trabajo_eliminado_exitosamente'), 'info');
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

async function createHomeView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/home.html');
  const controller = new HomeController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { HomeController, createHomeView };
