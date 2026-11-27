import type { ConfirmModalOptions, ModalInstance, ModalOptions } from '../types/common.types.js';
import { hideElement, setupSheetDragToDismiss, showElement, toggleElement } from '../utils/dom.util.js';
import { i18n } from '../i18n/i18n.service.js';
import { postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { renderTwoFactorModalContent } from './modal-templates.js';
import { showToast } from '../services/toast.service.js';

let activeModals: ModalInstance[] = [];

function closeAllModals(): void {
  const modalsToClose = [...activeModals];
  for (const modal of modalsToClose) {
    modal.close();
  }
  activeModals = [];
}

function openModal(options: ModalOptions = {}): ModalInstance {
  let {
    bodyHtml = '',
    cancelText = i18n.t('common.cancel'),
    confirmClass = 'component-button--black',
    confirmText = i18n.t('common.confirm'),
    description = '',
    onCancel = null,
    onClose = null,
    onConfirm = null,
    showCancel = true,
    showConfirm = true,
    size = 'sm',
    title = '',
  } = options;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="${i18n.t('common.close')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--${size}" data-ref="modal-card">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="modal-card__header" data-ref="modal-header">
          <h2 class="modal-card__title" data-ref="modal-title">${title}</h2>
          ${description ? `<p class="modal-card__desc" data-ref="modal-desc">${description}</p>` : ''}
        </div>
        <div class="modal-card__body" data-ref="modal-body"></div>
        <div class="modal-card__footer" data-ref="modal-footer">
          <div class="component-banner component-banner--danger is-hidden" data-ref="modal-error"></div>
          <div class="modal-card__actions" data-ref="modal-actions">
            ${showCancel ? `<button type="button" class="component-button component-button--h34" data-ref="btn-modal-cancel">${cancelText}</button>` : ''}
            ${showConfirm ? `<button type="button" class="component-button component-button--h34 ${confirmClass}" data-ref="btn-modal-confirm">${confirmText}</button>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  const bodyContainer = backdrop.querySelector<HTMLElement>('[data-ref="modal-body"]');
  if (bodyContainer) {
    if (typeof bodyHtml === 'string') {
      bodyContainer.innerHTML = bodyHtml;
    } else if (bodyHtml instanceof HTMLElement) {
      bodyContainer.appendChild(bodyHtml);
    }
  }

  renderIcons(backdrop);

  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card"]');
  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const cancelBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-cancel"]');
  const confirmBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-modal-confirm"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="modal-error"]');
  const titleEl = backdrop.querySelector<HTMLElement>('[data-ref="modal-title"]');
  const descEl = backdrop.querySelector<HTMLElement>('[data-ref="modal-desc"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');

  let isClosing = false;

  const modalInstance: ModalInstance = {
    backdrop,
    body: bodyContainer || document.createElement('div'),
    btnCancel: cancelBtn as any,
    btnConfirm: confirmBtn,
    cancelBtn,
    card,
    clearError() {
      if (errorBanner) {
        errorBanner.textContent = '';
        hideElement(errorBanner);
      }
    },
    close() {
      if (isClosing) return;
      isClosing = true;

      backdrop.classList.remove('is-visible');
      document.removeEventListener('keydown', handleKeyDown);

      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        activeModals = activeModals.filter((m) => m !== modalInstance);
        if (activeModals.length === 0 && document.querySelectorAll('.modal-backdrop.is-visible').length === 0) {
          document.body.classList.remove('modal-open');
        }
        if (onClose) {
          onClose();
        }
      }, 200);
    },
    closeBtn,
    confirmBtn,
    errorBanner,
    setBody(newBody: HTMLElement | string) {
      if (!bodyContainer) return;
      if (typeof newBody === 'string') {
        bodyContainer.innerHTML = newBody;
      } else if (newBody instanceof HTMLElement) {
        bodyContainer.innerHTML = '';
        bodyContainer.appendChild(newBody);
      }
      renderIcons(bodyContainer);
    },
    setConfirmLoading(isLoading: boolean, loadingText = i18n.t('common.loading')) {
      if (!confirmBtn) return;
      if (isLoading) {
        confirmBtn.disabled = true;
        confirmBtn.setAttribute('data-original-text', confirmBtn.textContent || '');
        confirmBtn.textContent = loadingText;
      } else {
        confirmBtn.disabled = false;
        confirmBtn.textContent = confirmBtn.getAttribute('data-original-text') || confirmText;
      }
    },
    setConfirmText(newText: string) {
      confirmText = newText;
      if (confirmBtn) {
        confirmBtn.textContent = newText;
      }
    },
    setConfirmVisible(visible: boolean) {
      if (confirmBtn) {
        toggleElement(confirmBtn, visible);
      }
    },
    setDescription(newDesc: string) {
      if (descEl) {
        descEl.innerHTML = newDesc;
        showElement(descEl);
      }
    },
    setOnConfirm(fn: ((inst: ModalInstance) => boolean | Promise<boolean | void> | void) | null) {
      onConfirm = fn;
    },
    setTitle(newTitle: string) {
      if (titleEl) {
        titleEl.textContent = newTitle;
      }
    },
    showError(message: string) {
      if (errorBanner) {
        errorBanner.textContent = message;
        showElement(errorBanner);
      }
    },
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      modalInstance.close();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  closeBtn?.addEventListener('click', () => {
    modalInstance.close();
  });

  cancelBtn?.addEventListener('click', () => {
    if (onCancel) {
      onCancel(modalInstance);
    }
    modalInstance.close();
  });

  confirmBtn?.addEventListener('click', async () => {
    if (onConfirm) {
      const shouldClose = await onConfirm(modalInstance);
      if (shouldClose !== false) {
        modalInstance.close();
      }
    } else {
      modalInstance.close();
    }
  });

  backdrop.addEventListener('click', (e: MouseEvent) => {
    if (e.target === backdrop) {
      modalInstance.close();
    }
  });

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  activeModals.push(modalInstance);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    const firstInput = backdrop.querySelector<HTMLInputElement>('input:not([type="hidden"]), select, textarea');
    if (firstInput) {
      firstInput.focus();
    }
  });

  if (dragZone && card) {
    setupSheetDragToDismiss(dragZone, card, backdrop, () => modalInstance.close());
  }

  return modalInstance;
}

function openConfirmModal(options: ConfirmModalOptions = {}): ModalInstance {
  const {
    cancelText = i18n.t('common.cancel'),
    confirmClass = options.isDanger ? 'component-button--danger' : 'component-button--black',
    confirmText = i18n.t('common.confirm'),
    description = '',
    onCancel = null,
    onConfirm = null,
    title = i18n.t('modal.are_you_sure'),
  } = options;

  return openModal({
    cancelText,
    confirmClass,
    confirmText,
    description,
    onCancel,
    onConfirm,
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title,
  });
}

function openCustomModal(options: {
  backdropClass?: string;
  backdropRef?: string;
  contentHtml: string;
  onClose?: () => void;
}): ModalInstance {
  const {
    backdropClass = 'modal-backdrop',
    backdropRef = 'modal-backdrop',
    contentHtml,
    onClose = null,
  } = options;

  const backdrop = document.createElement('div');
  backdrop.className = backdropClass;
  backdrop.setAttribute('data-ref', backdropRef);
  backdrop.innerHTML = contentHtml;

  renderIcons(backdrop);

  const card = backdrop.querySelector<HTMLElement>('[data-ref*="modal-card"]') || backdrop.querySelector<HTMLElement>('.modal-card');
  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref*="drag-zone"]');
  const bodyContainer = backdrop.querySelector<HTMLElement>('[data-ref*="body"]') || card || backdrop;
  const confirmBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref*="confirm"], [data-ref*="submit"], [data-ref*="action"]');
  const cancelBtn = backdrop.querySelector<HTMLElement>('[data-ref*="cancel"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref*="error"]');

  let isClosing = false;

  const modalInstance: ModalInstance = {
    backdrop,
    body: bodyContainer,
    btnCancel: cancelBtn as any,
    btnConfirm: confirmBtn,
    cancelBtn,
    card,
    clearError() {
      if (errorBanner) {
        errorBanner.textContent = '';
        hideElement(errorBanner);
      }
    },
    close() {
      if (isClosing) return;
      isClosing = true;

      backdrop.classList.remove('is-visible');
      document.removeEventListener('keydown', handleKeyDown);

      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        activeModals = activeModals.filter((m) => m !== modalInstance);
        if (activeModals.length === 0 && document.querySelectorAll('.modal-backdrop.is-visible').length === 0) {
          document.body.classList.remove('modal-open');
        }
        if (onClose) {
          onClose();
        }
      }, 200);
    },
    closeBtn,
    confirmBtn,
    errorBanner,
    setBody(newBody: HTMLElement | string) {
      if (typeof newBody === 'string') {
        bodyContainer.innerHTML = newBody;
      } else if (newBody instanceof HTMLElement) {
        bodyContainer.innerHTML = '';
        bodyContainer.appendChild(newBody);
      }
      renderIcons(bodyContainer);
    },
    setConfirmLoading(isLoading: boolean, loadingText = i18n.t('common.loading')) {
      if (!confirmBtn) return;
      if (isLoading) {
        confirmBtn.disabled = true;
        confirmBtn.setAttribute('data-original-text', confirmBtn.textContent || '');
        confirmBtn.textContent = loadingText;
      } else {
        confirmBtn.disabled = false;
        confirmBtn.textContent = confirmBtn.getAttribute('data-original-text') || '';
      }
    },
    setConfirmText(newText: string) {
      if (confirmBtn) {
        confirmBtn.textContent = newText;
      }
    },
    setConfirmVisible(visible: boolean) {
      if (confirmBtn) {
        toggleElement(confirmBtn, visible);
      }
    },
    setDescription() {},
    setOnConfirm() {},
    setTitle() {},
    showError(message: string) {
      if (errorBanner) {
        errorBanner.textContent = message;
        showElement(errorBanner);
      }
    },
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      modalInstance.close();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  closeBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    modalInstance.close();
  });

  backdrop.addEventListener('click', (e: MouseEvent) => {
    if (e.target === backdrop) {
      e.preventDefault();
      modalInstance.close();
    }
  });

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  activeModals.push(modalInstance);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    const firstInput = backdrop.querySelector<HTMLInputElement>('input:not([type="hidden"]), select, textarea');
    if (firstInput) {
      firstInput.focus();
    }
  });

  if (dragZone && card) {
    setupSheetDragToDismiss(dragZone, card, backdrop, () => modalInstance.close());
  }

  return modalInstance;
}

let active2FAModal: any = null;

async function open2FAModal(options: { onClose?: () => void; onSuccess?: () => void } = {}): Promise<any> {
  const { onClose = null, onSuccess = null } = options;

  if (active2FAModal) {
    active2FAModal.close();
  }

  const modalInstance = openCustomModal({
    backdropRef: 'modal-2fa-backdrop',
    contentHtml: renderTwoFactorModalContent(),
    onClose: () => {
      if (active2FAModal === modalInstance) {
        active2FAModal = null;
      }
      if (onClose) onClose();
    },
  });

  active2FAModal = modalInstance;
  const backdrop = modalInstance.backdrop;

  const stage1Container = backdrop.querySelector<HTMLElement>('[data-ref="stage-1-container"]');
  const stage2Container = backdrop.querySelector<HTMLElement>('[data-ref="stage-2-container"]');
  const visualStage1 = backdrop.querySelector<HTMLElement>('[data-ref="visual-stage-1"]');
  const visualStage2 = backdrop.querySelector<HTMLElement>('[data-ref="visual-stage-2"]');
  const qrContainer = backdrop.querySelector<HTMLElement>('[data-ref="qr-container"]');
  const codeInput = backdrop.querySelector<HTMLInputElement>('[data-ref="input-modal-2fa-code"]');
  const continueBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-continue-2fa"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="modal-2fa-error"]');
  const toggleSecretBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-toggle-secret"]');
  const secretBox = backdrop.querySelector<HTMLElement>('[data-ref="box-secret-key"]');
  const secretValueEl = backdrop.querySelector<HTMLElement>('[data-ref="text-secret-value"]');
  const copySecretBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-copy-secret"]');
  const backupCodesGrid = backdrop.querySelector<HTMLElement>('[data-ref="backup-codes-grid"]');
  const copyBackupBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-copy-backup-codes"]');
  const finishBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-finish-2fa"]');

  let currentBackupCodes: string[] = [];

  const showError = (message: string) => {
    if (errorBanner) {
      errorBanner.textContent = message;
      showElement(errorBanner);
    }
  };

  const clearError = () => {
    if (errorBanner) {
      errorBanner.textContent = '';
      hideElement(errorBanner);
    }
  };

  const setButtonLoading = (btn: HTMLButtonElement | null, isLoading: boolean, loadingText = i18n.t('common.loading')) => {
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.setAttribute('data-original-text', btn.textContent || '');
      btn.textContent = loadingText;
    } else {
      btn.disabled = false;
      btn.textContent = btn.getAttribute('data-original-text') || i18n.t('common.confirm');
    }
  };

  toggleSecretBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    secretBox?.classList.toggle('is-hidden');
  });

  copySecretBtn?.addEventListener('click', async (e: MouseEvent) => {
    e.preventDefault();
    const secretText = secretValueEl?.textContent || '';
    if (secretText) {
      try {
        await navigator.clipboard.writeText(secretText);
        showToast(i18n.t('modal.key_copied'), 'success');
      } catch (_) {}
    }
  });

  copyBackupBtn?.addEventListener('click', async (e: MouseEvent) => {
    e.preventDefault();
    if (currentBackupCodes.length > 0) {
      const textToCopy = `BoardStack - ${i18n.t('modal.recovery_codes_title')}:\n\n${currentBackupCodes.join('\n')}\n\n${i18n.t('modal.recovery_codes_desc')}`;
      try {
        await navigator.clipboard.writeText(textToCopy);
        showToast(i18n.t('modal.codes_copied'), 'success');
      } catch (_) {}
    }
  });

  finishBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    modalInstance.close();
    if (onSuccess) {
      onSuccess();
    }
  });

  try {
    const res = await postApi('/api/settings/2fa/generate');
    if (!res.ok) {
      showError(res.error || i18n.t('common.error'));
      return modalInstance;
    }

    const { backupCodes, qrUri, secret } = res;
    currentBackupCodes = backupCodes || [];

    if (secretValueEl) {
      secretValueEl.textContent = secret;
    }

    if (qrContainer && qrUri) {
      qrContainer.innerHTML = '';
      void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
        const qrCode = new QRCodeStyling({
          backgroundOptions: { color: '#ffffff' },
          cornersDotOptions: { color: '#000000', type: 'dot' },
          cornersSquareOptions: { color: '#000000', type: 'extra-rounded' },
          dotsOptions: { color: '#000000', type: 'rounded' },
          height: 170,
          margin: 2,
          type: 'svg',
          width: 170,
          data: qrUri,
        });
        qrCode.append(qrContainer);
      }).catch(() => {
        qrContainer.innerHTML = `<div class="component-card__subtext" data-ref="qr-fallback-info">${i18n.t('auth.two_factor_manual_entry')}</div>`;
      });
    }

    codeInput?.focus();
  } catch (_) {
    showError(i18n.t('common.error'));
  }

  codeInput?.addEventListener('input', () => {
    if (codeInput) {
      codeInput.value = codeInput.value.replace(/[^\d\s-]/g, '').slice(0, 6);
    }
  });

  const handleVerifyStage1 = async () => {
    clearError();
    const rawCode = codeInput?.value || '';
    const code = rawCode.replace(/[\s-]+/g, '').trim();

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      showError(i18n.t('auth.enter_six_digit_code'));
      return;
    }

    setButtonLoading(continueBtn, true);

    try {
      const res = await postApi('/api/settings/2fa/enable', { code });
      if (!res.ok) {
        setButtonLoading(continueBtn, false);
        showError(res.error || i18n.t('auth.code_invalid_or_expired'));
        return;
      }

      if (res.backupCodes && Array.isArray(res.backupCodes)) {
        currentBackupCodes = res.backupCodes;
      }

      if (backupCodesGrid) {
        backupCodesGrid.innerHTML = '';
        currentBackupCodes.forEach((bCode) => {
          const badge = document.createElement('div');
          badge.className = 'code-badge';
          badge.setAttribute('data-ref', 'code-badge-item');
          badge.textContent = bCode;
          badge.title = i18n.t('common.copy');
          badge.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(bCode);
              showToast(i18n.t('modal.copied_code', { code: bCode }), 'success');
            } catch (_) {}
          });
          backupCodesGrid.appendChild(badge);
        });
      }

      if (stage1Container) hideElement(stage1Container);
      if (visualStage1) hideElement(visualStage1);
      if (stage2Container) showElement(stage2Container);
      if (visualStage2) showElement(visualStage2);

      showToast(i18n.t('settings.security.enable_2fa_success'), 'success');
    } catch (_) {
      setButtonLoading(continueBtn, false);
      showError(i18n.t('common.error'));
    }
  };

  continueBtn?.addEventListener('click', handleVerifyStage1);
  codeInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVerifyStage1();
    }
  });

  return modalInstance;
}

export {
  closeAllModals,
  open2FAModal,
  openConfirmModal,
  openCustomModal,
  openModal,
  setupSheetDragToDismiss
};