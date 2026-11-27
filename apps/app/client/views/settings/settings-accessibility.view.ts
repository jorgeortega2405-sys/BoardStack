import { getApi, postApi } from '../../services/api.service.js';
import { i18n } from '../../i18n/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { setToastPreferences, toast } from '../../services/toast.service.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { themeService } from '../../services/theme.service.js';

interface UserPreferences {
  extended_alerts: boolean;
  high_contrast: boolean;
  language: string;
  reduce_motion: boolean;
  theme: 'dark' | 'light' | 'system';
}

function getThemeNames(): Record<string, string> {
  return {
    dark: i18n.t('settings.accessibility.theme_dark'),
    light: i18n.t('settings.accessibility.theme_light'),
    system: i18n.t('settings.accessibility.theme_system'),
  };
}

async function createSettingsAccessibilityView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--narrow';
  container.setAttribute('data-ref', 'settings-accessibility-layout');

  const themeNames = getThemeNames();

  let prefs: UserPreferences = {
    extended_alerts: false,
    high_contrast: false,
    language: 'es',
    reduce_motion: false,
    theme: themeService.getTheme(),
  };

  container.innerHTML = `
    <div class="component-header" data-ref="settings-header">
      <h1 class="component-title" data-ref="settings-title">${i18n.t('settings.accessibility.title')}</h1>
      <p class="component-subtitle" data-ref="settings-subtitle">${i18n.t('settings.accessibility.subtitle')}</p>
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
                <button type="button" class="component-menu__item menu-item is-active" data-ref="option-theme-light" data-value="light">
                  <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#light_mode"></use></svg>
                  <span class="component-menu__item-text menu-item__text">${i18n.t('settings.accessibility.theme_light')}</span>
                </button>
                <button type="button" class="component-menu__item menu-item" data-ref="option-theme-dark" data-value="dark">
                  <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#dark_mode"></use></svg>
                  <span class="component-menu__item-text menu-item__text">${i18n.t('settings.accessibility.theme_dark')}</span>
                </button>
                <button type="button" class="component-menu__item menu-item" data-ref="option-theme-system" data-value="system">
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
            <input type="checkbox" data-ref="switch-high-contrast" />
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
            <input type="checkbox" data-ref="switch-reduce-motion" />
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
            <input type="checkbox" data-ref="switch-extended-alerts" />
            <span class="component-switch__slider"></span>
          </label>
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const themeWrapper = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-theme"]');
  const themeSelectedText = container.querySelector<HTMLElement>('[data-ref="theme-selected-text"]');
  const switchContrast = container.querySelector<HTMLInputElement>('[data-ref="switch-high-contrast"]');
  const switchMotion = container.querySelector<HTMLInputElement>('[data-ref="switch-reduce-motion"]');
  const switchAlerts = container.querySelector<HTMLInputElement>('[data-ref="switch-extended-alerts"]');

  const updateUI = () => {
    const currentNames = getThemeNames();
    if (themeSelectedText) {
      themeSelectedText.textContent = currentNames[prefs.theme] || currentNames.light;
    }
    if (themeWrapper) {
      themeWrapper.querySelectorAll('.component-menu__item, .menu-item').forEach((item) => {
        const val = item.getAttribute('data-value');
        item.classList.toggle('is-active', val === prefs.theme);
      });
    }
    if (switchContrast) switchContrast.checked = Boolean(prefs.high_contrast);
    if (switchMotion) switchMotion.checked = Boolean(prefs.reduce_motion);
    if (switchAlerts) switchAlerts.checked = Boolean(prefs.extended_alerts);
    document.documentElement.setAttribute('data-contrast', prefs.high_contrast ? 'high' : 'normal');
    document.documentElement.setAttribute('data-reduce-motion', prefs.reduce_motion ? 'true' : 'false');
  };

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingUpdates: Partial<UserPreferences> = {};

  const flushPreferences = async () => {
    if (Object.keys(pendingUpdates).length === 0) return;
    const toSend = { ...pendingUpdates };
    pendingUpdates = {};

    try {
      const res = await postApi('/api/settings/preferences', toSend);
      if (res.ok) {
        toast.success(i18n.t('common.preference_saved'));
      } else {
        toast.error(res.error || i18n.t('common.preference_error'));
      }
    } catch {
      toast.error(i18n.t('auth.connection_error'));
    }
  };

  const savePreference = (partial: Partial<UserPreferences>) => {
    prefs = { ...prefs, ...partial };
    pendingUpdates = { ...pendingUpdates, ...partial };
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      void flushPreferences();
    }, 250);
  };

  setupDropdown(themeWrapper, {
    onSelect: (val) => {
      const themeVal = (val as 'dark' | 'light' | 'system') || 'system';
      prefs.theme = themeVal;
      themeService.setTheme(themeVal);
      updateUI();
      void savePreference({ theme: themeVal });
    },
  });

  switchContrast?.addEventListener('change', () => {
    const val = switchContrast.checked;
    prefs.high_contrast = val;
    document.documentElement.setAttribute('data-contrast', val ? 'high' : 'normal');
    void savePreference({ high_contrast: val });
  });

  switchMotion?.addEventListener('change', () => {
    const val = switchMotion.checked;
    prefs.reduce_motion = val;
    document.documentElement.setAttribute('data-reduce-motion', val ? 'true' : 'false');
    void savePreference({ reduce_motion: val });
  });

  switchAlerts?.addEventListener('change', () => {
    const val = switchAlerts.checked;
    prefs.extended_alerts = val;
    setToastPreferences({ extended_alerts: val });
    void savePreference({ extended_alerts: val });
  });

  try {
    const res = await getApi('/api/settings/preferences');
    if (res.ok && res.preferences) {
      prefs = {
        extended_alerts: Boolean(res.preferences.extended_alerts),
        high_contrast: Boolean(res.preferences.high_contrast),
        language: res.preferences.language || 'es',
        reduce_motion: Boolean(res.preferences.reduce_motion),
        theme: res.preferences.theme || 'light',
      };
      setToastPreferences({ extended_alerts: prefs.extended_alerts });
      updateUI();
    }
  } catch {}

  return container;
}

export {
  createSettingsAccessibilityView
};

export type {
  UserPreferences
};
