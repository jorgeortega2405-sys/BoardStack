import { getDbPool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { TeamInvitationRecord, TeamMemberRecord, TeamMemberRole, TeamRecord, TeamSummary } from '../types/team.types.js';
import { CACHE_KEYS, CACHE_TTL, cacheService } from './cache.service.js';
import { logger } from './logger.service.js';
import { sendTeamInvitationEmail } from './mail.service.js';
import crypto from 'crypto';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const TEAM_STORAGE_LIMIT_BYTES = 500 * 1024 * 1024 * 1024;
const TEAM_MONTHLY_TOKENS = 5000;
const INVITATION_TTL_DAYS = 7;

class TeamServiceError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function slugifyTeamName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'equipo'}-${suffix}`;
}

async function getTeamRolePermissions(role: TeamMemberRole, isSubscriptionActive: boolean): Promise<string[]> {
  const pool = getDbPool();
  const [roleRows] = await pool.query<RowDataPacket[]>(
    `SELECT p.name FROM team_role_permissions trp
     INNER JOIN permissions p ON p.id = trp.permission_id
     WHERE trp.role = ?`,
    [role]
  );

  const perms = new Set<string>(['tools:access']);
  for (const row of roleRows) {
    if (row.name) perms.add(String(row.name));
  }

  if (isSubscriptionActive) {
    const [subRows] = await pool.query<RowDataPacket[]>(
      `SELECT p.name FROM subscription_tier_permissions stp
       INNER JOIN permissions p ON p.id = stp.permission_id
       WHERE stp.tier = 'business'`
    );
    for (const row of subRows) {
      if (row.name) perms.add(String(row.name));
    }
  }

  return Array.from(perms);
}

async function getTeamById(teamId: number): Promise<TeamRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.*, (
       SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND tm.status = 'active'
     ) AS seats_used
     FROM teams t WHERE t.id = ? LIMIT 1`,
    [teamId]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as TeamRecord;
  return {
    ...row,
    ai_tokens_balance: Number(row.ai_tokens_balance || 0),
    seat_limit: Number(row.seat_limit || 1),
    seats_used: Number(row.seats_used || 1),
    storage_limit_bytes: Number(row.storage_limit_bytes || TEAM_STORAGE_LIMIT_BYTES),
    storage_used_bytes: Number(row.storage_used_bytes || 0),
  };
}

