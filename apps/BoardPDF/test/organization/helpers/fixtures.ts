import { UserPayload } from '../../../src/types/auth.types.js';

export const VALID_SAML_CERT = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJALe123456789MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLRW50ZXJwcmlzZTEUMBIGA1UE
AwwLZW50ZXJwcmlzZTAeFw0yNjExMDMxOTAwMDBaFw0zNjExMDMxOTAwMDBaMEUx
CzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLRW50ZXJwcmlzZTEU
MBIGA1UEAwwLZW50ZXJwcmlzZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBAM1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV
WXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX
YZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWQ==
-----END CERTIFICATE-----`;

export const INVALID_SAML_CERT_NO_PEM = 'MIIDXTCCAkWgAwIBAgIJALe123456789MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNVBAYTAlVT';

export const INVALID_SAML_CERT_SHORT = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAg==
-----END CERTIFICATE-----`;

export const INVALID_SAML_CERT_CORRUPT = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJALe123456789MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV$$$%%%===
-----END CERTIFICATE-----`;

export const VALID_SAML_METADATA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.enterprise.com/saml2/metadata">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>MIIDXTCCAkWgAwIBAgIJALe123456789MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLRW50ZXJwcmlzZTEUMBIGA1UEAwwLZW50ZXJwcmlzZTAeFw0yNjExMDMxOTAwMDBaFw0zNjExMDMxOTAwMDBaMEUxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLRW50ZXJwcmlzZTEUMBIGA1UEAwwLZW50ZXJwcmlzZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAM1234567890abcdefghijklmnopqrstuvwxyz</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.enterprise.com/saml2/sso"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;

export const INVALID_SAML_METADATA_NO_CERT = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.enterprise.com/saml2/metadata">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.enterprise.com/saml2/sso"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;

export const INVALID_SAML_METADATA_NO_SSO = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.enterprise.com/saml2/metadata">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>MIIDXTCCAkWgAwIBAgIJALe123456789MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLRW50ZXJwcmlzZTEUMBIGA1UEAwwLZW50ZXJwcmlzZTAeFw0yNjExMDMxOTAwMDBaFw0zNjExMDMxOTAwMDBaMEUxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLRW50ZXJwcmlzZTEUMBIGA1UEAwwLZW50ZXJwcmlzZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAM1234567890abcdefghijklmnopqrstuvwxyz</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;

export const TEST_USERS: Record<string, UserPayload> = {
  businessUser: {
    avatar_url: null,
    email: 'biz@example.com',
    id: 12,
    permissions: ['subscription:feature:business'],
    role: 'USER',
    subscription_status: 'active',
    subscription_tier: 'business',
    two_factor_enabled: false,
    username: 'Business User',
  },
  enterpriseNoInvite: {
    avatar_url: null,
    email: 'noinvite@enterprise.com',
    id: 3,
    permissions: [
      'subscription:feature:organization',
      'org:view',
      'org:manage',
      'members:view',
      'members:modify_role',
      'members:remove',
      'sso:view',
      'sso:manage',
    ],
    role: 'USER',
    subscription_status: 'active',
    subscription_tier: 'enterprise',
    two_factor_enabled: false,
    username: 'No Invite User',
  },
  enterpriseNoModifyRole: {
    avatar_url: null,
    email: 'nomodifyrole@enterprise.com',
    id: 5,
    permissions: [
      'subscription:feature:organization',
      'org:view',
      'org:manage',
      'members:view',
      'members:invite',
      'members:remove',
      'sso:view',
      'sso:manage',
    ],
    role: 'USER',
    subscription_status: 'active',
    subscription_tier: 'enterprise',
    two_factor_enabled: false,
    username: 'No Modify Role User',
  },
  enterpriseNoRemove: {
    avatar_url: null,
    email: 'noremove@enterprise.com',
    id: 6,
    permissions: [
      'subscription:feature:organization',
      'org:view',
      'org:manage',
      'members:view',
      'members:invite',
      'members:modify_role',
      'sso:view',
      'sso:manage',
    ],
    role: 'USER',
    subscription_status: 'active',
    subscription_tier: 'enterprise',
    two_factor_enabled: false,
    username: 'No Remove User',
  },
  enterpriseNoSsoManage: {
    avatar_url: null,
    email: 'nosso@enterprise.com',
    id: 4,
    permissions: [
      'subscription:feature:organization',
      'org:view',
      'org:manage',
      'members:view',
      'members:invite',
      'members:modify_role',
      'members:remove',
      'sso:view',
    ],
    role: 'USER',
    subscription_status: 'active',
    subscription_tier: 'enterprise',
    two_factor_enabled: false,
    username: 'No SSO Manage User',
  },
  enterpriseOwner: {
    avatar_url: null,
    email: 'owner@enterprise.com',
    id: 1,
    permissions: [
      'subscription:feature:organization',
      'subscription:feature:sso',
      'org:view',
      'org:manage',
      'members:view',
      'members:invite',
      'members:modify_role',
      'members:remove',
      'sso:view',
      'sso:manage',
    ],
    role: 'USER',
    subscription_status: 'active',
    subscription_tier: 'enterprise',
    two_factor_enabled: false,
    username: 'Enterprise Owner',
  },
  enterpriseViewer: {
    avatar_url: null,
    email: 'viewer@enterprise.com',
    id: 2,
    permissions: [
      'subscription:feature:organization',
      'org:view',
      'members:view',
      'sso:view',
    ],
    role: 'USER',
    subscription_status: 'active',
    subscription_tier: 'enterprise',
    two_factor_enabled: false,
    username: 'Enterprise Viewer',
  },
  freeUser: {
    avatar_url: null,
    email: 'free@example.com',
    id: 10,
    permissions: [],
    role: 'USER',
    subscription_status: 'active',
    subscription_tier: 'free',
    two_factor_enabled: false,
    username: 'Free User',
  },
  inactiveEnterpriseUser: {
    avatar_url: null,
    email: 'inactive@example.com',
    id: 13,
    permissions: [],
    role: 'USER',
    subscription_status: 'inactive',
    subscription_tier: 'enterprise',
    two_factor_enabled: false,
    username: 'Inactive Enterprise User',
  },
  proUser: {
    avatar_url: null,
    email: 'pro@example.com',
    id: 11,
    permissions: ['subscription:feature:pro'],
    role: 'USER',
    subscription_status: 'active',
    subscription_tier: 'pro',
    two_factor_enabled: false,
    username: 'Pro User',
  },
};
