type TeamMemberRole = 'admin' | 'member' | 'owner';
type TeamInvitationStatus = 'accepted' | 'expired' | 'pending' | 'revoked';

interface TeamRecord {
  ai_tokens_balance: number;
  ai_tokens_reset_at: Date | string | null;
  avatar_url: string | null;
  billing_period: string | null;
  created_at: Date | string;
  id: number;
  name: string;
  owner_id: number;
  seat_limit: number;
  seats_used?: number;
  slug: string;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_period_end: Date | string | null;
  subscription_status: string;
  subscription_tier: string;
  updated_at: Date | string;
  uuid: string;
}

interface TeamSummary {
  ai_tokens_balance: number;
  ai_tokens_reset_at?: string | null;
  avatar_url: string | null;
  billing_period: string | null;
  id: number;
  name: string;
  owner_id: number;
  permissions: string[];
  role: TeamMemberRole;
  seat_limit: number;
  seats_used: number;
  slug: string;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  subscription_period_end?: string | null;
  subscription_status: string;
  subscription_tier: string;
  uuid: string;
}

interface TeamMemberRecord {
  avatar_url: string | null;
  email: string;
  id: number;
  invited_by: number | null;
  joined_at: string;
  role: TeamMemberRole;
  status: 'active' | 'suspended';
  team_id: number;
  user_id: number;
  username: string;
}

interface TeamInvitationRecord {
  created_at: string;
  email: string;
  expires_at: string;
  id: number;
  invited_by: number;
  invited_by_name?: string;
  role: 'admin' | 'member';
  status: TeamInvitationStatus;
  team_id: number;
  token: string;
}

interface TeamSeatPreview {
  amountDueNow: number;
  billingPeriod: string;
  currency: string;
  currentSeats: number;
  isOneTime: boolean;
  newSeats: number;
  nextCycleAmount: number;
  pricePerSeat: number;
}

export type { TeamInvitationRecord, TeamInvitationStatus, TeamMemberRecord, TeamMemberRole, TeamRecord, TeamSeatPreview, TeamSummary };
