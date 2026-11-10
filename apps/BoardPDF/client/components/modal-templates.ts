import { MODAL_2FA_SHIELD_SVG } from '../graphics/modal-illustrations.graphics.js';
import { t } from '../services/i18n.service.js';
import { DocumentLabel, LabelColorKey } from '../types/common.types.js';

const LABEL_COLOR_KEYS: readonly LabelColorKey[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];

function getLabelDisplayName(label: Pick<DocumentLabel, 'color' | 'is_default' | 'name'>): string {
  if (label.is_default) {
    return t(`projects.label_color_${label.color}`);
  }
  return label.name;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCreateFolderModalBody(): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-create-folder">
      <label class="field" data-ref="field-folder-name">
        <input class="field__input" data-ref="input-folder-name" type="text" placeholder=" " autocomplete="off" />
        <span class="field__label" data-ref="label-folder-name" data-i18n="projects.folder_name_label">${t('projects.folder_name_label')}</span>
      </label>
    </div>
  `;
}

function renderRenameFolderModalBody(currentName: string): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-rename-folder">
      <label class="field" data-ref="field-rename-name">
        <input class="field__input" data-ref="input-rename-name" type="text" value="${escapeHtml(currentName)}" placeholder=" " autocomplete="off" />
        <span class="field__label" data-ref="label-rename-name" data-i18n="projects.folder_name_label">${t('projects.folder_name_label')}</span>
      </label>
    </div>
  `;
}

function renderMoveFolderOptionsModalBody(options: {
  activeFolderId: string | null;
  folders: Array<{ id: string; name: string }>;
  isUploads?: boolean;
}): string {
  const rootKey = options.isUploads ? 'projects.uploads_root' : 'projects.all_projects';
  const rootLabel = t(rootKey);
  const selectedFolder = options.activeFolderId
    ? options.folders.find((f) => f.id === options.activeFolderId)
    : undefined;
  const selectedId = selectedFolder ? selectedFolder.id : '';

  const folderRows = options.folders
    .map((f) => {
      const isCurrent = selectedId === f.id;
      return `
        <button type="button" class="menu-item ${isCurrent ? 'is-selected' : ''}" data-ref="move-option-${escapeHtml(f.id)}" data-folder-id="${escapeHtml(f.id)}" data-value="${escapeHtml(f.id)}">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
          <span class="menu-item__text">${escapeHtml(f.name)}</span>
          <svg class="component-icon menu-item__check ${isCurrent ? '' : 'is-hidden'}" data-ref="check-folder-${escapeHtml(f.id)}" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
        </button>
      `;
    })
    .join('');

  return `
    <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-move-folder" data-selected-folder-id="${escapeHtml(selectedId)}">
      <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-move-folder" data-i18n-aria="projects.select_folder_placeholder" aria-label="${t('projects.select_folder_placeholder')}">
        <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-move-folder">
          <svg class="component-icon dropdown-trigger__icon" data-ref="icon-move-folder" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
          ${
            selectedFolder
              ? `<span class="dropdown-trigger__text" data-ref="txt-selected-move-folder">${escapeHtml(selectedFolder.name)}</span>`
              : `<span class="dropdown-trigger__text" data-ref="txt-selected-move-folder" data-i18n="projects.select_folder_placeholder">${t('projects.select_folder_placeholder')}</span>`
          }
        </div>
        <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
      </button>
      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-move-folder">
        <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-move-folder">
          <div class="menu-panel__drag-zone" data-ref="drag-zone-move-folder" aria-hidden="true">
            <div class="menu-panel__drag-handle"></div>
          </div>
          <div class="menu-panel__list menu-panel__list--scrollable" data-ref="move-folders-list">
            <button type="button" class="menu-item" data-ref="move-option-root" data-folder-id="" data-value="">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#home"></use></svg>
              <span class="menu-item__text" data-i18n="${rootKey}">${escapeHtml(rootLabel)}</span>
              <svg class="component-icon menu-item__check is-hidden" data-ref="check-folder-root" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
            </button>
            ${folderRows}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderVerifyEmailCodeModalBody(): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-verify-code">
      <label class="field" data-ref="field-email-code">
        <input class="field__input field__input--code" data-ref="input-email-code" type="text" maxlength="6" placeholder=" " autocomplete="one-time-code" inputmode="numeric" />
        <span class="field__label" data-ref="label-email-code" data-i18n="settings.your_account.modal_email_code_placeholder">${t('settings.your_account.modal_email_code_placeholder')}</span>
      </label>
    </div>
  `;
}

