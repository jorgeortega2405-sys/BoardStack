import { STORAGE_TIER_LIMITS } from '../config/subscription-plans.config.js';
import type { UserPayload } from '../types/auth.types.js';

function sanitizeUser(user: any): UserPayload {
  return {
    ai_tokens_balance: user.ai_tokens_balance !== undefined ? Number(user.ai_tokens_balance) : 100,
    avatar_url: user.avatar_url ?? null,
    created_at: user.created_at ? new Date(user.created_at).toISOString() : undefined,
    email: user.email,
    google_connected: Boolean(user.google_id || user.google_connected),
    google_email: user.google_email || null,
    has_password: Boolean(user.password_hash || user.has_password),
    id: user.id,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    roles: Array.isArray(user.roles) ? user.roles : [],
    storage_limit_bytes: Number(user.storage_limit_bytes) || STORAGE_TIER_LIMITS.free,
    storage_used_bytes: Number(user.storage_used_bytes) || 0,
    subscription_status: user.subscription_status || 'inactive',
    subscription_tier: user.subscription_tier || 'free',
    two_factor_enabled: Boolean(user.two_factor_enabled),
    username: user.username,
  };
}

export {
  sanitizeUser
};
