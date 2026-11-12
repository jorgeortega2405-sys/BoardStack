import { API_ROUTES } from '../config/api-routes.js';
import { getLocalizedPath } from '../config/seo.config.js';
import { ALL_TOOLS_LIMITS } from '../config/subscription-plans.config.js';
import { addFolderMemberApi, checkAuthSession, confirmTeamSeatUpgradeIntentApi, createTeamApi, currentUser, deleteApi, escapeHtml, getActiveWorkspaceTeam, getFolderMembersApi, hasSubscriptionFeature, inviteTeamMemberApi, postApi, previewTeamSeatsApi, putApi, removeFolderMemberApi, searchCurrentTeamMembersApi, updateFolderVisibilityApi, updateTeamSeatsApi } from '../services/api.service.js';
import { getCurrentLanguage, t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { getStripeAppearance, loadStripeSdk } from '../services/stripe.service.js';
import { showToast } from '../services/toast.service.js';
import { setActiveTeamId } from '../services/workspace.service.js';
import { DocumentLabel, LabelColorKey, ModalInstance } from '../types/common.types.js';
import { ProjectFolderMemberRecord, TeamDetailResponse, TeamMemberRecord, TeamSeatPreview } from '../types/team.types.js';
import { debounce, setupDropdown, setupPasswordToggle } from '../utils/dom.util.js';
import { getTierWeight, normalizeTier } from '../utils/tier.util.js';
import { openCollabPageSizeModal } from '../views/design-pdf/modals/design-pdf-page-size-modal.util.js';
import type { CollabPageSizeModalOptions, CollabPageSizeResult } from '../views/design-pdf/modals/design-pdf-page-size-modal.util.js';
import { renderAddWebUrlModalBody, renderAuthGateModalContent, renderCreateFolderModalBody, renderCreateTeamModalBody, renderDeleteAccountModalBody, renderDisable2FAModalBody, renderDocumentLabelsModalBody, renderInviteTeamMemberModalBody, renderManageTeamSeatsModalBody, renderMoveFolderOptionsModalBody, renderNewPasswordModalBody, renderProtectPdfModalBody, renderRenameFolderModalBody, renderShareDownloadModalContent, renderTeamFolderShareModalBody, renderThankYouShareModalBody, renderUnlockPdfModalBody, renderUpgradeLimitModalContent, renderVerifyEmailCodeModalBody, renderVerifyPasswordModalBody } from './modal-templates.js';
import { openCustomModal, openModal, setupSheetDragToDismiss } from './modal.component.js';

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
  description?: string;
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const desc = options.description || t('settings.billing.modal_cancel_sub_desc').replace('{date}', options.dateFormatted);

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

function openProtectPdfPasswordModal(options: {
  onConfirm: (password: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const modal = openModal({
    bodyHtml: renderProtectPdfModalBody(),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('tools.protect_pdf.protect_btn'),
    description: t('tools.protect_pdf.modal_desc'),
    onConfirm: async (inst) => {
      inst.clearError();
      const pwdInput = inst.body.querySelector<HTMLInputElement>('[data-ref="input-protect-password"]');
      const confirmInput = inst.body.querySelector<HTMLInputElement>('[data-ref="input-protect-confirm-password"]');
      const password = pwdInput?.value.trim() || '';
      const confirm = confirmInput?.value.trim() || '';

      if (!password) {
        inst.showError(t('tools.protect_pdf.password_required'));
        pwdInput?.focus();
        return false;
      }
      if (password !== confirm) {
        inst.showError(t('tools.protect_pdf.passwords_mismatch'));
        confirmInput?.focus();
        return false;
      }

      return options.onConfirm(password, inst);
    },
    size: 'sm',
    title: t('tools.protect_pdf.modal_title'),
  });

  const togglePwdBtn = modal.body.querySelector<HTMLElement>('[data-ref="btn-toggle-protect-password"]');
  const pwdInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-protect-password"]');
  const toggleConfirmBtn = modal.body.querySelector<HTMLElement>('[data-ref="btn-toggle-protect-confirm-password"]');
  const confirmInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-protect-confirm-password"]');

  setupPasswordToggle(togglePwdBtn, pwdInput, getPasswordToggleTooltipOptions());
  setupPasswordToggle(toggleConfirmBtn, confirmInput, getPasswordToggleTooltipOptions());

  const handleEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      modal.confirmBtn?.click();
    }
  };
  pwdInput?.addEventListener('keydown', handleEnter);
  confirmInput?.addEventListener('keydown', handleEnter);

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
          height: 170,
          margin: 2,
          type: 'svg',
          width: 170,
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
    body: backdrop.querySelector<HTMLElement>('[data-ref="modal-split-left"]') || backdrop,
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

function resolveLabelErrorText(code?: string, fallback?: string): string {
  switch (code) {
    case 'LABEL_LIMIT_REACHED':
      return t('toasts.label_limit_reached');
    case 'LABEL_NAME_DUPLICATE':
      return t('toasts.label_name_duplicate');
    case 'LABEL_NAME_REQUIRED':
      return t('toasts.label_name_required');
    case 'LABEL_NAME_TOO_LONG':
      return t('toasts.label_name_too_long');
    default:
      return fallback || t('toasts.generic_error');
  }
}

function openDocumentLabelsModal(options: {
  customCount: number;
  documentId: string;
  initialSelectedIds: number[];
  labels: DocumentLabel[];
  maxCustomLabels: number;
  onCatalogUpdated?: (labels: DocumentLabel[], customCount: number, maxCustomLabels: number, deletedLabelId?: number) => void;
  onSave: (updatedDocLabels: DocumentLabel[], labels: DocumentLabel[], customCount: number, maxCustomLabels: number) => void;
}): ModalInstance {
  let availableLabels = [...options.labels];
  let customCount = options.customCount;
  let maxCustomLabels = options.maxCustomLabels;
  let selectedColor: LabelColorKey = 'red';
  const selectedIds = new Set<number>(options.initialSelectedIds);
  let isMutating = false;

  const modal = openModal({
    bodyHtml: renderDocumentLabelsModalBody({
      customCount,
      labels: availableLabels,
      maxCustomLabels,
      selectedColor,
      selectedIds,
    }),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('projects.modal_labels_btn'),
    description: t('projects.modal_labels_desc'),
    onConfirm: async (inst) => {
      inst.clearError();
      try {
        const res = await putApi(API_ROUTES.collaborativeDocs.labels(options.documentId), {
          labelIds: Array.from(selectedIds),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          inst.showError(resolveLabelErrorText(data.code, data.error || t('toasts.label_save_error')));
          return false;
        }
        const savedLabels: DocumentLabel[] = Array.isArray(data.labels) ? data.labels : [];
        options.onSave(savedLabels, availableLabels, customCount, maxCustomLabels);
        showToast(t('toasts.document_labels_updated'), 'success');
        return true;
      } catch {
        inst.showError(t('toasts.network_error'));
        return false;
      }
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_labels_title'),
  });

  const showInlineError = (message: string): void => {
    const errEl = modal.body.querySelector<HTMLElement>('[data-ref="label-picker-error"]');
    if (!errEl) return;
    errEl.textContent = message;
    errEl.classList.remove('is-hidden');
  };

  const clearInlineError = (): void => {
    const errEl = modal.body.querySelector<HTMLElement>('[data-ref="label-picker-error"]');
    if (!errEl) return;
    errEl.textContent = '';
    errEl.classList.add('is-hidden');
  };

  const rerenderBody = (preserveInput = false): void => {
    const prevInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-new-label-name"]');
    const draftValue = preserveInput && prevInput ? prevInput.value : '';
    modal.setBody(
      renderDocumentLabelsModalBody({
        customCount,
        labels: availableLabels,
        maxCustomLabels,
        selectedColor,
        selectedIds,
      })
    );
    if (draftValue) {
      const nextInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-new-label-name"]');
      if (nextInput) {
        nextInput.value = draftValue;
      }
    }
  };

  const handleCreateCustomLabel = async (): Promise<void> => {
    if (isMutating) return;
    clearInlineError();

    const input = modal.body.querySelector<HTMLInputElement>('[data-ref="input-new-label-name"]');
    const name = (input?.value || '').trim();
    if (!name) {
      showInlineError(t('toasts.label_name_required'));
      input?.focus();
      return;
    }

    if (customCount >= maxCustomLabels) {
      showInlineError(t('toasts.label_limit_reached'));
      return;
    }

    isMutating = true;
    const createBtn = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-create-label"]');
    if (createBtn) createBtn.disabled = true;

    try {
      const res = await postApi(API_ROUTES.documentLabels.base, {
        color: selectedColor,
        name,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showInlineError(resolveLabelErrorText(data.code, data.error));
        return;
      }

      const created: DocumentLabel = data.label;
      availableLabels = [...availableLabels, created];
      customCount = typeof data.customCount === 'number' ? data.customCount : customCount + 1;
      maxCustomLabels = typeof data.maxCustomLabels === 'number' ? data.maxCustomLabels : maxCustomLabels;
      selectedIds.add(created.id);
      selectedColor = 'red';
      rerenderBody(false);
      options.onCatalogUpdated?.(availableLabels, customCount, maxCustomLabels);
      showToast(t('toasts.label_created'), 'success');
    } catch {
      showInlineError(t('toasts.network_error'));
    } finally {
      isMutating = false;
      const refreshedBtn = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-create-label"]');
      if (refreshedBtn) refreshedBtn.disabled = false;
    }
  };

  const handleDeleteCustomLabel = async (labelId: number): Promise<void> => {
    if (isMutating) return;
    clearInlineError();
    isMutating = true;

    try {
      const res = await deleteApi(API_ROUTES.documentLabels.byId(labelId));
      const data = await res.json();
      if (!res.ok || !data.success) {
        showInlineError(resolveLabelErrorText(data.code, data.error));
        return;
      }

      availableLabels = availableLabels.filter((l) => l.id !== labelId);
      selectedIds.delete(labelId);
      customCount = typeof data.customCount === 'number' ? data.customCount : availableLabels.filter((l) => !l.is_default).length;
      maxCustomLabels = typeof data.maxCustomLabels === 'number' ? data.maxCustomLabels : maxCustomLabels;
      rerenderBody(true);
      options.onCatalogUpdated?.(availableLabels, customCount, maxCustomLabels, labelId);
      showToast(t('toasts.label_deleted'), 'info');
    } catch {
      showInlineError(t('toasts.network_error'));
    } finally {
      isMutating = false;
    }
  };

  modal.body.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const swatchBtn = target.closest<HTMLElement>('[data-color]');
    if (swatchBtn) {
      const color = swatchBtn.getAttribute('data-color') as LabelColorKey | null;
      if (color) {
        selectedColor = color;
        modal.body.querySelectorAll<HTMLElement>('[data-color]').forEach((el) => {
          el.classList.toggle('is-selected', el.getAttribute('data-color') === color);
        });
      }
      return;
    }

    const deleteBtn = target.closest<HTMLElement>('[data-delete-label-id]');
    if (deleteBtn) {
      e.stopPropagation();
      const labelId = Number(deleteBtn.getAttribute('data-delete-label-id'));
      if (Number.isInteger(labelId) && labelId > 0) {
        void handleDeleteCustomLabel(labelId);
      }
      return;
    }

    const toggleBtn = target.closest<HTMLElement>('[data-label-id]');
    if (toggleBtn) {
      const labelId = Number(toggleBtn.getAttribute('data-label-id'));
      if (Number.isInteger(labelId) && labelId > 0) {
        if (selectedIds.has(labelId)) {
          selectedIds.delete(labelId);
        } else {
          selectedIds.add(labelId);
        }
        const isActive = selectedIds.has(labelId);
        const chip = toggleBtn.closest<HTMLElement>('.label-picker__chip');
        chip?.classList.toggle('is-selected', isActive);
        const checkIcon = toggleBtn.querySelector<HTMLElement>('.label-picker__chip-check');
        checkIcon?.classList.toggle('is-hidden', !isActive);
      }
      return;
    }

    const createBtn = target.closest<HTMLElement>('[data-ref="btn-create-label"]');
    if (createBtn) {
      void handleCreateCustomLabel();
    }
  });

  modal.body.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (e.key === 'Enter' && target.matches('[data-ref="input-new-label-name"]')) {
      e.preventDefault();
      void handleCreateCustomLabel();
    }
  });

  return modal;
}

function openCreateTeamModal(options: { initialSeats?: number; onCreated?: () => void } = {}): ModalInstance | null {
  const user = currentUser;
  if (!user) {
    showToast(t('pricing.login_required'), 'info');
    navigate('/login');
    return null;
  }

  const hasBusinessEntitlement = hasSubscriptionFeature('business');
  const ownsActiveTeam = Array.isArray(user.teams)
    && user.teams.some((team) => Number(team.owner_id) === Number(user.id) && team.subscription_status === 'active');
  const canCreateFirstFreeTeam = hasBusinessEntitlement && !ownsActiveTeam;

  let seats = Math.max(1, Math.min(50, Math.floor(Number(options.initialSeats) || (canCreateFirstFreeTeam ? 1 : 2))));

  const hintText = canCreateFirstFreeTeam
    ? t('teams.create_modal.business_free_hint')
    : t('teams.create_modal.upgrade_hint');

  const getConfirmText = (count: number): string => {
    if (canCreateFirstFreeTeam && count === 1) {
      return t('teams.create_modal.btn_create_free');
    }
    return t('teams.create_modal.btn_continue_checkout', { seats: count });
  };

  const modal = openModal({
    bodyHtml: renderCreateTeamModalBody({ canCreateFirstFreeTeam, hintText, seats }),
    cancelText: t('teams.create_modal.btn_cancel'),
    confirmClass: 'component-button--black',
    confirmText: getConfirmText(seats),
    description: t('teams.create_modal.subtitle'),
    onConfirm: async (inst) => {
      inst.clearError();
      const nameInput = inst.body.querySelector<HTMLInputElement>('[data-ref="input-create-team-name"]');
      const name = (nameInput?.value || '').trim();
      if (name.length < 2) {
        inst.showError(t('checkout.team_name_required'));
        nameInput?.focus();
        return false;
      }

      if (canCreateFirstFreeTeam && seats === 1) {
        inst.setConfirmLoading(true);
        const res = await createTeamApi(name);
        if (res.success && res.team) {
          setActiveTeamId(res.team.id);
          await checkAuthSession();
          inst.close();
          showToast(t('checkout.success_team_ready', { seats: res.team.seat_limit || 1, team: res.team.name }), 'success');
          if (typeof options.onCreated === 'function') {
            options.onCreated();
          }
          navigate('/settings/team');
          return true;
        }
        inst.setConfirmLoading(false);
        inst.showError(res.error || t('teams.errors.create_team'));
        return false;
      }

      inst.close();
      const params = new URLSearchParams({
        cycle: 'monthly',
        flow: 'create-team',
        plan: 'business',
        seats: String(seats),
        teamName: name,
      });
      navigate(`/checkout?${params.toString()}`);
      return true;
    },
    showCancel: true,
    showConfirm: true,
    size: 'md',
    title: t('teams.create_modal.title'),
  });

  const seatsInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-create-team-seats"]');
  const seatsBadge = modal.body.querySelector<HTMLElement>('[data-ref="team-create-seats-badge"]');
  const btnDec = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-dec"]');
  const btnInc = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-inc"]');
  const nameInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-create-team-name"]');

  const syncSeatsUI = (nextVal: number) => {
    seats = Math.max(1, Math.min(50, Math.floor(Number(nextVal) || 1)));
    if (seatsInput) seatsInput.value = String(seats);
    if (seatsBadge) {
      seatsBadge.textContent = seats === 1
        ? t('checkout.seats_count_singular')
        : t('checkout.seats_count_plural', { count: seats });
    }
    if (modal.btnConfirm) {
      modal.btnConfirm.textContent = getConfirmText(seats);
    }
    if (btnDec) btnDec.disabled = seats <= 1;
    if (btnInc) btnInc.disabled = seats >= 50;
  };

  syncSeatsUI(seats);
  renderIcons(modal.backdrop);

  btnDec?.addEventListener('click', (e) => {
    e.preventDefault();
    syncSeatsUI(seats - 1);
  });

  btnInc?.addEventListener('click', (e) => {
    e.preventDefault();
    syncSeatsUI(seats + 1);
  });

  seatsInput?.addEventListener('change', () => {
    syncSeatsUI(Number(seatsInput.value));
  });

  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      modal.btnConfirm?.click();
    }
  });

  setTimeout(() => {
    nameInput?.focus();
  }, 100);

  return modal;
}

