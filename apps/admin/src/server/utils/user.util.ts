import type { AdminUserPayload } from '../types/auth.types.js';

function sanitizeAdminUser(user: any, isSuperAdmin = false): AdminUserPayload {
  return {
    avatar_url: user.avatar_url ?? null,
    created_at: user.created_at ? new Date(user.created_at).toISOString() : undefined,
    email: user.email,
    has_password: Boolean(user.password_hash || user.has_password),
    id: Number(user.id),
    is_super_admin: Boolean(isSuperAdmin),
    status: user.status || 'active',
    two_factor_enabled: Boolean(user.two_factor_enabled),
    username: user.username,
  };
}

export {
  sanitizeAdminUser
};
