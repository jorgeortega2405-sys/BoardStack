import { Instance as PopperInstance, Placement, createPopper } from '@popperjs/core';
import { i18n } from '../i18n/i18n.service.js';

let activeTarget: HTMLElement | null = null;
let currentPopperInstance: PopperInstance | null = null;
let tooltipArrow: HTMLElement | null = null;
let tooltipEl: HTMLElement | null = null;
let tooltipText: HTMLElement | null = null;

function createTooltipElement(text: string): { arrow: HTMLElement; content: HTMLElement; el: HTMLElement } {
  const el = document.createElement('div');
  el.className = 'tooltip';
  el.setAttribute('data-ref', 'app-tooltip');
  el.setAttribute('role', 'tooltip');

  const content = document.createElement('span');
  content.className = 'tooltip__content';
  content.setAttribute('data-ref', 'tooltip-text');
  content.textContent = text;

  const arrow = document.createElement('div');
  arrow.className = 'tooltip__arrow';
  arrow.setAttribute('data-ref', 'tooltip-arrow');
  arrow.setAttribute('data-popper-arrow', '');

  el.appendChild(content);
  el.appendChild(arrow);

  return { arrow, content, el };
}

function resolveTooltipText(target: HTMLElement): string {
  const i18nKey = target.getAttribute('data-i18n-tooltip');
  if (i18nKey) {
    const translated = i18n.t(i18nKey);
    if (translated && translated !== i18nKey) {
      return translated;
    }
  }
  return target.getAttribute('data-tooltip') || '';
}

function showTooltip(target: HTMLElement | null): void {
  if (!target) return;
  if (window.innerWidth <= 768) return;

  const text = resolveTooltipText(target);
  if (!text || !text.trim()) {
    hideTooltip();
    return;
  }

  if (activeTarget === target && tooltipEl && tooltipText) {
    if (tooltipText.textContent !== text) {
      tooltipText.textContent = text;
      if (currentPopperInstance) {
        currentPopperInstance.update();
      }
    }
    return;
  }

  hideTooltip();

  const elements = createTooltipElement(text);
  tooltipEl = elements.el;
  tooltipText = elements.content;
  tooltipArrow = elements.arrow;
  activeTarget = target;

  document.body.appendChild(tooltipEl);

  const preferredPlacement = (target.getAttribute('data-tooltip-placement') || 'right') as Placement;

  currentPopperInstance = createPopper(target, tooltipEl, {
    modifiers: [
      {
        name: 'offset',
        options: { offset: [0, 6] },
      },
      {
        name: 'preventOverflow',
        options: { padding: 8 },
      },
      {
        name: 'arrow',
        options: { element: tooltipArrow, padding: 6 },
      },
    ],
    placement: preferredPlacement,
  });

  requestAnimationFrame(() => {
    tooltipEl?.classList.add('is-visible');
  });
}

function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
    tooltipText = null;
    tooltipArrow = null;
  }
  if (currentPopperInstance) {
    currentPopperInstance.destroy();
    currentPopperInstance = null;
  }
  activeTarget = null;
}

function initTooltips(): void {
  document.addEventListener('mouseover', (e: MouseEvent) => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip], [data-i18n-tooltip]');
    if (target) {
      showTooltip(target);
    }
  });

  document.addEventListener('mouseout', (e: MouseEvent) => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip], [data-i18n-tooltip]');
    if (target && target === activeTarget) {
      hideTooltip();
    }
  });

  document.addEventListener('click', () => {
    hideTooltip();
  });

  window.addEventListener('scroll', () => {
    hideTooltip();
  }, { passive: true });
}

export {
  hideTooltip,
  initTooltips,
  showTooltip
};