function openInviteTeamMemberModal(options: {
  onInvited?: (result: { inviteUrl?: string }) => void | Promise<void>;
} = {}): ModalInstance | null {
  let selectedRole: 'admin' | 'member' = 'member';
  let dropdownCtrl: { destroy: () => void } | null = null;
  const activeTeam = getActiveWorkspaceTeam();
  const canAssignAdmin = Boolean(
    activeTeam &&
    currentUser &&
    Number(activeTeam.owner_id) === Number(currentUser.id) &&
    activeTeam.permissions.includes('team:members:invite')
  );

  const modal = openModal({
    bodyHtml: renderInviteTeamMemberModalBody(canAssignAdmin),
    cancelText: t('settings.team.btn_cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('settings.team.invite_modal_submit'),
    description: t('settings.team.invite_modal_desc'),
    onClose: () => {
      dropdownCtrl?.destroy();
      dropdownCtrl = null;
    },
    onConfirm: async (inst) => {
      inst.clearError();
      const emailInput = inst.body.querySelector<HTMLInputElement>('[data-ref="input-modal-invite-email"]');
      const email = (emailInput?.value || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        inst.showError(t('settings.team.validation_email_required'));
        emailInput?.focus();
        return false;
      }

      const safeRole: 'admin' | 'member' = canAssignAdmin && selectedRole === 'admin' ? 'admin' : 'member';
      inst.setConfirmLoading(true);
      const res = await inviteTeamMemberApi(email, safeRole);
      if (!res.success) {
        inst.setConfirmLoading(false);
        inst.showError(res.error || t('teams.errors.invite_member'));
        return false;
      }

      await checkAuthSession();
      if (res.inviteUrl) {
        try {
          await navigator.clipboard?.writeText(res.inviteUrl);
        } catch {}
      }
      if (typeof options.onInvited === 'function') {
        await options.onInvited({ inviteUrl: res.inviteUrl });
      }
      inst.close();
      showToast(t('settings.team.toast_invite_sent'), 'success');
      return true;
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('settings.team.invite_modal_title'),
  });

  renderIcons(modal.body);

  const wrapper = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-invite-role"]');
  const trigger = modal.body.querySelector<HTMLElement>('[data-ref="btn-trigger-invite-role"]');
  const backdrop = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-invite-role"]');
  const menu = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-menu-invite-role"]');
  const roleDescEl = modal.body.querySelector<HTMLElement>('[data-ref="invite-role-desc"]');
  const emailInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-invite-email"]');

  if (wrapper) {
    dropdownCtrl = setupDropdown(wrapper, {
      backdrop,
      isSelect: true,
      menu,
      onSelect: (val, item) => {
        selectedRole = canAssignAdmin && val === 'admin' ? 'admin' : 'member';
        if (roleDescEl) {
          roleDescEl.textContent = selectedRole === 'admin'
            ? t('settings.team.invite_role_admin_desc')
            : t('settings.team.invite_role_member_desc');
        }
        const items = modal.body.querySelectorAll<HTMLElement>('[data-ref="invite-roles-list"] .menu-item');
        items.forEach((it) => {
          const isMatch = it === item;
          it.classList.toggle('is-selected', isMatch);
          it.querySelector<HTMLElement>('.menu-item__check')?.classList.toggle('is-hidden', !isMatch);
        });
      },
      placement: 'bottom-start',
      trigger,
    });
  }

  emailInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      modal.confirmBtn?.click();
    }
  });

  setTimeout(() => emailInput?.focus(), 60);

  return modal;
}

