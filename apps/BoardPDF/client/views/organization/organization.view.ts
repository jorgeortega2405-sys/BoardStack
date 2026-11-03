import { createOrgDashboardView } from './organization-dashboard.view.js';
import { createOrgMembersView } from './organization-members.view.js';
import { createOrgSsoView } from './organization-sso.view.js';

export async function createOrganizationView(path: string): Promise<HTMLElement> {
  if (path === '/organization/members') {
    return await createOrgMembersView();
  }
  if (path === '/organization/sso' || path === '/organization/saml') {
    return await createOrgSsoView();
  }
  return await createOrgDashboardView();
}

export { createOrgDashboardView } from './organization-dashboard.view.js';
export { createOrgMembersView } from './organization-members.view.js';
export { createOrgSsoView } from './organization-sso.view.js';
