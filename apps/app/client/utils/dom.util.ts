import { i18n } from '../i18n/i18n.service.js';
import { toast } from '../services/toast.service.js';

function showElement(el: HTMLElement | null): void {
  if (el) {
    el.classList.remove('is-hidden');
    if (el.style.display === 'none') {
      el.style.display = '';
    }
  }
}

function hideElement(el: HTMLElement | null): void {
  if (el) {
    el.classList.add('is-hidden');
    el.style.display = 'none';
  }
}

function toggleElement(el: HTMLElement | null, show: boolean): void {
  if (show) {
    showElement(el);
  } else {
    hideElement(el);
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface DropdownOptions {
  onClose?: () => void;
  onOpen?: () => void;
  onSelect?: (value: string, item: HTMLElement) => void;
}

interface DropdownController {
  close: () => void;
  destroy: () => void;
  open: () => void;
  toggle: () => void;
  update: () => void;
}

const activeDropdownClosers = new Set<() => void>();

function setupSheetDragToDismiss(
  dragZone: HTMLElement,
  sheet: HTMLElement,
  backdrop: HTMLElement | null | undefined,
  onClose: () => void
): () => void {
  const existingCleanup = (dragZone as any).__dragCleanup;
  if (typeof existingCleanup === 'function') {
    existingCleanup();
  }

  dragZone.style.touchAction = 'none';

  let startY = 0;
  let isPointerDown = false;
  let isDragging = false;
  let dragDistance = 0;
  let activePointerId: number | null = null;
  let lastDragEndTime = 0;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const clearResetTimer = () => {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
  };

  const endDragStyles = () => {
    sheet.classList.remove('is-dragging');
    sheet.style.removeProperty('transform');
    sheet.style.removeProperty('transition');
    if (backdrop) {
      backdrop.style.removeProperty('background-color');
      backdrop.style.removeProperty('transition');
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (window.getComputedStyle(dragZone).display === 'none') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const target = e.target as HTMLElement | null;
    const isInteractive = target?.closest('button:not(.modal-card__drag-handle):not(.component-menu__drag-handle), input, select, textarea, a');
    if (isInteractive && !dragZone.contains(isInteractive)) return;

    clearResetTimer();
    startY = e.clientY;
    isPointerDown = true;
    isDragging = false;
    dragDistance = 0;
    activePointerId = e.pointerId;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isPointerDown || activePointerId !== e.pointerId) return;
    const deltaY = e.clientY - startY;

    if (!isDragging) {
      if (deltaY <= 5) return;
      isDragging = true;
      sheet.classList.add('is-dragging');
      sheet.style.setProperty('transition', 'none', 'important');
      if (backdrop) {
        backdrop.style.setProperty('transition', 'none', 'important');
      }
      try {
        dragZone.setPointerCapture(e.pointerId);
      } catch {}
    }

    const baseAlpha = document.documentElement.getAttribute('data-theme') === 'dark' ? 0.7 : 0.45;
    if (deltaY > 0) {
      dragDistance = deltaY;
      sheet.style.setProperty('transform', `translateY(${dragDistance}px)`, 'important');
      if (backdrop) {
        const bgAlpha = baseAlpha * Math.max(0, 1 - (dragDistance / 350));
        backdrop.style.setProperty('background-color', `rgba(0, 0, 0, ${bgAlpha.toFixed(3)})`, 'important');
      }
    } else {
      dragDistance = 0;
      sheet.style.setProperty('transform', 'translateY(0)', 'important');
      if (backdrop) {
        backdrop.style.setProperty('background-color', `rgba(0, 0, 0, ${baseAlpha})`, 'important');
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isPointerDown || activePointerId !== e.pointerId) return;
    isPointerDown = false;
    activePointerId = null;

    if (!isDragging) {
      return;
    }

    isDragging = false;
    sheet.classList.remove('is-dragging');
    lastDragEndTime = Date.now();

    try {
      dragZone.releasePointerCapture(e.pointerId);
    } catch {}

    const dismissThreshold = 80;
    if (dragDistance > dismissThreshold) {
      sheet.style.removeProperty('transition');
      sheet.style.removeProperty('transform');
      if (backdrop) {
        backdrop.style.removeProperty('background-color');
        backdrop.style.removeProperty('transition');
      }
      onClose();
      return;
    }

    const baseAlpha = document.documentElement.getAttribute('data-theme') === 'dark' ? 0.7 : 0.45;
    sheet.style.setProperty('transition', 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)', 'important');
    sheet.style.setProperty('transform', 'translateY(0)', 'important');
    if (backdrop) {
      backdrop.style.setProperty('transition', 'background-color 0.2s ease', 'important');
      backdrop.style.setProperty('background-color', `rgba(0, 0, 0, ${baseAlpha})`, 'important');
    }
    resetTimer = setTimeout(() => {
      resetTimer = null;
      endDragStyles();
    }, 200);
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (!isPointerDown || activePointerId !== e.pointerId) return;
    isPointerDown = false;
    activePointerId = null;
    if (!isDragging) return;
    isDragging = false;
    try {
      dragZone.releasePointerCapture(e.pointerId);
    } catch {}
    endDragStyles();
  };

  const onClickCapture = (e: MouseEvent) => {
    if (Date.now() - lastDragEndTime < 250) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  dragZone.addEventListener('pointerdown', onPointerDown);
  dragZone.addEventListener('pointermove', onPointerMove);
  dragZone.addEventListener('pointerup', onPointerUp);
  dragZone.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('click', onClickCapture, true);

  const cleanup = () => {
    clearResetTimer();
    dragZone.removeEventListener('pointerdown', onPointerDown);
    dragZone.removeEventListener('pointermove', onPointerMove);
    dragZone.removeEventListener('pointerup', onPointerUp);
    dragZone.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('click', onClickCapture, true);
    delete (dragZone as any).__dragCleanup;
  };

  (dragZone as any).__dragCleanup = cleanup;
  return cleanup;
}

function setupDropdown(wrapper: HTMLElement | null, options: DropdownOptions = {}): DropdownController {
  if (!wrapper) {
    return { close: () => {}, destroy: () => {}, open: () => {}, toggle: () => {}, update: () => {} };
  }

  const trigger = wrapper.querySelector<HTMLElement>('.component-dropdown__trigger, .dropdown-trigger, [data-ref*="trigger"]') || (wrapper.firstElementChild as HTMLElement | null);
  const backdrop = wrapper.querySelector<HTMLElement>('.component-menu-backdrop, .dropdown-backdrop, [data-ref*="backdrop"]');
  const menu = wrapper.querySelector<HTMLElement>('.component-menu--dropdown, .menu-panel--dropdown, [data-ref*="dropdown-menu"], [data-ref*="menu"]');
  const textEl = trigger?.querySelector<HTMLElement>('.component-dropdown__trigger-text, .dropdown-trigger__text, [data-ref*="selected-text"]');

  let dragZone = menu?.querySelector<HTMLElement>('.component-menu__drag-zone, .modal-card__drag-zone, [data-ref*="drag-zone"]');
  if (menu && !dragZone) {
    dragZone = document.createElement('div');
    dragZone.className = 'component-menu__drag-zone modal-card__drag-zone';
    dragZone.setAttribute('data-ref', 'dropdown-drag-zone');
    dragZone.setAttribute('aria-hidden', 'true');
    dragZone.innerHTML = '<div class="component-menu__drag-handle modal-card__drag-handle"></div>';
    menu.insertBefore(dragZone, menu.firstChild);
  }

  let isOpen = false;
  let isClosing = false;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const clearInlineStyles = () => {
    menu?.style.removeProperty('transform');
    menu?.style.removeProperty('transition');
    menu?.style.removeProperty('opacity');
    backdrop?.style.removeProperty('background-color');
    backdrop?.style.removeProperty('opacity');
    backdrop?.style.removeProperty('transition');
  };

  const finalizeClose = () => {
    isClosing = false;
    isOpen = false;
    closeTimer = null;
    wrapper.classList.remove('is-open');
    trigger?.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
    menu?.classList.remove('is-open');
    clearInlineStyles();
    if (document.querySelectorAll('.component-menu-backdrop.is-open, .dropdown-backdrop.is-open, .drawer-backdrop.is-open').length === 0) {
      document.body.classList.remove('dropdown-open');
    }
    options.onClose?.();
  };

  const close = (immediate = false) => {
    if (!isOpen && !menu?.classList.contains('is-open') && !wrapper.classList.contains('is-open')) return;
    if (isClosing && !immediate) return;

    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    if (immediate) {
      finalizeClose();
      return;
    }

    isClosing = true;
    isOpen = false;

    if (window.innerWidth <= 768) {
      menu?.style.setProperty('transition', 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)', 'important');
      menu?.style.setProperty('transform', 'translateY(100%)', 'important');
      if (backdrop) {
        backdrop.style.setProperty('transition', 'background-color 0.2s ease', 'important');
        backdrop.style.setProperty('background-color', 'transparent', 'important');
      }
    } else {
      menu?.style.setProperty('transition', 'opacity 0.18s ease, transform 0.18s ease', 'important');
      menu?.style.setProperty('opacity', '0', 'important');
      menu?.style.setProperty('transform', 'scale(0.96) translateY(-4px)', 'important');
    }

    closeTimer = setTimeout(finalizeClose, 200);
  };

  const closeImmediate = () => close(true);
  activeDropdownClosers.add(closeImmediate);

  const open = () => {
    if (isOpen && !isClosing) return;

    activeDropdownClosers.forEach((otherClose) => {
      if (otherClose !== closeImmediate) {
        otherClose();
      }
    });

    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    isClosing = false;
    isOpen = true;
    clearInlineStyles();

    wrapper.classList.add('is-open');
    trigger?.classList.add('is-open');
    backdrop?.classList.add('is-open');
    menu?.classList.add('is-open');
    document.body.classList.add('dropdown-open');

    const searchInput = menu?.querySelector<HTMLInputElement>('.component-menu__search-input, .menu-panel__search-input, [data-ref*="search"]');
    if (searchInput && window.innerWidth > 768) {
      setTimeout(() => searchInput.focus(), 60);
    }

    options.onOpen?.();
  };

  let dragCleanup: (() => void) | null = null;
  if (dragZone && menu && backdrop) {
    dragCleanup = setupSheetDragToDismiss(dragZone, menu, backdrop, () => close());
  }

  const toggle = () => {
    if (isOpen && !isClosing) {
      close();
    } else {
      open();
    }
  };

  const handleTriggerClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === backdrop) {
      close();
    }
  };

  const handleDocumentClick = (e: MouseEvent) => {
    if (!isOpen && !isClosing) return;
    const target = e.target as Node | null;
    if (target && !wrapper.contains(target) && !menu?.contains(target)) {
      close();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (isOpen || isClosing)) {
      close();
    }
  };

  const handleMenuClick = (e: MouseEvent) => {
    const item = (e.target as HTMLElement | null)?.closest<HTMLElement>('.component-menu__item, .menu-item, [data-val], [data-value], [data-lang]');
    if (!item || !menu?.contains(item)) return;

    e.preventDefault();
    const value = item.getAttribute('data-value') || item.getAttribute('data-val') || item.getAttribute('data-lang') || '';
    const label = item.querySelector('.component-menu__item-text, .menu-item__text')?.textContent || item.textContent || '';

    menu.querySelectorAll('.component-menu__item, .menu-item').forEach((mi) => mi.classList.remove('is-active'));
    item.classList.add('is-active');

    if (textEl && label.trim()) {
      textEl.textContent = label.trim();
    }

    const itemIcon = item.querySelector<SVGUseElement>('.component-menu__item-icon use, .menu-item__icon use')?.getAttribute('href');
    const triggerIcon = trigger?.querySelector<SVGUseElement>('.component-dropdown__trigger-icon use, .dropdown-trigger__icon use');
    if (triggerIcon && itemIcon) {
      triggerIcon.setAttribute('href', itemIcon);
    }

    options.onSelect?.(value, item);
    close();
  };

  trigger?.addEventListener('click', handleTriggerClick);
  backdrop?.addEventListener('click', handleBackdropClick);
  menu?.addEventListener('click', handleMenuClick);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeyDown);

  const destroy = () => {
    activeDropdownClosers.delete(closeImmediate);
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    if (dragCleanup) {
      dragCleanup();
      dragCleanup = null;
    }
    if (isOpen || isClosing) {
      close(true);
    }
    trigger?.removeEventListener('click', handleTriggerClick);
    backdrop?.removeEventListener('click', handleBackdropClick);
    menu?.removeEventListener('click', handleMenuClick);
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleKeyDown);
  };

  return {
    close: () => close(),
    destroy,
    open,
    toggle,
    update: () => {},
  };
}

