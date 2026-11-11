interface User {
  ai_tokens_balance?: number;
  ai_tokens_reset_at?: string;
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  google_connected?: boolean;
  google_email?: string | null;
  has_password?: boolean;
  id: number | string;
  language?: string;
  permissions?: string[];
  storage_limit_bytes?: number;
  storage_used_bytes?: number;
  subscription_status?: string;
  subscription_tier?: string;
  two_factor_enabled?: boolean;
  username: string;
}

interface AuthSessionResponse {
  accounts?: User[];
  message?: string;
  success: boolean;
  user: User | null;
}

export type { AuthSessionResponse, User };
