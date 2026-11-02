export interface User {
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  id: number | string;
  language?: string;
  role?: string;
  roles?: string[];
  storage_limit_bytes?: number;
  storage_used_bytes?: number;
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
