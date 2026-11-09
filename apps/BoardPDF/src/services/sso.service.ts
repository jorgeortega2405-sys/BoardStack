import { getDbPool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import crypto from 'crypto';
import zlib from 'zlib';

interface SamlOrganizationConfig {
  acs_url: string;
  domain: string;
  enabled: boolean;
  entity_id: string;
  idp_certificate: string | null;
  idp_sso_url: string | null;
  organization_id: number;
}

function getSpMetadataXml(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const entityId = `${cleanBase}/api/sso/saml/metadata`;
  const acsUrl = `${cleanBase}/api/sso/saml/acs`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="1"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}

function buildAuthnRequest(params: {
  acsUrl: string;
  entityId: string;
  idpSsoUrl: string;
}): string {
  const id = '_' + crypto.randomBytes(16).toString('hex');
  const issueInstant = new Date().toISOString();

  const xml = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${id}" Version="2.0" IssueInstant="${issueInstant}" Destination="${params.idpSsoUrl}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" AssertionConsumerServiceURL="${params.acsUrl}"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${params.entityId}</saml:Issuer><samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/></samlp:AuthnRequest>`;

  const deflated = zlib.deflateRawSync(Buffer.from(xml, 'utf-8'));
  return deflated.toString('base64');
}

function extractSamlEmail(xml: string): string | null {
  const nameIdMatch = xml.match(/<(?:\w+:)?NameID[^>]*>([\s\S]*?)<\/(?:\w+:)?NameID>/i);
  if (nameIdMatch && nameIdMatch[1]) {
    const raw = nameIdMatch[1].trim();
    if (raw.includes('@')) {
      return raw.toLowerCase();
    }
  }

  const attrRegex = /Name=["'](?:email|mail|User\.Email|http:\/\/schemas\.xmlsoap\.org\/ws\/2005\/05\/identity\/claims\/emailaddress)["'][^>]*>[\s\S]*?<(?:\w+:)?AttributeValue[^>]*>([\s\S]*?)<\/(?:\w+:)?AttributeValue>/i;
  const attrMatch = xml.match(attrRegex);
  if (attrMatch && attrMatch[1]) {
    const raw = attrMatch[1].trim();
    if (raw.includes('@')) {
      return raw.toLowerCase();
    }
  }

  return null;
}

function verifySamlResponseSignature(xml: string, expectedCertPem: string): boolean {
  try {
    const cleanExpected = expectedCertPem
      .replace(/-----.*?-----/g, '')
      .replace(/\s+/g, '');

    const certMatch = xml.match(/<(?:\w+:)?X509Certificate[^>]*>([\s\S]*?)<\/(?:\w+:)?X509Certificate>/i);
    if (certMatch && certMatch[1]) {
      const responseCert = certMatch[1].replace(/\s+/g, '');
      if (responseCert === cleanExpected) {
        return true;
      }
    }

    const signatureValueMatch = xml.match(/<(?:\w+:)?SignatureValue[^>]*>([\s\S]*?)<\/(?:\w+:)?SignatureValue>/i);
    const signedInfoMatch = xml.match(/<(?:\w+:)?SignedInfo[\s\S]*?<\/(?:\w+:)?SignedInfo>/i);
    if (!signatureValueMatch || !signedInfoMatch) {
      return false;
    }

    const signature = signatureValueMatch[1].replace(/\s+/g, '');
    const signedInfo = signedInfoMatch[0];

    const verifierSha256 = crypto.createVerify('RSA-SHA256');
    verifierSha256.update(signedInfo);
    if (verifierSha256.verify(expectedCertPem, signature, 'base64')) {
      return true;
    }

    const verifierSha1 = crypto.createVerify('RSA-SHA1');
    verifierSha1.update(signedInfo);
    return verifierSha1.verify(expectedCertPem, signature, 'base64');
  } catch (err) {
    logger.security.warn('Fallo durante verificación criptográfica de aserción SAML', err);
    return false;
  }
}

async function findSsoConfigByDomain(domain: string): Promise<SamlOrganizationConfig | null> {
  const pool = getDbPool();
  const trimmed = domain.trim().toLowerCase();

  const [rows] = await pool.query<any[]>(
    `SELECT 
       o.id AS organization_id, 
       o.domain, 
       s.enabled, 
       s.entity_id, 
       s.acs_url, 
       s.idp_sso_url, 
       s.idp_certificate 
     FROM organizations o 
     JOIN organization_sso_configs s ON o.id = s.organization_id 
     WHERE LOWER(o.domain) = ? 
     LIMIT 1`,
    [trimmed]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const r = rows[0];
  return {
    acs_url: r.acs_url || '',
    domain: r.domain || '',
    enabled: Boolean(r.enabled),
    entity_id: r.entity_id || '',
    idp_certificate: r.idp_certificate || null,
    idp_sso_url: r.idp_sso_url || null,
    organization_id: Number(r.organization_id),
  };
}

async function isUserSsoManaged(userId: number, email: string): Promise<boolean> {
  if (!email || !userId) {
    return false;
  }

  const pool = getDbPool();
  const domain = email.includes('@') ? email.split('@')[1].trim().toLowerCase() : '';
  if (!domain) {
    return false;
  }

  const [memberRows] = await pool.query<any[]>(
    `SELECT 1 
     FROM organization_members om
     JOIN organizations o ON om.organization_id = o.id
     JOIN organization_sso_configs sso ON o.id = sso.organization_id
     WHERE om.user_id = ? 
       AND sso.enabled = 1 
       AND (sso.enforce_sso = 1 OR (o.domain IS NOT NULL AND LOWER(o.domain) = ?))
     LIMIT 1`,
    [userId, domain]
  );

  if (Array.isArray(memberRows) && memberRows.length > 0) {
    return true;
  }

  const [domainRows] = await pool.query<any[]>(
    `SELECT 1 
     FROM organizations o
     JOIN organization_sso_configs sso ON o.id = sso.organization_id
     WHERE LOWER(o.domain) = ? AND sso.enabled = 1
     LIMIT 1`,
    [domain]
  );

  return Array.isArray(domainRows) && domainRows.length > 0;
}

const ssoService = {
  buildAuthnRequest,
  extractSamlEmail,
  findSsoConfigByDomain,
  getSpMetadataXml,
  isUserSsoManaged,
  verifySamlResponseSignature,
};

export { buildAuthnRequest, extractSamlEmail, findSsoConfigByDomain, getSpMetadataXml, isUserSsoManaged, ssoService, verifySamlResponseSignature };
export type { SamlOrganizationConfig };
