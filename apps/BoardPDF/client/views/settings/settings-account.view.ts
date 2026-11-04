import { openModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, deleteApi, getApi, postApi, postFormApi, setCurrentUser } from '../../services/api.service.js';
import { getCurrentLanguage, setLanguage, t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { ViewController } from '../../types/common.types.js';
import { setupDropdown, withButtonLoading } from '../../utils/dom.util.js';
import { AVAILABLE_LANGUAGES } from '../../utils/languages.util.js';
import { applyAvatarTier } from '../../utils/tier.util.js';
import { validateAndSanitizeFile, validateEmail, validateUsername } from '../../utils/validators.util.js';

export class SettingsAccountController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private dropdownController: { close: () => void; destroy: () => void; update: () => void } | null = null;
  private selectedAvatarFile: File | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.populateUserData();
    this.setupLanguageDropdown();
    this.bindEvents();
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
      if (btnUpload) btnUpload.style.display = 'none';
      if (btnChange) btnChange.style.display = 'none';
      if (btnDelete) btnDelete.style.display = 'none';
      if (btnCancel) btnCancel.style.display = 'inline-flex';
      if (btnSave) btnSave.style.display = 'inline-flex';
    } else if (state === 'custom') {
      if (btnUpload) btnUpload.style.display = 'none';
      if (btnChange) btnChange.style.display = 'inline-flex';
      if (btnDelete) btnDelete.style.display = 'inline-flex';
      if (btnCancel) btnCancel.style.display = 'none';
      if (btnSave) btnSave.style.display = 'none';
    } else {
      if (btnUpload) btnUpload.style.display = 'inline-flex';
      if (btnChange) btnChange.style.display = 'none';
      if (btnDelete) btnDelete.style.display = 'none';
      if (btnCancel) btnCancel.style.display = 'none';
      if (btnSave) btnSave.style.display = 'none';
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
    const avatarErrorBanner = this.container.querySelector<HTMLElement>('[data-ref="avatar-error"]');

    const triggerFileInput = () => {
      if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';
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

      if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';

      const validation = validateAndSanitizeFile(file, {
        allowedMimes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        maxMb: 2,
      });

      if (!validation.valid) {
        if (avatarErrorBanner) {
          avatarErrorBanner.textContent = validation.error || t('common.error_occurred');
          avatarErrorBanner.style.display = 'block';
        }
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
      if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';
      this.refreshAvatarsInDom(currentUser?.avatar_url || null);
      this.updateAvatarButtonsState(this.hasCustomAvatar() ? 'custom' : 'default');
    }, { signal });

    btnSaveAvatar?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!this.selectedAvatarFile) return;

      await withButtonLoading(btnSaveAvatar, t('common.loading') || 'Cargando...', async () => {
        if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';

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
            if (avatarErrorBanner) {
              avatarErrorBanner.textContent = data.error || t('common.error_occurred');
              avatarErrorBanner.style.display = 'block';
            }
          }
        } catch (_) {
          if (avatarErrorBanner) {
            avatarErrorBanner.textContent = t('common.error_occurred');
            avatarErrorBanner.style.display = 'block';
          }
        }
      });
    }, { signal });

    btnDeleteAvatar?.addEventListener('click', async (e) => {
      e.preventDefault();
      await withButtonLoading(btnDeleteAvatar, t('common.loading') || 'Cargando...', async () => {
        if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';

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
            if (avatarErrorBanner) {
              avatarErrorBanner.textContent = data.error || t('common.error_occurred');
              avatarErrorBanner.style.display = 'block';
            }
          }
        } catch (_) {
          if (avatarErrorBanner) {
            avatarErrorBanner.textContent = t('common.error_occurred');
            avatarErrorBanner.style.display = 'block';
          }
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
    const usernameErrorBanner = this.container.querySelector<HTMLElement>('[data-ref="username-error"]');

    btnEditUsername?.addEventListener('click', (e) => {
      e.preventDefault();
      if (usernameErrorBanner) usernameErrorBanner.style.display = 'none';
      if (inputUsername) inputUsername.value = currentUser?.username || '';
      if (usernameViewBox) usernameViewBox.style.display = 'none';
      if (usernameViewActions) usernameViewActions.style.display = 'none';
      if (usernameEditRow) usernameEditRow.style.display = 'flex';
      inputUsername?.focus();
    }, { signal });

    btnCancelUsername?.addEventListener('click', (e) => {
      e.preventDefault();
      if (usernameErrorBanner) usernameErrorBanner.style.display = 'none';
      if (usernameEditRow) usernameEditRow.style.display = 'none';
      if (usernameViewBox) usernameViewBox.style.display = '';
      if (usernameViewActions) usernameViewActions.style.display = '';
    }, { signal });

    btnSaveUsername?.addEventListener('click', async (e) => {
      e.preventDefault();
      const newUsername = inputUsername?.value?.trim() || '';

      const validation = validateUsername(newUsername);
      if (!validation.valid) {
        if (usernameErrorBanner) {
          usernameErrorBanner.textContent = validation.error || t('common.error_occurred');
          usernameErrorBanner.style.display = 'block';
        }
        return;
      }

      if (newUsername === currentUser?.username) {
        if (usernameEditRow) usernameEditRow.style.display = 'none';
        if (usernameViewBox) usernameViewBox.style.display = '';
        if (usernameViewActions) usernameViewActions.style.display = '';
        return;
      }

      await withButtonLoading(btnSaveUsername, t('common.loading') || 'Cargando...', async () => {
        if (usernameErrorBanner) usernameErrorBanner.style.display = 'none';

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
            if (usernameEditRow) usernameEditRow.style.display = 'none';
            if (usernameViewBox) usernameViewBox.style.display = '';
            if (usernameViewActions) usernameViewActions.style.display = '';
            showToast(t('settings.your_account.username_updated_toast') || 'Nombre de usuario actualizado exitosamente.', 'success');
          } else {
            if (usernameErrorBanner) {
              usernameErrorBanner.textContent = data.error || t('common.error_occurred');
              usernameErrorBanner.style.display = 'block';
            }
          }
        } catch (_) {
          if (usernameErrorBanner) {
            usernameErrorBanner.textContent = t('common.error_occurred');
            usernameErrorBanner.style.display = 'block';
          }
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
    const emailErrorBanner = this.container.querySelector<HTMLElement>('[data-ref="email-error"]');

    const activateEmailEditMode = () => {
      if (emailErrorBanner) emailErrorBanner.style.display = 'none';
      if (inputEmail) inputEmail.value = currentUser?.email || '';
      if (emailViewBox) emailViewBox.style.display = 'none';
      if (emailViewActions) emailViewActions.style.display = 'none';
      if (emailEditRow) emailEditRow.style.display = 'flex';
      inputEmail?.focus();
    };

    const deactivateEmailEditMode = () => {
      if (emailErrorBanner) emailErrorBanner.style.display = 'none';
      if (emailEditRow) emailEditRow.style.display = 'none';
      if (emailViewBox) emailViewBox.style.display = '';
      if (emailViewActions) emailViewActions.style.display = '';
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
        if (emailErrorBanner) {
          emailErrorBanner.textContent = validation.error || t('common.error_occurred');
          emailErrorBanner.style.display = 'block';
        }
        return;
      }

      if (newEmail.toLowerCase() === (currentUser?.email || '').toLowerCase()) {
        deactivateEmailEditMode();
        return;
      }

      await withButtonLoading(btnSaveEmail, t('common.loading') || 'Cargando...', async () => {
        if (emailErrorBanner) emailErrorBanner.style.display = 'none';

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
            if (emailErrorBanner) {
              emailErrorBanner.textContent = data.error || t('common.error_occurred');
              emailErrorBanner.style.display = 'block';
            }
          }
        } catch (_) {
          if (emailErrorBanner) {
            emailErrorBanner.textContent = t('common.error_occurred');
            emailErrorBanner.style.display = 'block';
          }
        }
      });
    }, { signal });

    btnEditEmail?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (emailErrorBanner) emailErrorBanner.style.display = 'none';

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

          openModal({
            cancelText: t('common.cancel'),
            confirmText: t('common.continue'),
            description: t('settings.your_account.modal_email_verify_desc', { email: currentUser?.email || '' }) || `Ingresa el código de 6 dígitos que enviamos a ${currentUser?.email || ''}`,
            title: t('settings.your_account.modal_email_verify_title') || 'Verifica tu identidad',
            bodyHtml: `
              <label class="field" data-ref="field-email-code">
                <input class="field__input field__input--code" data-ref="modal-input-code" type="text" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder=" " autocomplete="one-time-code" />
                <span class="field__label" data-ref="modal-label-code">${t('settings.your_account.modal_email_code_placeholder') || 'Código de 6 dígitos'}</span>
              </label>
            `,
            onConfirm: async (inst) => {
              const inputCodeEl = inst.body.querySelector<HTMLInputElement>('[data-ref="modal-input-code"]');
              const inputCode = inputCodeEl?.value?.trim() || '';

              if (!inputCode) {
                inst.showError(t('validation.code_required') || 'Ingresa el código de 6 dígitos.');
                return;
              }
              if (inputCode.length !== 6 || !/^\d+$/.test(inputCode)) {
                inst.showError(t('validation.code_invalid') || 'El código debe contener exactamente 6 dígitos.');
                return;
              }

              inst.clearError();
              inst.setConfirmLoading(true);

              try {
                const verifyRes = await postApi(API_ROUTES.settings.emailVerifyCode, { code: inputCode });
                const verifyData = await verifyRes.json();

                if (!verifyRes.ok || !verifyData.ok) {
                  inst.setConfirmLoading(false);
                  inst.showError(verifyData.error || t('common.error_occurred'));
                  return;
                }

                inst.close();
                activateEmailEditMode();
              } catch (_) {
                inst.setConfirmLoading(false);
                inst.showError(t('common.error_occurred'));
              }
            },
          });
        } catch (_) {
          showToast(t('common.error_occurred'), 'danger');
        }
      });
    }, { signal });
  }

  private populateUserData(): void {
    const displayUsername = this.container.querySelector<HTMLElement>('[data-ref="display-username"]');
    const displayEmail = this.container.querySelector<HTMLElement>('[data-ref="display-email"]');
    const avatarPreviewBox = this.container.querySelector<HTMLElement>('[data-ref="avatar-preview-box"]');

    if (currentUser) {
      if (displayUsername) displayUsername.textContent = currentUser.username;
      if (displayEmail) displayEmail.textContent = currentUser.email;

      const avatarUrl = currentUser.avatar_url || this.getDefaultAvatarUrl(currentUser.username);
      this.refreshAvatarsInDom(avatarUrl);
      this.updateAvatarButtonsState(this.hasCustomAvatar() ? 'custom' : 'default');
      applyAvatarTier(avatarPreviewBox, currentUser.subscription_tier || 'free');
    } else {
      if (displayUsername) displayUsername.textContent = '—';
      if (displayEmail) displayEmail.textContent = '—';
      this.refreshAvatarsInDom(null);
      this.updateAvatarButtonsState('default');
      applyAvatarTier(avatarPreviewBox, 'free');
    }
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
        item.style.display = match ? 'flex' : 'none';
        if (match) matches++;
      });
      if (langEmptyEl) {
        langEmptyEl.style.display = matches === 0 ? 'block' : 'none';
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
        try {
          await postApi(API_ROUTES.settings.preferences, { language: langVal });
          showToast(t('settings.your_account.language_updated_toast') || 'Idioma actualizado.', 'success');
        } catch {}
      },
    });
  }
}

export async function createYourAccountView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/your-account.html');
  const controller = new SettingsAccountController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
