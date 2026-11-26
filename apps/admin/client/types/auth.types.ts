import type { AccessibleAdminApp } from './admin.types.js';

interface AdminSessionAccount {
  avatar_url?: string | null;
  email: string;
  id: number;
  is_super_admin?: boolean;
  last_accessed: number;
  subscription_tier?: string;
  username: string;
}

interface AdminUserPayload {
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  has_password?: boolean;
  id: number;
  is_super_admin?: boolean;
  status: string;
  subscription_tier?: string;
  two_factor_enabled?: boolean;
  username: string;
}

interface AuthStateResponse {
  accessibleApps?: AccessibleAdminApp[];
  accounts?: AdminSessionAccount[];
  error?: string;
  message?: string;
  ok?: boolean;
  user: AdminUserPayload | null;
}

export type {
  AdminSessionAccount,
  AdminUserPayload,
  AuthStateResponse
};
