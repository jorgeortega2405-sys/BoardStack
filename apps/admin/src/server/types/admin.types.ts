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

interface EnterpriseContractItem {
  createdAt: string;
  fileSizeBytes: number;
  id: number;
  leadId: number | null;
  mimeType: string;
  organizationId: number | null;
  originalFilename: string;
  title: string;
  uploadedByUserId: number;
  userId: number | null;
  uuid: string;
}

interface EnterpriseLeadMatchedUser {
  email: string;
  id: number;
  organizationDomain: string | null;
  organizationId: number | null;
  organizationName: string | null;
  organizationSlug: string | null;
  seatsLimit: number | null;
  status: string;
  storageLimitBytes: number;
  storageUsedBytes: number;
  subscriptionPeriodEnd: string | null;
  subscriptionStatus: string;
  subscriptionTier: string;
  username: string;
}

interface EnterpriseLeadItem {
  companyName: string;
  companySize: string;
  contractsCount: number;
  country: string;
  createdAt: string;
  firstName: string;
  hearAbout: string;
  id: number;
  lastName: string;
  matchedUser: EnterpriseLeadMatchedUser | null;
  notes: string | null;
  phoneNumber: string;
  roleLevel: string;
  status: 'approved' | 'contacted' | 'pending' | 'rejected';
  updatedAt: string;
  userId: number | null;
  uuid: string;
  workEmail: string;
}

interface EnterpriseLeadDetail {
  contracts: EnterpriseContractItem[];
  lead: EnterpriseLeadItem;
}

interface ProvisionEnterpriseInput {
  adminUserId: number;
  appId: number;
  billingPeriod: 'custom' | 'monthly' | 'yearly';
  contractAmount: number;
  currency: string;
  durationMonths: number;
  leadId?: number | null;
  organizationDomain?: string | null;
  organizationName: string;
  seatsLimit: number;
  storageLimitBytes: number;
  userEmail: string;
}

interface ProvisionEnterpriseResult {
  organizationId: number;
  organizationName: string;
  periodEnd: string;
  seatsLimit: number;
  storageLimitBytes: number;
  userId: number;
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
  EnterpriseContractItem,
  EnterpriseLeadDetail,
  EnterpriseLeadItem,
  EnterpriseLeadMatchedUser,
  ProvisionEnterpriseInput,
  ProvisionEnterpriseResult,
  UserAdminAccess
};
