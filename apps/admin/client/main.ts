import { i18n, t } from './i18n/i18n.service.js';
import { initTooltips } from './services/tooltip.service.js';
import { layoutNav } from './components/layout-nav.component.js';
import { showToast, toast } from './services/toast.service.js';
import { themeService } from './services/theme.service.js';

declare global {
  interface Window {
    i18n: typeof i18n;
    showToast: typeof showToast;
    t: typeof t;
    themeService: typeof themeService;
    toast: typeof toast;
  }
}

if (typeof window !== 'undefined') {
  window.toast = toast;
  window.showToast = showToast;
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
  showToast,
  toast
};