function openSeatPaymentModal(options: {
  amountCharged: number;
  clientSecret: string;
  onUpdated?: () => void | Promise<void>;
  paymentIntentId: string;
  publishableKey: string;
  seats: number;
}): ModalInstance {
  let stripeInstance: any = null;
  let elementsInstance: any = null;
  let paymentElement: any = null;

  const bodyHtml = `<div class="team-seat-payment-mount" data-ref="team-seat-payment-mount"></div>`;
  const formattedAmount = options.amountCharged.toFixed(2);

  const modal = openModal({
    bodyHtml,
    cancelText: t('settings.team.btn_cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('settings.team.btn_confirm_seat_payment', { amount: formattedAmount }),
    description: t('settings.team.seats_upgrade_modal_desc', {
      amount: formattedAmount,
      seats: options.seats,
    }),
    onClose: () => {
      try {
        paymentElement?.destroy?.();
      } catch {}
    },
    onConfirm: async (inst) => {
      inst.clearError();
      if (!stripeInstance || !elementsInstance) {
        inst.showError(t('teams.errors.confirm_seats'));
        return false;
      }

      inst.setConfirmLoading(true);
      const { error, paymentIntent } = await stripeInstance.confirmPayment({
        confirmParams: {
          return_url: window.location.href,
        },
        elements: elementsInstance,
        redirect: 'if_required',
      });

      if (error) {
        inst.setConfirmLoading(false);
        inst.showError(error.message || t('teams.errors.confirm_seats'));
        return false;
      }

      if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
        const confirmRes = await confirmTeamSeatUpgradeIntentApi(paymentIntent.id || options.paymentIntentId);
        if (!confirmRes.success) {
          inst.setConfirmLoading(false);
          inst.showError(confirmRes.error || t('teams.errors.confirm_seats'));
          return false;
        }
        await checkAuthSession();
        if (typeof options.onUpdated === 'function') {
          await options.onUpdated();
        }
        inst.close();
        showToast(t('settings.team.toast_seats_updated'), 'success');
        return true;
      }

      inst.setConfirmLoading(false);
      inst.showError(t('teams.errors.confirm_seats'));
      return false;
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('settings.team.seats_upgrade_modal_title'),
  });

  const mountTarget = modal.body.querySelector<HTMLElement>('[data-ref="team-seat-payment-mount"]');
  if (mountTarget) {
    void (async () => {
      try {
        stripeInstance = await loadStripeSdk(options.publishableKey);
        elementsInstance = stripeInstance.elements({
          appearance: getStripeAppearance(),
          clientSecret: options.clientSecret,
        });
        paymentElement = elementsInstance.create('payment', { layout: 'tabs' });
        paymentElement.mount(mountTarget);
      } catch {
        modal.showError(t('teams.errors.confirm_seats'));
      }
    })();
  }

  return modal;
}

const MAX_SEATS = 100;

function openManageTeamSeatsModal(options: {
  detail: TeamDetailResponse;
  onUpdated?: () => void | Promise<void>;
}): ModalInstance {
  const { detail } = options;
  const minSeats = Math.max(1, detail.seatsUsed + detail.pendingCount);
  const currentLimit = Math.max(minSeats, Number(detail.seatLimit || detail.team.seat_limit || 1));
  const requiresPassword = currentUser?.has_password !== false;
  let seatDraft = currentLimit;
  let isClosed = false;
  let lastPreview: TeamSeatPreview | null = null;
  let confirmedChecked = false;
  let useNewCard = false;

  const minHint = t('settings.team.seats_modal_min_hint', {
    active: detail.seatsUsed,
    min: minSeats,
    pending: detail.pendingCount,
  });

  const securityFieldHtml = requiresPassword
    ? `
      <label class="field" data-ref="field-seats-password">
        <input class="field__input field__input--has-action" data-ref="input-seats-password" type="password" placeholder=" " autocomplete="current-password" />
        <span class="field__label">${escapeHtml(t('settings.team.seats_security_password_label'))}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-seats-password" data-tooltip="${escapeHtml(t('common.show_password'))}" aria-label="${escapeHtml(t('auth.login.toggle_password'))}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
    `
    : `
      <p class="team-seats-field__hint" data-ref="seats-security-email-hint">${escapeHtml(t('settings.team.seats_security_email_hint', { email: currentUser?.email || '' }))}</p>
      <label class="field" data-ref="field-seats-email">
        <input class="field__input" data-ref="input-seats-email" type="email" placeholder=" " autocomplete="email" />
        <span class="field__label">${escapeHtml(t('settings.team.seats_security_email_label'))}</span>
      </label>
    `;

  const bodyHtml = renderManageTeamSeatsModalBody({
    maxSeats: MAX_SEATS,
    minHint,
    minSeats,
    seatDraft,
    securityFieldHtml,
  });

  const modal = openModal({
    bodyHtml,
    cancelText: t('settings.team.btn_cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('settings.team.btn_update_seats'),
    description: t('settings.team.seats_modal_desc'),
    onClose: () => {
      isClosed = true;
    },
    onConfirm: async (inst) => {
      inst.clearError();
      if (seatDraft === currentLimit) {
        return false;
      }

      if (!confirmedChecked) {
        inst.showError(t('settings.team.validation_confirm_required'));
        return false;
      }

      const passwordVal = (passwordInput?.value || '').trim();
      const emailVal = (emailInput?.value || '').trim().toLowerCase();
      if (requiresPassword) {
        if (!passwordVal) {
          inst.showError(t('settings.team.validation_password_required'));
          passwordInput?.focus();
          return false;
        }
      } else {
        const expectedEmail = (currentUser?.email || '').trim().toLowerCase();
        if (!emailVal || (expectedEmail && emailVal !== expectedEmail)) {
          inst.showError(t('settings.team.validation_email_confirm_required'));
          emailInput?.focus();
          return false;
        }
      }

      inst.setConfirmLoading(true);
      const res = await updateTeamSeatsApi({
        confirmed: true,
        ...(requiresPassword ? { currentPassword: passwordVal } : { verificationEmail: emailVal }),
        seats: seatDraft,
        useNewCard: seatDraft > currentLimit && useNewCard,
      });
      if (isClosed) return false;

      if (!res.success) {
        inst.setConfirmLoading(false);
        inst.showError(res.error || t('teams.errors.update_seats'));
        syncControls();
        return false;
      }

      if (res.requiresPaymentAction && res.clientSecret && res.publishableKey && res.paymentIntentId) {
        inst.close();
        openSeatPaymentModal({
          amountCharged: Number(res.amountCharged || 0),
          clientSecret: res.clientSecret,
          onUpdated: options.onUpdated,
          paymentIntentId: res.paymentIntentId,
          publishableKey: res.publishableKey,
          seats: seatDraft,
        });
        return true;
      }

      await checkAuthSession();
      if (typeof options.onUpdated === 'function') {
        await options.onUpdated();
      }
      inst.close();
      showToast(t('settings.team.toast_seats_updated'), 'success');
      return true;
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('settings.team.seats_modal_title'),
  });

  renderIcons(modal.body);

  const btnDec = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-dec"]');
  const btnInc = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-inc"]');
  const inputSeats = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-seats"]');
  const previewBanner = modal.body.querySelector<HTMLElement>('[data-ref="modal-seats-preview-banner"]');
  const paymentBox = modal.body.querySelector<HTMLElement>('[data-ref="modal-seats-payment-box"]');
  const securityBox = modal.body.querySelector<HTMLElement>('[data-ref="modal-seats-security-box"]');
  const confirmCheckbox = modal.body.querySelector<HTMLInputElement>('[data-ref="checkbox-seats-confirm"]');
  const passwordInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-seats-password"]');
  const btnTogglePassword = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-seats-password"]');
  const emailInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-seats-email"]');

  setupPasswordToggle(btnTogglePassword, passwordInput, {
    hideTooltip: t('common.hide_password'),
    showTooltip: t('common.show_password'),
  });

  const renderPaymentBox = () => {
    if (!paymentBox) return;
    if (seatDraft <= currentLimit || !lastPreview) {
      paymentBox.classList.add('is-hidden');
      paymentBox.innerHTML = '';
      return;
    }

    if (lastPreview.isOneTime) {
      paymentBox.innerHTML = `<p class="team-seats-field__hint" data-ref="seats-one-time-note">${escapeHtml(t('settings.team.seats_payment_one_time_card_note'))}</p>`;
      paymentBox.classList.remove('is-hidden');
      return;
    }

    if (lastPreview.defaultPaymentMethod) {
      const pm = lastPreview.defaultPaymentMethod;
      const brandLabel = (pm.brand || 'CARD').toUpperCase();
      const expiryHtml = pm.expMonth && pm.expYear
        ? `<span class="team-seats-payment__card-exp">${escapeHtml(t('settings.team.seats_payment_card_expires', {
            month: String(pm.expMonth).padStart(2, '0'),
            year: String(pm.expYear).slice(-2),
          }))}</span>`
        : '';

      paymentBox.innerHTML = `
        <div class="team-seats-payment__title">${escapeHtml(t('settings.team.seats_payment_card_title'))}</div>
        <div class="team-seats-payment__card" data-ref="seats-default-card-row">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#credit_card"></use></svg>
          <div class="team-seats-payment__card-info">
            <span class="team-seats-payment__card-brand">${escapeHtml(t('settings.team.seats_payment_card_masked', { brand: brandLabel, last4: pm.last4 }))}</span>
            ${expiryHtml}
          </div>
        </div>
        <label class="team-confirm-check" data-ref="label-seats-use-new-card">
          <input class="component-checkbox" data-ref="checkbox-seats-use-new-card" type="checkbox" ${useNewCard ? 'checked' : ''} />
          <span class="team-confirm-check__text">${escapeHtml(t('settings.team.seats_payment_use_new_card'))}</span>
        </label>
      `;
      renderIcons(paymentBox);
      paymentBox.classList.remove('is-hidden');
      return;
    }

    paymentBox.innerHTML = `<p class="team-seats-field__hint" data-ref="seats-no-card-note">${escapeHtml(t('settings.team.seats_payment_no_card'))}</p>`;
    paymentBox.classList.remove('is-hidden');
  };

  const syncControls = () => {
    const hasSeatChange = seatDraft !== currentLimit;
    if (inputSeats) inputSeats.value = String(seatDraft);
    if (btnDec) btnDec.disabled = seatDraft <= minSeats;
    if (btnInc) btnInc.disabled = seatDraft >= MAX_SEATS;
    if (!hasSeatChange) {
      useNewCard = false;
    }

    securityBox?.classList.toggle('is-hidden', !hasSeatChange);
    renderPaymentBox();

    const hasCred = requiresPassword
      ? Boolean((passwordInput?.value || '').trim())
      : Boolean((emailInput?.value || '').trim());

    if (modal.confirmBtn) {
      modal.confirmBtn.disabled = !hasSeatChange || !confirmedChecked || !hasCred;
    }
  };

  const refreshPreview = debounce(async () => {
    if (isClosed) return;
    const requested = seatDraft;
    if (requested === currentLimit) {
      previewBanner?.classList.add('is-hidden');
      renderPaymentBox();
      return;
    }

    const res = await previewTeamSeatsApi(requested);
    if (isClosed || requested !== seatDraft) return;

    if (!res.success || !res.preview) {
      previewBanner?.classList.add('is-hidden');
      modal.showError(res.error || t('teams.errors.preview_seats'));
      return;
    }

    modal.clearError();
    const p = res.preview;
    lastPreview = p;
    const formattedAmount = Number(p.amountDueNow || 0).toFixed(2);
    const formattedNext = Number(p.nextCycleAmount || 0).toFixed(2);

    if (previewBanner) {
      if (p.newSeats < p.currentSeats) {
        previewBanner.textContent = t('settings.team.seats_preview_reduce', {
          newSeats: p.newSeats,
          nextCycleAmount: formattedNext,
        });
      } else if (p.isOneTime) {
        previewBanner.textContent = t('settings.team.seats_preview_one_time', {
          amount: formattedAmount,
        });
      } else {
        previewBanner.textContent = t('settings.team.seats_preview_charge_now', {
          amount: formattedAmount,
          nextCycleAmount: formattedNext,
        });
      }
      previewBanner.classList.remove('is-hidden');
    }
    renderPaymentBox();
  }, 240);

  const loadBaselinePreview = async () => {
    const res = await previewTeamSeatsApi(currentLimit);
    if (isClosed || !res.success || !res.preview) return;
    lastPreview = res.preview;
    if (seatDraft !== currentLimit) {
      renderPaymentBox();
    }
  };

  const adjustDraft = (target: number) => {
    const clamped = Math.max(minSeats, Math.min(MAX_SEATS, Math.floor(target)));
    seatDraft = clamped;
    modal.clearError();
    syncControls();
    if (clamped === currentLimit) {
      previewBanner?.classList.add('is-hidden');
      return;
    }
    refreshPreview();
  };

  btnDec?.addEventListener('click', () => adjustDraft(seatDraft - 1));
  btnInc?.addEventListener('click', () => adjustDraft(seatDraft + 1));
  inputSeats?.addEventListener('input', () => {
    const parsed = Number(inputSeats.value);
    if (Number.isFinite(parsed)) {
      adjustDraft(parsed);
    }
  });

  paymentBox?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement | null;
    if (target?.getAttribute('data-ref') === 'checkbox-seats-use-new-card') {
      useNewCard = Boolean(target.checked);
    }
  });

  confirmCheckbox?.addEventListener('change', () => {
    confirmedChecked = Boolean(confirmCheckbox.checked);
    modal.clearError();
    syncControls();
  });

  const handleCredInput = () => {
    modal.clearError();
    syncControls();
  };

  const handleCredKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && modal.confirmBtn && !modal.confirmBtn.disabled) {
      e.preventDefault();
      modal.confirmBtn.click();
    }
  };

  passwordInput?.addEventListener('input', handleCredInput);
  passwordInput?.addEventListener('keydown', handleCredKeydown);
  emailInput?.addEventListener('input', handleCredInput);
  emailInput?.addEventListener('keydown', handleCredKeydown);

  syncControls();
  void loadBaselinePreview();
  return modal;
}