async function listUserTeams(userId: number): Promise<TeamSummary[]> {
  return (await cacheService.remember<TeamSummary[]>(
    CACHE_KEYS.userTeams(userId),
    CACHE_TTL.userTeams,
    async () => {
      const pool = getDbPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT t.*, tm.role AS member_role,
          (SELECT COUNT(*) FROM team_members tm2 WHERE tm2.team_id = t.id AND tm2.status = 'active') AS seats_used
         FROM teams t
         INNER JOIN team_members tm ON tm.team_id = t.id
         WHERE tm.user_id = ?
           AND tm.status = 'active'
           AND t.subscription_status = 'active'
         ORDER BY t.created_at ASC`,
        [userId]
      );

      const summaries: TeamSummary[] = [];
      for (const row of rows) {
        const role = (row.member_role || 'member') as TeamMemberRole;
        const permissions = await getTeamRolePermissions(role, row.subscription_status === 'active');
        summaries.push({
          ai_tokens_balance: Number(row.ai_tokens_balance || 0),
          ai_tokens_reset_at: row.ai_tokens_reset_at ? new Date(row.ai_tokens_reset_at).toISOString() : null,
          avatar_url: row.avatar_url || null,
          billing_period: row.billing_period || null,
          id: Number(row.id),
          name: String(row.name),
          owner_id: Number(row.owner_id),
          permissions,
          role,
          seat_limit: Number(row.seat_limit || 1),
          seats_used: Number(row.seats_used || 1),
          slug: String(row.slug),
          storage_limit_bytes: Number(row.storage_limit_bytes || TEAM_STORAGE_LIMIT_BYTES),
          storage_used_bytes: Number(row.storage_used_bytes || 0),
          subscription_period_end: row.subscription_period_end
            ? new Date(row.subscription_period_end).toISOString()
            : null,
          subscription_status: String(row.subscription_status),
          subscription_tier: String(row.subscription_tier || 'business'),
          uuid: String(row.uuid),
        });
      }
      return summaries;
    }
  )) || [];
}

async function getTeamContextForUser(teamId: number, userId: number): Promise<TeamSummary | null> {
  const teams = await listUserTeams(userId);
  return teams.find((t) => Number(t.id) === Number(teamId)) || null;
}

async function getPendingInvitationsCountForEmail(email: string): Promise<number> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM team_invitations ti
     INNER JOIN teams t ON t.id = ti.team_id
     WHERE LOWER(ti.email) = LOWER(?)
       AND ti.status = 'pending'
       AND ti.expires_at > NOW()
       AND t.subscription_status = 'active'`,
    [email.trim()]
  );
  return Number(rows[0]?.cnt || 0);
}

async function listPendingInvitationsForUser(email: string): Promise<Array<{
  expires_at: string;
  id: number;
  invited_by_name: string;
  role: 'admin' | 'member';
  team_id: number;
  team_name: string;
  token: string;
}>> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ti.id, ti.team_id, ti.role, ti.token, ti.expires_at,
            t.name AS team_name, u.username AS invited_by_name
     FROM team_invitations ti
     INNER JOIN teams t ON t.id = ti.team_id
     INNER JOIN users u ON u.id = ti.invited_by
     WHERE LOWER(ti.email) = LOWER(?)
       AND ti.status = 'pending'
       AND ti.expires_at > NOW()
       AND t.subscription_status = 'active'
     ORDER BY ti.created_at DESC`,
    [email.trim()]
  );

  return rows.map((r) => ({
    expires_at: new Date(r.expires_at).toISOString(),
    id: Number(r.id),
    invited_by_name: String(r.invited_by_name || 'BoardPDF'),
    role: (r.role === 'admin' ? 'admin' : 'member') as 'admin' | 'member',
    team_id: Number(r.team_id),
    team_name: String(r.team_name),
    token: String(r.token),
  }));
}

async function createPendingOrReuseTeamForCheckout(options: {
  billingPeriod: string;
  ownerId: number;
  seats: number;
  stripeCustomerId?: string | null;
  teamName: string;
}): Promise<TeamRecord> {
  const pool = getDbPool();
  const cleanName = (options.teamName || '').trim().slice(0, 120) || 'Mi Equipo BoardPDF';
  const safeSeats = Math.max(1, Math.min(100, Math.floor(Number(options.seats) || 1)));

  const [existingRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM teams
     WHERE owner_id = ? AND subscription_status = 'pending'
     ORDER BY id DESC LIMIT 1`,
    [options.ownerId]
  );

  if (existingRows.length > 0) {
    const existingId = Number(existingRows[0].id);
    await pool.query(
      `UPDATE teams
       SET name = ?, seat_limit = ?, billing_period = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), updated_at = NOW()
       WHERE id = ?`,
      [cleanName, safeSeats, options.billingPeriod, options.stripeCustomerId || null, existingId]
    );
    const updated = await getTeamById(existingId);
    if (updated) return updated;
  }

  const teamUuid = crypto.randomUUID();
  const slug = slugifyTeamName(cleanName);
  const resetAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO teams (
      uuid, name, slug, owner_id, subscription_tier, subscription_status,
      stripe_customer_id, billing_period, seat_limit,
      storage_used_bytes, storage_limit_bytes, ai_tokens_balance, ai_tokens_reset_at
    ) VALUES (?, ?, ?, ?, 'business', 'pending', ?, ?, ?, 0, ?, ?, ?)`,
    [
      teamUuid,
      cleanName,
      slug,
      options.ownerId,
      options.stripeCustomerId || null,
      options.billingPeriod,
      safeSeats,
      TEAM_STORAGE_LIMIT_BYTES,
      TEAM_MONTHLY_TOKENS,
      resetAt,
    ]
  );

  const teamId = res.insertId;
  await pool.query(
    `INSERT IGNORE INTO team_members (team_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`,
    [teamId, options.ownerId]
  );

  const created = await getTeamById(teamId);
  if (!created) {
    throw new TeamServiceError('TEAM_CREATE_FAILED', 'No se pudo inicializar el equipo.', 500);
  }
  return created;
}

async function createTeamFromPersonalBusiness(ownerId: number, rawName: string): Promise<TeamSummary> {
  const pool = getDbPool();
  const cleanName = (rawName || '').trim();
  if (cleanName.length < 2 || cleanName.length > 120) {
    throw new TeamServiceError('INVALID_TEAM_NAME', 'El nombre del equipo debe tener entre 2 y 120 caracteres.', 400);
  }

  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, subscription_tier, subscription_status, subscription_period_end, stripe_customer_id, stripe_subscription_id
     FROM users WHERE id = ? LIMIT 1`,
    [ownerId]
  );
  if (userRows.length === 0) {
    throw new TeamServiceError('USER_NOT_FOUND', 'Usuario no encontrado.', 404);
  }
  const user = userRows[0];
  if (user.subscription_tier !== 'business' || user.subscription_status !== 'active') {
    throw new TeamServiceError(
      'BUSINESS_REQUIRED',
      'Se requiere un plan BoardPDF Negocios activo para crear un equipo sin pasar por caja.',
      403
    );
  }

  const [ownedRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM teams WHERE owner_id = ? AND subscription_status = 'active'`,
    [ownerId]
  );
  if (Number(ownedRows[0]?.cnt || 0) > 0) {
    throw new TeamServiceError(
      'ADDITIONAL_TEAM_CHECKOUT_REQUIRED',
      'Ya administras un equipo activo con tu plan actual. Contrata un nuevo equipo en Checkout.',
      402
    );
  }

  const teamUuid = crypto.randomUUID();
  const slug = slugifyTeamName(cleanName);
  const periodEnd = user.subscription_period_end
    ? new Date(user.subscription_period_end)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const resetAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO teams (
      uuid, name, slug, owner_id, subscription_tier, subscription_status,
      stripe_customer_id, stripe_subscription_id, billing_period, subscription_period_end,
      seat_limit, storage_used_bytes, storage_limit_bytes, ai_tokens_balance, ai_tokens_reset_at
    ) VALUES (?, ?, ?, ?, 'business', 'active', ?, ?, 'monthly', ?, 1, 0, ?, ?, ?)`,
    [
      teamUuid,
      cleanName,
      slug,
      ownerId,
      user.stripe_customer_id || null,
      user.stripe_subscription_id || null,
      periodEnd,
      TEAM_STORAGE_LIMIT_BYTES,
      TEAM_MONTHLY_TOKENS,
      resetAt,
    ]
  );

  const teamId = res.insertId;
  await pool.query(
    `INSERT IGNORE INTO team_members (team_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`,
    [teamId, ownerId]
  );

  await cacheService.invalidateUserOrg(ownerId);
  const summary = await getTeamContextForUser(teamId, ownerId);
  if (!summary) {
    throw new TeamServiceError('TEAM_CREATE_FAILED', 'No se pudo inicializar el equipo.', 500);
  }
  return summary;
}

