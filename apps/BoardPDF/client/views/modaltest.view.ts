import { MODAL_2FA_SHIELD_SVG } from '../graphics/modal-illustrations.graphics.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { ViewController } from '../types/common.types.js';
import { setupPasswordToggle } from '../utils/dom.util.js';

class ModalTestController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();

    const svgWrapper13 = this.container.querySelector<HTMLElement>('[data-ref="svg-wrapper-13"]');
    if (svgWrapper13) {
      svgWrapper13.innerHTML = MODAL_2FA_SHIELD_SVG;
    }

    const pwdToggle03 = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-pwd-03"]');
    const pwdInput03 = this.container.querySelector<HTMLInputElement>('[data-ref="input-current-pwd"]');
    setupPasswordToggle(pwdToggle03, pwdInput03);

    const pwdToggleNew = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-pwd-new"]');
    const pwdInputNew = this.container.querySelector<HTMLInputElement>('[data-ref="input-new-pwd"]');
    setupPasswordToggle(pwdToggleNew, pwdInputNew);

    const pwdToggleConfirm = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-pwd-confirm"]');
    const pwdInputConfirm = this.container.querySelector<HTMLInputElement>('[data-ref="input-confirm-pwd"]');
    setupPasswordToggle(pwdToggleConfirm, pwdInputConfirm);

    const pwdToggleUnlock = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-unlock-pwd"]');
    const pwdInputUnlock = this.container.querySelector<HTMLInputElement>('[data-ref="input-unlock-pwd"]');
    setupPasswordToggle(pwdToggleUnlock, pwdInputUnlock);

    renderIcons(this.container);
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
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
