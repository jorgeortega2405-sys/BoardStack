import { initRouter, navigate } from './app-router.js';
import { initGlobalDropzone } from './components/global-dropzone.component.js';
import { setupLayoutScrollSync } from './components/layout.component.js';
import { preloadRoute } from './config/routes.config.js';
import { checkAuthSession } from './services/api.service.js';
import { initI18n, translateElement } from './services/i18n.service.js';
import { preloadTemplates } from './services/template.service.js';
import { initTooltips } from './services/tooltip.service.js';

let isSyncing = false;

function handleScrollEvent(e: Event): void {
  const target = e.target as HTMLElement | null;
  if (!target || target.nodeType !== 1) return;

  if (target.classList.contains('layout-content')) {
    if (!isSyncing) {
      const scrollableBody = target.querySelector<HTMLElement>(
        '.view-scrollable, .home-scrollable, .layout-body--scrollable, .layout-scrollable'
      );
      if (scrollableBody) {
        const maxScrollBody = Math.max(0, scrollableBody.scrollHeight - scrollableBody.clientHeight);
        let maxScrollTarget = Math.max(0, target.scrollHeight - target.clientHeight);
        if (Math.abs(maxScrollTarget - maxScrollBody) > 2) {
          if (maxScrollBody <= 0) {
            target.style.removeProperty('--layout-scroll-height');
          } else {
            target.style.setProperty('--layout-scroll-height', `${target.clientHeight + maxScrollBody}px`);
          }
          maxScrollTarget = Math.max(0, target.scrollHeight - target.clientHeight);
        }
        let targetScroll = 0;
        if (maxScrollBody > 0 && maxScrollTarget > 0) {
          targetScroll = target.scrollTop >= maxScrollTarget - 2
            ? maxScrollBody
            : Math.min(maxScrollBody, (target.scrollTop / maxScrollTarget) * maxScrollBody);
        }
        if (Math.abs(scrollableBody.scrollTop - targetScroll) > 0.25) {
          isSyncing = true;
          scrollableBody.scrollTop = targetScroll;
          isSyncing = false;
        }
      }
    }

    const isScrolled = target.scrollTop > 0;
    const header = document.querySelector<HTMLElement>('.layout-header, .general-content-top');
    if (header) {
      header.classList.toggle('shadow', isScrolled);
      header.classList.toggle('layout-header--shadow', isScrolled);
    }
  }
}

function initScrollShadow(): void {
  setupLayoutScrollSync();
  document.addEventListener('scroll', handleScrollEvent, { capture: true, passive: true });
}

function resolvePrefetchTarget(targetEl: HTMLElement | null): string | null {
  if (!targetEl) return null;

  const declarativeNav = targetEl.closest<HTMLElement>('[data-navigate]');
  if (declarativeNav) {
    return declarativeNav.getAttribute('data-navigate');
  }

  const toolCard = targetEl.closest<HTMLElement>('[data-tool-path]');
  if (toolCard) {
    return toolCard.getAttribute('data-tool-path');
  }

  const railProjects = targetEl.closest<HTMLElement>('[data-ref="rail-item-projects"], [data-ref="btn-rail-projects"]');
  if (railProjects) {
    return '/projects';
  }

  const railHome = targetEl.closest<HTMLElement>('[data-ref="rail-item-home"], [data-ref="btn-rail-home"]');
  if (railHome) {
    return '/';
  }

  const railLogin = targetEl.closest<HTMLElement>('[data-ref="rail-item-login"], [data-ref="btn-rail-login"]');
  if (railLogin) {
    return '/login';
  }

  const anchor = targetEl.closest<HTMLAnchorElement>('a[href]');
  if (anchor && anchor.origin === window.location.origin) {
    const href = anchor.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:') && anchor.getAttribute('target') !== '_blank' && !anchor.hasAttribute('download')) {
      return href;
    }
  }

  return null;
}

function setupGlobalLinks(): void {
  const handlePrefetch = (e: Event) => {
    const dest = resolvePrefetchTarget(e.target as HTMLElement | null);
    if (dest) {
      preloadRoute(dest);
    }
  };

  document.addEventListener('pointerover', handlePrefetch, { passive: true });
  document.addEventListener('focusin', handlePrefetch, { passive: true });

  document.addEventListener('click', (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const targetEl = e.target as HTMLElement | null;
    const declarativeNav = targetEl?.closest<HTMLElement>('[data-navigate]');
    if (declarativeNav) {
      const dest = declarativeNav.getAttribute('data-navigate');
      if (dest) {
        e.preventDefault();
        navigate(dest);
        return;
      }
    }

    const anchor = targetEl?.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || anchor.getAttribute('target') === '_blank' || anchor.hasAttribute('download')) {
      return;
    }

    if (anchor.origin === window.location.origin) {
      e.preventDefault();
      navigate(href);
    }
  });
}

async function initApp(): Promise<void> {
  const currentPath = window.location.pathname;
  preloadTemplates(['/views/components/sidebar.html']);
  preloadRoute(currentPath);
  await Promise.all([initI18n(), checkAuthSession()]);
  initTooltips();
  initGlobalDropzone();
  setupGlobalLinks();
  initScrollShadow();
  translateElement(document.body);
  initRouter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initApp();
  });
} else {
  void initApp();
}
