import crypto from 'crypto';
import { generateUniqueUsername } from './user.service.js';
import { logger } from '../utils/logger.js';
import { pool } from '../config/database.config.js';
import { RowDataPacket } from 'mysql2';

interface OrganizationRecord {
  created_at: string;
  domain: string | null;
  id: number;
  name: string;
  owner_id: number;
  saml_cert: string | null;
  saml_enabled: boolean;
  saml_entry_point: string | null;
  saml_issuer: string | null;
  seats_limit: number;
  slug: string;
  updated_at: string;
  uuid: string;
}

interface OrganizationMemberRecord {
  avatar_url?: string | null;
  email: string;
  id: number;
  joined_at: string;
  org_id: number;
  role: string;
  status: string;
  user_id: number | null;
  username?: string | null;
}

async function getOrCreateUserOrganization(
  userId: number,
  username: string,
  email: string
): Promise<{ membersCount: number; org: OrganizationRecord }> {
  const [ownerRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM organizations WHERE owner_id = ? LIMIT 1',
    [userId]
  );

  let org: OrganizationRecord | null = (ownerRows[0] as OrganizationRecord) || null;

  if (!org) {
    const [memberRows] = await pool.query<RowDataPacket[]>(
      `SELECT o.* FROM organizations o 
       JOIN organization_members m ON o.id = m.org_id 
       WHERE m.user_id = ? LIMIT 1`,
      [userId]
    );
    if (memberRows && memberRows.length > 0) {
      org = memberRows[0] as OrganizationRecord;
    }
  }

  if (!org) {
    const orgUuid = crypto.randomUUID();
    const cleanName = `${username || 'Enterprise'} Organization`;
    const cleanSlug = `org-${userId}-${Date.now().toString(36)}`;
    const [insertResult] = await pool.query<any>(
      `INSERT INTO organizations (uuid, owner_id, name, slug, seats_limit, saml_enabled)
       VALUES (?, ?, ?, ?, 25, FALSE)`,
      [orgUuid, userId, cleanName, cleanSlug]
    );

    const orgId = insertResult.insertId;
    await pool.query(
      `INSERT INTO organization_members (org_id, user_id, email, role, status)
       VALUES (?, ?, ?, 'owner', 'active')`,
      [orgId, userId, email.toLowerCase().trim()]
    );

    const [createdRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM organizations WHERE id = ?',
      [orgId]
    );
    org = createdRows[0] as OrganizationRecord;
  }

  const [countRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as count FROM organization_members WHERE org_id = ?',
    [org.id]
  );
  const membersCount = Number(countRows[0]?.count || 1);

  return { membersCount, org };
}

async function updateOrganization(
  userId: number,
  data: {
    domain?: string | null;
    name?: string;
    saml_cert?: string | null;
    saml_enabled?: boolean;
    saml_entry_point?: string | null;
    saml_issuer?: string | null;
    slug?: string;
  }
): Promise<OrganizationRecord> {
  const [orgRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM organizations WHERE owner_id = ? LIMIT 1',
    [userId]
  );

  if (!orgRows || orgRows.length === 0) {
    throw new Error('Organization not found or you lack administrative privileges.');
  }

  const currentOrg = orgRows[0] as OrganizationRecord;

  let newSlug = currentOrg.slug;
  if (data.slug && data.slug.trim()) {
    const candidateSlug = data.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (candidateSlug.length < 3) {
      throw new Error('Organization slug must be at least 3 characters long.');
    }
    const [slugConflict] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM organizations WHERE slug = ? AND id != ? LIMIT 1',
      [candidateSlug, currentOrg.id]
    );
    if (slugConflict && slugConflict.length > 0) {
      throw new Error('This organization slug is already in use.');
    }
    newSlug = candidateSlug;
  }

  let cleanDomain = currentOrg.domain;
  if (data.domain !== undefined) {
    if (data.domain && data.domain.trim()) {
      cleanDomain = data.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    } else {
      cleanDomain = null;
    }
  }

  const newName = (data.name && data.name.trim()) ? data.name.trim() : currentOrg.name;
  const samlEnabled = data.saml_enabled !== undefined ? Boolean(data.saml_enabled) : currentOrg.saml_enabled;
  const samlEntryPoint = data.saml_entry_point !== undefined ? (data.saml_entry_point ? data.saml_entry_point.trim() : null) : currentOrg.saml_entry_point;
  const samlIssuer = data.saml_issuer !== undefined ? (data.saml_issuer ? data.saml_issuer.trim() : null) : currentOrg.saml_issuer;
  const samlCert = data.saml_cert !== undefined ? (data.saml_cert ? data.saml_cert.trim() : null) : currentOrg.saml_cert;

  await pool.query(
    `UPDATE organizations 
     SET name = ?, slug = ?, domain = ?, saml_enabled = ?, saml_entry_point = ?, saml_issuer = ?, saml_cert = ?
     WHERE id = ?`,
    [newName, newSlug, cleanDomain, samlEnabled, samlEntryPoint, samlIssuer, samlCert, currentOrg.id]
  );

  const [updatedRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM organizations WHERE id = ?',
    [currentOrg.id]
  );
  return updatedRows[0] as OrganizationRecord;
}

