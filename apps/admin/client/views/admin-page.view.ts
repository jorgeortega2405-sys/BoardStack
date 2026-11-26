import type { AccessibleAdminApp, AdminPageSummary, AdminViewElement } from '../types/admin.types.js';
import { createAppDashboardView } from './app-dashboard.view.js';
import { createAppSalesView } from './app-sales.view.js';
import { createAppUsersView } from './app-users.view.js';
import { escapeHtml } from '../utils/dom.util.js';
import { getApi } from '../services/api.service.js';
import { getRoleLabel } from '../components/layout-user-menu.component.js';
import { i18n } from '../i18n/i18n.service.js';

interface PageAccessResponse {
  app?: AccessibleAdminApp;
  code?: string;
  error?: string;
  ok?: boolean;
  page?: AdminPageSummary;
}

async function createAdminPageView(
  app: AccessibleAdminApp,
  page: AdminPageSummary,
  onAccessDenied: () => Promise<void>
): Promise<AdminViewElement | null> {
  const normApp = app.slug.trim().toLowerCase();
  const normPage = page.slug.trim().toLowerCase();

  if (normApp === 'app' && normPage === 'dashboard') {
    return createAppDashboardView(app, onAccessDenied);
  }

  if (normApp === 'app' && normPage === 'sales') {
    return createAppSalesView(app, onAccessDenied);
  }

  if (normApp === 'app' && normPage === 'users') {
    return createAppUsersView(app, onAccessDenied);
  }

  const res = await getApi<PageAccessResponse>(
    `/api/admin/apps/${encodeURIComponent(app.slug)}/pages/${encodeURIComponent(page.slug)}`
  );

  if (!res.ok || !res.app || !res.page) {
    await onAccessDenied();
    return null;
  }

  const verifiedApp = res.app;
  const verifiedPage = res.page;
  const roleLabel = getRoleLabel(verifiedApp.roleSlug, verifiedApp.roleName);
  const pageTitle = i18n.t(verifiedPage.titleKey);

  const container = document.createElement('div') as AdminViewElement;
  container.className = 'component-container';
  container.setAttribute('data-ref', 'admin-page-container');
  container.setAttribute('data-app', verifiedApp.slug);
  container.setAttribute('data-page', verifiedPage.slug);

  container.innerHTML = `
    <div class="component-header" data-ref="admin-page-header">
      <div class="component-badge-group" data-ref="admin-page-badges">
        <span class="component-badge component-badge--sm component-badge--neutral" data-ref="admin-page-app-badge">${escapeHtml(verifiedApp.name)}</span>
        <span class="component-badge component-badge--sm" data-ref="admin-page-role-badge">${escapeHtml(roleLabel)}</span>
      </div>
      <h1 class="component-title" data-ref="admin-page-title">${escapeHtml(pageTitle)}</h1>
    </div>
  `;

  return container;
}

export {
  createAdminPageView
};
