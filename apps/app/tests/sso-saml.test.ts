import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

interface MockGoogleAuthState {
  mode: 'login' | 'verify';
  nonce: string;
  redirect: string;
  timestamp: number;
  userId?: number;
}

function createSignedState(payload: MockGoogleAuthState, secret: string): string {
  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(serialized).digest('hex');
  return `${serialized}.${signature}`;
}

function verifySignedState(state: unknown, secret: string): MockGoogleAuthState | null {
  if (!state || typeof state !== 'string') return null;
  const [serialized, signature] = state.split('.');
  if (!serialized || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', secret).update(serialized).digest('hex');
  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8')) as MockGoogleAuthState;
  } catch {
    return null;
  }
}

function parseSamlAssertion(xml: string): { email: string | null; expired: boolean; issuer: string | null } {
  const nameIdMatch = xml.match(/<(?:\w+:)?NameID[^>]*>([^<]+)<\/(?:\w+:)?NameID>/i);
  const issuerMatch = xml.match(/<(?:\w+:)?Issuer[^>]*>([^<]+)<\/(?:\w+:)?Issuer>/i);
  const notOnOrAfterMatch = xml.match(/NotOnOrAfter="([^"]+)"/i);

  const email = nameIdMatch && nameIdMatch[1] ? nameIdMatch[1].trim().toLowerCase() : null;
  const issuer = issuerMatch && issuerMatch[1] ? issuerMatch[1].trim() : null;

  let expired = false;
  if (notOnOrAfterMatch && notOnOrAfterMatch[1]) {
    const expiry = new Date(notOnOrAfterMatch[1]).getTime();
    if (!isNaN(expiry) && Date.now() > expiry + 300000) {
      expired = true;
    }
  }

  return { email, expired, issuer };
}

function verifySamlCertificate(xml: string, configuredCert: string): boolean {
  if (!configuredCert || configuredCert.trim().length === 0) {
    return true;
  }
  const cleanCert = configuredCert.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
  const xmlWithoutWs = xml.replace(/\s+/g, '');
  return xmlWithoutWs.includes(cleanCert);
}

function validateOrganizationSeatCapacity(currentMembers: number, seatsLimit: number): boolean {
  return currentMembers < seatsLimit;
}

test('google oauth state generator and validator enforce signature and payload integrity', () => {
  const testSecret = 'test_session_secret_for_signing_state';
  const payload: MockGoogleAuthState = {
    mode: 'login',
    nonce: 'a1b2c3d4e5f6',
    redirect: '/dashboard',
    timestamp: Date.now(),
  };

  const state = createSignedState(payload, testSecret);
  const verified = verifySignedState(state, testSecret);
  assert.ok(verified);
  assert.equal(verified?.mode, 'login');
  assert.equal(verified?.nonce, 'a1b2c3d4e5f6');
  assert.equal(verified?.redirect, '/dashboard');

  const tamperedState = `${state.slice(0, 10)}X${state.slice(11)}`;
  assert.equal(verifySignedState(tamperedState, testSecret), null);

  const wrongSecretState = verifySignedState(state, 'wrong_secret_key');
  assert.equal(wrongSecretState, null);

  assert.equal(verifySignedState(null, testSecret), null);
  assert.equal(verifySignedState('invalid-state-format', testSecret), null);
});

test('saml assertion parser extracts name id and detects expiration', () => {
  const validXml = `
    <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
      <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</saml:Issuer>
      <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
        <saml:Subject>
          <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">user@example.com</saml:NameID>
          <saml:SubjectConfirmationData NotOnOrAfter="${new Date(Date.now() + 600000).toISOString()}" />
        </saml:Subject>
      </saml:Assertion>
    </samlp:Response>
  `;

  const parsedValid = parseSamlAssertion(validXml);
  assert.equal(parsedValid.email, 'user@example.com');
  assert.equal(parsedValid.issuer, 'https://idp.example.com');
  assert.equal(parsedValid.expired, false);

  const expiredXml = `
    <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
      <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
        <saml:Subject>
          <saml:NameID>user@example.com</saml:NameID>
          <saml:SubjectConfirmationData NotOnOrAfter="2020-01-01T00:00:00.000Z" />
        </saml:Subject>
      </saml:Assertion>
    </samlp:Response>
  `;

  const parsedExpired = parseSamlAssertion(expiredXml);
  assert.equal(parsedExpired.expired, true);
});

test('saml certificate verifier rejects mismatched x509 certificates', () => {
  const expectedCert = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA';
  const xmlWithCert = `<X509Certificate>${expectedCert}</X509Certificate>`;
  const xmlWithDifferentCert = `<X509Certificate>MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8ADIFFERENT</X509Certificate>`;

  assert.equal(verifySamlCertificate(xmlWithCert, expectedCert), true);
  assert.equal(verifySamlCertificate(xmlWithDifferentCert, expectedCert), false);
  assert.equal(verifySamlCertificate(xmlWithCert, ''), true);
});

test('organization seat limit prevents overflow beyond allocated capacity', () => {
  assert.equal(validateOrganizationSeatCapacity(2, 3), true);
  assert.equal(validateOrganizationSeatCapacity(3, 3), false);
  assert.equal(validateOrganizationSeatCapacity(50, 50), false);
  assert.equal(validateOrganizationSeatCapacity(51, 50), false);
});