async function activateTeamSubscription(options: {
  billingPeriod: string;
  periodEnd: Date | null;
  seats: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  teamId: number;
}): Promise<TeamRecord | null> {
  const pool = getDbPool();
  const existing = await getTeamById(options.teamId);
  if (!existing) return null;

  const nextSeats = Math.max(1, Number(options.seats || existing.seat_limit || 1));
  const wasActive = existing.subscription_status === 'active';

  await pool.query(
    `UPDATE teams
     SET subscription_tier = 'business',
         subscription_status = 'active',
         stripe_customer_id = COALESCE(?, stripe_customer_id),
         stripe_subscription_id = COALESCE(?, stripe_subscription_id),
         billing_period = ?,
         subscription_period_end = ?,
         seat_limit = ?,
         storage_limit_bytes = ?,
         ai_tokens_balance = CASE WHEN ? = 0 THEN ? ELSE ai_tokens_balance END,
         ai_tokens_reset_at = CASE WHEN ai_tokens_reset_at IS NULL THEN DATE_ADD(NOW(), INTERVAL 1 MONTH) ELSE ai_tokens_reset_at END,
         updated_at = NOW()
     WHERE id = ?`,
    [
      options.stripeCustomerId || null,
      options.stripeSubscriptionId || null,
      options.billingPeriod,
      options.periodEnd,
      nextSeats,
      TEAM_STORAGE_LIMIT_BYTES,
      wasActive ? 1 : 0,
      TEAM_MONTHLY_TOKENS,
      options.teamId,
    ]
  );

  await pool.query(
    `INSERT IGNORE INTO team_members (team_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`,
    [options.teamId, existing.owner_id]
  );

  const memberIds = await getTeamMemberUserIds(options.teamId);
  await cacheService.invalidateTeam(options.teamId, memberIds);
  logger.db.info('Suscripción de equipo activada/actualizada', {
    seats: nextSeats,
    stripeSubscriptionId: options.stripeSubscriptionId,
    teamId: options.teamId,
  });
  return getTeamById(options.teamId);
}

