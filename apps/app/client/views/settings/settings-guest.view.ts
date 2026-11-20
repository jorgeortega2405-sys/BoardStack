import { AVAILABLE_LANGUAGES, getLanguageName } from '../../utils/languages.util.js';
import { i18n } from '../../i18n/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { setToastPreferences, toast } from '../../services/toast.service.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { themeService } from '../../services/theme.service.js';

interface GuestPreferences {
  extended_alerts: boolean;
  high_contrast: boolean;
  language: string;
  reduce_motion: boolean;
  theme: 'dark' | 'light' | 'system';
}

const STORAGE_KEY = 'boardstack_guest_prefs';

function getThemeNames(): Record<string, string> {
  return {
    dark: i18n.t('settings.accessibility.theme_dark'),
    light: i18n.t('settings.accessibility.theme_light'),
    system: i18n.t('settings.accessibility.theme_system'),
  };
}

function getLocalGuestPrefs(): GuestPreferences {
  const defaults: GuestPreferences = {
    extended_alerts: false,
    high_contrast: false,
    language: 'es',
    reduce_motion: false,
    theme: 'light',
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...defaults, ...JSON.parse(raw) };
    }
  } catch {}

  return defaults;
}

function saveLocalGuestPrefs(prefs: GuestPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

async function createSettingsGuestView(_navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--narrow';
  container.setAttribute('data-ref', 'settings-guest-layout');

  const themeNames = getThemeNames();
  let prefs = getLocalGuestPrefs();
  setToastPreferences({ extended_alerts: prefs.extended_alerts });

  container.innerHTML = `
    <div class="component-header" data-ref="settings-header">
      <h1 class="component-title" data-ref="settings-title">${i18n.t('settings.guest.title')}</h1>
      <p class="component-subtitle" data-ref="settings-subtitle">${i18n.t('settings.guest.subtitle')}</p>
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
              <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="language-selected-text">${getLanguageName(prefs.language)}</span>
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

    <div class="component-group" data-ref="group-theme">
      <div class="component-item component-item--stacked" data-ref="item-theme">
        <div class="component-item__content" data-ref="item-theme-content">
          <div class="component-item__text" data-ref="item-theme-text">
            <h2 class="component-item__title" data-ref="item-theme-title">${i18n.t('settings.accessibility.theme')}</h2>
            <p class="component-item__desc" data-ref="item-theme-desc">${i18n.t('settings.accessibility.theme_desc')}</p>
          </div>
        </div>
        <div class="component-dropdown dropdown-wrapper" data-ref="dropdown-wrapper-theme">
          <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="btn-trigger-theme" aria-label="${i18n.t('settings.accessibility.theme')}">
            <div class="component-dropdown__trigger-left dropdown-trigger__left">
              <svg class="component-icon component-dropdown__trigger-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
              <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="theme-selected-text">${themeNames[prefs.theme] || themeNames.light}</span>
            </div>
            <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>
          <div class="component-menu-backdrop dropdown-backdrop" data-ref="dropdown-backdrop-theme">
            <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-theme">
              <div class="component-menu__list menu-panel__list" data-ref="list-themes">
                <button type="button" class="component-menu__item menu-item${prefs.theme === 'light' ? ' is-active' : ''}" data-ref="option-theme-light" data-value="light">
                  <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#light_mode"></use></svg>
                  <span class="component-menu__item-text menu-item__text">${i18n.t('settings.accessibility.theme_light')}</span>
                </button>
                <button type="button" class="component-menu__item menu-item${prefs.theme === 'dark' ? ' is-active' : ''}" data-ref="option-theme-dark" data-value="dark">
                  <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#dark_mode"></use></svg>
                  <span class="component-menu__item-text menu-item__text">${i18n.t('settings.accessibility.theme_dark')}</span>
                </button>
                <button type="button" class="component-menu__item menu-item${prefs.theme === 'system' ? ' is-active' : ''}" data-ref="option-theme-system" data-value="system">
                  <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#desktop_windows"></use></svg>
                  <span class="component-menu__item-text menu-item__text">${i18n.t('settings.accessibility.theme_system')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="component-group" data-ref="group-accessibility-options">
      <div class="component-item" data-ref="item-high-contrast">
        <div class="component-item__content" data-ref="item-high-contrast-content">
          <div class="component-item__icon-box" data-ref="item-high-contrast-icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#contrast"></use></svg>
          </div>
          <div class="component-item__text" data-ref="item-high-contrast-text">
            <h2 class="component-item__title" data-ref="item-high-contrast-title">${i18n.t('settings.accessibility.high_contrast')}</h2>
            <p class="component-item__desc" data-ref="item-high-contrast-desc">${i18n.t('settings.accessibility.high_contrast_desc')}</p>
          </div>
        </div>
        <div class="component-item__actions" data-ref="item-high-contrast-actions">
          <label class="component-switch" aria-label="${i18n.t('settings.accessibility.high_contrast')}">
            <input type="checkbox" data-ref="switch-high-contrast" ${prefs.high_contrast ? 'checked' : ''} />
            <span class="component-switch__slider"></span>
          </label>
        </div>
      </div>

      <hr class="component-divider" />

      <div class="component-item" data-ref="item-reduce-motion">
        <div class="component-item__content" data-ref="item-reduce-motion-content">
          <div class="component-item__icon-box" data-ref="item-reduce-motion-icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#animation"></use></svg>
          </div>
          <div class="component-item__text" data-ref="item-reduce-motion-text">
            <h2 class="component-item__title" data-ref="item-reduce-motion-title">${i18n.t('settings.accessibility.reduce_motion')}</h2>
            <p class="component-item__desc" data-ref="item-reduce-motion-desc">${i18n.t('settings.accessibility.reduce_motion_desc')}</p>
          </div>
        </div>
        <div class="component-item__actions" data-ref="item-reduce-motion-actions">
          <label class="component-switch" aria-label="${i18n.t('settings.accessibility.reduce_motion')}">
            <input type="checkbox" data-ref="switch-reduce-motion" ${prefs.reduce_motion ? 'checked' : ''} />
            <span class="component-switch__slider"></span>
          </label>
        </div>
      </div>

      <hr class="component-divider" />

      <div class="component-item" data-ref="item-extended-alerts">
        <div class="component-item__content" data-ref="item-extended-alerts-content">
          <div class="component-item__icon-box" data-ref="item-extended-alerts-icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#notifications"></use></svg>
          </div>
          <div class="component-item__text" data-ref="item-extended-alerts-text">
            <h2 class="component-item__title" data-ref="item-extended-alerts-title">${i18n.t('settings.accessibility.extended_alerts')}</h2>
            <p class="component-item__desc" data-ref="item-extended-alerts-desc">${i18n.t('settings.accessibility.extended_alerts_desc')}</p>
          </div>
        </div>
        <div class="component-item__actions" data-ref="item-extended-alerts-actions">
          <label class="component-switch" aria-label="${i18n.t('settings.accessibility.extended_alerts')}">
            <input type="checkbox" data-ref="switch-extended-alerts" ${prefs.extended_alerts ? 'checked' : ''} />
            <span class="component-switch__slider"></span>
          </label>
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const langWrapper = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-language"]');
  const langSelectedText = container.querySelector<HTMLElement>('[data-ref="language-selected-text"]');
  const langList = container.querySelector<HTMLElement>('[data-ref="list-languages"]');
  const langSearch = container.querySelector<HTMLInputElement>('[data-ref="input-search-language"]');
  const langEmpty = container.querySelector<HTMLElement>('[data-ref="empty-languages"]');

  const renderLanguages = (filter = '') => {
    if (!langList) return;
    const clean = filter.toLowerCase().trim();
    const filtered = AVAILABLE_LANGUAGES.filter((l) => !clean || l.name.toLowerCase().includes(clean) || l.code.toLowerCase().includes(clean));

    if (langEmpty) {
      langEmpty.classList.toggle('is-hidden', filtered.length > 0);
    }

    langList.innerHTML = filtered.map((l) => {
      const isActive = l.code.toLowerCase() === prefs.language.toLowerCase();
      return `
        <button type="button" class="component-menu__item menu-item${isActive ? ' is-active' : ''}" data-ref="option-lang-${l.code}" data-lang="${l.code}">
          <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#language"></use></svg>
          <span class="component-menu__item-text menu-item__text">${l.name}</span>
        </button>
      `;
    }).join('');
    renderIcons(langList);
  };

  renderLanguages();

  langSearch?.addEventListener('input', (e) => {
    renderLanguages((e.target as HTMLInputElement).value);
  });

  setupDropdown(langWrapper, {
    onClose: () => {
      if (langSearch) langSearch.value = '';
      renderLanguages();
    },
    onSelect: (code) => {
      if (!code) return;
      prefs.language = code;
      saveLocalGuestPrefs(prefs);
      i18n.setLanguage(code);
      if (langSelectedText) langSelectedText.textContent = getLanguageName(code);
      renderLanguages();
      toast.success(i18n.t('settings.account.language_changed', { lang: getLanguageName(code) }));
    },
  });

  const themeWrapper = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-theme"]');
  const themeSelectedText = container.querySelector<HTMLElement>('[data-ref="theme-selected-text"]');

  setupDropdown(themeWrapper, {
    onSelect: (val) => {
      const themeVal = (val as 'dark' | 'light' | 'system') || 'system';
      prefs.theme = themeVal;
      themeService.setTheme(themeVal);
      saveLocalGuestPrefs(prefs);
      const names = getThemeNames();
      if (themeSelectedText) themeSelectedText.textContent = names[themeVal] || names.light;
      themeWrapper?.querySelectorAll('.component-menu__item, .menu-item').forEach((item) => {
        item.classList.toggle('is-active', item.getAttribute('data-value') === themeVal);
      });
      toast.success(i18n.t('settings.guest.theme_saved'));
    },
  });

  const switchContrast = container.querySelector<HTMLInputElement>('[data-ref="switch-high-contrast"]');
  const switchMotion = container.querySelector<HTMLInputElement>('[data-ref="switch-reduce-motion"]');
  const switchAlerts = container.querySelector<HTMLInputElement>('[data-ref="switch-extended-alerts"]');

  switchContrast?.addEventListener('change', () => {
    prefs.high_contrast = switchContrast.checked;
    saveLocalGuestPrefs(prefs);
    toast.success(i18n.t('settings.guest.pref_saved_local'));
  });

  switchMotion?.addEventListener('change', () => {
    prefs.reduce_motion = switchMotion.checked;
    saveLocalGuestPrefs(prefs);
    toast.success(i18n.t('settings.guest.pref_saved_local'));
  });

  switchAlerts?.addEventListener('change', () => {
    prefs.extended_alerts = switchAlerts.checked;
    saveLocalGuestPrefs(prefs);
    setToastPreferences({ extended_alerts: prefs.extended_alerts });
    toast.success(i18n.t('settings.guest.pref_saved_local'));
  });

  return container;
}

export {
  createSettingsGuestView
};

export type {
  GuestPreferences
};
