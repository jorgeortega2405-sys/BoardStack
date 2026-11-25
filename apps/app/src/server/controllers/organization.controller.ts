import {
  addOrganizationMember,
  getOrCreateUserOrganization,
  getOrganizationMembers,
  processSsoLogin,
  removeOrganizationMember,
  resolveOrganizationByDomainOrSlug,
  resolveOrganizationByIssuer,
  updateOrganization,
  updateOrganizationSeats,
} from '../services/organization.service.js';
import { completeUserLogin } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';
import { requireAuthenticatedUser, sendError, sendSuccess } from '../utils/response.util.js';

async function getMyOrganizationHandler(req: Request, res: Response): Promise<void> {
  const user = requireAuthenticatedUser(req, res, 'Authentication required.');
  if (!user) return;

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
  const user = requireAuthenticatedUser(req, res, 'Authentication required.');
  if (!user) return;

  try {
    const updated = await updateOrganization(user.id, req.body || {});
    sendSuccess(res, { org: updated });
  } catch (err: any) {
    logger.app.error('[Organization] Error updating organization:', err);
    sendError(res, err.message || 'Error updating organization.', 400);
  }
}

async function getMembersHandler(req: Request, res: Response): Promise<void> {
  const user = requireAuthenticatedUser(req, res, 'Authentication required.');
  if (!user) return;

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
  const user = requireAuthenticatedUser(req, res, 'Authentication required.');
  if (!user) return;

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
  const user = requireAuthenticatedUser(req, res, 'Authentication required.');
  if (!user) return;

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

async function samlAcsHandler(req: Request, res: Response): Promise<void> {
  const samlResponseRaw = req.body?.SAMLResponse || req.body?.samlResponse;
  if (!samlResponseRaw || typeof samlResponseRaw !== 'string') {
    sendError(res, 'Missing SAMLResponse payload.', 400);
    return;
  }

  try {
    const xml = Buffer.from(samlResponseRaw, 'base64').toString('utf-8');
    const nameIdMatch = xml.match(/<(?:\w+:)?NameID[^>]*>([^<]+)<\/(?:\w+:)?NameID>/i);
    const issuerMatch = xml.match(/<(?:\w+:)?Issuer[^>]*>([^<]+)<\/(?:\w+:)?Issuer>/i);

    if (!nameIdMatch || !nameIdMatch[1]) {
      sendError(res, 'SAML assertion does not contain a valid NameID.', 400);
      return;
    }

    const email = nameIdMatch[1].trim().toLowerCase();
    const issuer = issuerMatch && issuerMatch[1] ? issuerMatch[1].trim() : '';

    let org = await resolveOrganizationByDomainOrSlug(email);
    if (!org && issuer) {
      org = await resolveOrganizationByIssuer(issuer);
    }

    if (!org) {
      sendError(res, 'Organization not found or SAML SSO is disabled.', 404);
      return;
    }

    if (org.saml_cert && org.saml_cert.trim().length > 0) {
      const cleanCert = org.saml_cert.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
      const xmlWithoutWs = xml.replace(/\s+/g, '');
      if (!xmlWithoutWs.includes(cleanCert)) {
        sendError(res, 'SAML response signature certificate does not match organization configuration.', 401);
        return;
      }
    }

    const notOnOrAfterMatch = xml.match(/NotOnOrAfter="([^"]+)"/i);
    if (notOnOrAfterMatch && notOnOrAfterMatch[1]) {
      const expiry = new Date(notOnOrAfterMatch[1]).getTime();
      if (!isNaN(expiry) && Date.now() > expiry + 300000) {
        sendError(res, 'SAML assertion has expired.', 401);
        return;
      }
    }

    const userRow = await processSsoLogin(email, org.slug);
    const { accounts, user } = await completeUserLogin(res, req, userRow);

    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      res.redirect('/');
      return;
    }

    sendSuccess(res, {
      accounts,
      message: 'SSO login successful.',
      user,
    });
  } catch (err: any) {
    logger.auth.error('[SSO] ACS processing failed:', err);
    sendError(res, err.message || 'SAML authentication error.', 400);
  }
}

async function loginSsoHandler(req: Request, res: Response): Promise<void> {
  const samlResponseRaw = req.body?.SAMLResponse || req.body?.samlResponse;
  if (samlResponseRaw && typeof samlResponseRaw === 'string') {
    await samlAcsHandler(req, res);
    return;
  }
  sendError(res, 'Direct unauthenticated SSO login is disabled. Please authenticate via your organization Identity Provider.', 403);
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

async function updateSeatsHandler(req: Request, res: Response): Promise<void> {
  const user = requireAuthenticatedUser(req, res, 'Authentication required.');
  if (!user) return;

  const { seats } = req.body || {};
  const parsedSeats = typeof seats === 'number' ? Math.floor(seats) : parseInt(String(seats), 10);
  if (isNaN(parsedSeats) || parsedSeats < 3 || parsedSeats > 100) {
    sendError(res, 'Valid seat count between 3 and 100 is required.', 400);
    return;
  }

  try {
    const { org } = await getOrCreateUserOrganization(user.id, user.username, user.email);
    if (org.owner_id !== user.id) {
      sendError(res, 'Only the organization owner can manage team seats.', 403);
      return;
    }

    const updated = await updateOrganizationSeats(user.id, org.id, parsedSeats);
    sendSuccess(res, updated);
  } catch (err: any) {
    logger.app.error('[Organization] Error updating seats:', err);
    sendError(res, err.message || 'Error updating team seats.', 400);
  }
}

export {
  addMemberHandler,
  getMembersHandler,
  getMyOrganizationHandler,
  getSamlMetadataHandler,
  loginSsoHandler,
  removeMemberHandler,
  resolveSsoHandler,
  samlAcsHandler,
  updateMyOrganizationHandler,
  updateSeatsHandler
};
