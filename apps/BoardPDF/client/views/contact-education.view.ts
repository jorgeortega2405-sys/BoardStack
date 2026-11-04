import { getFooterHtml, mountSiteFooter } from '../components/footer.component.js';
import { submitSalesInquiryApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { SalesInquiryCategory } from '../types/contact.types.js';

export class ContactEducationController implements ViewController {
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
    primary_use_case?: string;
    role_type: string;
  } = {
    category: 'education_school',
    email: '',
    first_name: '',
    job_title: '',
    last_name: '',
    organization_name: '',
    organization_size: '',
    role_type: '',
  };

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.parseInitialParams();
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

  private parseInitialParams(): void {
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get('type') || params.get('plan');
    const selectType = this.container.querySelector<HTMLSelectElement>('[data-ref="input-edu-type"]');
    if (selectType) {
      if (typeParam === 'university' || typeParam === 'universidad' || typeParam === 'edu_university') {
        selectType.value = 'education_university';
        this.formData.category = 'education_university';
      } else if (typeParam === 'school' || typeParam === 'escuela' || typeParam === 'edu_school') {
        selectType.value = 'education_school';
        this.formData.category = 'education_school';
      }
    }
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    const btnBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edu-back"]');
    btnBack?.addEventListener('click', (e) => {
      e.preventDefault();
      this.goToStep(this.currentStep - 1);
    }, { signal });

    const btnNext1 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edu-step-1-next"]');
    btnNext1?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleStep1Next();
    }, { signal });

    const btnNext2 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edu-step-2-next"]');
    btnNext2?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleStep2Next();
    }, { signal });

    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edu-submit"]');
    btnSubmit?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.handleSubmit();
    }, { signal });

    const btnSuccessHome = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edu-success-home"]');
    btnSuccessHome?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/');
    }, { signal });
  }

  private handleStep1Next(): void {
    const selectType = this.container.querySelector<HTMLSelectElement>('[data-ref="input-edu-type"]');
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="edu-step-1-error"]');
    this.hideError(errorEl);

    if (!selectType?.value) {
      this.showError(errorEl, 'Por favor selecciona el tipo de institución.');
      return;
    }

    this.formData.category = selectType.value as SalesInquiryCategory;
    this.goToStep(2);
  }

  private handleStep2Next(): void {
    const orgName = this.container.querySelector<HTMLInputElement>('[data-ref="input-edu-org-name"]')?.value.trim();
    const roleType = this.container.querySelector<HTMLSelectElement>('[data-ref="input-edu-role"]')?.value;
    const jobTitle = this.container.querySelector<HTMLInputElement>('[data-ref="input-edu-job-title"]')?.value.trim();
    const size = this.container.querySelector<HTMLSelectElement>('[data-ref="input-edu-size"]')?.value;
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="edu-step-2-error"]');
    this.hideError(errorEl);

    if (!orgName) {
      this.showError(errorEl, 'Ingresa el nombre de la institución.');
      return;
    }
    if (!roleType) {
      this.showError(errorEl, 'Selecciona tu rol en la institución.');
      return;
    }
    if (!jobTitle) {
      this.showError(errorEl, 'Ingresa tu cargo o puesto de trabajo.');
      return;
    }
    if (!size) {
      this.showError(errorEl, 'Selecciona la cantidad estimada de alumnos y personal.');
      return;
    }

    this.formData.organization_name = orgName;
    this.formData.role_type = roleType;
    this.formData.job_title = jobTitle;
    this.formData.organization_size = size;

    this.goToStep(3);
  }

  private async handleSubmit(): Promise<void> {
    const firstName = this.container.querySelector<HTMLInputElement>('[data-ref="input-edu-first-name"]')?.value.trim();
    const lastName = this.container.querySelector<HTMLInputElement>('[data-ref="input-edu-last-name"]')?.value.trim();
    const email = this.container.querySelector<HTMLInputElement>('[data-ref="input-edu-email"]')?.value.trim();
    const phone = this.container.querySelector<HTMLInputElement>('[data-ref="input-edu-phone"]')?.value.trim();
    const message = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-edu-message"]')?.value.trim();
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="edu-step-3-error"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edu-submit"]');
    this.hideError(errorEl);

    if (!firstName || !lastName) {
      this.showError(errorEl, 'Por favor ingresa tu nombre y apellido.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      this.showError(errorEl, 'Por favor ingresa un correo electrónico válido.');
      return;
    }

    this.formData.first_name = firstName;
    this.formData.last_name = lastName;
    this.formData.email = email;
    this.formData.phone = phone || undefined;
    this.formData.message = message || undefined;

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Enviando solicitud...</span>';
    }

    const res = await submitSalesInquiryApi(this.formData);

    if (res.ok) {
      showToast('Solicitud enviada correctamente.', 'success');
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
    if (step < 1 || step > 3) return;
    this.currentStep = step;

    const step1 = this.container.querySelector<HTMLElement>('[data-ref="edu-step-1"]');
    const step2 = this.container.querySelector<HTMLElement>('[data-ref="edu-step-2"]');
    const step3 = this.container.querySelector<HTMLElement>('[data-ref="edu-step-3"]');
    const btnBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edu-back"]');
    const counter = this.container.querySelector<HTMLElement>('[data-ref="edu-step-counter"]');
    const progressBar = this.container.querySelector<HTMLElement>('[data-ref="edu-progress-bar"]');

    step1?.classList.toggle('is-hidden', step !== 1);
    step2?.classList.toggle('is-hidden', step !== 2);
    step3?.classList.toggle('is-hidden', step !== 3);

    btnBack?.classList.toggle('is-hidden', step === 1);
    if (counter) counter.textContent = `PASO ${step} DE 3`;

    if (progressBar) {
      const pct = step === 1 ? '33.33%' : step === 2 ? '66.66%' : '100%';
      progressBar.style.width = pct;
    }
  }

  private showSuccess(): void {
    const stepTop = this.container.querySelector<HTMLElement>('[data-ref="edu-step-top"]');
    const step3 = this.container.querySelector<HTMLElement>('[data-ref="edu-step-3"]');
    const successBox = this.container.querySelector<HTMLElement>('[data-ref="edu-wizard-success"]');
    const progressBar = this.container.querySelector<HTMLElement>('[data-ref="edu-progress-bar"]');

    stepTop?.classList.add('is-hidden');
    step3?.classList.add('is-hidden');
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
    const footerContainer = this.container.querySelector<HTMLElement>('[data-ref="contact-edu-view"]');
    if (!footerContainer) return;
    const footerWrapper = document.createElement('div');
    footerWrapper.style.width = '100%';
    footerWrapper.style.marginTop = '48px';
    footerWrapper.innerHTML = getFooterHtml();
    footerContainer.appendChild(footerWrapper);
    this.footerController = mountSiteFooter(footerWrapper, this.abortController?.signal);
  }
}

export async function createContactEducationView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/contact/contact-education.html');
  const controller = new ContactEducationController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
