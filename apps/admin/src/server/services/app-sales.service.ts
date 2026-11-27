import { appPool, corePool } from '../config/database.config.js';
import crypto from 'crypto';
import { deleteFromS3, sanitizeAndUploadToS3 } from './s3.service.js';
import type {
  EnterpriseContractItem,
  EnterpriseLeadDetail,
  EnterpriseLeadItem,
  EnterpriseLeadMatchedUser,
  ProvisionEnterpriseInput,
  ProvisionEnterpriseResult,
} from '../types/admin.types.js';
import { FileSanitizationError } from '../utils/sanitizer.util.js';
import { getRedisClient } from '../config/redis.config.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

interface LeadRow extends RowDataPacket {
  company_name: string;
  company_size: string;
  country: string;
  created_at: string;
  first_name: string;
  hear_about: string;
  id: number;
  last_name: string;
  notes: string | null;
  phone_number: string;
  role_level: string;
  status: 'approved' | 'contacted' | 'pending' | 'rejected';
  updated_at: string;
  user_id: number | null;
  uuid: string;
  work_email: string;
}

interface CoreUserLookupRow extends RowDataPacket {
  avatar_url: string | null;
  email: string;
  id: number;
  status: string;
  username: string;
}

interface AppProfileLookupRow extends RowDataPacket {
  storage_limit_bytes: number | string;
  storage_used_bytes: number | string;
  subscription_period_end: string | null;
  subscription_status: string;
  subscription_tier: string;
  user_id: number;
}

interface OrgLookupRow extends RowDataPacket {
  domain: string | null;
  id: number;
  is_owner: number;
  name: string;
  seats_limit: number;
  slug: string;
  target_user_id: number;
}

interface ContractLinkRow extends RowDataPacket {
  id: number;
  lead_id: number | null;
  organization_id: number | null;
  user_id: number | null;
}

interface ContractRow extends RowDataPacket {
  created_at: string;
  file_size_bytes: number | string;
  id: number;
  lead_id: number | null;
  mime_type: string;
  organization_id: number | null;
  original_filename: string;
  s3_key: string;
  sha256_hash: string;
  title: string;
  uploaded_by_user_id: number;
  user_id: number | null;
  uuid: string;
}

const DEFAULT_STORAGE_LIMIT_BYTES = 5368709120;
const MIN_STORAGE_BYTES = 1073741824;
const ALLOWED_CONTRACT_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];
const MAX_CONTRACT_BYTES = 20 * 1024 * 1024;

