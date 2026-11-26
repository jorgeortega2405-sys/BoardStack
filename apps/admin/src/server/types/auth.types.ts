import type { AccessibleAdminApp } from './admin.types.js';

interface AdminUserPayload {
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  has_password?: boolean;
  id: number;
  is_super_admin?: boolean;
  status: string;
  two_factor_enabled?: boolean;
  username: string;
}

interface AdminSessionPayload {
  exp?: number;
  iat?: number;
  userId: number;
}

interface AdminSessionState {
  accessibleApps: AccessibleAdminApp[];
  user: AdminUserPayload;
}

export type {
  AdminSessionPayload,
  AdminSessionState,
  AdminUserPayload
};
