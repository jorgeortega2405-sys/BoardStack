import { MODAL_2FA_SHIELD_SVG } from '../graphics/modal-illustrations.graphics.js';
import { t } from '../services/i18n.service.js';

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
        <span class="field__label" data-ref="label-folder-name" data-i18n="projects.folder_name_label">${t('projects.folder_name_label') || 'Nombre de la carpeta'}</span>
      </label>
    </div>
  `;
}

function renderRenameFolderModalBody(currentName: string): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-rename-folder">
      <label class="field" data-ref="field-rename-name">
        <input class="field__input" data-ref="input-rename-name" type="text" value="${escapeHtml(currentName)}" placeholder=" " autocomplete="off" />
        <span class="field__label" data-ref="label-rename-name" data-i18n="projects.folder_name_label">${t('projects.folder_name_label') || 'Nombre de la carpeta'}</span>
      </label>
    </div>
  `;
}

function renderMoveFolderOptionsModalBody(options: {
  activeFolderId: string | null;
  folders: Array<{ id: string; name: string }>;
  isUploads?: boolean;
}): string {
  const radioName = options.isUploads ? 'target-upload-folder' : 'target-folder';
  const rootLabel = options.isUploads
    ? (t('projects.uploads_root') || 'Todos los archivos subidos')
    : (t('projects.all_projects') || 'Todos los proyectos (Raíz)');

  const rootChecked = !options.activeFolderId ? 'checked' : '';
  const folderRows = options.folders.map((f) => {
    const isCurrent = options.activeFolderId === f.id;
    const checked = isCurrent ? 'checked' : '';
    return `
      <label class="modal-move-option" data-ref="move-option-${escapeHtml(f.id)}">
        <input class="radio" data-ref="radio-folder-${escapeHtml(f.id)}" type="radio" name="${radioName}" value="${escapeHtml(f.id)}" ${checked} />
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
        <span>${escapeHtml(f.name)}</span>
      </label>
    `;
  }).join('');

  return `
    <div class="modal-move-list" data-ref="move-folders-list">
      <label class="modal-move-option" data-ref="move-option-root">
        <input class="radio" data-ref="radio-folder-root" type="radio" name="${radioName}" value="" ${rootChecked} />
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#home"></use></svg>
        <span>${escapeHtml(rootLabel)}</span>
      </label>
      ${folderRows}
    </div>
  `;
}

function renderVerifyEmailCodeModalBody(userEmail: string): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-verify-code">
      <p class="settings-card__text" data-ref="verify-email-instruction">
        ${t('settings.account.verify_code_desc')} <strong class="text-highlight" data-ref="verify-email-target">${escapeHtml(userEmail)}</strong>
      </p>
      <label class="field" data-ref="field-email-code">
        <input class="field__input field__input--code" data-ref="input-email-code" type="text" maxlength="6" placeholder=" " autocomplete="one-time-code" inputmode="numeric" />
        <span class="field__label" data-ref="label-email-code" data-i18n="settings.account.code_label">${t('settings.account.code_label')}</span>
      </label>
    </div>
  `;
}

function renderVerifyPasswordModalBody(): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-verify-password">
      <label class="field" data-ref="field-modal-password">
        <input class="field__input field__input--has-action" data-ref="input-modal-password" type="password" placeholder=" " autocomplete="current-password" />
        <span class="field__label" data-ref="label-modal-password" data-i18n="settings.security.current_password_label">${t('settings.security.current_password_label')}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-modal-password" data-i18n-aria="common.show_password" aria-label="${t('common.show_password')}">
          <svg class="component-icon" data-ref="icon-eye-closed" aria-hidden="true"><use href="/icons.svg#visibility_off"></use></svg>
          <svg class="component-icon is-hidden" data-ref="icon-eye-open" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
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
        <span class="field__label" data-ref="label-new-password" data-i18n="settings.security.new_password_label">${t('settings.security.new_password_label')}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-new-password" data-i18n-aria="common.show_password" aria-label="${t('common.show_password')}">
          <svg class="component-icon" data-ref="icon-eye-new-closed" aria-hidden="true"><use href="/icons.svg#visibility_off"></use></svg>
          <svg class="component-icon is-hidden" data-ref="icon-eye-new-open" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
      <label class="field" data-ref="field-confirm-password">
        <input class="field__input" data-ref="input-confirm-password" type="password" placeholder=" " autocomplete="new-password" />
        <span class="field__label" data-ref="label-confirm-password" data-i18n="settings.security.confirm_password_label">${t('settings.security.confirm_password_label')}</span>
      </label>
    </div>
  `;
}