async function resolveMatchedUsersMap(leads: LeadRow[]): Promise<Map<number, EnterpriseLeadMatchedUser>> {
  const userIds = Array.from(new Set(leads.map((l) => l.user_id).filter((id): id is number => typeof id === 'number' && id > 0)));
  const emails = Array.from(new Set(leads.map((l) => String(l.work_email || '').trim().toLowerCase()).filter(Boolean)));

  if (userIds.length === 0 && emails.length === 0) {
    return new Map();
  }

  const conditions: string[] = [];
  const params: any[] = [];
  if (userIds.length > 0) {
    conditions.push(`id IN (${userIds.map(() => '?').join(', ')})`);
    params.push(...userIds);
  }
  if (emails.length > 0) {
    conditions.push(`LOWER(email) IN (${emails.map(() => '?').join(', ')})`);
    params.push(...emails);
  }

  const [coreUsers] = await corePool.execute<CoreUserLookupRow[]>(
    `SELECT id, username, email, avatar_url, status FROM users WHERE ${conditions.join(' OR ')}`,
    params
  );

  if (coreUsers.length === 0) {
    return new Map();
  }

  const resolvedUserIds = coreUsers.map((u) => Number(u.id));
  const placeholders = resolvedUserIds.map(() => '?').join(', ');

  const [[profiles], [orgs]] = await Promise.all([
    appPool.execute<AppProfileLookupRow[]>(
      `SELECT user_id, subscription_tier, subscription_status, subscription_period_end, storage_used_bytes, storage_limit_bytes
       FROM app_user_profiles
       WHERE user_id IN (${placeholders})`,
      resolvedUserIds
    ),
    appPool.execute<OrgLookupRow[]>(
      `SELECT o.id, o.name, o.slug, o.domain, o.seats_limit, o.owner_id AS target_user_id, 1 AS is_owner
       FROM organizations o
       WHERE o.owner_id IN (${placeholders})
       UNION ALL
       SELECT o.id, o.name, o.slug, o.domain, o.seats_limit, om.user_id AS target_user_id, 0 AS is_owner
       FROM organizations o
       INNER JOIN organization_members om ON om.org_id = o.id
       WHERE om.user_id IN (${placeholders}) AND o.owner_id NOT IN (${placeholders})`,
      [...resolvedUserIds, ...resolvedUserIds, ...resolvedUserIds]
    ),
  ]);

  const profileMap = new Map<number, AppProfileLookupRow>();
  for (const p of profiles) {
    profileMap.set(Number(p.user_id), p);
  }

  const orgMap = new Map<number, OrgLookupRow>();
  for (const o of orgs) {
    const uid = Number(o.target_user_id);
    const existing = orgMap.get(uid);
    if (!existing || Number(o.is_owner) === 1) {
      orgMap.set(uid, o);
    }
  }

  const userById = new Map<number, EnterpriseLeadMatchedUser>();
  const userByEmail = new Map<string, EnterpriseLeadMatchedUser>();

  for (const u of coreUsers) {
    const uid = Number(u.id);
    const p = profileMap.get(uid);
    const o = orgMap.get(uid);
    const matched: EnterpriseLeadMatchedUser = {
      avatarUrl: u.avatar_url || null,
      email: String(u.email),
      id: uid,
      organizationDomain: o?.domain || null,
      organizationId: o ? Number(o.id) : null,
      organizationName: o?.name || null,
      organizationSlug: o?.slug || null,
      seatsLimit: o ? Number(o.seats_limit) : null,
      status: String(u.status || 'active'),
      storageLimitBytes: p ? Number(p.storage_limit_bytes || DEFAULT_STORAGE_LIMIT_BYTES) : DEFAULT_STORAGE_LIMIT_BYTES,
      storageUsedBytes: p ? Number(p.storage_used_bytes || 0) : 0,
      subscriptionPeriodEnd: p?.subscription_period_end || null,
      subscriptionStatus: p ? String(p.subscription_status || 'inactive').toLowerCase() : 'inactive',
      subscriptionTier: p ? String(p.subscription_tier || 'free').toLowerCase() : 'free',
      username: String(u.username),
    };
    userById.set(uid, matched);
    userByEmail.set(matched.email.toLowerCase(), matched);
  }

  const leadToUserMap = new Map<number, EnterpriseLeadMatchedUser>();
  for (const lead of leads) {
    const byId = lead.user_id ? userById.get(Number(lead.user_id)) : undefined;
    const byEmail = userByEmail.get(String(lead.work_email || '').trim().toLowerCase());
    const found = byId || byEmail || null;
    if (found) {
      leadToUserMap.set(Number(lead.id), found);
    }
  }

  return leadToUserMap;
}

function mapContractRow(row: ContractRow): EnterpriseContractItem {
  return {
    createdAt: String(row.created_at),
    fileSizeBytes: Number(row.file_size_bytes || 0),
    id: Number(row.id),
    leadId: row.lead_id ? Number(row.lead_id) : null,
    mimeType: String(row.mime_type),
    organizationId: row.organization_id ? Number(row.organization_id) : null,
    originalFilename: String(row.original_filename),
    title: String(row.title),
    uploadedByUserId: Number(row.uploaded_by_user_id),
    userId: row.user_id ? Number(row.user_id) : null,
    uuid: String(row.uuid),
  };
}

function mapLeadRow(
  row: LeadRow,
  matchedUser: EnterpriseLeadMatchedUser | null,
  contractsCount: number
): EnterpriseLeadItem {
  return {
    companyName: String(row.company_name),
    companySize: String(row.company_size),
    contractsCount,
    country: String(row.country),
    createdAt: String(row.created_at),
    firstName: String(row.first_name),
    hearAbout: String(row.hear_about || ''),
    id: Number(row.id),
    lastName: String(row.last_name),
    matchedUser,
    notes: row.notes || null,
    phoneNumber: String(row.phone_number),
    roleLevel: String(row.role_level),
    status: row.status,
    updatedAt: String(row.updated_at),
    userId: row.user_id ? Number(row.user_id) : null,
    uuid: String(row.uuid),
    workEmail: String(row.work_email),
  };
}

