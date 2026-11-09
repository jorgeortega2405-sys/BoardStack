import { setupSheetDragToDismiss } from './modal.component.js';
import { getLocalizedPath } from '../config/seo.config.js';
import { ALL_TOOLS_LIMITS } from '../config/subscription-plans.config.js';
import { currentUser } from '../services/api.service.js';
import { getCurrentLanguage, t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { ModalInstance } from '../types/common.types.js';
import { getTierWeight, normalizeTier } from '../utils/tier.util.js';

export interface UpgradeLimitModalOptions {
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

export function isLimitErrorMessage(message: string): boolean {
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

function detectToolId(optionsToolId?: string, optionsToolName?: string): string {
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

export function showUpgradeLimitModal(options: UpgradeLimitModalOptions): ModalInstance {
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

  const toolId = detectToolId(options.toolId, options.toolName);
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
    ? t('pricing.limit_modal_title_max', 'Límite máximo alcanzado')
    : targetTier === 'business'
      ? t('pricing.limit_modal_title_business', 'Mejora a Negocios')
      : t('pricing.limit_modal_title_pro', 'Mejora a Pro');

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

  const feat1 = t('pricing.limit_modal_feat_speed', 'Procesamiento prioritario ultrarrápido en la nube');
  const feat2 = targetTier === 'business'
    ? t('pricing.limit_modal_feat_team', 'Espacios colaborativos y gestión centralizada')
    : t('pricing.limit_modal_feat_tools', 'Acceso ilimitado a herramientas avanzadas y de IA');
  const feat3 = t('pricing.limit_modal_feat_limits', 'Sin colas de espera ni restricciones diarias');

  const pillHtml = isMaxTier
    ? `<div class="component-badge component-badge--warning modal-split__pill" data-ref="upgrade-pill"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#warning"></use></svg><span>${t('pricing.current_plan', 'Tu plan actual')}</span></div>`
    : targetTier === 'business'
      ? `<div class="component-badge component-badge--success modal-split__pill" data-ref="upgrade-pill"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#domain"></use></svg><span>BoardPDF Negocios</span></div>`
      : `<div class="component-badge component-badge--primary modal-split__pill" data-ref="upgrade-pill"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg><span>BoardPDF Pro</span></div>`;

  const actionText = !isLoggedIn
    ? t('auth.login.submit_btn', 'Iniciar sesión')
    : isMaxTier
      ? (t('common.close') || 'Entendido')
      : targetTier === 'business'
        ? t('pricing.upgrade_to_business', 'Mejorar a Negocios')
        : t('pricing.upgrade_to_pro', 'Mejorar a Pro');

  const footnoteHtml = !isLoggedIn
    ? `<p class="modal-split__footnote" data-ref="upgrade-footnote">${t('pricing.limit_modal_login_hint_text', '¿No tienes cuenta?')} <a class="link" data-ref="btn-upgrade-register" href="/register">${t('pricing.limit_modal_login_register_link', 'Regístrate gratis')}</a></p>`
    : isMaxTier
      ? ''
      : `<p class="modal-split__footnote" data-ref="upgrade-footnote">${t('pricing.limit_modal_cancel_hint', 'Cancela o cambia de plan en cualquier momento.')}</p>`;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-upgrade-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-upgrade-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="common.close" aria-label="${t('common.close')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--split modal-card--upgrade" data-ref="modal-card-upgrade">
        <div class="modal-card__drag-zone" data-ref="modal-upgrade-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="modal-split__left" data-ref="modal-split-left">
          <div class="modal-split__header modal-split__header--upgrade" data-ref="upgrade-header">
            ${pillHtml}
            <h2 class="modal-split__title modal-split__title--upgrade" data-ref="upgrade-title">${title}</h2>
          </div>
          <div class="modal-split__limit-body" data-ref="upgrade-body">
            <p class="modal-split__limit-notice" data-ref="limit-notice">${currentNotice}</p>
            ${benefitNotice ? `<p class="modal-split__limit-benefit" data-ref="limit-benefit">${benefitNotice}</p>` : ''}
            <ul class="modal-split__benefits-list" data-ref="upgrade-benefits-list">
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
          <div class="modal-split__actions modal-split__actions--upgrade" data-ref="upgrade-actions">
            <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-upgrade-submit">
              ${actionText}
            </button>
            ${footnoteHtml}
          </div>
        </div>
        <div class="modal-split__right modal-split__right--upgrade" data-ref="modal-split-right">
          <div class="modal-split__media-wrapper" data-ref="media-wrapper">
            <img class="modal-split__media-img" data-ref="upgrade-banner-img" src="/images/pro-banner.webp" alt="BoardPDF Plan" />
          </div>
          <div class="modal-split__right-status" data-ref="status-badge">
            <span class="modal-split__badge-check">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
            </span>
            <span class="modal-split__badge-text" data-ref="badge-text">${t('pricing.limit_modal_status_badge', 'Potencia tu flujo de trabajo')}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  translateElement(backdrop);
  renderIcons(backdrop);

  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card-upgrade"]');
  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const submitBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-upgrade-submit"]');
  const registerLink = backdrop.querySelector<HTMLAnchorElement>('[data-ref="btn-upgrade-register"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref="modal-upgrade-drag-zone"]');

  let isClosing = false;
  const close = () => {
    if (isClosing) return;
    isClosing = true;
    window.removeEventListener('keydown', handleKeyDown);
    backdrop.classList.add('is-closing');
    setTimeout(() => {
      backdrop.remove();
      if (activeUpgradeModal === modalInstance) {
        activeUpgradeModal = null;
      }
      if (typeof options.onClose === 'function') {
        options.onClose();
      }
    }, 200);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  closeBtn?.addEventListener('click', close);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      close();
    }
  });

  submitBtn?.addEventListener('click', () => {
    close();
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
    close();
    const current = window.location.pathname + window.location.search;
    navigate('/register?redirect=' + encodeURIComponent(current));
  });

  if (dragZone && card) {
    setupSheetDragToDismiss(dragZone, card, backdrop, close);
  }

  const modalInstance: ModalInstance = {
    backdrop,
    body: (card || backdrop) as HTMLElement,
    btnCancel: null,
    btnConfirm: submitBtn,
    cancelBtn: null,
    card,
    clearError: () => {},
    close,
    closeBtn: closeBtn as HTMLElement | null,
    confirmBtn: submitBtn,
    container: backdrop.querySelector<HTMLElement>('[data-ref="modal-upgrade-container"]'),
    errorBanner: null,
    options: {} as any,
    setBody: () => {},
    setConfirmLoading: () => {},
    setConfirmText: () => {},
    setConfirmVisible: () => {},
    setDescription: () => {},
    setOnConfirm: () => {},
    setTitle: () => {},
    showError: () => {},
  };

  activeUpgradeModal = modalInstance;
  document.body.appendChild(backdrop);
  return modalInstance;
}
