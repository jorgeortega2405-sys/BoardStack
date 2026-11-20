import { escapeHtml } from '../utils/dom.util.js';
import { i18n } from '../i18n/i18n.service.js';

function renderPromptModalBody(placeholder = '', defaultValue = '', inputType = 'text'): string {
  const displayPlaceholder = placeholder || i18n.t('modal.enter_value');
  return `
    <div class="modal-form-vertical" data-ref="modal-prompt-fields">
      <label class="field" data-ref="field-prompt-input">
        <input type="${inputType}" class="field__input" data-ref="input-prompt-value" placeholder=" " value="${escapeHtml(defaultValue)}" />
        <span class="field__label" data-ref="label-prompt-input">${escapeHtml(displayPlaceholder)}</span>
      </label>
    </div>
  `;
}

function renderMessageModalBody(message: string): string {
  return `
    <div class="modal-card__message" data-ref="modal-message">
      ${escapeHtml(message)}
    </div>
  `;
}

function renderVerifyEmailCodeModalBody(): string {
  return `
    <div class="modal-form-vertical" data-ref="modal-verify-email-code-fields">
      <label class="field" data-ref="field-email-code">
        <input class="field__input" data-ref="input-email-code" type="text" maxlength="6" placeholder=" " autocomplete="one-time-code" inputmode="numeric" />
        <span class="field__label" data-ref="label-email-code">${i18n.t('settings.account.email_verify_sent')}</span>
      </label>
    </div>
  `;
}