async function getTeamMemberUserIds(teamId: number): Promise<number[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM team_members WHERE team_id = ?`,
    [teamId]
  );
  return rows.map((r) => Number(r.user_id));
}

async function getTeamMembersAndInvitations(teamId: number): Promise<{
  invitations: TeamInvitationRecord[];
  members: TeamMemberRecord[];
  pendingCount: number;
  seatLimit: number;
  seatsAvailable: number;
  seatsUsed: number;
}> {
  const pool = getDbPool();
  const team = await getTeamById(teamId);
  if (!team) {
    throw new TeamServiceError('TEAM_NOT_FOUND', 'Equipo no encontrado.', 404);
  }

  const [memberRows] = await pool.query<RowDataPacket[]>(
    `SELECT tm.id, tm.team_id, tm.user_id, tm.role, tm.status, tm.invited_by, tm.joined_at,
            u.username, u.email, u.avatar_url
     FROM team_members tm
     INNER JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ? AND tm.status = 'active'
     ORDER BY FIELD(tm.role, 'owner', 'admin', 'member'), tm.joined_at ASC`,
    [teamId]
  );

  const [invRows] = await pool.query<RowDataPacket[]>(
    `SELECT ti.id, ti.team_id, ti.email, ti.role, ti.token, ti.invited_by, ti.status,
            ti.expires_at, ti.created_at, u.username AS invited_by_name
     FROM team_invitations ti
     INNER JOIN users u ON u.id = ti.invited_by
     WHERE ti.team_id = ? AND ti.status = 'pending' AND ti.expires_at > NOW()
     ORDER BY ti.created_at DESC`,
    [teamId]
  );

  const members: TeamMemberRecord[] = memberRows.map((r) => ({
    avatar_url: r.avatar_url || null,
    email: String(r.email),
    id: Number(r.id),
    invited_by: r.invited_by ? Number(r.invited_by) : null,
    joined_at: new Date(r.joined_at).toISOString(),
    role: r.role as TeamMemberRole,
    status: r.status as 'active' | 'suspended',
    team_id: Number(r.team_id),
    user_id: Number(r.user_id),
    username: String(r.username),
  }));

  const invitations: TeamInvitationRecord[] = invRows.map((r) => ({
    created_at: new Date(r.created_at).toISOString(),
    email: String(r.email),
    expires_at: new Date(r.expires_at).toISOString(),
    id: Number(r.id),
    invited_by: Number(r.invited_by),
    invited_by_name: String(r.invited_by_name || ''),
    role: r.role === 'admin' ? 'admin' : 'member',
    status: r.status as TeamInvitationRecord['status'],
    team_id: Number(r.team_id),
    token: String(r.token),
  }));

  const seatsUsed = members.length;
  const pendingCount = invitations.length;
  const seatLimit = Number(team.seat_limit || 1);
  const seatsAvailable = Math.max(0, seatLimit - seatsUsed - pendingCount);

  return {
    invitations,
    members,
    pendingCount,
    seatLimit,
    seatsAvailable,
    seatsUsed,
  };
}

async function updateTeamProfile(teamId: number, updates: { name?: string }): Promise<TeamRecord> {
  const pool = getDbPool();
  const team = await getTeamById(teamId);
  if (!team) {
    throw new TeamServiceError('TEAM_NOT_FOUND', 'Equipo no encontrado.', 404);
  }

  const nextName = (updates.name || '').trim();
  if (nextName.length < 2 || nextName.length > 120) {
    throw new TeamServiceError('INVALID_TEAM_NAME', 'El nombre del equipo debe tener entre 2 y 120 caracteres.', 400);
  }

  await pool.query(`UPDATE teams SET name = ?, updated_at = NOW() WHERE id = ?`, [nextName, teamId]);
  const memberIds = await getTeamMemberUserIds(teamId);
  await cacheService.invalidateTeam(teamId, memberIds);

  const updated = await getTeamById(teamId);
  if (!updated) {
    throw new TeamServiceError('TEAM_NOT_FOUND', 'Equipo no encontrado.', 404);
  }
  return updated;
}

async function inviteMemberToTeam(options: {
  email: string;
  invitedByUserId: number;
  inviterName: string;
  role: 'admin' | 'member';
  teamId: number;
}): Promise<{ emailSent: boolean; invitation: TeamInvitationRecord; inviteUrl: string }> {
  const pool = getDbPool();
  const normalizedEmail = (options.email || '').trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new TeamServiceError('INVALID_EMAIL', 'Ingresa un correo electrónico válido.', 400);
  }

  const team = await getTeamById(options.teamId);
  if (!team || team.subscription_status !== 'active') {
    throw new TeamServiceError('TEAM_INACTIVE', 'El equipo no cuenta con una suscripción activa.', 403);
  }

  const [existingMemberRows] = await pool.query<RowDataPacket[]>(
    `SELECT tm.id FROM team_members tm
     INNER JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ? AND LOWER(u.email) = ? AND tm.status = 'active' LIMIT 1`,
    [options.teamId, normalizedEmail]
  );
  if (existingMemberRows.length > 0) {
    throw new TeamServiceError('ALREADY_MEMBER', 'Esta persona ya forma parte del equipo.', 409);
  }

  const [existingInviteRows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM team_invitations
     WHERE team_id = ? AND LOWER(email) = ? AND status = 'pending' AND expires_at > NOW()
     LIMIT 1`,
    [options.teamId, normalizedEmail]
  );
  if (existingInviteRows.length > 0) {
    throw new TeamServiceError('ALREADY_INVITED', 'Ya existe una invitación pendiente para este correo.', 409);
  }

  const snapshot = await getTeamMembersAndInvitations(options.teamId);
  if (snapshot.seatsAvailable <= 0) {
    throw new TeamServiceError(
      'SEAT_LIMIT_REACHED',
      'No hay asientos disponibles. Agrega más asientos o revoca una invitación pendiente.',
      409
    );
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const role: 'admin' | 'member' = options.role === 'admin' ? 'admin' : 'member';

  const [insertRes] = await pool.query<ResultSetHeader>(
    `INSERT INTO team_invitations (team_id, email, role, token, invited_by, status, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [options.teamId, normalizedEmail, role, token, options.invitedByUserId, expiresAt]
  );

  const inviteUrl = `${config.baseUrl}/teams/invite?token=${encodeURIComponent(token)}`;
  const roleLabel = role === 'admin' ? 'Administrador' : 'Miembro';
  let emailSent = false;
  try {
    await sendTeamInvitationEmail(normalizedEmail, options.inviterName, team.name, roleLabel, inviteUrl);
    emailSent = true;
  } catch (err) {
    logger.app.warn('No se pudo enviar correo de invitación SMTP (se entrega enlace directo)', {
      email: normalizedEmail,
      error: err instanceof Error ? err.message : String(err),
      teamId: options.teamId,
    });
  }

  return {
    emailSent,
    invitation: {
      created_at: new Date().toISOString(),
      email: normalizedEmail,
      expires_at: expiresAt.toISOString(),
      id: insertRes.insertId,
      invited_by: options.invitedByUserId,
      invited_by_name: options.inviterName,
      role,
      status: 'pending',
      team_id: options.teamId,
      token,
    },
    inviteUrl,
  };
}

async function revokeInvitation(teamId: number, invitationId: number): Promise<void> {
  const pool = getDbPool();
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE team_invitations SET status = 'revoked', updated_at = NOW()
     WHERE id = ? AND team_id = ? AND status = 'pending'`,
    [invitationId, teamId]
  );
  if (res.affectedRows === 0) {
    throw new TeamServiceError('INVITE_NOT_FOUND', 'Invitación pendiente no encontrada.', 404);
  }
}

