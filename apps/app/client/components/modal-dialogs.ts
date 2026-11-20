import type { ConfirmModalOptions, ModalInstance, PromptModalOptions } from '../types/common.types.js';
import { currentUser } from '../services/api.service.js';
import { i18n } from '../i18n/i18n.service.js';
import { openConfirmModal, openModal } from './modal.component.js';
import {
  renderDeleteAccountModalBody,
  renderDisable2FAModalBody,
  renderNewPasswordModalBody,
  renderPromptModalBody,
  renderVerifyEmailCodeModalBody,
  renderVerifyPasswordModalBody,
} from './modal-templates.js';

interface IdentityVerificationPayload {
  password?: string;
  securityTicket?: string;
}

interface GoogleVerifyMessage {
  code?: string;
  error?: string;
  ok?: boolean;
  securityTicket?: string;
  ts?: number;
  type?: string;
}

function setupPasswordToggle(btn: HTMLElement | null, input: HTMLInputElement | null): void {
  if (!btn || !input) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    const icon = btn.querySelector<SVGUseElement>('use');
    if (icon) {
      icon.setAttribute('href', isPass ? '/icons.svg#visibility_off' : '/icons.svg#visibility');
    }
  });
}

function openAlertModal(options: {
  buttonText?: string;
  description?: string;
  onClose?: () => void;
  title: string;
}): ModalInstance {
  const {
    buttonText = i18n.t('common.accept'),
    description = '',
    onClose = null,
    title,
  } = options;

  return openModal({
    confirmClass: 'component-button--black',
    confirmText: buttonText,
    description,
    onClose,
    showCancel: false,
    showConfirm: true,
    size: 'sm',
    title,
  });
}

function openDeleteConfirmModal(options: {
  cancelText?: string;
  confirmText?: string;
  description?: string;
  onConfirm: (inst: ModalInstance) => boolean | Promise<boolean | void> | void;
  title?: string;
}): ModalInstance {
  return openConfirmModal({
    cancelText: options.cancelText || i18n.t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: options.confirmText || i18n.t('common.delete'),
    description: options.description || i18n.t('modal.delete_confirm_desc'),
    isDanger: true,
    onConfirm: options.onConfirm,
    title: options.title || i18n.t('modal.delete_confirm_title'),
  });
}

function openPromptModal(options: PromptModalOptions): ModalInstance {
  const {
    cancelText = i18n.t('common.cancel'),
    confirmClass = 'component-button--black',
    confirmText = i18n.t('common.accept'),
    defaultValue = '',
    description = '',
    inputPlaceholder = '',
    inputType = 'text',
    onCancel = null,
    onConfirm,
    title,
  } = options;

  const modal = openModal({
    bodyHtml: renderPromptModalBody(inputPlaceholder, defaultValue, inputType),
    cancelText,
    confirmClass,
    confirmText,
    description,
    onCancel,
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-prompt-value"]');
      const val = (input?.value || '').trim();
      return onConfirm(val, inst);
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title,
  });

  const inputEl = modal.body.querySelector<HTMLInputElement>('[data-ref="input-prompt-value"]');
  inputEl?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      modal.confirmBtn?.click();
    }
  });

  return modal;
}

function openVerifyEmailCodeModal(options: {
  email: string;
  onConfirm: (code: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    bodyHtml: renderVerifyEmailCodeModalBody(),
    cancelText: i18n.t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: i18n.t('common.confirm'),
    description: i18n.t('modal.verify_email_desc', { email: options.email }),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-email-code"]');
      const code = input?.value?.trim() || '';
      if (!code) {
        inst.showError(i18n.t('auth.enter_six_digit_code'));
        return false;
      }
      if (code.length !== 6 || !/^\d+$/.test(code)) {
        inst.showError(i18n.t('auth.digit_code'));
        return false;
      }
      return options.onConfirm(code, inst);
    },
    size: 'sm',
    title: i18n.t('modal.verify_email_title'),
  });
}

