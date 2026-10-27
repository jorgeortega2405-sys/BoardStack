import { initRouter, navigate } from './app-router.js';
import { setupLayoutScrollSync } from './components/layout.component.js';
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
        const targetScroll = Math.max(0, Math.min(target.scrollTop, maxScrollBody));
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

function setupGlobalLinks(): void {
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
  if (currentPath === '/' || currentPath === '' || /^\/[a-z]{2}\/?$/i.test(currentPath)) {
    preloadTemplates(['/views/components/sidebar.html', '/views/home/home.html']);
  } else {
    preloadTemplates(['/views/components/sidebar.html']);
  }
  await Promise.all([initI18n(), checkAuthSession()]);
  initTooltips();
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
