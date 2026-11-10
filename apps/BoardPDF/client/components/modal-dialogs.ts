import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ModalInstance } from '../types/common.types.js';
import { setupDropdown, setupPasswordToggle } from '../utils/dom.util.js';
import { openCollabPageSizeModal } from '../views/collaborative-pdf/collab-page-size-modal.util.js';
import type { CollabPageSizeModalOptions, CollabPageSizeResult } from '../views/collaborative-pdf/collab-page-size-modal.util.js';
import { renderAddWebUrlModalBody, renderCreateFolderModalBody, renderDeleteAccountModalBody, renderDisable2FAModalBody, renderMoveFolderOptionsModalBody, renderNewPasswordModalBody, renderRenameFolderModalBody, renderShareDownloadModalContent, renderThankYouShareModalBody, renderUnlockPdfModalBody, renderVerifyEmailCodeModalBody, renderVerifyPasswordModalBody } from './modal-templates.js';
import { openModal, setupSheetDragToDismiss } from './modal.component.js';

function getPasswordToggleTooltipOptions(): { hideTooltip: string; showTooltip: string } {
  return {
    hideTooltip: t('common.hide_password'),
    showTooltip: t('common.show_password'),
  };
}

function openCreateFolderModal(options: {
  onConfirm: (name: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const modal = openModal({
    bodyHtml: renderCreateFolderModalBody(),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('projects.modal_create_folder_btn'),
    description: t('projects.modal_create_folder_desc'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-folder-name"]');
      const name = (input?.value || '').trim();
      if (!name) {
        showToast(t('toasts.debes_ingresar_un_nombre_para_la_carpeta'), 'warning');
        return false;
      }
      return options.onConfirm(name, inst);
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_create_folder_title'),
  });

  setTimeout(() => {
    const input = modal.body.querySelector<HTMLInputElement>('[data-ref="input-folder-name"]');
    input?.focus();
  }, 100);

  return modal;
}

function openRenameFolderModal(options: {
  currentName: string;
  onConfirm: (newName: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const modal = openModal({
    bodyHtml: renderRenameFolderModalBody(options.currentName),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('projects.modal_rename_folder_btn'),
    description: t('projects.modal_rename_folder_desc'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-rename-name"]');
      const newName = (input?.value || '').trim();
      if (!newName) {
        showToast(t('toasts.name_cannot_be_empty'), 'warning');
        return false;
      }
      return options.onConfirm(newName, inst);
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_rename_folder_title'),
  });

  setTimeout(() => {
    const input = modal.body.querySelector<HTMLInputElement>('[data-ref="input-rename-name"]');
    input?.focus();
  }, 100);

  return modal;
}

function openDeleteFolderModal(options: {
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: t('projects.modal_delete_folder_btn'),
    description: t('projects.modal_delete_folder_desc'),
    onConfirm: options.onConfirm,
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_delete_folder_title'),
  });
}

function openMoveFolderDropdownModal(options: {
  activeFolderId: string | null;
  folders: Array<{ id: string; name: string }>;
  isUploads: boolean;
  onConfirm: (targetFolderId: string | null, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  let dropdownCtrl: { destroy: () => void } | null = null;

  const modal = openModal({
    bodyHtml: renderMoveFolderOptionsModalBody({
      activeFolderId: options.activeFolderId,
      folders: options.folders,
      isUploads: options.isUploads,
    }),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: t(options.isUploads ? 'projects.modal_move_upload_btn' : 'projects.modal_move_doc_btn'),
    description: t(options.isUploads ? 'projects.modal_move_upload_desc' : 'projects.modal_move_doc_desc'),
    onClose: () => {
      dropdownCtrl?.destroy();
    },
    onConfirm: async (inst) => {
      const wrapper = inst.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-move-folder"]');
      const rawId = wrapper?.getAttribute('data-selected-folder-id') || '';
      const targetId = rawId || null;
      return options.onConfirm(targetId, inst);
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t(options.isUploads ? 'projects.modal_move_upload_title' : 'projects.modal_move_doc_title'),
  });

  const wrapper = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-move-folder"]');
  const trigger = modal.body.querySelector<HTMLElement>('[data-ref="btn-trigger-move-folder"]');
  const backdrop = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-move-folder"]');
  const menu = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-menu-move-folder"]');
  const selectedTxt = modal.body.querySelector<HTMLElement>('[data-ref="txt-selected-move-folder"]');

  if (wrapper) {
    dropdownCtrl = setupDropdown(wrapper, {
      backdrop,
      menu,
      onSelect: (_val, item) => {
        if (!item) return;
        const selectedId = item.getAttribute('data-folder-id') ?? '';
        wrapper.setAttribute('data-selected-folder-id', selectedId);
        selectedTxt?.removeAttribute('data-i18n');
        const items = modal.body.querySelectorAll<HTMLElement>('[data-ref="move-folders-list"] .menu-item');
        items.forEach((it) => {
          const isMatch = it === item;
          it.classList.toggle('is-selected', isMatch);
          const checkIcon = it.querySelector<HTMLElement>('.menu-item__check');
          checkIcon?.classList.toggle('is-hidden', !isMatch);
        });
      },
      placement: 'bottom-start',
      trigger,
    });
  }

  return modal;
}

function openMoveDocModal(options: {
  activeFolderId: string | null;
  folders: Array<{ id: string; name: string }>;
  onConfirm: (targetFolderId: string | null, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openMoveFolderDropdownModal({
    ...options,
    isUploads: false,
  });
}

function openMoveUploadModal(options: {
  activeFolderId: string | null;
  folders: Array<{ id: string; name: string }>;
  onConfirm: (targetFolderId: string | null, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openMoveFolderDropdownModal({
    ...options,
    isUploads: true,
  });
}

function openDeleteUploadModal(options: {
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: t('projects.modal_delete_upload_btn'),
    description: t('projects.modal_delete_upload_desc'),
    onConfirm: options.onConfirm,
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_delete_upload_title'),
  });
}

function openDeleteDocModal(options: {
  docTitle: string;
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const desc = t('projects.modal_delete_doc_desc').replace('{title}', options.docTitle);

  return openModal({
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: t('common.delete'),
    description: desc,
    onConfirm: options.onConfirm,
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_delete_doc_title'),
  });
}

function openDeleteWorkflowModal(options: {
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
  workflowName: string;
}): ModalInstance {
  const desc = t('workflows.delete_modal_desc').replace('{name}', options.workflowName);

  return openModal({
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: t('workflows.delete_modal_btn'),
    description: desc,
    onConfirm: options.onConfirm,
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('workflows.delete_modal_title'),
  });
}

function openVerifyEmailCodeModal(options: {
  email: string;
  onConfirm: (code: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    bodyHtml: renderVerifyEmailCodeModalBody(),
    cancelText: t('common.cancel'),
    confirmText: t('common.continue'),
    description: t('settings.your_account.modal_email_verify_desc', { email: options.email }),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-email-code"]');
      const code = input?.value?.trim() || '';
      if (!code) {
        inst.showError(t('validation.code_required'));
        return false;
      }
      if (code.length !== 6 || !/^\d+$/.test(code)) {
        inst.showError(t('validation.code_invalid'));
        return false;
      }
      return options.onConfirm(code, inst);
    },
    size: 'sm',
    title: t('settings.your_account.modal_email_verify_title'),
  });
}

function openCancelSubscriptionModal(options: {
  dateFormatted: string;
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const desc = t('settings.billing.modal_cancel_sub_desc').replace('{date}', options.dateFormatted);

  return openModal({
    confirmClass: 'component-button--black',
    confirmText: t('settings.billing.btn_confirm_cancel_sub'),
    description: desc,
    onConfirm: options.onConfirm,
    size: 'sm',
    title: t('settings.billing.modal_cancel_sub_title'),
  });
}

function openVerifyPasswordModal(options: {
  onConfirm: (password: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const modal = openModal({
    bodyHtml: renderVerifyPasswordModalBody(),
    cancelText: t('common.cancel'),
    confirmText: t('common.continue'),
    description: t('settings.security.modal_verify_password_desc'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-modal-password"]');
      const password = input?.value || '';
      if (!password) {
        inst.showError(t('validation.password_required'));
        return false;
      }
      return options.onConfirm(password, inst);
    },
    size: 'sm',
    title: t('settings.security.modal_verify_password_title'),
  });

  const currentPassInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-password"]');
  const togglePassBtn = modal.body.querySelector<HTMLElement>('[data-ref="btn-toggle-modal-password"]');
  setupPasswordToggle(togglePassBtn, currentPassInput, getPasswordToggleTooltipOptions());

  return modal;
}

function setupNewPasswordModalStep(
  modal: ModalInstance,
  options: {
    onConfirm: (newPassword: string, inst: ModalInstance) => Promise<boolean | void>;
  }
): void {
  modal.setTitle(t('settings.security.modal_new_password_title'));
  modal.setDescription(t('settings.security.modal_new_password_desc'));
  modal.clearError();
  modal.setConfirmLoading(false);
  modal.setConfirmVisible(true);
  modal.setConfirmText(t('common.save'));
  modal.setBody(renderNewPasswordModalBody());

  const inputNewPass = modal.body.querySelector<HTMLInputElement>('[data-ref="input-new-password"]');
  const inputConfirmPass = modal.body.querySelector<HTMLInputElement>('[data-ref="input-confirm-password"]');
  const toggleNewPass = modal.body.querySelector<HTMLElement>('[data-ref="btn-toggle-new-password"]');
  const toggleConfirmPass = modal.body.querySelector<HTMLElement>('[data-ref="btn-toggle-confirm-password"]');
  const tooltipOpts = getPasswordToggleTooltipOptions();

  setupPasswordToggle(toggleNewPass, inputNewPass, tooltipOpts);
  setupPasswordToggle(toggleConfirmPass, inputConfirmPass, tooltipOpts);
  inputNewPass?.focus();

  modal.setOnConfirm(async (inst) => {
    const newPass = inputNewPass?.value || '';
    const confirmPass = inputConfirmPass?.value || '';

    if (!newPass || newPass.length < 8) {
      inst.showError(t('validation.password_min'));
      return false;
    }
    if (newPass !== confirmPass) {
      inst.showError(t('validation.passwords_not_match'));
      return false;
    }
    return options.onConfirm(newPass, inst);
  });
}

function openDisable2FAModal(options: {
  onConfirm: (credential: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    bodyHtml: renderDisable2FAModalBody(),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: t('settings.security.btn_disable_2fa'),
    description: t('settings.security.two_factor_disable_confirm'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-disable-2fa-code"]');
      const val = input ? input.value.trim() : '';
      if (!val) {
        inst.showError(t('settings.security.modal_current_password_error'));
        return false;
      }
      return options.onConfirm(val, inst);
    },
    size: 'sm',
    title: t('settings.security.two_factor_disable_title'),
  });
}

function openDeleteAccountModal(options: {
  onConfirm: (password: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const modal = openModal({
    bodyHtml: renderDeleteAccountModalBody(),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: t('settings.security.btn_delete_account'),
    description: t('settings.security.delete_account_modal_desc'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-delete-password"]');
      const password = input?.value?.trim() || '';
      if (!password) {
        inst.showError(t('settings.security.modal_current_password_error'));
        return false;
      }
      return options.onConfirm(password, inst);
    },
    size: 'sm',
    title: t('settings.security.delete_account_modal_title'),
  });

  const toggleBtn = modal.body.querySelector<HTMLElement>('[data-ref="btn-toggle-delete-password"]');
  const input = modal.body.querySelector<HTMLInputElement>('[data-ref="input-delete-password"]');
  setupPasswordToggle(toggleBtn, input, getPasswordToggleTooltipOptions());

  return modal;
}

function openUnlockPdfPasswordModal(options: {
  onConfirm: (password: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const modal = openModal({
    bodyHtml: renderUnlockPdfModalBody(),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('tools.unlock_pdf.unlock_btn'),
    description: t('tools.unlock_pdf.password_required_desc'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-unlock-password"]');
      const password = input?.value.trim() || '';
      if (!password) {
        inst.showError(t('tools.unlock_pdf.enter_password_required'));
        return false;
      }
      return options.onConfirm(password, inst);
    },
    size: 'sm',
    title: t('tools.unlock_pdf.password_required_title'),
  });

  const toggleBtn = modal.body.querySelector<HTMLElement>('[data-ref="btn-toggle-unlock-pwd"]');
  const input = modal.body.querySelector<HTMLInputElement>('[data-ref="input-unlock-password"]');
  setupPasswordToggle(toggleBtn, input, getPasswordToggleTooltipOptions());

  return modal;
}

function openAddWebUrlModal(options: {
  currentUrl?: string;
  onConfirm: (url: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    bodyHtml: renderAddWebUrlModalBody(options.currentUrl),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('tools.html_to_pdf.add_url_btn'),
    description: t('tools.html_to_pdf.add_url_desc'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-web-url"]');
      let raw = (input?.value || '').trim();
      if (!raw) {
        inst.showError(t('tools.html_to_pdf.url_required'));
        return false;
      }
      if (!/^https?:\/\//i.test(raw)) {
        raw = `https://${raw}`;
      }
      return options.onConfirm(raw, inst);
    },
    size: 'sm',
    title: t('tools.html_to_pdf.add_url_title'),
  });
}

function openShareDownloadModal(options: { downloadLink: string }): ModalInstance {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-share-backdrop');
  backdrop.innerHTML = renderShareDownloadModalContent(options.downloadLink);

  translateElement(backdrop);
  renderIcons(backdrop);

  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card-share"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref="modal-share-drag-zone"]');
  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const bottomCloseBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-close-share-modal"]');
  const inputEl = backdrop.querySelector<HTMLInputElement>('[data-ref="input-share-url"]');
  const copyBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-copy-url"]');
  const qrContainer = backdrop.querySelector<HTMLElement>('[data-ref="share-qr-container"]');

  let isClosing = false;
  let copyTimer: number | null = null;

  const close = () => {
    if (isClosing) return;
    isClosing = true;
    if (copyTimer !== null) {
      window.clearTimeout(copyTimer);
      copyTimer = null;
    }
    backdrop.classList.remove('is-visible');
    document.removeEventListener('keydown', handleKeyDown);

    setTimeout(() => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      if (document.querySelectorAll('.modal-backdrop.is-visible').length === 0) {
        document.body.classList.remove('modal-open');
      }
    }, 200);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  backdrop.addEventListener('click', (e: MouseEvent) => {
    if (e.target === backdrop) {
      close();
    }
  });

  closeBtn?.addEventListener('click', close);
  bottomCloseBtn?.addEventListener('click', close);
  inputEl?.addEventListener('click', () => inputEl.select());

  copyBtn?.addEventListener('click', async () => {
    const useEl = copyBtn.querySelector<SVGUseElement>('use');
    try {
      await navigator.clipboard.writeText(options.downloadLink);
      if (useEl) {
        useEl.setAttribute('href', '/icons.svg#check');
      }
      showToast(t('toasts.enlace_copiado_al_portapapeles'), 'success');
      if (copyTimer !== null) {
        window.clearTimeout(copyTimer);
      }
      copyTimer = window.setTimeout(() => {
        if (useEl) {
          useEl.setAttribute('href', '/icons.svg#content_copy');
        }
        copyTimer = null;
      }, 2000);
    } catch {
      inputEl?.select();
      showToast(t('toasts.copia_el_enlace_manualmente'), 'info');
    }
  });

  if (qrContainer) {
    void import('qr-code-styling')
      .then(({ default: QRCodeStyling }) => {
        const qr = new QRCodeStyling({
          backgroundOptions: { color: '#ffffff' },
          cornersDotOptions: { color: '#000000', type: 'dot' },
          cornersSquareOptions: { color: '#000000', type: 'extra-rounded' },
          data: options.downloadLink,
          dotsOptions: { color: '#000000', type: 'rounded' },
          height: 196,
          margin: 2,
          type: 'svg',
          width: 196,
        });
        qrContainer.innerHTML = '';
        qr.append(qrContainer);
      })
      .catch(() => {});
  }

  if (dragZone && card) {
    setupSheetDragToDismiss(dragZone, card, backdrop, close);
  }

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });

  return {
    backdrop,
    body: backdrop.querySelector<HTMLElement>('[data-ref="modal-split-bottom"]') || backdrop,
    btnCancel: null,
    btnConfirm: bottomCloseBtn,
    cancelBtn: null,
    card,
    clearError: () => {},
    close,
    closeBtn,
    confirmBtn: bottomCloseBtn,
    errorBanner: null,
    setBody: () => {},
    setConfirmLoading: () => {},
    setConfirmText: () => {},
    setConfirmVisible: () => {},
    setDescription: () => {},
    setOnConfirm: () => {},
    setTitle: () => {},
    showError: () => {},
  };
}

function openThankYouShareModal(options: { shareUrl: string }): ModalInstance {
  const modal = openModal({
    bodyHtml: renderThankYouShareModalBody(),
    cancelText: t('common.close'),
    confirmClass: 'component-button--black',
    confirmText: t('common.close'),
    description: t('download.thank_you_desc'),
    onConfirm: () => modal.close(),
    showCancel: false,
    showConfirm: true,
    size: 'sm',
    title: t('download.thank_you_title'),
  });

  renderIcons(modal.backdrop);

  const shareText = t('download.share_tweet_text');
  const encodedUrl = encodeURIComponent(options.shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const encodedWhatsapp = encodeURIComponent(`${shareText} ${options.shareUrl}`);

  modal.backdrop
    .querySelector<HTMLAnchorElement>('[data-ref="share-twitter"]')
    ?.setAttribute('href', `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`);
  modal.backdrop
    .querySelector<HTMLAnchorElement>('[data-ref="share-linkedin"]')
    ?.setAttribute('href', `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`);
  modal.backdrop
    .querySelector<HTMLAnchorElement>('[data-ref="share-facebook"]')
    ?.setAttribute('href', `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`);
  modal.backdrop
    .querySelector<HTMLAnchorElement>('[data-ref="share-whatsapp"]')
    ?.setAttribute('href', `https://wa.me/?text=${encodedWhatsapp}`);

  return modal;
}

export {
  openAddWebUrlModal,
  openCancelSubscriptionModal,
  openCollabPageSizeModal,
  openCreateFolderModal,
  openDeleteAccountModal,
  openDeleteDocModal,
  openDeleteFolderModal,
  openDeleteUploadModal,
  openDeleteWorkflowModal,
  openDisable2FAModal,
  openMoveDocModal,
  openMoveUploadModal,
  openRenameFolderModal,
  openShareDownloadModal,
  openThankYouShareModal,
  openUnlockPdfPasswordModal,
  openVerifyEmailCodeModal,
  openVerifyPasswordModal,
  setupNewPasswordModalStep,
};
export type { CollabPageSizeModalOptions, CollabPageSizeResult };