function openTeamFolderShareModal(options: {
  folderId: string;
  folderName: string;
  onUpdated?: () => void;
}): ModalInstance {
  let visibility: 'restricted' | 'team' = 'team';
  let canManage = false;
  let members: ProjectFolderMemberRecord[] = [];
  let selectedRole: 'editor' | 'viewer' = 'editor';

  const modal = openModal({
    bodyHtml: renderTeamFolderShareModalBody(),
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

type AuthGateFeature =
  | 'ai_bg_remove'
  | 'ai_designer'
  | 'ai_tools'
  | 'cloud_uploads'
  | 'collaborative_share'
  | 'generic'
  | 'labels';

interface AuthGateModalOptions {
  descKey?: string;
  featureKey?: AuthGateFeature;
  onClose?: () => void;
  returnUrl?: string;
  titleKey?: string;
}

let activeAuthGateModal: ModalInstance | null = null;

function getAuthGateFeatureConfig(featureKey: AuthGateFeature = 'generic') {
  switch (featureKey) {
    case 'ai_tools':
      return {
        descKey: 'auth_gate.ai_tools_desc',
        feat1Key: 'auth_gate.benefit_ai',
        feat2Key: 'auth_gate.benefit_cloud',
        feat3Key: 'auth_gate.benefit_free',
        pillTextKey: 'auth_gate.pill_free_account',
        titleKey: 'auth_gate.ai_tools_title',
      };
    case 'ai_designer':
      return {
        descKey: 'auth_gate.ai_designer_desc',
        feat1Key: 'auth_gate.benefit_ai',
        feat2Key: 'auth_gate.benefit_cloud',
        feat3Key: 'auth_gate.benefit_free',
        pillTextKey: 'auth_gate.pill_free_account',
        titleKey: 'auth_gate.ai_designer_title',
      };
    case 'ai_bg_remove':
      return {
        descKey: 'auth_gate.ai_bg_remove_desc',
        feat1Key: 'auth_gate.benefit_ai',
        feat2Key: 'auth_gate.benefit_cloud',
        feat3Key: 'auth_gate.benefit_free',
        pillTextKey: 'auth_gate.pill_free_account',
        titleKey: 'auth_gate.ai_bg_remove_title',
      };
    case 'labels':
      return {
        descKey: 'auth_gate.labels_desc',
        feat1Key: 'auth_gate.benefit_labels',
        feat2Key: 'auth_gate.benefit_cloud',
        feat3Key: 'auth_gate.benefit_free',
        pillTextKey: 'auth_gate.pill_free_account',
        titleKey: 'auth_gate.labels_title',
      };
    case 'cloud_uploads':
      return {
        descKey: 'auth_gate.cloud_uploads_desc',
        feat1Key: 'auth_gate.benefit_storage',
        feat2Key: 'auth_gate.benefit_cloud',
        feat3Key: 'auth_gate.benefit_free',
        pillTextKey: 'auth_gate.pill_free_account',
        titleKey: 'auth_gate.cloud_uploads_title',
      };
    case 'collaborative_share':
      return {
        descKey: 'auth_gate.collaborative_share_desc',
        feat1Key: 'auth_gate.benefit_collab',
        feat2Key: 'auth_gate.benefit_cloud',
        feat3Key: 'auth_gate.benefit_free',
        pillTextKey: 'auth_gate.pill_free_account',
        titleKey: 'auth_gate.collaborative_share_title',
      };
    case 'generic':
    default:
      return {
        descKey: 'auth_gate.generic_desc',
        feat1Key: 'auth_gate.benefit_cloud',
        feat2Key: 'auth_gate.benefit_ai',
        feat3Key: 'auth_gate.benefit_free',
        pillTextKey: 'auth_gate.pill_free_account',
        titleKey: 'auth_gate.generic_title',
      };
  }
}

function showAuthGateModal(options: AuthGateModalOptions = {}): ModalInstance {
  if (activeAuthGateModal) {
    activeAuthGateModal.close();
  }

  const {
    descKey: customDescKey,
    featureKey = 'generic',
    onClose,
    returnUrl = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/',
    titleKey: customTitleKey,
  } = options;

  const config = getAuthGateFeatureConfig(featureKey);
  const contentHtml = renderAuthGateModalContent({
    desc: t(customDescKey || config.descKey),
    feat1: t(config.feat1Key),
    feat2: t(config.feat2Key),
    feat3: t(config.feat3Key),
    pillText: t(config.pillTextKey),
    returnUrl,
    title: t(customTitleKey || config.titleKey),
  });

  const modalInstance = openCustomModal({
    backdropRef: 'modal-auth-gate-backdrop',
    contentHtml,
    onClose: () => {
      if (activeAuthGateModal === modalInstance) {
        activeAuthGateModal = null;
      }
      if (onClose) onClose();
    },
  });

  const registerBtn = modalInstance.backdrop.querySelector<HTMLElement>('[data-ref="btn-auth-gate-register"]');
  const loginBtn = modalInstance.backdrop.querySelector<HTMLElement>('[data-ref="btn-auth-gate-login"]');

  registerBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    modalInstance.close();
    const query = returnUrl && returnUrl !== '/' ? `?redirect=${encodeURIComponent(returnUrl)}` : '';
    navigate(`/register${query}`);
  });

  loginBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    modalInstance.close();
    const query = returnUrl && returnUrl !== '/' ? `?redirect=${encodeURIComponent(returnUrl)}` : '';
    navigate(`/login${query}`);
  });

  activeAuthGateModal = modalInstance;
  return modalInstance;
}

