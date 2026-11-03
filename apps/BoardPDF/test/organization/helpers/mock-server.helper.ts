import { redis } from '../../../src/config/redis.config.js';
import organizationRoutes from '../../../src/routes/organization.routes.js';
import { COOKIE_NAME, createMultiAccountToken } from '../../../src/services/auth.service.js';
import { organizationService } from '../../../src/services/organization.service.js';
import { permissionService } from '../../../src/services/permission.service.js';
import { UserPayload } from '../../../src/types/auth.types.js';
import { validateEmail } from '../../../src/utils/validators.util.js';
import cookieParser from 'cookie-parser';
import express, { Express, Request, Response } from 'express';
import http from 'node:http';

interface StoredMember {
  email: string;
  id: number;
  joined_at: string;
  role: string;
  status: string;
  user_id: number;
  username: string;
}

interface StoredInvitation {
  created_at: string;
  email: string;
  expires_at: string;
  id: number;
  role: string;
  status: string;
}

interface StoredSsoConfig {
  acs_url: string;
  allow_unlinked_users: boolean;
  enabled: boolean;
  enforce_sso: boolean;
  entity_id: string;
  has_certificate: boolean;
  has_metadata_xml: boolean;
  idp_certificate: string;
  idp_metadata_xml: string;
  idp_sso_url: string;
  updated_at?: string;
}

let mockMembers: StoredMember[] = [];
let mockInvitations: StoredInvitation[] = [];
let mockSsoConfig: StoredSsoConfig = {
  acs_url: '',
  allow_unlinked_users: false,
  enabled: false,
  enforce_sso: false,
  entity_id: '',
  has_certificate: false,
  has_metadata_xml: false,
  idp_certificate: '',
  idp_metadata_xml: '',
  idp_sso_url: '',
};

let mockOrg = {
  created_at: '2026-11-03T00:00:00.000Z',
  domain: 'enterprise.com',
  id: 1,
  logo_url: null,
  name: 'Empresa Enterprise',
  owner_id: 1,
  role: 'admin',
  slug: 'empresa-enterprise',
  uuid: 'org-uuid-001',
};

export function resetOrganizationStore(): void {
  mockOrg = {
    created_at: '2026-11-03T00:00:00.000Z',
    domain: 'enterprise.com',
    id: 1,
    logo_url: null,
    name: 'Empresa Enterprise',
    owner_id: 1,
    role: 'admin',
    slug: 'empresa-enterprise',
    uuid: 'org-uuid-001',
  };

  mockMembers = [
    {
      email: 'owner@enterprise.com',
      id: 1,
      joined_at: '2026-11-03T00:00:00.000Z',
      role: 'admin',
      status: 'active',
      user_id: 1,
      username: 'Enterprise Owner',
    },
    {
      email: 'viewer@enterprise.com',
      id: 2,
      joined_at: '2026-11-03T00:00:00.000Z',
      role: 'member',
      status: 'active',
      user_id: 2,
      username: 'Enterprise Viewer',
    },
  ];

  mockInvitations = [
    {
      created_at: '2026-11-03T00:00:00.000Z',
      email: 'pending@enterprise.com',
      expires_at: '2026-11-10T00:00:00.000Z',
      id: 101,
      role: 'member',
      status: 'pending',
    },
  ];

  mockSsoConfig = {
    acs_url: '',
    allow_unlinked_users: false,
    enabled: false,
    enforce_sso: false,
    entity_id: '',
    has_certificate: false,
    has_metadata_xml: false,
    idp_certificate: '',
    idp_metadata_xml: '',
    idp_sso_url: '',
  };
}

resetOrganizationStore();

const originalGetOrg = organizationService.getOrganizationForUser;
const originalUpdateOrg = organizationService.updateOrganization;
const originalListMembers = organizationService.listMembers;
const originalInviteMember = organizationService.inviteMember;
const originalUpdateRole = organizationService.updateMemberRole;
const originalRemoveMember = organizationService.removeMember;
const originalRevokeInvite = organizationService.revokeInvitation;
const originalGetSso = organizationService.getSsoConfig;
const originalUpdateSso = organizationService.updateSsoConfig;
const originalGetUserPerms = permissionService.getUserPermissions;