function renderVerifyPasswordModalBody(): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-verify-password">
      <label class="field" data-ref="field-modal-password">
        <input class="field__input field__input--has-action" data-ref="input-modal-password" type="password" placeholder=" " autocomplete="current-password" />
        <span class="field__label" data-ref="label-modal-password" data-i18n="settings.security.modal_current_password_label">${t('settings.security.modal_current_password_label')}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-modal-password" data-i18n-aria="common.show_password" data-i18n-tooltip="common.show_password" data-tooltip="${t('common.show_password')}" aria-label="${t('common.show_password')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
    </div>
  `;
}

function renderNewPasswordModalBody(): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-new-password">
      <label class="field" data-ref="field-new-password">
        <input class="field__input field__input--has-action" data-ref="input-new-password" type="password" placeholder=" " autocomplete="new-password" />
        <span class="field__label" data-ref="label-new-password" data-i18n="settings.security.modal_new_password_label">${t('settings.security.modal_new_password_label')}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-new-password" data-i18n-aria="common.show_password" data-i18n-tooltip="common.show_password" data-tooltip="${t('common.show_password')}" aria-label="${t('common.show_password')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
      <label class="field" data-ref="field-confirm-password">
        <input class="field__input field__input--has-action" data-ref="input-confirm-password" type="password" placeholder=" " autocomplete="new-password" />
        <span class="field__label" data-ref="label-confirm-password" data-i18n="settings.security.modal_confirm_new_password_label">${t('settings.security.modal_confirm_new_password_label')}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-confirm-password" data-i18n-aria="common.show_password" data-i18n-tooltip="common.show_password" data-tooltip="${t('common.show_password')}" aria-label="${t('common.show_password')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
    </div>
  `;
}

function renderDisable2FAModalBody(): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-disable-2fa">
      <label class="field" data-ref="field-disable-2fa-code">
        <input class="field__input field__input--code" data-ref="input-disable-2fa-code" type="text" maxlength="6" placeholder=" " autocomplete="one-time-code" inputmode="numeric" />
        <span class="field__label" data-ref="label-disable-2fa-code" data-i18n="settings.security.two_factor_modal_code_label">${t('settings.security.two_factor_modal_code_label')}</span>
      </label>
    </div>
  `;
}

function renderDeleteAccountModalBody(): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-delete-account">
      <label class="field" data-ref="field-delete-password">
        <input class="field__input field__input--has-action" data-ref="input-delete-password" type="password" placeholder=" " autocomplete="current-password" />
        <span class="field__label" data-ref="label-delete-password" data-i18n="settings.security.modal_current_password_label">${t('settings.security.modal_current_password_label')}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-delete-password" data-i18n-aria="common.show_password" data-i18n-tooltip="common.show_password" data-tooltip="${t('common.show_password')}" aria-label="${t('common.show_password')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
    </div>
  `;
}

function renderUnlockPdfModalBody(): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-unlock-pdf">
      <label class="field" data-ref="field-unlock-password">
        <input class="field__input field__input--has-action" data-ref="input-unlock-password" type="password" placeholder=" " autocomplete="current-password" />
        <span class="field__label" data-ref="label-unlock-password" data-i18n="tools.unlock_pdf.password_label">${t('tools.unlock_pdf.password_label')}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-unlock-pwd" data-i18n-aria="common.show_password" data-i18n-tooltip="common.show_password" data-tooltip="${t('common.show_password')}" aria-label="${t('common.show_password')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
    </div>
  `;
}

function renderAddWebUrlModalBody(currentUrl = ''): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-add-url">
      <label class="field" data-ref="field-web-url">
        <input class="field__input" data-ref="input-web-url" type="url" placeholder=" " autocomplete="off" value="${escapeHtml(currentUrl)}" />
        <span class="field__label" data-ref="label-web-url" data-i18n="tools.html_to_pdf.url_label">${t('tools.html_to_pdf.url_label')}</span>
      </label>
    </div>
  `;
}

