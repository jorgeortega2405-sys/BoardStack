import { getDbPool } from '../config/database.config.js';
import { validateEmail } from '../utils/validators.util.js';
import { permissionService } from './permission.service.js';
import crypto from 'crypto';

export interface OrganizationStats {
  active_invitations_count: number;
  members_count: number;
  sso_enabled: boolean;
}

export interface OrganizationDetails {
  created_at: string;
  domain: string | null;
  id: number;
  logo_url: string | null;
  name: string;
  owner_id: number;
  role: string;
  slug: string;
  uuid: string;
}

export interface OrganizationMember {
  email: string;
  id: number;
  joined_at: string;
  role: string;
  status: string;
  user_id: number;
  username: string;
}

export interface OrganizationInvitation {
  created_at: string;
  email: string;
  expires_at: string;
  id: number;
  role: string;
  status: string;
}

export interface OrganizationSsoConfig {
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

export async function getOrganizationForUser(
  userId: number
): Promise<{ organization: OrganizationDetails; stats: OrganizationStats } | null> {
  const pool = getDbPool();

  const [memberRows] = await pool.query<any[]>(
    `SELECT o.*, om.role as user_org_role
     FROM organizations o
     JOIN organization_members om ON o.id = om.organization_id
     WHERE om.user_id = ? AND om.status = 'active'
     LIMIT 1`,
    [userId]
  );

  let orgRow = Array.isArray(memberRows) && memberRows.length > 0 ? memberRows[0] : null;

  if (!orgRow) {
    const [ownerRows] = await pool.query<any[]>(
      `SELECT o.*, 'admin' as user_org_role
       FROM organizations o
       WHERE o.owner_id = ?
       LIMIT 1`,
      [userId]
    );
    if (Array.isArray(ownerRows) && ownerRows.length > 0) {
      orgRow = ownerRows[0];
    }
  }

  if (!orgRow) {
    const perms = await permissionService.getUserPermissions(userId);
    if (!perms.includes('subscription:feature:organization')) {
      return null;
    }

    const [userRows] = await pool.query<any[]>(
      'SELECT username, email FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const user = Array.isArray(userRows) && userRows.length > 0 ? userRows[0] : { email: 'user@domain.com', username: 'org' };

    const orgUuid = crypto.randomUUID();
    const baseSlug = String(user.username || 'org').toLowerCase().replace(/[^a-z0-9]/g, '-') || 'org';
    const orgSlug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
    const orgName = `Organización de ${user.username || 'Empresa'}`;

    const [insertResult] = await pool.query<any>(
      'INSERT INTO organizations (uuid, name, slug, owner_id) VALUES (?, ?, ?, ?)',
      [orgUuid, orgName, orgSlug, userId]
    );
    const newOrgId = insertResult.insertId;

    await pool.query(
      'INSERT INTO organization_members (organization_id, user_id, role, status) VALUES (?, ?, ?, ?)',
      [newOrgId, userId, 'admin', 'active']
    );

    await pool.query(
      'INSERT INTO organization_sso_configs (organization_id, enabled) VALUES (?, ?)',
      [newOrgId, false]
    );

    await permissionService.invalidateUserPermissions(userId);

    const [createdRows] = await pool.query<any[]>(
      `SELECT o.*, 'admin' as user_org_role
       FROM organizations o
       WHERE o.id = ?
       LIMIT 1`,
      [newOrgId]
    );
    orgRow = createdRows[0];
  }

  const [membersCountRows] = await pool.query<any[]>(
    'SELECT COUNT(*) as count FROM organization_members WHERE organization_id = ? AND status = ?',
    [orgRow.id, 'active']
  );
  const membersCount = Array.isArray(membersCountRows) && membersCountRows.length > 0 ? membersCountRows[0].count : 1;

  const [invitationsCountRows] = await pool.query<any[]>(
    'SELECT COUNT(*) as count FROM organization_invitations WHERE organization_id = ? AND status = ? AND expires_at > NOW()',
    [orgRow.id, 'pending']
  );
  const activeInvitationsCount = Array.isArray(invitationsCountRows) && invitationsCountRows.length > 0 ? invitationsCountRows[0].count : 0;

  const [ssoRows] = await pool.query<any[]>(
    'SELECT enabled FROM organization_sso_configs WHERE organization_id = ? LIMIT 1',
    [orgRow.id]
  );
  const ssoEnabled = Array.isArray(ssoRows) && ssoRows.length > 0 ? Boolean(ssoRows[0].enabled) : false;

  return {
    organization: {
      created_at: orgRow.created_at ? new Date(orgRow.created_at).toISOString() : new Date().toISOString(),
      domain: orgRow.domain || null,
      id: Number(orgRow.id),
      logo_url: orgRow.logo_url || null,
      name: orgRow.name,
      owner_id: Number(orgRow.owner_id),
      role: orgRow.user_org_role || 'member',
      slug: orgRow.slug,
      uuid: orgRow.uuid,
    },
    stats: {
      active_invitations_count: Number(activeInvitationsCount),
      members_count: Number(membersCount),
      sso_enabled: ssoEnabled,
    },
  };
}

export async function updateOrganization(
  orgId: number,
  data: { domain?: string; name?: string }
): Promise<OrganizationDetails> {
  const pool = getDbPool();

  if (data.name !== undefined) {
    const trimmedName = String(data.name).trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      throw new Error('El nombre de la organización debe contener entre 2 y 100 caracteres.');
    }
  }

  if (data.domain !== undefined && data.domain !== null && data.domain !== '') {
    const trimmedDomain = String(data.domain).trim().toLowerCase();
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,10}$/;
    if (!domainRegex.test(trimmedDomain)) {
      throw new Error('El dominio ingresado no tiene un formato válido.');
    }
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(String(data.name).trim());
  }
  if (data.domain !== undefined) {
    updates.push('domain = ?');
    params.push(data.domain ? String(data.domain).trim().toLowerCase() : null);
  }

