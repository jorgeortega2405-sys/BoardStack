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
  defaultPermissions: readonly string[];
  description: string;
  isDefault: boolean;
  isGlobal: boolean;
  level: number;
  name: string;
  slug: PlatformRoleSlug;
}

const SUPER_ADMIN_ROLE_SLUG: PlatformRoleSlug = 'SUPER_ADMIN';
const DEFAULT_USER_ROLE_SLUG: PlatformRoleSlug = 'USER';
const ADMIN_ALIAS_ROLE_SLUGS: readonly PlatformRoleSlug[] = ['SUPER_ADMIN', 'PLATFORM_ADMIN'];

const LEGACY_ROLE_SLUG_MAP: Readonly<Record<string, PlatformRoleSlug>> = {
  administrator: 'PLATFORM_ADMIN',
  moderator: 'SUPPORT_L2',
  superadministrator: 'SUPER_ADMIN',
  user: 'USER',
};

const BASE_USER_PERMISSIONS: readonly string[] = [
  'app:access',
  'profile:view',
  'profile:edit',
  'billing:view',
  'billing:manage',
];

const PLATFORM_ROLES_CATALOG: readonly PlatformRoleDefinition[] = [
  {
    category: 'platform',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:users:view',
      'admin:users:manage',
      'admin:rooms:view',
      'admin:billing:view',
      'admin:roles:manage',
      'admin:sales:view',
      'admin:sales:manage',
      'admin:settings:view',
    ],
    description: 'Exceptional access across the entire platform.',
    isDefault: false,
    isGlobal: true,
    level: 100,
    name: 'Super Admin',
    slug: 'SUPER_ADMIN',
  },
  {
    category: 'platform',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:users:view',
      'admin:users:manage',
      'admin:rooms:view',
      'admin:billing:view',
      'admin:sales:view',
      'admin:sales:manage',
      'admin:settings:view',
    ],
    description: 'General platform administration.',
    isDefault: false,
    isGlobal: false,
    level: 90,
    name: 'Platform Admin',
    slug: 'PLATFORM_ADMIN',
  },
  {
    category: 'platform',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:users:view',
      'admin:users:manage',
      'admin:settings:view',
    ],
    description: 'IAM, MFA, SSO, sessions, and security policies.',
    isDefault: false,
    isGlobal: false,
    level: 85,
    name: 'Security Admin',
    slug: 'SECURITY_ADMIN',
  },
  {
    category: 'platform',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:users:view',
      'admin:users:manage',
      'admin:roles:manage',
      'admin:settings:view',
    ],
    description: 'Users, groups, roles, permissions, and provisioning.',
    isDefault: false,
    isGlobal: false,
    level: 80,
    name: 'IAM Admin',
    slug: 'IAM_ADMIN',
  },
  {
    category: 'engineering',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:rooms:view',
      'admin:settings:view',
    ],
    description: 'Infrastructure, deployments, and services.',
    isDefault: false,
    isGlobal: false,
    level: 75,
    name: 'DevOps',
    slug: 'DEVOPS',
  },
  {
    category: 'data',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:users:view',
      'admin:users:manage',
      'admin:settings:view',
    ],
    description: 'Privacy, data requests, and compliance policies.',
    isDefault: false,
    isGlobal: false,
    level: 70,
    name: 'Privacy Admin',
    slug: 'PRIVACY_ADMIN',
  },
  {
    category: 'finance',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:billing:view',
      'admin:sales:view',
      'admin:sales:manage',
    ],
    description: 'Financial configuration and oversight.',
    isDefault: false,
    isGlobal: false,
    level: 70,
    name: 'Finance Admin',
    slug: 'FINANCE_ADMIN',
  },
  {
    category: 'finance',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:billing:view',
    ],
    description: 'Refunds and credits with specific permissions.',
    isDefault: false,
    isGlobal: false,
    level: 55,
    name: 'Refunds Admin',
    slug: 'REFUNDS_ADMIN',
  },
  {
    category: 'platform',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:users:view',
      'admin:rooms:view',
      'admin:billing:view',
      'admin:sales:view',
      'admin:settings:view',
    ],
    description: 'Read-only administration and diagnostics.',
    isDefault: false,
    isGlobal: false,
    level: 50,
    name: 'Read-Only Admin',
    slug: 'READ_ONLY_ADMIN',
  },
  {
    category: 'support',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:users:view',
      'admin:users:manage',
      'admin:rooms:view',
      'admin:settings:view',
    ],
    description: 'Advanced technical support.',
    isDefault: false,
    isGlobal: false,
    level: 45,
    name: 'Support L2',
    slug: 'SUPPORT_L2',
  },
  {
    category: 'support',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:users:view',
      'admin:sales:view',
      'admin:sales:manage',
    ],
    description: 'Customer management, accounts, and adoption.',
    isDefault: false,
    isGlobal: false,
    level: 40,
    name: 'Customer Success',
    slug: 'CUSTOMER_SUCCESS',
  },
  {
    category: 'finance',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:billing:view',
      'admin:sales:view',
    ],
    description: 'Billing inquiries and operations.',
    isDefault: false,
    isGlobal: false,
    level: 40,
    name: 'Billing Agent',
    slug: 'BILLING_AGENT',
  },
  {
    category: 'data',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:rooms:view',
      'admin:billing:view',
      'admin:sales:view',
    ],
    description: 'Analytics and reporting.',
    isDefault: false,
    isGlobal: false,
    level: 35,
    name: 'Data Analyst',
    slug: 'DATA_ANALYST',
  },
  {
    category: 'support',
    defaultPermissions: [
      ...BASE_USER_PERMISSIONS,
      'admin:overview:view',
      'admin:users:view',
      'admin:rooms:view',
    ],
    description: 'Basic support and common issue resolution.',
    isDefault: false,
    isGlobal: false,
    level: 30,
    name: 'Support L1',
    slug: 'SUPPORT_L1',
  },
  {
    category: 'general',
    defaultPermissions: [...BASE_USER_PERMISSIONS],
    description: 'Standard platform user.',
    isDefault: true,
    isGlobal: false,
    level: 10,
    name: 'User',
    slug: 'USER',
  },
];

