import type { AdminSessionAccount, AdminUserPayload } from '../types/auth.types.js';

type SubscriptionTier = 'business' | 'enterprise' | 'free' | 'pro';

function normalizeSubscriptionTier(tier?: string | null): SubscriptionTier {
  const normalized = String(tier || '').trim().toLowerCase();
  if (normalized === 'enterprise' || normalized === 'business' || normalized === 'pro') {
    return normalized;
  }
  return 'free';
}

function sanitizeAdminUser(user: any, isSuperAdmin = false): AdminUserPayload {
  return {
    avatar_url: user.avatar_url ?? null,
    created_at: user.created_at ? new Date(user.created_at).toISOString() : undefined,
    email: user.email,
    has_password: Boolean(user.password_hash || user.has_password),
    id: Number(user.id),
    is_super_admin: Boolean(isSuperAdmin),
    status: user.status || 'active',
    subscription_tier: normalizeSubscriptionTier(user.subscription_tier),
    two_factor_enabled: Boolean(user.two_factor_enabled),
    username: user.username,
  };
}

function sanitizeAdminSessionAccount(user: any, lastAccessed: number, isSuperAdmin = false): AdminSessionAccount {
  return {
    avatar_url: user.avatar_url ?? null,
    email: user.email,
    id: Number(user.id),
    is_super_admin: Boolean(isSuperAdmin),
    last_accessed: Number(lastAccessed) || Date.now(),
    subscription_tier: normalizeSubscriptionTier(user.subscription_tier),
    username: user.username,
  };
}

export {
  normalizeSubscriptionTier,
  sanitizeAdminSessionAccount,
  sanitizeAdminUser
};
