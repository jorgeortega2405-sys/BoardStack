import { t } from '../services/i18n.service.js';
import { navigate } from '../services/navigation.service.js';
import { ModalInstance } from '../types/common.types.js';
import { openModal } from './modal.component.js';

export interface UpgradeLimitModalOptions {
  currentCount?: number;
  currentLimit: number;
  fileName?: string;
  onClose?: () => void;
  proLimit?: number | string;
  toolName?: string;
  type: 'file_size' | 'files_count' | 'total_size';
}

export function isLimitErrorMessage(message: string): boolean {
  if (!message) return false;
  return /plan|l[ií]mite|pro|suscripci[oó]n|archivos por tarea|supera el l[ií]mite|m[aá]ximo de \d+ archivos/i.test(message);
}

export function showUpgradeLimitModal(options: UpgradeLimitModalOptions): ModalInstance {
  const isHighTier = options.currentLimit >= 500;
  let title = isHighTier ? 'Límite máximo alcanzado' : 'Límite del plan alcanzado';
  let description = '';

  const cleanProLimit = options.proLimit ? String(options.proLimit).replace(/\s*archivos/gi, '').trim() : '500';

  if (options.type === 'files_count') {
    const countInfo = options.currentCount ? ` (has seleccionado ${options.currentCount})` : '';
    if (isHighTier) {
      title = 'Límite de archivos alcanzado';
      description = `Has seleccionado ${options.currentCount || ''} archivos. Has alcanzado el límite máximo permitido de ${options.currentLimit} archivos por tarea para tu plan.`;
    } else {
      title = 'Límite de archivos alcanzado';
      description = `Tu plan actual permite procesar hasta ${options.currentLimit} archivos por tarea${countInfo}. Actualiza a Pro para procesar hasta ${cleanProLimit} archivos en una sola tarea.`;
    }
  } else if (options.type === 'file_size') {
    const fileInfo = options.fileName ? `El archivo "${options.fileName}"` : 'El archivo seleccionado';
    if (isHighTier) {
      title = 'Tamaño máximo de archivo alcanzado';
      description = `${fileInfo} supera el tamaño máximo permitido de ${options.currentLimit} MB para tu plan.`;
    } else {
      title = 'Límite de tamaño por archivo';
      description = `${fileInfo} supera el límite de ${options.currentLimit} MB por archivo de tu plan actual. Actualiza a Pro para subir archivos de hasta 1,000 MB.`;
    }
  } else if (options.type === 'total_size') {
    if (isHighTier) {
      title = 'Tamaño total del lote alcanzado';
      description = `El tamaño acumulado de los archivos supera el límite máximo permitido de ${options.currentLimit} MB de tu plan.`;
    } else {
      title = 'Límite total por tarea excedido';
      description = `El tamaño acumulado de los archivos supera el límite de ${options.currentLimit} MB de tu plan actual. Actualiza a Pro para procesar hasta 2,000 MB en un solo lote.`;
    }
  }

  const bodyHtml = isHighTier ? '' : `
    <div class="upgrade-limit-card" data-ref="upgrade-limit-card">
      <div class="upgrade-limit-card__header" data-ref="upgrade-limit-card-header">
        <div class="upgrade-limit-card__pill" data-ref="upgrade-limit-pill">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
          <span>BoardPDF Pro</span>
        </div>
        <span class="upgrade-limit-card__title" data-ref="upgrade-limit-title">Aumenta tus límites al instante</span>
      </div>
      <ul class="upgrade-limit-card__list" data-ref="upgrade-limit-list">
        <li class="upgrade-limit-card__item" data-ref="upgrade-limit-item-files">
          <svg class="component-icon upgrade-limit-card__icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
          <span><strong>Hasta 500 archivos por tarea</strong> en herramientas por lote</span>
        </li>
        <li class="upgrade-limit-card__item" data-ref="upgrade-limit-item-size">
          <svg class="component-icon upgrade-limit-card__icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
          <span><strong>Hasta 1 GB (1,000 MB)</strong> por archivo individual</span>
        </li>
        <li class="upgrade-limit-card__item" data-ref="upgrade-limit-item-speed">
          <svg class="component-icon upgrade-limit-card__icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
          <span><strong>Procesamiento ultrarrápido</strong> en la nube sin filas de espera</span>
        </li>
        <li class="upgrade-limit-card__item" data-ref="upgrade-limit-item-ai">
          <svg class="component-icon upgrade-limit-card__icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
          <span><strong>Acceso ilimitado</strong> a OCR, traducción y herramientas avanzadas de IA</span>
        </li>
      </ul>
    </div>
  `;

  const modal = openModal({
    bodyHtml,
    cancelText: t('common.close') || 'Entendido',
    confirmClass: 'component-button--black',
    confirmText: isHighTier ? (t('common.close') || 'Entendido') : 'Actualizar a Pro',
    description,
    onClose: options.onClose,
    onConfirm: () => {
      modal.close();
      if (!isHighTier) {
        navigate('/pricing');
      }
    },
    showCancel: !isHighTier,
    showConfirm: true,
    size: 'sm',
    title,
  });

  return modal;
}
