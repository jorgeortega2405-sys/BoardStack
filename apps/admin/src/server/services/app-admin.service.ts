import type {
  AdminActivityPoint,
  AdminDistributionItem,
  AdminRevenuePoint,
  AppAdminUserItem,
  AppDashboardStats,
} from '../types/admin.types.js';
import { appPool, corePool } from '../config/database.config.js';
import type { RowDataPacket } from 'mysql2';

interface UserTotalsRow extends RowDataPacket {
  active_users: number;
  new_users_30d: number;
  total_users: number;
}

interface DailyCountRow extends RowDataPacket {
  cnt: number;
  day: string;
}

interface DailyRevenueRow extends RowDataPacket {
  amount: number | string;
  cnt: number;
  day: string;
}

interface RoomsSummaryRow extends RowDataPacket {
  cloud_rooms: number;
  persistent_rooms: number;
  total_rooms: number;
}

interface FilesSummaryRow extends RowDataPacket {
  total_bytes: number | string;
  total_downloads: number | string;
  total_files: number;
}

interface PurchasesSummaryRow extends RowDataPacket {
  currency: string;
  purchases_count: number;
  total_revenue: number | string;
}

interface CountRow extends RowDataPacket {
  cnt: number;
}

interface TierCountRow extends RowDataPacket {
  cnt: number;
  tier: string;
}

interface UserRoleAssignmentRow extends RowDataPacket {
  level: number;
  role_name: string;
  role_slug: string;
  user_id: number;
}

interface CoreAppUserRow extends RowDataPacket {
  app_status: string;
  avatar_url: string | null;
  created_at: string;
  email: string;
  google_id: string | null;
  id: number;
  joined_at: string;
  last_login_at: string | null;
  status: string;
  two_factor_enabled: number | boolean;
  username: string;
  uuid: string | null;
}

interface AppUserProfileRow extends RowDataPacket {
  storage_limit_bytes: number | string;
  storage_used_bytes: number | string;
  subscription_status: string;
  subscription_tier: string;
  user_id: number;
}

interface UserResourceCountRow extends RowDataPacket {
  cnt: number;
  user_id: number;
}

interface ResolvedUserRole {
  level: number;
  roleName: string;
  roleSlug: string;
}

const DEFAULT_STORAGE_LIMIT_BYTES = 5368709120;
const ROLE_ORDER = ['user', 'moderator', 'administrator', 'superadministrator'];
const PLAN_ORDER = ['free', 'pro', 'enterprise'];

function buildLastDays(daysCount: number): string[] {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days: string[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const dt = new Date(todayUtc - i * 86400000);
    days.push(dt.toISOString().slice(0, 10));
  }
  return days;
}

async function resolveEffectiveRolesForApp(appId: number): Promise<Map<number, ResolvedUserRole>> {
  const [[globalRoleRows], [appRoleRows]] = await Promise.all([
    corePool.execute<UserRoleAssignmentRow[]>(
      `SELECT ugr.user_id, r.slug AS role_slug, r.name AS role_name, r.level
       FROM user_global_roles ugr
       INNER JOIN roles r ON r.id = ugr.role_id`
    ),
    corePool.execute<UserRoleAssignmentRow[]>(
      `SELECT uar.user_id, r.slug AS role_slug, r.name AS role_name, r.level
       FROM user_app_roles uar
       INNER JOIN roles r ON r.id = uar.role_id
       WHERE uar.app_id = ?`,
      [appId]
    ),
  ]);

  const roleMap = new Map<number, ResolvedUserRole>();
  const applyRows = (rows: UserRoleAssignmentRow[]) => {
    for (const row of rows) {
      const uid = Number(row.user_id);
      const level = Number(row.level);
      const existing = roleMap.get(uid);
      if (!existing || level > existing.level) {
        roleMap.set(uid, {
          level,
          roleName: String(row.role_name),
          roleSlug: String(row.role_slug).toLowerCase(),
        });
      }
    }
  };

  applyRows(appRoleRows);
  applyRows(globalRoleRows);
  return roleMap;
}

