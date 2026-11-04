import { getFooterHtml, mountSiteFooter } from '../components/footer.component.js';
import { submitSalesInquiryApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { SalesInquiryCategory } from '../types/contact.types.js';

export class ContactSalesController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentStep = 1;
  private footerController: { destroy: () => void } | null = null;
  private formData: {
    category: SalesInquiryCategory;
    email: string;
    first_name: string;
    job_title: string;
    last_name: string;
    message?: string;
    organization_name: string;
    organization_size: string;
    phone?: string;
    primary_use_case: string;
    role_type?: string;
  } = {
    category: 'enterprise',
    email: '',
    first_name: '',
    job_title: '',
    last_name: '',
    organization_name: '',
    organization_size: '',
    primary_use_case: '',
  };

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.bindEvents();
    this.renderFooter();
    renderIcons(this.container);
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

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    const btnBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sales-back"]');
    btnBack?.addEventListener('click', (e) => {
      e.preventDefault();
      this.goToStep(1);
    }, { signal });

    const btnNext1 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sales-step-1-next"]');
    btnNext1?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleStep1Next();
    }, { signal });

    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sales-submit"]');
    btnSubmit?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.handleSubmit();
    }, { signal });

    const btnSuccessHome = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sales-success-home"]');
    btnSuccessHome?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/');
    }, { signal });
  }

  private handleStep1Next(): void {
    const firstName = this.container.querySelector<HTMLInputElement>('[data-ref="input-sales-first-name"]')?.value.trim();
    const lastName = this.container.querySelector<HTMLInputElement>('[data-ref="input-sales-last-name"]')?.value.trim();
    const email = this.container.querySelector<HTMLInputElement>('[data-ref="input-sales-email"]')?.value.trim();
    const inquiryType = this.container.querySelector<HTMLSelectElement>('[data-ref="input-sales-inquiry-type"]')?.value;
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="sales-step-1-error"]');
    this.hideError(errorEl);

    if (!firstName || !lastName) {
      this.showError(errorEl, 'Por favor ingresa tu nombre y apellido.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      this.showError(errorEl, 'Por favor ingresa un correo electrónico de empresa válido.');
      return;
    }

    if (!inquiryType) {
      this.showError(errorEl, 'Por favor selecciona el motivo de tu consulta.');
      return;
    }

    this.formData.first_name = firstName;
    this.formData.last_name = lastName;
    this.formData.email = email;
    this.formData.primary_use_case = inquiryType;

    this.goToStep(2);
  }

  private async handleSubmit(): Promise<void> {
    const orgName = this.container.querySelector<HTMLInputElement>('[data-ref="input-sales-org-name"]')?.value.trim();
    const size = this.container.querySelector<HTMLSelectElement>('[data-ref="input-sales-size"]')?.value;
    const jobTitle = this.container.querySelector<HTMLInputElement>('[data-ref="input-sales-job-title"]')?.value.trim();
    const phone = this.container.querySelector<HTMLInputElement>('[data-ref="input-sales-phone"]')?.value.trim();
    const message = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-sales-message"]')?.value.trim();
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="sales-step-2-error"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sales-submit"]');
    this.hideError(errorEl);

    if (!orgName) {
      this.showError(errorEl, 'Por favor ingresa el nombre de la empresa.');
      return;
    }

    if (!size) {
      this.showError(errorEl, 'Por favor selecciona el tamaño de la empresa.');
      return;
    }

    if (!jobTitle) {
      this.showError(errorEl, 'Por favor ingresa tu cargo o puesto de trabajo.');
      return;
    }

    this.formData.organization_name = orgName;
    this.formData.organization_size = size;
    this.formData.job_title = jobTitle;
    this.formData.phone = phone || undefined;
    this.formData.message = message || undefined;

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Enviando solicitud...</span>';
    }

    const res = await submitSalesInquiryApi(this.formData);

    if (res.ok) {
      showToast('Solicitud comercial enviada con éxito.', 'success');
      this.showSuccess();
    } else {
      this.showError(errorEl, res.error || 'Ocurrió un error al enviar. Intenta de nuevo.');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Enviar solicitud</span>';
      }
    }
  }

  private goToStep(step: number): void {
    if (step < 1 || step > 2) return;
    this.currentStep = step;

    const step1 = this.container.querySelector<HTMLElement>('[data-ref="sales-step-1"]');
    const step2 = this.container.querySelector<HTMLElement>('[data-ref="sales-step-2"]');
    const btnBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sales-back"]');
    const counter = this.container.querySelector<HTMLElement>('[data-ref="sales-step-counter"]');
    const progressBar = this.container.querySelector<HTMLElement>('[data-ref="sales-progress-bar"]');

    step1?.classList.toggle('is-hidden', step !== 1);
    step2?.classList.toggle('is-hidden', step !== 2);

    btnBack?.classList.toggle('is-hidden', step === 1);
    if (counter) counter.textContent = `PASO ${step} DE 2`;

    if (progressBar) {
      progressBar.style.width = step === 1 ? '50%' : '100%';
    }
  }

  private showSuccess(): void {
    const stepTop = this.container.querySelector<HTMLElement>('[data-ref="sales-step-top"]');
    const step2 = this.container.querySelector<HTMLElement>('[data-ref="sales-step-2"]');
    const successBox = this.container.querySelector<HTMLElement>('[data-ref="sales-wizard-success"]');
    const progressBar = this.container.querySelector<HTMLElement>('[data-ref="sales-progress-bar"]');

    stepTop?.classList.add('is-hidden');
    step2?.classList.add('is-hidden');
    successBox?.classList.remove('is-hidden');
    if (progressBar) progressBar.style.width = '100%';
  }

  private showError(el: HTMLElement | null, msg: string): void {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('is-hidden');
  }

  private hideError(el: HTMLElement | null): void {
    if (!el) return;
    el.textContent = '';
    el.classList.add('is-hidden');
  }

  private renderFooter(): void {
    const footerContainer = this.container.querySelector<HTMLElement>('[data-ref="contact-sales-view"]');
    if (!footerContainer) return;
    const footerWrapper = document.createElement('div');
    footerWrapper.style.width = '100%';
    footerWrapper.style.marginTop = '48px';
    footerWrapper.innerHTML = getFooterHtml();
    footerContainer.appendChild(footerWrapper);
    this.footerController = mountSiteFooter(footerWrapper, this.abortController?.signal);
  }
}

export async function createContactSalesView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/contact/contact-sales.html');
  const controller = new ContactSalesController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