function renderDisable2FAModalBody(): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-disable-2fa">
      <label class="field" data-ref="field-disable-2fa-code">
        <input class="field__input field__input--code" data-ref="input-disable-2fa-code" type="text" maxlength="6" placeholder=" " autocomplete="one-time-code" inputmode="numeric" />
        <span class="field__label" data-ref="label-disable-2fa-code" data-i18n="settings.security.two_factor_code_label">${t('settings.security.two_factor_code_label')}</span>
      </label>
    </div>
  `;
}

function renderDeleteAccountModalBody(): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-delete-account">
      <label class="field" data-ref="field-delete-password">
        <input class="field__input field__input--has-action" data-ref="input-delete-password" type="password" placeholder=" " autocomplete="current-password" />
        <span class="field__label" data-ref="label-delete-password" data-i18n="settings.security.current_password_label">${t('settings.security.current_password_label')}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-delete-password" data-i18n-aria="common.show_password" aria-label="${t('common.show_password')}">
          <svg class="component-icon" data-ref="icon-eye-del-closed" aria-hidden="true"><use href="/icons.svg#visibility_off"></use></svg>
          <svg class="component-icon is-hidden" data-ref="icon-eye-del-open" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
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
        <button type="button" class="field__action" data-ref="btn-toggle-unlock-pwd" data-i18n-aria="common.show_password" aria-label="${t('common.show_password')}">
          <svg class="component-icon" data-ref="icon-unlock-closed" aria-hidden="true"><use href="/icons.svg#visibility_off"></use></svg>
          <svg class="component-icon is-hidden" data-ref="icon-unlock-open" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
    </div>
  `;
}