interface RenderEmptyStateOptions {
  container: HTMLElement;
  dataRef?: string;
  desc: string;
  graphicType?: string;
  isTable?: boolean;
  title: string;
}

function renderEmptyState(options: RenderEmptyStateOptions): HTMLElement {
  removeEmptyState(options.container, options.dataRef);

  const emptyEl = document.createElement('div');
  emptyEl.className = `component-empty-state${options.isTable ? ' component-empty-state--table' : ''}`;
  if (options.dataRef) {
    emptyEl.setAttribute('data-ref', options.dataRef);
  }

  const graphicEl = document.createElement('div');
  graphicEl.className = 'component-empty-state-graphic';
  if (options.graphicType === 'search') {
    graphicEl.innerHTML = `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="62" cy="62" r="30" stroke="currentColor" stroke-width="3" fill="none" opacity="0.4"/><line x1="84" y1="84" x2="112" y2="112" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.4"/></svg>`;
  } else {
    graphicEl.innerHTML = `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="illCardGradSub" x1="25" y1="35" x2="115" y2="95" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#71717a"/><stop offset="50%" stop-color="#52525b"/><stop offset="100%" stop-color="#27272a"/></linearGradient></defs><rect x="30" y="42" width="80" height="54" rx="10" fill="url(#illCardGradSub)" stroke="#71717a" stroke-width="2"/><rect x="30" y="54" width="80" height="10" fill="#18181b"/><rect x="42" y="74" width="16" height="12" rx="3" fill="#e4e4e7" opacity="0.7"/><g transform="translate(86, 78)"><path d="M0 -8 L2.4 -2.5 L8.5 -2.5 L3.6 1.2 L5.5 7 L0 3.5 L-5.5 7 L-3.6 1.2 L-8.5 -2.5 L-2.4 -2.5 Z" fill="#fbbf24"/></g></svg>`;
  }

  const titleEl = document.createElement('h2');
  titleEl.className = 'component-empty-state-title';
  titleEl.textContent = options.title;

  const descEl = document.createElement('p');
  descEl.className = 'component-empty-state-desc';
  descEl.textContent = options.desc;

  emptyEl.appendChild(graphicEl);
  emptyEl.appendChild(titleEl);
  emptyEl.appendChild(descEl);

  options.container.appendChild(emptyEl);
  return emptyEl;
}

