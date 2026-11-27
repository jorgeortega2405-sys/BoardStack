type RoleCategory = 'data' | 'engineering' | 'finance' | 'general' | 'platform' | 'support';

type PlatformRoleSlug =
  | 'BILLING_AGENT'
  | 'CUSTOMER_SUCCESS'
  | 'DATA_ANALYST'
  | 'DEVOPS'
  | 'FINANCE_ADMIN'
  | 'IAM_ADMIN'
  | 'PLATFORM_ADMIN'
  | 'PRIVACY_ADMIN'
  | 'READ_ONLY_ADMIN'
  | 'REFUNDS_ADMIN'
  | 'SECURITY_ADMIN'
  | 'SUPER_ADMIN'
  | 'SUPPORT_L1'
  | 'SUPPORT_L2'
  | 'USER';

interface PlatformRoleDefinition {
  category: RoleCategory;
  description: string;
  isDefault: boolean;
  isGlobal: boolean;
  level: number;
  name: string;
  slug: PlatformRoleSlug;
}

const PLATFORM_ROLES_CATALOG: readonly PlatformRoleDefinition[] = [
  {
    category: 'platform',
    description: 'Exceptional access across the entire platform.',
    isDefault: false,
    isGlobal: true,
    level: 100,
    name: 'Super Admin',
    slug: 'SUPER_ADMIN',
  },
  {
    category: 'platform',
    description: 'General platform administration.',
    isDefault: false,
    isGlobal: false,
    level: 90,
    name: 'Platform Admin',
    slug: 'PLATFORM_ADMIN',
  },
  {
    category: 'platform',
    description: 'IAM, MFA, SSO, sessions, and security policies.',
    isDefault: false,
    isGlobal: false,
    level: 85,
    name: 'Security Admin',
    slug: 'SECURITY_ADMIN',
  },
  {
    category: 'platform',
    description: 'Users, groups, roles, permissions, and provisioning.',
    isDefault: false,
    isGlobal: false,
    level: 80,
    name: 'IAM Admin',
    slug: 'IAM_ADMIN',
  },
  {
    category: 'engineering',
    description: 'Infrastructure, deployments, and services.',
    isDefault: false,
    isGlobal: false,
    level: 75,
    name: 'DevOps',
    slug: 'DEVOPS',
  },
  {
    category: 'data',
    description: 'Privacy, data requests, and compliance policies.',
    isDefault: false,
    isGlobal: false,
    level: 70,
    name: 'Privacy Admin',
    slug: 'PRIVACY_ADMIN',
  },
  {
    category: 'finance',
    description: 'Financial configuration and oversight.',
    isDefault: false,
    isGlobal: false,
    level: 70,
    name: 'Finance Admin',
    slug: 'FINANCE_ADMIN',
  },
  {
    category: 'finance',
    description: 'Refunds and credits with specific permissions.',
    isDefault: false,
    isGlobal: false,
    level: 55,
    name: 'Refunds Admin',
    slug: 'REFUNDS_ADMIN',
  },
  {
    category: 'platform',
    description: 'Read-only administration and diagnostics.',
    isDefault: false,
    isGlobal: false,
    level: 50,
    name: 'Read-Only Admin',
    slug: 'READ_ONLY_ADMIN',
  },
  {
    category: 'support',
    description: 'Advanced technical support.',
    isDefault: false,
    isGlobal: false,
    level: 45,
    name: 'Support L2',
    slug: 'SUPPORT_L2',
  },
  {
    category: 'support',
    description: 'Customer management, accounts, and adoption.',
    isDefault: false,
    isGlobal: false,
    level: 40,
    name: 'Customer Success',
    slug: 'CUSTOMER_SUCCESS',
  },
  {
    category: 'finance',
    description: 'Billing inquiries and operations.',
    isDefault: false,
    isGlobal: false,
    level: 40,
    name: 'Billing Agent',
    slug: 'BILLING_AGENT',
  },
  {
    category: 'data',
    description: 'Analytics and reporting.',
    isDefault: false,
    isGlobal: false,
    level: 35,
    name: 'Data Analyst',
    slug: 'DATA_ANALYST',
  },
  {
    category: 'support',
    description: 'Basic support and common issue resolution.',
    isDefault: false,
    isGlobal: false,
    level: 30,
    name: 'Support L1',
    slug: 'SUPPORT_L1',
  },
  {
    category: 'general',
    description: 'Standard platform user.',
    isDefault: true,
    isGlobal: false,
    level: 10,
    name: 'User',
    slug: 'USER',
  },
];

const SUPER_ADMIN_ROLE: PlatformRoleDefinition = PLATFORM_ROLES_CATALOG[0];
const DEFAULT_USER_ROLE: PlatformRoleDefinition = PLATFORM_ROLES_CATALOG[PLATFORM_ROLES_CATALOG.length - 1];

const ROLE_ORDER: readonly PlatformRoleSlug[] = [...PLATFORM_ROLES_CATALOG]
  .sort((a, b) => a.level - b.level || a.slug.localeCompare(b.slug))
  .map((role) => role.slug);

function getPlatformRoleBySlug(slug: string): PlatformRoleDefinition | undefined {
  const normalized = String(slug || '').trim().toUpperCase();
  return PLATFORM_ROLES_CATALOG.find((role) => role.slug === normalized);
}

export {
  DEFAULT_USER_ROLE,
  PLATFORM_ROLES_CATALOG,
  ROLE_ORDER,
  SUPER_ADMIN_ROLE,
  getPlatformRoleBySlug
};

export type {
  PlatformRoleDefinition,
  PlatformRoleSlug,
  RoleCategory
};
