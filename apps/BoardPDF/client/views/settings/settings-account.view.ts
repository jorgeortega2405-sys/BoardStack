import { openVerifyEmailCodeModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { checkAuthSession, currentUser, deleteApi, getApi, postApi, postFormApi, setCurrentUser } from '../../services/api.service.js';
import { connectGoogleDrive, disconnectGoogleDrive } from '../../services/google-drive.service.js';
import { getCurrentLanguage, setLanguage, t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';
import { hideElement, setupDropdown, showElement, withButtonLoading } from '../../utils/dom.util.js';
import { AVAILABLE_LANGUAGES } from '../../utils/languages.util.js';
import { applyAvatarTier } from '../../utils/tier.util.js';
import { validateAndSanitizeFile, validateEmail, validateUsername } from '../../utils/validators.util.js';

class SettingsAccountController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private dropdownController: { close: () => void; destroy: () => void; update: () => void } | null = null;
  private selectedAvatarFile: File | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    await checkAuthSession();
    this.populateUserData();
    this.loadCloudIntegrations();
    this.setupLanguageDropdown();
    this.bindEvents();
    this.checkUrlParams();
    renderIcons(this.container);
    translateElement(this.container);
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.dropdownController) {
      this.dropdownController.destroy();
      this.dropdownController = null;
    }
    this.selectedAvatarFile = null;
  }

  private getDefaultAvatarUrl(name?: string): string {
    return API_ROUTES.avatar(name || currentUser?.username || 'User');
  }

  private hasCustomAvatar(): boolean {
    return Boolean(
      currentUser?.avatar_url &&
      currentUser.avatar_url.trim() !== '' &&
      !currentUser.avatar_url.startsWith(API_ROUTES.avatarBase)
    );
  }

  private updateAvatarButtonsState(state: 'custom' | 'default' | 'preview'): void {
    const btnUpload = this.container.querySelector<HTMLElement>('[data-ref="btn-upload-avatar"]');
    const btnChange = this.container.querySelector<HTMLElement>('[data-ref="btn-change-avatar"]');
    const btnDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-delete-avatar"]');
    const btnCancel = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-avatar"]');
    const btnSave = this.container.querySelector<HTMLElement>('[data-ref="btn-save-avatar"]');

    if (state === 'preview') {
      if (btnUpload) btnUpload.classList.add('is-hidden');
      if (btnChange) btnChange.classList.add('is-hidden');
      if (btnDelete) btnDelete.classList.add('is-hidden');
      if (btnCancel) btnCancel.classList.remove('is-hidden');
      if (btnSave) btnSave.classList.remove('is-hidden');
    } else if (state === 'custom') {
      if (btnUpload) btnUpload.classList.add('is-hidden');
      if (btnChange) btnChange.classList.remove('is-hidden');
      if (btnDelete) btnDelete.classList.remove('is-hidden');
      if (btnCancel) btnCancel.classList.add('is-hidden');
      if (btnSave) btnSave.classList.add('is-hidden');
    } else {
      if (btnUpload) btnUpload.classList.remove('is-hidden');
      if (btnChange) btnChange.classList.add('is-hidden');
      if (btnDelete) btnDelete.classList.add('is-hidden');
      if (btnCancel) btnCancel.classList.add('is-hidden');
      if (btnSave) btnSave.classList.add('is-hidden');
    }
  }

  private refreshAvatarsInDom(url: string | null): void {
    const finalUrl = url || this.getDefaultAvatarUrl(currentUser?.username);
    const avatarImg = this.container.querySelector<HTMLImageElement>('[data-ref="profile-avatar-img"]');
    if (avatarImg) {
      avatarImg.classList.add('image-lazy-fade');
      avatarImg.classList.remove('image-loaded');
      avatarImg.src = finalUrl;
      avatarImg.onload = () => avatarImg.classList.add('image-loaded');
      avatarImg.onerror = () => avatarImg.classList.add('image-loaded');
      if (avatarImg.complete && avatarImg.naturalWidth > 0) {
        avatarImg.classList.add('image-loaded');
      }
    }

    const docAvatars = document.querySelectorAll<HTMLImageElement>(
      '[data-ref="avatar-img"], [data-ref="topbar-avatar-img"], [data-ref="btn-avatar-toggle"] img, [data-ref="active-account-avatar"]'
    );
    docAvatars.forEach((el) => {
      el.classList.add('image-lazy-fade');
      el.classList.remove('image-loaded');
      el.src = finalUrl;
      el.onload = () => el.classList.add('image-loaded');
      el.onerror = () => el.classList.add('image-loaded');
      if (el.complete && el.naturalWidth > 0) {
        el.classList.add('image-loaded');
      }
    });
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-avatar-file"]');
    const avatarPreviewBox = this.container.querySelector<HTMLElement>('[data-ref="avatar-preview-box"]');
    const btnUploadAvatar = this.container.querySelector<HTMLElement>('[data-ref="btn-upload-avatar"]');
    const btnChangeAvatar = this.container.querySelector<HTMLElement>('[data-ref="btn-change-avatar"]');
    const btnDeleteAvatar = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-delete-avatar"]');
    const btnCancelAvatar = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-avatar"]');
    const btnSaveAvatar = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-save-avatar"]');
    
    const triggerFileInput = () => {
      this.hideBanner('avatar-error');
      fileInput?.click();
    };

    avatarPreviewBox?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerFileInput();
    }, { signal });

    btnUploadAvatar?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerFileInput();
    }, { signal });

    btnChangeAvatar?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerFileInput();
    }, { signal });

    fileInput?.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      this.hideBanner('avatar-error');

      const validation = validateAndSanitizeFile(file, {
        allowedMimes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        maxMb: 2,
      });

      if (!validation.valid) {
        this.showBanner('item-avatar', 'avatar-error', validation.error || t('common.error_occurred'));
        target.value = '';
        return;
      }

      this.selectedAvatarFile = validation.file || null;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const avatarImg = this.container.querySelector<HTMLImageElement>('[data-ref="profile-avatar-img"]');
        if (avatarImg && ev.target?.result) {
          avatarImg.classList.add('image-lazy-fade');
          avatarImg.classList.remove('image-loaded');
          avatarImg.src = String(ev.target.result);
          avatarImg.onload = () => avatarImg.classList.add('image-loaded');
          if (avatarImg.complete) avatarImg.classList.add('image-loaded');
        }
        this.updateAvatarButtonsState('preview');
      };
      reader.readAsDataURL(file);
    }, { signal });

    btnCancelAvatar?.addEventListener('click', (e) => {
      e.preventDefault();
      this.selectedAvatarFile = null;
      if (fileInput) fileInput.value = '';
      this.hideBanner('avatar-error');
      this.refreshAvatarsInDom(currentUser?.avatar_url || null);
      this.updateAvatarButtonsState(this.hasCustomAvatar() ? 'custom' : 'default');
    }, { signal });

    btnSaveAvatar?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!this.selectedAvatarFile) return;

      await withButtonLoading(btnSaveAvatar, t('common.loading') || 'Cargando...', async () => {
        this.hideBanner('avatar-error');

        const formData = new FormData();
        formData.append('avatar', this.selectedAvatarFile!);

        try {
          const res = await postFormApi(API_ROUTES.settings.avatar, formData);
          const data = await res.json();

          if (res.ok && data.ok && currentUser) {
            currentUser.avatar_url = data.avatar_url;
            setCurrentUser(currentUser);
            this.refreshAvatarsInDom(data.avatar_url);
            this.selectedAvatarFile = null;
            if (fileInput) fileInput.value = '';
            this.updateAvatarButtonsState('custom');
            showToast(t('settings.your_account.avatar_updated_toast') || 'Foto de perfil actualizada exitosamente.', 'success');
          } else {
            this.showBanner('item-avatar', 'avatar-error', data.error || t('common.error_occurred'));
          }
        } catch (_) {
          this.showBanner('item-avatar', 'avatar-error', t('common.error_occurred'));
        }
      });
    }, { signal });

    btnDeleteAvatar?.addEventListener('click', async (e) => {
      e.preventDefault();
      await withButtonLoading(btnDeleteAvatar, t('common.loading') || 'Cargando...', async () => {
        this.hideBanner('avatar-error');

        try {
          const res = await deleteApi(API_ROUTES.settings.avatar);
          const data = await res.json();

          if (res.ok && data.ok && currentUser) {
            currentUser.avatar_url = null;
            setCurrentUser(currentUser);
            this.refreshAvatarsInDom(null);
            this.selectedAvatarFile = null;
            if (fileInput) fileInput.value = '';
            this.updateAvatarButtonsState('default');
            showToast(t('settings.your_account.avatar_deleted_toast') || 'Foto de perfil eliminada.', 'success');
          } else {
            this.showBanner('item-avatar', 'avatar-error', data.error || t('common.error_occurred'));
          }
        } catch (_) {
          this.showBanner('item-avatar', 'avatar-error', t('common.error_occurred'));
        }
      });
    }, { signal });

    const btnEditUsername = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edit-username"]');
    const btnCancelUsername = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-username"]');
    const btnSaveUsername = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-save-username"]');
    const usernameViewBox = this.container.querySelector<HTMLElement>('[data-ref="username-view-box"]');
    const usernameViewActions = this.container.querySelector<HTMLElement>('[data-ref="username-view-actions"]');
    const usernameEditRow = this.container.querySelector<HTMLElement>('[data-ref="username-edit-row"]');
    const inputUsername = this.container.querySelector<HTMLInputElement>('[data-ref="input-username"]');
    const displayUsername = this.container.querySelector<HTMLElement>('[data-ref="display-username"]');
    
    btnEditUsername?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hideBanner('username-error');
      if (inputUsername) inputUsername.value = currentUser?.username || '';
      if (usernameViewBox) usernameViewBox.classList.add('is-hidden');
      if (usernameViewActions) usernameViewActions.classList.add('is-hidden');
      if (usernameEditRow) usernameEditRow.classList.remove('is-hidden');
      inputUsername?.focus();
    }, { signal });

    btnCancelUsername?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hideBanner('username-error');
      if (usernameEditRow) usernameEditRow.classList.add('is-hidden');
      if (usernameViewBox) usernameViewBox.classList.remove('is-hidden');
      if (usernameViewActions) usernameViewActions.classList.remove('is-hidden');
    }, { signal });

    btnSaveUsername?.addEventListener('click', async (e) => {
      e.preventDefault();
      const newUsername = inputUsername?.value?.trim() || '';

      const validation = validateUsername(newUsername);
      if (!validation.valid) {
        this.showBanner('item-username', 'username-error', validation.error || t('common.error_occurred'));
        return;
      }

      if (newUsername === currentUser?.username) {
        if (usernameEditRow) usernameEditRow.classList.add('is-hidden');
        if (usernameViewBox) usernameViewBox.classList.remove('is-hidden');
        if (usernameViewActions) usernameViewActions.classList.remove('is-hidden');
        return;
      }

      await withButtonLoading(btnSaveUsername, t('common.loading') || 'Cargando...', async () => {
        this.hideBanner('username-error');

        try {
          const res = await postApi(API_ROUTES.settings.username, { username: newUsername });
          const data = await res.json();

          if (res.ok && data.ok && currentUser) {
            currentUser.username = data.username;
            setCurrentUser(currentUser);
            if (displayUsername) displayUsername.textContent = data.username;
            if (!this.hasCustomAvatar()) {
              this.refreshAvatarsInDom(null);
            }
            if (usernameEditRow) usernameEditRow.classList.add('is-hidden');
            if (usernameViewBox) usernameViewBox.classList.remove('is-hidden');
            if (usernameViewActions) usernameViewActions.classList.remove('is-hidden');
            showToast(t('settings.your_account.username_updated_toast') || 'Nombre de usuario actualizado exitosamente.', 'success');
          } else {
            this.showBanner('item-username', 'username-error', data.error || t('common.error_occurred'));
          }
        } catch (_) {
          this.showBanner('item-username', 'username-error', t('common.error_occurred'));
        }
      });
    }, { signal });

    const btnEditEmail = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edit-email"]');
    const btnCancelEmail = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-email"]');
    const btnSaveEmail = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-save-email"]');
    const emailViewBox = this.container.querySelector<HTMLElement>('[data-ref="email-view-box"]');
    const emailViewActions = this.container.querySelector<HTMLElement>('[data-ref="email-view-actions"]');
    const emailEditRow = this.container.querySelector<HTMLElement>('[data-ref="email-edit-row"]');
    const inputEmail = this.container.querySelector<HTMLInputElement>('[data-ref="input-email"]');
    const displayEmail = this.container.querySelector<HTMLElement>('[data-ref="display-email"]');
    
    const activateEmailEditMode = () => {
      this.hideBanner('email-error');
      if (inputEmail) inputEmail.value = currentUser?.email || '';
      if (emailViewBox) emailViewBox.classList.add('is-hidden');
      if (emailViewActions) emailViewActions.classList.add('is-hidden');
      if (emailEditRow) emailEditRow.classList.remove('is-hidden');
      inputEmail?.focus();
    };

    const deactivateEmailEditMode = () => {
      this.hideBanner('email-error');
      if (emailEditRow) emailEditRow.classList.add('is-hidden');
      if (emailViewBox) emailViewBox.classList.remove('is-hidden');
      if (emailViewActions) emailViewActions.classList.remove('is-hidden');
    };

    btnCancelEmail?.addEventListener('click', (e) => {
      e.preventDefault();
      deactivateEmailEditMode();
    }, { signal });

    btnSaveEmail?.addEventListener('click', async (e) => {
      e.preventDefault();
      const newEmail = inputEmail?.value?.trim() || '';

      const validation = validateEmail(newEmail);
      if (!validation.valid) {
        this.showBanner('item-email', 'email-error', validation.error || t('common.error_occurred'));
        return;
      }

      if (newEmail.toLowerCase() === (currentUser?.email || '').toLowerCase()) {
        deactivateEmailEditMode();
        return;
      }

      await withButtonLoading(btnSaveEmail, t('common.loading') || 'Cargando...', async () => {
        this.hideBanner('email-error');

        try {
          const res = await postApi(API_ROUTES.settings.email, { email: newEmail });
          const data = await res.json();

          if (res.ok && data.ok && currentUser) {
            currentUser.email = data.email;
            setCurrentUser(currentUser);
            if (displayEmail) displayEmail.textContent = data.email;
            deactivateEmailEditMode();
            showToast(t('settings.your_account.email_updated_toast') || 'Correo electrónico actualizado exitosamente.', 'success');
          } else {
            this.showBanner('item-email', 'email-error', data.error || t('common.error_occurred'));
          }
        } catch (_) {
          this.showBanner('item-email', 'email-error', t('common.error_occurred'));
        }
      });
    }, { signal });

    btnEditEmail?.addEventListener('click', async (e) => {
      e.preventDefault();
      this.hideBanner('email-error');

      await withButtonLoading(btnEditEmail, t('common.loading') || 'Cargando...', async () => {
        try {
          const res = await postApi(API_ROUTES.settings.emailRequestCode);
          const data = await res.json();

          if (!res.ok || !data.ok) {
            showToast(data.error || t('common.error_occurred'), 'danger');
            return;
          }

          if (data.alreadyAuthorized) {
            activateEmailEditMode();
            return;
          }

          showToast(t('settings.your_account.email_code_sent_toast') || 'Código de verificación enviado a tu correo.', 'info');

          openVerifyEmailCodeModal({
            email: currentUser?.email || '',
            onConfirm: async (code: string, inst: any) => {
              inst.clearError();
              inst.setConfirmLoading(true);

              try {
                const verifyRes = await postApi(API_ROUTES.settings.emailVerifyCode, { code });
                const verifyData = await verifyRes.json();

                if (!verifyRes.ok || !verifyData.ok) {
                  inst.setConfirmLoading(false);
                  inst.showError(verifyData.error || t('common.error_occurred'));
                  return false;
                }

                inst.close();
                activateEmailEditMode();
                return true;
              } catch (_) {
                inst.setConfirmLoading(false);
                inst.showError(t('common.error_occurred'));
                return false;
              }
            },
          });
        } catch (_) {
          showToast(t('common.error_occurred'), 'danger');
        }
      });
    }, { signal });

    const btnConnectGoogle = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-connect-google"]');
    const btnDisconnectGoogle = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-google"]');
        
    btnConnectGoogle?.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `${API_ROUTES.auth.google}?action=connect`;
    }, { signal });

    btnDisconnectGoogle?.addEventListener('click', async (e) => {
      e.preventDefault();
      this.hideBanner('google-error');
      this.hideBanner('google-success');

      await withButtonLoading(btnDisconnectGoogle, async () => {
        try {
          const res = await postApi(API_ROUTES.settings.googleDisconnect, {});
          const data = await res.json();
          if (!res.ok || !data.ok) {
            this.showBanner('item-google', 'google-error', data.error || t('common.error_occurred', t('ui.error_al_desconectar_la_cuenta')), 'danger');
            return;
          }

          if (currentUser) {
            currentUser.google_connected = false;
            currentUser.google_email = null;
            setCurrentUser(currentUser);
          }
          this.populateUserData();
          showToast(t('settings.your_account.google_disconnected_toast', 'Cuenta de Google desconectada exitosamente.'), 'success');
        } catch (_) {
          this.showBanner('item-google', 'google-error', t('common.error_occurred', t('ui.error_al_desconectar_la_cuenta')), 'danger');
        }
      });
    }, { signal });

    const btnConnectGdrive = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-connect-gdrive"]');
    const btnDisconnectGdrive = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-gdrive"]');
        
    btnConnectGdrive?.addEventListener('click', async (e) => {
      e.preventDefault();
      this.hideBanner('gdrive-error');
      this.hideBanner('gdrive-success');

      await withButtonLoading(btnConnectGdrive, async () => {
        const result = await connectGoogleDrive();
        if (result.success) {
          showToast(t('settings.your_account.gdrive_connected_toast', 'Google Drive vinculado exitosamente.'), 'success');
          await this.loadCloudIntegrations();
        } else {
          this.showBanner('item-gdrive', 'gdrive-error', result.error || t('common.error_occurred', 'Error al conectar Google Drive.'), 'danger');
        }
      });
    }, { signal });

    btnDisconnectGdrive?.addEventListener('click', async (e) => {
      e.preventDefault();
      this.hideBanner('gdrive-error');
      this.hideBanner('gdrive-success');

      await withButtonLoading(btnDisconnectGdrive, async () => {
        try {
          const res = await postApi(API_ROUTES.settings.cloudIntegrationsDisconnect, { provider: 'google_drive' });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            this.showBanner('item-gdrive', 'gdrive-error', data.error || t('common.error_occurred', 'Error al desvincular Google Drive.'), 'danger');
            return;
          }
          disconnectGoogleDrive();
          showToast(t('settings.your_account.gdrive_disconnected_toast', 'Google Drive desvinculado exitosamente.'), 'success');
          await this.loadCloudIntegrations();
        } catch (_) {
          this.showBanner('item-gdrive', 'gdrive-error', t('common.error_occurred', 'Error al desvincular Google Drive.'), 'danger');
        }
      });
    }, { signal });

    const btnConnectDropbox = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-connect-dropbox"]');
    const btnDisconnectDropbox = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-dropbox"]');
        
    btnConnectDropbox?.addEventListener('click', async (e) => {
      e.preventDefault();
      this.hideBanner('dropbox-error');
      this.hideBanner('dropbox-success');

      await withButtonLoading(btnConnectDropbox, async () => {
        try {
          const res = await postApi(API_ROUTES.settings.cloudIntegrationsConnect, {
            accessToken: 'dropbox_active',
            provider: 'dropbox',
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            showToast(t('settings.your_account.dropbox_connected_toast', 'Cuenta de Dropbox vinculada exitosamente.'), 'success');
            await this.loadCloudIntegrations();
          } else {
            this.showBanner('item-dropbox', 'dropbox-error', data.error || t('common.error_occurred', 'Error al vincular Dropbox.'), 'danger');
          }
        } catch (_) {
          this.showBanner('item-dropbox', 'dropbox-error', t('common.error_occurred', 'Error al vincular Dropbox.'), 'danger');
        }
      });
    }, { signal });

    btnDisconnectDropbox?.addEventListener('click', async (e) => {
      e.preventDefault();
      this.hideBanner('dropbox-error');
      this.hideBanner('dropbox-success');

      await withButtonLoading(btnDisconnectDropbox, async () => {
        try {
          const res = await postApi(API_ROUTES.settings.cloudIntegrationsDisconnect, { provider: 'dropbox' });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            this.showBanner('item-dropbox', 'dropbox-error', data.error || t('common.error_occurred', 'Error al desvincular Dropbox.'), 'danger');
            return;
          }
          showToast(t('settings.your_account.dropbox_disconnected_toast', 'Cuenta de Dropbox desvinculada exitosamente.'), 'success');
          await this.loadCloudIntegrations();
        } catch (_) {
          this.showBanner('item-dropbox', 'dropbox-error', t('common.error_occurred', 'Error al desvincular Dropbox.'), 'danger');
        }
      });
    }, { signal });
  }

  private async loadCloudIntegrations(): Promise<void> {
    const btnConnectGdrive = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-connect-gdrive"]');
    const btnDisconnectGdrive = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-gdrive"]');
    const itemGdriveDesc = this.container.querySelector<HTMLElement>('[data-ref="item-gdrive-desc"]');

    const btnConnectDropbox = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-connect-dropbox"]');
    const btnDisconnectDropbox = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-dropbox"]');
    const itemDropboxDesc = this.container.querySelector<HTMLElement>('[data-ref="item-dropbox-desc"]');

    try {
      const res = await getApi(API_ROUTES.settings.cloudIntegrations);
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.integrations)) {
        const gdrive = data.integrations.find((i: any) => i.provider === 'google_drive' && i.is_active);
        const dropbox = data.integrations.find((i: any) => i.provider === 'dropbox' && i.is_active);

        if (gdrive) {
          if (btnConnectGdrive) btnConnectGdrive.classList.add('is-hidden');
          if (btnDisconnectGdrive) btnDisconnectGdrive.classList.remove('is-hidden');
          if (itemGdriveDesc) {
            itemGdriveDesc.textContent = gdrive.account_email
              ? `Conectado como ${gdrive.account_email}`
              : t('settings.your_account.gdrive_connected_desc', 'Tu cuenta de Google Drive está vinculada.');
          }
        } else {
          if (btnConnectGdrive) btnConnectGdrive.classList.remove('is-hidden');
          if (btnDisconnectGdrive) btnDisconnectGdrive.classList.add('is-hidden');
          if (itemGdriveDesc) {
            itemGdriveDesc.textContent = t('settings.your_account.gdrive_desc', t('ui.conecta_tu_google_drive_para_importar_y_'));
          }
        }

        if (dropbox) {
          if (btnConnectDropbox) btnConnectDropbox.classList.add('is-hidden');
          if (btnDisconnectDropbox) btnDisconnectDropbox.classList.remove('is-hidden');
          if (itemDropboxDesc) {
            itemDropboxDesc.textContent = t('settings.your_account.dropbox_connected_desc', 'Tu cuenta de Dropbox está vinculada.');
          }
        } else {
          if (btnConnectDropbox) btnConnectDropbox.classList.remove('is-hidden');
          if (btnDisconnectDropbox) btnDisconnectDropbox.classList.add('is-hidden');
          if (itemDropboxDesc) {
            itemDropboxDesc.textContent = t('settings.your_account.dropbox_desc', t('ui.conecta_tu_cuenta_de_dropbox_para_accede'));
          }
        }
      }
    } catch (_) {}
  }

  private populateUserData(): void {
    const displayUsername = this.container.querySelector<HTMLElement>('[data-ref="display-username"]');
    const displayEmail = this.container.querySelector<HTMLElement>('[data-ref="display-email"]');
    const avatarPreviewBox = this.container.querySelector<HTMLElement>('[data-ref="avatar-preview-box"]');
    const btnEditEmail = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edit-email"]');

    if (currentUser) {
      if (displayUsername) displayUsername.textContent = currentUser.username;
      if (displayEmail) displayEmail.textContent = currentUser.email;
      if (btnEditEmail) btnEditEmail.classList.remove('is-hidden');

      const avatarUrl = currentUser.avatar_url || this.getDefaultAvatarUrl(currentUser.username);
      this.refreshAvatarsInDom(avatarUrl);
      this.updateAvatarButtonsState(this.hasCustomAvatar() ? 'custom' : 'default');
      applyAvatarTier(avatarPreviewBox, currentUser.subscription_tier || 'free');
    } else {
      if (displayUsername) displayUsername.textContent = '—';
      if (displayEmail) displayEmail.textContent = '—';
      if (btnEditEmail) btnEditEmail.classList.remove('is-hidden');
      this.refreshAvatarsInDom(null);
      this.updateAvatarButtonsState('default');
      applyAvatarTier(avatarPreviewBox, 'free');
    }

    const btnConnectGoogle = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-connect-google"]');
    const btnDisconnectGoogle = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-google"]');
    const itemGoogleDesc = this.container.querySelector<HTMLElement>('[data-ref="item-google-desc"]');

    if (currentUser?.google_connected) {
      if (btnConnectGoogle) btnConnectGoogle.classList.add('is-hidden');
      if (btnDisconnectGoogle) btnDisconnectGoogle.classList.remove('is-hidden');
      if (itemGoogleDesc) itemGoogleDesc.textContent = t('settings.your_account.google_connected_desc', 'Tu cuenta de Google está vinculada actualmente.');
    } else {
      if (btnConnectGoogle) btnConnectGoogle.classList.remove('is-hidden');
      if (btnDisconnectGoogle) btnDisconnectGoogle.classList.add('is-hidden');
      if (itemGoogleDesc) itemGoogleDesc.textContent = t('settings.your_account.google_desc', t('ui.vincula_tu_cuenta_de_google_para_iniciar'));
    }
  }

  private checkUrlParams(): void {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const error = urlParams.get('error');
            
      if (success === 'google_connected') {
        if (currentUser) {
          currentUser.google_connected = true;
          setCurrentUser(currentUser);
          this.populateUserData();
        }
        this.showBanner('item-google', 'google-success', t('settings.your_account.google_connected_success', 'Cuenta de Google vinculada exitosamente.'), 'success');
        showToast(t('settings.your_account.google_connected_success', 'Cuenta de Google vinculada exitosamente.'), 'success');
        window.history.replaceState({}, '', '/settings/your-account');
      } else if (error === 'google_already_linked') {
        this.showBanner('item-google', 'google-error', t('settings.your_account.google_already_linked', t('ui.esta_cuenta_de_google_ya_esta_vinculada_')), 'danger');
        window.history.replaceState({}, '', '/settings/your-account');
      } else if (error === 'google_token_failed' || error === 'google_profile_failed' || error === 'google_failed') {
        this.showBanner('item-google', 'google-error', t('settings.your_account.google_connect_failed', t('ui.no_se_pudo_vincular_la_cuenta_de_google_')), 'danger');
        window.history.replaceState({}, '', '/settings/your-account');
      }
    } catch (_) {}
  }

  private setupLanguageDropdown(): void {
    const langDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-language"]');
    const langSelectedText = this.container.querySelector<HTMLElement>('[data-ref="language-selected-text"]');
    const langListEl = this.container.querySelector<HTMLElement>('[data-ref="list-languages"]');
    const langSearchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-language"]');
    const langEmptyEl = this.container.querySelector<HTMLElement>('[data-ref="empty-languages"]');

    if (!langDropdown || !langListEl) return;

    let activeLang = getCurrentLanguage();
    const currentLangObj = AVAILABLE_LANGUAGES.find((l) => l.code.toLowerCase() === activeLang.toLowerCase());
    if (langSelectedText) {
      langSelectedText.textContent = currentLangObj?.name || 'Español';
    }

    const renderLanguagesList = (current: string) => {
      langListEl.innerHTML = AVAILABLE_LANGUAGES.map((l) => {
        const isActive = l.code.toLowerCase() === current.toLowerCase();
        return `<button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="option-lang-${l.code}" data-lang="${l.code}">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#language"></use></svg>
          <span class="menu-item__text">${l.name}</span>
        </button>`;
      }).join('');
      renderIcons(langListEl);
    };

    const filterLanguages = (query: string) => {
      const cleanQuery = query.toLowerCase().trim();
      let matches = 0;
      const items = langListEl.querySelectorAll<HTMLElement>('.menu-item');
      items.forEach((item) => {
        const name = item.querySelector('.menu-item__text')?.textContent?.toLowerCase() || '';
        const code = (item.getAttribute('data-lang') || '').toLowerCase();
        const match = !cleanQuery || name.includes(cleanQuery) || code.includes(cleanQuery);
        item.classList.toggle('is-hidden', !match);
        if (match) matches++;
      });
      if (langEmptyEl) {
        langEmptyEl.classList.toggle('is-hidden', matches !== 0);
      }
    };

    renderLanguagesList(activeLang);

    langSearchInput?.addEventListener('input', (e: Event) => {
      filterLanguages((e.target as HTMLInputElement).value);
      this.dropdownController?.update();
    });

    try {
      getApi(API_ROUTES.settings.preferences)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data?.preferences?.language) {
              activeLang = data.preferences.language;
              const found = AVAILABLE_LANGUAGES.find((l) => l.code.toLowerCase() === activeLang.toLowerCase());
              if (langSelectedText) {
                langSelectedText.textContent = found?.name || activeLang;
              }
              renderLanguagesList(activeLang);
            }
          }
        })
        .catch(() => {});
    } catch {}

    this.dropdownController = setupDropdown(langDropdown, {
      onClose: () => {
        if (langSearchInput) {
          langSearchInput.value = '';
          filterLanguages('');
        }
      },
      onSelect: async (langVal: string) => {
        activeLang = langVal;
        const selected = AVAILABLE_LANGUAGES.find((l) => l.code.toLowerCase() === langVal.toLowerCase());
        if (langSelectedText) {
          langSelectedText.textContent = selected?.name || langVal;
        }
        await setLanguage(langVal);
        renderLanguagesList(langVal);
        translateElement(this.container);
        const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav');
        if (sidebar) {
          translateElement(sidebar);
        }
        try {
          await postApi(API_ROUTES.settings.preferences, { language: langVal });
          showToast(t('settings.your_account.language_updated_toast') || 'Idioma actualizado.', 'success');
        } catch {}
      },
    });
  }

  private showBanner(anchorRef: string, bannerRef: string, text: string, type: 'danger' | 'success' = 'danger'): void {
    const anchorEl = this.container.querySelector<HTMLElement>(`[data-ref="${anchorRef}"]`);
    if (!anchorEl || !anchorEl.parentElement) return;
    let banner = anchorEl.parentElement.querySelector<HTMLElement>(`[data-ref="${bannerRef}"]`);
    if (!banner) {
      banner = document.createElement('div');
      banner.className = `banner banner--${type} banner--account`;
      banner.setAttribute('data-ref', bannerRef);
      anchorEl.after(banner);
    } else {
      banner.className = `banner banner--${type} banner--account`;
    }
    banner.textContent = text;
    showElement(banner);
  }

  private hideBanner(bannerRef: string): void {
    const banner = this.container.querySelector<HTMLElement>(`[data-ref="${bannerRef}"]`);
    if (banner) {
      hideElement(banner);
      banner.remove();
    }
  }
}

async function createYourAccountView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/your-account.html');
  const controller = new SettingsAccountController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { SettingsAccountController, createYourAccountView };
