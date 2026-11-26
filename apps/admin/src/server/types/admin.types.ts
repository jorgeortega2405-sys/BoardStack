interface AdminPageSummary {
  icon: string;
  requiredPermission: string;
  slug: string;
  sortOrder: number;
  titleKey: string;
}

interface AccessibleAdminApp {
  baseUrl: string | null;
  description: string | null;
  icon: string;
  id: number;
  name: string;
  pages: AdminPageSummary[];
  permissions: string[];
  roleName: string;
  roleSlug: string;
  slug: string;
}

interface UserAdminAccess {
  accessibleApps: AccessibleAdminApp[];
  hasAccess: boolean;
  isSuperAdmin: boolean;
}

interface AdminDashboardSummary {
  activeSubscriptions: number;
  activeUsers: number;
  cloudRooms: number;
  currency: string;
  newUsersLast30d: number;
  persistentRooms: number;
  purchasesCount: number;
  totalDownloads: number;
  totalFiles: number;
  totalOrganizations: number;
  totalRevenue: number;
  totalRooms: number;
  totalStorageBytes: number;
  totalUsers: number;
}

interface AdminActivityPoint {
  date: string;
  files: number;
  rooms: number;
  users: number;
}

interface AdminRevenuePoint {
  amount: number;
  count: number;
  date: string;
}

interface AdminDistributionItem {
  count: number;
  key: string;
}

interface AppDashboardStats {
  activitySeries: AdminActivityPoint[];
  planDistribution: AdminDistributionItem[];
  revenueSeries: AdminRevenuePoint[];
  roleDistribution: AdminDistributionItem[];
  summary: AdminDashboardSummary;
}

interface AppAdminUserItem {
  appStatus: string;
  avatarUrl: string | null;
  createdAt: string;
  email: string;
  filesCount: number;
  hasGoogle: boolean;
  id: number;
  joinedAt: string;
  lastLoginAt: string | null;
  roleName: string;
  roleSlug: string;
  roomsCount: number;
  status: string;
  storageLimitBytes: number;
  storageUsedBytes: number;
  subscriptionStatus: string;
  subscriptionTier: string;
  twoFactorEnabled: boolean;
  username: string;
  uuid: string | null;
}

export type {
  AccessibleAdminApp,
  AdminActivityPoint,
  AdminDashboardSummary,
  AdminDistributionItem,
  AdminPageSummary,
  AdminRevenuePoint,
  AppAdminUserItem,
  AppDashboardStats,
  UserAdminAccess
};