async function getOrganizationMembers(orgId: number): Promise<OrganizationMemberRecord[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.org_id, m.user_id, m.email, m.role, m.status, m.joined_at, u.username, u.avatar_url
     FROM organization_members m
     LEFT JOIN users u ON m.user_id = u.id
     WHERE m.org_id = ?
     ORDER BY (m.role = 'owner') DESC, m.joined_at ASC`,
    [orgId]
  );
  return rows as OrganizationMemberRecord[];
}

async function addOrganizationMember(
  orgId: number,
  rawEmail: string,
  role: string = 'member'
): Promise<OrganizationMemberRecord> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }

  const [orgRows] = await pool.query<RowDataPacket[]>(
    'SELECT seats_limit FROM organizations WHERE id = ?',
    [orgId]
  );
  if (!orgRows || orgRows.length === 0) {
    throw new Error('Organization not found.');
  }

  const seatsLimit = Number(orgRows[0].seats_limit || 25);
  const [countRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as count FROM organization_members WHERE org_id = ?',
    [orgId]
  );
  const currentCount = Number(countRows[0]?.count || 0);

  if (currentCount >= seatsLimit) {
    throw new Error(`Seat limit reached (${seatsLimit} seats maximum).`);
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM organization_members WHERE org_id = ? AND email = ?',
    [orgId, email]
  );
  if (existing && existing.length > 0) {
    throw new Error('User is already registered or invited to this organization.');
  }

  const [userRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, username, avatar_url FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  const matchedUser = userRows && userRows.length > 0 ? userRows[0] : null;
  const userId = matchedUser ? matchedUser.id : null;
  const status = matchedUser ? 'active' : 'invited';

  const [insertResult] = await pool.query<any>(
    `INSERT INTO organization_members (org_id, user_id, email, role, status)
     VALUES (?, ?, ?, ?, ?)`,
    [orgId, userId, email, role, status]
  );

  if (matchedUser) {
    await pool.query(
      `UPDATE users 
       SET subscription_tier = 'enterprise', storage_limit_bytes = 10995116277760
       WHERE id = ? AND subscription_tier != 'enterprise'`,
      [matchedUser.id]
    );
  }

  return {
    avatar_url: matchedUser?.avatar_url || null,
    email,
    id: insertResult.insertId,
    joined_at: new Date().toISOString(),
    org_id: orgId,
    role,
    status,
    user_id: userId,
    username: matchedUser?.username || null,
  };
}

async function removeOrganizationMember(
  orgId: number,
  memberId: number,
  requesterUserId: number
): Promise<boolean> {
  const [memberRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM organization_members WHERE id = ? AND org_id = ?',
    [memberId, orgId]
  );

  if (!memberRows || memberRows.length === 0) {
    throw new Error('Member not found.');
  }

  const member = memberRows[0] as OrganizationMemberRecord;
  if (member.role === 'owner') {
    throw new Error('The organization owner cannot be removed.');
  }

  if (member.user_id === requesterUserId) {
    throw new Error('You cannot remove yourself from this panel.');
  }

  await pool.query(
    'DELETE FROM organization_members WHERE id = ? AND org_id = ?',
    [memberId, orgId]
  );

  return true;
}

async function resolveOrganizationByDomainOrSlug(
  identifier: string
): Promise<OrganizationRecord | null> {
  let clean = identifier.trim().toLowerCase();
  if (clean.includes('@')) {
    clean = clean.split('@').pop() || '';
  }

  if (!clean) return null;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM organizations 
     WHERE (domain = ? OR slug = ?) AND saml_enabled = TRUE
     LIMIT 1`,
    [clean, clean]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  return rows[0] as OrganizationRecord;
}