export function installMockService(): void {
  permissionService.getUserPermissions = async (
    _userId: number,
    tier?: string,
    subStatus?: string
  ) => {
    if (subStatus === 'active' && tier === 'enterprise') {
      return [
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
      ];
    }
    return [];
  };

  organizationService.getOrganizationForUser = async (_userId: number) => {
    return {
      organization: { ...mockOrg },
      stats: {
        active_invitations_count: mockInvitations.filter((i) => i.status === 'pending').length,
        members_count: mockMembers.filter((m) => m.status === 'active').length,
        sso_enabled: mockSsoConfig.enabled,
      },
    };
  };

  organizationService.updateOrganization = async (
    _orgId: number,
    data: { domain?: string; name?: string }
  ) => {
    if (data.name !== undefined) {
      const trimmed = String(data.name).trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        throw new Error('El nombre de la organización debe contener entre 2 y 100 caracteres.');
      }
      mockOrg.name = trimmed;
    }
    if (data.domain !== undefined && data.domain !== null && data.domain !== '') {
      const trimmedDomain = String(data.domain).trim().toLowerCase();
      const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,10}$/;
      if (!domainRegex.test(trimmedDomain)) {
        throw new Error('El dominio ingresado no tiene un formato válido.');
      }
      mockOrg.domain = trimmedDomain;
    }
    return { ...mockOrg };
  };

  organizationService.listMembers = async (_orgId: number) => {
    return {
      invitations: mockInvitations.filter((i) => i.status === 'pending'),
      members: mockMembers.filter((m) => m.status === 'active'),
    };
  };

  organizationService.inviteMember = async (
    _orgId: number,
    _invitedBy: number,
    email: string,
    role: string
  ) => {
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw new Error('Correo electrónico inválido.');
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const existingActive = mockMembers.find(
      (m) => m.email.toLowerCase() === trimmedEmail && m.status === 'active'
    );
    if (existingActive) {
      throw new Error('El usuario ya es miembro activo de esta organización.');
    }

    const existingPending = mockInvitations.find(
      (i) => i.email.toLowerCase() === trimmedEmail && i.status === 'pending'
    );
    if (existingPending) {
      throw new Error('Ya existe una invitación pendiente para este correo electrónico.');
    }

    const normalizedRole = role === 'admin' ? 'admin' : 'member';
    const newInvite: StoredInvitation = {
      created_at: new Date().toISOString(),
      email: trimmedEmail,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      id: mockInvitations.length + 101,
      role: normalizedRole,
      status: 'pending',
    };
    mockInvitations.push(newInvite);
    return newInvite;
  };

  organizationService.updateMemberRole = async (
    _orgId: number,
    memberId: number,
    role: string
  ) => {
    const member = mockMembers.find((m) => m.id === memberId);
    if (!member) {
      throw new Error('El miembro seleccionado no fue encontrado en la organización.');
    }

    const normalizedRole = role === 'admin' ? 'admin' : 'member';
    if (member.user_id === mockOrg.owner_id && normalizedRole !== 'admin') {
      throw new Error('No es posible modificar el rol del propietario de la organización.');
    }

    member.role = normalizedRole;
    return { ...member };
  };

  organizationService.removeMember = async (
    _orgId: number,
    memberId: number,
    requestingUserId?: number
  ) => {
    const member = mockMembers.find((m) => m.id === memberId);
    if (!member) {
      throw new Error('El miembro seleccionado no fue encontrado en la organización.');
    }

    if (member.user_id === mockOrg.owner_id) {
      throw new Error('No es posible eliminar al propietario de la organización.');
    }

    if (requestingUserId !== undefined && member.user_id === requestingUserId) {
      throw new Error('No puedes eliminar tu propia membresía de la organización.');
    }

    const idx = mockMembers.findIndex((m) => m.id === memberId);
    if (idx !== -1) {
      mockMembers.splice(idx, 1);
    }
    return true;
  };

  organizationService.revokeInvitation = async (_orgId: number, invitationId: number) => {
    const invitation = mockInvitations.find((i) => i.id === invitationId && i.status === 'pending');
    if (!invitation) {
      throw new Error('La invitación no fue encontrada o ya ha sido procesada.');
    }
    invitation.status = 'revoked';
    return true;
  };

  organizationService.getSsoConfig = async (_orgId: number) => {
    return {
      sso: { ...mockSsoConfig },
    };
  };

  organizationService.updateSsoConfig = async (
    _orgId: number,
    config: {
      acs_url?: string;
      allow_unlinked_users?: boolean;
      enabled: boolean;
      enforce_sso?: boolean;
      entity_id?: string;
      idp_certificate?: string;
      idp_metadata_xml?: string;
      idp_sso_url?: string;
    }
  ) => {
    let entityId = config.entity_id ? String(config.entity_id).trim() : '';
    let acsUrl = config.acs_url ? String(config.acs_url).trim() : '';
    let idpSsoUrl = config.idp_sso_url ? String(config.idp_sso_url).trim() : '';
    let idpCert = config.idp_certificate ? String(config.idp_certificate).trim() : '';
    const xmlMetadata = config.idp_metadata_xml ? String(config.idp_metadata_xml).trim() : '';

    if (xmlMetadata) {
      if (!entityId) {
        const matchEntity = xmlMetadata.match(/entityID=["']([^"']+)["']/i);
        if (matchEntity && matchEntity[1]) {
          entityId = matchEntity[1].trim();
        }
      }
      if (!idpSsoUrl) {
        const matchSso = xmlMetadata.match(/<[^>]*SingleSignOnService[^>]*Location=["']([^"']+)["']/i);
        if (matchSso && matchSso[1]) {
          idpSsoUrl = matchSso[1].trim();
        }
      }
      if (!idpCert) {
        const matchCert = xmlMetadata.match(/<[^>]*X509Certificate[^>]*>([\s\S]*?)<\/[^>]*X509Certificate>/i);
        if (matchCert && matchCert[1]) {
          const cleanCert = matchCert[1].replace(/\s+/g, '');
          idpCert = `-----BEGIN CERTIFICATE-----\n${cleanCert}\n-----END CERTIFICATE-----`;
        }
      }
    }

    if (config.enabled) {
      if (!entityId || entityId.length > 512) {
        throw new Error('El Entity ID es obligatorio y debe tener como máximo 512 caracteres.');
      }
      if (!/^(https?:\/\/|urn:)[^\s]+$/i.test(entityId)) {
        throw new Error('El Entity ID debe ser una URL válida (http o https) o un URN válido.');
      }
      if (!acsUrl || acsUrl.length > 512) {
        throw new Error('La URL ACS es obligatoria y debe tener como máximo 512 caracteres.');
      }
      try {
        const parsedUrl = new URL(acsUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          throw new Error();
        }
      } catch {
        throw new Error('La URL ACS debe ser una URL válida (http o https).');
      }

      const hasDirectCreds = Boolean(idpCert && idpSsoUrl);
      if (!hasDirectCreds) {
        if (xmlMetadata) {
          throw new Error('Los metadatos XML no contienen un certificado X.509 o URL SSO del IdP válidos.');
        }
        throw new Error('Se requiere un certificado X.509 y URL SSO del IdP o metadatos XML válidos para activar SAML.');
      }

      if (idpCert) {
        if (!idpCert.includes('-----BEGIN CERTIFICATE-----') || !idpCert.includes('-----END CERTIFICATE-----')) {
          throw new Error('El certificado X.509 debe incluir encabezado y pie en formato PEM.');
        }
        const rawBase64 = idpCert
          .replace('-----BEGIN CERTIFICATE-----', '')
          .replace('-----END CERTIFICATE-----', '')
          .replace(/\s+/g, '');
        if (rawBase64.length < 64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(rawBase64)) {
          throw new Error('El contenido del certificado X.509 no es un Base64 válido.');
        }
      }
    }

    const enabled = Boolean(config.enabled);
    const enforceSso = enabled ? Boolean(config.enforce_sso) : false;

    mockSsoConfig = {
      acs_url: acsUrl,
      allow_unlinked_users: Boolean(config.allow_unlinked_users),
      enabled,
      enforce_sso: enforceSso,
      entity_id: entityId,
      has_certificate: Boolean(idpCert && idpCert.trim().length > 0),
      has_metadata_xml: Boolean(xmlMetadata && xmlMetadata.trim().length > 0),
      idp_certificate: idpCert,
      idp_metadata_xml: xmlMetadata,
      idp_sso_url: idpSsoUrl,
      updated_at: new Date().toISOString(),
    };

    return {
      sso: { ...mockSsoConfig },
    };
  };
}

