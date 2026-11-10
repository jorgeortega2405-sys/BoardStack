import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { showToast } from '../services/toast.service.js';
import { ModalInstance } from '../types/common.types.js';
import { openCollabPageSizeModal } from '../views/collaborative-pdf/collab-page-size-modal.util.js';
import type { CollabPageSizeModalOptions, CollabPageSizeResult } from '../views/collaborative-pdf/collab-page-size-modal.util.js';
import { renderAddWebUrlModalBody, renderCollabLocalAuthModalBody, renderCreateFolderModalBody, renderDeleteAccountModalBody, renderDisable2FAModalBody, renderMoveFolderOptionsModalBody, renderNewPasswordModalBody, renderRenameFolderModalBody, renderShareDownloadModalBody, renderThankYouShareModalBody, renderUnlockPdfModalBody, renderVerifyEmailCodeModalBody, renderVerifyPasswordModalBody } from './modal-templates.js';
import { openModal } from './modal.component.js';

function setupPasswordToggle(toggleBtn: HTMLElement | null, input: HTMLInputElement | null): void {
  if (!toggleBtn || !input) return;
  toggleBtn.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = toggleBtn.querySelector<SVGUseElement>('use');
    if (icon) {
      icon.setAttribute('href', isPassword ? '/icons.svg#visibility_off' : '/icons.svg#visibility');
    }
  });
}