function renderCollabPageSizeModalBody(
  selectedPresetId: string,
  presets: Array<{ description: string; id: string; name: string }>
): string {
  const initialPreset = presets.find((p) => p.id === selectedPresetId) || presets[0];
  const itemsHtml = presets
    .map(
      (p) => `
    <button type="button" class="menu-item menu-item--tall ${p.id === selectedPresetId ? 'is-selected' : ''}" data-ref="item-size-${escapeHtml(p.id)}" data-preset-id="${escapeHtml(p.id)}">
      <div class="menu-item__icon-wrapper">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
      </div>
      <div class="menu-item__text-group">
        <span class="menu-item__title">${escapeHtml(p.name)}</span>
        <span class="menu-item__subtitle">${escapeHtml(p.description)}</span>
      </div>
      <svg class="component-icon menu-item__check ${p.id === selectedPresetId ? '' : 'is-hidden'}" data-ref="check-size-${escapeHtml(p.id)}" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
    </button>
  `
    )
    .join('');

  return `
    <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-paper-size">
      <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-paper-size" data-i18n-aria="collab.select_paper_size" aria-label="${t('collab.select_paper_size')}">
        <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-paper-size">
          <svg class="component-icon dropdown-trigger__icon" data-ref="icon-paper-size" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
          <span class="dropdown-trigger__text" data-ref="txt-selected-paper-size">${escapeHtml(initialPreset.name)} (${escapeHtml(initialPreset.description)})</span>
        </div>
        <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
      </button>

      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-paper-size">
        <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-paper-size">
          <div class="menu-panel__drag-zone" data-ref="drag-zone-paper-size" aria-hidden="true">
            <div class="menu-panel__drag-handle"></div>
          </div>
          <div class="menu-panel__list menu-panel__list--scrollable" data-ref="list-paper-size">
            ${itemsHtml}
          </div>
        </div>
      </div>
    </div>

    <label class="split-option-card" data-ref="label-apply-all">
      <div class="split-option-card__content">
        <span class="split-option-card__title" data-i18n="collab.apply_to_all_pages">${t('collab.apply_to_all_pages')}</span>
        <span class="split-option-card__subtitle" data-i18n="collab.apply_to_all_pages_desc">${t('collab.apply_to_all_pages_desc')}</span>
      </div>
      <input class="component-checkbox" data-ref="chk-apply-all" type="checkbox" />
    </label>
  `;
}

function renderThankYouShareModalBody(): string {
  return `
    <div class="modal-social-share-grid" data-ref="social-share-grid">
      <a class="component-badge component-badge--sm component-badge--interactive" data-ref="share-twitter" href="#" target="_blank" rel="noopener noreferrer">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#post_add"></use></svg>
        <span data-i18n="download.social_twitter">${t('download.social_twitter')}</span>
      </a>
      <a class="component-badge component-badge--sm component-badge--interactive" data-ref="share-linkedin" href="#" target="_blank" rel="noopener noreferrer">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
        <span data-i18n="download.social_linkedin">${t('download.social_linkedin')}</span>
      </a>
      <a class="component-badge component-badge--sm component-badge--interactive" data-ref="share-facebook" href="#" target="_blank" rel="noopener noreferrer">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
        <span data-i18n="download.social_facebook">${t('download.social_facebook')}</span>
      </a>
      <a class="component-badge component-badge--sm component-badge--interactive" data-ref="share-whatsapp" href="#" target="_blank" rel="noopener noreferrer">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chat"></use></svg>
        <span data-i18n="download.social_whatsapp">${t('download.social_whatsapp')}</span>
      </a>
    </div>
  `;
}