async function getAppDashboardStats(appId: number): Promise<AppDashboardStats> {
  const last7Days = buildLastDays(7);
  const startDay = `${last7Days[0]} 00:00:00`;

  const [
    [userTotalsRows],
    [appUsersIdRows],
    [dailyUsersRows],
    effectiveRolesMap,
    [roomsSummaryRows],
    [filesSummaryRows],
    [purchasesSummaryRows],
    [subscriptionsCountRows],
    [orgsCountRows],
    [dailyRoomsRows],
    [dailyFilesRows],
    [dailyRevenueRows],
    [planRows],
  ] = await Promise.all([
    corePool.execute<UserTotalsRow[]>(
      `SELECT
         COUNT(*) AS total_users,
         SUM(CASE WHEN u.status = 'active' AND ua.status = 'active' THEN 1 ELSE 0 END) AS active_users,
         SUM(CASE WHEN ua.joined_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS new_users_30d
       FROM user_apps ua
       INNER JOIN users u ON u.id = ua.user_id
       WHERE ua.app_id = ?`,
      [appId]
    ),
    corePool.execute<RowDataPacket[]>(
      'SELECT user_id FROM user_apps WHERE app_id = ?',
      [appId]
    ),
    corePool.execute<DailyCountRow[]>(
      `SELECT DATE_FORMAT(ua.joined_at, '%Y-%m-%d') AS day, COUNT(*) AS cnt
       FROM user_apps ua
       WHERE ua.app_id = ? AND ua.joined_at >= ?
       GROUP BY day`,
      [appId, startDay]
    ),
    resolveEffectiveRolesForApp(appId),
    appPool.execute<RoomsSummaryRow[]>(
      `SELECT
         COUNT(*) AS total_rooms,
         SUM(CASE WHEN is_persistent = 1 THEN 1 ELSE 0 END) AS persistent_rooms,
         SUM(CASE WHEN save_to_cloud = 1 THEN 1 ELSE 0 END) AS cloud_rooms
       FROM rooms`
    ),
    appPool.execute<FilesSummaryRow[]>(
      `SELECT
         COUNT(*) AS total_files,
         COALESCE(SUM(size), 0) AS total_bytes,
         COALESCE(SUM(download_count), 0) AS total_downloads
       FROM room_files`
    ),
    appPool.execute<PurchasesSummaryRow[]>(
      `SELECT
         COUNT(*) AS purchases_count,
         COALESCE(SUM(amount_total), 0) AS total_revenue,
         COALESCE(MAX(currency), 'USD') AS currency
       FROM purchases
       WHERE status = 'completed'`
    ),
    appPool.execute<CountRow[]>(
      "SELECT COUNT(*) AS cnt FROM subscriptions WHERE status = 'active'"
    ),
    appPool.execute<CountRow[]>(
      'SELECT COUNT(*) AS cnt FROM organizations'
    ),
    appPool.execute<DailyCountRow[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS cnt
       FROM rooms
       WHERE created_at >= ?
       GROUP BY day`,
      [startDay]
    ),
    appPool.execute<DailyCountRow[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS cnt
       FROM room_files
       WHERE created_at >= ?
       GROUP BY day`,
      [startDay]
    ),
    appPool.execute<DailyRevenueRow[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS cnt, COALESCE(SUM(amount_total), 0) AS amount
       FROM purchases
       WHERE status = 'completed' AND created_at >= ?
       GROUP BY day`,
      [startDay]
    ),
    appPool.execute<TierCountRow[]>(
      `SELECT LOWER(COALESCE(subscription_tier, 'free')) AS tier, COUNT(*) AS cnt
       FROM app_user_profiles
       GROUP BY tier`
    ),
  ]);

  const usersByDay = new Map<string, number>();
  for (const row of dailyUsersRows) {
    usersByDay.set(String(row.day), Number(row.cnt || 0));
  }

  const roomsByDay = new Map<string, number>();
  for (const row of dailyRoomsRows) {
    roomsByDay.set(String(row.day), Number(row.cnt || 0));
  }

  const filesByDay = new Map<string, number>();
  for (const row of dailyFilesRows) {
    filesByDay.set(String(row.day), Number(row.cnt || 0));
  }

  const revenueByDay = new Map<string, { amount: number; count: number }>();
  for (const row of dailyRevenueRows) {
    revenueByDay.set(String(row.day), {
      amount: Number(row.amount || 0),
      count: Number(row.cnt || 0),
    });
  }

  const activitySeries: AdminActivityPoint[] = last7Days.map((date) => ({
    date,
    files: filesByDay.get(date) || 0,
    rooms: roomsByDay.get(date) || 0,
    users: usersByDay.get(date) || 0,
  }));

  const revenueSeries: AdminRevenuePoint[] = last7Days.map((date) => {
    const rev = revenueByDay.get(date);
    return {
      amount: rev ? rev.amount : 0,
      count: rev ? rev.count : 0,
      date,
    };
  });

  const roleCounts = new Map<string, number>();
  for (const roleSlug of ROLE_ORDER) {
    roleCounts.set(roleSlug, 0);
  }
  for (const row of appUsersIdRows) {
    const role = effectiveRolesMap.get(Number(row.user_id));
    const slug = role ? role.roleSlug : 'user';
    roleCounts.set(slug, (roleCounts.get(slug) || 0) + 1);
  }
  const roleDistribution: AdminDistributionItem[] = Array.from(roleCounts.entries()).map(([key, count]) => ({
    count,
    key,
  }));

  const planCounts = new Map<string, number>();
  for (const tier of PLAN_ORDER) {
    planCounts.set(tier, 0);
  }
  for (const row of planRows) {
    const key = String(row.tier || 'free').toLowerCase();
    planCounts.set(key, Number(row.cnt || 0));
  }
  const planDistribution: AdminDistributionItem[] = Array.from(planCounts.entries()).map(([key, count]) => ({
    count,
    key,
  }));

  const uTotals = userTotalsRows[0];
  const rTotals = roomsSummaryRows[0];
  const fTotals = filesSummaryRows[0];
  const pTotals = purchasesSummaryRows[0];

  return {
    activitySeries,
    planDistribution,
    revenueSeries,
    roleDistribution,
    summary: {
      activeSubscriptions: Number(subscriptionsCountRows[0]?.cnt || 0),
      activeUsers: Number(uTotals?.active_users || 0),
      cloudRooms: Number(rTotals?.cloud_rooms || 0),
      currency: String(pTotals?.currency || 'USD').toUpperCase(),
      newUsersLast30d: Number(uTotals?.new_users_30d || 0),
      persistentRooms: Number(rTotals?.persistent_rooms || 0),
      purchasesCount: Number(pTotals?.purchases_count || 0),
      totalDownloads: Number(fTotals?.total_downloads || 0),
      totalFiles: Number(fTotals?.total_files || 0),
      totalOrganizations: Number(orgsCountRows[0]?.cnt || 0),
      totalRevenue: Number(pTotals?.total_revenue || 0),
      totalRooms: Number(rTotals?.total_rooms || 0),
      totalStorageBytes: Number(fTotals?.total_bytes || 0),
      totalUsers: Number(uTotals?.total_users || 0),
    },
  };
}

async function getAppUsersList(appId: number): Promise<AppAdminUserItem[]> {
  const [
    [coreUsersRows],
    effectiveRolesMap,
    [profileRows],
    [roomsCountRows],
    [filesCountRows],
  ] = await Promise.all([
    corePool.execute<CoreAppUserRow[]>(
      `SELECT u.id, u.uuid, u.username, u.email, u.google_id, u.avatar_url,
              u.status, u.two_factor_enabled, u.last_login_at, u.created_at,
              ua.status AS app_status, ua.joined_at
       FROM user_apps ua
       INNER JOIN users u ON u.id = ua.user_id
       WHERE ua.app_id = ?
       ORDER BY u.created_at DESC, u.id DESC`,
      [appId]
    ),
    resolveEffectiveRolesForApp(appId),
    appPool.execute<AppUserProfileRow[]>(
      `SELECT user_id, subscription_tier, subscription_status, storage_used_bytes, storage_limit_bytes
       FROM app_user_profiles`
    ),
    appPool.execute<UserResourceCountRow[]>(
      'SELECT owner_id AS user_id, COUNT(*) AS cnt FROM rooms WHERE owner_id IS NOT NULL GROUP BY owner_id'
    ),
    appPool.execute<UserResourceCountRow[]>(
      `SELECT COALESCE(rf.user_id, r.owner_id) AS user_id, COUNT(*) AS cnt
       FROM room_files rf
       LEFT JOIN rooms r ON r.room_id = rf.room_id
       WHERE COALESCE(rf.user_id, r.owner_id) IS NOT NULL
       GROUP BY COALESCE(rf.user_id, r.owner_id)`
    ),
  ]);

  const profileMap = new Map<number, AppUserProfileRow>();
  for (const row of profileRows) {
    profileMap.set(Number(row.user_id), row);
  }

  const roomsMap = new Map<number, number>();
  for (const row of roomsCountRows) {
    roomsMap.set(Number(row.user_id), Number(row.cnt || 0));
  }

  const filesMap = new Map<number, number>();
  for (const row of filesCountRows) {
    filesMap.set(Number(row.user_id), Number(row.cnt || 0));
  }

  return coreUsersRows.map((row) => {
    const uid = Number(row.id);
    const role = effectiveRolesMap.get(uid);
    const profile = profileMap.get(uid);

    return {
      appStatus: String(row.app_status || 'active'),
      avatarUrl: row.avatar_url || null,
      createdAt: String(row.created_at),
      email: String(row.email),
      filesCount: filesMap.get(uid) || 0,
      hasGoogle: Boolean(row.google_id),
      id: uid,
      joinedAt: String(row.joined_at || row.created_at),
      lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
      roleName: role ? role.roleName : 'User',
      roleSlug: role ? role.roleSlug : 'user',
      roomsCount: roomsMap.get(uid) || 0,
      status: String(row.status || 'active'),
      storageLimitBytes: profile ? Number(profile.storage_limit_bytes || DEFAULT_STORAGE_LIMIT_BYTES) : DEFAULT_STORAGE_LIMIT_BYTES,
      storageUsedBytes: profile ? Number(profile.storage_used_bytes || 0) : 0,
      subscriptionStatus: profile ? String(profile.subscription_status || 'inactive').toLowerCase() : 'inactive',
      subscriptionTier: profile ? String(profile.subscription_tier || 'free').toLowerCase() : 'free',
      twoFactorEnabled: Boolean(row.two_factor_enabled),
      username: String(row.username),
      uuid: row.uuid || null,
    };
  });
}

export {
  getAppDashboardStats,
  getAppUsersList
};