function renderIdentityVerificationModalBody(extraWarningHtml = '', hasPassword = true): string {
  return `
    <div class="modal-form-vertical" data-ref="modal-identity-verify-fields">
      ${extraWarningHtml}
      <div class="component-badge-group" data-ref="verify-method-badges">
        <button type="button" class="component-badge component-badge--interactive" data-ref="badge-verify-password">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
          <span>${i18n.t('modal.verify_with_password')}</span>
        </button>
        <button type="button" class="component-badge component-badge--interactive" data-ref="badge-verify-google">
          <svg class="component-icon component-icon--colored" aria-hidden="true"><use href="/icons.svg#google_colored"></use></svg>
          <span>${i18n.t('modal.verify_with_google')}</span>
        </button>
      </div>
      <div class="is-hidden" data-ref="panel-verify-password">
        ${hasPassword ? `
          <label class="field" data-ref="field-modal-password">
            <input type="password" class="field__input field__input--has-action" data-ref="input-modal-password" maxlength="128" placeholder=" " autocomplete="current-password" />
            <span class="field__label" data-ref="label-modal-password">${i18n.t('modal.confirm_current_password')}</span>
            <button type="button" class="field__action" data-ref="btn-toggle-modal-password" aria-label="${i18n.t('auth.cancel_password_toggle')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
            </button>
          </label>
        ` : `
          <div class="component-verify-status" data-ref="no-password-hint">${i18n.t('modal.no_password_set_hint')}</div>
        `}
      </div>
      <div class="is-hidden" data-ref="panel-verify-google">
        <div class="component-verify-status" data-ref="google-verify-status-box">
          <span class="component-spinner" data-ref="google-verify-spinner" aria-hidden="true"></span>
          <span data-ref="google-verify-waiting-text">${i18n.t('modal.google_verify_waiting')}</span>
          <button type="button" class="component-button component-button--h34" data-ref="btn-reopen-google-verify">
            ${i18n.t('modal.google_verify_reopen')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderVerifyPasswordModalBody(hasPassword = true): string {
  return renderIdentityVerificationModalBody('', hasPassword);
}

function renderNewPasswordModalBody(): string {
  return `
    <div class="modal-form-vertical" data-ref="modal-new-password-fields">
      <label class="field" data-ref="field-new-password">
        <input type="password" class="field__input field__input--has-action" data-ref="input-new-password" maxlength="128" placeholder=" " autocomplete="new-password" />
        <span class="field__label" data-ref="label-new-password">${i18n.t('auth.new_password')}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-new-password" aria-label="${i18n.t('auth.cancel_password_toggle')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
      <label class="field" data-ref="field-confirm-password">
        <input type="password" class="field__input field__input--has-action" data-ref="input-confirm-password" maxlength="128" placeholder=" " autocomplete="new-password" />
        <span class="field__label" data-ref="label-confirm-password">${i18n.t('auth.new_password_confirm')}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-confirm-password" aria-label="${i18n.t('auth.cancel_password_toggle')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
    </div>
  `;
}

function renderDisable2FAModalBody(): string {
  return `
    <div class="modal-form-vertical" data-ref="modal-disable-2fa-fields">
      <label class="field" data-ref="field-disable-2fa-credential">
        <input type="password" class="field__input" data-ref="input-disable-2fa-code" maxlength="128" placeholder=" " />
        <span class="field__label" data-ref="label-disable-2fa-code">${i18n.t('modal.password_or_code')}</span>
      </label>
    </div>
  `;
}

function renderDeleteAccountModalBody(hasPassword = true): string {
  const warningHtml = `<p class="modal-form-description" data-ref="delete-account-warning">${i18n.t('modal.delete_account_irreversible')}</p>`;
  return renderIdentityVerificationModalBody(warningHtml, hasPassword);
}

function renderTwoFactorModalContent(): string {
  return `
    <div class="modal-container" data-ref="modal-2fa-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="${i18n.t('common.close')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--split" data-ref="modal-card-2fa">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="modal-split__left" data-ref="modal-split-left">
          <div class="modal-split__stage" data-ref="stage-1-container">
            <div class="modal-split__content" data-ref="stage-1-content">
              <div class="modal-split__header" data-ref="stage-1-header">
                <h2 class="modal-split__title" data-ref="stage-1-title">${i18n.t('modal.scan_qr_title')}</h2>
                <p class="modal-split__desc" data-ref="stage-1-desc">${i18n.t('modal.scan_qr_desc')}</p>
              </div>

              <div class="modal-split__form" data-ref="stage-1-form">
                <label class="field" data-ref="field-modal-2fa-code">
                  <input class="field__input" data-ref="input-modal-2fa-code" type="text" maxlength="6" placeholder=" " autocomplete="one-time-code" inputmode="numeric" />
                  <span class="field__label" data-ref="label-modal-2fa-code">${i18n.t('auth.digit_code')}</span>
                </label>

                <button type="button" class="modal-split__link-toggle" data-ref="btn-toggle-secret">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#key"></use></svg>
                  <span data-ref="toggle-secret-text">${i18n.t('modal.see_secret_key')}</span>
                </button>

                <div class="modal-split__secret-box is-hidden" data-ref="box-secret-key">
                  <code class="modal-split__secret-value" data-ref="text-secret-value"></code>
                  <button type="button" class="modal-split__secret-copy" data-ref="btn-copy-secret" title="${i18n.t('common.copy')}" aria-label="${i18n.t('common.copy')}">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="modal-split__actions" data-ref="stage-1-actions">
              <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-continue-2fa">${i18n.t('common.confirm')}</button>
              <div class="banner banner--danger is-hidden" data-ref="modal-2fa-error" style="color: var(--color-danger, #ef4444); font-size: 13px; margin-top: 6px;"></div>
            </div>
          </div>

          <div class="modal-split__stage is-hidden" data-ref="stage-2-container">
            <div class="modal-split__content" data-ref="stage-2-content">
              <div class="modal-split__header" data-ref="stage-2-header">
                <h2 class="modal-split__title" data-ref="stage-2-title">${i18n.t('modal.recovery_codes_title')}</h2>
                <p class="modal-split__desc" data-ref="stage-2-desc">${i18n.t('modal.recovery_codes_desc')}</p>
              </div>

              <div class="backup-codes-grid" data-ref="backup-codes-grid"></div>
            </div>

            <div class="modal-split__backup-actions" data-ref="stage-2-actions">
              <button type="button" class="component-button component-button--h36" data-ref="btn-copy-backup-codes">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                <span data-ref="btn-copy-text">${i18n.t('modal.copy_all')}</span>
              </button>
              <button type="button" class="component-button component-button--h36 component-button--black" data-ref="btn-finish-2fa">${i18n.t('modal.finish')}</button>
            </div>
          </div>
        </div>

        <div class="modal-split__right" data-ref="modal-split-right">
          <div class="modal-split__visual-stage modal-split__visual-stage--qr" data-ref="visual-stage-1">
            <img class="modal-split__qr-backdrop" data-ref="2fa-qr-backdrop" src="/images/modals/qr-stage-backdrop.svg" alt="" aria-hidden="true" />
            <div class="modal-split__qr-card" data-ref="qr-card">
              <div class="modal-split__qr-wrapper" data-ref="qr-wrapper">
                <div class="modal-split__qr-canvas" data-ref="qr-container"></div>
              </div>
              <div class="modal-split__visual-hint" data-ref="qr-hint">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#qr_code_scanner"></use></svg>
                <span>${i18n.t('modal.scan_qr_desc')}</span>
              </div>
            </div>
          </div>

          <div class="modal-split__visual-stage is-hidden" data-ref="visual-stage-2">
            <img class="modal-split__illustration" data-ref="two-factor-shield-img" src="/images/modals/two-factor-backup-banner.svg" alt="BoardStack 2FA" />
          </div>
        </div>
      </div>
    </div>
  `;
}

export {
  renderDeleteAccountModalBody,
  renderDisable2FAModalBody,
  renderIdentityVerificationModalBody,
  renderMessageModalBody,
  renderNewPasswordModalBody,
  renderPromptModalBody,
  renderTwoFactorModalContent,
  renderVerifyEmailCodeModalBody,
  renderVerifyPasswordModalBody
};