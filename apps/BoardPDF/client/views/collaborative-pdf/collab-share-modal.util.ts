import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, deleteApi, getApi, patchApi, postApi } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { debounce, setupDropdown } from '../../utils/dom.util.js';
import { DocMember } from './collaborative-pdf.types.js';

export interface CollabShareModalOptions {
  activePageIndex: number;
  docAccessLevel: 'anyone_with_link' | 'restricted';
  docId: string;
  docMembers: DocMember[];
  docTitle: string;
  isDocOwner: boolean;
  onAccessLevelChange: (level: 'anyone_with_link' | 'restricted') => void;
  onClose: () => void;
  onMembersChange: (members: DocMember[]) => void;
  openInDownloadView?: boolean;
  pageCount: number;
  selectedPageIndex: number | null;
}

export interface CollabSharePopoverHandle {
  cleanup: () => void;
  element: HTMLElement;
  openDownloadView: () => void;
}

export function createCollabSharePopover(options: CollabShareModalOptions): CollabSharePopoverHandle {
  const {
    activePageIndex,
    docAccessLevel,
    docId,
    docTitle,
    isDocOwner,
    onAccessLevelChange,
    onClose,
    onMembersChange,
    openInDownloadView = false,
    pageCount,
    selectedPageIndex,
  } = options;

  let currentMembers = [...options.docMembers];

  const popover = document.createElement('div');
  popover.className = 'menu-panel menu-panel--dropdown menu-panel--w-440 menu-panel--h-auto collab-share-dropdown';
  popover.setAttribute('data-ref', 'collab-share-popover');

  const canManagePermissions = isDocOwner && !!currentUser;
  const isLinkMode = docAccessLevel === 'anyone_with_link';
  const ownerName = currentUser?.username || 'Propietario';
  const ownerAvatar = currentUser?.avatar_url || (currentUser?.username ? `/api/avatar?name=${encodeURIComponent(currentUser.username)}&size=80` : null);
  const ownerInitials = ownerName.substring(0, 2).toUpperCase();

  popover.innerHTML = `
    <div class="collab-share-card" data-ref="collab-share-card">
      <div class="collab-share-view" data-ref="collab-share-view-main">
        <div class="collab-share-header">
          <h2 class="collab-share-title">Compartir el diseño</h2>
        </div>

        <div class="collab-share-section">
          <div class="collab-share-section__title">Personas con acceso</div>
          ${canManagePermissions ? `
            <div class="collab-share-search-box">
              <svg class="component-icon collab-share-search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
              <input class="collab-share-search-input" data-ref="input-share-search-user" type="text" placeholder="Agregar personas" autocomplete="off" />
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

        <div class="collab-share-section">
          <div class="collab-share-section__title">Nivel de acceso</div>
          <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-access">
            <button type="button" class="dropdown-trigger dropdown-trigger--full ${!canManagePermissions ? 'is-disabled' : ''}" data-ref="btn-access-trigger" aria-label="Nivel de acceso" ${!canManagePermissions ? 'disabled' : ''}>
              <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-access">
                <svg class="component-icon dropdown-trigger__icon" data-ref="access-trigger-icon" aria-hidden="true"><use href="/icons.svg#${isLinkMode ? 'language' : 'groups'}"></use></svg>
                <span class="dropdown-trigger__text" data-ref="access-trigger-label">${isLinkMode ? 'Cualquier persona que tenga el enlace' : 'Solo las personas que agregues'}</span>
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
          <div class="banner banner--danger is-hidden" data-ref="collab-share-error"></div>
        </div>

        <div class="collab-share-divider"></div>

        <div class="collab-share-footer">
          <button type="button" class="collab-share-download-btn" data-ref="btn-collab-download-pdf">
            <div class="collab-share-download-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </div>
            <span class="collab-share-download-text">Descargar</span>
          </button>
        </div>
      </div>

      <div class="collab-share-view is-hidden" data-ref="collab-share-view-download">
        <div class="collab-share-header">
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h36" data-ref="btn-share-download-back" aria-label="Volver al menú compartir">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <h2 class="collab-share-title">Descargar</h2>
          <div class="collab-share-header__spacer"></div>
        </div>

        <div class="collab-share-section">
          <div class="collab-share-section__title">Tipo de archivo</div>
          <div class="component-toggle-pill component-toggle-pill--w-full" data-ref="toggle-download-type" data-active="0">
            <div class="component-toggle-pill-glider"></div>
            <button type="button" class="component-button component-button--rounded-pill active" data-ref="btn-download-type-digital" data-type="digital">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#devices"></use></svg>
              <span>Digital</span>
            </button>
            <button type="button" class="component-button component-button--rounded-pill" data-ref="btn-download-type-print" data-type="print">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
              <span>Impresión</span>
            </button>
          </div>
        </div>

        <div class="collab-share-section collab-download-digital-section" data-ref="section-digital-options">
          <div class="collab-share-section__title">Opciones adicionales</div>
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

        <div class="collab-share-section">
          <div class="collab-share-section__title">Seleccionar páginas</div>
          <div class="component-toggle-pill component-toggle-pill--w-full" data-ref="toggle-download-pages" data-active="0">
            <div class="component-toggle-pill-glider"></div>
            <button type="button" class="component-button component-button--rounded-pill active" data-ref="btn-download-pages-all" data-mode="all">
              <span>Todas las páginas</span>
            </button>
            <button type="button" class="component-button component-button--rounded-pill" data-ref="btn-download-pages-custom" data-mode="custom">
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

        <div class="collab-share-actions">
          <button type="button" class="component-button component-button--black component-button--h44 component-button--w-full" data-ref="btn-confirm-download">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            <span>Descargar</span>
          </button>
          <div class="banner banner--danger is-hidden" data-ref="collab-download-error"></div>
        </div>
      </div>
    </div>
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

  const closePopover = () => {
    dropdownCtrl?.destroy();
    cleanup();
    onClose();
  };

  const onOutsidePointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (popover && !popover.contains(target) && !target.closest('[data-ref="btn-share-link"]')) {
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
        const removeBtn = row.querySelector<HTMLButtonElement>('.collab-share-remove-btn');
        removeBtn?.addEventListener('click', async () => {
          const res = await deleteApi(API_ROUTES.collaborativeDocs.memberDelete(docId, m.user_id));
          if (res.ok) {
            currentMembers = currentMembers.filter((item) => item.user_id !== m.user_id);
            onMembersChange(currentMembers);
            renderAvatars();
            showToast('Colaborador eliminado', 'info');
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
          searchDropdown.innerHTML = `<div style="padding: 10px; font-size: 13px; color: var(--text-muted); text-align: center;">No se encontraron usuarios</div>`;
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
              <span class="component-button component-button--h30 component-button--black" style="font-size: 12px; padding: 0 10px;">Agregar</span>
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
                showToast(`${u.username} agregado como editor`, 'info');
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
      if (triggerLabel) triggerLabel.textContent = isL ? 'Cualquier persona que tenga el enlace' : 'Solo las personas que agregues';
      if (triggerIcon) triggerIcon.innerHTML = `<svg class="component-icon dropdown-trigger__icon" data-ref="access-trigger-icon" aria-hidden="true"><use href="/icons.svg#${isL ? 'language' : 'groups'}"></use></svg>`;

      optRestricted?.classList.toggle('is-selected', !isL);
      optLink?.classList.toggle('is-selected', isL);
      checkRestricted?.classList.toggle('is-hidden', isL);
      checkLink?.classList.toggle('is-hidden', !isL);
      renderIcons(popover);

      try {
        await patchApi(API_ROUTES.collaborativeDocs.accessLevel(docId), { accessLevel: level });
        showToast('Nivel de acceso actualizado', 'info');
      } catch {}
    };

    optRestricted?.addEventListener('click', () => void selectAccess('restricted'));
    optLink?.addEventListener('click', () => void selectAccess('anyone_with_link'));
  }

  const copyBtn = popover.querySelector<HTMLButtonElement>('[data-ref="btn-collab-copy-link"]');
  const copyTxt = popover.querySelector<HTMLElement>('[data-ref="txt-copy-link"]');
  copyBtn?.addEventListener('click', () => {
    const url = `${window.location.origin}/d/${encodeURIComponent(docId)}`;
    void navigator.clipboard.writeText(url).then(() => {
      if (copyTxt) copyTxt.textContent = '¡Enlace copiado!';
      showToast('Enlace de colaboración copiado al portapapeles', 'info');
      setTimeout(() => {
        if (copyTxt) copyTxt.textContent = 'Copiar el enlace';
      }, 2000);
    });
  });

  const viewMain = popover.querySelector<HTMLElement>('[data-ref="collab-share-view-main"]');
  const viewDownload = popover.querySelector<HTMLElement>('[data-ref="collab-share-view-download"]');
  const downloadBtn = popover.querySelector<HTMLButtonElement>('[data-ref="btn-collab-download-pdf"]');
  const btnShareDownloadBack = popover.querySelector<HTMLButtonElement>('[data-ref="btn-share-download-back"]');
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

  const openDownloadViewAction = () => {
    if (viewMain && viewDownload) {
      viewMain.classList.add('is-hidden');
      viewDownload.classList.remove('is-hidden');
    }
  };

  if (openInDownloadView) {
    openDownloadViewAction();
  }

  downloadBtn?.addEventListener('click', openDownloadViewAction);

  btnShareDownloadBack?.addEventListener('click', () => {
    if (viewMain && viewDownload) {
      viewDownload.classList.add('is-hidden');
      viewMain.classList.remove('is-hidden');
    }
  });

  let currentDownloadType: 'digital' | 'print' = 'digital';
  btnTypeDigital?.addEventListener('click', () => {
    currentDownloadType = 'digital';
    toggleDownloadType?.setAttribute('data-active', '0');
    btnTypeDigital.classList.add('active');
    btnTypePrint?.classList.remove('active');
    sectionDigitalOptions?.classList.remove('is-hidden');
  });

  btnTypePrint?.addEventListener('click', () => {
    currentDownloadType = 'print';
    toggleDownloadType?.setAttribute('data-active', '1');
    btnTypePrint.classList.add('active');
    btnTypeDigital?.classList.remove('active');
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
    btnPagesAll.classList.add('active');
    btnPagesCustom?.classList.remove('active');
    containerCustomPages?.classList.add('is-hidden');
  });

  btnPagesCustom?.addEventListener('click', () => {
    currentPagesMode = 'custom';
    toggleDownloadPages?.setAttribute('data-active', '1');
    btnPagesCustom.classList.add('active');
    btnPagesAll?.classList.remove('active');
    containerCustomPages?.classList.remove('is-hidden');
  });

  btnConfirmDownload?.addEventListener('click', () => {
    if (currentPagesMode === 'custom' && selectedPages.size === 0) {
      if (downloadError) {
        downloadError.textContent = 'Por favor selecciona al menos una página para descargar.';
        downloadError.classList.remove('is-hidden');
      }
      return;
    }
    if (downloadError) {
      downloadError.classList.add('is-hidden');
    }

    let downloadUrl = API_ROUTES.collaborativeDocs.pdf(docId);
    const queryParams = new URLSearchParams();
    if (currentPagesMode === 'custom') {
      const sorted = Array.from(selectedPages).sort((a, b) => a - b);
      queryParams.set('pages', sorted.join(','));
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
    showToast('Descarga iniciada', 'info');
  });

  return {
    cleanup,
    element: popover,
    openDownloadView: openDownloadViewAction,
  };
}
