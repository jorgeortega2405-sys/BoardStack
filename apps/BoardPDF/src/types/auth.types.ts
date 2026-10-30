export interface UserPayload {
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  id: number;
  last_accessed?: number;
  role?: string;
  roles?: string[];
  subscription_tier?: string;
  username: string;
}

export interface SessionAccount {
  avatar_url?: string | null;
  email: string;
  id: number;
  last_accessed?: number;
  role?: string;
  roles?: string[];
  sessionId?: string;
  subscription_tier?: string;
  username: string;
}

export interface MultiAccountSessionPayload {
  accounts: SessionAccount[];
  activeId: number;
  exp?: number;
  iat?: number;
  sessionId?: string;
}
