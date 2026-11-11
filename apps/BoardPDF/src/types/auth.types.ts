import { TeamSummary } from './team.types.js';

interface UserPayload {
  active_team_id?: number | null;
  ai_tokens_balance?: number;
  ai_tokens_reset_at?: string;
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  google_connected?: boolean;
  google_email?: string | null;
  has_password?: boolean;
  id: number;
  last_accessed?: number;
  pending_invitations_count?: number;
  permissions?: string[];
  storage_limit_bytes?: number;
  storage_used_bytes?: number;
  subscription_status?: string;
  subscription_tier?: string;
  teams?: TeamSummary[];
  two_factor_enabled?: boolean;
  username: string;
}

interface SessionAccount {
  ai_tokens_balance?: number;
  ai_tokens_reset_at?: string;
  avatar_url?: string | null;
  email: string;
  google_connected?: boolean;
  google_email?: string | null;
  has_password?: boolean;
  id: number;
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

interface MultiAccountSessionPayload {
  accounts: SessionAccount[];
  activeId: number;
  exp?: number;
  iat?: number;
  sessionId?: string;
}

export type { MultiAccountSessionPayload, SessionAccount, UserPayload };