function removeEmptyState(container: HTMLElement, dataRef?: string): void {
  const selector = dataRef ? `[data-ref="${dataRef}"]` : '.component-empty-state';
  const existing = container.querySelector(selector);
  if (existing) {
    existing.remove();
  }
}

function setupSliderPill(
  container: HTMLElement | null,
  onSelect?: (index: number, tab: HTMLElement) => void
): () => void {
  if (!container) return () => {};
  const tabs = Array.from(container.querySelectorAll<HTMLElement>('.component-tab'));
  if (tabs.length === 0) return () => {};
  container.setAttribute('data-tabs', String(tabs.length));
  container.style.setProperty('--slider-tab-count', String(tabs.length));

  const clickListeners: Array<{ el: HTMLElement; listener: (e: MouseEvent) => void }> = [];

  tabs.forEach((tab, index) => {
    const listener = (e: MouseEvent) => {
      e.preventDefault();
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      container.setAttribute('data-active-index', String(index));
      container.style.setProperty('--slider-active-index', String(index));
      const cycle = tab.getAttribute('data-cycle');
      if (cycle) {
        container.setAttribute('data-cycle', cycle);
      }
      onSelect?.(index, tab);
    };
    tab.addEventListener('click', listener);
    clickListeners.push({ el: tab, listener });
  });

  return () => {
    clickListeners.forEach(({ el, listener }) => el.removeEventListener('click', listener));
  };
}

