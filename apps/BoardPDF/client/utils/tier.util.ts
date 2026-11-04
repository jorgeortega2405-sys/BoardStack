import { SubscriptionTierId } from '../types/subscription.types.js';

const FALLBACK_TIER_COLORS: Record<string, string> = {
  business: '#10b981',
  edu_individual: '#6366f1',
  edu_school: '#10b981',
  edu_university: '#ef4444',
  empresas: '#ef4444',
  enterprise: '#ef4444',
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
  if (clean === 'edu_individual' || clean === 'educacion_individual') return 'edu_individual';
  if (clean === 'edu_school' || clean === 'escuelas') return 'edu_school';
  if (clean === 'edu_university' || clean === 'universidades') return 'edu_university';
  if (clean === 'empresas' || clean === 'enterprise') return 'enterprise';
  if (clean === 'pro') return 'pro';
  return 'free';
}

export function getTierWeight(tier?: string | null): number {
  const norm = normalizeTier(tier);
  switch (norm) {
    case 'enterprise':
    case 'edu_university':
      return 3;
    case 'business':
    case 'edu_school':
      return 2;
    case 'pro':
    case 'edu_individual':
      return 1;
    default:
      return 0;
  }
}

export function getTierDisplayName(tier?: string | null): string {
  const norm = normalizeTier(tier);
  switch (norm) {
    case 'enterprise':
      return 'Empresas';
    case 'edu_university':
      return 'Universidades';
    case 'business':
      return 'Negocios';
    case 'edu_school':
      return 'Escuelas y Colegios';
    case 'pro':
      return 'Pro';
    case 'edu_individual':
      return 'Docentes y Estudiantes';
    default:
      return 'Gratuito';
  }
}