interface UpgradeLimitModalOptions {
  currentCount?: number;
  currentLimit?: number;
  fileName?: string;
  onClose?: () => void;
  proLimit?: number | string;
  toolId?: string;
  toolName?: string;
  type: 'file_size' | 'files_count' | 'total_size';
}

let activeUpgradeModal: ModalInstance | null = null;

function isLimitErrorMessage(message: string): boolean {
  if (!message) return false;
  return /plan|l[ií]mite|pro|suscripci[oó]n|archivos por tarea|supera el l[ií]mite|m[aá]ximo de \d+ archivos/i.test(message);
}

const SPANISH_TOOL_NAME_MAP: Record<string, string> = {
  'comparar-pdf': 'compare-pdf',
  'comprimir-pdf': 'compress-pdf',
  'desbloquear-pdf': 'unlock-pdf',
  'dividir-pdf': 'split-pdf',
  'editar-pdf': 'edit-pdf',
  'eliminar-paginas-pdf': 'remove-pdf-pages',
  'excel-a-pdf': 'excel-to-pdf',
  'extraer-paginas-pdf': 'extract-pdf-pages',
  'html-a-pdf': 'html-to-pdf',
  'jpg-a-pdf': 'jpg-to-pdf',
  'marca-de-agua': 'watermark-pdf',
  'numeros-de-pagina': 'page-numbers',
  'ocr-pdf': 'ocr-pdf',
  'organizar-pdf': 'organize-pdf',
  'pdf-a-excel': 'pdf-to-excel',
  'pdf-a-jpg': 'pdf-to-jpg',
  'pdf-a-markdown': 'pdf-to-markdown',
  'pdf-a-pdfa': 'pdf-to-pdfa',
  'pdf-a-powerpoint': 'pdf-to-powerpoint',
  'pdf-a-word': 'pdf-to-word',
  'powerpoint-a-pdf': 'powerpoint-to-pdf',
  'proteger-pdf': 'protect-pdf',
  'recortar-pdf': 'crop-pdf',
  'redactar-pdf': 'redact-pdf',
  'reparar-pdf': 'repair-pdf',
  'resumir-pdf': 'summarize-pdf',
  'rotar-pdf': 'rotate-pdf',
  'traducir-pdf': 'translate-pdf',
  'unir-pdf': 'merge-pdf',
  'word-a-pdf': 'word-to-pdf',
};