export function restoreOriginalService(): void {
  organizationService.getOrganizationForUser = originalGetOrg;
  organizationService.updateOrganization = originalUpdateOrg;
  organizationService.listMembers = originalListMembers;
  organizationService.inviteMember = originalInviteMember;
  organizationService.updateMemberRole = originalUpdateRole;
  organizationService.removeMember = originalRemoveMember;
  organizationService.revokeInvitation = originalRevokeInvite;
  organizationService.getSsoConfig = originalGetSso;
  organizationService.updateSsoConfig = originalUpdateSso;
  permissionService.getUserPermissions = originalGetUserPerms;
}

export function createTestSessionCookie(user: UserPayload): string {
  const token = createMultiAccountToken({
    accounts: [user],
    activeId: user.id,
  });
  return `${COOKIE_NAME}=${token}`;
}

export interface EphemeralServer {
  app: Express;
  baseUrl: string;
  close: () => Promise<void>;
  server: http.Server;
}

export async function startMockServer(): Promise<EphemeralServer> {
  installMockService();
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api', organizationRoutes);

  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Endpoint de API no encontrado.',
      success: false,
    });
  });

  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      error: 'Ruta no encontrada.',
      path: req.originalUrl,
      success: false,
    });
  });

  app.use((_err: any, _req: Request, res: Response, _next: any) => {
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      success: false,
    });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  const close = async () => {
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
    if (typeof (server as any).closeIdleConnections === 'function') {
      (server as any).closeIdleConnections();
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    try {
      redis.disconnect(false);
    } catch {}
  };

  return { app, baseUrl, close, server };
}