async function listEnterpriseLeads(): Promise<EnterpriseLeadItem[]> {
  const [[leadRows], [contractRows]] = await Promise.all([
    appPool.execute<LeadRow[]>(
      `SELECT id, uuid, user_id, first_name, last_name, work_email, hear_about,
              company_name, company_size, country, role_level, phone_number,
              notes, status, created_at, updated_at
       FROM enterprise_leads
       ORDER BY (status = 'pending') DESC, created_at DESC, id DESC`
    ),
    appPool.execute<ContractLinkRow[]>(
      'SELECT id, lead_id, user_id, organization_id FROM enterprise_contracts'
    ),
  ]);

  const matchedUsers = await resolveMatchedUsersMap(leadRows);

  return leadRows.map((row) => {
    const id = Number(row.id);
    const matchedUser = matchedUsers.get(id) || null;
    const effectiveUserId = row.user_id ? Number(row.user_id) : (matchedUser?.id || null);
    const effectiveOrgId = matchedUser?.organizationId || null;

    const matchingContracts = new Set<number>();
    for (const c of contractRows) {
      const cLeadId = c.lead_id ? Number(c.lead_id) : null;
      const cUserId = c.user_id ? Number(c.user_id) : null;
      const cOrgId = c.organization_id ? Number(c.organization_id) : null;
      if (
        cLeadId === id ||
        (effectiveUserId !== null && cUserId === effectiveUserId) ||
        (effectiveOrgId !== null && cOrgId === effectiveOrgId)
      ) {
        matchingContracts.add(Number(c.id));
      }
    }

    return mapLeadRow(row, matchedUser, matchingContracts.size);
  });
}

async function getEnterpriseLeadDetail(leadId: number): Promise<EnterpriseLeadDetail | null> {
  const [leadRows] = await appPool.execute<LeadRow[]>(
    `SELECT id, uuid, user_id, first_name, last_name, work_email, hear_about,
            company_name, company_size, country, role_level, phone_number,
            notes, status, created_at, updated_at
     FROM enterprise_leads
     WHERE id = ?
     LIMIT 1`,
    [leadId]
  );

  if (leadRows.length === 0) {
    return null;
  }

  const row = leadRows[0];
  const matchedUsers = await resolveMatchedUsersMap(leadRows);
  const matchedUser = matchedUsers.get(Number(row.id)) || null;
  const effectiveUserId = row.user_id ? Number(row.user_id) : (matchedUser?.id || null);
  const effectiveOrgId = matchedUser?.organizationId || null;

  const contractConditions: string[] = ['lead_id = ?'];
  const contractParams: any[] = [leadId];
  if (effectiveUserId !== null) {
    contractConditions.push('user_id = ?');
    contractParams.push(effectiveUserId);
  }
  if (effectiveOrgId !== null) {
    contractConditions.push('organization_id = ?');
    contractParams.push(effectiveOrgId);
  }

  const [contractRows] = await appPool.execute<ContractRow[]>(
    `SELECT id, uuid, lead_id, user_id, organization_id, title, original_filename,
            s3_key, mime_type, file_size_bytes, sha256_hash, uploaded_by_user_id, created_at
     FROM enterprise_contracts
     WHERE ${contractConditions.join(' OR ')}
     ORDER BY created_at DESC, id DESC`,
    contractParams
  );

  const contracts = contractRows.map(mapContractRow);

  return {
    contracts,
    lead: mapLeadRow(row, matchedUser, contracts.length),
  };
}

