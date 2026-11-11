import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { ModalInstance } from '../types/common.types.js';
import { setupSheetDragToDismiss } from './modal.component.js';

export type AuthGateFeature =
  | 'ai_bg_remove'
  | 'ai_designer'
  | 'ai_tools'
  | 'cloud_uploads'
  | 'collaborative_share'
  | 'generic'
  | 'labels';

export interface AuthGateModalOptions {
  descKey?: string;
  featureKey?: AuthGateFeature;
  onClose?: () => void;
  returnUrl?: string;
  titleKey?: string;
}

let activeAuthGateModal: ModalInstance | null = null;

function getFeatureConfig(featureKey: AuthGateFeature = 'generic') {
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

export function showAuthGateModal(options: AuthGateModalOptions = {}): ModalInstance {
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

  const config = getFeatureConfig(featureKey);
  const title = t(customTitleKey || config.titleKey);
  const desc = t(customDescKey || config.descKey);
  const pillText = t(config.pillTextKey);
  const feat1 = t(config.feat1Key);
  const feat2 = t(config.feat2Key);
  const feat3 = t(config.feat3Key);

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-auth-gate-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-auth-gate-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="common.close" aria-label="${t('common.close')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--split" data-ref="modal-card-auth-gate">
        <div class="modal-card__drag-zone" data-ref="modal-auth-gate-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="modal-split__left" data-ref="modal-split-left">
          <div class="modal-split__content" data-ref="auth-gate-content">
            <div class="modal-split__header" data-ref="auth-gate-header">
              <div class="component-badge modal-split__pill" data-ref="auth-gate-pill">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#stars"></use></svg>
                <span>${pillText}</span>
              </div>
              <h2 class="modal-split__title modal-split__title--upgrade" data-ref="auth-gate-title">${title}</h2>
            </div>
            <div class="modal-split__limit-body" data-ref="auth-gate-body">
              <p class="modal-split__limit-notice" data-ref="auth-gate-desc">${desc}</p>
              <ul class="modal-split__benefits-list" data-ref="auth-gate-benefits-list">
                <li class="modal-split__benefit-item">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
                  <span>${feat1}</span>
                </li>
                <li class="modal-split__benefit-item">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
                  <span>${feat2}</span>
                </li>
                <li class="modal-split__benefit-item">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
                  <span>${feat3}</span>
                </li>
              </ul>
            </div>
          </div>
          <div class="modal-split__actions" data-ref="auth-gate-actions">
            <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-auth-gate-register">
              ${t('auth_gate.btn_register')}
            </button>
            <button type="button" class="component-button component-button--h40 component-button--ghost component-button--w-full" data-ref="btn-auth-gate-login">
              ${t('auth_gate.btn_login')}
            </button>
            <p class="modal-split__footnote" data-ref="auth-gate-footnote">
              ${t('auth_gate.footnote_free')}
            </p>
          </div>
        </div>
        <div class="modal-split__right" data-ref="modal-split-right">
          <div class="modal-split__visual-stage" data-ref="auth-gate-visual-stage">
            <img class="modal-split__illustration" data-ref="auth-gate-banner-img" src="/images/modals/auth-gate-banner.svg" alt="BoardPDF" />
          </div>
        </div>
      </div>
    </div>
  `;

  translateElement(backdrop);
  renderIcons(backdrop);

  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card-auth-gate"]');
  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const registerBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-auth-gate-register"]');
  const loginBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-auth-gate-login"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref="modal-auth-gate-drag-zone"]');

  let isClosing = false;

  const instance: ModalInstance = {
    backdrop,
    body: card || document.createElement('div'),
    btnCancel: loginBtn as any,
    btnConfirm: registerBtn,
    cancelBtn: loginBtn,
    card,
    clearError() {},
    close() {
      if (isClosing) return;
      isClosing = true;

      backdrop.classList.remove('is-visible');
      document.removeEventListener('keydown', handleKeyDown);

      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        if (activeAuthGateModal === instance) {
          activeAuthGateModal = null;
        }
        if (document.querySelectorAll('.modal-backdrop.is-visible').length === 0) {
          document.body.classList.remove('modal-open');
        }
        if (onClose) onClose();
      }, 200);
    },
    closeBtn,
    confirmBtn: registerBtn,
    errorBanner: null,
    options: {} as any,
    setBody() {},
    setConfirmLoading() {},
    setConfirmText() {},
    setConfirmVisible() {},
    setDescription() {},
    setError() {},
    setOnConfirm() {},
    setTitle() {},
    showError() {},
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      instance.close();
    }
  };

  closeBtn?.addEventListener('click', () => instance.close());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      instance.close();
    }
  });

  registerBtn?.addEventListener('click', () => {
    instance.close();
    const query = returnUrl && returnUrl !== '/' ? `?redirect=${encodeURIComponent(returnUrl)}` : '';
    navigate(`/register${query}`);
  });

  loginBtn?.addEventListener('click', () => {
    instance.close();
    const query = returnUrl && returnUrl !== '/' ? `?redirect=${encodeURIComponent(returnUrl)}` : '';
    navigate(`/login${query}`);
  });

  document.addEventListener('keydown', handleKeyDown);

  if (dragZone && card) {
    setupSheetDragToDismiss(dragZone, card, backdrop, () => instance.close());
  }

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });

  activeAuthGateModal = instance;
  return instance;
}