async function copyToClipboard(text: string, successMessage?: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage || i18n.t('common.copied'));
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) {
      toast.success(successMessage || i18n.t('common.copied'));
      return true;
    }
    toast.error(i18n.t('common.error'));
    return false;
  } catch {
    toast.error(i18n.t('common.error'));
    return false;
  }
}

function setButtonLoading(btn: HTMLElement | null, isLoading: boolean): void {
  if (!btn) return;
  const buttonEl = btn as HTMLButtonElement;
  if (isLoading) {
    if (!btn.hasAttribute('data-original-html')) {
      btn.setAttribute('data-original-html', btn.innerHTML);
    }
    btn.classList.add('is-loading');
    buttonEl.disabled = true;
    btn.innerHTML = `<span class="component-spinner" data-ref="btn-spinner" aria-hidden="true"></span>`;
  } else {
    const orig = btn.getAttribute('data-original-html');
    if (orig !== null) {
      btn.innerHTML = orig;
      btn.removeAttribute('data-original-html');
    }
    btn.classList.remove('is-loading');
    buttonEl.disabled = false;
  }
}

function setupPasswordToggle(toggleBtn: HTMLElement | null, input: HTMLInputElement | null): void {
  if (!toggleBtn || !input) return;
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    const icon = toggleBtn.querySelector<SVGUseElement>('use');
    if (icon) {
      icon.setAttribute('href', isPass ? '/icons.svg#visibility_off' : '/icons.svg#visibility');
    }
  });
}

export {
  copyToClipboard,
  escapeHtml,
  hideElement,
  removeEmptyState,
  renderEmptyState,
  setButtonLoading,
  setupDropdown,
  setupPasswordToggle,
  setupSheetDragToDismiss,
  setupSliderPill,
  showElement,
  toggleElement,
};

export type {
  DropdownController,
  DropdownOptions,
  RenderEmptyStateOptions,
};