function renderAddWebUrlModalBody(currentUrl = ''): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-add-url">
      <label class="field" data-ref="field-web-url">
        <input class="field__input" data-ref="input-web-url" type="url" placeholder="https://ejemplo.com" autocomplete="off" value="${escapeHtml(currentUrl)}" />
        <span class="field__label" data-ref="label-web-url" data-i18n="ui.url_de_la_pagina_web">${t('ui.url_de_la_pagina_web')}</span>
      </label>
    </div>
  `;
}

function renderCollabLocalAuthModalBody(): string {
  return `
    <div class="modal-local-auth" data-ref="modal-local-auth">
      <button type="button" class="component-button component-button--primary component-button--black component-button--w-full" data-ref="btn-auth-register">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#person_add"></use></svg>
        <span data-i18n="modals_catalog.sample_local_auth_register">${t('modals_catalog.sample_local_auth_register')}</span>
      </button>
      <button type="button" class="component-button component-button--secondary component-button--w-full" data-ref="btn-auth-login">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#login"></use></svg>
        <span data-i18n="modals_catalog.sample_local_auth_login">${t('modals_catalog.sample_local_auth_login')}</span>
      </button>
    </div>
  `;
}

function renderShareDownloadModalBody(shareUrl: string): string {
  return `
    <div class="modal-form-stack" data-ref="modal-form-share-download">
      <div class="share-modal__qr-center" data-ref="qr-center">
        <div class="share-modal__qr-box" data-ref="share-qr-container"></div>
        <p class="share-modal__qr-hint" data-ref="qr-hint" data-i18n="download_ready.share_qr_hint">${t('download_ready.share_qr_hint')}</p>
      </div>

      <div class="share-modal__input-row" data-ref="share-input-row">
        <label class="field" data-ref="field-share-link">
          <input class="field__input" data-ref="input-share-link" type="text" readonly value="${escapeHtml(shareUrl)}" />
          <span class="field__label" data-ref="label-share-link" data-i18n="download_ready.share_link_label">${t('download_ready.share_link_label')}</span>
        </label>
        <button type="button" class="component-button component-button--black" data-ref="btn-copy-share-url">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
          <span data-ref="txt-copy-share" data-i18n="download_ready.copy_link_btn">${t('download_ready.copy_link_btn')}</span>
        </button>
      </div>
    </div>
  `;
}

function renderThankYouShareModalBody(): string {
  return `
    <div class="modal-social-share-grid" data-ref="social-share-grid">
      <a class="modal-social-badge modal-social-badge--twitter" data-ref="share-twitter" href="#" target="_blank" rel="noopener noreferrer">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#post_add"></use></svg>
        <span>X / Twitter</span>
      </a>
      <a class="modal-social-badge modal-social-badge--linkedin" data-ref="share-linkedin" href="#" target="_blank" rel="noopener noreferrer">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
        <span>LinkedIn</span>
      </a>
      <a class="modal-social-badge modal-social-badge--facebook" data-ref="share-facebook" href="#" target="_blank" rel="noopener noreferrer">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
        <span>Facebook</span>
      </a>
      <a class="modal-social-badge modal-social-badge--whatsapp" data-ref="share-whatsapp" href="#" target="_blank" rel="noopener noreferrer">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chat"></use></svg>
        <span>WhatsApp</span>
      </a>
    </div>
  `;
}

function renderCollabPageSizeModalBody(
  selectedPresetId: string,
  presets: Array<{ description: string; id: string; name: string }>
): string {
  const initialPreset = presets.find((p) => p.id === selectedPresetId) || presets[0];
  const itemsHtml = presets.map((p) => `
    <button type="button" class="menu-item ${p.id === selectedPresetId ? 'is-selected' : ''}" data-ref="item-size-${escapeHtml(p.id)}" data-preset-id="${escapeHtml(p.id)}">
      <div class="menu-item__icon-wrapper">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
      </div>
      <div class="menu-item__text-group">
        <span class="menu-item__title">${escapeHtml(p.name)}</span>
        <span class="menu-item__subtitle">${escapeHtml(p.description)}</span>
      </div>
      <svg class="component-icon menu-item__check ${p.id === selectedPresetId ? '' : 'is-hidden'}" data-ref="check-size-${escapeHtml(p.id)}" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
    </button>
  `).join('');

  return `
    <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-paper-size">
      <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-paper-size" aria-label="${t('ui.seleccionar_tamano_de_papel')}">
        <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-paper-size">
          <svg class="component-icon dropdown-trigger__icon" data-ref="icon-paper-size" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
          <span class="dropdown-trigger__text" data-ref="txt-selected-paper-size">${escapeHtml(initialPreset.name)} (${escapeHtml(initialPreset.description)})</span>
        </div>
        <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
      </button>

      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-paper-size"></div>
      <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-paper-size">
        <div class="menu-panel__list" data-ref="list-paper-size">
          ${itemsHtml}
        </div>
      </div>
    </div>

    <div class="collab-page-size-checkbox-wrap" data-ref="wrap-apply-all">
      <label class="collab-resize-checkbox-label" data-ref="label-apply-all">
        <input class="checkbox" data-ref="chk-apply-all" type="checkbox" />
        <span data-i18n="collab.apply_to_all_pages">${t('collab.apply_to_all_pages')}</span>
      </label>
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
        <div class="modal-split__left" data-ref="modal-split-left">
          <div class="modal-split__stage" data-ref="stage-1-container">
            <div class="modal-split__header" data-ref="stage-1-header">
              <h2 class="modal-split__title" data-ref="stage-1-title" data-i18n="settings.security.two_factor_modal_title">
                ${t('settings.security.two_factor_modal_title')}
              </h2>
              <p class="modal-split__desc" data-ref="stage-1-desc" data-i18n="settings.security.two_factor_modal_desc">
                ${t('settings.security.two_factor_modal_desc')}
              </p>
            </div>

            <div class="modal-split__form" data-ref="stage-1-form">
              <label class="field" data-ref="field-modal-2fa-code">
                <input class="field__input field__input--code" data-ref="input-modal-2fa-code" type="text" maxlength="6" placeholder=" " autocomplete="one-time-code" inputmode="numeric" />
                <span class="field__label" data-ref="label-modal-2fa-code" data-i18n="settings.security.two_factor_modal_code_label">
                  ${t('settings.security.two_factor_modal_code_label')}
                </span>
              </label>

              <button type="button" class="modal-split__link-toggle" data-ref="btn-toggle-secret">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#key"></use></svg>
                <span data-ref="toggle-secret-text" data-i18n="settings.security.two_factor_view_secret">
                  ${t('settings.security.two_factor_view_secret')}
                </span>
              </button>

              <div class="modal-split__secret-box is-hidden" data-ref="box-secret-key">
                <span class="modal-split__secret-value" data-ref="text-secret-value"></span>
                <button type="button" class="modal-split__secret-copy" data-ref="btn-copy-secret" data-tooltip="${t('common.copy') || 'Copiar'}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                </button>
              </div>

              <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-continue-2fa">
                ${t('common.continue')}
              </button>

              <div class="banner banner--danger is-hidden" data-ref="modal-2fa-error"></div>
            </div>
          </div>

          <div class="modal-split__stage is-hidden" data-ref="stage-2-container">
            <div class="modal-split__header" data-ref="stage-2-header">
              <h2 class="modal-split__title" data-ref="stage-2-title" data-i18n="settings.security.two_factor_backup_title">
                ${t('settings.security.two_factor_backup_title')}
              </h2>
              <p class="modal-split__desc" data-ref="stage-2-desc" data-i18n="settings.security.two_factor_backup_desc">
                ${t('settings.security.two_factor_backup_desc')}
              </p>
            </div>

            <div class="modal-split__backup-section" data-ref="stage-2-codes">
              <div class="backup-codes-grid" data-ref="backup-codes-grid"></div>

              <div class="modal-split__backup-actions" data-ref="stage-2-actions">
                <button type="button" class="component-button component-button--h38" data-ref="btn-copy-backup-codes">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                  <span data-ref="btn-copy-text">${t('settings.security.two_factor_copy_all')}</span>
                </button>
                <button type="button" class="component-button component-button--h38 component-button--black" data-ref="btn-finish-2fa">
                  ${t('settings.security.two_factor_finish')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-split__right" data-ref="modal-split-right">
          <div class="modal-split__visual-stage" data-ref="visual-stage-1">
            <div class="modal-split__qr-wrapper" data-ref="qr-wrapper">
              <div class="modal-split__qr-canvas" data-ref="qr-container"></div>
            </div>
            <div class="modal-split__right-hint" data-ref="qr-hint">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#qr_code_scanner"></use></svg>
              <span data-i18n="settings.security.two_factor_qr_hint">${t('settings.security.two_factor_qr_hint')}</span>
            </div>
          </div>

          <div class="modal-split__visual-stage is-hidden" data-ref="visual-stage-2">
            <div class="modal-split__svg-wrapper" data-ref="svg-wrapper">
              ${MODAL_2FA_SHIELD_SVG}
            </div>
            <div class="modal-split__right-status" data-ref="status-badge">
              <span class="modal-split__badge-check">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#verified_user"></use></svg>
              </span>
              <span class="modal-split__badge-text" data-i18n="settings.security.two_factor_active_badge">
                ${t('settings.security.two_factor_active_badge')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderWorkflowBuilderModalBody(workflowName = ''): string {
  return `
    <div class="workflow-modal-columns" data-ref="modal-columns">
      <div class="modal-col-left" data-ref="modal-col-left">
        <div class="workflow-modal-section-title" data-i18n="modals_catalog.sample_workflow_tool_select_title">${t('modals_catalog.sample_workflow_tool_select_title')}</div>

        <label class="field" data-ref="field-workflow-name">
          <input class="field__input" data-ref="input-workflow-name" type="text" placeholder=" " autocomplete="off" value="${escapeHtml(workflowName)}" />
          <span class="field__label" data-ref="label-workflow-name" data-i18n="modals_catalog.sample_workflow_name_label">${t('modals_catalog.sample_workflow_name_label')}</span>
        </label>

        <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="field-workflow-tool">
          <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-workflow-tool" aria-label="${t('ui.seleccionar_herramienta')}">
            <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-tool">
              <svg class="component-icon dropdown-trigger__icon is-hidden" data-ref="icon-selected-tool" aria-hidden="true"><use href="/icons.svg#widgets"></use></svg>
              <span class="dropdown-trigger__text" data-ref="txt-selected-tool" data-i18n="modals_catalog.sample_workflow_tool_placeholder">${t('modals_catalog.sample_workflow_tool_placeholder')}</span>
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

        <div class="workflow-modal-tool-options is-hidden" data-ref="workflow-modal-tool-options"></div>

        <button type="button" class="component-button component-button--secondary component-button--h40 component-button--w-full" data-ref="btn-modal-add-step">
          <span data-i18n="modals_catalog.sample_workflow_add_step">${t('modals_catalog.sample_workflow_add_step')}</span>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
        </button>
      </div>

      <div class="modal-col-right modal-col-right--workflow" data-ref="modal-col-right">
        <div class="workflow-modal-header-row">
          <div class="workflow-modal-section-title" data-i18n="modals_catalog.sample_workflow_sequence_title">${t('modals_catalog.sample_workflow_sequence_title')}</div>
          <button type="button" class="component-button component-button--ghost component-button--danger" data-ref="btn-modal-clear-pipeline" data-i18n="modals_catalog.sample_workflow_clear">${t('modals_catalog.sample_workflow_clear')}</button>
        </div>

        <div class="workflow-modal-steps-list" data-ref="workflow-modal-steps-list"></div>

        <div class="banner banner--danger modal-terminal-alert is-hidden" data-ref="modal-terminal-alert">
          <svg class="component-icon banner__icon" aria-hidden="true"><use href="/icons.svg#block"></use></svg>
          <span class="banner__text" data-i18n="ui.no_es_posible_anadir_herramientas_desp">${t('ui.no_es_posible_anadir_herramientas_desp')}</span>
        </div>
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
      <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--danger component-button--h28" data-ref="btn-modal-remove-step-${escapeHtml(stepId)}" data-id="${escapeHtml(stepId)}" aria-label="${t('common.delete_file')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
    </div>
  `;
}

function renderWorkflowEmptyStepsState(): string {
  return `
    <div class="workflow-empty-state">
      <svg class="component-icon workflow-empty-state__icon" aria-hidden="true"><use href="/icons.svg#account_tree"></use></svg>
      <span class="workflow-empty-state__text" data-i18n="ui.anade_herramientas_a_la_secuencia_des">${t('ui.anade_herramientas_a_la_secuencia_des')}</span>
    </div>
  `;
}

export {
  escapeHtml,
  renderAddWebUrlModalBody,
  renderCollabLocalAuthModalBody,
  renderCollabPageSizeModalBody,
  renderCreateFolderModalBody,
  renderDeleteAccountModalBody,
  renderDisable2FAModalBody,
  renderMoveFolderOptionsModalBody,
  renderNewPasswordModalBody,
  renderRenameFolderModalBody,
  renderShareDownloadModalBody,
  renderThankYouShareModalBody,
  renderTwoFactorModalContent,
  renderUnlockPdfModalBody,
  renderVerifyEmailCodeModalBody,
  renderVerifyPasswordModalBody,
  renderWorkflowBuilderModalBody,
  renderWorkflowEmptyStepsState,
  renderWorkflowPipelineStepItem,
};
