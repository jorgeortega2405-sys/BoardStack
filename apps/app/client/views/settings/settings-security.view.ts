import { currentUser, getApi, logoutApi, postApi } from '../../services/api.service.js';
import { i18n } from '../../i18n/i18n.service.js';
import { open2FAModal } from '../../components/modal.component.js';
import {
  openDeleteAccountModal,
  openDisable2FAModal,
  openVerifyPasswordModal,
  setupNewPasswordModalStep,
} from '../../components/modal-dialogs.js';
import { renderIcons } from '../../services/icon.service.js';
import { toast } from '../../services/toast.service.js';

async function createSettingsSecurityView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--narrow';
  container.setAttribute('data-ref', 'settings-security-layout');

  let accountStatus: { has_password: boolean } = { has_password: Boolean(currentUser?.has_password) };
  let is2faEnabled = Boolean(currentUser?.two_factor_enabled);

  try {
    const statusData = await getApi('/api/settings/account/status');
    if (statusData.ok) {
      accountStatus = statusData;
    }
    const twoFaData = await getApi('/api/settings/2fa/status');
    if (twoFaData.ok) {
      is2faEnabled = Boolean(twoFaData.enabled);
    }
  } catch {}

  container.innerHTML = `
    <div class="component-header" data-ref="settings-header">
      <h1 class="component-title" data-ref="settings-title">${i18n.t('settings.security.title')}</h1>
      <p class="component-subtitle" data-ref="settings-subtitle">${i18n.t('settings.security.subtitle')}</p>
    </div>

    <div class="component-group" data-ref="group-auth-methods">
      <div class="component-item" data-ref="item-password">
        <div class="component-item__content" data-ref="item-password-content">
          <div class="component-item__icon-box" data-ref="item-password-icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
          </div>
          <div class="component-item__text" data-ref="item-password-text">
            <h2 class="component-item__title" data-ref="item-password-title">${i18n.t('settings.security.password_title')}</h2>
            <p class="component-item__desc" data-ref="item-password-desc">${i18n.t('settings.security.password_desc')}</p>
          </div>
        </div>
        <div class="component-item__actions" data-ref="item-password-actions">
          <button type="button" class="component-button component-button--h34" data-ref="btn-change-password">
            ${accountStatus.has_password ? i18n.t('settings.security.change_password') : i18n.t('settings.security.create_password')}
          </button>
        </div>
      </div>

      <hr class="component-divider" />

      <div class="component-item" data-ref="item-2fa">
        <div class="component-item__content" data-ref="item-2fa-content">
          <div class="component-item__icon-box" data-ref="item-2fa-icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#shield"></use></svg>
          </div>
          <div class="component-item__text" data-ref="item-2fa-text">
            <h2 class="component-item__title" data-ref="item-2fa-title">${i18n.t('settings.security.two_factor')}</h2>
            <p class="component-item__desc" data-ref="item-2fa-desc">${i18n.t('settings.security.two_factor_desc')}</p>
          </div>
        </div>
        <div class="component-item__actions" data-ref="item-2fa-actions">
          <button type="button" class="component-button component-button--h34 ${is2faEnabled ? 'component-button--danger' : ''}" data-ref="btn-configure-2fa">
            ${is2faEnabled ? i18n.t('settings.security.disable_2fa') : i18n.t('settings.security.setup_2fa')}
          </button>
        </div>
      </div>
    </div>

    <div class="component-group" data-ref="group-danger-zone">
      <div class="component-item" data-ref="item-delete-account">
        <div class="component-item__content" data-ref="item-delete-account-content">
          <div class="component-item__text" data-ref="item-delete-account-text">
            <h2 class="component-item__title" data-ref="item-delete-account-title">${i18n.t('settings.security.delete_account')}</h2>
            <p class="component-item__desc" data-ref="item-delete-account-desc">${i18n.t('settings.security.delete_account_desc')}</p>
          </div>
        </div>
        <div class="component-item__actions" data-ref="item-delete-account-actions">
          <button type="button" class="component-button component-button--h34 component-button--danger" data-ref="btn-delete-account">${i18n.t('settings.security.delete_account')}</button>
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const btnChangePwd = container.querySelector<HTMLButtonElement>('[data-ref="btn-change-password"]');
  const btn2FA = container.querySelector<HTMLButtonElement>('[data-ref="btn-configure-2fa"]');
  const btnDeleteAcc = container.querySelector<HTMLButtonElement>('[data-ref="btn-delete-account"]');

  const update2FAUi = (enabled: boolean) => {
    is2faEnabled = enabled;
    if (currentUser) currentUser.two_factor_enabled = enabled;
    if (btn2FA) {
      if (enabled) {
        btn2FA.textContent = i18n.t('settings.security.disable_2fa');
        btn2FA.className = 'component-button component-button--h34 component-button--danger';
      } else {
        btn2FA.textContent = i18n.t('settings.security.setup_2fa');
        btn2FA.className = 'component-button component-button--h34';
      }
    }
  };

  btnChangePwd?.addEventListener('click', (e) => {
    e.preventDefault();
    const hasPwd = accountStatus.has_password;

    openVerifyPasswordModal({
      description: i18n.t('modal.verify_identity_desc'),
      hasPassword: hasPwd,
      onConfirm: async (payload, inst) => {
        inst.clearError();

        const currentPassword = payload.password;
        let securityTicket = payload.securityTicket;

        if (!securityTicket) {
          if (!currentPassword) {
            inst.showError(i18n.t('modal.enter_current_password_prompt'));
            return false;
          }

          inst.setConfirmLoading(true);
          try {
            const verifyRes = await postApi('/api/settings/password/verify', { currentPassword });
            if (!verifyRes.ok) {
              inst.setConfirmLoading(false);
              inst.showError(verifyRes.error || i18n.t('settings.security.wrong_current_password'));
              return false;
            }
            securityTicket = verifyRes.securityTicket;
          } catch {
            inst.setConfirmLoading(false);
            inst.showError(i18n.t('auth.connection_error'));
            return false;
          }
        }

        setupNewPasswordModalStep(inst, {
          onConfirm: async (newPassword, step2Inst) => {
            step2Inst.clearError();
            step2Inst.setConfirmLoading(true);

            try {
              const updateRes = await postApi('/api/settings/password', {
                currentPassword,
                newPassword,
                securityTicket,
              });
              if (!updateRes.ok) {
                step2Inst.setConfirmLoading(false);
                step2Inst.showError(
                  updateRes.error ||
                    (hasPwd
                      ? i18n.t('settings.security.error_updating_password')
                      : i18n.t('settings.security.error_creating_password'))
                );
                return false;
              }

              accountStatus.has_password = true;
              if (currentUser) currentUser.has_password = true;
              if (btnChangePwd) btnChangePwd.textContent = i18n.t('settings.security.change_password');
              step2Inst.close();
              toast.success(
                hasPwd
                  ? i18n.t('settings.security.password_updated_success')
                  : i18n.t('settings.security.password_created_success')
              );
              return true;
            } catch {
              step2Inst.setConfirmLoading(false);
              step2Inst.showError(i18n.t('auth.connection_error'));
              return false;
            }
          },
        });

        return false;
      },
      title: i18n.t('modal.verify_identity_title'),
    });
  });

  btn2FA?.addEventListener('click', (e) => {
    e.preventDefault();
    if (is2faEnabled) {
      openDisable2FAModal({
        onConfirm: async (credential, inst) => {
          inst.clearError();
          inst.setConfirmLoading(true, i18n.t('settings.security.deactivating'));

          try {
            const res = await postApi('/api/settings/2fa/disable', {
              code: credential,
              password: credential,
            });

            if (res.ok) {
              inst.close();
              update2FAUi(false);
              toast.success(i18n.t('settings.security.disable_2fa_success'));
              return true;
            } else {
              inst.setConfirmLoading(false);
              inst.showError(res.error || i18n.t('settings.security.error_disabling_2fa'));
              return false;
            }
          } catch {
            inst.setConfirmLoading(false);
            inst.showError(i18n.t('auth.connection_error'));
            return false;
          }
        },
      });
    } else {
      open2FAModal({
        onSuccess: () => {
          update2FAUi(true);
        },
      });
    }
  });

  btnDeleteAcc?.addEventListener('click', (e) => {
    e.preventDefault();
    const hasPwd = accountStatus.has_password;

    openDeleteAccountModal({
      hasPassword: hasPwd,
      onConfirm: async (payload, inst) => {
        inst.clearError();
        inst.setConfirmLoading(true, i18n.t('settings.security.deleting'));

        try {
          const res = await postApi('/api/settings/account/delete', {
            password: payload.password,
            securityTicket: payload.securityTicket,
          });
          if (res.ok) {
            toast.success(i18n.t('settings.security.delete_account_success'));
            await logoutApi();
            navigate('/');
            return true;
          } else {
            inst.setConfirmLoading(false);
            inst.showError(res.error || i18n.t('settings.security.error_deleting_account'));
            return false;
          }
        } catch {
          inst.setConfirmLoading(false);
          inst.showError(i18n.t('auth.connection_error'));
          return false;
        }
      },
    });
  });

  return container;
}

export {
  createSettingsSecurityView
};
