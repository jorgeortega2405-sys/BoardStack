import { layoutNav } from './components/layout-nav.component.js';
import {
  openAlertModal,
  openDeleteConfirmModal,
  openPromptModal,
} from './components/modal-dialogs.js';
import {
  closeAllModals,
  openConfirmModal,
  openCustomModal,
  openModal,
} from './components/modal.component.js';
import { i18n, t } from './i18n/i18n.service.js';
import { themeService } from './services/theme.service.js';
import { showToast, toast } from './services/toast.service.js';
import { initTooltips } from './services/tooltip.service.js';

declare global {
  interface Window {
    closeAllModals: typeof closeAllModals;
    i18n: typeof i18n;
    openAlertModal: typeof openAlertModal;
    openConfirmModal: typeof openConfirmModal;
    openCustomModal: typeof openCustomModal;
    openDeleteConfirmModal: typeof openDeleteConfirmModal;
    openModal: typeof openModal;
    openPromptModal: typeof openPromptModal;
    showToast: typeof showToast;
    t: typeof t;
    themeService: typeof themeService;
    toast: typeof toast;
  }
}

if (typeof window !== 'undefined') {
  window.toast = toast;
  window.showToast = showToast;
  window.openModal = openModal;
  window.openConfirmModal = openConfirmModal;
  window.openPromptModal = openPromptModal;
  window.openAlertModal = openAlertModal;
  window.openDeleteConfirmModal = openDeleteConfirmModal;
  window.closeAllModals = closeAllModals;
  window.openCustomModal = openCustomModal;
  window.themeService = themeService;
  window.i18n = i18n;
  window.t = t;
}

function bootstrap(): void {
  layoutNav.init();
  initTooltips();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

export {
  closeAllModals,
  openAlertModal,
  openConfirmModal,
  openCustomModal,
  openDeleteConfirmModal,
  openModal,
  openPromptModal,
  showToast,
  toast,
};
