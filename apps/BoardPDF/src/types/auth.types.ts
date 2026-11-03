export interface UserPayload {
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  id: number;
  last_accessed?: number;
  permissions?: string[];
  role?: string;
  roles?: string[];
  storage_limit_bytes?: number;
  storage_used_bytes?: number;
  subscription_status?: string;
  subscription_tier?: string;
  two_factor_enabled?: boolean;
  username: string;
}

export interface SessionAccount {
  avatar_url?: string | null;
  email: string;
  id: number;
  last_accessed?: number;
  permissions?: string[];
  role?: string;
  roles?: string[];
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