async function inspectInvitationByToken(token: string): Promise<{
  email: string;
  expires_at: string;
  invited_by_name: string;
  role: 'admin' | 'member';
  status: string;
  team_id: number;
  team_name: string;
} | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ti.email, ti.role, ti.status, ti.expires_at, ti.team_id,
            t.name AS team_name, t.subscription_status, u.username AS invited_by_name
     FROM team_invitations ti
     INNER JOIN teams t ON t.id = ti.team_id
     INNER JOIN users u ON u.id = ti.invited_by
     WHERE ti.token = ? LIMIT 1`,
    [token.trim()]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    email: String(r.email),
    expires_at: new Date(r.expires_at).toISOString(),
    invited_by_name: String(r.invited_by_name || 'BoardPDF'),
    role: r.role === 'admin' ? 'admin' : 'member',
    status: r.subscription_status !== 'active' ? 'team_inactive' : String(r.status),
    team_id: Number(r.team_id),
    team_name: String(r.team_name),
  };
}

async function acceptTeamInvitation(token: string, userId: number, userEmail: string): Promise<{
  team: TeamSummary;
}> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ti.*, t.name AS team_name, t.subscription_status, t.seat_limit
     FROM team_invitations ti
     INNER JOIN teams t ON t.id = ti.team_id
     WHERE ti.token = ? LIMIT 1`,
    [token.trim()]
  );

  if (rows.length === 0) {
    throw new TeamServiceError('INVITE_NOT_FOUND', 'La invitación no existe o ya no es válida.', 404);
  }

  const inv = rows[0];
  if (inv.status !== 'pending') {
    throw new TeamServiceError('INVITE_USED', 'Esta invitación ya fue utilizada o revocada.', 409);
  }
  if (new Date(inv.expires_at).getTime() <= Date.now()) {
    await pool.query(`UPDATE team_invitations SET status = 'expired' WHERE id = ?`, [inv.id]);
    throw new TeamServiceError('INVITE_EXPIRED', 'Esta invitación ha expirado.', 410);
  }
  if (inv.subscription_status !== 'active') {
    throw new TeamServiceError('TEAM_INACTIVE', 'El equipo de esta invitación no está activo.', 403);
  }

  if (String(inv.email).toLowerCase() !== String(userEmail).trim().toLowerCase()) {
    throw new TeamServiceError(
      'INVITE_EMAIL_MISMATCH',
      `Esta invitación fue enviada a ${inv.email}. Inicia sesión con esa cuenta para aceptarla.`,
      403
    );
  }

  const teamId = Number(inv.team_id);
  const [existingRows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
    [teamId, userId]
  );

  if (existingRows.length === 0) {
    const [activeCountRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ? AND status = 'active'`,
      [teamId]
    );
    const used = Number(activeCountRows[0]?.cnt || 0);
    if (used >= Number(inv.seat_limit || 1)) {
      throw new TeamServiceError(
        'SEAT_LIMIT_REACHED',
        'El equipo alcanzó el límite de asientos comprados. Pide al propietario ampliar los asientos.',
        409
      );
    }

    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, status, invited_by)
       VALUES (?, ?, ?, 'active', ?)
       ON DUPLICATE KEY UPDATE status = 'active', role = VALUES(role), invited_by = VALUES(invited_by), joined_at = NOW()`,
      [teamId, userId, inv.role, inv.invited_by]
    );
  }

  await pool.query(
    `UPDATE team_invitations
     SET status = 'accepted', accepted_by = ?, accepted_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [userId, inv.id]
  );

  const memberIds = await getTeamMemberUserIds(teamId);
  await cacheService.invalidateTeam(teamId, [...memberIds, userId]);

  const summary = await getTeamContextForUser(teamId, userId);
  if (!summary) {
    throw new TeamServiceError('TEAM_JOIN_FAILED', 'No se pudo completar la unión al equipo.', 500);
  }
  return { team: summary };
}

async function updateTeamMemberRole(
  teamId: number,
  targetUserId: number,
  newRole: 'admin' | 'member',
  actingUserId: number
): Promise<void> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT role FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
    [teamId, targetUserId]
  );
  if (rows.length === 0) {
    throw new TeamServiceError('MEMBER_NOT_FOUND', 'Miembro del equipo no encontrado.', 404);
  }
  if (rows[0].role === 'owner') {
    throw new TeamServiceError('CANNOT_DEMOTE_OWNER', 'No puedes cambiar el rol del propietario del equipo.', 403);
  }
  if (targetUserId === actingUserId) {
    throw new TeamServiceError('CANNOT_EDIT_SELF_ROLE', 'No puedes modificar tu propio rol.', 400);
  }

  const safeRole: 'admin' | 'member' = newRole === 'admin' ? 'admin' : 'member';
  await pool.query(
    `UPDATE team_members SET role = ?, updated_at = NOW() WHERE team_id = ? AND user_id = ?`,
    [safeRole, teamId, targetUserId]
  );

  await cacheService.invalidateTeam(teamId, [targetUserId]);
}

async function removeTeamMember(teamId: number, targetUserId: number, actingUserId: number): Promise<void> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT role FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
    [teamId, targetUserId]
  );
  if (rows.length === 0) {
    throw new TeamServiceError('MEMBER_NOT_FOUND', 'Miembro del equipo no encontrado.', 404);
  }
  if (rows[0].role === 'owner') {
    throw new TeamServiceError('CANNOT_REMOVE_OWNER', 'No puedes eliminar al propietario del equipo.', 403);
  }

  await pool.query(
    `DELETE FROM team_members WHERE team_id = ? AND user_id = ?`,
    [teamId, targetUserId]
  );
  await pool.query(
    `DELETE pfm FROM project_folder_members pfm
     INNER JOIN project_folders pf ON pf.id = pfm.folder_id
     WHERE pf.team_id = ? AND pfm.user_id = ?`,
    [teamId, targetUserId]
  );
  await pool.query(
    `DELETE cdm FROM collaborative_document_members cdm
     INNER JOIN collaborative_documents cd ON cd.id = cdm.document_id
     WHERE cd.team_id = ? AND cdm.user_id = ?`,
    [teamId, targetUserId]
  );

  await cacheService.invalidateTeam(teamId, [targetUserId, actingUserId]);
}

async function leaveTeam(teamId: number, userId: number): Promise<void> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT role FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
    [teamId, userId]
  );
  if (rows.length === 0) {
    throw new TeamServiceError('MEMBER_NOT_FOUND', 'No formas parte de este equipo.', 404);
  }
  if (rows[0].role === 'owner') {
    throw new TeamServiceError(
      'OWNER_CANNOT_LEAVE',
      'Como propietario, cancela la suscripción del equipo si deseas darlo de baja.',
      403
    );
  }

  await removeTeamMember(teamId, userId, userId);
}

async function searchTeamMembers(teamId: number, query: string): Promise<Array<{
  avatar_url: string | null;
  email: string;
  role: TeamMemberRole;
  user_id: number;
  username: string;
}>> {
  const pool = getDbPool();
  const term = `%${(query || '').trim().toLowerCase()}%`;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id AS user_id, u.username, u.email, u.avatar_url, tm.role
     FROM team_members tm
     INNER JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ? AND tm.status = 'active'
       AND (? = '%%' OR LOWER(u.username) LIKE ? OR LOWER(u.email) LIKE ?)
     ORDER BY u.username ASC
     LIMIT 25`,
    [teamId, term, term, term]
  );
  return rows.map((r) => ({
    avatar_url: r.avatar_url || null,
    email: String(r.email),
    role: r.role as TeamMemberRole,
    user_id: Number(r.user_id),
    username: String(r.username),
  }));
}

