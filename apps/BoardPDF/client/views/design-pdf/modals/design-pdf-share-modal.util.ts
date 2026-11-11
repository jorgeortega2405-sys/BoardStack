import { showAuthGateModal } from '../../../components/auth-gate-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { currentUser, deleteApi, getApi, patchApi, postApi } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { showToast } from '../../../services/toast.service.js';
import { debounce, setupDropdown, withButtonLoading } from '../../../utils/dom.util.js';
import { applyAvatarTier } from '../../../utils/tier.util.js';
import { DocMember } from '../types/design-pdf.types.js';

interface CollabShareFindState {
  canReplace: boolean;
  hasMatches: boolean;
  matchCase: boolean;
  replaceTerm: string;
  searchTerm: string;
  statusText: string;
}

interface CollabShareFindOptions extends CollabShareFindState {
  onMatchCaseChange: (matchCase: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onReplaceAll: () => void;
  onReplaceOne: () => void;
  onReplaceTermChange: (term: string) => void;
  onSearchTermChange: (term: string) => void;
}

interface CollabShareModalOptions {
  activePageIndex: number;
  customSlug?: string | null;
  docAccessLevel: 'anyone_with_link' | 'restricted';
  docId: string;
  docMembers: DocMember[];
  docTitle: string;
  findReplace?: CollabShareFindOptions;
  getContent?: () => any;
  initialView?: 'customize-link' | 'download' | 'find-replace' | 'main';
  isDocOwner: boolean;
  isLocalOnly?: boolean;
  onAccessLevelChange: (level: 'anyone_with_link' | 'restricted') => void;
  onClose: () => void;
  onCustomSlugChange?: (slug: string) => void;
  onFindOpen?: () => void;
  onMembersChange: (members: DocMember[]) => void;
  pageCount: number;
  selectedPageIndex: number | null;
}

interface CollabSharePopoverHandle {
  cleanup: () => void;
  element: HTMLElement;
  getActiveView: () => 'customize-link' | 'download' | 'find-replace' | 'main';
  openView: (view: 'customize-link' | 'download' | 'find-replace' | 'main') => void;
  syncFindState: (state: CollabShareFindState) => void;
}

function createCollabSharePopover(options: CollabShareModalOptions): CollabSharePopoverHandle {
  const {
    activePageIndex,
    customSlug,
    docAccessLevel,
    docId,
    docTitle,
    findReplace,
    initialView = 'main',
    isDocOwner,
    onAccessLevelChange,
    onClose,
    onCustomSlugChange,
    onFindOpen,
    onMembersChange,
    pageCount,
    selectedPageIndex,
  } = options;

  let currentCustomSlug = customSlug || null;
  let currentMembers = [...options.docMembers];

  const popover = document.createElement('div');
  popover.className = 'tool-sidebar-container tool-sidebar-container--share collab-share-dropdown is-open';
  popover.setAttribute('data-ref', 'collab-share-popover');

  const canManagePermissions = isDocOwner && !!currentUser;
  const isLinkMode = docAccessLevel === 'anyone_with_link';
  const ownerName = currentUser?.username || 'Propietario';
  const ownerAvatar = currentUser?.avatar_url || (currentUser?.username ? `/api/avatar?name=${encodeURIComponent(currentUser.username)}&size=80` : null);
  const ownerInitials = ownerName.substring(0, 2).toUpperCase();

  popover.innerHTML = `
    <aside class="tool-layout__sidebar tool-layout__sidebar--absolute is-open collab-share-card" data-ref="collab-share-card">
      <div class="tool-sidebar__panel" data-ref="collab-share-view-main">
        <div class="tool-sidebar__header">
          <div class="component-title-badge" data-ref="collab-share-title-badge">
            <h1 class="component-title-badge__text" data-ref="collab-share-title">${t('collaborative.share_design_title')}</h1>
          </div>
          <button type="button" class="tool-sidebar__close-btn" data-ref="btn-share-close" data-i18n-aria="common.close" aria-label="Cerrar">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>

        <div class="tool-sidebar__body">
          <div class="tool-sidebar__section">
            <div class="tool-sidebar__section-title">Personas con acceso</div>
            ${canManagePermissions ? `
              <div class="component-search component-search--full" data-ref="share-search-user-box">
                <div class="component-search__icon">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
                </div>
                <div class="component-search__input-box">
                  <input class="component-search__input" data-ref="input-share-search-user" type="text" placeholder="${t('collaborative.add_people_placeholder')}" autocomplete="off" />
                </div>
              </div>
              <div class="collab-share-search-dropdown is-hidden" data-ref="collab-share-search-dropdown"></div>
            ` : ''}

            <div class="collab-share-members-row" data-ref="collab-share-members-row">
              <div class="collab-share-avatars-list" data-ref="collab-share-avatars-list"></div>
              ${canManagePermissions ? `
                <button type="button" class="collab-share-add-btn" data-ref="btn-focus-search-user" data-tooltip="Agregar personas" aria-label="Agregar personas">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                </button>
              ` : ''}
            </div>

            <div class="collab-share-members-list is-hidden" data-ref="collab-share-members-details"></div>
          </div>

          <div class="tool-sidebar__section">
            <div class="tool-sidebar__section-title">Nivel de acceso</div>
            <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-access">
              <button type="button" class="dropdown-trigger dropdown-trigger--full ${!canManagePermissions ? 'is-disabled' : ''}" data-ref="btn-access-trigger" aria-label="Nivel de acceso" ${!canManagePermissions ? 'disabled' : ''}>
                <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-access">
                  <svg class="component-icon dropdown-trigger__icon" data-ref="access-trigger-icon" aria-hidden="true"><use href="/icons.svg#${isLinkMode ? 'language' : 'groups'}"></use></svg>
                  <span class="dropdown-trigger__text" data-ref="access-trigger-label">${isLinkMode ? t('ui.cualquier_persona_que_tenga_el_enlace') : 'Solo las personas que agregues'}</span>
                </div>
                ${canManagePermissions ? `<svg class="component-icon dropdown-trigger__chevron" data-ref="icon-access-chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>` : ''}
              </button>

              ${canManagePermissions ? `
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-access">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="collab-access-menu">
                    <div class="menu-panel__list" data-ref="list-access-options">
                      <button type="button" class="menu-item ${!isLinkMode ? 'is-selected' : ''}" data-ref="option-access-restricted" data-access="restricted">
                        <div class="menu-item__icon-wrapper">
                          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#groups"></use></svg>
                        </div>
                        <div class="menu-item__text-group">
                          <span class="menu-item__title">Solo las personas que agregues</span>
                          <span class="menu-item__subtitle">Solo las personas con acceso al diseño pueden usar este enlace.</span>
                        </div>
                        <svg class="component-icon menu-item__check ${isLinkMode ? 'is-hidden' : ''}" data-ref="check-access-restricted" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                      </button>

                      <button type="button" class="menu-item ${isLinkMode ? 'is-selected' : ''}" data-ref="option-access-link" data-access="anyone_with_link">
                        <div class="menu-item__icon-wrapper">
                          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#language"></use></svg>
                        </div>
                        <div class="menu-item__text-group">
                          <span class="menu-item__title">Cualquier persona que tenga el enlace</span>
                          <span class="menu-item__subtitle">Cualquiera podrá acceder al diseño con el enlace.</span>
                        </div>
                        <svg class="component-icon menu-item__check ${!isLinkMode ? 'is-hidden' : ''}" data-ref="check-access-link" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="collab-share-actions">
            <button type="button" class="component-button component-button--black component-button--h44 component-button--w-full" data-ref="btn-collab-copy-link">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#link"></use></svg>
              <span data-ref="txt-copy-link">Copiar el enlace</span>
            </button>
            <button type="button" class="component-button component-button--ghost component-button--h44 component-button--w-full" data-ref="btn-collab-customize-link">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
              <span data-ref="txt-customize-link">${t('collaborative.customize_link')}</span>
            </button>
            <div class="banner banner--danger is-hidden" data-ref="collab-share-error"></div>
          </div>
        </div>

        <div class="tool-sidebar__footer">
          <button type="button" class="collab-share-download-btn" data-ref="btn-collab-download-pdf">
            <div class="collab-share-download-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </div>
            <span class="collab-share-download-text">${t('collaborative.download_menu')}</span>
          </button>
        </div>
      </div>

      <div class="tool-sidebar__panel is-hidden" data-ref="collab-share-view-download">
        <div class="tool-sidebar__header">
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h36" data-ref="btn-share-download-back" aria-label="${t('collaborative.back_to_share')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <div class="component-title-badge" data-ref="collab-download-title-badge">
            <h1 class="component-title-badge__text" data-ref="collab-download-title">${t('collaborative.download_menu')}</h1>
          </div>
          <button type="button" class="tool-sidebar__close-btn" data-ref="btn-share-download-close" data-i18n-aria="common.close" aria-label="${t('common.close')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>

        <div class="tool-sidebar__body">
          <div class="tool-sidebar__section">
            <div class="tool-sidebar__section-title">Tipo de archivo</div>
            <div class="component-tabs" data-ref="toggle-download-type" data-active="0">
              <button type="button" class="component-tab is-active active" data-ref="btn-download-type-digital" data-type="digital">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#devices"></use></svg>
                <span>Digital</span>
              </button>
              <button type="button" class="component-tab" data-ref="btn-download-type-print" data-type="print">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
                <span>Impresión</span>
              </button>
            </div>
          </div>

          <div class="tool-sidebar__section collab-download-digital-section" data-ref="section-digital-options">
            <div class="tool-sidebar__section-title">Opciones adicionales</div>
            <div class="collab-download-options-list">
              <label class="collab-download-checkbox-row" data-ref="lbl-compress-pdf">
                <input class="component-checkbox" data-ref="chk-compress-pdf" type="checkbox" />
                <div class="collab-download-checkbox-info">
                  <span class="collab-download-checkbox-title">Comprimir PDF</span>
                  <span class="collab-download-checkbox-desc">Menor tamaño de archivo para compartir fácil</span>
                </div>
              </label>
              <label class="collab-download-checkbox-row" data-ref="lbl-separate-pages">
                <input class="component-checkbox" data-ref="chk-separate-pages" type="checkbox" />
                <div class="collab-download-checkbox-info">
                  <span class="collab-download-checkbox-title">Descargar páginas como archivos separados</span>
                  <span class="collab-download-checkbox-desc">Genera un archivo independiente para cada página</span>
                </div>
              </label>
            </div>
          </div>

          <div class="tool-sidebar__section">
            <div class="tool-sidebar__section-title">Seleccionar páginas</div>
            <div class="component-tabs" data-ref="toggle-download-pages" data-active="0">
              <button type="button" class="component-tab is-active active" data-ref="btn-download-pages-all" data-mode="all">
                <span>Todas las páginas</span>
              </button>
              <button type="button" class="component-tab" data-ref="btn-download-pages-custom" data-mode="custom">
                <span>Personalizar</span>
              </button>
            </div>

            <div class="collab-download-custom-container is-hidden" data-ref="container-custom-pages">
              <div class="collab-download-custom-header">
                <span class="collab-download-custom-count" data-ref="txt-selected-pages-count">${pageCount} de ${pageCount} páginas seleccionadas</span>
                <button type="button" class="collab-download-toggle-all" data-ref="btn-toggle-all-pages">Deseleccionar todas</button>
              </div>
              <div class="collab-download-pages-grid" data-ref="grid-download-pages"></div>
            </div>
          </div>
        </div>

        <div class="tool-sidebar__footer">
          <button type="button" class="component-button component-button--black component-button--h44 component-button--w-full" data-ref="btn-confirm-download">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            <span>${t('collaborative.download_menu')}</span>
          </button>
          <div class="banner banner--danger is-hidden" data-ref="collab-download-error"></div>
        </div>
      </div>

      <div class="tool-sidebar__panel is-hidden" data-ref="collab-share-view-find-replace">
        <div class="tool-sidebar__header">
          <div class="component-title-badge" data-ref="collab-find-replace-title-badge">
            <h1 class="component-title-badge__text" data-ref="collab-find-replace-title">${t('collaborative.find_replace_title')}</h1>
          </div>
          <button type="button" class="tool-sidebar__close-btn" data-ref="btn-share-find-close" data-i18n-aria="common.close" aria-label="${t('common.close')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>

        <div class="tool-sidebar__body">
          <div class="tool-sidebar__section">
            <div class="tool-sidebar__section-title">${t('collaborative.find_label')}</div>
            <div class="collab-share-find-row">
              <div class="component-search component-search--full collab-share-search-box--find" data-ref="find-search-box">
                <div class="component-search__icon">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
                </div>
                <div class="component-search__input-box">
                  <input class="component-search__input" data-ref="input-find-search" type="text" placeholder="${t('collaborative.find_placeholder')}" autocomplete="off" />
                </div>
                <span class="collab-share-find-count is-hidden" data-ref="txt-find-status"></span>
              </div>
              <div class="collab-share-find-nav">
                <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h36 collab-share-find-nav-btn" data-ref="btn-find-prev" data-tooltip="${t('collaborative.find_prev')}" aria-label="${t('collaborative.find_prev')}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_left"></use></svg>
                </button>
                <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h36 collab-share-find-nav-btn" data-ref="btn-find-next" data-tooltip="${t('collaborative.find_next')}" aria-label="${t('collaborative.find_next')}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
                </button>
              </div>
            </div>
          </div>

          <div class="tool-sidebar__section">
            <div class="tool-sidebar__section-title">${t('collaborative.replace_label')}</div>
            <div class="component-search component-search--full" data-ref="find-replace-box">
              <div class="component-search__icon">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#find_replace"></use></svg>
              </div>
              <div class="component-search__input-box">
                <input class="component-search__input" data-ref="input-find-replace" type="text" placeholder="${t('collaborative.replace_placeholder')}" autocomplete="off" />
              </div>
            </div>
          </div>

          <div class="tool-sidebar__section">
            <label class="split-option-card" data-ref="card-find-match-case">
              <div class="split-option-card__content">
                <span class="split-option-card__title">${t('collaborative.match_case')}</span>
                <span class="split-option-card__subtitle">${t('collaborative.match_case_subtitle') || 'Diferenciar mayúsculas y minúsculas'}</span>
              </div>
              <input class="component-checkbox" data-ref="check-find-match-case" type="checkbox" />
            </label>
          </div>
        </div>

        <div class="tool-sidebar__footer">
          <div class="collab-share-find-actions">
            <button type="button" class="component-button component-button--secondary component-button--h44 collab-share-find-action-btn" data-ref="btn-find-replace-one">${t('collaborative.replace_one')}</button>
            <button type="button" class="component-button component-button--black component-button--h44 collab-share-find-action-btn" data-ref="btn-find-replace-all">${t('collaborative.replace_all')}</button>
          </div>
        </div>
      </div>

      <div class="tool-sidebar__panel is-hidden" data-ref="collab-share-view-customize-link">
        <div class="tool-sidebar__header">
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h36" data-ref="btn-share-custom-link-back" aria-label="${t('collaborative.back_to_share')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <div class="component-title-badge" data-ref="collab-custom-link-title-badge">
            <h1 class="component-title-badge__text" data-ref="collab-custom-link-title">${t('collaborative.custom_link_title')}</h1>
          </div>
          <button type="button" class="tool-sidebar__close-btn" data-ref="btn-share-custom-link-close" data-i18n-aria="common.close" aria-label="${t('common.close')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>

        <div class="tool-sidebar__body">
          <div class="tool-sidebar__section">
            <div class="tool-sidebar__section-title">${t('collaborative.custom_link_section_title')}</div>
            <p class="tool-sidebar__desc">${t('collaborative.custom_link_desc')}</p>

            <div class="collab-custom-url-field" data-ref="collab-custom-url-field">
              <span class="collab-custom-url-prefix" data-ref="txt-custom-url-prefix">${window.location.host}/l/</span>
              <input class="collab-custom-url-input" data-ref="input-custom-slug" type="text" placeholder="${t('collaborative.custom_link_placeholder')}" autocomplete="off" />
            </div>

            <div class="collab-custom-link-preview is-hidden" data-ref="box-custom-link-active">
              <div class="tool-sidebar__section-title">${t('collaborative.active_custom_link')}</div>
              <div class="collab-custom-link-display">
                <span class="collab-custom-link-text" data-ref="txt-active-custom-link"></span>
                <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32" data-ref="btn-copy-active-custom-link" data-tooltip="${t('collaborative.copy_link')}" aria-label="${t('collaborative.copy_link')}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="tool-sidebar__footer">
          <button type="button" class="component-button component-button--black component-button--h44 component-button--w-full" data-ref="btn-request-custom-link">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#link"></use></svg>
            <span>${t('collaborative.request_custom_link')}</span>
          </button>
          <div class="banner banner--danger is-hidden" data-ref="collab-custom-link-error"></div>
        </div>
      </div>
    </aside>
  `;

  document.body.appendChild(popover);
  renderIcons(popover);

  const accessDropdown = popover.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-access"]');
  let dropdownCtrl: { close: () => void; destroy: () => void } | null = null;
  if (accessDropdown && canManagePermissions) {
    dropdownCtrl = setupDropdown(accessDropdown, {
      backdrop: accessDropdown.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-access"]'),
      menu: accessDropdown.querySelector<HTMLElement>('[data-ref="collab-access-menu"]'),
    });
  }

  const btnShareClose = popover.querySelector<HTMLButtonElement>('[data-ref="btn-share-close"]');
  const btnShareDownloadClose = popover.querySelector<HTMLButtonElement>('[data-ref="btn-share-download-close"]');
  const btnShareFindClose = popover.querySelector<HTMLButtonElement>('[data-ref="btn-share-find-close"]');

  btnShareClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover();
  });
  btnShareDownloadClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover();
  });
  btnShareFindClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover();
  });

  const closePopover = () => {
    dropdownCtrl?.destroy();
    cleanup();
    onClose();
  };

  const onOutsidePointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (
      popover &&
      !popover.contains(target) &&
      !target.closest('[data-ref="btn-share-link"]') &&
      !target.closest('[data-ref="btn-menu-file-search"]') &&
      !target.closest('[data-ref="btn-menu-file-download"]')
    ) {
      closePopover();
    }
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', onOutsidePointerDown);
  }, 10);

  const onEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePopover();
    }
  };
  document.addEventListener('keydown', onEscapeKey);

  const cleanup = () => {
    dropdownCtrl?.destroy();
    document.removeEventListener('pointerdown', onOutsidePointerDown);
    document.removeEventListener('keydown', onEscapeKey);
    popover.remove();
  };

  const btnFocusSearch = popover.querySelector<HTMLButtonElement>('[data-ref="btn-focus-search-user"]');
  const searchInput = popover.querySelector<HTMLInputElement>('[data-ref="input-share-search-user"]');
  const searchDropdown = popover.querySelector<HTMLElement>('[data-ref="collab-share-search-dropdown"]');
  const detailsList = popover.querySelector<HTMLElement>('[data-ref="collab-share-members-details"]');

  btnFocusSearch?.addEventListener('click', () => {
    searchInput?.focus();
    if (detailsList) {
      detailsList.classList.toggle('is-hidden');
    }
  });

  const renderAvatars = () => {
    const avatarsList = popover.querySelector<HTMLElement>('[data-ref="collab-share-avatars-list"]');
    if (!avatarsList) return;
    avatarsList.innerHTML = '';

    const ownerBubble = document.createElement('div');
    ownerBubble.className = 'collab-avatar-bubble';
    ownerBubble.setAttribute('data-tooltip', `${ownerName} (Propietario)`);
    ownerBubble.setAttribute('aria-label', `${ownerName} (Propietario)`);
    applyAvatarTier(ownerBubble, currentUser?.subscription_tier || 'free');
    if (ownerAvatar) {
      ownerBubble.innerHTML = `<img src="${ownerAvatar}" alt="${ownerName}" />`;
    } else {
      ownerBubble.textContent = ownerInitials;
    }
    avatarsList.appendChild(ownerBubble);

    for (const m of currentMembers) {
      const bubble = document.createElement('div');
      bubble.className = 'collab-avatar-bubble';
      bubble.setAttribute('data-tooltip', `${m.username} (${m.role === 'editor' ? 'Editor' : 'Lector'})`);
      bubble.setAttribute('aria-label', `${m.username} (${m.role === 'editor' ? 'Editor' : 'Lector'})`);
      applyAvatarTier(bubble, m.subscription_tier || (m as any).tier || 'free');
      const memberAvatar = m.avatar_url || (m.username ? `/api/avatar?name=${encodeURIComponent(m.username)}&size=80` : null);
      if (memberAvatar) {
        bubble.innerHTML = `<img src="${memberAvatar}" alt="${m.username}" />`;
      } else {
        bubble.textContent = m.username.substring(0, 2).toUpperCase();
      }
      avatarsList.appendChild(bubble);

      if (detailsList) {
        const row = document.createElement('div');
        row.className = 'collab-share-member-row';
        row.innerHTML = `
          <div class="collab-avatar-bubble collab-avatar-bubble--sm" data-ref="member-avatar">
            ${memberAvatar ? `<img src="${memberAvatar}" alt="${m.username}" />` : m.username.substring(0, 2).toUpperCase()}
          </div>
          <div class="collab-share-member-info">
            <span class="collab-share-member-name">${m.username}</span>
            <span class="collab-share-member-badge">${m.email || 'Miembro'} • ${m.role === 'editor' ? 'Editor' : 'Lector'}</span>
          </div>
          ${canManagePermissions ? `
          <button type="button" class="collab-share-remove-btn" data-user-id="${m.user_id}" data-tooltip="Remover acceso" aria-label="Remover acceso a ${m.username}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
          ` : ''}
        `;
        const memberAvatarEl = row.querySelector<HTMLElement>('[data-ref="member-avatar"]');
        applyAvatarTier(memberAvatarEl, m.subscription_tier || (m as any).tier || 'free');
        const removeBtn = row.querySelector<HTMLButtonElement>('.collab-share-remove-btn');
        removeBtn?.addEventListener('click', async () => {
          const res = await deleteApi(API_ROUTES.collaborativeDocs.memberDelete(docId, m.user_id));
          if (res.ok) {
            currentMembers = currentMembers.filter((item) => item.user_id !== m.user_id);
            onMembersChange(currentMembers);
            renderAvatars();
            showToast(t('toasts.colaborador_eliminado'), 'info');
          }
        });
        detailsList.appendChild(row);
      }
    }
    renderIcons(popover);
  };

  renderAvatars();

  const doSearch = debounce(async (q: string) => {
    if (!searchDropdown) return;
    if (!q.trim()) {
      searchDropdown.classList.add('is-hidden');
      searchDropdown.innerHTML = '';
      return;
    }
    try {
      const res = await getApi(API_ROUTES.collaborativeDocs.searchUsers(q, docId));
      if (res.ok) {
        const data = await res.json();
        const users: Array<{ avatar_url?: string | null; email: string; id: number; username: string }> = data.users || [];
        if (users.length === 0) {
          searchDropdown.innerHTML = `<div class="collab-share-search-empty">${t('collaborative.share_no_users_found')}</div>`;
          searchDropdown.classList.remove('is-hidden');
        } else {
          searchDropdown.innerHTML = '';
          for (const u of users) {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'collab-share-user-item';
            item.innerHTML = `
              <div class="collab-share-user-item__info">
                <span class="collab-share-user-item__name">${u.username}</span>
                <span class="collab-share-user-item__email">${u.email}</span>
              </div>
              <span class="component-button component-button--h30 component-button--black collab-share-user-add-badge">${t('collaborative.share_add_user_btn')}</span>
            `;
            item.addEventListener('click', async () => {
              const addRes = await postApi(API_ROUTES.collaborativeDocs.members(docId), { role: 'editor', userId: u.id });
              if (addRes.ok) {
                const addData = await addRes.json();
                if (addData.member) {
                  currentMembers.push(addData.member);
                  onMembersChange(currentMembers);
                }
                renderAvatars();
                searchDropdown.classList.add('is-hidden');
                if (searchInput) searchInput.value = '';
                showToast(t('toasts.agregado_como_editor'), 'info');
              }
            });
            searchDropdown.appendChild(item);
          }
          searchDropdown.classList.remove('is-hidden');
        }
      }
    } catch {}
  }, 250);

  searchInput?.addEventListener('input', () => {
    void doSearch(searchInput.value);
  });

  const optRestricted = popover.querySelector<HTMLButtonElement>('[data-ref="option-access-restricted"]');
  const optLink = popover.querySelector<HTMLButtonElement>('[data-ref="option-access-link"]');
  const triggerLabel = popover.querySelector<HTMLElement>('[data-ref="access-trigger-label"]');
  const triggerIcon = popover.querySelector<HTMLElement>('[data-ref="access-trigger-icon"]');
  const checkRestricted = popover.querySelector<HTMLElement>('[data-ref="check-access-restricted"]');
  const checkLink = popover.querySelector<HTMLElement>('[data-ref="check-access-link"]');

  if (canManagePermissions) {
    const selectAccess = async (level: 'anyone_with_link' | 'restricted') => {
      onAccessLevelChange(level);
      dropdownCtrl?.close();

      const isL = level === 'anyone_with_link';
      if (triggerLabel) triggerLabel.textContent = isL ? t('ui.cualquier_persona_que_tenga_el_enlace') : 'Solo las personas que agregues';
      if (triggerIcon) triggerIcon.innerHTML = `<svg class="component-icon dropdown-trigger__icon" data-ref="access-trigger-icon" aria-hidden="true"><use href="/icons.svg#${isL ? 'language' : 'groups'}"></use></svg>`;

      optRestricted?.classList.toggle('is-selected', !isL);
      optLink?.classList.toggle('is-selected', isL);
      checkRestricted?.classList.toggle('is-hidden', isL);
      checkLink?.classList.toggle('is-hidden', !isL);
      renderIcons(popover);

      try {
        await patchApi(API_ROUTES.collaborativeDocs.accessLevel(docId), { accessLevel: level });
        showToast(t('toasts.nivel_de_acceso_actualizado'), 'info');
      } catch {}
    };

    optRestricted?.addEventListener('click', () => void selectAccess('restricted'));
    optLink?.addEventListener('click', () => void selectAccess('anyone_with_link'));
  }

  const copyBtn = popover.querySelector<HTMLButtonElement>('[data-ref="btn-collab-copy-link"]');
  const copyTxt = popover.querySelector<HTMLElement>('[data-ref="txt-copy-link"]');
  copyBtn?.addEventListener('click', () => {
    if (options.isLocalOnly) {
      showAuthGateModal({ featureKey: 'collaborative_share', returnUrl: window.location.pathname });
      return;
    }
    const url = `${window.location.origin}/d/${encodeURIComponent(docId)}`;
    void navigator.clipboard.writeText(url).then(() => {
      if (copyTxt) copyTxt.textContent = t('common.copied');
      showToast(t('toasts.enlace_de_colaboracion_copiado_al_portap'), 'info');
      setTimeout(() => {
        if (copyTxt) copyTxt.textContent = t('collaborative.copy_link');
      }, 2000);
    });
  });

  const viewMain = popover.querySelector<HTMLElement>('[data-ref="collab-share-view-main"]');
  const viewDownload = popover.querySelector<HTMLElement>('[data-ref="collab-share-view-download"]');
  const viewFindReplace = popover.querySelector<HTMLElement>('[data-ref="collab-share-view-find-replace"]');
  const viewCustomizeLink = popover.querySelector<HTMLElement>('[data-ref="collab-share-view-customize-link"]');
  const btnCustomizeLink = popover.querySelector<HTMLButtonElement>('[data-ref="btn-collab-customize-link"]');
  const btnShareCustomLinkBack = popover.querySelector<HTMLButtonElement>('[data-ref="btn-share-custom-link-back"]');
  const btnShareCustomLinkClose = popover.querySelector<HTMLButtonElement>('[data-ref="btn-share-custom-link-close"]');
  const inputCustomSlug = popover.querySelector<HTMLInputElement>('[data-ref="input-custom-slug"]');
  const boxCustomLinkActive = popover.querySelector<HTMLElement>('[data-ref="box-custom-link-active"]');
  const txtActiveCustomLink = popover.querySelector<HTMLElement>('[data-ref="txt-active-custom-link"]');
  const btnCopyActiveCustomLink = popover.querySelector<HTMLButtonElement>('[data-ref="btn-copy-active-custom-link"]');
  const btnRequestCustomLink = popover.querySelector<HTMLButtonElement>('[data-ref="btn-request-custom-link"]');
  const collabCustomLinkError = popover.querySelector<HTMLElement>('[data-ref="collab-custom-link-error"]');
  const findOpenBtn = popover.querySelector<HTMLButtonElement>('[data-ref="btn-collab-open-find-replace"]');
  const downloadBtn = popover.querySelector<HTMLButtonElement>('[data-ref="btn-collab-download-pdf"]');
  const btnShareDownloadBack = popover.querySelector<HTMLButtonElement>('[data-ref="btn-share-download-back"]');
  const btnShareFindBack = popover.querySelector<HTMLButtonElement>('[data-ref="btn-share-find-back"]');
  const inputFindSearch = popover.querySelector<HTMLInputElement>('[data-ref="input-find-search"]');
  const inputFindReplace = popover.querySelector<HTMLInputElement>('[data-ref="input-find-replace"]');
  const checkFindMatchCase = popover.querySelector<HTMLInputElement>('[data-ref="check-find-match-case"]');
  const txtFindStatus = popover.querySelector<HTMLElement>('[data-ref="txt-find-status"]');
  const btnFindPrev = popover.querySelector<HTMLButtonElement>('[data-ref="btn-find-prev"]');
  const btnFindNext = popover.querySelector<HTMLButtonElement>('[data-ref="btn-find-next"]');
  const btnFindReplaceOne = popover.querySelector<HTMLButtonElement>('[data-ref="btn-find-replace-one"]');
  const btnFindReplaceAll = popover.querySelector<HTMLButtonElement>('[data-ref="btn-find-replace-all"]');
  const toggleDownloadType = popover.querySelector<HTMLElement>('[data-ref="toggle-download-type"]');
  const btnTypeDigital = popover.querySelector<HTMLButtonElement>('[data-ref="btn-download-type-digital"]');
  const btnTypePrint = popover.querySelector<HTMLButtonElement>('[data-ref="btn-download-type-print"]');
  const sectionDigitalOptions = popover.querySelector<HTMLElement>('[data-ref="section-digital-options"]');
  const toggleDownloadPages = popover.querySelector<HTMLElement>('[data-ref="toggle-download-pages"]');
  const btnPagesAll = popover.querySelector<HTMLButtonElement>('[data-ref="btn-download-pages-all"]');
  const btnPagesCustom = popover.querySelector<HTMLButtonElement>('[data-ref="btn-download-pages-custom"]');
  const containerCustomPages = popover.querySelector<HTMLElement>('[data-ref="container-custom-pages"]');
  const gridDownloadPages = popover.querySelector<HTMLElement>('[data-ref="grid-download-pages"]');
  const txtSelectedPagesCount = popover.querySelector<HTMLElement>('[data-ref="txt-selected-pages-count"]');
  const btnToggleAllPages = popover.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-all-pages"]');
  const downloadError = popover.querySelector<HTMLElement>('[data-ref="collab-download-error"]');
  const btnConfirmDownload = popover.querySelector<HTMLButtonElement>('[data-ref="btn-confirm-download"]');

  let activeView: 'customize-link' | 'download' | 'find-replace' | 'main' = initialView;

  const updateActiveSlugDisplay = () => {
    if (!boxCustomLinkActive || !txtActiveCustomLink) return;
    if (currentCustomSlug) {
      boxCustomLinkActive.classList.remove('is-hidden');
      txtActiveCustomLink.textContent = `${window.location.host}/l/${currentCustomSlug}`;
      if (inputCustomSlug) {
        inputCustomSlug.value = currentCustomSlug;
      }
    } else {
      boxCustomLinkActive.classList.add('is-hidden');
      txtActiveCustomLink.textContent = '';
    }
  };

  const syncFindState = (state: CollabShareFindState) => {
    if (inputFindSearch && inputFindSearch.value !== state.searchTerm) {
      inputFindSearch.value = state.searchTerm;
    }
    if (inputFindReplace && inputFindReplace.value !== state.replaceTerm) {
      inputFindReplace.value = state.replaceTerm;
    }
    if (checkFindMatchCase && checkFindMatchCase.checked !== state.matchCase) {
      checkFindMatchCase.checked = state.matchCase;
    }
    if (txtFindStatus) {
      txtFindStatus.textContent = state.statusText;
      txtFindStatus.classList.toggle('is-hidden', !state.statusText);
    }
    if (btnFindPrev) {
      btnFindPrev.disabled = !state.hasMatches;
    }
    if (btnFindNext) {
      btnFindNext.disabled = !state.hasMatches;
    }
    if (btnFindReplaceOne) {
      btnFindReplaceOne.disabled = !state.hasMatches || !state.canReplace;
    }
    if (btnFindReplaceAll) {
      btnFindReplaceAll.disabled = !state.hasMatches || !state.canReplace;
    }
  };

  if (findReplace) {
    syncFindState(findReplace);
  }

  const openView = (view: 'customize-link' | 'download' | 'find-replace' | 'main') => {
    activeView = view;
    viewMain?.classList.toggle('is-hidden', view !== 'main');
    viewDownload?.classList.toggle('is-hidden', view !== 'download');
    viewFindReplace?.classList.toggle('is-hidden', view !== 'find-replace');
    viewCustomizeLink?.classList.toggle('is-hidden', view !== 'customize-link');
    if (view === 'find-replace') {
      onFindOpen?.();
      requestAnimationFrame(() => {
        inputFindSearch?.focus();
        inputFindSearch?.select();
      });
    } else if (view === 'customize-link') {
      updateActiveSlugDisplay();
      if (collabCustomLinkError) {
        collabCustomLinkError.classList.add('is-hidden');
        collabCustomLinkError.textContent = '';
      }
      requestAnimationFrame(() => {
        inputCustomSlug?.focus();
        inputCustomSlug?.select();
      });
    }
  };

  if (initialView !== 'main') {
    openView(initialView);
  }

  findOpenBtn?.addEventListener('click', () => {
    openView('find-replace');
  });

  downloadBtn?.addEventListener('click', () => {
    openView('download');
  });

  btnCustomizeLink?.addEventListener('click', () => {
    if (options.isLocalOnly) {
      showAuthGateModal({ featureKey: 'collaborative_share', returnUrl: window.location.pathname });
      return;
    }
    openView('customize-link');
  });

  btnShareDownloadBack?.addEventListener('click', () => {
    openView('main');
  });

  btnShareFindBack?.addEventListener('click', () => {
    openView('main');
  });

  btnShareCustomLinkBack?.addEventListener('click', () => {
    openView('main');
  });

  btnShareCustomLinkClose?.addEventListener('click', () => {
    closePopover();
  });

  btnCopyActiveCustomLink?.addEventListener('click', () => {
    if (!currentCustomSlug) return;
    const url = `${window.location.origin}/l/${currentCustomSlug}`;
    void navigator.clipboard.writeText(url).then(() => {
      showToast(t('toasts.enlace_copiado_al_portapapeles'), 'info');
    });
  });

  btnRequestCustomLink?.addEventListener('click', async () => {
    if (!inputCustomSlug || !btnRequestCustomLink) return;
    const rawVal = inputCustomSlug.value.trim().toLowerCase();
    const cleanSlug = rawVal.replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
    inputCustomSlug.value = cleanSlug;

    if (!cleanSlug || cleanSlug.length < 3 || cleanSlug.length > 60) {
      if (collabCustomLinkError) {
        collabCustomLinkError.textContent = t('collaborative.custom_link_invalid');
        collabCustomLinkError.classList.remove('is-hidden');
      }
      return;
    }

    if (collabCustomLinkError) {
      collabCustomLinkError.classList.add('is-hidden');
      collabCustomLinkError.textContent = '';
    }

    await withButtonLoading(btnRequestCustomLink, async () => {
      try {
        const res = await patchApi(
          API_ROUTES.collaborativeDocs.customSlug(docId),
          { slug: cleanSlug },
        );

        if (res && res.ok) {
          const json = (await res.json()) as { custom_slug?: string };
          const updatedSlug = json.custom_slug || cleanSlug;
          currentCustomSlug = updatedSlug;
          onCustomSlugChange?.(updatedSlug);
          updateActiveSlugDisplay();
          showToast(t('collaborative.custom_link_success'), 'success');
        } else {
          if (collabCustomLinkError) {
            collabCustomLinkError.textContent = t('collaborative.custom_link_already_used');
            collabCustomLinkError.classList.remove('is-hidden');
          }
        }
      } catch {
        if (collabCustomLinkError) {
          collabCustomLinkError.textContent = t('collaborative.custom_link_error');
          collabCustomLinkError.classList.remove('is-hidden');
        }
      }
    });
  });

  inputCustomSlug?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnRequestCustomLink?.click();
    }
  });

  inputFindSearch?.addEventListener('input', () => {
    findReplace?.onSearchTermChange(inputFindSearch.value);
  });

  inputFindSearch?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        findReplace?.onPrev();
      } else {
        findReplace?.onNext();
      }
    }
  });

  inputFindReplace?.addEventListener('input', () => {
    findReplace?.onReplaceTermChange(inputFindReplace.value);
  });

  inputFindReplace?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findReplace?.onReplaceOne();
    }
  });

  checkFindMatchCase?.addEventListener('change', () => {
    findReplace?.onMatchCaseChange(checkFindMatchCase.checked);
  });

  btnFindPrev?.addEventListener('click', () => {
    findReplace?.onPrev();
  });

  btnFindNext?.addEventListener('click', () => {
    findReplace?.onNext();
  });

  btnFindReplaceOne?.addEventListener('click', () => {
    findReplace?.onReplaceOne();
  });

  btnFindReplaceAll?.addEventListener('click', () => {
    findReplace?.onReplaceAll();
  });

  let currentDownloadType: 'digital' | 'print' = 'digital';
  btnTypeDigital?.addEventListener('click', () => {
    currentDownloadType = 'digital';
    toggleDownloadType?.setAttribute('data-active', '0');
    btnTypeDigital.classList.add('is-active', 'active');
    btnTypePrint?.classList.remove('is-active', 'active');
    sectionDigitalOptions?.classList.remove('is-hidden');
  });

  btnTypePrint?.addEventListener('click', () => {
    currentDownloadType = 'print';
    toggleDownloadType?.setAttribute('data-active', '1');
    btnTypePrint.classList.add('is-active', 'active');
    btnTypeDigital?.classList.remove('is-active', 'active');
    sectionDigitalOptions?.classList.add('is-hidden');
  });

  let currentPagesMode: 'all' | 'custom' = 'all';
  const selectedPages = new Set<number>();
  for (let p = 1; p <= pageCount; p++) {
    selectedPages.add(p);
  }

  const updatePagesSelectionUi = () => {
    if (txtSelectedPagesCount) {
      txtSelectedPagesCount.textContent = `${selectedPages.size} de ${pageCount} páginas seleccionadas`;
    }
    if (btnToggleAllPages) {
      btnToggleAllPages.textContent = selectedPages.size === pageCount ? 'Deseleccionar todas' : 'Seleccionar todas';
    }
    const cards = gridDownloadPages?.querySelectorAll<HTMLElement>('.collab-download-page-card');
    cards?.forEach((card) => {
      const pageNum = parseInt(card.getAttribute('data-page') || '0', 10);
      card.classList.toggle('is-selected', selectedPages.has(pageNum));
    });
  };

  if (gridDownloadPages) {
    gridDownloadPages.innerHTML = '';
    for (let p = 1; p <= pageCount; p++) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'collab-download-page-card is-selected';
      card.setAttribute('data-ref', `card-page-${p}`);
      card.setAttribute('data-page', p.toString());
      card.innerHTML = `
        <div class="collab-download-page-card__preview">
          <span class="collab-download-page-card__num">${p}</span>
          <div class="collab-download-page-card__checkbox">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
          </div>
        </div>
        <span class="collab-download-page-card__label">Pág. ${p}</span>
      `;
      card.addEventListener('click', () => {
        if (selectedPages.has(p)) {
          selectedPages.delete(p);
        } else {
          selectedPages.add(p);
        }
        updatePagesSelectionUi();
      });
      gridDownloadPages.appendChild(card);
    }
  }

  btnToggleAllPages?.addEventListener('click', () => {
    if (selectedPages.size === pageCount) {
      selectedPages.clear();
    } else {
      for (let p = 1; p <= pageCount; p++) {
        selectedPages.add(p);
      }
    }
    updatePagesSelectionUi();
  });

  btnPagesAll?.addEventListener('click', () => {
    currentPagesMode = 'all';
    toggleDownloadPages?.setAttribute('data-active', '0');
    btnPagesAll.classList.add('is-active', 'active');
    btnPagesCustom?.classList.remove('is-active', 'active');
    containerCustomPages?.classList.add('is-hidden');
  });

  btnPagesCustom?.addEventListener('click', () => {
    currentPagesMode = 'custom';
    toggleDownloadPages?.setAttribute('data-active', '1');
    btnPagesCustom.classList.add('is-active', 'active');
    btnPagesAll?.classList.remove('is-active', 'active');
    containerCustomPages?.classList.remove('is-hidden');
  });

  btnConfirmDownload?.addEventListener('click', async () => {
    if (currentPagesMode === 'custom' && selectedPages.size === 0) {
      if (downloadError) {
        downloadError.textContent = t('ui.por_favor_selecciona_al_menos_una_pagina');
        downloadError.classList.remove('is-hidden');
      }
      return;
    }
    if (downloadError) {
      downloadError.classList.add('is-hidden');
    }

    const pagesVal = currentPagesMode === 'custom' ? Array.from(selectedPages).sort((a, b) => a - b).join(',') : undefined;

    if (options.isLocalOnly && options.getContent) {
      try {
        const payload = {
          content: options.getContent(),
          pages: pagesVal,
          title: docTitle || 'document',
          type: currentDownloadType,
        };
        const res = await postApi(API_ROUTES.collaborativeDocs.renderPdf, payload);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${docTitle || 'document'}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          closePopover();
          showToast(t('toasts.descarga_iniciada'), 'info');
          return;
        }
      } catch {}
    }

    let downloadUrl = API_ROUTES.collaborativeDocs.pdf(docId);
    const queryParams = new URLSearchParams();
    if (pagesVal) {
      queryParams.set('pages', pagesVal);
    }
    if (currentDownloadType === 'print') {
      queryParams.set('type', 'print');
    }
    const queryString = queryParams.toString();
    if (queryString) {
      downloadUrl += `?${queryString}`;
    }

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${docTitle || 'document'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    closePopover();
    showToast(t('toasts.descarga_iniciada'), 'info');
  });

  return {
    cleanup,
    element: popover,
    getActiveView: () => activeView,
    openView,
    syncFindState,
  };
}

export { createCollabSharePopover };
export type { CollabShareFindOptions, CollabShareFindState, CollabShareModalOptions, CollabSharePopoverHandle };