  if (updates.length > 0) {
    params.push(orgId);
    await pool.query(
      `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  const [rows] = await pool.query<any[]>(
    'SELECT * FROM organizations WHERE id = ? LIMIT 1',
    [orgId]
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Organización no encontrada.');
  }

  const row = rows[0];
  return {
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    domain: row.domain || null,
    id: Number(row.id),
    logo_url: row.logo_url || null,
    name: row.name,
    owner_id: Number(row.owner_id),
    role: 'admin',
    slug: row.slug,
    uuid: row.uuid,
  };
}

export async function listMembers(
  orgId: number
): Promise<{ invitations: OrganizationInvitation[]; members: OrganizationMember[] }> {
  const pool = getDbPool();

  const [memberRows] = await pool.query<any[]>(
    `SELECT om.id, om.user_id, u.email, u.username, om.role, om.status, om.joined_at
     FROM organization_members om
     JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = ?
     ORDER BY om.joined_at ASC`,
    [orgId]
  );

  const members: OrganizationMember[] = (Array.isArray(memberRows) ? memberRows : []).map((row) => ({
    email: row.email,
    id: Number(row.id),
    joined_at: row.joined_at ? new Date(row.joined_at).toISOString() : new Date().toISOString(),
    role: row.role,
    status: row.status,
    user_id: Number(row.user_id),
    username: row.username,
  }));

  const [invitationRows] = await pool.query<any[]>(
    `SELECT id, email, role, status, expires_at, created_at
     FROM organization_invitations
     WHERE organization_id = ? AND status = 'pending'
     ORDER BY created_at DESC`,
    [orgId]
  );

  const invitations: OrganizationInvitation[] = (Array.isArray(invitationRows) ? invitationRows : []).map((row) => ({
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    email: row.email,
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : new Date().toISOString(),
    id: Number(row.id),
    role: row.role,
    status: row.status,
  }));

  return { invitations, members };
}

export async function inviteMember(
  orgId: number,
  invitedBy: number,
  email: string,
  role: string
): Promise<OrganizationInvitation> {
  const pool = getDbPool();

  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    throw new Error(emailValidation.error || 'Correo electrónico inválido.');
  }

  const normalizedRole = role === 'admin' ? 'admin' : 'member';
  const trimmedEmail = String(email).trim().toLowerCase();

  const [existingMemberRows] = await pool.query<any[]>(
    `SELECT om.id
     FROM organization_members om
     JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = ? AND LOWER(u.email) = ? AND om.status = 'active'
     LIMIT 1`,
    [orgId, trimmedEmail]
  );
  if (Array.isArray(existingMemberRows) && existingMemberRows.length > 0) {
    throw new Error('El usuario ya es miembro activo de esta organización.');
  }

  const [existingInviteRows] = await pool.query<any[]>(
    `SELECT id
     FROM organization_invitations
     WHERE organization_id = ? AND LOWER(email) = ? AND status = 'pending' AND expires_at > NOW()
     LIMIT 1`,
    [orgId, trimmedEmail]
  );
  if (Array.isArray(existingInviteRows) && existingInviteRows.length > 0) {
    throw new Error('Ya existe una invitación pendiente para este correo electrónico.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [insertResult] = await pool.query<any>(
    `INSERT INTO organization_invitations (organization_id, email, role, token, invited_by, status, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [orgId, trimmedEmail, normalizedRole, token, invitedBy, expiresAt]
  );

  return {
    created_at: new Date().toISOString(),
    email: trimmedEmail,
    expires_at: expiresAt.toISOString(),
    id: Number(insertResult.insertId),
    role: normalizedRole,
    status: 'pending',
  };
}

export async function updateMemberRole(
  orgId: number,
  memberId: number,
  role: string
): Promise<OrganizationMember> {
  const pool = getDbPool();

  const normalizedRole = role === 'admin' ? 'admin' : 'member';

  const [memberRows] = await pool.query<any[]>(
    `SELECT om.*, o.owner_id, u.email, u.username
     FROM organization_members om
     JOIN organizations o ON om.organization_id = o.id
     JOIN users u ON om.user_id = u.id
     WHERE om.id = ? AND om.organization_id = ?
     LIMIT 1`,
    [memberId, orgId]
  );

  if (!Array.isArray(memberRows) || memberRows.length === 0) {
    throw new Error('El miembro seleccionado no fue encontrado en la organización.');
  }

  const member = memberRows[0];
  if (Number(member.user_id) === Number(member.owner_id) && normalizedRole !== 'admin') {
    throw new Error('No es posible modificar el rol del propietario de la organización.');
  }

  await pool.query(
    'UPDATE organization_members SET role = ? WHERE id = ? AND organization_id = ?',
    [normalizedRole, memberId, orgId]
  );

  await permissionService.invalidateUserPermissions(Number(member.user_id));

  return {
    email: member.email,
    id: Number(member.id),
    joined_at: member.joined_at ? new Date(member.joined_at).toISOString() : new Date().toISOString(),
    role: normalizedRole,
    status: member.status,
    user_id: Number(member.user_id),
    username: member.username,
  };
}

export async function removeMember(
  orgId: number,
  memberId: number,
  requestingUserId?: number
): Promise<boolean> {
  const pool = getDbPool();

  const [memberRows] = await pool.query<any[]>(
    `SELECT om.*, o.owner_id
     FROM organization_members om
     JOIN organizations o ON om.organization_id = o.id
     WHERE om.id = ? AND om.organization_id = ?
     LIMIT 1`,
    [memberId, orgId]
  );

  if (!Array.isArray(memberRows) || memberRows.length === 0) {
    throw new Error('El miembro seleccionado no fue encontrado en la organización.');
  }

  const member = memberRows[0];
  if (Number(member.user_id) === Number(member.owner_id)) {
    throw new Error('No es posible eliminar al propietario de la organización.');
  }

  if (requestingUserId !== undefined && Number(member.user_id) === Number(requestingUserId)) {
    throw new Error('No puedes eliminar tu propia membresía de la organización.');
  }

  await pool.query(
    'DELETE FROM organization_members WHERE id = ? AND organization_id = ?',
    [memberId, orgId]
  );

  await permissionService.invalidateUserPermissions(Number(member.user_id));
  return true;
}

export async function revokeInvitation(
  orgId: number,
  invitationId: number
): Promise<boolean> {
  const pool = getDbPool();

  const [rows] = await pool.query<any[]>(
    'SELECT id FROM organization_invitations WHERE id = ? AND organization_id = ? LIMIT 1',
    [invitationId, orgId]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('La invitación no fue encontrada o ya ha sido procesada.');
  }

  await pool.query(
    `UPDATE organization_invitations SET status = 'revoked' WHERE id = ? AND organization_id = ?`,
    [invitationId, orgId]
  );

  return true;
}

export async function getSsoConfig(
  orgId: number
): Promise<{ sso: OrganizationSsoConfig }> {
  const pool = getDbPool();

  const [rows] = await pool.query<any[]>(
    'SELECT * FROM organization_sso_configs WHERE organization_id = ? LIMIT 1',
    [orgId]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    await pool.query(
      'INSERT INTO organization_sso_configs (organization_id, enabled) VALUES (?, ?)',
      [orgId, false]
    );
    return {
      sso: {
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
      },
    };
  }

  const row = rows[0];
  return {
    sso: {
      acs_url: row.acs_url || '',
      allow_unlinked_users: Boolean(row.allow_unlinked_users),
      enabled: Boolean(row.enabled),
      enforce_sso: Boolean(row.enforce_sso),
      entity_id: row.entity_id || '',
      has_certificate: Boolean(row.idp_certificate && row.idp_certificate.trim().length > 0),
      has_metadata_xml: Boolean(row.idp_metadata_xml && row.idp_metadata_xml.trim().length > 0),
      idp_certificate: row.idp_certificate || '',
      idp_metadata_xml: row.idp_metadata_xml || '',
      idp_sso_url: row.idp_sso_url || '',
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    },
  };
}

export async function updateSsoConfig(
  orgId: number,
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
): Promise<{ sso: OrganizationSsoConfig }> {
  const pool = getDbPool();

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

  await pool.query(
    `INSERT INTO organization_sso_configs (
      organization_id, enabled, entity_id, acs_url, idp_sso_url, idp_certificate, idp_metadata_xml, enforce_sso, allow_unlinked_users
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      enabled = VALUES(enabled),
      entity_id = VALUES(entity_id),
      acs_url = VALUES(acs_url),
      idp_sso_url = VALUES(idp_sso_url),
      idp_certificate = VALUES(idp_certificate),
      idp_metadata_xml = VALUES(idp_metadata_xml),
      enforce_sso = VALUES(enforce_sso),
      allow_unlinked_users = VALUES(allow_unlinked_users),
      updated_at = CURRENT_TIMESTAMP`,
    [
      orgId,
      enabled,
      entityId,
      acsUrl,
      idpSsoUrl || null,
      idpCert || null,
      xmlMetadata || null,
      enforceSso,
      Boolean(config.allow_unlinked_users),
    ]
  );

  return getSsoConfig(orgId);
}

export const organizationService = {
  getOrganizationForUser,
  getSsoConfig,
  inviteMember,
  listMembers,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  updateOrganization,
  updateSsoConfig,
};
