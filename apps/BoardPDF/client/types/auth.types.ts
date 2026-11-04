export interface User {
  ai_tokens_balance?: number;
  ai_tokens_reset_at?: string;
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  id: number | string;
  is_sso?: boolean;
  language?: string;
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

export interface AuthSessionResponse {
  accounts?: User[];
  message?: string;
  success: boolean;
  user: User | null;
}