async function getTeamByStripeSubscriptionId(stripeSubscriptionId: string): Promise<TeamRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.*, (
       SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND tm.status = 'active'
     ) AS seats_used
     FROM teams t WHERE t.stripe_subscription_id = ? LIMIT 1`,
    [stripeSubscriptionId]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as TeamRecord;
  return {
    ...row,
    ai_tokens_balance: Number(row.ai_tokens_balance || 0),
    seat_limit: Number(row.seat_limit || 1),
    seats_used: Number(row.seats_used || 1),
    storage_limit_bytes: Number(row.storage_limit_bytes || TEAM_STORAGE_LIMIT_BYTES),
    storage_used_bytes: Number(row.storage_used_bytes || 0),
  };
}

async function updateTeamSubscriptionState(
  teamId: number,
  updates: {
    billingPeriod?: string | null;
    seatLimit?: number;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionPeriodEnd?: Date | null;
    subscriptionStatus?: string;
  }
): Promise<void> {
  const pool = getDbPool();
  const fields: string[] = [];
  const params: any[] = [];

  if (updates.subscriptionStatus !== undefined) {
    fields.push('subscription_status = ?');
    params.push(updates.subscriptionStatus);
  }
  if (updates.stripeCustomerId !== undefined) {
    fields.push('stripe_customer_id = ?');
    params.push(updates.stripeCustomerId);
  }
  if (updates.stripeSubscriptionId !== undefined) {
    fields.push('stripe_subscription_id = ?');
    params.push(updates.stripeSubscriptionId);
  }
  if (updates.billingPeriod !== undefined) {
    fields.push('billing_period = ?');
    params.push(updates.billingPeriod);
  }
  if (updates.subscriptionPeriodEnd !== undefined) {
    fields.push('subscription_period_end = ?');
    params.push(updates.subscriptionPeriodEnd);
  }
  if (updates.seatLimit !== undefined) {
    fields.push('seat_limit = ?');
    params.push(Math.max(1, updates.seatLimit));
  }

  if (fields.length === 0) return;

  fields.push('updated_at = NOW()');
  params.push(teamId);

  await pool.query(`UPDATE teams SET ${fields.join(', ')} WHERE id = ?`, params);
  const memberIds = await getTeamMemberUserIds(teamId);
  await cacheService.invalidateTeam(teamId, memberIds);
}

export { acceptTeamInvitation, activateTeamSubscription, createPendingOrReuseTeamForCheckout, createTeamFromPersonalBusiness, getPendingInvitationsCountForEmail, getTeamById, getTeamByStripeSubscriptionId, getTeamContextForUser, getTeamMembersAndInvitations, getTeamMemberUserIds, getTeamRolePermissions, inspectInvitationByToken, inviteMemberToTeam, leaveTeam, listPendingInvitationsForUser, listUserTeams, removeTeamMember, revokeInvitation, searchTeamMembers, TeamServiceError, updateTeamMemberRole, updateTeamProfile, updateTeamSubscriptionState };
