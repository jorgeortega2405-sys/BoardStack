import { escapeHtml } from '../utils/dom.util.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';

interface DialogOptions {
  bodyHtml?: HTMLElement | string;
  cancelText?: string;
  confirmClass?: string;
  confirmDisabled?: boolean;
  confirmText?: string;
  description?: string;
  footerExtraHtml?: string;
  onClose?: () => void;
  onConfirm?: (instance: DialogInstance) => boolean | Promise<boolean | void> | void;
  showCancel?: boolean;
  showConfirm?: boolean;
  size?: 'lg' | 'md';
  title: string;
}

interface DialogInstance {
  backdrop: HTMLElement;
  body: HTMLElement;
  clearError: () => void;
  close: () => void;
  confirmBtn: HTMLButtonElement | null;
  setConfirmLoading: (isLoading: boolean, label?: string) => void;
  showError: (message: string) => void;
}

function openDialog(options: DialogOptions): DialogInstance {
  const {
    bodyHtml = '',
    cancelText = i18n.t('common.cancel'),
    confirmClass = 'component-button--black',
    confirmDisabled = false,
    confirmText = i18n.t('common.accept'),
    description = '',
    footerExtraHtml = '',
    onClose,
    onConfirm,
    showCancel = true,
    showConfirm = true,
    size = 'md',
    title,
  } = options;

  const backdrop = document.createElement('div');
  backdrop.className = 'component-dialog-backdrop';
  backdrop.setAttribute('data-ref', 'dialog-backdrop');

  backdrop.innerHTML = `
    <div class="component-dialog component-dialog--${size}" data-ref="dialog-card" role="dialog" aria-modal="true">
      <div class="component-dialog__header" data-ref="dialog-header">
        <div class="component-dialog__title-box">
          <h2 class="component-dialog__title" data-ref="dialog-title">${escapeHtml(title)}</h2>
          ${description ? `<p class="component-dialog__desc" data-ref="dialog-desc">${escapeHtml(description)}</p>` : ''}
        </div>
        <button type="button" class="component-button component-button--h34 component-button--icon-only component-dialog__close" data-ref="btn-dialog-close" aria-label="${escapeHtml(i18n.t('common.close'))}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="component-dialog__body" data-ref="dialog-body"></div>
      <div class="component-dialog__footer" data-ref="dialog-footer">
        <div class="component-banner component-banner--danger is-hidden" data-ref="dialog-error"></div>
        <div class="component-dialog__actions" data-ref="dialog-actions">
          ${footerExtraHtml ? `<div class="component-dialog__actions-extra" data-ref="dialog-actions-extra">${footerExtraHtml}</div>` : ''}
          <div class="component-dialog__actions-main">
            ${showCancel ? `<button type="button" class="component-button component-button--h36" data-ref="btn-dialog-cancel">${escapeHtml(cancelText)}</button>` : ''}
            ${showConfirm ? `<button type="button" class="component-button component-button--h36 ${confirmClass}" data-ref="btn-dialog-confirm" ${confirmDisabled ? 'disabled' : ''}>${escapeHtml(confirmText)}</button>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  const bodyEl = backdrop.querySelector<HTMLElement>('[data-ref="dialog-body"]') || document.createElement('div');
  if (typeof bodyHtml === 'string') {
    bodyEl.innerHTML = bodyHtml;
  } else if (bodyHtml instanceof HTMLElement) {
    bodyEl.appendChild(bodyHtml);
  }

  const closeBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-dialog-close"]');
  const cancelBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-dialog-cancel"]');
  const confirmBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-dialog-confirm"]');
  const errorEl = backdrop.querySelector<HTMLElement>('[data-ref="dialog-error"]');

  let isClosed = false;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      instance.close();
    }
  };

  const instance: DialogInstance = {
    backdrop,
    body: bodyEl,
    clearError: () => {
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('is-hidden');
      }
    },
    close: () => {
      if (isClosed) return;
      isClosed = true;
      backdrop.classList.remove('is-open');
      document.removeEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        backdrop.remove();
        onClose?.();
      }, 150);
    },
    confirmBtn,
    setConfirmLoading: (isLoading: boolean, label?: string) => {
      if (!confirmBtn) return;
      if (isLoading) {
        confirmBtn.disabled = true;
        if (!confirmBtn.hasAttribute('data-orig-text')) {
          confirmBtn.setAttribute('data-orig-text', confirmBtn.textContent || confirmText);
        }
        confirmBtn.textContent = label || i18n.t('common.loading');
      } else {
        confirmBtn.disabled = confirmDisabled;
        confirmBtn.textContent = confirmBtn.getAttribute('data-orig-text') || confirmText;
      }
    },
    showError: (message: string) => {
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('is-hidden');
      }
    },
  };

  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    instance.close();
  });

  cancelBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    instance.close();
  });

  confirmBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!onConfirm) {
      instance.close();
      return;
    }
    const result = await onConfirm(instance);
    if (result !== false) {
      instance.close();
    }
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      instance.close();
    }
  });

  document.addEventListener('keydown', handleKeyDown);
  document.body.appendChild(backdrop);
  renderIcons(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    const firstInput = backdrop.querySelector<HTMLElement>('input:not([type="hidden"]):not([readonly]), select, textarea');
    firstInput?.focus();
  });

  return instance;
}

export {
  openDialog
};

export type {
  DialogInstance,
  DialogOptions
};
