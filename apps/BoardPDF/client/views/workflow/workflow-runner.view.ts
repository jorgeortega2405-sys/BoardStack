import { ToolStatusManager } from '../../components/tool-status.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { WORKFLOW_TOOLS, getWorkflowToolName } from '../../config/workflow-tools.config.js';
import { escapeHtml, postFormWithProgress } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { loadPdfJs } from '../../services/pdf-loader.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { getWorkflow } from '../../services/workflow-storage.service.js';
import { OrganizePageItem, UserWorkflow, WorkflowStep } from '../../types/workflow.types.js';
import { SortableGridController, hideElement, setupSortableGrid, showElement, withButtonLoading } from '../../utils/dom.util.js';
import { formatBytes } from '../../utils/format.util.js';

class WorkflowRunnerController {
  private abortController: AbortController | null = null;
  private completedResult: { downloadUrl: string; fileSize: number; filename: string } | null = null;
  private compressLevel: 'extreme' | 'low' | 'recommended' = 'recommended';
  private container: HTMLElement;
  private currentFile: File | null = null;
  private currentStepIndex = 0;
  private isProcessing = false;
  private lastFileToken: string | null = null;
  private organizeOriginalPages: OrganizePageItem[] = [];
  private organizePages: OrganizePageItem[] = [];
  private pdfDocument: any = null;
  private sortableInstance: SortableGridController | null = null;
  private splitPages: OrganizePageItem[] = [];
  private splitSelectedPages: Set<number> = new Set();
  private statusManager: ToolStatusManager | null = null;
  private workflow: UserWorkflow | null = null;
  private workflowId: string;

