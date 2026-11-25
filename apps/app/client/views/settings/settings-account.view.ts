import { AVAILABLE_LANGUAGES, getLanguageName } from '../../utils/languages.util.js';
import { currentUser, deleteApi, getApi, linkedAccounts, postApi, postFormApi, setAuthState } from '../../services/api.service.js';
import { getUserAvatarUrl } from '../../utils/avatar.util.js';
import { i18n } from '../../i18n/i18n.service.js';
import { openVerifyEmailCodeModal } from '../../components/modal-dialogs.js';
import { renderIcons } from '../../services/icon.service.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { toast } from '../../services/toast.service.js';

async function createSettingsAccountView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--narrow';
  container.setAttribute('data-ref', 'settings-account-layout');

  const defaultAvatar = getUserAvatarUrl(currentUser, 80);
  const username = currentUser?.username || '';
  const email = currentUser?.email || '';
  const userTier = (currentUser?.subscription_tier === 'enterprise' || currentUser?.subscription_tier === 'business' || currentUser?.subscription_tier === 'pro') ? currentUser.subscription_tier : 'free';
  const hasCustomAvatar = Boolean(currentUser?.avatar_url && currentUser.avatar_url.trim() !== '');
  let emailChangeTicket: string | null = null;

  container.innerHTML = `
    <div class="component-header" data-ref="settings-header">
      <h1 class="component-title" data-ref="settings-title">${i18n.t('settings.account.title')}</h1>
      <p class="component-subtitle" data-ref="settings-subtitle">${i18n.t('settings.account.subtitle')}</p>
    </div>

    <div class="component-group" data-ref="group-profile-data">
      <div class="component-item" data-ref="item-avatar">
        <div class="component-item__content" data-ref="item-avatar-content">
          <div class="component-avatar component-avatar--lg" data-ref="avatar-preview-box" data-tooltip="${i18n.t('settings.account.change_avatar_tooltip')}" data-tier="${userTier}">
            <img class="component-avatar__img" data-ref="profile-avatar-img" src="${defaultAvatar}" alt="" referrerpolicy="no-referrer" />
            <div class="component-avatar__overlay" data-ref="avatar-preview-overlay">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#camera"></use></svg>
            </div>
          </div>
          <div class="component-item__text" data-ref="item-avatar-text">
            <h2 class="component-item__title" data-ref="item-avatar-title">${i18n.t('settings.account.avatar')}</h2>
            <p class="component-item__desc" data-ref="item-avatar-desc">${i18n.t('settings.account.avatar_desc')}</p>
            <input class="is-hidden" data-ref="input-avatar-file" type="file" accept="image/png, image/jpeg, image/jpg, image/webp" />
          </div>
        </div>
        <div class="component-item__actions" data-ref="item-avatar-actions">
          <button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-upload-avatar">${i18n.t('settings.account.upload_avatar')}</button>
          <button type="button" class="component-button component-button--h34 ${hasCustomAvatar ? '' : 'is-hidden'}" data-ref="btn-delete-avatar">${i18n.t('common.delete')}</button>
          <button type="button" class="component-button component-button--h34 is-hidden" data-ref="btn-cancel-avatar">${i18n.t('common.cancel')}</button>
          <button type="button" class="component-button component-button--h34 component-button--black is-hidden" data-ref="btn-save-avatar">${i18n.t('common.save')}</button>
        </div>
      </div>

      <hr class="component-divider" />

      <div class="component-item" data-ref="item-username">
        <div class="component-item__content" data-ref="item-username-content">
          <div class="component-item__text" data-ref="item-username-text">
            <h2 class="component-item__title" data-ref="item-username-title">${i18n.t('settings.account.username')}</h2>
            <div class="component-item__view-box" data-ref="username-view-box">
              <span class="component-item__value" data-ref="display-username">${username}</span>
            </div>
            <div class="component-edit-row is-hidden" data-ref="username-edit-row">
              <input class="field__input--simple" data-ref="input-username" type="text" maxlength="30" value="${username}" placeholder="${i18n.t('settings.account.username_placeholder')}" />
              <div class="component-item__actions">
                <button type="button" class="component-button component-button--h34" data-ref="btn-cancel-username">${i18n.t('common.cancel')}</button>
                <button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-save-username">${i18n.t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
        <div class="component-item__actions" data-ref="username-view-actions">
          <button type="button" class="component-button component-button--h34" data-ref="btn-edit-username">${i18n.t('common.edit')}</button>
        </div>
      </div>

      <hr class="component-divider" />

      <div class="component-item" data-ref="item-email">
        <div class="component-item__content" data-ref="item-email-content">
          <div class="component-item__text" data-ref="item-email-text">
            <h2 class="component-item__title" data-ref="item-email-title">${i18n.t('settings.account.email')}</h2>
            <div class="component-item__view-box" data-ref="email-view-box">
              <span class="component-item__value" data-ref="display-email">${email}</span>
            </div>
            <div class="component-edit-row is-hidden" data-ref="email-edit-row">
              <input class="field__input--simple" data-ref="input-email" type="email" maxlength="254" value="${email}" placeholder="${i18n.t('settings.account.email_placeholder')}" />
              <div class="component-item__actions">
                <button type="button" class="component-button component-button--h34" data-ref="btn-cancel-email">${i18n.t('common.cancel')}</button>
                <button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-save-email">${i18n.t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
        <div class="component-item__actions" data-ref="email-view-actions">
          <button type="button" class="component-button component-button--h34" data-ref="btn-edit-email">${i18n.t('common.edit')}</button>
        </div>
      </div>
    </div>

    <div class="component-group" data-ref="group-language">
      <div class="component-item component-item--stacked" data-ref="item-language">
        <div class="component-item__content" data-ref="item-language-content">
          <div class="component-item__text" data-ref="item-language-text">
            <h2 class="component-item__title" data-ref="item-language-title">${i18n.t('settings.account.language')}</h2>
            <p class="component-item__desc" data-ref="item-language-desc">${i18n.t('settings.account.language_desc')}</p>
          </div>
        </div>
        <div class="component-dropdown dropdown-wrapper" data-ref="dropdown-wrapper-language">
          <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="btn-trigger-language" aria-label="${i18n.t('settings.account.language')}">
            <div class="component-dropdown__trigger-left dropdown-trigger__left">
              <svg class="component-icon component-dropdown__trigger-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#language"></use></svg>
              <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="language-selected-text">Español</span>
            </div>
            <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>
          <div class="component-menu-backdrop dropdown-backdrop" data-ref="dropdown-backdrop-language">
            <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-language">
              <div class="component-menu__search menu-panel__search" data-ref="search-wrapper-language">
                <svg class="component-icon component-menu__search-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
                <input class="component-menu__search-input menu-panel__search-input" data-ref="input-search-language" placeholder="${i18n.t('settings.account.search_language')}" type="text" maxlength="50" autocomplete="off" />
              </div>
              <div class="component-menu__list component-menu__list--scrollable menu-panel__list menu-panel__list--scrollable" data-ref="list-languages"></div>
              <div class="component-menu__empty menu-panel__empty is-hidden" data-ref="empty-languages">${i18n.t('settings.account.empty_language')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const fileInput = container.querySelector<HTMLInputElement>('[data-ref="input-avatar-file"]');
  const avatarBox = container.querySelector<HTMLElement>('[data-ref="avatar-preview-box"]');
  const avatarImg = container.querySelector<HTMLImageElement>('[data-ref="profile-avatar-img"]');
  const btnUpload = container.querySelector<HTMLButtonElement>('[data-ref="btn-upload-avatar"]');
  const btnDelete = container.querySelector<HTMLButtonElement>('[data-ref="btn-delete-avatar"]');
  const btnCancel = container.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-avatar"]');
  const btnSave = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-avatar"]');

  let selectedFile: File | null = null;

  const triggerUpload = () => fileInput?.click();
  avatarBox?.addEventListener('click', triggerUpload);
  btnUpload?.addEventListener('click', triggerUpload);

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(i18n.t('settings.account.avatar_max_size'));
      fileInput.value = '';
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (avatarImg && e.target?.result) {
        avatarImg.src = String(e.target.result);
      }
      btnUpload?.classList.add('is-hidden');
      btnDelete?.classList.add('is-hidden');
      btnCancel?.classList.remove('is-hidden');
      btnSave?.classList.remove('is-hidden');
    };
    reader.readAsDataURL(file);
  });

  btnCancel?.addEventListener('click', () => {
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (avatarImg) {
      avatarImg.src = getUserAvatarUrl(currentUser, 80);
    }
    btnCancel?.classList.add('is-hidden');
    btnSave?.classList.add('is-hidden');
    btnUpload?.classList.remove('is-hidden');
    if (currentUser?.avatar_url && currentUser.avatar_url.trim() !== '') {
      btnDelete?.classList.remove('is-hidden');
    } else {
      btnDelete?.classList.add('is-hidden');
    }
  });

  btnSave?.addEventListener('click', async () => {
    if (!selectedFile) return;
    btnSave.disabled = true;
    btnSave.textContent = i18n.t('common.saving');

    const formData = new FormData();
    formData.append('avatar', selectedFile);

    try {
      const data = await postFormApi('/api/settings/avatar', formData);
      if (data.ok && data.avatar_url) {
        if (currentUser) currentUser.avatar_url = data.avatar_url;
        setAuthState(currentUser, linkedAccounts);
        document.querySelectorAll<HTMLImageElement>('[data-ref="avatar-img"], [data-ref="active-account-avatar"], [data-ref="profile-avatar-img"]').forEach((img) => {
          img.src = data.avatar_url;
        });
        selectedFile = null;
        if (fileInput) fileInput.value = '';
        btnSave?.classList.add('is-hidden');
        btnCancel?.classList.add('is-hidden');
        btnUpload?.classList.remove('is-hidden');
        btnDelete?.classList.remove('is-hidden');
        toast.success(i18n.t('settings.account.avatar_updated'));
      } else {
        if (data.code === 'MALICIOUS_SCRIPT_DETECTED') {
          toast.error(i18n.t('settings.account.avatar_security_rejected'));
        } else if (data.code === 'UNSUPPORTED_FORMAT') {
          toast.error(i18n.t('settings.account.avatar_invalid_format'));
        } else {
          toast.error(data.error || i18n.t('common.error'));
        }
      }
    } catch {
      toast.error(i18n.t('settings.account.connection_error'));
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = i18n.t('common.save');
    }
  });

  btnDelete?.addEventListener('click', async () => {
    btnDelete.disabled = true;
    btnDelete.textContent = i18n.t('common.loading');

    try {
      const data = await deleteApi('/api/settings/avatar');
      if (data.ok) {
        if (currentUser) currentUser.avatar_url = null;
        setAuthState(currentUser, linkedAccounts);
        const fallbackUrl = getUserAvatarUrl(currentUser, 80);
        if (avatarImg) avatarImg.src = fallbackUrl;
        document.querySelectorAll<HTMLImageElement>('[data-ref="avatar-img"], [data-ref="active-account-avatar"], [data-ref="profile-avatar-img"]').forEach((img) => {
          img.src = fallbackUrl;
        });
        btnDelete?.classList.add('is-hidden');
        btnUpload?.classList.remove('is-hidden');
        toast.success(i18n.t('settings.account.avatar_deleted'));
      } else {
        toast.error(data.error || i18n.t('common.error'));
      }
    } catch {
      toast.error(i18n.t('settings.account.connection_error'));
    } finally {
      btnDelete.disabled = false;
      btnDelete.textContent = i18n.t('common.delete');
    }
  });

  const btnEditUser = container.querySelector<HTMLButtonElement>('[data-ref="btn-edit-username"]');
  const btnCancelUser = container.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-username"]');
  const btnSaveUser = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-username"]');
  const userViewBox = container.querySelector<HTMLElement>('[data-ref="username-view-box"]');
  const userViewActions = container.querySelector<HTMLElement>('[data-ref="username-view-actions"]');
  const userEditRow = container.querySelector<HTMLElement>('[data-ref="username-edit-row"]');
  const inputUser = container.querySelector<HTMLInputElement>('[data-ref="input-username"]');
  const displayUser = container.querySelector<HTMLElement>('[data-ref="display-username"]');

  btnEditUser?.addEventListener('click', () => {
    userViewBox?.classList.add('is-hidden');
    userViewActions?.classList.add('is-hidden');
    userEditRow?.classList.remove('is-hidden');
    inputUser?.focus();
  });

  btnCancelUser?.addEventListener('click', () => {
    userEditRow?.classList.add('is-hidden');
    userViewBox?.classList.remove('is-hidden');
    userViewActions?.classList.remove('is-hidden');
    if (inputUser) inputUser.value = currentUser?.username || '';
  });

  btnSaveUser?.addEventListener('click', async () => {
    const newUsername = (inputUser?.value || '').trim();
    if (!newUsername || newUsername.length < 3) {
      toast.error(i18n.t('settings.account.username_min_length'));
      return;
    }
    if (newUsername === currentUser?.username) {
      btnCancelUser?.click();
      return;
    }

    btnSaveUser.disabled = true;
    btnSaveUser.textContent = i18n.t('common.saving');

    try {
      const data = await postApi('/api/settings/username', { username: newUsername });
      if (data.ok && data.username) {
        if (currentUser) currentUser.username = data.username;
        if (displayUser) displayUser.textContent = data.username;
        setAuthState(currentUser, linkedAccounts);
        document.querySelectorAll<HTMLElement>('[data-ref="active-account-name"]').forEach((el) => {
          el.textContent = data.username;
        });
        btnCancelUser?.click();
        toast.success(i18n.t('settings.account.username_updated'));
      } else {
        toast.error(data.error || i18n.t('common.error'));
      }
    } catch {
      toast.error(i18n.t('settings.account.connection_error'));
    } finally {
      btnSaveUser.disabled = false;
      btnSaveUser.textContent = i18n.t('common.save');
    }
  });

  const btnEditEmail = container.querySelector<HTMLButtonElement>('[data-ref="btn-edit-email"]');
  const btnCancelEmail = container.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-email"]');
  const btnSaveEmail = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-email"]');
  const emailViewBox = container.querySelector<HTMLElement>('[data-ref="email-view-box"]');
  const emailViewActions = container.querySelector<HTMLElement>('[data-ref="email-view-actions"]');
  const emailEditRow = container.querySelector<HTMLElement>('[data-ref="email-edit-row"]');
  const inputEmail = container.querySelector<HTMLInputElement>('[data-ref="input-email"]');
  const displayEmail = container.querySelector<HTMLElement>('[data-ref="display-email"]');

  btnEditEmail?.addEventListener('click', async () => {
    btnEditEmail.disabled = true;
    const origText = btnEditEmail.textContent || i18n.t('common.edit');
    btnEditEmail.textContent = i18n.t('common.loading');

    try {
      const res = await postApi('/api/settings/email/request-code');
      if (!res.ok) {
        toast.error(res.error || i18n.t('common.error'));
        btnEditEmail.disabled = false;
        btnEditEmail.textContent = origText;
        return;
      }

      toast.info(i18n.t(res.reused ? 'settings.account.email_verify_reused' : 'settings.account.email_verify_sent'));

      openVerifyEmailCodeModal({
        email: currentUser?.email || '',
        onConfirm: async (code: string, inst) => {
          inst.clearError();
          inst.setConfirmLoading(true);

          try {
            const verifyRes = await postApi('/api/settings/email/verify-code', { code });
            if (!verifyRes.ok) {
              inst.setConfirmLoading(false);
              inst.showError(verifyRes.error || i18n.t('auth.code_invalid_or_expired'));
              return false;
            }

            emailChangeTicket = verifyRes.ticket || null;
            inst.close();
            emailViewBox?.classList.add('is-hidden');
            emailViewActions?.classList.add('is-hidden');
            emailEditRow?.classList.remove('is-hidden');
            inputEmail?.focus();
            toast.success(i18n.t('settings.account.identity_verified'));
            return true;
          } catch {
            inst.setConfirmLoading(false);
            inst.showError(i18n.t('common.error'));
            return false;
          }
        },
      });
    } catch {
      toast.error(i18n.t('settings.account.connection_error'));
    } finally {
      btnEditEmail.disabled = false;
      btnEditEmail.textContent = origText;
    }
  });

  btnCancelEmail?.addEventListener('click', () => {
    emailChangeTicket = null;
    emailEditRow?.classList.add('is-hidden');
    emailViewBox?.classList.remove('is-hidden');
    emailViewActions?.classList.remove('is-hidden');
    if (inputEmail) inputEmail.value = currentUser?.email || '';
  });

  btnSaveEmail?.addEventListener('click', async () => {
    const newEmail = (inputEmail?.value || '').toLowerCase().trim();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error(i18n.t('settings.account.email_empty_error'));
      return;
    }
    if (newEmail === currentUser?.email) {
      btnCancelEmail?.click();
      return;
    }

    btnSaveEmail.disabled = true;
    btnSaveEmail.textContent = i18n.t('common.saving');

    try {
      const data = await postApi('/api/settings/email', { email: newEmail, ticket: emailChangeTicket });
      if (data.ok && data.email) {
        if (currentUser) currentUser.email = data.email;
        if (displayEmail) displayEmail.textContent = data.email;
        setAuthState(currentUser, linkedAccounts);
        document.querySelectorAll<HTMLElement>('[data-ref="active-account-email"]').forEach((el) => {
          el.textContent = data.email;
        });
        emailChangeTicket = null;
        btnCancelEmail?.click();
        toast.success(i18n.t('settings.account.email_updated'));
      } else {
        toast.error(data.error || i18n.t('common.error'));
      }
    } catch {
      toast.error(i18n.t('settings.account.connection_error'));
    } finally {
      btnSaveEmail.disabled = false;
      btnSaveEmail.textContent = i18n.t('common.save');
    }
  });

  const langWrapper = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-language"]');
  const langSelectedText = container.querySelector<HTMLElement>('[data-ref="language-selected-text"]');
  const langList = container.querySelector<HTMLElement>('[data-ref="list-languages"]');
  const langSearch = container.querySelector<HTMLInputElement>('[data-ref="input-search-language"]');
  const langEmpty = container.querySelector<HTMLElement>('[data-ref="empty-languages"]');

  let currentLang = 'es';

  const renderLanguages = (filter = '') => {
    if (!langList) return;
    const clean = filter.toLowerCase().trim();
    const filtered = AVAILABLE_LANGUAGES.filter((l) => !clean || l.name.toLowerCase().includes(clean) || l.code.toLowerCase().includes(clean));

    if (langEmpty) {
      langEmpty.classList.toggle('is-hidden', filtered.length > 0);
    }

    langList.innerHTML = filtered.map((l) => {
      const isActive = l.code.toLowerCase() === currentLang.toLowerCase();
      return `
        <button type="button" class="component-menu__item menu-item${isActive ? ' is-active' : ''}" data-ref="option-lang-${l.code}" data-lang="${l.code}">
          <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#language"></use></svg>
          <span class="component-menu__item-text menu-item__text">${l.name}</span>
        </button>
      `;
    }).join('');
    renderIcons(langList);
  };

  const loadPreferences = async () => {
    try {
      const res = await getApi('/api/settings/preferences');
      if (res.ok && res.preferences?.language) {
        currentLang = res.preferences.language;
        if (langSelectedText) langSelectedText.textContent = getLanguageName(currentLang);
        renderLanguages();
      }
    } catch {}
  };

  void loadPreferences();
  renderLanguages();

  langSearch?.addEventListener('input', (e) => {
    renderLanguages((e.target as HTMLInputElement).value);
  });

  setupDropdown(langWrapper, {
    onClose: () => {
      if (langSearch) langSearch.value = '';
      renderLanguages();
    },
    onSelect: async (code) => {
      if (!code) return;
      currentLang = code;
      i18n.setLanguage(code);
      if (langSelectedText) langSelectedText.textContent = getLanguageName(code);
      renderLanguages();
      try {
        await postApi('/api/settings/preferences', { language: code });
        toast.success(i18n.t('settings.account.language_changed', { lang: getLanguageName(code) }));
      } catch {
        toast.error(i18n.t('common.preference_error'));
      }
    },
  });

  return container;
}

export {
  createSettingsAccountView
};