function renderShareDownloadModalContent(shareUrl: string): string {
  return `
    <div class="modal-container" data-ref="modal-share-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="common.close" aria-label="${t('common.close')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--split" data-ref="modal-card-share">
        <div class="modal-card__drag-zone" data-ref="modal-share-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="modal-split__top" data-ref="modal-split-top">
          <div class="modal-split__visual-stage" data-ref="share-visual-stage">
            <div class="modal-split__qr-wrapper" data-ref="qr-wrapper">
              <div class="modal-split__qr-canvas" data-ref="share-qr-container"></div>
            </div>
            <div class="modal-split__top-hint" data-ref="qr-hint">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#qr_code_scanner"></use></svg>
              <span data-i18n="download_ready.share_qr_hint">${t('download_ready.share_qr_hint')}</span>
            </div>
          </div>
        </div>
        <div class="modal-split__bottom" data-ref="modal-split-bottom">
          <div class="modal-split__content" data-ref="share-content">
            <div class="modal-split__header" data-ref="share-header">
              <h2 class="modal-split__title" data-ref="share-title" data-i18n="download_ready.share_title">${t('download_ready.share_title')}</h2>
              <p class="modal-split__desc" data-ref="share-desc" data-i18n="download_ready.share_desc">${t('download_ready.share_desc')}</p>
            </div>
            <label class="field" data-ref="field-share-url">
              <input class="field__input field__input--has-action" data-ref="input-share-url" type="text" readonly placeholder=" " value="${escapeHtml(shareUrl)}" />
              <span class="field__label" data-ref="label-share-url" data-i18n="download_ready.share_link_label">${t('download_ready.share_link_label')}</span>
              <button type="button" class="field__action" data-ref="btn-modal-copy-url" data-i18n-aria="common.copy" data-i18n-tooltip="common.copy" data-tooltip="${t('common.copy')}" aria-label="${t('common.copy')}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
              </button>
            </label>
          </div>
          <div class="modal-split__actions" data-ref="share-actions">
            <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-close-share-modal" data-i18n="common.close">${t('common.close')}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTwoFactorModalContent(): string {
  return `
    <div class="modal-container" data-ref="modal-2fa-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="common.close" aria-label="${t('common.close')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--split" data-ref="modal-card-2fa">
        <div class="modal-card__drag-zone" data-ref="modal-2fa-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="modal-split__top" data-ref="modal-split-top">
          <div class="modal-split__visual-stage" data-ref="visual-stage-1">
            <div class="modal-split__qr-wrapper" data-ref="qr-wrapper">
              <div class="modal-split__qr-canvas" data-ref="qr-container"></div>
            </div>
            <div class="modal-split__top-hint" data-ref="qr-hint">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#qr_code_scanner"></use></svg>
              <span data-i18n="settings.security.two_factor_qr_hint">${t('settings.security.two_factor_qr_hint')}</span>
            </div>
          </div>

          <div class="modal-split__visual-stage is-hidden" data-ref="visual-stage-2">
            <div class="modal-split__svg-wrapper" data-ref="svg-wrapper">
              ${MODAL_2FA_SHIELD_SVG}
            </div>
            <div class="modal-split__top-status" data-ref="status-badge">
              <span class="modal-split__badge-check">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#verified_user"></use></svg>
              </span>
              <span class="modal-split__badge-text" data-i18n="settings.security.two_factor_active_badge">${t('settings.security.two_factor_active_badge')}</span>
            </div>
          </div>
        </div>

        <div class="modal-split__bottom" data-ref="modal-split-bottom">
          <div class="modal-split__stage" data-ref="stage-1-container">
            <div class="modal-split__content" data-ref="stage-1-content">
              <div class="modal-split__header" data-ref="stage-1-header">
                <h2 class="modal-split__title" data-ref="stage-1-title" data-i18n="settings.security.two_factor_modal_title">${t('settings.security.two_factor_modal_title')}</h2>
                <p class="modal-split__desc" data-ref="stage-1-desc" data-i18n="settings.security.two_factor_modal_desc">${t('settings.security.two_factor_modal_desc')}</p>
              </div>

              <div class="modal-split__form" data-ref="stage-1-form">
                <label class="field" data-ref="field-modal-2fa-code">
                  <input class="field__input field__input--code" data-ref="input-modal-2fa-code" type="text" maxlength="6" placeholder=" " autocomplete="one-time-code" inputmode="numeric" />
                  <span class="field__label" data-ref="label-modal-2fa-code" data-i18n="settings.security.two_factor_modal_code_label">${t('settings.security.two_factor_modal_code_label')}</span>
                </label>

                <button type="button" class="modal-split__link-toggle" data-ref="btn-toggle-secret">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#key"></use></svg>
                  <span data-ref="toggle-secret-text" data-i18n="settings.security.two_factor_view_secret">${t('settings.security.two_factor_view_secret')}</span>
                </button>

                <div class="modal-split__secret-box is-hidden" data-ref="box-secret-key">
                  <code class="modal-split__secret-value" data-ref="text-secret-value"></code>
                  <button type="button" class="modal-split__secret-copy" data-ref="btn-copy-secret" data-i18n-aria="common.copy" data-i18n-tooltip="common.copy" data-tooltip="${t('common.copy')}" aria-label="${t('common.copy')}">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                  </button>
                </div>
              </div>

              <div class="banner banner--danger is-hidden" data-ref="modal-2fa-error"></div>
            </div>

            <div class="modal-split__actions" data-ref="stage-1-actions">
              <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-continue-2fa" data-i18n="common.continue">${t('common.continue')}</button>
            </div>
          </div>

          <div class="modal-split__stage is-hidden" data-ref="stage-2-container">
            <div class="modal-split__content" data-ref="stage-2-content">
              <div class="modal-split__header" data-ref="stage-2-header">
                <h2 class="modal-split__title" data-ref="stage-2-title" data-i18n="settings.security.two_factor_backup_title">${t('settings.security.two_factor_backup_title')}</h2>
                <p class="modal-split__desc" data-ref="stage-2-desc" data-i18n="settings.security.two_factor_backup_desc">${t('settings.security.two_factor_backup_desc')}</p>
              </div>

              <div class="backup-codes-grid" data-ref="backup-codes-grid"></div>
            </div>

            <div class="modal-split__backup-actions" data-ref="stage-2-actions">
              <button type="button" class="component-button component-button--h36" data-ref="btn-copy-backup-codes">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                <span data-ref="btn-copy-text" data-i18n="settings.security.two_factor_copy_all">${t('settings.security.two_factor_copy_all')}</span>
              </button>
              <button type="button" class="component-button component-button--h36 component-button--black" data-ref="btn-finish-2fa" data-i18n="settings.security.two_factor_finish">${t('settings.security.two_factor_finish')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderWorkflowBuilderModalBody(workflowName = ''): string {
  return `
    <label class="field" data-ref="field-workflow-name">
      <input class="field__input" data-ref="input-workflow-name" type="text" placeholder=" " autocomplete="off" value="${escapeHtml(workflowName)}" />
      <span class="field__label" data-ref="label-workflow-name" data-i18n="workflows.name_label">${t('workflows.name_label')}</span>
    </label>

    <div class="workflow-modal-section-title" data-i18n="workflows.tool_select_title">${t('workflows.tool_select_title')}</div>

    <div class="workflow-tool-picker-row" data-ref="workflow-tool-picker-row">
      <div class="dropdown-wrapper dropdown-wrapper--full workflow-tool-dropdown" data-ref="field-workflow-tool">
        <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-workflow-tool" data-i18n-aria="workflows.tool_placeholder" aria-label="${t('workflows.tool_placeholder')}">
          <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-tool">
            <svg class="component-icon dropdown-trigger__icon is-hidden" data-ref="icon-selected-tool" aria-hidden="true"><use href="/icons.svg#widgets"></use></svg>
            <span class="dropdown-trigger__text" data-ref="txt-selected-tool" data-i18n="workflows.tool_placeholder">${t('workflows.tool_placeholder')}</span>
          </div>
          <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
        <div class="dropdown-backdrop" data-ref="backdrop-workflow-tool">
          <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-workflow-tool">
            <div class="menu-panel__drag-zone" data-ref="drag-zone-workflow-tool" aria-hidden="true">
              <div class="menu-panel__drag-handle"></div>
            </div>
            <div class="menu-panel__list menu-panel__list--scrollable" data-ref="list-workflow-tool"></div>
          </div>
        </div>
      </div>

      <button type="button" class="component-button component-button--secondary component-button--h40" data-ref="btn-modal-add-step">
        <span data-i18n="workflows.add_step">${t('workflows.add_step')}</span>
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
      </button>
    </div>

    <div class="workflow-modal-tool-options is-hidden" data-ref="workflow-modal-tool-options"></div>

    <div class="workflow-modal-sequence" data-ref="workflow-modal-sequence">
      <div class="workflow-modal-header-row">
        <div class="workflow-modal-section-title" data-i18n="workflows.sequence_title">${t('workflows.sequence_title')}</div>
        <button type="button" class="component-button component-button--ghost component-button--danger" data-ref="btn-modal-clear-pipeline" data-i18n="workflows.clear_all">${t('workflows.clear_all')}</button>
      </div>

      <div class="workflow-modal-steps-list" data-ref="workflow-modal-steps-list"></div>

      <div class="banner banner--danger modal-terminal-alert is-hidden" data-ref="modal-terminal-alert">
        <svg class="component-icon banner__icon" aria-hidden="true"><use href="/icons.svg#block"></use></svg>
        <span class="banner__text" data-i18n="workflows.terminal_alert">${t('workflows.terminal_alert')}</span>
      </div>
    </div>
  `;
}

function renderWorkflowPipelineStepItem(index: number, toolName: string, toolIcon: string, stepId: string): string {
  return `
    <div class="pipeline-step-item" data-ref="modal-step-${escapeHtml(stepId)}">
      <div class="pipeline-step-item__left">
        <span class="pipeline-step-item__number">${index}</span>
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${escapeHtml(toolIcon)}"></use></svg>
        <span class="pipeline-step-item__title">${escapeHtml(toolName)}</span>
      </div>
      <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--danger component-button--h28" data-ref="btn-modal-remove-step-${escapeHtml(stepId)}" data-id="${escapeHtml(stepId)}" data-i18n-aria="common.delete" aria-label="${t('common.delete')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
    </div>
  `;
}

function renderWorkflowEmptyStepsState(): string {
  return `
    <div class="workflow-empty-state">
      <svg class="component-icon workflow-empty-state__icon" aria-hidden="true"><use href="/icons.svg#account_tree"></use></svg>
      <span class="workflow-empty-state__text" data-i18n="workflows.empty_steps_hint">${t('workflows.empty_steps_hint')}</span>
    </div>
  `;
}

function renderDocumentLabelsModalBody(options: {
  customCount: number;
  labels: DocumentLabel[];
  maxCustomLabels: number;
  selectedColor: LabelColorKey;
  selectedIds: Set<number> | number[];
}): string {
  const selectedSet = options.selectedIds instanceof Set ? options.selectedIds : new Set(options.selectedIds);
  const limitReached = options.customCount >= options.maxCustomLabels;
  const counterText = t('projects.label_limit_counter', {
    count: options.customCount,
    max: options.maxCustomLabels,
  });

  const chipsHtml = options.labels.length > 0
    ? options.labels.map((lbl) => {
      const isSelected = selectedSet.has(lbl.id);
      const displayName = getLabelDisplayName(lbl);
      const safeName = escapeHtml(displayName);
      const deleteBtnHtml = lbl.is_default
        ? ''
        : `<button type="button" class="label-picker__chip-delete" data-ref="btn-delete-label-${lbl.id}" data-delete-label-id="${lbl.id}" data-i18n-aria="projects.label_delete_aria" aria-label="${escapeHtml(t('projects.label_delete_aria'))}"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg></button>`;

      return `
        <div class="label-picker__chip ${isSelected ? 'is-selected' : ''}" data-ref="chip-label-${lbl.id}">
          <button type="button" class="label-picker__chip-btn" data-ref="btn-toggle-label-${lbl.id}" data-label-id="${lbl.id}">
            <span class="label-picker__circle label-dot--${lbl.color}"></span>
            <span class="label-picker__chip-name">${safeName}</span>
            <svg class="component-icon label-picker__chip-check ${isSelected ? '' : 'is-hidden'}" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
          </button>
          ${deleteBtnHtml}
        </div>
      `;
    }).join('')
    : `<p class="label-picker__empty" data-i18n="projects.no_labels_available">${escapeHtml(t('projects.no_labels_available'))}</p>`;

  const swatchesHtml = LABEL_COLOR_KEYS.map((colorKey) => {
    const isSelected = colorKey === options.selectedColor;
    const colorName = escapeHtml(t(`projects.label_color_${colorKey}`));
    return `<button type="button" class="label-picker__swatch label-dot--${colorKey} ${isSelected ? 'is-selected' : ''}" data-ref="swatch-color-${colorKey}" data-color="${colorKey}" aria-label="${colorName}"></button>`;
  }).join('');

  return `
    <div class="label-picker" data-ref="label-picker">
      <div class="label-picker__list" data-ref="label-picker-list">
        ${chipsHtml}
      </div>
      <div class="label-picker__create" data-ref="label-picker-create">
        <div class="label-picker__create-header">
          <span class="label-picker__create-title" data-i18n="projects.label_create_section">${escapeHtml(t('projects.label_create_section'))}</span>
          <span class="label-picker__limit ${limitReached ? 'is-limit-reached' : ''}" data-ref="label-picker-limit-counter">${escapeHtml(counterText)}</span>
        </div>
        <div class="label-picker__create-row">
          <label class="field" data-ref="field-new-label-name">
            <input class="field__input" data-ref="input-new-label-name" type="text" placeholder=" " maxlength="60" autocomplete="off" />
            <span class="field__label" data-ref="lbl-new-label-name" data-i18n="projects.label_create_placeholder">${escapeHtml(t('projects.label_create_placeholder'))}</span>
          </label>
          <button type="button" class="component-button component-button--secondary component-button--h48" data-ref="btn-create-label" data-i18n="projects.label_create_btn">${escapeHtml(t('projects.label_create_btn'))}</button>
        </div>
        <div class="label-picker__swatches" data-ref="label-picker-swatches">
          ${swatchesHtml}
        </div>
        <div class="banner banner--danger is-hidden" data-ref="label-picker-error"></div>
      </div>
    </div>
  `;
}

export {
  LABEL_COLOR_KEYS,
  escapeHtml,
  getLabelDisplayName,
  renderAddWebUrlModalBody,
  renderCollabPageSizeModalBody,
  renderCreateFolderModalBody,
  renderDeleteAccountModalBody,
  renderDisable2FAModalBody,
  renderDocumentLabelsModalBody,
  renderMoveFolderOptionsModalBody,
  renderNewPasswordModalBody,
  renderRenameFolderModalBody,
  renderShareDownloadModalContent,
  renderThankYouShareModalBody,
  renderTwoFactorModalContent,
  renderUnlockPdfModalBody,
  renderVerifyEmailCodeModalBody,
  renderVerifyPasswordModalBody,
  renderWorkflowBuilderModalBody,
  renderWorkflowEmptyStepsState,
  renderWorkflowPipelineStepItem,
};
