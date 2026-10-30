export interface User {
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  id: number | string;
  language?: string;
  role?: string;
  roles?: string[];
  subscription_tier?: string;
  username: string;
}

export interface AuthSessionResponse {
  accounts?: User[];
  message?: string;
  success: boolean;
  user: User | null;
}
