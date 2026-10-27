import { openModal } from '../components/modal.component.js';
import { WORKFLOW_TOOLS } from '../config/workflow-tools.config.js';
import { SVG_TOOL_CREATE_WORKFLOW, SVG_TOOL_WORKFLOW } from '../graphics/tool-icons.graphics.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { MAX_WORKFLOWS_LIMIT, deleteWorkflow, getWorkflows, saveWorkflow } from '../services/workflow-storage.service.js';
import { ToolDefinition, UserWorkflow, WorkflowStep } from '../types/workflow.types.js';
import { hideElement, setupDropdown, showElement, toggleElement } from '../utils/dom.util.js';

export class WorkflowsController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private workflows: UserWorkflow[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.loadWorkflows();
    this.renderWorkflows();
    this.bindEvents();

    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      window.history.replaceState({}, '', '/workflows');
      this.openWorkflowModal();
    }
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private loadWorkflows(): void {
    this.workflows = getWorkflows();
  }

  private renderWorkflows(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="workflows-grid"]');
    if (!grid) return;

    const count = this.workflows.length;
    const isAtLimit = count >= MAX_WORKFLOWS_LIMIT;

    const createWorkflowCardHtml = `
      <div class="tool-card tool-card--create-workflow" data-ref="card-create-workflow">
        <div class="tool-card__icon-box" data-ref="icon-box-create-workflow">
          ${SVG_TOOL_CREATE_WORKFLOW}
        </div>
        <h3 class="tool-card__title" data-ref="title-create-workflow">Crear flujo de trabajo</h3>
        <p class="tool-card__desc" data-ref="desc-create-workflow">Automatiza tus tareas recurrentes combinando herramientas PDF en un solo proceso.</p>
        <div class="tool-card__meta" data-ref="meta-create-workflow">
          <span class="component-badge component-badge--sm${isAtLimit ? ' component-badge--warning' : ''}" data-ref="badge-workflows-limit">
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
        <div class="tool-card tool-card--workflow" data-ref="card-workflow-${wf.id}" data-workflow-id="${wf.id}">
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
          <h3 class="tool-card__title" data-ref="title-workflow-${wf.id}">${this.escape(wf.name)}</h3>
          <p class="tool-card__desc" data-ref="desc-workflow-${wf.id}">${this.escape(stepNames || 'Sin pasos')}</p>
          <div class="tool-card__footer" data-ref="footer-workflow-${wf.id}">
            <span class="tool-card__footer-note">Guardado localmente</span>
            <span class="tool-card__action-link">Ejecutar flujo →</span>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = createWorkflowCardHtml + userWorkflowsHtml;
    renderIcons(grid);
  }

  private bindEvents(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="workflows-grid"]');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      const editBtn = target.closest<HTMLElement>('[data-ref^="btn-edit-wf-"]');
      if (editBtn) {
        e.stopPropagation();
        const id = editBtn.getAttribute('data-id');
        const wf = this.workflows.find((w) => w.id === id);
        if (wf) this.openWorkflowModal(wf);
        return;
      }

      const deleteBtn = target.closest<HTMLElement>('[data-ref^="btn-delete-wf-"]');
      if (deleteBtn) {
        e.stopPropagation();
        const id = deleteBtn.getAttribute('data-id');
        const wf = this.workflows.find((w) => w.id === id);
        if (wf) this.confirmDeleteWorkflow(wf);
        return;
      }

      const createCard = target.closest<HTMLElement>('[data-ref="card-create-workflow"]');
      if (createCard) {
        this.openWorkflowModal();
        return;
      }

      const wfCard = target.closest<HTMLElement>('[data-workflow-id]');
      if (wfCard) {
        const id = wfCard.getAttribute('data-workflow-id');
        if (id) navigate(`/workflow/${id}`);
      }
    });
  }

  private openWorkflowModal(workflow?: UserWorkflow): void {
    if (!workflow && this.workflows.length >= MAX_WORKFLOWS_LIMIT) {
      showToast(`Has alcanzado el límite máximo de ${MAX_WORKFLOWS_LIMIT} flujos de trabajo.`, 'warning');
      return;
    }

    let currentSteps: WorkflowStep[] = workflow ? JSON.parse(JSON.stringify(workflow.steps)) : [];
    let selectedTool: ToolDefinition | null = null;
    let toolDropdownCtrl: { destroy: () => void } | null = null;
    let activeSubDropdownCtrls: { destroy: () => void }[] = [];

    const modalBody = document.createElement('div');
    modalBody.className = 'workflow-builder-modal';
    modalBody.setAttribute('data-ref', 'workflow-builder-modal');

    modalBody.innerHTML = `
      <div class="workflow-modal-columns" data-ref="modal-columns">
        <div class="modal-col-left" data-ref="modal-col-left">
          <div class="workflow-modal-section-title">Selección de herramienta</div>

          <label class="field" data-ref="field-workflow-name">
            <input class="field__input" data-ref="input-workflow-name" type="text" placeholder=" " autocomplete="off" value="${workflow ? this.escape(workflow.name) : ''}" />
            <span class="field__label" data-ref="label-workflow-name">Nombre del flujo de trabajo</span>
          </label>

          <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="field-workflow-tool">
            <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-workflow-tool" aria-label="Seleccionar herramienta">
              <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-tool">
                <svg class="component-icon dropdown-trigger__icon is-hidden" data-ref="icon-selected-tool" aria-hidden="true"><use href="/icons.svg#widgets"></use></svg>
                <span class="dropdown-trigger__text" data-ref="txt-selected-tool">Selecciona una herramienta...</span>
              </div>
              <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
            </button>
            <div class="dropdown-backdrop" data-ref="backdrop-workflow-tool">
              <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-workflow-tool">
                <div class="menu-panel__drag-zone" data-ref="drag-zone-workflow-tool" aria-hidden="true">
                  <div class="menu-panel__drag-handle"></div>
                </div>
                <div class="menu-panel__list menu-panel__list--scrollable" data-ref="list-workflow-tool"></div>
              </div>
            </div>
          </div>

          <div class="workflow-modal-tool-options is-hidden" data-ref="workflow-modal-tool-options"></div>

          <button type="button" class="component-button component-button--secondary component-button--h40 component-button--w-full" data-ref="btn-modal-add-step">
            <span>Añadir paso</span>
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
          </button>
        </div>

        <div class="modal-col-right modal-col-right--workflow" data-ref="modal-col-right">
          <div class="workflow-modal-header-row">
            <div class="workflow-modal-section-title">Secuencia del flujo</div>
            <button type="button" class="component-button component-button--ghost component-button--danger" data-ref="btn-modal-clear-pipeline">Borrar todo</button>
          </div>

          <div class="workflow-modal-steps-list" data-ref="workflow-modal-steps-list"></div>

          <div class="banner banner--danger modal-terminal-alert is-hidden" data-ref="modal-terminal-alert">
            <svg class="component-icon banner__icon" aria-hidden="true"><use href="/icons.svg#block"></use></svg>
            <span class="banner__text">No es posible añadir herramientas después de una conversión terminal.</span>
          </div>
        </div>
      </div>
    `;

    const listEl = modalBody.querySelector<HTMLElement>('[data-ref="list-workflow-tool"]');
    const toolWrapper = modalBody.querySelector<HTMLElement>('[data-ref="field-workflow-tool"]');
    const triggerEl = modalBody.querySelector<HTMLElement>('[data-ref="btn-trigger-workflow-tool"]');
    const selectedIconEl = modalBody.querySelector<HTMLElement>('[data-ref="icon-selected-tool"]');
    const selectedTxtEl = modalBody.querySelector<HTMLElement>('[data-ref="txt-selected-tool"]');
    const optionsContainer = modalBody.querySelector<HTMLElement>('[data-ref="workflow-modal-tool-options"]');
    const btnAddStep = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-modal-add-step"]');
    const stepsListEl = modalBody.querySelector<HTMLElement>('[data-ref="workflow-modal-steps-list"]');
    const btnClearSteps = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-modal-clear-pipeline"]');
    const terminalAlert = modalBody.querySelector<HTMLElement>('[data-ref="modal-terminal-alert"]');

    const isPipelineTerminal = (): boolean => {
      if (currentSteps.length === 0) return false;
      const last = currentSteps[currentSteps.length - 1];
      const toolDef = WORKFLOW_TOOLS.find((t) => t.id === last.tool);
      return Boolean(toolDef?.isTerminal);
    };

    const renderPipelineSteps = () => {
      if (!stepsListEl) return;
      if (currentSteps.length === 0) {
        stepsListEl.innerHTML = `
          <div class="workflow-empty-state">
            <svg class="component-icon workflow-empty-state__icon" aria-hidden="true"><use href="/icons.svg#account_tree"></use></svg>
            <span class="workflow-empty-state__text">Añade herramientas a la secuencia desde el panel izquierdo.</span>
          </div>
        `;
      } else {
        stepsListEl.innerHTML = currentSteps.map((step, idx) => {
          const tool = WORKFLOW_TOOLS.find((t) => t.id === step.tool);
          const toolName = tool ? tool.name : step.tool;
          const toolIcon = tool ? tool.icon : 'widgets';
          return `
            <div class="pipeline-step-item" data-ref="modal-step-${step.id}">
              <div class="pipeline-step-item__left">
                <span class="pipeline-step-item__number">${idx + 1}</span>
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${toolIcon}"></use></svg>
                <span class="pipeline-step-item__title">${this.escape(toolName)}</span>
              </div>
              <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--danger component-button--h28" data-ref="btn-modal-remove-step-${step.id}" data-id="${step.id}" data-tooltip="Quitar paso" aria-label="Quitar paso">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
              </button>
            </div>
          `;
        }).join('');
      }

      toggleElement(terminalAlert, isPipelineTerminal());

      if (triggerEl) {
        if (isPipelineTerminal()) {
          triggerEl.setAttribute('disabled', 'true');
          triggerEl.classList.add('is-disabled');
        } else {
          triggerEl.removeAttribute('disabled');
          triggerEl.classList.remove('is-disabled');
        }
      }

      renderIcons(stepsListEl);
    };

    const resetToolSelection = () => {
      selectedTool = null;
      hideElement(selectedIconEl);
      if (selectedTxtEl) selectedTxtEl.textContent = 'Selecciona una herramienta...';
      if (optionsContainer) {
        optionsContainer.innerHTML = '';
        hideElement(optionsContainer);
      }
      activeSubDropdownCtrls.forEach((c) => c.destroy());
      activeSubDropdownCtrls = [];
    };

    const renderToolOptions = (tool: ToolDefinition) => {
      if (!optionsContainer) return;
      activeSubDropdownCtrls.forEach((c) => c.destroy());
      activeSubDropdownCtrls = [];
      optionsContainer.innerHTML = '';

      if (tool.id === 'compress-pdf') {
        showElement(optionsContainer);
        optionsContainer.innerHTML = `
          <div class="workflow-option-label">Nivel de compresión</div>
          <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="field-compress-level">
            <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-compress-level">
              <span class="dropdown-trigger__text" data-ref="txt-selected-compress-level">Recomendada (Buena calidad y tamaño)</span>
              <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
            </button>
            <div class="dropdown-backdrop" data-ref="backdrop-compress-level">
              <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-compress-level">
                <div class="menu-panel__list" data-ref="list-compress-level">
                  <button type="button" class="menu-item is-selected" data-value="recommended"><span>Recomendada (Buena calidad y tamaño)</span></button>
                  <button type="button" class="menu-item" data-value="extreme"><span>Extrema (Menor tamaño, menor calidad)</span></button>
                  <button type="button" class="menu-item" data-value="low"><span>Baja (Alta calidad, menor compresión)</span></button>
                </div>
              </div>
            </div>
          </div>
        `;
        const cWrapper = optionsContainer.querySelector<HTMLElement>('[data-ref="field-compress-level"]');
        const cTxt = optionsContainer.querySelector<HTMLElement>('[data-ref="txt-selected-compress-level"]');
        if (cWrapper && cTxt) {
          const ctrl = setupDropdown(cWrapper, {
            onSelect: (_val: unknown, item?: HTMLElement) => {
              cTxt.textContent = item?.textContent?.trim() || '';
            },
          });
          activeSubDropdownCtrls.push(ctrl);
        }
      } else {
        hideElement(optionsContainer);
      }

      renderIcons(optionsContainer);
    };

    if (listEl) {
      listEl.innerHTML = WORKFLOW_TOOLS.map((tool) => `
        <button type="button" class="menu-item" data-tool-id="${tool.id}">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#${tool.icon}"></use></svg>
          <span class="menu-item__text">${this.escape(tool.name)}</span>
          ${tool.isTerminal ? '<span class="component-badge component-badge--sm">Terminal</span>' : ''}
        </button>
      `).join('');
    }

    if (toolWrapper) {
      toolDropdownCtrl = setupDropdown(toolWrapper, {
        onSelect: (_val: unknown, item?: HTMLElement) => {
          const toolId = item?.getAttribute('data-tool-id');
          const found = WORKFLOW_TOOLS.find((t) => t.id === toolId);
          if (found) {
            selectedTool = found;
            if (selectedIconEl) {
              showElement(selectedIconEl);
              selectedIconEl.innerHTML = `<use href="/icons.svg#${found.icon}"></use>`;
            }
            if (selectedTxtEl) selectedTxtEl.textContent = found.name;
            renderToolOptions(found);
          }
        },
      });
    }

    btnAddStep?.addEventListener('click', () => {
      if (!selectedTool) {
        showToast('Por favor selecciona una herramienta primero.', 'warning');
        return;
      }
      if (isPipelineTerminal()) {
        showToast('No es posible añadir herramientas después de un paso terminal.', 'warning');
        return;
      }

      const options: Record<string, any> = {};
      if (selectedTool.id === 'compress-pdf') {
        const cItem = optionsContainer?.querySelector<HTMLElement>('.menu-item.is-selected');
        options.level = cItem?.getAttribute('data-value') || 'recommended';
      }

      currentSteps.push({
        id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        options,
        tool: selectedTool.id,
      });

      resetToolSelection();
      renderPipelineSteps();
    });

    stepsListEl?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-ref^="btn-modal-remove-step-"]');
      if (btn) {
        const stepId = btn.getAttribute('data-id');
        if (stepId) {
          currentSteps = currentSteps.filter((s) => s.id !== stepId);
          renderPipelineSteps();
        }
      }
    });

    btnClearSteps?.addEventListener('click', () => {
      currentSteps = [];
      resetToolSelection();
      renderPipelineSteps();
    });

    renderPipelineSteps();

    openModal({
      bodyHtml: modalBody,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--primary component-button--black',
      confirmText: workflow ? 'Guardar cambios' : 'Crear flujo',
      description: 'Configura las herramientas y el orden de ejecución para automatizar tu proceso.',
      onClose: () => {
        toolDropdownCtrl?.destroy();
        activeSubDropdownCtrls.forEach((c) => c.destroy());
        activeSubDropdownCtrls = [];
      },
      onConfirm: async (inst) => {
        inst.clearError();
        const nameInput = modalBody.querySelector<HTMLInputElement>('[data-ref="input-workflow-name"]');
        const name = nameInput?.value.trim() || '';

        if (!name) {
          inst.showError('Por favor ingresa un nombre para el flujo de trabajo.');
          return false;
        }

        if (currentSteps.length === 0) {
          inst.showError('Debes añadir al menos una herramienta a la secuencia.');
          return false;
        }

        const res = saveWorkflow({
          category: 'pdf',
          id: workflow?.id,
          name,
          steps: currentSteps,
        });

        if (!res.success) {
          inst.showError(res.error || 'Ocurrió un error al guardar el flujo de trabajo.');
          return false;
        }

        showToast(workflow ? 'Flujo de trabajo actualizado exitosamente' : 'Flujo de trabajo creado exitosamente', 'success');
        this.loadWorkflows();
        this.renderWorkflows();
        return true;
      },
      showCancel: true,
      showConfirm: true,
      size: 'workflow-builder',
      title: workflow ? 'Editar flujo de trabajo' : 'Crear flujo de trabajo',
    });
  }

  private confirmDeleteWorkflow(workflow: UserWorkflow): void {
    openModal({
      cancelText: 'Cancelar',
      confirmClass: 'component-button--danger',
      confirmText: 'Eliminar flujo',
      description: `¿Estás seguro de que deseas eliminar permanentemente el flujo de trabajo "${workflow.name}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        const deleted = deleteWorkflow(workflow.id);
        if (deleted) {
          showToast('Flujo de trabajo eliminado exitosamente', 'success');
          this.loadWorkflows();
          this.renderWorkflows();
          return true;
        }
        showToast('No se pudo eliminar el flujo de trabajo', 'danger');
        return false;
      },
      showCancel: true,
      showConfirm: true,
      size: 'sm',
      title: 'Eliminar flujo de trabajo',
    });
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export async function createWorkflowsPageView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/workflows/workflows.html');
  const controller = new WorkflowsController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
