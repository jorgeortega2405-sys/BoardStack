import { addFolderMemberApi, currentUser, escapeHtml, getFolderMembersApi, removeFolderMemberApi, searchCurrentTeamMembersApi, updateFolderVisibilityApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ModalInstance } from '../types/common.types.js';
import { ProjectFolderMemberRecord, TeamMemberRecord } from '../types/team.types.js';
import { debounce } from '../utils/dom.util.js';
import { openModal } from './modal.component.js';

function openTeamFolderShareModal(options: {
  folderId: string;
  folderName: string;
  onUpdated?: () => void;
}): ModalInstance {
  let visibility: 'restricted' | 'team' = 'team';
  let canManage = false;
  let members: ProjectFolderMemberRecord[] = [];
  let selectedRole: 'editor' | 'viewer' = 'editor';

  const bodyHtml = `
    <div class="team-folder-share" data-ref="team-folder-share-body">
      <div class="team-folder-share__loading" data-ref="folder-share-loading">
        <span>${escapeHtml(t('common.loading'))}</span>
      </div>

      <div class="team-folder-share__content is-hidden" data-ref="folder-share-content">
        <div class="team-folder-share__section">
          <div class="team-folder-share__label">${escapeHtml(t('projects.share_folder_visibility_label'))}</div>
          <div class="team-folder-share__visibility-grid">
            <button type="button" class="team-folder-share__vis-card" data-ref="btn-folder-visibility-restricted" data-visibility="restricted">
              <div class="team-folder-share__vis-head">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
                <span class="team-folder-share__vis-title">${escapeHtml(t('projects.folder_visibility_restricted'))}</span>
              </div>
              <p class="team-folder-share__vis-desc">${escapeHtml(t('projects.share_folder_visibility_restricted_desc'))}</p>
            </button>

            <button type="button" class="team-folder-share__vis-card" data-ref="btn-folder-visibility-team" data-visibility="team">
              <div class="team-folder-share__vis-head">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#groups"></use></svg>
                <span class="team-folder-share__vis-title">${escapeHtml(t('projects.folder_visibility_team'))}</span>
              </div>
              <p class="team-folder-share__vis-desc">${escapeHtml(t('projects.share_folder_visibility_team_desc'))}</p>
            </button>
          </div>
        </div>

        <div class="team-folder-share__members-section is-hidden" data-ref="folder-share-members-section">
          <div class="team-folder-share__search-row" data-ref="folder-share-search-row">
            <input class="field__input--simple team-folder-share__search-input" data-ref="input-folder-member-search" type="search" placeholder="${escapeHtml(t('projects.share_folder_add_placeholder'))}" autocomplete="off" />
            <div class="component-tabs team-folder-share__role-tabs" data-ref="tabs-folder-add-role">
              <button type="button" class="component-tab is-active" data-ref="btn-folder-role-editor" data-role="editor">${escapeHtml(t('projects.share_folder_role_editor'))}</button>
              <button type="button" class="component-tab" data-ref="btn-folder-role-viewer" data-role="viewer">${escapeHtml(t('projects.share_folder_role_viewer'))}</button>
            </div>
          </div>

          <div class="team-folder-share__results is-hidden" data-ref="list-folder-member-results"></div>
          <div class="team-folder-share__members-list" data-ref="list-folder-members"></div>
        </div>
      </div>
    </div>
  `;

  const modal = openModal({
    bodyHtml,
    confirmClass: 'component-button--black',
    confirmText: t('common.close'),
    onConfirm: async () => true,
    showCancel: false,
    size: 'md',
    title: t('projects.share_folder_modal_title', { name: options.folderName }),
  });

  const loadingEl = modal.body.querySelector<HTMLElement>('[data-ref="folder-share-loading"]');
  const contentEl = modal.body.querySelector<HTMLElement>('[data-ref="folder-share-content"]');
  const btnRestricted = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-folder-visibility-restricted"]');
  const btnTeam = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-folder-visibility-team"]');
  const membersSection = modal.body.querySelector<HTMLElement>('[data-ref="folder-share-members-section"]');
  const searchRow = modal.body.querySelector<HTMLElement>('[data-ref="folder-share-search-row"]');
  const searchInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-folder-member-search"]');
  const btnRoleEditor = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-folder-role-editor"]');
  const btnRoleViewer = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-folder-role-viewer"]');
  const resultsEl = modal.body.querySelector<HTMLElement>('[data-ref="list-folder-member-results"]');
  const membersListEl = modal.body.querySelector<HTMLElement>('[data-ref="list-folder-members"]');

  const syncRoleButtons = () => {
    btnRoleEditor?.classList.toggle('is-active', selectedRole === 'editor');
    btnRoleViewer?.classList.toggle('is-active', selectedRole === 'viewer');
  };

  const renderMembersList = () => {
    if (!membersListEl) return;
    if (members.length === 0) {
      membersListEl.innerHTML = `<p class="team-folder-share__empty">${escapeHtml(t('projects.share_folder_no_matches'))}</p>`;
      return;
    }

    membersListEl.innerHTML = members.map((member) => {
      const avatarSrc = member.avatar_url || `/api/avatar?name=${encodeURIComponent(member.username)}&size=64`;
      const isSelf = Number(member.user_id) === Number(currentUser?.id);
      const roleLabel = member.role === 'editor'
        ? t('projects.share_folder_role_editor')
        : t('projects.share_folder_role_viewer');

      return `
        <div class="team-folder-share__member-row" data-user-id="${member.user_id}">
          <div class="team-folder-share__member-info">
            <img class="team-folder-share__avatar" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(member.username)}" />
            <div class="team-folder-share__member-text">
              <span class="team-folder-share__member-name">${escapeHtml(member.username)}</span>
              <span class="team-folder-share__member-email">${escapeHtml(member.email)}</span>
            </div>
          </div>
          <div class="team-folder-share__member-actions">
            ${canManage && !isSelf ? `
              <button type="button" class="component-button component-button--h32 component-button--ghost" data-action="toggle-folder-member-role" data-user-id="${member.user_id}" data-role="${member.role}">
                <span>${escapeHtml(roleLabel)}</span>
              </button>
              <button type="button" class="component-button component-button--h32 component-button--icon-only component-button--ghost" data-action="remove-folder-member" data-user-id="${member.user_id}" aria-label="${escapeHtml(t('common.delete'))}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
              </button>
            ` : `
              <span class="component-badge component-badge--neutral">${escapeHtml(roleLabel)}</span>
            `}
          </div>
        </div>
      `;
    }).join('');
    renderIcons(membersListEl);
  };

  const renderState = () => {
    btnRestricted?.classList.toggle('is-active', visibility === 'restricted');
    btnTeam?.classList.toggle('is-active', visibility === 'team');
    if (btnRestricted) btnRestricted.disabled = !canManage;
    if (btnTeam) btnTeam.disabled = !canManage;

    membersSection?.classList.toggle('is-hidden', visibility !== 'restricted');
    searchRow?.classList.toggle('is-hidden', !canManage);
    renderMembersList();
  };

  const runSearch = debounce(async (query: string) => {
    if (!resultsEl || !canManage) return;
    const trimmed = query.trim();
    if (!trimmed) {
      resultsEl.innerHTML = '';
      resultsEl.classList.add('is-hidden');
      return;
    }

    const res = await searchCurrentTeamMembersApi(trimmed);
    const existingIds = new Set(members.map((m) => Number(m.user_id)));
    const matches = (Array.isArray(res.members) ? res.members : []).filter(
      (m: TeamMemberRecord) => !existingIds.has(Number(m.user_id)) && Number(m.user_id) !== Number(currentUser?.id)
    );

    if (!res.success || matches.length === 0) {
      resultsEl.innerHTML = `<div class="team-folder-share__empty">${escapeHtml(t('projects.share_folder_no_matches'))}</div>`;
      resultsEl.classList.remove('is-hidden');
      return;
    }

    resultsEl.innerHTML = matches.map((candidate: TeamMemberRecord) => {
      const avatarSrc = candidate.avatar_url || `/api/avatar?name=${encodeURIComponent(candidate.username)}&size=64`;
      return `
        <button type="button" class="team-folder-share__result-row" data-action="add-folder-member" data-user-id="${candidate.user_id}">
          <div class="team-folder-share__member-info">
            <img class="team-folder-share__avatar" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(candidate.username)}" />
            <div class="team-folder-share__member-text">
              <span class="team-folder-share__member-name">${escapeHtml(candidate.username)}</span>
              <span class="team-folder-share__member-email">${escapeHtml(candidate.email)}</span>
            </div>
          </div>
          <span class="component-button component-button--h30 component-button--black">${escapeHtml(t('collaborative.share_add_user_btn'))}</span>
        </button>
      `;
    }).join('');
    resultsEl.classList.remove('is-hidden');
  }, 220);

  btnRoleEditor?.addEventListener('click', () => {
    selectedRole = 'editor';
    syncRoleButtons();
  });

  btnRoleViewer?.addEventListener('click', () => {
    selectedRole = 'viewer';
    syncRoleButtons();
  });

  searchInput?.addEventListener('input', () => {
    void runSearch(searchInput.value);
  });

  const handleVisibilitySwitch = async (nextVis: 'restricted' | 'team') => {
    if (!canManage || nextVis === visibility) return;
    modal.clearError();
    const res = await updateFolderVisibilityApi(options.folderId, nextVis);
    if (!res.success) {
      modal.showError(res.error || t('projects.sharing_update_error'));
      return;
    }
    visibility = nextVis;
    renderState();
    showToast(t('projects.share_folder_updated'), 'info');
    options.onUpdated?.();
  };

  btnRestricted?.addEventListener('click', () => {
    void handleVisibilitySwitch('restricted');
  });

  btnTeam?.addEventListener('click', () => {
    void handleVisibilitySwitch('team');
  });

  modal.body.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (!actionEl) return;

    const action = actionEl.getAttribute('data-action');
    const userId = Number(actionEl.getAttribute('data-user-id') || 0);
    if (!userId || !canManage) return;

    if (action === 'add-folder-member') {
      modal.clearError();
      void addFolderMemberApi(options.folderId, userId, selectedRole).then((res) => {
        if (!res.success) {
          modal.showError(res.error || t('projects.sharing_member_add_error'));
          return;
        }
        members = Array.isArray(res.members) ? res.members : members;
        if (searchInput) searchInput.value = '';
        if (resultsEl) {
          resultsEl.innerHTML = '';
          resultsEl.classList.add('is-hidden');
        }
        renderMembersList();
        showToast(t('projects.share_folder_updated'), 'info');
        options.onUpdated?.();
      });
    } else if (action === 'toggle-folder-member-role') {
      modal.clearError();
      const currentRole = actionEl.getAttribute('data-role') === 'viewer' ? 'viewer' : 'editor';
      const nextRole = currentRole === 'editor' ? 'viewer' : 'editor';
      void addFolderMemberApi(options.folderId, userId, nextRole).then((res) => {
        if (!res.success) {
          modal.showError(res.error || t('projects.sharing_member_add_error'));
          return;
        }
        members = Array.isArray(res.members) ? res.members : members;
        renderMembersList();
        showToast(t('projects.share_folder_updated'), 'info');
        options.onUpdated?.();
      });
    } else if (action === 'remove-folder-member') {
      modal.clearError();
      void removeFolderMemberApi(options.folderId, userId).then((res) => {
        if (!res.success) {
          modal.showError(res.error || t('projects.sharing_member_remove_error'));
          return;
        }
        members = Array.isArray(res.members) ? res.members : members;
        renderMembersList();
        showToast(t('projects.share_folder_updated'), 'info');
        options.onUpdated?.();
      });
    }
  });

  void getFolderMembersApi(options.folderId).then((res) => {
    loadingEl?.classList.add('is-hidden');
    if (!res.success) {
      modal.showError(res.error || t('projects.sharing_load_error'));
      return;
    }
    visibility = res.visibility === 'restricted' ? 'restricted' : 'team';
    canManage = Boolean(res.canManage);
    members = Array.isArray(res.members) ? res.members : [];
    contentEl?.classList.remove('is-hidden');
    renderIcons(modal.body);
    renderState();
  });

  return modal;
}

export { openTeamFolderShareModal };
