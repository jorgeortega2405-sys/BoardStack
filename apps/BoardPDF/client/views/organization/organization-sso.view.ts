import { getApi, putApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';

export class OrganizationSsoController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;

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
    const btnTest = this.container.querySelector<HTMLElement>('[data-ref="btn-test-sso"]');

    btnSave?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.handleSaveConfig();
    }, { signal });

    btnTest?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleTestConnection();
    }, { signal });
  }

  private async loadSsoConfig(): Promise<void> {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="sso-error"]');
    try {
      const response = await getApi('/api/organization/sso');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorBanner) {
          errorBanner.textContent = errorData.error || t('common.error_load_data', 'Error al cargar configuración SSO.');
          errorBanner.classList.remove('is-hidden');
        }
        return;
      }

      const data = await response.json();
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

      if (inputSpEntity && sso.entity_id) {
        inputSpEntity.value = sso.entity_id;
      }
      if (inputSpAcs && sso.acs_url) {
        inputSpAcs.value = sso.acs_url;
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

    const checkboxEnable = this.container.querySelector<HTMLInputElement>('[data-ref="checkbox-sso-enable"]');
    const inputIdpEntity = this.container.querySelector<HTMLInputElement>('[data-ref="input-idp-entity-id"]');
    const inputIdpSsoUrl = this.container.querySelector<HTMLInputElement>('[data-ref="input-idp-sso-url"]');
    const inputCert = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-idp-certificate"]');
    const inputXml = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-idp-metadata-xml"]');
    const checkboxEnforce = this.container.querySelector<HTMLInputElement>('[data-ref="checkbox-enforce-sso"]');
    const inputSpAcs = this.container.querySelector<HTMLInputElement>('[data-ref="input-sp-acs-url"]');

    const enabled = Boolean(checkboxEnable?.checked);
    const entity_id = (inputIdpEntity?.value || '').trim();
    const idp_sso_url = (inputIdpSsoUrl?.value || '').trim();
    const idp_certificate = (inputCert?.value || '').trim();
    const idp_metadata_xml = (inputXml?.value || '').trim();
    const enforce_sso = Boolean(checkboxEnforce?.checked);
    const acs_url = (inputSpAcs?.value || '').trim();

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