function detectUpgradeToolId(optionsToolId?: string, optionsToolName?: string): string {
  if (optionsToolId && ALL_TOOLS_LIMITS[optionsToolId]) {
    return optionsToolId;
  }
  const path = (typeof window !== 'undefined' ? window.location.pathname : '')
    .toLowerCase()
    .replace(/^\/([a-z]{2}\/)?/, '')
    .replace(/^\//, '')
    .split('/')[0];
  if (ALL_TOOLS_LIMITS[path]) {
    return path;
  }
  if (optionsToolName) {
    const cleanName = optionsToolName.toLowerCase().replace(/\s+/g, '-');
    if (ALL_TOOLS_LIMITS[cleanName]) return cleanName;
    if (SPANISH_TOOL_NAME_MAP[cleanName]) return SPANISH_TOOL_NAME_MAP[cleanName];
    const match = Object.keys(ALL_TOOLS_LIMITS).find((key) => cleanName.includes(key) || key.includes(cleanName));
    if (match) return match;
  }
  return 'merge-pdf';
}

function showUpgradeLimitModal(options: UpgradeLimitModalOptions): ModalInstance {
  if (activeUpgradeModal) {
    activeUpgradeModal.close();
  }

  const isLoggedIn = !!currentUser;
  const userTier = normalizeTier(currentUser?.subscription_tier);
  const userWeight = getTierWeight(userTier);

  let targetTier: 'business' | 'pro' = 'pro';
  let isMaxTier = false;

  if (!isLoggedIn || userWeight === 0) {
    targetTier = 'pro';
  } else if (userWeight === 1) {
    targetTier = 'business';
  } else {
    isMaxTier = true;
    targetTier = 'business';
  }

  const toolId = detectUpgradeToolId(options.toolId, options.toolName);
  const toolConfig = ALL_TOOLS_LIMITS[toolId];

  let currentLimit = options.currentLimit;
  let targetLimit = 500;

  if (options.type === 'files_count') {
    if (!currentLimit) {
      currentLimit = userWeight === 1
        ? (toolConfig?.pro?.maxFiles ?? 500)
        : (toolConfig?.free?.maxFiles ?? 25);
    }
    targetLimit = targetTier === 'business'
      ? (toolConfig?.business?.maxFiles ?? 500)
      : (toolConfig?.pro?.maxFiles ?? 500);
  } else if (options.type === 'file_size') {
    if (!currentLimit) {
      currentLimit = userWeight === 1
        ? (toolConfig?.pro?.maxFileSizeMB ?? 1000)
        : (toolConfig?.free?.maxFileSizeMB ?? 50);
    }
    targetLimit = targetTier === 'business'
      ? (toolConfig?.business?.maxFileSizeMB ?? 1000)
      : (toolConfig?.pro?.maxFileSizeMB ?? 1000);
  } else {
    if (!currentLimit) {
      currentLimit = userWeight === 1
        ? (toolConfig?.pro?.maxTotalSizeMB ?? 2000)
        : (toolConfig?.free?.maxTotalSizeMB ?? 100);
    }
    targetLimit = targetTier === 'business'
      ? (toolConfig?.business?.maxTotalSizeMB ?? 2000)
      : (toolConfig?.pro?.maxTotalSizeMB ?? 2000);
  }

  const title = isMaxTier
    ? t('pricing.limit_modal_title_max')
    : targetTier === 'business'
      ? t('pricing.limit_modal_title_business')
      : t('pricing.limit_modal_title_pro');

  let currentNotice = '';
  if (options.type === 'files_count') {
    if (options.currentCount && options.currentCount > currentLimit) {
      currentNotice = t('pricing.limit_modal_files_current_count', {
        count: String(options.currentCount),
        limit: String(currentLimit),
      });
    } else {
      currentNotice = t('pricing.limit_modal_files_current', {
        limit: String(currentLimit),
      });
    }
  } else if (options.type === 'file_size') {
    currentNotice = t('pricing.limit_modal_size_current', {
      limit: String(currentLimit),
    });
  } else {
    currentNotice = t('pricing.limit_modal_total_size_current', {
      limit: String(currentLimit),
    });
  }

  let benefitNotice = '';
  if (!isMaxTier) {
    if (targetTier === 'business') {
      if (options.type === 'files_count') {
        benefitNotice = t('pricing.limit_modal_files_target_business', {
          limit: String(targetLimit),
        });
      } else if (options.type === 'file_size') {
        benefitNotice = t('pricing.limit_modal_size_target_business', {
          limit: String(targetLimit),
        });
      } else {
        benefitNotice = t('pricing.limit_modal_total_size_target_business', {
          limit: String(targetLimit),
        });
      }
    } else {
      if (options.type === 'files_count') {
        benefitNotice = t('pricing.limit_modal_files_target_pro', {
          limit: String(targetLimit),
        });
      } else if (options.type === 'file_size') {
        benefitNotice = t('pricing.limit_modal_size_target_pro', {
          limit: String(targetLimit),
        });
      } else {
        benefitNotice = t('pricing.limit_modal_total_size_target_pro', {
          limit: String(targetLimit),
        });
      }
    }
  }

  const feat1 = t('pricing.limit_modal_feat_speed');
  const feat2 = targetTier === 'business'
    ? t('pricing.limit_modal_feat_team')
    : t('pricing.limit_modal_feat_tools');
  const feat3 = t('pricing.limit_modal_feat_limits');

  const pillHtml = isMaxTier
    ? `<div class="component-badge modal-split__pill" data-ref="upgrade-pill"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#verified"></use></svg><span data-i18n="pricing.current_plan">${t('pricing.current_plan')}</span></div>`
    : targetTier === 'business'
      ? `<div class="component-badge modal-split__pill" data-ref="upgrade-pill"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#domain"></use></svg><span data-i18n="pricing.plan_business_label">${t('pricing.plan_business_label')}</span></div>`
      : `<div class="component-badge modal-split__pill" data-ref="upgrade-pill"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg><span data-i18n="pricing.plan_pro_label">${t('pricing.plan_pro_label')}</span></div>`;

  const bannerImgSrc = targetTier === 'business'
    ? '/images/modals/upgrade-business-banner.svg'
    : '/images/modals/upgrade-pro-banner.svg';
  const bannerAlt = targetTier === 'business' ? 'BoardPDF Business' : 'BoardPDF Pro';

  const actionText = !isLoggedIn
    ? t('nav.login')
    : isMaxTier
      ? t('common.close')
      : targetTier === 'business'
        ? t('pricing.upgrade_to_business')
        : t('pricing.upgrade_to_pro');

  const footnoteHtml = !isLoggedIn
    ? `<p class="modal-split__footnote" data-ref="upgrade-footnote">${t('pricing.limit_modal_login_hint_text')} <a class="link" data-ref="btn-upgrade-register" href="/register">${t('pricing.limit_modal_login_register_link')}</a></p>`
    : isMaxTier
      ? ''
      : `<p class="modal-split__footnote" data-ref="upgrade-footnote">${t('pricing.limit_modal_cancel_hint')}</p>`;

  const contentHtml = renderUpgradeLimitModalContent({
    actionText,
    bannerAlt,
    bannerImgSrc,
    benefitNotice,
    currentNotice,
    desc: currentNotice,
    feat1,
    feat2,
    feat3,
    footnoteHtml,
    pillHtml,
    title,
  });

  const modalInstance = openCustomModal({
    backdropRef: 'modal-upgrade-backdrop',
    contentHtml,
    onClose: () => {
      if (activeUpgradeModal === modalInstance) {
        activeUpgradeModal = null;
      }
      if (typeof options.onClose === 'function') {
        options.onClose();
      }
    },
  });

  const submitBtn = modalInstance.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-upgrade-submit"], [data-ref="btn-upgrade-action"]');
  const registerLink = modalInstance.backdrop.querySelector<HTMLAnchorElement>('[data-ref="btn-upgrade-register"]');

  submitBtn?.addEventListener('click', () => {
    modalInstance.close();
    if (!isLoggedIn) {
      const current = window.location.pathname + window.location.search;
      navigate('/login?redirect=' + encodeURIComponent(current));
      return;
    }
    if (isMaxTier) {
      return;
    }
    const lang = getCurrentLanguage();
    const checkoutBase = getLocalizedPath('checkout', lang);
    navigate(`${checkoutBase}?plan=${targetTier}&cycle=monthly`);
  });

  registerLink?.addEventListener('click', (e) => {
    e.preventDefault();
    modalInstance.close();
    const current = window.location.pathname + window.location.search;
    navigate('/register?redirect=' + encodeURIComponent(current));
  });

  activeUpgradeModal = modalInstance;
  return modalInstance;
}

export {
  isLimitErrorMessage,
  openAddWebUrlModal,
  openCancelSubscriptionModal,
  openCollabPageSizeModal,
  openCreateFolderModal,
  openCreateTeamModal,
  openDeleteAccountModal,
  openDeleteDocModal,
  openDeleteFolderModal,
  openDeleteUploadModal,
  openDeleteWorkflowModal,
  openDisable2FAModal,
  openDocumentLabelsModal,
  openInviteTeamMemberModal,
  openManageTeamSeatsModal,
  openMoveDocModal,
  openMoveUploadModal,
  openProtectPdfPasswordModal,
  openRenameFolderModal,
  openSeatPaymentModal,
  openShareDownloadModal,
  openTeamFolderShareModal,
  openThankYouShareModal,
  openUnlockPdfPasswordModal,
  openVerifyEmailCodeModal,
  openVerifyPasswordModal,
  setupNewPasswordModalStep,
  showAuthGateModal,
  showUpgradeLimitModal,
};
export type {
  AuthGateFeature,
  AuthGateModalOptions,
  CollabPageSizeModalOptions,
  CollabPageSizeResult,
  UpgradeLimitModalOptions,
};
