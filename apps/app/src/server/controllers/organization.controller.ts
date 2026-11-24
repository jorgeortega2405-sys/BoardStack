import { addAccountToSession } from '../services/auth.service.js';
import {
  addOrganizationMember,
  getOrCreateUserOrganization,
  getOrganizationMembers,
  processSsoLogin,
  removeOrganizationMember,
  resolveOrganizationByDomainOrSlug,
  updateOrganization,
} from '../services/organization.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getUserPermissions, getUserRoles } from '../services/role.service.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';
import { sanitizeUser } from '../utils/user.util.js';
import { sendError, sendSuccess } from '../utils/response.util.js';

async function getMyOrganizationHandler(req: Request, res: Response): Promise<void> {
  const user = getCurrentUser(req);
  if (!user) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  try {
    const { membersCount, org } = await getOrCreateUserOrganization(user.id, user.username, user.email);
    const host = req.get('host') || 'localhost:3000';
    const proto = req.protocol || 'http';
    const baseUrl = `${proto}://${host}`;

    sendSuccess(res, {
      isOwner: org.owner_id === user.id,
      membersCount,
      org,
      spAcsUrl: `${baseUrl}/api/auth/sso/saml/acs`,
      spEntityId: `${baseUrl}/api/auth/sso/saml/metadata`,
    });
  } catch (err: any) {
    logger.app.error('[Organization] Error fetching organization:', err);
    sendError(res, err.message || 'Error retrieving organization details.', 500);
  }
}

async function updateMyOrganizationHandler(req: Request, res: Response): Promise<void> {
  const user = getCurrentUser(req);
  if (!user) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  try {
    const updated = await updateOrganization(user.id, req.body || {});
    sendSuccess(res, { org: updated });
  } catch (err: any) {
    logger.app.error('[Organization] Error updating organization:', err);
    sendError(res, err.message || 'Error updating organization.', 400);
  }
}

async function getMembersHandler(req: Request, res: Response): Promise<void> {
  const user = getCurrentUser(req);
  if (!user) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  try {
    const { org } = await getOrCreateUserOrganization(user.id, user.username, user.email);
    const members = await getOrganizationMembers(org.id);
    sendSuccess(res, {
      members,
      seatsLimit: org.seats_limit,
      seatsUsed: members.length,
    });
  } catch (err: any) {
    logger.app.error('[Organization] Error fetching members:', err);
    sendError(res, err.message || 'Error retrieving member roster.', 500);
  }
}

async function addMemberHandler(req: Request, res: Response): Promise<void> {
  const user = getCurrentUser(req);
  if (!user) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const { email, role } = req.body || {};
  if (!email || typeof email !== 'string') {
    sendError(res, 'A valid email is required.', 400);
    return;
  }

  try {
    const { org } = await getOrCreateUserOrganization(user.id, user.username, user.email);
    if (org.owner_id !== user.id) {
      sendError(res, 'Only the organization owner can invite new members.', 403);
      return;
    }

    const member = await addOrganizationMember(org.id, email, role || 'member');
    sendSuccess(res, { member });
  } catch (err: any) {
    logger.app.error('[Organization] Error adding member:', err);
    sendError(res, err.message || 'Error adding member.', 400);
  }
}

async function removeMemberHandler(req: Request, res: Response): Promise<void> {
  const user = getCurrentUser(req);
  if (!user) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const memberId = Number(req.params.id);
  if (!memberId || isNaN(memberId)) {
    sendError(res, 'Invalid member identifier.', 400);
    return;
  }

  try {
    const { org } = await getOrCreateUserOrganization(user.id, user.username, user.email);
    if (org.owner_id !== user.id) {
      sendError(res, 'Only the organization owner can remove members.', 403);
      return;
    }

    await removeOrganizationMember(org.id, memberId, user.id);
    sendSuccess(res, { ok: true });
  } catch (err: any) {
    logger.app.error('[Organization] Error removing member:', err);
    sendError(res, err.message || 'Error removing member.', 400);
  }
}

async function resolveSsoHandler(req: Request, res: Response): Promise<void> {
  const { identifier } = req.body || {};
  if (!identifier || typeof identifier !== 'string') {
    sendError(res, 'Domain or corporate email is required.', 400);
    return;
  }

  try {
    const org = await resolveOrganizationByDomainOrSlug(identifier);
    if (!org) {
      sendError(res, 'No active SAML 2.0 organization found matching this domain or handle.', 404);
      return;
    }

    sendSuccess(res, {
      name: org.name,
      samlEntryPoint: org.saml_entry_point,
      samlIssuer: org.saml_issuer,
      slug: org.slug,
    });
  } catch (err: any) {
    logger.app.error('[SSO] Error resolving SSO:', err);
    sendError(res, err.message || 'Error resolving SSO domain.', 500);
  }
}

async function loginSsoHandler(req: Request, res: Response): Promise<void> {
  const { email, orgSlug } = req.body || {};
  if (!email || !orgSlug) {
    sendError(res, 'Email and organization handle are required.', 400);
    return;
  }

  try {
    const userRow = await processSsoLogin(email, orgSlug);
    const [roles, permissions] = await Promise.all([
      getUserRoles(userRow.id),
      getUserPermissions(userRow.id),
    ]);

    const userRowWithRoles = {
      ...userRow,
      permissions,
      roles,
    };

    const sanitized = sanitizeUser(userRowWithRoles);
    const session = await addAccountToSession(res, req, sanitized);

    sendSuccess(res, {
      accounts: session.accounts.map(sanitizeUser),
      message: 'SSO login successful.',
      user: sanitized,
    });
  } catch (err: any) {
    logger.auth.error('[SSO] Login failed:', err);
    sendError(res, err.message || 'SSO authentication error.', 400);
  }
}

async function getSamlMetadataHandler(req: Request, res: Response): Promise<void> {
  const host = req.get('host') || 'localhost:3000';
  const proto = req.protocol || 'http';
  const baseUrl = `${proto}://${host}`;
  const acsUrl = `${baseUrl}/api/auth/sso/saml/acs`;
  const entityId = `${baseUrl}/api/auth/sso/saml/metadata`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;

  res.type('application/xml').send(xml);
}

export {
  addMemberHandler,
  getMembersHandler,
  getMyOrganizationHandler,
  getSamlMetadataHandler,
  loginSsoHandler,
  removeMemberHandler,
  resolveSsoHandler,
  updateMyOrganizationHandler
};
