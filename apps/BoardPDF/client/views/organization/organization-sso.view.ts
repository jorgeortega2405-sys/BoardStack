import { getApi, putApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';

export class OrganizationSsoController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private initialDomain: string = '';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.bindEvents();
    renderIcons(this.container);
    translateElement(this.container);
    await this.loadSsoConfig();
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  bindEvents(): void {
    const signal = this.abortController?.signal;
    const btnSave = this.container.querySelector<HTMLElement>('[data-ref="btn-save-sso"]');
    const btnSaveSec = this.container.querySelector<HTMLElement>('[data-ref="btn-save-sso-secondary"]');
    const btnTest = this.container.querySelector<HTMLElement>('[data-ref="btn-test-sso"]');
    const btnTestSec = this.container.querySelector<HTMLElement>('[data-ref="btn-test-sso-secondary"]');
    const btnCopyEntity = this.container.querySelector<HTMLElement>('[data-ref="btn-copy-sp-entity"]');
    const btnCopyAcs = this.container.querySelector<HTMLElement>('[data-ref="btn-copy-sp-acs"]');
    const tabBtnCert = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-cert"]');
    const tabBtnXml = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-xml"]');

    const onSave = async (e: Event) => {
      e.preventDefault();
      await this.handleSaveConfig();
    };

    const onTest = (e: Event) => {
      e.preventDefault();
      this.handleTestConnection();
    };

    btnSave?.addEventListener('click', onSave, { signal });
    btnSaveSec?.addEventListener('click', onSave, { signal });
    btnTest?.addEventListener('click', onTest, { signal });
    btnTestSec?.addEventListener('click', onTest, { signal });

    btnCopyEntity?.addEventListener('click', (e) => {
      e.preventDefault();
      const input = this.container.querySelector<HTMLInputElement>('[data-ref="input-sp-entity-id"]');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        showToast(t('common.copied', 'Entity ID copiado al portapapeles'), 'info');
      }
    }, { signal });

    btnCopyAcs?.addEventListener('click', (e) => {
      e.preventDefault();
      const input = this.container.querySelector<HTMLInputElement>('[data-ref="input-sp-acs-url"]');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        showToast(t('common.copied', 'ACS URL copiada al portapapeles'), 'info');
      }
    }, { signal });

    tabBtnCert?.addEventListener('click', (e) => {
      e.preventDefault();
      this.selectCredentialTab('cert');
    }, { signal });

    tabBtnXml?.addEventListener('click', (e) => {
      e.preventDefault();
      this.selectCredentialTab('xml');
    }, { signal });
  }

  private selectCredentialTab(tab: 'cert' | 'xml'): void {
    const tabBtnCert = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-cert"]');
    const tabBtnXml = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-xml"]');
    const boxCert = this.container.querySelector<HTMLElement>('[data-ref="container-idp-cert"]');
    const boxXml = this.container.querySelector<HTMLElement>('[data-ref="container-idp-xml"]');

    if (tab === 'cert') {
      tabBtnCert?.classList.add('component-button--black');
      tabBtnXml?.classList.remove('component-button--black');
      boxCert?.classList.remove('is-hidden');
      boxXml?.classList.add('is-hidden');
    } else {
      tabBtnXml?.classList.add('component-button--black');
      tabBtnCert?.classList.remove('component-button--black');
      boxXml?.classList.remove('is-hidden');
      boxCert?.classList.add('is-hidden');
    }
  }

  private async loadSsoConfig(): Promise<void> {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="sso-error"]');
    try {
      const [ssoRes, orgRes] = await Promise.all([
        getApi('/api/organization/sso'),
        getApi('/api/organization'),
      ]);

      if (orgRes.ok) {
        const orgData = await orgRes.json();
        const inputDomain = this.container.querySelector<HTMLInputElement>('[data-ref="input-org-domain"]');
        if (inputDomain && orgData.organization?.domain) {
          inputDomain.value = orgData.organization.domain;
          this.initialDomain = orgData.organization.domain;
        }
      }

      if (!ssoRes.ok) {
        const errorData = await ssoRes.json().catch(() => ({}));
        if (errorBanner) {
          errorBanner.textContent = errorData.error || t('common.error_load_data', 'Error al cargar configuración SSO.');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      const data = await ssoRes.json();
      const sso = data.sso || {};

      const checkboxEnable = this.container.querySelector<HTMLInputElement>('[data-ref="checkbox-sso-enable"]');
      const inputIdpEntity = this.container.querySelector<HTMLInputElement>('[data-ref="input-idp-entity-id"]');
      const inputIdpSsoUrl = this.container.querySelector<HTMLInputElement>('[data-ref="input-idp-sso-url"]');
      const inputCert = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-idp-certificate"]');
      const inputXml = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-idp-metadata-xml"]');
      const checkboxEnforce = this.container.querySelector<HTMLInputElement>('[data-ref="checkbox-enforce-sso"]');
      const inputSpEntity = this.container.querySelector<HTMLInputElement>('[data-ref="input-sp-entity-id"]');
      const inputSpAcs = this.container.querySelector<HTMLInputElement>('[data-ref="input-sp-acs-url"]');

      if (checkboxEnable) checkboxEnable.checked = Boolean(sso.enabled);
      if (inputIdpEntity) inputIdpEntity.value = sso.entity_id || '';
      if (inputIdpSsoUrl) inputIdpSsoUrl.value = sso.idp_sso_url || '';
      if (inputCert) inputCert.value = sso.idp_certificate || '';
      if (inputXml) inputXml.value = sso.idp_metadata_xml || '';
      if (checkboxEnforce) checkboxEnforce.checked = Boolean(sso.enforce_sso);

      if (inputSpEntity) {
        inputSpEntity.value = `${window.location.origin}/api/sso/saml/metadata`;
      }
      if (inputSpAcs) {
        inputSpAcs.value = `${window.location.origin}/api/sso/saml/acs`;
      }

      if (sso.idp_metadata_xml && !sso.idp_certificate) {
        this.selectCredentialTab('xml');
      }
    } catch {
      if (errorBanner) {
        errorBanner.textContent = t('common.network_error', 'Error de conexión con el servidor.');
        errorBanner.classList.remove('is-hidden');
      }
    }
  }

  private async handleSaveConfig(): Promise<void> {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="sso-error"]');
    const successBanner = this.container.querySelector<HTMLElement>('[data-ref="sso-success"]');
    if (errorBanner) errorBanner.classList.add('is-hidden');
    if (successBanner) successBanner.classList.add('is-hidden');

    const inputDomain = this.container.querySelector<HTMLInputElement>('[data-ref="input-org-domain"]');
    const checkboxEnable = this.container.querySelector<HTMLInputElement>('[data-ref="checkbox-sso-enable"]');
    const inputIdpEntity = this.container.querySelector<HTMLInputElement>('[data-ref="input-idp-entity-id"]');
    const inputIdpSsoUrl = this.container.querySelector<HTMLInputElement>('[data-ref="input-idp-sso-url"]');
    const inputCert = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-idp-certificate"]');
    const inputXml = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-idp-metadata-xml"]');
    const checkboxEnforce = this.container.querySelector<HTMLInputElement>('[data-ref="checkbox-enforce-sso"]');
    const inputSpAcs = this.container.querySelector<HTMLInputElement>('[data-ref="input-sp-acs-url"]');

    const domain = (inputDomain?.value || '').trim().toLowerCase();
    const enabled = Boolean(checkboxEnable?.checked);
    const entity_id = (inputIdpEntity?.value || '').trim();
    const idp_sso_url = (inputIdpSsoUrl?.value || '').trim();
    const idp_certificate = (inputCert?.value || '').trim();
    const idp_metadata_xml = (inputXml?.value || '').trim();
    const enforce_sso = Boolean(checkboxEnforce?.checked);
    const acs_url = (inputSpAcs?.value || '').trim();

    if (domain !== this.initialDomain) {
      try {
        const orgRes = await putApi('/api/organization', { domain: domain || null });
        if (!orgRes.ok) {
          const orgErr = await orgRes.json().catch(() => ({}));
          if (errorBanner) {
            errorBanner.textContent = orgErr.error || t('common.error_occurred', 'Error al guardar el dominio corporativo.');
            errorBanner.classList.remove('is-hidden');
          }
          return;
        }
        this.initialDomain = domain;
      } catch {
        if (errorBanner) {
          errorBanner.textContent = t('common.network_error', 'Error de conexión con el servidor.');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }
    }

    const body: Record<string, any> = {
      acs_url: acs_url || 'https://boardpdf.com/api/sso/saml/acs',
      enabled,
      enforce_sso,
      entity_id,
      idp_certificate,
      idp_metadata_xml,
      idp_sso_url,
    };

    try {
      const response = await putApi('/api/organization/sso', body);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (errorBanner) {
          errorBanner.textContent = data.error || t('common.error_occurred', 'Error al guardar configuración SSO.');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      if (successBanner) {
        successBanner.textContent = t('org.sso.saved', 'Configuración SAML/SSO guardada exitosamente.');
        successBanner.classList.remove('is-hidden');
      }
      showToast(t('org.sso.saved', 'Configuración SAML/SSO guardada exitosamente.'), 'success');
    } catch {
      if (errorBanner) {
        errorBanner.textContent = t('common.network_error', 'Error de conexión con el servidor.');
        errorBanner.classList.remove('is-hidden');
      }
    }
  }

  private handleTestConnection(): void {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="sso-error"]');
    const successBanner = this.container.querySelector<HTMLElement>('[data-ref="sso-success"]');
    if (errorBanner) errorBanner.classList.add('is-hidden');
    if (successBanner) successBanner.classList.add('is-hidden');

    const inputIdpEntity = this.container.querySelector<HTMLInputElement>('[data-ref="input-idp-entity-id"]');
    const inputIdpSsoUrl = this.container.querySelector<HTMLInputElement>('[data-ref="input-idp-sso-url"]');
    const inputCert = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-idp-certificate"]');
    const inputXml = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-idp-metadata-xml"]');

    const entity_id = (inputIdpEntity?.value || '').trim();
    const sso_url = (inputIdpSsoUrl?.value || '').trim();
    const cert = (inputCert?.value || '').trim();
    const xml = (inputXml?.value || '').trim();

    if (!entity_id) {
      if (errorBanner) {
        errorBanner.textContent = 'Ingresa el Entity ID del IdP.';
        errorBanner.classList.remove('is-hidden');
      }
      return;
    }

    if (!sso_url) {
      if (errorBanner) {
        errorBanner.textContent = 'Ingresa la URL de SSO del IdP.';
        errorBanner.classList.remove('is-hidden');
      }
      return;
    }

    if (!cert && !xml) {
      if (errorBanner) {
        errorBanner.textContent = 'Ingresa el certificado X.509 o los metadatos XML del IdP.';
        errorBanner.classList.remove('is-hidden');
      }
      return;
    }

    if (successBanner) {
      successBanner.textContent = 'Parámetros SAML 2.0 validados correctamente.';
      successBanner.classList.remove('is-hidden');
    }
    showToast('Parámetros SAML 2.0 validados.', 'success');
  }
}

export async function createOrgSsoView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/organization/sso.html');
  const controller = new OrganizationSsoController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