async function resolveOrganizationByIssuer(
  issuer: string
): Promise<OrganizationRecord | null> {
  const clean = issuer.trim();
  if (!clean) return null;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM organizations 
     WHERE (saml_issuer = ? OR saml_entry_point LIKE ?) AND saml_enabled = TRUE
     LIMIT 1`,
    [clean, `%${clean}%`]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  return rows[0] as OrganizationRecord;
}

async function processSsoLogin(
  email: string,
  orgSlug: string
): Promise<any> {
  const cleanEmail = email.trim().toLowerCase();
  const [orgRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM organizations WHERE slug = ? AND saml_enabled = TRUE LIMIT 1',
    [orgSlug]
  );

  if (!orgRows || orgRows.length === 0) {
    throw new Error('Organization not found or SAML SSO is disabled.');
  }

  const org = orgRows[0] as OrganizationRecord;
  const emailDomain = cleanEmail.split('@').pop() || '';

  const [memberRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM organization_members WHERE org_id = ? AND email = ? LIMIT 1',
    [org.id, cleanEmail]
  );

  const isMember = memberRows && memberRows.length > 0;
  const isDomainMatch = org.domain && org.domain.toLowerCase() === emailDomain;

  if (!isMember && !isDomainMatch) {
    throw new Error('Your email domain is not authorized for this organization SSO.');
  }

  const [userRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [cleanEmail]
  );

  let userRow = userRows && userRows.length > 0 ? userRows[0] : null;

  if (!userRow) {
    const baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    const uniqueUsername = await generateUniqueUsername(baseUsername || 'enterprise_user');
    const userUuid = crypto.randomUUID();

    const [insertResult] = await pool.query<any>(
      `INSERT INTO users (uuid, username, email, subscription_tier, subscription_status, storage_limit_bytes)
       VALUES (?, ?, ?, 'enterprise', 'active', 10995116277760)`,
      [userUuid, uniqueUsername, cleanEmail]
    );

    const newUserId = insertResult.insertId;
    await pool.query(
      'INSERT INTO user_preferences (user_id) VALUES (?)',
      [newUserId]
    );

    const [roleRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM roles WHERE name = 'USER' LIMIT 1"
    );
    if (roleRows && roleRows.length > 0) {
      await pool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [newUserId, roleRows[0].id]
      );
    }

    const [createdUserRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ?',
      [newUserId]
    );
    userRow = createdUserRows[0];
  } else {
    if (userRow.subscription_tier !== 'enterprise') {
      await pool.query(
        `UPDATE users 
         SET subscription_tier = 'enterprise', storage_limit_bytes = 10995116277760
         WHERE id = ?`,
        [userRow.id]
      );
      userRow.subscription_tier = 'enterprise';
    }
  }

  if (isMember) {
    if (!memberRows[0].user_id) {
      await pool.query(
        'UPDATE organization_members SET user_id = ?, status = \'active\' WHERE id = ?',
        [userRow.id, memberRows[0].id]
      );
    }
  } else {
    const [countRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM organization_members WHERE org_id = ?',
      [org.id]
    );
    const count = Number(countRows[0]?.count || 0);
    if (count < org.seats_limit) {
      await pool.query(
        `INSERT INTO organization_members (org_id, user_id, email, role, status)
         VALUES (?, ?, ?, 'member', 'active')`,
        [org.id, userRow.id, cleanEmail]
      );
    }
  }

  return userRow;
}

export {
  addOrganizationMember,
  getOrCreateUserOrganization,
  getOrganizationMembers,
  processSsoLogin,
  removeOrganizationMember,
  resolveOrganizationByDomainOrSlug,
  resolveOrganizationByIssuer,
  updateOrganization
};

export type {
  OrganizationMemberRecord,
  OrganizationRecord
};