  constructor(container: HTMLElement, workflowId: string) {
    this.container = container;
    this.workflowId = workflowId;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.statusManager = new ToolStatusManager({
      container: this.container,
      onRetry: () => void this.executeCurrentStep(),
      toolName: t('workflows.runner_tool_name'),
    });
    this.bindEvents();
    this.loadWorkflow();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }
    if (this.statusManager) {
      this.statusManager.destroy();
      this.statusManager = null;
    }
    this.pdfDocument = null;
  }

  private loadWorkflow(): void {
    const wf = getWorkflow(this.workflowId);
    if (!wf) {
      showToast(t('workflows.workflow_not_found'), 'danger');
      navigate('/workflows');
      return;
    }

    this.workflow = wf;
    this.renderWorkflowInitialState();
  }

  private renderWorkflowInitialState(): void {
    if (!this.workflow) return;

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="workflow-sidebar-title"]');
    const subtitleEl = this.container.querySelector<HTMLElement>('[data-ref="workflow-sidebar-subtitle"]');
    const badgeEl = this.container.querySelector<HTMLElement>('[data-ref="workflow-steps-count-badge"]');

    const count = this.workflow.steps.length;
    if (titleEl) titleEl.textContent = this.workflow.name;
    if (subtitleEl) {
      subtitleEl.textContent = count === 1
        ? t('workflows.runner_sequence_single')
        : t('workflows.runner_sequence_plural', { count });
    }
    if (badgeEl) {
      badgeEl.textContent = count === 1
        ? t('workflows.step_count_singular')
        : t('workflows.step_count_plural', { count });
    }

    this.renderStepper();
    this.updateMainActionButton();
    renderIcons(this.container);
  }

  private renderStepper(): void {
    const stepperList = this.container.querySelector<HTMLElement>('[data-ref="workflow-stepper-list"]');
    if (!stepperList || !this.workflow) return;

    stepperList.innerHTML = this.workflow.steps.map((step, idx) => {
      const name = escapeHtml(getWorkflowToolName(step.tool));

      const isCompleted = this.currentFile !== null && idx < this.currentStepIndex;
      const isActive = this.currentFile !== null && idx === this.currentStepIndex;

      let statusModifier = '';
      let statusText = t('workflows.step_status_pending');

      if (isCompleted) {
        statusModifier = ' workflow-stepper-item--completed';
        statusText = t('workflows.step_status_completed');
      } else if (isActive) {
        statusModifier = ' workflow-stepper-item--active';
        statusText = t('workflows.step_status_in_progress');
      }

      const badgeContent = isCompleted
        ? '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>'
        : `${idx + 1}`;

      return `
        <div class="workflow-stepper-item${statusModifier}" data-ref="stepper-step-${step.id}">
          <div class="workflow-stepper-item__left">
            <div class="workflow-stepper-item__badge">${badgeContent}</div>
            <div class="workflow-stepper-item__info">
              <div class="workflow-stepper-item__name">${name}</div>
            </div>
          </div>
          <span class="workflow-stepper-item__status">${escapeHtml(statusText)}</span>
        </div>
      `;
    }).join('');

    renderIcons(stepperList);
  }

  private updateMainActionButton(): void {
    const mainActionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const txtMainAction = this.container.querySelector<HTMLElement>('[data-ref="txt-main-action"]');
    const iconMainAction = this.container.querySelector<SVGElement>('[data-ref="icon-main-action"] use');
    const sidebarResetBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-reset"]');

    if (!mainActionBtn || !txtMainAction || !this.workflow) return;

    if (!this.currentFile) {
      txtMainAction.textContent = t('workflows.runner_select_pdf');
      mainActionBtn.disabled = true;
      if (iconMainAction) iconMainAction.setAttribute('href', '/icons.svg#upload_file');
      hideElement(sidebarResetBtn);
      return;
    }

    if (this.completedResult) {
      hideElement(mainActionBtn);
      showElement(sidebarResetBtn);
      return;
    }

    showElement(mainActionBtn);
    mainActionBtn.disabled = false;
    showElement(sidebarResetBtn);

    const isLastStep = this.currentStepIndex >= this.workflow.steps.length - 1;
    if (isLastStep) {
      const currentStep = this.workflow.steps[this.currentStepIndex];
      const toolDef = WORKFLOW_TOOLS.find((item) => item.id === currentStep.tool);
      txtMainAction.textContent = toolDef?.isTerminal
        ? t('workflows.runner_finish_convert')
        : t('workflows.runner_finish_flow');
      if (iconMainAction) iconMainAction.setAttribute('href', '/icons.svg#check');
    } else {
      const nextStep = this.workflow.steps[this.currentStepIndex + 1];
      const nextName = getWorkflowToolName(nextStep.tool);
      txtMainAction.textContent = t('workflows.runner_continue_to', { name: nextName });
      if (iconMainAction) iconMainAction.setAttribute('href', '/icons.svg#arrow_forward');
    }
  }

  private async handleFileSelected(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast(t('ui.por_favor_selecciona_un_archivo_pdf_vali'), 'warning');
      return;
    }

    this.currentFile = file;
    this.currentStepIndex = 0;
    this.completedResult = null;
    this.hideError();

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="workflow-dropzone-card"]');
    hideElement(dropzoneCard);

    await this.renderActiveStep();
  }

  private async renderActiveStep(): Promise<void> {
    if (!this.workflow || !this.currentFile) return;

    this.renderStepper();
    this.updateMainActionButton();

    const organizeCard = this.container.querySelector<HTMLElement>('[data-ref="workflow-organize-card"]');
    const splitCard = this.container.querySelector<HTMLElement>('[data-ref="workflow-split-card"]');
    const overviewCard = this.container.querySelector<HTMLElement>('[data-ref="workflow-overview-card"]');
    const workspace = this.container.querySelector<HTMLElement>('[data-ref="workflow-workspace"]');

    hideElement(organizeCard);
    hideElement(splitCard);
    hideElement(overviewCard);

    const currentStep = this.workflow.steps[this.currentStepIndex];
    if (!currentStep) return;

    if (currentStep.tool === 'organize-pdf') {
      if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
      showElement(organizeCard);
      await this.setupOrganizeStep();
    } else if (currentStep.tool === 'split-pdf') {
      if (workspace) workspace.classList.add('tool-layout__workspace--top-aligned');
      showElement(splitCard);
      await this.setupSplitStep();
    } else {
      if (workspace) workspace.classList.remove('tool-layout__workspace--top-aligned');
      showElement(overviewCard);
      this.setupOverviewStep(currentStep);
    }

    renderIcons(this.container);
  }

  private applySheetRotation(sheet: HTMLElement | null, rotation: number): void {
    if (!sheet) return;
    if (rotation === 0) {
      sheet.removeAttribute('data-rotation');
    } else {
      sheet.setAttribute('data-rotation', `${rotation}`);
    }
  }

  private async setupOrganizeStep(): Promise<void> {
    if (!this.currentFile) return;

    const countBadge = this.container.querySelector<HTMLElement>('[data-ref="workflow-organize-count"]');
    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await this.currentFile.arrayBuffer();
      this.pdfDocument = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const count = this.pdfDocument.numPages;

      this.organizePages = Array.from({ length: count }, (_, i) => ({
        id: `page-${Date.now()}-${i + 1}`,
        originalIndex: i,
        pageNum: i + 1,
        rotation: 0,
      }));
      this.organizeOriginalPages = this.organizePages.map((p) => ({ ...p }));

      if (countBadge) countBadge.textContent = t('tools.page_count_short', { count });

      this.renderOrganizeGrid();
      this.initSortable();
      this.renderOrganizeSidebarOptions();

      for (const page of this.organizePages) {
        void this.generateOrganizeThumbnail(page);
      }
    } catch {
      this.showError(t('ui.no_se_pudo_cargar_la_vista_previa_del_do'));
    }
  }

  private renderOrganizeGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="workflow-organize-grid"]');
    if (!grid) return;

    const rotateLabel = escapeHtml(t('tools.organize_rotate_page_aria'));
    const removeLabel = escapeHtml(t('tools.organize_remove_page_aria'));

    grid.innerHTML = this.organizePages.map((p, index) => {
      const isMoved = p.originalIndex !== index;
      const isRotated = p.rotation !== 0;
      const rotationAttr = isRotated ? ` data-rotation="${p.rotation}"` : '';
      const altText = escapeHtml(t('tools.page_label', { num: p.pageNum }));

      return `
        <div class="pdf-card organize-page-card" data-ref="card-${p.id}" data-id="${p.id}" data-page-id="${p.id}" data-page-index="${index}">
          <span class="pdf-card__order-badge" data-ref="order-badge-${p.id}">${index + 1}</span>
          <div class="pdf-card__actions">
            <button type="button" class="component-button pdf-card__btn-rotate" data-ref="btn-rotate-card" title="${rotateLabel}" aria-label="${rotateLabel}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#redo"></use></svg>
            </button>
            <button type="button" class="component-button pdf-card__btn-remove" data-ref="btn-remove-card" title="${removeLabel}" aria-label="${removeLabel}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
          <div class="pdf-card__sheet-wrapper">
            <div class="pdf-card__sheet" data-ref="sheet-${p.id}"${rotationAttr}>
              ${
                p.thumbnailDataUrl
                  ? `<img class="pdf-card__canvas" data-ref="img-${p.id}" src="${p.thumbnailDataUrl}" alt="${altText}" />`
                  : `<div class="pdf-card__spinner"></div>`
              }
            </div>
          </div>
          <div class="pdf-card__footer">
            <span class="pdf-card__title">${escapeHtml(t('tools.page_label', { num: index + 1 }))}</span>
            ${isMoved ? `<span class="pdf-card__sub">${escapeHtml(t('tools.organize_origin_label', { num: p.originalIndex + 1 }))}</span>` : ''}
            ${isRotated ? `<span class="pdf-card__badge" data-ref="rot-badge-${p.id}">+${p.rotation}°</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    renderIcons(grid);
  }

  private async generateOrganizeThumbnail(item: OrganizePageItem): Promise<void> {
    if (!this.pdfDocument) return;
    try {
      const page = await this.pdfDocument.getPage(item.originalIndex + 1);
      const origViewport = page.getViewport({ scale: 1 });
      const targetWidth = 220;
      const scale = targetWidth / Math.max(origViewport.width, 1);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        item.thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        const sheet = this.container.querySelector<HTMLElement>(`[data-ref="sheet-${item.id}"]`);
        if (sheet) {
          this.applySheetRotation(sheet, item.rotation);
          sheet.innerHTML = `<img class="pdf-card__canvas" data-ref="img-${item.id}" src="${item.thumbnailDataUrl}" alt="${escapeHtml(t('tools.page_label', { num: item.pageNum }))}" />`;
        }
      }
    } catch {}
  }

  private initSortable(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="workflow-organize-grid"]');
    if (!grid) return;

    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }

    this.sortableInstance = setupSortableGrid(grid, {
      onEnd: () => {
        const cards = Array.from(grid.querySelectorAll<HTMLElement>('.pdf-card[data-page-id]'));
        const newOrderedPages: OrganizePageItem[] = [];
        cards.forEach((card) => {
          const id = card.getAttribute('data-page-id');
          const found = this.organizePages.find((p) => p.id === id);
          if (found) {
            newOrderedPages.push(found);
          }
        });
        this.organizePages = newOrderedPages;
        this.refreshOrganizeCardBadges();
        this.renderOrganizeSidebarOptions();
      },
    });
  }

  private refreshOrganizeCardBadges(): void {
    this.organizePages.forEach((p, index) => {
      const orderBadge = this.container.querySelector<HTMLElement>(`[data-ref="order-badge-${p.id}"]`);
      if (orderBadge) {
        orderBadge.textContent = `${index + 1}`;
      }
      const card = this.container.querySelector<HTMLElement>(`[data-ref="card-${p.id}"]`);
      if (card) {
        card.setAttribute('data-page-index', `${index}`);
        const pageTitle = card.querySelector<HTMLElement>('.pdf-card__title');
        if (pageTitle) {
          pageTitle.textContent = t('tools.page_label', { num: index + 1 });
        }
        let origSub = card.querySelector<HTMLElement>('.pdf-card__sub');
        if (p.originalIndex !== index) {
          if (!origSub) {
            origSub = document.createElement('span');
            origSub.className = 'pdf-card__sub';
            card.querySelector('.pdf-card__footer')?.appendChild(origSub);
          }
          origSub.textContent = t('tools.organize_origin_label', { num: p.originalIndex + 1 });
        } else if (origSub) {
          origSub.remove();
        }
      }
    });
  }

  private rotateOrganizePage(pageId: string): void {
    const item = this.organizePages.find((p) => p.id === pageId);
    if (!item) return;

    item.rotation = (item.rotation + 90) % 360;

    const sheet = this.container.querySelector<HTMLElement>(`[data-ref="sheet-${item.id}"]`);
    this.applySheetRotation(sheet, item.rotation);

    const card = this.container.querySelector<HTMLElement>(`[data-ref="card-${item.id}"]`);
    if (card) {
      let rotBadge = card.querySelector<HTMLElement>(`[data-ref="rot-badge-${item.id}"]`);
      if (item.rotation !== 0) {
        if (!rotBadge) {
          rotBadge = document.createElement('span');
          rotBadge.className = 'pdf-card__badge';
          rotBadge.setAttribute('data-ref', `rot-badge-${item.id}`);
          card.querySelector('.pdf-card__footer')?.appendChild(rotBadge);
        }
        rotBadge.textContent = `+${item.rotation}°`;
      } else if (rotBadge) {
        rotBadge.remove();
      }
    }

    this.renderOrganizeSidebarOptions();
  }

  private rotateAllOrganizePages(): void {
    this.organizePages.forEach((p) => {
      this.rotateOrganizePage(p.id);
    });
    showToast(t('toasts.todas_las_paginas_han_sido_giradas_90'), 'info');
  }

  private removeOrganizePage(pageId: string): void {
    if (this.organizePages.length <= 1) {
      this.showError(t('ui.el_documento_debe_contener_al_menos_una_'));
      return;
    }

    const index = this.organizePages.findIndex((p) => p.id === pageId);
    if (index !== -1) {
      this.organizePages.splice(index, 1);
      this.renderOrganizeGrid();
      this.initSortable();
      this.renderOrganizeSidebarOptions();

      const countBadge = this.container.querySelector<HTMLElement>('[data-ref="workflow-organize-count"]');
      if (countBadge) countBadge.textContent = t('tools.page_count_short', { count: this.organizePages.length });
    }
  }

  private resetOrganizeOrder(): void {
    this.organizePages = this.organizeOriginalPages.map((p) => ({ ...p, rotation: 0 }));
    this.renderOrganizeGrid();
    this.initSortable();
    this.renderOrganizeSidebarOptions();
    showToast(t('toasts.orden_original_restablecido'), 'info');
  }

  private renderOrganizeSidebarOptions(): void {
    const optionsSection = this.container.querySelector<HTMLElement>('[data-ref="section-active-options"]');
    const optionsBody = this.container.querySelector<HTMLElement>('[data-ref="active-step-body"]');
    const optionsTitle = this.container.querySelector<HTMLElement>('[data-ref="active-step-title"]');

    if (!optionsSection || !optionsBody) return;

    let modified = 0;
    this.organizePages.forEach((p, idx) => {
      if (p.originalIndex !== idx || p.rotation !== 0) modified++;
    });

    showElement(optionsSection);
    if (optionsTitle) optionsTitle.textContent = getWorkflowToolName('organize-pdf');

    optionsBody.innerHTML = `
      <div class="tool-summary-card tool-summary-card--stack">
        <div class="tool-summary-row">
          <span class="tool-summary-label">${escapeHtml(t('workflows.runner_total_pages'))}</span>
          <strong class="tool-summary-value">${this.organizePages.length}</strong>
        </div>
        <div class="tool-summary-row">
          <span class="tool-summary-label">${escapeHtml(t('workflows.runner_modified_pages'))}</span>
          <strong class="tool-summary-value${modified > 0 ? ' tool-summary-value--accent' : ''}">${modified}</strong>
        </div>
      </div>
      <p class="tool-sidebar__hint-text">
        ${escapeHtml(t('workflows.runner_organize_desc'))}
      </p>
    `;
  }

  private async setupSplitStep(): Promise<void> {
    if (!this.currentFile) return;

    const countBadge = this.container.querySelector<HTMLElement>('[data-ref="workflow-split-count"]');
    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await this.currentFile.arrayBuffer();
      this.pdfDocument = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const count = this.pdfDocument.numPages;

      this.splitPages = Array.from({ length: count }, (_, i) => ({
        id: `page-${Date.now()}-${i + 1}`,
        originalIndex: i,
        pageNum: i + 1,
        rotation: 0,
      }));
      this.splitSelectedPages = new Set(this.splitPages.map((p) => p.pageNum));

      if (countBadge) countBadge.textContent = t('tools.page_count_short', { count });

      this.renderSplitGrid();
      this.renderSplitSidebarOptions();

      for (const page of this.splitPages) {
        void this.generateSplitThumbnail(page);
      }
    } catch {
      this.showError(t('ui.no_se_pudo_cargar_la_vista_previa_del_do'));
    }
  }

  private renderSplitGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="workflow-split-grid"]');
    if (!grid) return;

    grid.innerHTML = this.splitPages.map((p) => {
      const isSelected = this.splitSelectedPages.has(p.pageNum);
      const stateClass = isSelected ? 'is-selected' : 'is-dimmed';
      const pageTitle = escapeHtml(t('tools.page_label', { num: p.pageNum }));

      return `
        <div class="pdf-card split-page-card ${stateClass}" data-ref="split-card-${p.pageNum}" data-page="${p.pageNum}">
          <div class="split-page-card__check-badge">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
          </div>
          <div class="pdf-card__sheet-wrapper">
            <div class="pdf-card__sheet" data-ref="split-sheet-${p.pageNum}">
              ${
                p.thumbnailDataUrl
                  ? `<img class="pdf-card__canvas" data-ref="img-page-${p.pageNum}" src="${p.thumbnailDataUrl}" alt="${pageTitle}" />`
                  : `<div class="pdf-card__spinner"></div>`
              }
            </div>
          </div>
          <div class="pdf-card__footer">
            <span class="pdf-card__title">${pageTitle}</span>
          </div>
        </div>
      `;
    }).join('');

    renderIcons(grid);
  }

  private async generateSplitThumbnail(item: OrganizePageItem): Promise<void> {
    if (!this.pdfDocument) return;
    try {
      const page = await this.pdfDocument.getPage(item.originalIndex + 1);
      const origViewport = page.getViewport({ scale: 1 });
      const targetWidth = 220;
      const scale = targetWidth / Math.max(origViewport.width, 1);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        item.thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        const sheet = this.container.querySelector<HTMLElement>(`[data-ref="split-sheet-${item.pageNum}"]`);
        if (sheet) {
          sheet.innerHTML = `<img class="pdf-card__canvas" data-ref="img-page-${item.pageNum}" src="${item.thumbnailDataUrl}" alt="${escapeHtml(t('tools.page_label', { num: item.pageNum }))}" />`;
        }
      }
    } catch {}
  }

  private toggleSplitPage(pageNum: number): void {
    if (this.splitSelectedPages.has(pageNum)) {
      if (this.splitSelectedPages.size <= 1) {
        this.showError(t('ui.debes_mantener_seleccionada_al_menos_una'));
        return;
      }
      this.splitSelectedPages.delete(pageNum);
    } else {
      this.splitSelectedPages.add(pageNum);
    }

    this.hideError();
    const card = this.container.querySelector<HTMLElement>(`[data-ref="split-card-${pageNum}"]`);
    if (card) {
      const isSelected = this.splitSelectedPages.has(pageNum);
      card.classList.toggle('is-selected', isSelected);
      card.classList.toggle('is-dimmed', !isSelected);
    }

    this.renderSplitSidebarOptions();
  }

  private renderSplitSidebarOptions(): void {
    const optionsSection = this.container.querySelector<HTMLElement>('[data-ref="section-active-options"]');
    const optionsBody = this.container.querySelector<HTMLElement>('[data-ref="active-step-body"]');
    const optionsTitle = this.container.querySelector<HTMLElement>('[data-ref="active-step-title"]');

    if (!optionsSection || !optionsBody) return;

    showElement(optionsSection);
    if (optionsTitle) optionsTitle.textContent = getWorkflowToolName('split-pdf');

    optionsBody.innerHTML = `
      <div class="tool-summary-card tool-summary-card--stack">
        <div class="tool-summary-row">
          <span class="tool-summary-label">${escapeHtml(t('workflows.runner_total_pages'))}</span>
          <strong class="tool-summary-value">${this.splitPages.length}</strong>
        </div>
        <div class="tool-summary-row">
          <span class="tool-summary-label">${escapeHtml(t('workflows.runner_selected_pages'))}</span>
          <strong class="tool-summary-value tool-summary-value--accent">${this.splitSelectedPages.size}</strong>
        </div>
      </div>
      <p class="tool-sidebar__hint-text">
        ${escapeHtml(t('workflows.runner_split_desc'))}
      </p>
    `;
  }

  private setupOverviewStep(currentStep: WorkflowStep): void {
    if (!this.currentFile) return;

    const toolDef = WORKFLOW_TOOLS.find((item) => item.id === currentStep.tool);
    const toolName = getWorkflowToolName(currentStep.tool);

    const fileNameEl = this.container.querySelector<HTMLElement>('[data-ref="overview-file-name"]');
    const fileSizeEl = this.container.querySelector<HTMLElement>('[data-ref="overview-file-size"]');

    if (fileNameEl) fileNameEl.textContent = this.currentFile.name;
    if (fileSizeEl) fileSizeEl.textContent = `${formatBytes(this.currentFile.size)}`;

    const optionsSection = this.container.querySelector<HTMLElement>('[data-ref="section-active-options"]');
    const optionsBody = this.container.querySelector<HTMLElement>('[data-ref="active-step-body"]');
    const optionsTitle = this.container.querySelector<HTMLElement>('[data-ref="active-step-title"]');

    if (!optionsSection || !optionsBody) return;

    if (currentStep.tool === 'compress-pdf') {
      showElement(optionsSection);
      if (optionsTitle) optionsTitle.textContent = toolName;

      const levelTitles: Record<'extreme' | 'low' | 'recommended', string> = {
        extreme: t('tools.compress_extreme_title'),
        low: t('tools.compress_low_title'),
        recommended: t('tools.compress_recommended_title'),
      };
      const levelDescs: Record<'extreme' | 'low' | 'recommended', string> = {
        extreme: t('ui.menor_calidad_de_imagen_maxima_reduccion'),
        low: t('ui.alta_calidad_visual_menor_reduccion_de_t'),
        recommended: t('ui.buena_calidad_visual_reduccion_sustancia'),
      };
      const activeIdx = this.compressLevel === 'extreme' ? '0' : this.compressLevel === 'low' ? '2' : '1';

      optionsBody.innerHTML = `
        <div class="component-tabs" data-ref="workflow-compress-level-toggle" data-level="${this.compressLevel}" data-active="${activeIdx}">
          <button type="button" class="component-tab${this.compressLevel === 'extreme' ? ' is-active' : ''}" data-ref="btn-wf-compress-extreme" data-level="extreme">${escapeHtml(t('tools.compress_level_extreme'))}</button>
          <button type="button" class="component-tab${this.compressLevel === 'recommended' ? ' is-active' : ''}" data-ref="btn-wf-compress-recommended" data-level="recommended">${escapeHtml(t('tools.compress_level_recommended'))}</button>
          <button type="button" class="component-tab${this.compressLevel === 'low' ? ' is-active' : ''}" data-ref="btn-wf-compress-low" data-level="low">${escapeHtml(t('tools.compress_level_low'))}</button>
        </div>
        <div class="compress-quality-card" data-ref="wf-compress-quality-card">
          <div class="compress-quality-card__header">
            <svg class="component-icon compress-quality-card__icon" aria-hidden="true"><use href="/icons.svg#compress"></use></svg>
            <span class="compress-quality-card__title" data-ref="wf-compress-quality-title">${escapeHtml(levelTitles[this.compressLevel])}</span>
          </div>
          <p class="compress-quality-card__desc" data-ref="wf-compress-quality-desc">${escapeHtml(levelDescs[this.compressLevel])}</p>
        </div>
      `;

      renderIcons(optionsBody);
      const toggleEl = optionsBody.querySelector<HTMLElement>('[data-ref="workflow-compress-level-toggle"]');
      const qualityTitleEl = optionsBody.querySelector<HTMLElement>('[data-ref="wf-compress-quality-title"]');
      const qualityDescEl = optionsBody.querySelector<HTMLElement>('[data-ref="wf-compress-quality-desc"]');

      toggleEl?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-level]');
        if (!btn) return;
        const level = btn.getAttribute('data-level') as 'extreme' | 'low' | 'recommended';
        if (!level || level === this.compressLevel) return;
        this.compressLevel = level;
        const idx = level === 'extreme' ? '0' : level === 'low' ? '2' : '1';
        toggleEl.setAttribute('data-level', level);
        toggleEl.setAttribute('data-active', idx);
        toggleEl.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
          b.classList.toggle('is-active', b === btn);
        });
        if (qualityTitleEl) qualityTitleEl.textContent = levelTitles[level];
        if (qualityDescEl) qualityDescEl.textContent = levelDescs[level];
      }, { signal: this.abortController?.signal });
    } else if (toolDef?.isTerminal) {
      showElement(optionsSection);
      if (optionsTitle) optionsTitle.textContent = toolName;
      optionsBody.innerHTML = `
        <div class="tool-summary-card">
          <div class="tool-summary-row">
            <span class="tool-summary-label">${escapeHtml(t('workflows.runner_output_format'))}</span>
            <strong class="tool-summary-value">${escapeHtml(`${toolName} (${toolDef.targetType?.toUpperCase() || ''})`)}</strong>
          </div>
        </div>
      `;
    } else {
      optionsBody.innerHTML = '';
      hideElement(optionsSection);
    }
  }

  private async executeCurrentStep(): Promise<void> {
    if (!this.workflow || !this.currentFile || this.isProcessing) return;
    this.hideError();

    const currentStep = this.workflow.steps[this.currentStepIndex];
    if (!currentStep) return;

    const actionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-main-action"]');
    const toolDef = WORKFLOW_TOOLS.find((item) => item.id === currentStep.tool);
    const toolName = getWorkflowToolName(currentStep.tool);

    this.isProcessing = true;
    this.statusManager?.showUploading(1, 1);

    await withButtonLoading(actionBtn, async () => {
      try {
        if (currentStep.tool === 'organize-pdf') {
          const pagesOrder = this.organizePages.map((p) => ({
            pageIndex: p.originalIndex,
            rotation: p.rotation,
          }));
          const formData = new FormData();
          formData.append('pdf', this.currentFile as Blob, this.currentFile?.name);
          formData.append('pagesOrder', JSON.stringify(pagesOrder));

          const res = await postFormWithProgress(
            API_ROUTES.tools.organizePdf.organize,
            formData,
            (progress) => this.statusManager?.updateUploadProgress(progress, 1),
            this.abortController?.signal
          );
          const json = await res.json();
          if (!res.ok || !json.success || !json.data?.downloadUrl) {
            throw new Error(json.error || t('ui.error_al_ordenar_las_paginas_del_documen'));
          }

          this.lastFileToken = json.data.fileId || null;
          const fileRes = await fetch(json.data.downloadUrl);
          const blob = await fileRes.blob();
          this.currentFile = new File(
            [blob],
            json.data.fileName || this.currentFile?.name || `${t('tools.default_organized_base')}.pdf`,
            { type: 'application/pdf' }
          );
        } else if (currentStep.tool === 'split-pdf') {
          const selected = Array.from(this.splitSelectedPages).sort((a, b) => a - b);
          if (selected.length === 0) {
            throw new Error(t('ui.debes_seleccionar_al_menos_una_pagina_pa'));
          }
          const optionsPayload = {
            filename: this.currentFile?.name || `${t('tools.default_split_base')}.pdf`,
            mergeSelected: true,
            mode: 'pages',
            selectedPages: selected,
            submode: 'custom',
          };
          const formData = new FormData();
          formData.append('pdf', this.currentFile as Blob, this.currentFile?.name);
          formData.append('options', JSON.stringify(optionsPayload));

          const res = await postFormWithProgress(
            API_ROUTES.tools.splitPdf.split,
            formData,
            (progress) => this.statusManager?.updateUploadProgress(progress, 1),
            this.abortController?.signal
          );
          const json = await res.json();
          if (!res.ok || !json.success || !json.data) {
            throw new Error(json.error || t('ui.error_al_dividir_las_paginas_del_documen'));
          }

          this.lastFileToken = json.data.fileId || null;
          const downloadUrl = json.data.downloadUrl || API_ROUTES.tools.splitPdf.download(json.data.fileId);
          const fileRes = await fetch(downloadUrl);
          const blob = await fileRes.blob();
          this.currentFile = new File(
            [blob],
            json.data.filename || this.currentFile?.name || `${t('tools.default_split_base')}.pdf`,
            { type: 'application/pdf' }
          );
        } else if (currentStep.tool === 'compress-pdf') {
          const formData = new FormData();
          formData.append('pdf', this.currentFile as Blob, this.currentFile?.name);
          formData.append('level', this.compressLevel);

          const res = await postFormWithProgress(
            API_ROUTES.tools.compressPdf.compress,
            formData,
            (progress) => this.statusManager?.updateUploadProgress(progress, 1),
            this.abortController?.signal
          );
          const json = await res.json();
          if (!res.ok || !json.success || !json.data?.downloadUrl) {
            throw new Error(json.error || t('ui.error_al_comprimir_el_archivo_pdf'));
          }

          this.lastFileToken = json.data.fileId || null;
          const fileRes = await fetch(json.data.downloadUrl);
          const blob = await fileRes.blob();
          this.currentFile = new File(
            [blob],
            json.data.filename || this.currentFile?.name || `${t('tools.default_compressed_base')}.pdf`,
            { type: 'application/pdf' }
          );
        } else if (toolDef?.isTerminal) {
          const targetType = toolDef.targetType || 'docx';
          const formData = new FormData();
          formData.append('file', this.currentFile as Blob, this.currentFile?.name);
          formData.append('targetType', targetType);

          const res = await postFormWithProgress(
            API_ROUTES.tools.pdfConverter.convert,
            formData,
            (progress) => this.statusManager?.updateUploadProgress(progress, 1),
            this.abortController?.signal
          );
          const json = await res.json();
          if (!res.ok || !json.success || !json.data?.downloadToken) {
            throw new Error(json.error || t('ui.error_al_convertir_el_documento'));
          }

          this.lastFileToken = json.data.downloadToken || null;
          const downloadUrl = `/api/download/${this.lastFileToken}`;
          const finalFilename = `${this.currentFile?.name.replace(/\.pdf$/i, '') || t('common.default_document_base')}.${targetType}`;
          this.completedResult = {
            downloadUrl,
            fileSize: this.currentFile?.size || 0,
            filename: finalFilename,
          };
        }

        const isLastStep = this.currentStepIndex >= this.workflow!.steps.length - 1;
        if (isLastStep) {
          if (!this.completedResult && this.currentFile) {
            this.completedResult = {
              downloadUrl: this.lastFileToken ? `/api/download/${this.lastFileToken}` : URL.createObjectURL(this.currentFile),
              fileSize: this.currentFile.size,
              filename: this.currentFile.name,
            };
          }

          const downloadUrl = this.lastFileToken ? `/api/download/${this.lastFileToken}` : this.completedResult!.downloadUrl;
          const downloadPayload = {
            downloadUrl,
            fileSize: this.completedResult!.fileSize,
            filename: this.completedResult!.filename,
            returnText: t('workflows.runner_run_another'),
            returnUrl: `/workflow/${this.workflow!.id}`,
            subtitle: `${t('workflow.completed_steps', { count: this.workflow!.steps.length })}"${this.workflow!.name}".`,
            title: t('workflow.completed_title'),
            token: this.lastFileToken || undefined,
          };

          sessionStorage.setItem('download_ready_data', JSON.stringify(downloadPayload));
          showToast(t('toasts.flujo_completado_con_exito'), 'success');
          this.statusManager?.hide();
          const targetUrl = this.lastFileToken ? `/download/${this.lastFileToken}` : '/download-ready';
          navigate(targetUrl);
          return;
        }

        this.currentStepIndex++;
        this.statusManager?.hide();
        const nextName = getWorkflowToolName(this.workflow!.steps[this.currentStepIndex].tool);
        showToast(`${t('workflow.step_completed_continuing')}${nextName}...`, 'info');
        await this.renderActiveStep();
      } catch (err: any) {
        this.statusManager?.showError({
          boxText: t('ui.ocurrio_un_inconveniente_al_procesar_el_'),
          boxTitle: t('workflows.runner_step_error_box_title', { step: this.currentStepIndex + 1, tool: toolName }),
          desc: err.message || t('ui.ocurrio_un_error_inesperado_al_procesar_'),
          retryText: t('workflows.runner_retry_step', { tool: toolName }),
          title: t('workflows.runner_step_error_title'),
        });
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private resetToInitial(): void {
    this.currentFile = null;
    this.currentStepIndex = 0;
    this.completedResult = null;
    this.isProcessing = false;
    this.lastFileToken = null;
    this.organizePages = [];
    this.splitPages = [];
    this.splitSelectedPages.clear();
    this.hideError();
    this.statusManager?.hide();

    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }
    this.pdfDocument = null;

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    if (fileInput) fileInput.value = '';

    const dropzoneCard = this.container.querySelector<HTMLElement>('[data-ref="workflow-dropzone-card"]');
    const organizeCard = this.container.querySelector<HTMLElement>('[data-ref="workflow-organize-card"]');
    const splitCard = this.container.querySelector<HTMLElement>('[data-ref="workflow-split-card"]');
    const overviewCard = this.container.querySelector<HTMLElement>('[data-ref="workflow-overview-card"]');
    const optionsSection = this.container.querySelector<HTMLElement>('[data-ref="section-active-options"]');

    showElement(dropzoneCard);
    hideElement(organizeCard);
    hideElement(splitCard);
    hideElement(overviewCard);
    hideElement(optionsSection);

    this.renderWorkflowInitialState();
  }

  private showError(msg: string): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="workflow-error-banner"]');
    if (banner) {
      banner.textContent = msg;
      showElement(banner);
    }
  }

  private hideError(): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="workflow-error-banner"]');
    if (banner) {
      banner.textContent = '';
      hideElement(banner);
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController!;

    this.container.querySelector('[data-ref="btn-back-home"]')?.addEventListener(
      'click',
      () => navigate('/workflows'),
      { signal }
    );

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-pdf-file"]');
    const dropzone = this.container.querySelector<HTMLElement>('[data-ref="workflow-dropzone"]');
    const browseBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-browse-file"]');

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    }, { signal });

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) void this.handleFileSelected(file);
      fileInput.value = '';
    }, { signal });

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('tool-hero-dropzone--active');
      }, { signal });

      dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('tool-hero-dropzone--active');
      }, { signal });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('tool-hero-dropzone--active');
        const file = e.dataTransfer?.files?.[0];
        if (file) void this.handleFileSelected(file);
      }, { signal });
    }

    const organizeGrid = this.container.querySelector<HTMLElement>('[data-ref="workflow-organize-grid"]');
    organizeGrid?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const rotateBtn = target.closest<HTMLElement>('[data-ref="btn-rotate-card"]');
      const removeBtn = target.closest<HTMLElement>('[data-ref="btn-remove-card"]');
      const card = target.closest<HTMLElement>('[data-page-id]');
      if (!card) return;
      const pageId = card.getAttribute('data-page-id');
      if (!pageId) return;

      if (rotateBtn) {
        e.stopPropagation();
        this.rotateOrganizePage(pageId);
      } else if (removeBtn) {
        e.stopPropagation();
        this.removeOrganizePage(pageId);
      }
    }, { signal });

    this.container.querySelector('[data-ref="btn-organize-rotate-all"]')?.addEventListener(
      'click',
      () => this.rotateAllOrganizePages(),
      { signal }
    );

    this.container.querySelector('[data-ref="btn-organize-reset"]')?.addEventListener(
      'click',
      () => this.resetOrganizeOrder(),
      { signal }
    );

    const splitGrid = this.container.querySelector<HTMLElement>('[data-ref="workflow-split-grid"]');
    splitGrid?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.split-page-card[data-page]');
      if (!card) return;
      const pageNumStr = card.getAttribute('data-page');
      if (pageNumStr) {
        this.toggleSplitPage(parseInt(pageNumStr, 10));
      }
    }, { signal });

    this.container.querySelector('[data-ref="btn-split-select-all"]')?.addEventListener(
      'click',
      () => {
        this.hideError();
        this.splitSelectedPages = new Set(this.splitPages.map((p) => p.pageNum));
        this.container.querySelectorAll<HTMLElement>('.split-page-card[data-page]').forEach((el) => {
          el.classList.add('is-selected');
          el.classList.remove('is-dimmed');
        });
        this.renderSplitSidebarOptions();
      },
      { signal }
    );

    this.container.querySelector('[data-ref="btn-split-deselect-all"]')?.addEventListener(
      'click',
      () => {
        this.hideError();
        if (this.splitPages.length > 0) {
          const firstPageNum = this.splitPages[0].pageNum;
          this.splitSelectedPages = new Set([firstPageNum]);
          this.container.querySelectorAll<HTMLElement>('.split-page-card[data-page]').forEach((el) => {
            const num = parseInt(el.getAttribute('data-page') || '', 10);
            const isSelected = num === firstPageNum;
            el.classList.toggle('is-selected', isSelected);
            el.classList.toggle('is-dimmed', !isSelected);
          });
          this.renderSplitSidebarOptions();
        }
      },
      { signal }
    );

    this.container.querySelector('[data-ref="btn-main-action"]')?.addEventListener(
      'click',
      () => void this.executeCurrentStep(),
      { signal }
    );

    this.container.querySelector('[data-ref="btn-sidebar-reset"]')?.addEventListener(
      'click',
      () => this.resetToInitial(),
      { signal }
    );
  }
}

async function createWorkflowRunnerView(workflowId: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/workflow/workflow-runner.html');
  const controller = new WorkflowRunnerController(container, workflowId);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { WorkflowRunnerController, createWorkflowRunnerView };
