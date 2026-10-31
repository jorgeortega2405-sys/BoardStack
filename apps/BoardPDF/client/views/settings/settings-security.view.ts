import { navigate } from '../../app-router.js';
import { open2FAModal, openModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { clearUserState, currentUser, getApi, postApi, setCurrentUser } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ModalInstance, ViewController } from '../../types/common.types.js';
import { setupPasswordToggle, withButtonLoading } from '../../utils/dom.util.js';
import { validatePassword } from '../../utils/validators.util.js';

export class SettingsSecurityController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private is2faEnabled = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.is2faEnabled = Boolean(currentUser?.two_factor_enabled);
    this.update2FAButtonUi(this.is2faEnabled);
    this.bindEvents();
    this.load2FAStatus();
    renderIcons(this.container);
    translateElement(this.container);
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private update2FAButtonUi(enabled: boolean): void {
    this.is2faEnabled = enabled;
    const btnConfigure2fa = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-configure-2fa"]');
    if (!btnConfigure2fa) return;

    if (enabled) {
      btnConfigure2fa.textContent = t('settings.security.btn_disable_2fa') || 'Desactivar';
      btnConfigure2fa.className = 'component-button component-button--h34 component-button--danger';
    } else {
      btnConfigure2fa.textContent = t('settings.security.btn_configure_2fa') || 'Configurar';
      btnConfigure2fa.className = 'component-button component-button--h34 component-button--black';
    }
  }

  private async load2FAStatus(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.settings.twoFactorStatus);
      if (res.ok) {
        const data = await res.json();
        this.update2FAButtonUi(Boolean(data.enabled));
        if (currentUser) {
          currentUser.two_factor_enabled = Boolean(data.enabled);
          setCurrentUser(currentUser);
        }
      }
    } catch {}
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    const btnChangePassword = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-change-password"]');
    btnChangePassword?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openPasswordFlow();
    }, { signal });

    const btnConfigure2fa = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-configure-2fa"]');
    btnConfigure2fa?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.is2faEnabled) {
        this.openDisable2FAModal();
      } else {
        open2FAModal({
          onSuccess: () => {
            this.update2FAButtonUi(true);
            if (currentUser) {
              currentUser.two_factor_enabled = true;
              setCurrentUser(currentUser);
            }
          },
        });
      }
    }, { signal });

    const btnDeleteAccount = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-delete-account"]');
    btnDeleteAccount?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openDeleteAccountModal();
    }, { signal });
  }

  private openPasswordFlow(): void {
    const modal = openModal({
      cancelText: t('common.cancel'),
      confirmText: t('common.continue'),
      description: t('settings.security.modal_verify_password_desc') || 'Por motivos de seguridad, ingresa tu contraseña actual para continuar.',
      title: t('settings.security.modal_verify_password_title') || 'Verifica tu contraseña actual',
      bodyHtml: `
        <label class="field" data-ref="field-current-password">
          <input class="field__input field__input--has-action" data-ref="modal-input-current-password" type="password" maxlength="128" placeholder=" " autocomplete="current-password" />
          <span class="field__label" data-ref="modal-label-current-password">${t('settings.security.modal_current_password_label') || 'Contraseña actual'}</span>
          <button type="button" class="field__action" data-ref="toggle-modal-current-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
          </button>
        </label>
      `,
      onConfirm: async (inst) => {
        const inputPass = inst.body.querySelector<HTMLInputElement>('[data-ref="modal-input-current-password"]');
        const currentPassword = inputPass?.value || '';

        if (!currentPassword) {
          inst.showError(t('validation.password_required') || 'Ingresa tu contraseña actual.');
          return;
        }

        inst.clearError();
        inst.setConfirmLoading(true);

        try {
          const verifyRes = await postApi(API_ROUTES.settings.passwordVerify, { currentPassword });
          const verifyData = await verifyRes.json();

          if (!verifyRes.ok || !verifyData.ok) {
            inst.setConfirmLoading(false);
            inst.showError(verifyData.error || t('settings.security.current_password_incorrect') || 'La contraseña actual es incorrecta.');
            return;
          }

          this.showStep2NewPassword(inst);
        } catch (_) {
          inst.setConfirmLoading(false);
          inst.showError(t('common.error_occurred'));
        }
      },
    });

    const currentPassInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-current-password"]');
    const togglePassBtn = modal.body.querySelector<HTMLElement>('[data-ref="toggle-modal-current-password"]');
    setupPasswordToggle(togglePassBtn, currentPassInput);
  }

  private showStep2NewPassword(modal: ModalInstance): void {
    modal.setTitle(t('settings.security.modal_new_password_title') || 'Crear nueva contraseña');
    modal.setDescription(t('settings.security.modal_new_password_desc') || 'Tu nueva contraseña debe tener al menos 8 caracteres.');
    modal.clearError();
    modal.setConfirmLoading(false);
    modal.setConfirmVisible(true);
    modal.setConfirmText(t('common.save') || 'Guardar');

    modal.setBody(`
      <div class="form-group-modal" data-ref="group-new-passwords">
        <label class="field" data-ref="field-new-password">
          <input class="field__input field__input--has-action" data-ref="modal-input-new-password" type="password" maxlength="128" placeholder=" " autocomplete="new-password" />
          <span class="field__label" data-ref="modal-label-new-password">${t('settings.security.modal_new_password_label') || 'Nueva contraseña'}</span>
          <button type="button" class="field__action" data-ref="toggle-modal-new-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
          </button>
        </label>
        <label class="field" data-ref="field-confirm-new-password" style="margin-top: 14px;">
          <input class="field__input field__input--has-action" data-ref="modal-input-confirm-new-password" type="password" maxlength="128" placeholder=" " autocomplete="new-password" />
          <span class="field__label" data-ref="modal-label-confirm-new-password">${t('settings.security.modal_confirm_new_password_label') || 'Confirmar nueva contraseña'}</span>
          <button type="button" class="field__action" data-ref="toggle-modal-confirm-new-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
          </button>
        </label>
      </div>
    `);

    const inputNewPass = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-new-password"]');
    const inputConfirmPass = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-confirm-new-password"]');
    const toggleNewPass = modal.body.querySelector<HTMLElement>('[data-ref="toggle-modal-new-password"]');
    const toggleConfirmPass = modal.body.querySelector<HTMLElement>('[data-ref="toggle-modal-confirm-new-password"]');

    setupPasswordToggle(toggleNewPass, inputNewPass);
    setupPasswordToggle(toggleConfirmPass, inputConfirmPass);

    inputNewPass?.focus();

    modal.setOnConfirm(async (inst) => {
      const newPass = inputNewPass?.value || '';
      const confirmPass = inputConfirmPass?.value || '';

      const validation = validatePassword(newPass);
      if (!validation.valid) {
        inst.showError(validation.error || t('validation.password_min'));
        return;
      }

      if (newPass !== confirmPass) {
        inst.showError(t('validation.passwords_not_match') || 'Las contraseñas no coinciden.');
        return;
      }

      inst.clearError();
      inst.setConfirmLoading(true);

      try {
        const updateRes = await postApi(API_ROUTES.settings.password, { newPassword: newPass });
        const updateData = await updateRes.json();

        if (!updateRes.ok || !updateData.ok) {
          inst.setConfirmLoading(false);
          inst.showError(updateData.error || t('common.error_occurred'));
          return;
        }

        inst.close();
        showToast(t('settings.security.password_updated_toast') || 'Contraseña actualizada exitosamente.', 'success');
      } catch (_) {
        inst.setConfirmLoading(false);
        inst.showError(t('common.error_occurred'));
      }
    });
  }

  private openDisable2FAModal(): void {
    const modal = openModal({
      cancelText: t('common.cancel'),
      confirmClass: 'component-button--danger',
      confirmText: t('settings.security.btn_disable_2fa') || 'Desactivar',
      description: t('settings.security.two_factor_disable_confirm') || 'Ingresa tu contraseña actual o un código de verificación para desactivar la protección.',
      title: t('settings.security.two_factor_disable_title') || 'Desactivar autenticación en dos pasos',
      bodyHtml: `
        <label class="field" data-ref="field-disable-2fa-password" style="margin-top: 14px;">
          <input class="field__input" data-ref="input-disable-2fa-password" type="password" placeholder=" " autocomplete="current-password" />
          <span class="field__label" data-ref="label-disable-2fa-password">${t('settings.security.current_password_label') || 'Contraseña o código de 6 dígitos'}</span>
        </label>
      `,
      onConfirm: async (inst) => {
        const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-disable-2fa-password"]');
        const val = input ? input.value.trim() : '';
        if (!val) {
          inst.showError(t('settings.security.modal_current_password_error') || 'Ingresa tu contraseña o código de verificación.');
          return;
        }

        inst.clearError();
        inst.setConfirmLoading(true);

        try {
          const res = await postApi(API_ROUTES.settings.twoFactorDisable, { code: val, password: val });
          const data = await res.json();

          if (res.ok && data.ok) {
            inst.close();
            this.update2FAButtonUi(false);
            if (currentUser) {
              currentUser.two_factor_enabled = false;
              setCurrentUser(currentUser);
            }
            showToast(t('settings.security.two_factor_disabled_toast') || 'Autenticación en dos pasos desactivada exitosamente.', 'success');
          } else {
            inst.setConfirmLoading(false);
            inst.showError(data.error || t('common.error_occurred'));
          }
        } catch (_) {
          inst.setConfirmLoading(false);
          inst.showError(t('common.error_occurred'));
        }
      },
    });
  }

  private openDeleteAccountModal(): void {
    openModal({
      cancelText: t('common.cancel'),
      confirmClass: 'component-button--danger',
      confirmText: t('settings.security.btn_delete_account') || 'Eliminar cuenta',
      description: t('settings.security.delete_account_modal_desc') || 'Esta acción es irreversible. Se eliminarán permanentemente todos tus archivos y datos asociados.',
      title: t('settings.security.delete_account_modal_title') || '¿Eliminar tu cuenta definitivamente?',
      bodyHtml: `
        <label class="field" data-ref="field-delete-password" style="margin-top: 14px;">
          <input class="field__input" data-ref="input-delete-password" type="password" placeholder=" " autocomplete="current-password" />
          <span class="field__label" data-ref="label-delete-password">${t('settings.security.modal_current_password_label') || 'Contraseña actual'}</span>
        </label>
      `,
      onConfirm: async (inst) => {
        const inputPwd = inst.body.querySelector<HTMLInputElement>('[data-ref="input-delete-password"]');
        const password = inputPwd?.value?.trim() || '';

        if (!password) {
          inst.showError(t('settings.security.modal_current_password_error') || 'Ingresa tu contraseña actual para confirmar la eliminación.');
          return;
        }

        inst.clearError();
        inst.setConfirmLoading(true);

        try {
          const res = await postApi(API_ROUTES.settings.accountDelete, { password });
          const data = await res.json();

          if (res.ok && data.ok) {
            inst.close();
            clearUserState();
            showToast(t('settings.security.delete_account_toast') || 'Tu cuenta y todos sus datos han sido eliminados permanentemente.', 'success');
            navigate('/login');
          } else {
            inst.setConfirmLoading(false);
            inst.showError(data.error || t('common.error_occurred'));
          }
        } catch (_) {
          inst.setConfirmLoading(false);
          inst.showError(t('common.error_occurred'));
        }
      },
    });
  }
}

export async function createSecurityView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/security.html');
  const controller = new SettingsSecurityController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