function openIdentityVerificationModal(options: {
  bodyHtml: string;
  confirmClass?: string;
  confirmText?: string;
  description?: string;
  hasPassword: boolean;
  onConfirm: (payload: IdentityVerificationPayload, inst: ModalInstance) => Promise<boolean | void>;
  title: string;
}): ModalInstance {
  let activeMethod: 'google' | 'password' | null = null;
  let broadcastChannel: BroadcastChannel | null = null;
  let messageListener: ((e: MessageEvent) => void) | null = null;
  let storageListener: ((e: StorageEvent) => void) | null = null;
  let lastHandledTs = 0;

  const cleanupGoogleListeners = () => {
    if (broadcastChannel) {
      try {
        broadcastChannel.close();
      } catch {}
      broadcastChannel = null;
    }
    if (messageListener) {
      window.removeEventListener('message', messageListener);
      messageListener = null;
    }
    if (storageListener) {
      window.removeEventListener('storage', storageListener);
      storageListener = null;
    }
  };

  const modal = openModal({
    bodyHtml: options.bodyHtml,
    cancelText: i18n.t('common.cancel'),
    confirmClass: options.confirmClass || 'component-button--black',
    confirmText: options.confirmText || i18n.t('common.confirm'),
    description: options.description || i18n.t('modal.verify_identity_desc'),
    onClose: () => {
      cleanupGoogleListeners();
    },
    onConfirm: async (inst) => {
      if (activeMethod !== 'password') {
        inst.showError(i18n.t('modal.select_verification_method'));
        return false;
      }
      if (!options.hasPassword) {
        inst.showError(i18n.t('modal.no_password_set_hint'));
        return false;
      }
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-modal-password"]');
      const password = input?.value || '';
      if (!password) {
        inst.showError(i18n.t('modal.enter_current_password_prompt'));
        return false;
      }
      return options.onConfirm({ password }, inst);
    },
    size: 'sm',
    title: options.title,
  });

  modal.setConfirmVisible(false);

  const badgePassword = modal.body.querySelector<HTMLButtonElement>('[data-ref="badge-verify-password"]');
  const badgeGoogle = modal.body.querySelector<HTMLButtonElement>('[data-ref="badge-verify-google"]');
  const panelPassword = modal.body.querySelector<HTMLElement>('[data-ref="panel-verify-password"]');
  const panelGoogle = modal.body.querySelector<HTMLElement>('[data-ref="panel-verify-google"]');
  const passInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-password"]');
  const toggleBtn = modal.body.querySelector<HTMLElement>('[data-ref="btn-toggle-modal-password"]');
  const reopenGoogleBtn = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-reopen-google-verify"]');

  setupPasswordToggle(toggleBtn, passInput);

  passInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      modal.confirmBtn?.click();
    }
  });

  const handleGooglePayload = async (rawData: unknown) => {
    if (!rawData || typeof rawData !== 'object') return;
    const data = rawData as GoogleVerifyMessage;
    if (data.type !== 'BOARDSTACK_GOOGLE_VERIFY') return;
    if (typeof data.ts === 'number') {
      if (data.ts <= lastHandledTs) return;
      lastHandledTs = data.ts;
    }

    try {
      localStorage.removeItem('boardstack_google_verify_result');
    } catch {}

    if (data.ok && data.securityTicket) {
      cleanupGoogleListeners();
      modal.clearError();
      const shouldClose = await options.onConfirm({ securityTicket: data.securityTicket }, modal);
      if (shouldClose !== false) {
        modal.close();
      }
      return;
    }

    if (data.code === 'ACCOUNT_MISMATCH') {
      modal.showError(i18n.t('modal.google_account_mismatch'));
    } else if (data.code === 'GOOGLE_CANCELLED') {
      modal.showError(i18n.t('modal.google_verify_cancelled'));
    } else {
      modal.showError(data.error || i18n.t('common.error'));
    }
  };

  const attachGoogleListeners = () => {
    cleanupGoogleListeners();

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        broadcastChannel = new BroadcastChannel('boardstack_google_verify');
        broadcastChannel.onmessage = (e: MessageEvent) => {
          void handleGooglePayload(e.data);
        };
      } catch {}
    }

    messageListener = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      void handleGooglePayload(e.data);
    };
    window.addEventListener('message', messageListener);

    storageListener = (e: StorageEvent) => {
      if (e.key !== 'boardstack_google_verify_result' || !e.newValue) return;
      try {
        void handleGooglePayload(JSON.parse(e.newValue));
      } catch {}
    };
    window.addEventListener('storage', storageListener);
  };

  const launchGooglePopup = () => {
    modal.clearError();
    try {
      localStorage.removeItem('boardstack_google_verify_result');
    } catch {}
    attachGoogleListeners();
    window.open('/api/auth/google?mode=verify', 'boardstack_google_verify', 'width=520,height=640');
  };

  badgePassword?.addEventListener('click', (e) => {
    e.preventDefault();
    activeMethod = 'password';
    cleanupGoogleListeners();
    modal.clearError();
    badgePassword.classList.add('is-active');
    badgeGoogle?.classList.remove('is-active');
    panelPassword?.classList.remove('is-hidden');
    panelGoogle?.classList.add('is-hidden');
    modal.setConfirmVisible(options.hasPassword);
    if (options.hasPassword) {
      passInput?.focus();
    }
  });

  badgeGoogle?.addEventListener('click', (e) => {
    e.preventDefault();
    activeMethod = 'google';
    modal.clearError();
    badgeGoogle.classList.add('is-active');
    badgePassword?.classList.remove('is-active');
    panelGoogle?.classList.remove('is-hidden');
    panelPassword?.classList.add('is-hidden');
    modal.setConfirmVisible(false);
    launchGooglePopup();
  });

  reopenGoogleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    launchGooglePopup();
  });

  return modal;
}

