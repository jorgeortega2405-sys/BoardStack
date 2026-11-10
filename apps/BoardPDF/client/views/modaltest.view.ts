import { renderWorkflowEmptyStepsState, renderWorkflowPipelineStepItem } from '../components/modal-templates.js';
import { WORKFLOW_TOOLS } from '../config/workflow-tools.config.js';
import { MODAL_2FA_SHIELD_SVG } from '../graphics/modal-illustrations.graphics.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { ToolDefinition } from '../types/workflow.types.js';
import { hideElement, setupDropdown, setupPasswordToggle, showElement, toggleElement } from '../utils/dom.util.js';

interface SampleWorkflowStep {
  id: string;
  tool: string;
}

class ModalTestController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private copyUrlTimer: number | null = null;
  private dropdownControllers: Array<{ destroy: () => void }> = [];
  private workflowSubDropdowns: Array<{ destroy: () => void }> = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.initIllustrations();
    this.initPasswordToggles();
    this.initMoveFolderDropdown();
    this.initPageSizeDropdown();
    this.initSocialShareLinks();
    this.initShareDownloadModal(signal);
    this.initTwoFactorInteractions(signal);
    this.initQrCodes();
    this.initWorkflowBuilderModal(signal);

    renderIcons(this.container);
  }

  destroy(): void {
    if (this.copyUrlTimer !== null) {
      window.clearTimeout(this.copyUrlTimer);
      this.copyUrlTimer = null;
    }
    this.dropdownControllers.forEach((ctrl) => ctrl.destroy());
    this.dropdownControllers = [];
    this.workflowSubDropdowns.forEach((ctrl) => ctrl.destroy());
    this.workflowSubDropdowns = [];
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private initIllustrations(): void {
    const svgWrapper16 = this.container.querySelector<HTMLElement>('[data-ref="svg-wrapper-16"]');
    if (svgWrapper16) {
      svgWrapper16.innerHTML = MODAL_2FA_SHIELD_SVG;
    }
  }

  private initPasswordToggles(): void {
    const tooltipOpts = {
      hideTooltip: t('common.hide_password'),
      showTooltip: t('common.show_password'),
    };

    const pairs: Array<[string, string]> = [
      ['btn-toggle-modal-password', 'input-modal-password'],
      ['btn-toggle-new-password', 'input-new-password'],
      ['btn-toggle-confirm-password', 'input-confirm-password'],
      ['btn-toggle-delete-password', 'input-delete-password'],
      ['btn-toggle-unlock-pwd', 'input-unlock-password'],
    ];

    pairs.forEach(([btnRef, inputRef]) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${btnRef}"]`);
      const input = this.container.querySelector<HTMLInputElement>(`[data-ref="${inputRef}"]`);
      setupPasswordToggle(btn, input, tooltipOpts);
    });
  }

  private initMoveFolderDropdown(): void {
    const wrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-move-folder-04"]');
    if (!wrapper) return;

    const trigger = wrapper.querySelector<HTMLElement>('[data-ref="btn-trigger-move-folder-04"]');
    const backdrop = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-move-folder-04"]');
    const menu = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-move-folder-04"]');
    const selectedTxt = wrapper.querySelector<HTMLElement>('[data-ref="txt-selected-move-folder-04"]');

    const ctrl = setupDropdown(wrapper, {
      backdrop,
      menu,
      onSelect: (_val, item) => {
        if (!item) return;
        const selectedId = item.getAttribute('data-value') ?? '';
        wrapper.setAttribute('data-selected-folder-id', selectedId);
        selectedTxt?.removeAttribute('data-i18n');
        const items = wrapper.querySelectorAll<HTMLElement>('[data-ref="move-folders-list-04"] .menu-item');
        items.forEach((it) => {
          const isMatch = it === item;
          it.classList.toggle('is-selected', isMatch);
          const checkIcon = it.querySelector<HTMLElement>('.menu-item__check');
          checkIcon?.classList.toggle('is-hidden', !isMatch);
        });
      },
      placement: 'bottom-start',
      trigger,
    });

    this.dropdownControllers.push(ctrl);
  }

  private initPageSizeDropdown(): void {
    const wrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-paper-size-12"]');
    if (!wrapper) return;

    const trigger = wrapper.querySelector<HTMLElement>('[data-ref="btn-trigger-paper-size-12"]');
    const backdrop = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-paper-size-12"]');
    const menu = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-paper-size-12"]');
    const selectedTxt = wrapper.querySelector<HTMLElement>('[data-ref="txt-selected-paper-size-12"]');

    const ctrl = setupDropdown(wrapper, {
      backdrop,
      menu,
      onSelect: (_val, item) => {
        if (!item) return;
        const titleEl = item.querySelector('.menu-item__title');
        const subEl = item.querySelector('.menu-item__subtitle');
        if (selectedTxt && titleEl) {
          selectedTxt.removeAttribute('data-i18n');
          selectedTxt.textContent = subEl?.textContent
            ? `${titleEl.textContent} (${subEl.textContent})`
            : titleEl.textContent || '';
        }
        const presetId = item.getAttribute('data-value') || '';
        const items = wrapper.querySelectorAll<HTMLElement>('[data-value]');
        items.forEach((it) => {
          const isMatch = it.getAttribute('data-value') === presetId;
          it.classList.toggle('is-selected', isMatch);
          const checkIcon = it.querySelector<HTMLElement>('.menu-item__check');
          checkIcon?.classList.toggle('is-hidden', !isMatch);
        });
      },
      placement: 'bottom-start',
      trigger,
    });

    this.dropdownControllers.push(ctrl);
  }

  private initSocialShareLinks(): void {
    const shareUrl = window.location.origin;
    const shareText = t('download.share_tweet_text');
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    const encodedWhatsapp = encodeURIComponent(`${shareText} ${shareUrl}`);

    this.container
      .querySelector<HTMLAnchorElement>('[data-ref="share-twitter-13"]')
      ?.setAttribute('href', `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`);
    this.container
      .querySelector<HTMLAnchorElement>('[data-ref="share-linkedin-13"]')
      ?.setAttribute('href', `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`);
    this.container
      .querySelector<HTMLAnchorElement>('[data-ref="share-facebook-13"]')
      ?.setAttribute('href', `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`);
    this.container
      .querySelector<HTMLAnchorElement>('[data-ref="share-whatsapp-13"]')
      ?.setAttribute('href', `https://wa.me/?text=${encodedWhatsapp}`);
  }

  private initShareDownloadModal(signal: AbortSignal): void {
    const inputEl = this.container.querySelector<HTMLInputElement>('[data-ref="input-share-url-14"]');
    const copyBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-modal-copy-url-14"]');

    inputEl?.addEventListener('click', () => inputEl.select(), { signal });

    copyBtn?.addEventListener('click', async () => {
      const value = inputEl?.value || '';
      const useEl = copyBtn.querySelector<SVGUseElement>('use');
      try {
        await navigator.clipboard.writeText(value);
        if (useEl) {
          useEl.setAttribute('href', '/icons.svg#check');
        }
        showToast(t('toasts.enlace_copiado_al_portapapeles'), 'success');
        if (this.copyUrlTimer !== null) {
          window.clearTimeout(this.copyUrlTimer);
        }
        this.copyUrlTimer = window.setTimeout(() => {
          if (useEl) {
            useEl.setAttribute('href', '/icons.svg#content_copy');
          }
          this.copyUrlTimer = null;
        }, 2000);
      } catch {
        inputEl?.select();
        showToast(t('toasts.copia_el_enlace_manualmente'), 'info');
      }
    }, { signal });
  }

  private initTwoFactorInteractions(signal: AbortSignal): void {
    const btnToggleSecret = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-secret-15"]');
    const boxSecret = this.container.querySelector<HTMLElement>('[data-ref="box-secret-key-15"]');
    const secretValueEl = this.container.querySelector<HTMLElement>('[data-ref="text-secret-value-15"]');
    const btnCopySecret = this.container.querySelector<HTMLElement>('[data-ref="btn-copy-secret-15"]');

    btnToggleSecret?.addEventListener('click', () => {
      if (boxSecret) {
        const isHidden = boxSecret.classList.contains('is-hidden');
        toggleElement(boxSecret, isHidden);
      }
    }, { signal });

    btnCopySecret?.addEventListener('click', async () => {
      const secret = secretValueEl?.textContent?.trim() || '';
      if (!secret) return;
      try {
        await navigator.clipboard.writeText(secret);
        showToast(t('common.copied'), 'success');
      } catch {}
    }, { signal });

    const codesGrid = this.container.querySelector<HTMLElement>('[data-ref="backup-codes-grid-16"]');
    const copyAllBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-copy-backup-codes-16"]');

    codesGrid?.addEventListener('click', async (e) => {
      const badge = (e.target as HTMLElement).closest<HTMLElement>('.code-badge');
      const codeText = badge?.textContent?.trim() || '';
      if (!codeText) return;
      try {
        await navigator.clipboard.writeText(codeText);
        showToast(`${t('common.copied')}: ${codeText}`, 'success');
      } catch {}
    }, { signal });

    copyAllBtn?.addEventListener('click', async () => {
      if (!codesGrid) return;
      const codes = Array.from(codesGrid.querySelectorAll<HTMLElement>('.code-badge'))
        .map((el) => el.textContent?.trim() || '')
        .filter(Boolean);
      if (codes.length === 0) return;
      try {
        await navigator.clipboard.writeText(codes.join('\n'));
        showToast(t('settings.security.two_factor_copied_toast'), 'success');
      } catch {
        showToast(t('common.copied'), 'success');
      }
    }, { signal });
  }

  private initQrCodes(): void {
    const qrSpecs: Array<{ data: string; ref: string }> = [
      {
        data: 'https://boardpdf.com/download/f9104b2a8e',
        ref: 'share-qr-container',
      },
      {
        data: 'otpauth://totp/BoardPDF:usuario@ejemplo.com?secret=JBSWY3DPEHPK3PXP&issuer=BoardPDF',
        ref: 'qr-container-15',
      },
    ];

    qrSpecs.forEach(({ data, ref }) => {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (!el) return;
      void import('qr-code-styling')
        .then(({ default: QRCodeStyling }) => {
          const qr = new QRCodeStyling({
            backgroundOptions: { color: '#ffffff' },
            cornersDotOptions: { color: '#000000', type: 'dot' },
            cornersSquareOptions: { color: '#000000', type: 'extra-rounded' },
            data,
            dotsOptions: { color: '#000000', type: 'rounded' },
            height: 196,
            margin: 2,
            type: 'svg',
            width: 196,
          });
          el.innerHTML = '';
          qr.append(el);
        })
        .catch(() => {});
    });
  }

  private initWorkflowBuilderModal(signal: AbortSignal): void {
    const modalRoot = this.container.querySelector<HTMLElement>('[data-ref="workflow-builder-modal-19"]');
    if (!modalRoot) return;

    const toolWrapper = modalRoot.querySelector<HTMLElement>('[data-ref="field-workflow-tool-19"]');
    const triggerEl = modalRoot.querySelector<HTMLElement>('[data-ref="btn-trigger-workflow-tool-19"]');
    const selectedIconEl = modalRoot.querySelector<HTMLElement>('[data-ref="icon-selected-tool-19"]');
    const selectedTxtEl = modalRoot.querySelector<HTMLElement>('[data-ref="txt-selected-tool-19"]');
    const listEl = modalRoot.querySelector<HTMLElement>('[data-ref="list-workflow-tool-19"]');
    const optionsContainer = modalRoot.querySelector<HTMLElement>('[data-ref="workflow-modal-tool-options-19"]');
    const btnAddStep = modalRoot.querySelector<HTMLButtonElement>('[data-ref="btn-modal-add-step-19"]');
    const stepsListEl = modalRoot.querySelector<HTMLElement>('[data-ref="workflow-modal-steps-list-19"]');
    const btnClearSteps = modalRoot.querySelector<HTMLButtonElement>('[data-ref="btn-modal-clear-pipeline-19"]');
    const terminalAlert = modalRoot.querySelector<HTMLElement>('[data-ref="modal-terminal-alert-19"]');

    let selectedTool: ToolDefinition | null = null;
    let steps: SampleWorkflowStep[] = [
      { id: '1', tool: 'merge-pdf' },
      { id: '2', tool: 'compress-pdf' },
      { id: '3', tool: 'protect-pdf' },
    ];

    if (listEl) {
      listEl.innerHTML = WORKFLOW_TOOLS.map((tool) => `
        <button type="button" class="menu-item" data-tool-id="${tool.id}">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#${tool.icon}"></use></svg>
          <span class="menu-item__text">${this.escapeHtml(tool.name)}</span>
          ${tool.isTerminal ? `<span class="component-badge component-badge--sm">${t('workflows.terminal_badge')}</span>` : ''}
        </button>
      `).join('');
    }

    const isPipelineTerminal = (): boolean => {
      if (steps.length === 0) return false;
      const last = steps[steps.length - 1];
      const toolDef = WORKFLOW_TOOLS.find((tool) => tool.id === last.tool);
      return Boolean(toolDef?.isTerminal);
    };

    const renderSteps = () => {
      if (!stepsListEl) return;
      if (steps.length === 0) {
        stepsListEl.innerHTML = renderWorkflowEmptyStepsState();
      } else {
        stepsListEl.innerHTML = steps.map((step, idx) => {
          const tool = WORKFLOW_TOOLS.find((item) => item.id === step.tool);
          const toolName = tool ? tool.name : step.tool;
          const toolIcon = tool ? tool.icon : 'widgets';
          return renderWorkflowPipelineStepItem(idx + 1, toolName, toolIcon, step.id);
        }).join('');
      }

      const terminal = isPipelineTerminal();
      toggleElement(terminalAlert, terminal);

      if (triggerEl) {
        if (terminal) {
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
      if (selectedTxtEl) {
        selectedTxtEl.textContent = t('workflows.tool_placeholder');
      }
      if (optionsContainer) {
        optionsContainer.innerHTML = '';
        hideElement(optionsContainer);
      }
      this.workflowSubDropdowns.forEach((ctrl) => ctrl.destroy());
      this.workflowSubDropdowns = [];
    };

    const renderToolOptions = (tool: ToolDefinition) => {
      if (!optionsContainer) return;
      this.workflowSubDropdowns.forEach((ctrl) => ctrl.destroy());
      this.workflowSubDropdowns = [];
      optionsContainer.innerHTML = '';

      if (tool.id === 'compress-pdf') {
        showElement(optionsContainer);
        optionsContainer.innerHTML = `
          <div class="workflow-option-label" data-i18n="workflows.compress_level_label">${t('workflows.compress_level_label')}</div>
          <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="field-compress-level-19">
            <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-compress-level-19">
              <span class="dropdown-trigger__text" data-ref="txt-selected-compress-level-19" data-i18n="workflows.compress_recommended">${t('workflows.compress_recommended')}</span>
              <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
            </button>
            <div class="dropdown-backdrop" data-ref="backdrop-compress-level-19">
              <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-compress-level-19">
                <div class="menu-panel__list" data-ref="list-compress-level-19">
                  <button type="button" class="menu-item is-selected" data-value="recommended"><span data-i18n="workflows.compress_recommended">${t('workflows.compress_recommended')}</span></button>
                  <button type="button" class="menu-item" data-value="extreme"><span data-i18n="workflows.compress_extreme">${t('workflows.compress_extreme')}</span></button>
                  <button type="button" class="menu-item" data-value="low"><span data-i18n="workflows.compress_low">${t('workflows.compress_low')}</span></button>
                </div>
              </div>
            </div>
          </div>
        `;
        const cWrapper = optionsContainer.querySelector<HTMLElement>('[data-ref="field-compress-level-19"]');
        const cTxt = optionsContainer.querySelector<HTMLElement>('[data-ref="txt-selected-compress-level-19"]');
        if (cWrapper && cTxt) {
          const ctrl = setupDropdown(cWrapper, {
            onSelect: (_val: unknown, item?: HTMLElement) => {
              cTxt.textContent = item?.textContent?.trim() || '';
            },
          });
          this.workflowSubDropdowns.push(ctrl);
        }
      } else {
        hideElement(optionsContainer);
      }

      renderIcons(optionsContainer);
    };

    if (toolWrapper) {
      const ctrl = setupDropdown(toolWrapper, {
        onSelect: (_val: unknown, item?: HTMLElement) => {
          const toolId = item?.getAttribute('data-tool-id');
          const found = WORKFLOW_TOOLS.find((tool) => tool.id === toolId);
          if (found) {
            selectedTool = found;
            if (selectedIconEl) {
              showElement(selectedIconEl);
              selectedIconEl.innerHTML = `<use href="/icons.svg#${found.icon}"></use>`;
            }
            if (selectedTxtEl) {
              selectedTxtEl.textContent = found.name;
            }
            renderToolOptions(found);
          }
        },
      });
      this.dropdownControllers.push(ctrl);
    }

    btnAddStep?.addEventListener('click', () => {
      if (!selectedTool) {
        showToast(t('toasts.por_favor_selecciona_una_herramienta_pri'), 'warning');
        return;
      }
      if (isPipelineTerminal()) {
        showToast(t('workflows.terminal_alert'), 'warning');
        return;
      }

      steps.push({
        id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tool: selectedTool.id,
      });

      resetToolSelection();
      renderSteps();
    }, { signal });

    stepsListEl?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-ref^="btn-modal-remove-step-"]');
      if (btn) {
        const stepId = btn.getAttribute('data-step') || btn.getAttribute('data-id');
        if (stepId) {
          steps = steps.filter((s) => s.id !== stepId);
          renderSteps();
        }
      }
    }, { signal });

    btnClearSteps?.addEventListener('click', () => {
      steps = [];
      resetToolSelection();
      renderSteps();
    }, { signal });
  }
}

async function createModalTestView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/modaltest/modaltest.html');
  const controller = new ModalTestController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { ModalTestController, createModalTestView };
