import { navigate } from '../../app-router.js';
import { open2FAModal, openDeleteAccountModal, openDisable2FAModal, openVerifyPasswordModal, setupNewPasswordModalStep } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { clearUserState, currentUser, getApi, postApi, setCurrentUser } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ModalInstance, ViewController } from '../../types/common.types.js';
import { setupPasswordToggle, withButtonLoading } from '../../utils/dom.util.js';
import { validatePassword } from '../../utils/validators.util.js';

class SettingsSecurityController implements ViewController {
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
      btnConfigure2fa.className = 'component-button component-button--h34';
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
    openVerifyPasswordModal({
      onConfirm: async (currentPassword: string, inst: any) => {
        inst.clearError();
        inst.setConfirmLoading(true);

        try {
          const verifyRes = await postApi(API_ROUTES.settings.passwordVerify, { currentPassword });
          const verifyData = await verifyRes.json();

          if (!verifyRes.ok || !verifyData.ok) {
            inst.setConfirmLoading(false);
            inst.showError(verifyData.error || t('settings.security.current_password_incorrect') || 'La contraseña actual es incorrecta.');
            return false;
          }

          this.showStep2NewPassword(inst);
          return false;
        } catch (_) {
          inst.setConfirmLoading(false);
          inst.showError(t('common.error_occurred'));
          return false;
        }
      },
    });
  }

  private showStep2NewPassword(modal: ModalInstance): void {
    setupNewPasswordModalStep(modal, {
      onConfirm: async (newPass: string, inst: any) => {
        inst.clearError();
        inst.setConfirmLoading(true);

        try {
          const updateRes = await postApi(API_ROUTES.settings.password, { newPassword: newPass });
          const updateData = await updateRes.json();

          if (!updateRes.ok || !updateData.ok) {
            inst.setConfirmLoading(false);
            inst.showError(updateData.error || t('common.error_occurred'));
            return false;
          }

          inst.close();
          showToast(t('settings.security.password_updated_toast') || 'Contraseña actualizada exitosamente.', 'success');
          return true;
        } catch (_) {
          inst.setConfirmLoading(false);
          inst.showError(t('common.error_occurred'));
          return false;
        }
      },
    });
  }

  private openDisable2FAModal(): void {
    openDisable2FAModal({
      onConfirm: async (val: string, inst: any) => {
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
            return true;
          }
          inst.setConfirmLoading(false);
          inst.showError(data.error || t('common.error_occurred'));
          return false;
        } catch (_) {
          inst.setConfirmLoading(false);
          inst.showError(t('common.error_occurred'));
          return false;
        }
      },
    });
  }

  private openDeleteAccountModal(): void {
    openDeleteAccountModal({
      onConfirm: async (password: string, inst: any) => {
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
            return true;
          }
          inst.setConfirmLoading(false);
          inst.showError(data.error || t('settings.security.modal_current_password_error') || 'Contraseña incorrecta.');
          return false;
        } catch (_) {
          inst.setConfirmLoading(false);
          inst.showError(t('common.error_occurred'));
          return false;
        }
      },
    });
  }
}

async function createSecurityView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/security.html');
  const controller = new SettingsSecurityController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { SettingsSecurityController, createSecurityView };