function openVerifyPasswordModal(options: {
  description?: string;
  hasPassword?: boolean;
  onConfirm: (payload: IdentityVerificationPayload, inst: ModalInstance) => Promise<boolean | void>;
  title?: string;
}): ModalInstance {
  const hasPassword = options.hasPassword ?? Boolean(currentUser?.has_password);
  return openIdentityVerificationModal({
    bodyHtml: renderVerifyPasswordModalBody(hasPassword),
    confirmClass: 'component-button--black',
    confirmText: i18n.t('common.confirm'),
    description: options.description || i18n.t('modal.verify_identity_desc'),
    hasPassword,
    onConfirm: options.onConfirm,
    title: options.title || i18n.t('modal.verify_identity_title'),
  });
}

function setupNewPasswordModalStep(
  modal: ModalInstance,
  options: {
    onConfirm: (newPassword: string, inst: ModalInstance) => Promise<boolean | void>;
  }
): void {
  modal.setTitle(i18n.t('modal.new_password_title'));
  modal.setDescription(i18n.t('modal.new_password_desc'));
  modal.clearError();
  modal.setConfirmLoading(false);
  modal.setConfirmVisible(true);
  modal.setConfirmText(i18n.t('modal.save_password'));
  modal.setBody(renderNewPasswordModalBody());

  const inputNewPass = modal.body.querySelector<HTMLInputElement>('[data-ref="input-new-password"]');
  const inputConfirmPass = modal.body.querySelector<HTMLInputElement>('[data-ref="input-confirm-password"]');
  const toggleNewPass = modal.body.querySelector<HTMLElement>('[data-ref="btn-toggle-new-password"]');
  const toggleConfirmPass = modal.body.querySelector<HTMLElement>('[data-ref="btn-toggle-confirm-password"]');

  setupPasswordToggle(toggleNewPass, inputNewPass);
  setupPasswordToggle(toggleConfirmPass, inputConfirmPass);
  inputNewPass?.focus();

  modal.setOnConfirm(async (inst) => {
    const newPass = inputNewPass?.value || '';
    const confirmPass = inputConfirmPass?.value || '';

    if (!newPass || newPass.length < 8) {
      inst.showError(i18n.t('auth.password_min_length'));
      return false;
    }
    if (newPass !== confirmPass) {
      inst.showError(i18n.t('auth.passwords_dont_match'));
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
    cancelText: i18n.t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: i18n.t('settings.security.disable_2fa'),
    description: i18n.t('settings.security.confirm_disable_2fa'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-disable-2fa-code"]');
      const val = input ? input.value.trim() : '';
      if (!val) {
        inst.showError(i18n.t('modal.password_or_code'));
        return false;
      }
      return options.onConfirm(val, inst);
    },
    size: 'sm',
    title: i18n.t('modal.disable_2fa_title'),
  });
}

function openDeleteAccountModal(options: {
  hasPassword?: boolean;
  onConfirm: (payload: IdentityVerificationPayload, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const hasPassword = options.hasPassword ?? Boolean(currentUser?.has_password);
  return openIdentityVerificationModal({
    bodyHtml: renderDeleteAccountModalBody(hasPassword),
    confirmClass: 'component-button--danger',
    confirmText: i18n.t('modal.delete_permanently'),
    description: i18n.t('settings.security.confirm_delete_account'),
    hasPassword,
    onConfirm: options.onConfirm,
    title: i18n.t('modal.delete_account_title'),
  });
}

function openCancelSubscriptionModal(options: {
  dateFormatted: string;
  description?: string;
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const desc =
    options.description ||
    i18n.t('modal.cancel_sub_desc', { date: options.dateFormatted });

  return openModal({
    cancelText: i18n.t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: i18n.t('settings.billing.cancel_subscription'),
    description: desc,
    onConfirm: options.onConfirm,
    size: 'sm',
    title: i18n.t('modal.cancel_sub_title'),
  });
}

export {
  openAlertModal,
  openCancelSubscriptionModal,
  openDeleteAccountModal,
  openDeleteConfirmModal,
  openDisable2FAModal,
  openIdentityVerificationModal,
  openPromptModal,
  openVerifyEmailCodeModal,
  openVerifyPasswordModal,
  setupNewPasswordModalStep,
  setupPasswordToggle
};

export type {
  IdentityVerificationPayload
};