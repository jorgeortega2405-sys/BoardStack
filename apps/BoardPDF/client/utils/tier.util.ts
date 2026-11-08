import { SubscriptionTierId } from '../types/subscription.types.js';

const FALLBACK_TIER_COLORS: Record<string, string> = {
  business: '#10b981',
  free: '#9ca3af',
  negocios: '#10b981',
  pro: '#3b82f6',
};

export function getFallbackTierColor(tier?: string): string {
  const normalized = (tier || 'free').toLowerCase();
  return FALLBACK_TIER_COLORS[normalized] || FALLBACK_TIER_COLORS.free;
}

export function applyAvatarTier(el: HTMLElement | null, tier?: string, color?: string): void {
  if (!el) return;
  const normalizedTier = (tier || 'free').toLowerCase();
  el.setAttribute('data-tier', normalizedTier);
  const tierColor = color || getFallbackTierColor(normalizedTier);
  el.style.setProperty('--avatar-tier-bg', tierColor);
}

export function normalizeTier(tier?: string | null): SubscriptionTierId {
  const clean = (tier || 'free').toLowerCase().trim();
  if (clean === 'negocios' || clean === 'business') return 'business';
  if (clean === 'pro') return 'pro';
  return 'free';
}

export function getTierWeight(tier?: string | null): number {
  const norm = normalizeTier(tier);
  switch (norm) {
    case 'business':
      return 2;
    case 'pro':
      return 1;
    default:
      return 0;
  }
}

export function getTierDisplayName(tier?: string | null): string {
  const norm = normalizeTier(tier);
  switch (norm) {
    case 'business':
      return 'Negocios';
    case 'pro':
      return 'Pro';
    default:
      return 'Gratuito';
  }
}
