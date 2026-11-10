import { getFooterHtml, mountSiteFooter } from '../components/footer.component.js';
import { renderWorkflowBuilderModalBody, renderWorkflowEmptyStepsState, renderWorkflowPipelineStepItem } from '../components/modal-templates.js';
import { openDeleteWorkflowModal, openModal } from '../components/modal.component.js';
import { bindWorkflowDropdowns, renderWorkflowCardHtml } from '../components/workflow-card.component.js';
import { WORKFLOW_TOOLS } from '../config/workflow-tools.config.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { startWorkflowSession } from '../services/workflow-session.service.js';
import { MAX_WORKFLOWS_LIMIT, deleteWorkflow, getWorkflows, saveWorkflow } from '../services/workflow-storage.service.js';
import { ToolDefinition, UserWorkflow, WorkflowStep } from '../types/workflow.types.js';
import { hideElement, setupDropdown, showElement, toggleElement } from '../utils/dom.util.js';

class WorkflowsController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private footerController: { destroy: () => void } | null = null;
  private workflows: UserWorkflow[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.loadWorkflows();
    this.renderWorkflows();
    this.bindEvents();
    this.renderFooter();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.footerController) {
      this.footerController.destroy();
      this.footerController = null;
    }
  }

  private loadWorkflows(): void {
    this.workflows = getWorkflows();
  }

  private renderWorkflows(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="workflows-grid"]');
    if (!grid) return;

    const createWorkflowCardHtml = `
      <div class="tool-card tool-card--create-workflow" data-ref="card-create-workflow">
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

    const userWorkflowsHtml = this.workflows.map((wf) => renderWorkflowCardHtml(wf)).join('');

    grid.innerHTML = createWorkflowCardHtml + userWorkflowsHtml;
    renderIcons(grid);
    bindWorkflowDropdowns(grid);
  }

  private bindEvents(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="workflows-grid"]');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      const editBtn = target.closest<HTMLElement>('[data-action="edit-workflow"]');
      if (editBtn) {
        e.stopPropagation();
        const id = editBtn.getAttribute('data-id');
        const wf = this.workflows.find((w) => w.id === id);
        if (wf) this.openWorkflowModal(wf);
        return;
      }

      const deleteBtn = target.closest<HTMLElement>('[data-action="delete-workflow"]');
      if (deleteBtn) {
        e.stopPropagation();
        const id = deleteBtn.getAttribute('data-id');
        const wf = this.workflows.find((w) => w.id === id);
        if (wf) this.confirmDeleteWorkflow(wf);
        return;
      }

      if (target.closest('.dropdown')) {
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
        const wf = this.workflows.find((w) => w.id === id);
        if (wf && wf.steps.length > 0) {
          const firstRoute = startWorkflowSession(wf);
          navigate(firstRoute);
        } else {
          showToast(t('workflows.workflow_not_found', 'Flujo de trabajo no encontrado o sin pasos'), 'warning');
        }
      }
    });
  }

  private renderFooter(): void {
    const footerContainer = this.container.querySelector<HTMLElement>('[data-ref="footer-section"], [data-ref="workflows-footer-section"]');
    if (!footerContainer) return;

    footerContainer.innerHTML = getFooterHtml();
    this.footerController = mountSiteFooter(footerContainer, this.abortController?.signal);
  }

  private openWorkflowModal(workflow?: UserWorkflow): void {
    if (!workflow && this.workflows.length >= MAX_WORKFLOWS_LIMIT) {
      showToast(t('ui.has_alcanzado_el_limite_maximo_de_flujos'), 'warning');
      return;
    }

    let currentSteps: WorkflowStep[] = workflow ? JSON.parse(JSON.stringify(workflow.steps)) : [];
    let selectedTool: ToolDefinition | null = null;
    let toolDropdownCtrl: { destroy: () => void } | null = null;
    let activeSubDropdownCtrls: { destroy: () => void }[] = [];

    const modalBody = document.createElement('div');
    modalBody.className = 'workflow-builder-modal';
    modalBody.setAttribute('data-ref', 'workflow-builder-modal');

    modalBody.innerHTML = renderWorkflowBuilderModalBody(workflow ? this.escape(workflow.name) : '');

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
        stepsListEl.innerHTML = renderWorkflowEmptyStepsState();
      } else {
        stepsListEl.innerHTML = currentSteps.map((step, idx) => {
          const tool = WORKFLOW_TOOLS.find((t) => t.id === step.tool);
          const toolName = tool ? tool.name : step.tool;
          const toolIcon = tool ? tool.icon : 'widgets';
          return renderWorkflowPipelineStepItem(idx + 1, toolName, toolIcon, step.id);
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
        showToast(t('toasts.por_favor_selecciona_una_herramienta_pri'), 'warning');
        return;
      }
      if (isPipelineTerminal()) {
        showToast(t('toasts.no_es_posible_anadir_herramientas_despue'), 'warning');
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
      cancelText: t('common.cancel'),
      confirmClass: 'component-button--primary component-button--black',
      confirmText: workflow ? (t('common.save_changes') || 'Guardar cambios') : (t('modals_catalog.sample_workflow_save') || 'Crear flujo'),
      description: t('ui.configura_las_herramientas_y_el_orden_de'),
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
          inst.showError(t('ui.por_favor_ingresa_un_nombre_para_el_fluj'));
          return false;
        }

        if (currentSteps.length === 0) {
          inst.showError(t('ui.debes_anadir_al_menos_una_herramienta_a_'));
          return false;
        }

        const res = saveWorkflow({
          category: 'pdf',
          id: workflow?.id,
          name,
          steps: currentSteps,
        });

        if (!res.success) {
          inst.showError(res.error || t('ui.ocurrio_un_error_al_guardar_el_flujo_de_'));
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
    openDeleteWorkflowModal({
      onConfirm: async () => {
        const deleted = deleteWorkflow(workflow.id);
        if (deleted) {
          showToast(t('toasts.flujo_de_trabajo_eliminado_exitosamente'), 'success');
          this.loadWorkflows();
          this.renderWorkflows();
          return true;
        }
        showToast(t('ui.no_se_pudo_eliminar_el_flujo_de_trabajo'), 'danger');
        return false;
      },
      workflowName: workflow.name,
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

async function createWorkflowsPageView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/workflows/workflows.html');
  const controller = new WorkflowsController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { WorkflowsController, createWorkflowsPageView };
