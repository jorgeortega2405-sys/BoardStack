import { INVALID_SAML_CERT_CORRUPT, INVALID_SAML_CERT_NO_PEM, INVALID_SAML_CERT_SHORT, INVALID_SAML_METADATA_NO_CERT, INVALID_SAML_METADATA_NO_SSO, TEST_USERS, VALID_SAML_CERT, VALID_SAML_METADATA_XML } from './helpers/fixtures.js';
import { createTestSessionCookie, EphemeralServer, resetOrganizationStore, restoreOriginalService, startMockServer } from './helpers/mock-server.helper.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

describe('Feature F18: Organization SSO / SAML 2.0 Configuration Suite', () => {
  let serverCtx: EphemeralServer;
  let ownerCookie: string;

  before(async () => {
    serverCtx = await startMockServer();
    ownerCookie = createTestSessionCookie(TEST_USERS.enterpriseOwner);
  });

  after(async () => {
    restoreOriginalService();
    await serverCtx.close();
  });

  beforeEach(() => {
    resetOrganizationStore();
  });

  describe('TC-SSO-01: Initial SSO Configuration State', () => {
    it('returns initial SSO configuration with enabled: false', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        headers: { Cookie: ownerCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(data.sso, 'Response should contain sso object');
      assert.strictEqual(data.sso.enabled, false);
      assert.strictEqual(data.sso.enforce_sso, false);
      assert.strictEqual(data.sso.entity_id, '');
      assert.strictEqual(data.sso.acs_url, '');
      assert.strictEqual(data.sso.has_certificate, false);
      assert.strictEqual(data.sso.has_metadata_xml, false);
    });
  });

  describe('TC-SSO-02: Draft Configuration (enabled: false)', () => {
    it('saves draft parameters with enabled: false without triggering strict validation', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: false,
          entity_id: 'draft-idp-id',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.sso.enabled, false);
      assert.strictEqual(data.sso.entity_id, 'draft-idp-id');
    });
  });

  describe('TC-SSO-03: Parameter Validation When Activating SAML (enabled: true)', () => {
    it('returns 400 when entity_id is missing or empty', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: true,
          entity_id: '',
          idp_certificate: VALID_SAML_CERT,
          idp_sso_url: 'https://idp.enterprise.com/sso',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Entity ID'));
    });

    it('returns 400 when entity_id is not a valid URL or URN', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: true,
          entity_id: 'not_a_valid_url_or_urn',
          idp_certificate: VALID_SAML_CERT,
          idp_sso_url: 'https://idp.enterprise.com/sso',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('URL válida (http o https) o un URN'));
    });

    it('returns 400 when acs_url is missing or empty', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: '',
          enabled: true,
          entity_id: 'https://idp.enterprise.com/metadata',
          idp_certificate: VALID_SAML_CERT,
          idp_sso_url: 'https://idp.enterprise.com/sso',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('URL ACS'));
    });

    it('returns 400 when acs_url is invalid protocol (e.g. ftp or javascript)', async () => {
      const invalidUrls = ['ftp://invalid.com/acs', 'javascript:alert(1)', 'invalid-url'];
      for (const acs_url of invalidUrls) {
        const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
          body: JSON.stringify({
            acs_url,
            enabled: true,
            entity_id: 'https://idp.enterprise.com/metadata',
            idp_certificate: VALID_SAML_CERT,
            idp_sso_url: 'https://idp.enterprise.com/sso',
          }),
          headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
          method: 'PUT',
        });
        assert.strictEqual(res.status, 400, `Expected 400 for ACS URL: ${acs_url}`);
        const data = await res.json();
        assert.ok(data.error.includes('URL ACS'));
      }
    });

    it('returns 400 when both certificate and XML metadata are missing', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: true,
          entity_id: 'https://idp.enterprise.com/metadata',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('certificado') || data.error.includes('metadatos XML'));
    });

    it('returns 400 when certificate is missing PEM header/footer', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: true,
          entity_id: 'https://idp.enterprise.com/metadata',
          idp_certificate: INVALID_SAML_CERT_NO_PEM,
          idp_sso_url: 'https://idp.enterprise.com/sso',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('PEM'));
    });

    it('returns 400 when certificate Base64 content is too short (<64 chars)', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: true,
          entity_id: 'https://idp.enterprise.com/metadata',
          idp_certificate: INVALID_SAML_CERT_SHORT,
          idp_sso_url: 'https://idp.enterprise.com/sso',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Base64'));
    });

    it('returns 400 when certificate Base64 content contains invalid characters', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: true,
          entity_id: 'https://idp.enterprise.com/metadata',
          idp_certificate: INVALID_SAML_CERT_CORRUPT,
          idp_sso_url: 'https://idp.enterprise.com/sso',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Base64'));
    });
  });

  describe('TC-SSO-04: XML Metadata Extraction and Validation', () => {
    it('successfully extracts parameters from valid SAML metadata XML and enables SAML', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: true,
          idp_metadata_xml: VALID_SAML_METADATA_XML,
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.sso.enabled, true);
      assert.strictEqual(data.sso.entity_id, 'https://idp.enterprise.com/saml2/metadata');
      assert.strictEqual(data.sso.idp_sso_url, 'https://idp.enterprise.com/saml2/sso');
      assert.strictEqual(data.sso.has_certificate, true);
      assert.strictEqual(data.sso.has_metadata_xml, true);
    });

    it('returns 400 when XML metadata is missing X.509 certificate', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: true,
          idp_metadata_xml: INVALID_SAML_METADATA_NO_CERT,
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('certificado'));
    });

    it('returns 400 when XML metadata is missing SingleSignOnService Location', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: true,
          idp_metadata_xml: INVALID_SAML_METADATA_NO_SSO,
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('URL SSO'));
    });
  });

  describe('TC-SSO-05: enforce_sso Safety Invariant', () => {
    it('normalizes enforce_sso to false when enabled is false', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          enabled: false,
          enforce_sso: true,
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.sso.enabled, false);
      assert.strictEqual(data.sso.enforce_sso, false, 'enforce_sso cannot be true when enabled is false');
    });

    it('allows enforce_sso to be true when enabled is true with valid credentials', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          enabled: true,
          enforce_sso: true,
          entity_id: 'https://idp.enterprise.com/metadata',
          idp_certificate: VALID_SAML_CERT,
          idp_sso_url: 'https://idp.enterprise.com/sso',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.sso.enabled, true);
      assert.strictEqual(data.sso.enforce_sso, true);
    });
  });

  describe('TC-SSO-06: Configuration Persistence Roundtrip', () => {
    it('persists configuration changes and returns them on subsequent GET', async () => {
      const putRes = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({
          acs_url: 'https://boardpdf.com/api/sso/saml/acs',
          allow_unlinked_users: true,
          enabled: true,
          enforce_sso: true,
          entity_id: 'https://idp.corp.com/saml2',
          idp_certificate: VALID_SAML_CERT,
          idp_sso_url: 'https://idp.corp.com/saml2/sso',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(putRes.status, 200);

      const getRes = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        headers: { Cookie: ownerCookie },
      });
      assert.strictEqual(getRes.status, 200);
      const getData = await getRes.json();

      assert.strictEqual(getData.sso.enabled, true);
      assert.strictEqual(getData.sso.enforce_sso, true);
      assert.strictEqual(getData.sso.allow_unlinked_users, true);
      assert.strictEqual(getData.sso.entity_id, 'https://idp.corp.com/saml2');
      assert.strictEqual(getData.sso.acs_url, 'https://boardpdf.com/api/sso/saml/acs');
      assert.strictEqual(getData.sso.has_certificate, true);
    });
  });
});