function openCreateFolderModal(options: {
  onConfirm: (name: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const modal = openModal({
    bodyHtml: renderCreateFolderModalBody(),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--primary',
    confirmText: t('projects.modal_create_folder_btn') || 'Crear carpeta',
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
    title: t('projects.modal_create_folder_title') || 'Nueva carpeta',
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
    confirmClass: 'component-button--primary',
    confirmText: t('projects.modal_rename_folder_btn') || 'Guardar cambios',
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
    title: t('projects.modal_rename_folder_title') || 'Renombrar carpeta',
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
    confirmText: t('projects.modal_delete_folder_btn') || 'Eliminar carpeta',
    description: t('projects.modal_delete_folder_desc') || '¿Estás seguro de que deseas eliminar esta carpeta? Los archivos y documentos dentro se moverán a la sección principal.',
    onConfirm: options.onConfirm,
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_delete_folder_title') || 'Eliminar carpeta',
  });
}

function openMoveDocModal(options: {
  activeFolderId: string | null;
  folders: Array<{ id: string; name: string }>;
  onConfirm: (targetFolderId: string | null, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    bodyHtml: renderMoveFolderOptionsModalBody({
      activeFolderId: options.activeFolderId,
      folders: options.folders,
      isUploads: false,
    }),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--primary',
    confirmText: t('projects.modal_move_doc_btn') || 'Mover documento',
    onConfirm: async (inst) => {
      const selectedRadio = inst.body.querySelector<HTMLInputElement>('input[name="target-folder"]:checked');
      const targetId = selectedRadio ? selectedRadio.value || null : null;
      return options.onConfirm(targetId, inst);
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_move_doc_title') || 'Mover a carpeta',
  });
}

function openMoveUploadModal(options: {
  activeFolderId: string | null;
  folders: Array<{ id: string; name: string }>;
  onConfirm: (targetFolderId: string | null, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    bodyHtml: renderMoveFolderOptionsModalBody({
      activeFolderId: options.activeFolderId,
      folders: options.folders,
      isUploads: true,
    }),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--primary',
    confirmText: t('projects.modal_move_upload_btn') || 'Mover archivo',
    onConfirm: async (inst) => {
      const selectedRadio = inst.body.querySelector<HTMLInputElement>('input[name="target-upload-folder"]:checked');
      const targetId = selectedRadio ? selectedRadio.value || null : null;
      return options.onConfirm(targetId, inst);
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_move_upload_title') || 'Mover archivo subido',
  });
}

function openDeleteUploadModal(options: {
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: t('projects.modal_delete_upload_btn') || 'Eliminar archivo',
    description: t('projects.modal_delete_upload_desc') || '¿Estás seguro de que deseas eliminar este archivo? Esta acción no se puede deshacer.',
    onConfirm: options.onConfirm,
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_delete_upload_title') || 'Eliminar archivo',
  });
}

function openDeleteDocModal(options: {
  docTitle: string;
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const desc = (t('projects.modal_delete_doc_desc') || '¿Estás seguro de que deseas eliminar permanentemente "{title}"? Esta acción no se puede deshacer.')
    .replace('{title}', options.docTitle);

  return openModal({
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: t('common.delete') || 'Eliminar',
    description: desc,
    onConfirm: options.onConfirm,
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('projects.modal_delete_doc_title') || 'Eliminar documento',
  });
}

function openDeleteWorkflowModal(options: {
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
  workflowName: string;
}): ModalInstance {
  const desc = (t('workflows.delete_modal_desc') || '¿Estás seguro de que deseas eliminar permanentemente el flujo de trabajo "{name}"? Esta acción no se puede deshacer.')
    .replace('{name}', options.workflowName);

  return openModal({
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: t('workflows.delete_modal_btn') || 'Eliminar flujo',
    description: desc,
    onConfirm: options.onConfirm,
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('workflows.delete_modal_title') || 'Eliminar flujo de trabajo',
  });
}

function openVerifyEmailCodeModal(options: {
  email: string;
  onConfirm: (code: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    bodyHtml: renderVerifyEmailCodeModalBody(options.email),
    cancelText: t('common.cancel'),
    confirmText: t('common.continue'),
    description: t('settings.your_account.modal_email_verify_desc', { email: options.email }),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="modal-input-code"]');
      const code = input?.value?.trim() || '';
      if (!code) {
        inst.showError(t('validation.code_required') || t('ui.ingresa_el_codigo_de_6_digitos'));
        return false;
      }
      if (code.length !== 6 || !/^\d+$/.test(code)) {
        inst.showError(t('validation.code_invalid') || 'El código debe contener exactamente 6 dígitos.');
        return false;
      }
      return options.onConfirm(code, inst);
    },
    title: t('settings.your_account.modal_email_verify_title'),
  });
}

function openCancelSubscriptionModal(options: {
  dateFormatted: string;
  onConfirm: (inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const desc = (t('settings.billing.modal_cancel_sub_desc') || t('ui.tu_suscripcion_no_se_renovara_al_conclui'))
    .replace('{date}', options.dateFormatted);

  return openModal({
    confirmClass: 'component-button--black',
    confirmText: t('settings.billing.btn_confirm_cancel_sub') || 'Confirmar cancelación',
    description: desc,
    onConfirm: options.onConfirm,
    title: t('settings.billing.modal_cancel_sub_title') || '¿Cancelar suscripción?',
  });
}

function openVerifyPasswordModal(options: {
  onConfirm: (password: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const modal = openModal({
    bodyHtml: renderVerifyPasswordModalBody(),
    cancelText: t('common.cancel'),
    confirmText: t('common.continue'),
    description: t('settings.security.modal_verify_password_desc') || t('ui.por_motivos_de_seguridad_ingresa_tu_cont'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="modal-input-current-password"]');
      const password = input?.value || '';
      if (!password) {
        inst.showError(t('validation.password_required') || 'Ingresa tu contraseña actual.');
        return false;
      }
      return options.onConfirm(password, inst);
    },
    title: t('settings.security.modal_verify_password_title') || 'Verifica tu contraseña actual',
  });

  const currentPassInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-current-password"]');
  const togglePassBtn = modal.body.querySelector<HTMLElement>('[data-ref="toggle-modal-current-password"]');
  setupPasswordToggle(togglePassBtn, currentPassInput);

  return modal;
}

function setupNewPasswordModalStep(
  modal: ModalInstance,
  options: {
    onConfirm: (newPassword: string, inst: ModalInstance) => Promise<boolean | void>;
  }
): void {
  modal.setTitle(t('settings.security.modal_new_password_title') || 'Crear nueva contraseña');
  modal.setDescription(t('settings.security.modal_new_password_desc') || 'Tu nueva contraseña debe tener al menos 8 caracteres.');
  modal.clearError();
  modal.setConfirmLoading(false);
  modal.setConfirmVisible(true);
  modal.setConfirmText(t('common.save') || 'Guardar');
  modal.setBody(renderNewPasswordModalBody());

  const inputNewPass = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-new-password"]');
  const inputConfirmPass = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-confirm-new-password"]');
  const toggleNewPass = modal.body.querySelector<HTMLElement>('[data-ref="toggle-modal-new-password"]');
  const toggleConfirmPass = modal.body.querySelector<HTMLElement>('[data-ref="toggle-modal-confirm-new-password"]');

  setupPasswordToggle(toggleNewPass, inputNewPass);
  setupPasswordToggle(toggleConfirmPass, inputConfirmPass);
  inputNewPass?.focus();

  modal.setOnConfirm(async (inst) => {
    const newPass = inputNewPass?.value || '';
    const confirmPass = inputConfirmPass?.value || '';

    if (!newPass || newPass.length < 8) {
      inst.showError(t('validation.password_min') || 'La contraseña debe tener al menos 8 caracteres.');
      return false;
    }
    if (newPass !== confirmPass) {
      inst.showError(t('validation.passwords_not_match') || 'Las contraseñas no coinciden.');
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
    confirmText: t('settings.security.btn_disable_2fa') || 'Desactivar',
    description: t('settings.security.two_factor_disable_confirm') || t('ui.ingresa_tu_contrasena_actual_o_un_codigo'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-disable-2fa-password"]');
      const val = input ? input.value.trim() : '';
      if (!val) {
        inst.showError(t('settings.security.modal_current_password_error') || t('ui.ingresa_tu_contrasena_o_codigo_de_verifi'));
        return false;
      }
      return options.onConfirm(val, inst);
    },
    title: t('settings.security.two_factor_disable_title') || t('ui.desactivar_autenticacion_en_dos_pasos'),
  });
}

function openDeleteAccountModal(options: {
  onConfirm: (password: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  return openModal({
    bodyHtml: renderDeleteAccountModalBody(),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--danger',
    confirmText: t('settings.security.btn_delete_account') || 'Eliminar cuenta',
    description: t('settings.security.delete_account_modal_desc') || 'Esta acción es irreversible. Se eliminarán permanentemente todos tus archivos y datos asociados.',
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-delete-password"]');
      const password = input?.value?.trim() || '';
      if (!password) {
        inst.showError(t('settings.security.modal_current_password_error') || t('ui.ingresa_tu_contrasena_actual_para_confir'));
        return false;
      }
      return options.onConfirm(password, inst);
    },
    title: t('settings.security.delete_account_modal_title') || '¿Eliminar tu cuenta definitivamente?',
  });
}

function openUnlockPdfPasswordModal(options: {
  onConfirm: (password: string, inst: ModalInstance) => Promise<boolean | void>;
}): ModalInstance {
  const modal = openModal({
    bodyHtml: renderUnlockPdfModalBody(),
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('tools.unlock_pdf.unlock_btn') || 'Desbloquear PDF',
    description: t('ui.este_archivo_pdf_requiere_una_contrasena'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="modal-input-password"]');
      const password = input?.value.trim() || '';
      if (!password) {
        inst.showError(t('tools.unlock_pdf.enter_password_required') || 'Debes ingresar la contraseña del archivo PDF.');
        return false;
      }
      return options.onConfirm(password, inst);
    },
    size: 'sm',
    title: t('tools.unlock_pdf.password_required_title') || 'Contraseña requerida',
  });

  const toggleBtn = modal.body.querySelector<HTMLElement>('[data-ref="btn-modal-toggle-password"]');
  const input = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-password"]');
  setupPasswordToggle(toggleBtn, input);

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
    confirmText: t('tools.html_to_pdf.add_url_btn') || 'Añadir URL',
    description: t('ui.escribe_la_url_de_la_pagina_web_que_dese'),
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-web-url"]');
      let raw = (input?.value || '').trim();
      if (!raw) {
        inst.showError(t('ui.debes_ingresar_la_url_de_una_pagina_web'));
        return false;
      }
      if (!/^https?:\/\//i.test(raw)) {
        raw = `https://${raw}`;
      }
      return options.onConfirm(raw, inst);
    },
    size: 'sm',
    title: t('tools.html_to_pdf.add_url_title') || 'Añadir URL',
  });
}

function openCollabLocalAuthModal(options: {
  docId: string;
  onClose?: () => void;
  onStoreCurrentAsPending: () => void;
}): ModalInstance {
  const modal = openModal({
    bodyHtml: renderCollabLocalAuthModalBody(),
    onClose: options.onClose,
    showCancel: false,
    showConfirm: false,
    size: 'sm',
    title: t('collab.share_design_title') || 'Compartir este diseño',
  });

  modal.body.querySelector('[data-ref="btn-local-modal-register"]')?.addEventListener('click', () => {
    options.onStoreCurrentAsPending();
    modal.close();
    navigate(`/register?redirect=${encodeURIComponent(`/d/${options.docId}`)}`);
  });

  modal.body.querySelector('[data-ref="btn-local-modal-login"]')?.addEventListener('click', () => {
    options.onStoreCurrentAsPending();
    modal.close();
    navigate(`/login?redirect=${encodeURIComponent(`/d/${options.docId}`)}`);
  });

  return modal;
}

function openShareDownloadModal(options: { downloadLink: string }): ModalInstance {
  const modal = openModal({
    bodyHtml: renderShareDownloadModalBody(options.downloadLink),
    showCancel: false,
    showConfirm: false,
    size: 'sm',
    title: t('ui.compartir_enlace_de_descarga'),
  });

  const inputEl = modal.backdrop.querySelector<HTMLInputElement>('[data-ref="input-share-url"]');
  inputEl?.addEventListener('click', () => inputEl.select());

  const copyBtn = modal.backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-copy-url"]');
  const copyLabel = modal.backdrop.querySelector<HTMLElement>('[data-ref="modal-copy-label"]');

  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(options.downloadLink);
      if (copyLabel) copyLabel.textContent = t('common.copied') || 'Copiado';
      showToast(t('toasts.enlace_copiado_al_portapapeles'), 'success');
      setTimeout(() => {
        if (copyLabel) copyLabel.textContent = t('common.copy') || 'Copiar';
      }, 2000);
    } catch {
      inputEl?.select();
      showToast(t('toasts.copia_el_enlace_manualmente'), 'info');
    }
  });

  const qrContainer = modal.backdrop.querySelector<HTMLElement>('[data-ref="share-qr-target"]');
  if (qrContainer) {
    import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      const qr = new QRCodeStyling({
        backgroundOptions: { color: 'transparent' },
        cornersDotOptions: { color: '#000000', type: 'dot' },
        cornersSquareOptions: { color: '#000000', type: 'extra-rounded' },
        data: options.downloadLink,
        dotsOptions: { color: '#000000', type: 'rounded' },
        height: 140,
        margin: 4,
        type: 'svg',
        width: 140,
      });
      qrContainer.innerHTML = '';
      qr.append(qrContainer);
    }).catch(() => {});
  }

  return modal;
}