const PLATFORM_ROLE_SLUGS: readonly PlatformRoleSlug[] = PLATFORM_ROLES_CATALOG.map((role) => role.slug);

function getPlatformRoleDefinition(slug: string): PlatformRoleDefinition | undefined {
  const normalized = String(slug || '').trim().toUpperCase();
  return PLATFORM_ROLES_CATALOG.find((role) => role.slug === normalized);
}

function isPlatformRoleSlug(slug: string): slug is PlatformRoleSlug {
  return Boolean(getPlatformRoleDefinition(slug));
}

function isSuperAdminRole(slug: string): boolean {
  return String(slug || '').trim().toUpperCase() === SUPER_ADMIN_ROLE_SLUG;
}

function matchesRoleRequirement(userRoles: readonly string[], requiredRole: string): boolean {
  const target = String(requiredRole || '').trim().toLowerCase();
  if (!target) {
    return false;
  }

  return userRoles.some((role) => {
    const normalizedRole = String(role || '').trim().toLowerCase();
    if (normalizedRole === target) {
      return true;
    }
    if (target === 'admin') {
      return ADMIN_ALIAS_ROLE_SLUGS.some((adminSlug) => adminSlug.toLowerCase() === normalizedRole);
    }
    return false;
  });
}

export {
  ADMIN_ALIAS_ROLE_SLUGS,
  DEFAULT_USER_ROLE_SLUG,
  LEGACY_ROLE_SLUG_MAP,
  PLATFORM_ROLES_CATALOG,
  PLATFORM_ROLE_SLUGS,
  SUPER_ADMIN_ROLE_SLUG,
  getPlatformRoleDefinition,
  isPlatformRoleSlug,
  isSuperAdminRole,
  matchesRoleRequirement
};

export type {
  PlatformRoleDefinition,
  PlatformRoleSlug,
  RoleCategory
};