async function lookupAppUserByEmail(email: string): Promise<EnterpriseLeadMatchedUser | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;

  const [coreUsers] = await corePool.execute<CoreUserLookupRow[]>(
    'SELECT id, username, email, avatar_url, status FROM users WHERE LOWER(email) = ? LIMIT 1',
    [cleanEmail]
  );

  if (coreUsers.length === 0) {
    return null;
  }

  const u = coreUsers[0];
  const uid = Number(u.id);

  const [[profiles], [orgs]] = await Promise.all([
    appPool.execute<AppProfileLookupRow[]>(
      `SELECT user_id, subscription_tier, subscription_status, subscription_period_end, storage_used_bytes, storage_limit_bytes
       FROM app_user_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [uid]
    ),
    appPool.execute<OrgLookupRow[]>(
      `SELECT o.id, o.name, o.slug, o.domain, o.seats_limit, o.owner_id AS target_user_id, 1 AS is_owner
       FROM organizations o
       WHERE o.owner_id = ?
       UNION ALL
       SELECT o.id, o.name, o.slug, o.domain, o.seats_limit, om.user_id AS target_user_id, 0 AS is_owner
       FROM organizations o
       INNER JOIN organization_members om ON om.org_id = o.id
       WHERE om.user_id = ?
       ORDER BY is_owner DESC, id ASC
       LIMIT 1`,
      [uid, uid]
    ),
  ]);

  const p = profiles[0] || null;
  const o = orgs[0] || null;

  return {
    avatarUrl: u.avatar_url || null,
    email: String(u.email),
    id: uid,
    organizationDomain: o?.domain || null,
    organizationId: o ? Number(o.id) : null,
    organizationName: o?.name || null,
    organizationSlug: o?.slug || null,
    seatsLimit: o ? Number(o.seats_limit) : null,
    status: String(u.status || 'active'),
    storageLimitBytes: p ? Number(p.storage_limit_bytes || DEFAULT_STORAGE_LIMIT_BYTES) : DEFAULT_STORAGE_LIMIT_BYTES,
    storageUsedBytes: p ? Number(p.storage_used_bytes || 0) : 0,
    subscriptionPeriodEnd: p?.subscription_period_end || null,
    subscriptionStatus: p ? String(p.subscription_status || 'inactive').toLowerCase() : 'inactive',
    subscriptionTier: p ? String(p.subscription_tier || 'free').toLowerCase() : 'free',
    username: String(u.username),
  };
}

async function updateEnterpriseLeadStatus(
  leadId: number,
  status: 'approved' | 'contacted' | 'pending' | 'rejected'
): Promise<boolean> {
  const [result] = await appPool.execute<ResultSetHeader>(
    'UPDATE enterprise_leads SET status = ? WHERE id = ?',
    [status, leadId]
  );
  return result.affectedRows > 0;
}

async function ensureUserAppMembershipForCore(userId: number, appId: number): Promise<void> {
  await corePool.execute(
    `INSERT INTO user_apps (user_id, app_id, status)
     VALUES (?, ?, 'active')
     ON DUPLICATE KEY UPDATE status = 'active'`,
    [userId, appId]
  );

  const [existingRoles] = await corePool.execute<RowDataPacket[]>(
    'SELECT role_id FROM user_app_roles WHERE user_id = ? AND app_id = ? LIMIT 1',
    [userId, appId]
  );

  if (existingRoles.length === 0) {
    await corePool.execute(
      `INSERT IGNORE INTO user_app_roles (user_id, app_id, role_id)
       SELECT ?, ?, id FROM roles WHERE is_default = TRUE LIMIT 1`,
      [userId, appId]
    );
  }
}

async function provisionEnterpriseSubscription(
  input: ProvisionEnterpriseInput
): Promise<ProvisionEnterpriseResult> {
  const cleanEmail = input.userEmail.trim().toLowerCase();
  const [userRows] = await corePool.execute<CoreUserLookupRow[]>(
    'SELECT id, username, email, status FROM users WHERE LOWER(email) = ? LIMIT 1',
    [cleanEmail]
  );

  if (userRows.length === 0) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }

  const targetUser = userRows[0];
  const userId = Number(targetUser.id);

  if (!Number.isFinite(input.seatsLimit) || input.seatsLimit < 1 || input.seatsLimit > 100000) {
    throw new Error('INVALID_SEATS');
  }

  if (!Number.isFinite(input.storageLimitBytes) || input.storageLimitBytes < MIN_STORAGE_BYTES) {
    throw new Error('INVALID_STORAGE');
  }

  if (!Number.isFinite(input.durationMonths) || input.durationMonths < 1 || input.durationMonths > 120) {
    throw new Error('INVALID_DURATION');
  }

  if (!Number.isFinite(input.contractAmount) || input.contractAmount < 0) {
    throw new Error('INVALID_AMOUNT');
  }

  const seatsLimit = Math.floor(input.seatsLimit);
  const storageLimitBytes = Math.floor(input.storageLimitBytes);
  const durationMonths = Math.floor(input.durationMonths);
  const contractAmount = Number(input.contractAmount.toFixed(2));
  const cleanCurrency = (input.currency || 'USD').trim().toUpperCase().slice(0, 10) || 'USD';
  const cleanOrgName = (input.organizationName.trim() || `${targetUser.username} Organization`).slice(0, 100);
  const rawCleanDomain = input.organizationDomain
    ? input.organizationDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    : '';
  const cleanDomain = rawCleanDomain ? rawCleanDomain.slice(0, 100) : null;

  const now = new Date();
  const periodEnd = new Date(now.getTime());
  periodEnd.setMonth(periodEnd.getMonth() + durationMonths);

  await ensureUserAppMembershipForCore(userId, input.appId);

  const conn = await appPool.getConnection();
  let organizationId = 0;

  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO app_user_profiles
       (user_id, subscription_tier, subscription_status, subscription_period_end, storage_limit_bytes, cancel_at_period_end)
       VALUES (?, 'enterprise', 'active', ?, ?, FALSE)
       ON DUPLICATE KEY UPDATE
         subscription_tier = 'enterprise',
         subscription_status = 'active',
         subscription_period_end = VALUES(subscription_period_end),
         storage_limit_bytes = VALUES(storage_limit_bytes),
         cancel_at_period_end = FALSE`,
      [userId, periodEnd, storageLimitBytes]
    );

    const [existingOrgRows] = await conn.execute<RowDataPacket[]>(
      'SELECT id, name, domain FROM organizations WHERE owner_id = ? LIMIT 1',
      [userId]
    );

    if (existingOrgRows.length > 0) {
      organizationId = Number(existingOrgRows[0].id);
      const nextDomain = input.organizationDomain !== undefined ? cleanDomain : (existingOrgRows[0].domain || null);
      await conn.execute(
        'UPDATE organizations SET name = ?, domain = ?, seats_limit = ? WHERE id = ?',
        [cleanOrgName, nextDomain, seatsLimit, organizationId]
      );
    } else {
      const orgUuid = crypto.randomUUID();
      const orgSlug = `org-${userId}-${Date.now().toString(36)}`;
      const [insertOrg] = await conn.execute<ResultSetHeader>(
        `INSERT INTO organizations (uuid, owner_id, name, slug, domain, seats_limit, saml_enabled)
         VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
        [orgUuid, userId, cleanOrgName, orgSlug, cleanDomain, seatsLimit]
      );
      organizationId = Number(insertOrg.insertId);
    }

    const [ownerMemberRows] = await conn.execute<RowDataPacket[]>(
      'SELECT id FROM organization_members WHERE org_id = ? AND (user_id = ? OR LOWER(email) = ?) LIMIT 1',
      [organizationId, userId, cleanEmail]
    );

    if (ownerMemberRows.length === 0) {
      await conn.execute(
        `INSERT INTO organization_members (org_id, user_id, email, role, status)
         VALUES (?, ?, ?, 'owner', 'active')`,
        [organizationId, userId, cleanEmail]
      );
    } else {
      await conn.execute(
        `UPDATE organization_members SET user_id = ?, role = 'owner', status = 'active' WHERE id = ?`,
        [userId, ownerMemberRows[0].id]
      );
    }

    await conn.execute(
      `UPDATE app_user_profiles aup
       INNER JOIN organization_members om ON om.user_id = aup.user_id
       SET aup.subscription_tier = 'enterprise',
           aup.subscription_status = 'active',
           aup.subscription_period_end = ?,
           aup.storage_limit_bytes = ?
       WHERE om.org_id = ? AND om.user_id IS NOT NULL`,
      [periodEnd, storageLimitBytes, organizationId]
    );

    await conn.execute(
      `UPDATE subscriptions
       SET status = 'replaced'
       WHERE user_id = ? AND status = 'active'`,
      [userId]
    );

    const billingPeriodValue = input.billingPeriod === 'yearly'
      ? 'yearly'
      : (input.billingPeriod === 'monthly' ? 'monthly' : `${durationMonths}_months`);

    await conn.execute(
      `INSERT INTO subscriptions
       (user_id, plan_id, billing_type, billing_period, amount, currency, status, cancel_at_period_end, current_period_start, current_period_end)
       VALUES (?, 'enterprise', 'enterprise_contract', ?, ?, ?, 'active', FALSE, ?, ?)`,
      [userId, billingPeriodValue, contractAmount, cleanCurrency, now, periodEnd]
    );

    if (contractAmount > 0) {
      const refCode = `ent_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
      await conn.execute(
        `INSERT INTO purchases
         (user_id, plan_id, billing_type, billing_period, amount_total, currency, status, stripe_payment_intent_id, created_at)
         VALUES (?, 'enterprise', 'enterprise_contract', ?, ?, ?, 'completed', ?, ?)`,
        [userId, billingPeriodValue, contractAmount, cleanCurrency, refCode, now]
      );
    }

    if (input.leadId) {
      await conn.execute(
        `UPDATE enterprise_leads
         SET status = 'approved', user_id = COALESCE(user_id, ?)
         WHERE id = ?`,
        [userId, input.leadId]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  try {
    const [memberRows] = await appPool.execute<RowDataPacket[]>(
      'SELECT DISTINCT user_id FROM organization_members WHERE org_id = ? AND user_id IS NOT NULL',
      [organizationId]
    );
    const cacheUserIds = new Set<number>([userId]);
    for (const memberRow of memberRows) {
      const memberId = Number(memberRow.user_id);
      if (memberId > 0) {
        cacheUserIds.add(memberId);
      }
    }
    const redis = getRedisClient();
    const keysToDelete = Array.from(cacheUserIds).map((id) => `user:cache:${id}`);
    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
  } catch {}

  return {
    organizationId,
    organizationName: cleanOrgName,
    periodEnd: periodEnd.toISOString(),
    seatsLimit,
    storageLimitBytes,
    userId,
  };
}

async function uploadEnterpriseContract(params: {
  adminUserId: number;
  buffer: Buffer;
  leadId?: number | null;
  organizationId?: number | null;
  originalName: string;
  title?: string;
  userEmail?: string | null;
}): Promise<EnterpriseContractItem> {
  const resolvedLeadId = params.leadId && params.leadId > 0 ? Math.floor(params.leadId) : null;
  let resolvedOrgId = params.organizationId && params.organizationId > 0 ? Math.floor(params.organizationId) : null;
  let resolvedUserId: number | null = null;

  if (params.userEmail && params.userEmail.trim()) {
    const matched = await lookupAppUserByEmail(params.userEmail);
    if (!matched && !resolvedLeadId && !resolvedOrgId) {
      throw new Error('ACCOUNT_NOT_FOUND');
    }
    if (matched) {
      resolvedUserId = matched.id;
      if (!resolvedOrgId && matched.organizationId) {
        resolvedOrgId = matched.organizationId;
      }
    }
  }

  if (resolvedLeadId) {
    const [leadRows] = await appPool.execute<LeadRow[]>(
      'SELECT id, user_id, work_email FROM enterprise_leads WHERE id = ? LIMIT 1',
      [resolvedLeadId]
    );
    if (leadRows.length === 0) {
      throw new Error('LEAD_NOT_FOUND');
    }
    const leadRow = leadRows[0];
    if (!resolvedUserId) {
      if (leadRow.user_id) {
        resolvedUserId = Number(leadRow.user_id);
      }
      const matchedFromLead = await lookupAppUserByEmail(String(leadRow.work_email || ''));
      if (matchedFromLead) {
        if (!resolvedUserId) {
          resolvedUserId = matchedFromLead.id;
        }
        if (!resolvedOrgId && matchedFromLead.organizationId) {
          resolvedOrgId = matchedFromLead.organizationId;
        }
      }
    }
  }

  if (!resolvedLeadId && !resolvedUserId && !resolvedOrgId) {
    throw new Error('CONTRACT_TARGET_REQUIRED');
  }

  if (resolvedUserId) {
    await appPool.execute(
      `INSERT IGNORE INTO app_user_profiles (user_id, subscription_tier, subscription_status)
       VALUES (?, 'free', 'active')`,
      [resolvedUserId]
    );
  }

  const uploaded = await sanitizeAndUploadToS3({
    allowedMimeTypes: ALLOWED_CONTRACT_MIMES,
    body: params.buffer,
    cacheControl: 'private, max-age=0, no-cache',
    folder: 'enterprise-contracts',
    maxSizeBytes: MAX_CONTRACT_BYTES,
    minSizeBytes: 16,
    originalName: params.originalName,
    prefix: 'contract',
  });

  const contractUuid = crypto.randomUUID();
  const cleanTitle = (params.title || '').trim().slice(0, 180) || uploaded.sanitized.originalName.slice(0, 180);
  const cleanOriginalFilename = uploaded.sanitized.originalName.slice(0, 255);

  let insertId = 0;
  try {
    const [insertResult] = await appPool.execute<ResultSetHeader>(
      `INSERT INTO enterprise_contracts
       (uuid, lead_id, user_id, organization_id, title, original_filename, s3_key, mime_type, file_size_bytes, sha256_hash, uploaded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contractUuid,
        resolvedLeadId,
        resolvedUserId,
        resolvedOrgId,
        cleanTitle,
        cleanOriginalFilename,
        uploaded.key,
        uploaded.sanitized.detectedMimeType,
        uploaded.sanitized.size,
        uploaded.sanitized.hash,
        params.adminUserId,
      ]
    );
    insertId = Number(insertResult.insertId);
  } catch (err) {
    await deleteFromS3(uploaded.key).catch(() => {});
    throw err;
  }

  const [rows] = await appPool.execute<ContractRow[]>(
    `SELECT id, uuid, lead_id, user_id, organization_id, title, original_filename,
            s3_key, mime_type, file_size_bytes, sha256_hash, uploaded_by_user_id, created_at
     FROM enterprise_contracts
     WHERE id = ?
     LIMIT 1`,
    [insertId]
  );

  if (rows.length > 0) {
    return mapContractRow(rows[0]);
  }

  return {
    createdAt: new Date().toISOString(),
    fileSizeBytes: uploaded.sanitized.size,
    id: insertId,
    leadId: resolvedLeadId,
    mimeType: uploaded.sanitized.detectedMimeType,
    organizationId: resolvedOrgId,
    originalFilename: cleanOriginalFilename,
    title: cleanTitle,
    uploadedByUserId: params.adminUserId,
    userId: resolvedUserId,
    uuid: contractUuid,
  };
}

async function getEnterpriseContractForDownload(
  contractId: number
): Promise<{ contract: EnterpriseContractItem; s3Key: string } | null> {
  const [rows] = await appPool.execute<ContractRow[]>(
    `SELECT id, uuid, lead_id, user_id, organization_id, title, original_filename,
            s3_key, mime_type, file_size_bytes, sha256_hash, uploaded_by_user_id, created_at
     FROM enterprise_contracts
     WHERE id = ?
     LIMIT 1`,
    [contractId]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    contract: mapContractRow(row),
    s3Key: String(row.s3_key),
  };
}

async function deleteEnterpriseContract(contractId: number): Promise<boolean> {
  const [rows] = await appPool.execute<ContractRow[]>(
    'SELECT id, s3_key FROM enterprise_contracts WHERE id = ? LIMIT 1',
    [contractId]
  );

  if (rows.length === 0) {
    return false;
  }

  await deleteFromS3(String(rows[0].s3_key));
  await appPool.execute('DELETE FROM enterprise_contracts WHERE id = ?', [contractId]);
  return true;
}

export {
  FileSanitizationError,
  deleteEnterpriseContract,
  getEnterpriseContractForDownload,
  getEnterpriseLeadDetail,
  listEnterpriseLeads,
  lookupAppUserByEmail,
  provisionEnterpriseSubscription,
  updateEnterpriseLeadStatus,
  uploadEnterpriseContract
};
