export interface UserPayload {
  ai_tokens_balance?: number;
  ai_tokens_reset_at?: string;
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  google_connected?: boolean;
  google_email?: string | null;
  has_password?: boolean;
  id: number;
  is_sso?: boolean;
  last_accessed?: number;
  permissions?: string[];
  storage_limit_bytes?: number;
  storage_used_bytes?: number;
  subscription_status?: string;
  subscription_tier?: string;
  two_factor_enabled?: boolean;
  username: string;
}

export interface SessionAccount {
  ai_tokens_balance?: number;
  ai_tokens_reset_at?: string;
  avatar_url?: string | null;
  email: string;
  google_connected?: boolean;
  google_email?: string | null;
  has_password?: boolean;
  id: number;
  is_sso?: boolean;
  last_accessed?: number;
  permissions?: string[];
  sessionId?: string;
  storage_limit_bytes?: number;
  storage_used_bytes?: number;
  subscription_status?: string;
  subscription_tier?: string;
  two_factor_enabled?: boolean;
  username: string;
}

export interface MultiAccountSessionPayload {
  accounts: SessionAccount[];
  activeId: number;
  exp?: number;
  iat?: number;
  sessionId?: string;
}
