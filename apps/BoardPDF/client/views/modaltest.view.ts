import { MODAL_2FA_SHIELD_SVG } from '../graphics/modal-illustrations.graphics.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { ViewController } from '../types/common.types.js';
import { setupPasswordToggle, toggleElement } from '../utils/dom.util.js';

class ModalTestController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();

    const svgWrapper17 = this.container.querySelector<HTMLElement>('[data-ref="svg-wrapper-17"]');
    if (svgWrapper17) {
      svgWrapper17.innerHTML = MODAL_2FA_SHIELD_SVG;
    }

    const pwdToggle05 = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-modal-password"]');
    const pwdInput05 = this.container.querySelector<HTMLInputElement>('[data-ref="input-modal-password"]');
    setupPasswordToggle(pwdToggle05, pwdInput05);

    const pwdToggle06New = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-new-password"]');
    const pwdInput06New = this.container.querySelector<HTMLInputElement>('[data-ref="input-new-password"]');
    setupPasswordToggle(pwdToggle06New, pwdInput06New);

    const pwdToggle09 = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-delete-password"]');
    const pwdInput09 = this.container.querySelector<HTMLInputElement>('[data-ref="input-delete-password"]');
    setupPasswordToggle(pwdToggle09, pwdInput09);

    const pwdToggle10 = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-unlock-pwd"]');
    const pwdInput10 = this.container.querySelector<HTMLInputElement>('[data-ref="input-unlock-password"]');
    setupPasswordToggle(pwdToggle10, pwdInput10);

    const btnToggleSecret16 = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-secret-16"]');
    const boxSecret16 = this.container.querySelector<HTMLElement>('[data-ref="box-secret-key-16"]');
    btnToggleSecret16?.addEventListener('click', () => {
      if (boxSecret16) {
        const isHidden = boxSecret16.classList.contains('is-hidden');
        toggleElement(boxSecret16, isHidden);
      }
    }, { signal: this.abortController.signal });

    const qrContainer14 = this.container.querySelector<HTMLElement>('[data-ref="share-qr-container"]');
    if (qrContainer14) {
      void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
        const qr = new QRCodeStyling({
          backgroundOptions: { color: '#ffffff' },
          cornersDotOptions: { color: '#000000', type: 'dot' },
          cornersSquareOptions: { color: '#000000', type: 'extra-rounded' },
          data: 'https://boardpdf.com/download/f9104b2a8e',
          dotsOptions: { color: '#000000', type: 'rounded' },
          height: 140,
          type: 'svg',
          width: 140,
        });
        qr.append(qrContainer14);
      }).catch(() => {});
    }

    const qrContainer16 = this.container.querySelector<HTMLElement>('[data-ref="qr-container-16"]');
    if (qrContainer16) {
      void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
        const qr = new QRCodeStyling({
          backgroundOptions: { color: '#ffffff' },
          cornersDotOptions: { color: '#000000', type: 'dot' },
          cornersSquareOptions: { color: '#000000', type: 'extra-rounded' },
          data: 'otpauth://totp/BoardPDF:usuario@ejemplo.com?secret=JBSWY3DPEHPK3PXP&issuer=BoardPDF',
          dotsOptions: { color: '#000000', type: 'rounded' },
          height: 140,
          type: 'svg',
          width: 140,
        });
        qr.append(qrContainer16);
      }).catch(() => {});
    }

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
