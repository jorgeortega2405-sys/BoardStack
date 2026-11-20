interface UserPayload {
  ai_tokens_balance?: number;
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  google_connected?: boolean;
  google_email?: string | null;
  has_password?: boolean;
  id: number;
  permissions?: string[];
  roles?: string[];
  storage_limit_bytes?: number;
  storage_used_bytes?: number;
  subscription_status?: string;
  subscription_tier?: string;
  two_factor_enabled?: boolean;
  username: string;
}

interface SessionAccount {
  avatar_url?: string | null;
  email: string;
  google_connected?: boolean;
  google_email?: string | null;
  has_password?: boolean;
  id: number;
  last_accessed: number;
  permissions?: string[];
  roles?: string[];
  storage_limit_bytes?: number;
  storage_used_bytes?: number;
  subscription_tier?: string;
  username: string;
}

interface MultiAccountSessionPayload {
  accounts: SessionAccount[];
  activeId: number;
  exp?: number;
  iat?: number;
}

export type {
  MultiAccountSessionPayload,
  SessionAccount,
  UserPayload
};
