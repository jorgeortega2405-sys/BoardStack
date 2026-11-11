import { BillingDetailsResponse, PurchaseRecord } from './subscription.types.js';

type TeamRole = 'admin' | 'member' | 'owner';
type TeamMemberRole = TeamRole;
type TeamInvitationStatus = 'accepted' | 'expired' | 'pending' | 'revoked';

interface TeamSummary {
  ai_tokens_balance: number;
  ai_tokens_reset_at?: string | null;
  avatar_url: string | null;
  billing_period: string | null;
  id: number;
  name: string;
  owner_id: number;
  permissions: string[];
  role: TeamRole;
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
  role: TeamRole;
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
  invite_url?: string;
  role: 'admin' | 'member';
  status: TeamInvitationStatus;
  team_id: number;
  team_name?: string;
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

interface TeamListResponse {
  error?: string;
  pendingInvitations?: TeamInvitationRecord[];
  success: boolean;
  teams: TeamSummary[];
}

interface TeamDetailResponse {
  error?: string;
  invitations: TeamInvitationRecord[];
  members: TeamMemberRecord[];
  pendingCount: number;
  permissions: string[];
  role: TeamRole;
  seatLimit: number;
  seatsAvailable: number;
  seatsUsed: number;
  success: boolean;
  team: TeamSummary;
}

interface TeamInviteInspectResponse {
  error?: string;
  invitation?: {
    emailHint: string;
    expires_at: string;
    invited_by_name?: string;
    matchesCurrentUser: boolean;
    role: 'admin' | 'member';
    status: TeamInvitationStatus;
    team_id: number;
    team_name: string;
  };
  success: boolean;
}

interface TeamBillingDetailsResponse {
  billing: BillingDetailsResponse;
  error?: string;
  purchases: PurchaseRecord[];
  success: boolean;
}

interface TeamSeatPreviewResponse {
  error?: string;
  preview?: TeamSeatPreview;
  success: boolean;
}

interface TeamSeatUpdateResponse {
  amountCharged?: number;
  clientSecret?: string;
  error?: string;
  paymentIntentId?: string;
  publishableKey?: string;
  requiresPaymentAction?: boolean;
  seatLimit?: number;
  success: boolean;
}

interface ProjectFolderMemberRecord {
  avatar_url: string | null;
  email: string;
  role: 'editor' | 'viewer';
  user_id: number;
  username: string;
}

interface FolderSharingDetailsResponse {
  canManage?: boolean;
  error?: string;
  folder?: {
    id: string;
    name: string;
    team_id?: number | null;
    user_id?: number | null;
    visibility?: 'restricted' | 'team';
  };
  members?: ProjectFolderMemberRecord[];
  success: boolean;
  visibility?: 'restricted' | 'team';
}

export type { FolderSharingDetailsResponse, ProjectFolderMemberRecord, TeamBillingDetailsResponse, TeamDetailResponse, TeamInvitationRecord, TeamInvitationStatus, TeamInviteInspectResponse, TeamListResponse, TeamMemberRecord, TeamMemberRole, TeamRole, TeamSeatPreview, TeamSeatPreviewResponse, TeamSeatUpdateResponse, TeamSummary };