function openThankYouShareModal(options: { shareUrl: string }): ModalInstance {
  const modal = openModal({
    bodyHtml: renderThankYouShareModalBody(),
    cancelText: t('common.close') || 'Cerrar',
    confirmClass: 'component-button--black',
    confirmText: t('common.close') || 'Cerrar',
    description: t('download.thank_you_desc') || '¡Haz correr la voz y comparte BoardPDF!',
    onConfirm: () => modal.close(),
    showCancel: false,
    showConfirm: true,
    size: 'sm',
    title: t('download.thank_you_title') || '¿Cómo nos puedes dar las gracias?',
  });

  renderIcons(modal.backdrop);

  modal.backdrop.querySelector('[data-ref="badge-modal-trustpilot"]')?.addEventListener('click', () => {
    window.open('https://www.trustpilot.com/review/boardpdf.com', '_blank', 'noopener,noreferrer');
  });
  modal.backdrop.querySelector('[data-ref="badge-modal-facebook"]')?.addEventListener('click', () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(options.shareUrl)}`, '_blank', 'noopener,noreferrer');
  });
  modal.backdrop.querySelector('[data-ref="badge-modal-twitter"]')?.addEventListener('click', () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t('ui.gestiona_y_edita_tus_archivos_pdf_rapido'))}&url=${encodeURIComponent(options.shareUrl)}`, '_blank', 'noopener,noreferrer');
  });
  modal.backdrop.querySelector('[data-ref="badge-modal-linkedin"]')?.addEventListener('click', () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(options.shareUrl)}`, '_blank', 'noopener,noreferrer');
  });

  return modal;
}

export {
  openAddWebUrlModal,
  openCancelSubscriptionModal,
  openCollabLocalAuthModal,
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