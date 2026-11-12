import { getWorkflowToolName } from '../config/workflow-tools.config.js';
import { SVG_TOOL_WORKFLOW } from '../graphics/tool-icons.graphics.js';
import { t } from '../services/i18n.service.js';
import { UserWorkflow } from '../types/workflow.types.js';
import { setupDropdown } from '../utils/dom.util.js';

function escapeWorkflowHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderWorkflowCardHtml(wf: UserWorkflow): string {
  const stepNames = wf.steps
    .map((s) => getWorkflowToolName(s.tool))
    .join(' → ');

  return `
    <div class="tool-card tool-card--workflow" data-ref="card-workflow-${wf.id}" data-category="workflows" data-workflow-id="${wf.id}">
      <div class="pdf-card__actions" data-ref="actions-workflow-${wf.id}">
        <div class="dropdown" data-ref="dropdown-workflow-${wf.id}">
          <button type="button" class="component-button component-button--icon-only pdf-card__btn-action dropdown-trigger" data-ref="btn-more-wf-${wf.id}" data-id="${wf.id}" data-name="${escapeWorkflowHtml(wf.name)}" data-tooltip="${t('workflows.more_options')}" aria-label="${t('workflows.more_options')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#more_vert"></use></svg>
          </button>
          <div class="menu-panel menu-panel--dropdown menu-panel--w-180 menu-panel--doc-actions" data-ref="menu-workflow-${wf.id}">
            <div class="menu-panel__list">
              <button type="button" class="menu-item" data-action="edit-workflow" data-id="${wf.id}">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
                <span class="menu-item__text" data-i18n="workflows.edit">${t('workflows.edit')}</span>
              </button>
              <div class="menu-divider"></div>
              <button type="button" class="menu-item menu-item--danger" data-action="delete-workflow" data-id="${wf.id}">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                <span class="menu-item__text" data-i18n="workflows.delete">${t('workflows.delete')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="tool-card__icon-box" data-ref="icon-box-workflow-${wf.id}">
        ${SVG_TOOL_WORKFLOW}
      </div>
      <h3 class="tool-card__title" data-ref="title-workflow-${wf.id}">${escapeWorkflowHtml(wf.name)}</h3>
      <p class="tool-card__desc" data-ref="desc-workflow-${wf.id}">${escapeWorkflowHtml(stepNames || t('workflows.no_steps'))}</p>
      <div class="tool-card__action-link" data-ref="link-workflow-${wf.id}">
        <span data-ref="txt-action-workflow-${wf.id}" data-i18n="workflows.execute_workflow">${t('workflows.execute_workflow')}</span>
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_outward"></use></svg>
      </div>
    </div>
  `;
}

function bindWorkflowDropdowns(container: HTMLElement, onControllersCreated?: (ctrl: { destroy: () => void }) => void): void {
  const dropdowns = container.querySelectorAll<HTMLElement>('.dropdown');
  dropdowns.forEach((dd) => {
    const card = dd.closest<HTMLElement>('.tool-card--workflow');
    const ctrl = setupDropdown(dd, {
      onClose: () => {
        if (card) card.classList.remove('has-open-dropdown');
      },
      onOpen: () => {
        if (card) card.classList.add('has-open-dropdown');
      },
    });
    if (onControllersCreated) {
      onControllersCreated(ctrl);
    }
  });
}

export { bindWorkflowDropdowns, escapeWorkflowHtml, renderWorkflowCardHtml };
