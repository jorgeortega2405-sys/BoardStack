import { SubscriptionTier, SubscriptionTierId } from '../types/subscription.types.js';

export const PLAN_TIER_CONFIGS: Record<SubscriptionTierId, SubscriptionTier> = {
  business: {
    badge: 'Para Equipos',
    borderColor: '#10b981',
    buttonText: 'Obtener BoardPDF Negocios',
    currency: 'USD',
    id: 'business',
    name: 'BoardPDF Negocios',
    priceMonthly: 19.99,
    priceYearly: 15.99,
    ringBg: '#10b981',
    stripePriceMonthlyId: 'price_1UWf5dE4dfTcnyKKYCQ5Ue2K',
    stripePriceYearlyId: 'price_1UWf5dE4dfTcnyKKbvBdN2eP',
    tagline: 'Máxima potencia, automatización y colaboración avanzada para despachos y equipos en crecimiento.',
  },
  enterprise: {
    badge: 'Para Empresas',
    borderColor: '#ef4444',
    buttonText: 'Contactar ventas',
    currency: 'USD',
    id: 'enterprise',
    name: 'BoardPDF Empresas',
    priceMonthly: 0,
    priceYearly: 0,
    ringBg: '#ef4444',
    tagline: 'Seguridad corporativa, control de accesos e infraestructura a gran escala.',
  },
  free: {
    borderColor: '#9ca3af',
    buttonText: 'Plan actual',
    currency: 'USD',
    id: 'free',
    name: 'BoardPDF Free',
    priceMonthly: 0,
    priceYearly: 0,
    ringBg: '#9ca3af',
    tagline: 'Ideal para comenzar a explorar y procesar documentos sin costo.',
  },
  pro: {
    badge: 'Más Popular',
    borderColor: '#3b82f6',
    buttonText: 'Obtener BoardPDF Pro',
    currency: 'USD',
    id: 'pro',
    isPopular: true,
    name: 'BoardPDF Pro',
    priceMonthly: 9.99,
    priceYearly: 7.99,
    ringBg: '#3b82f6',
    stripePriceMonthlyId: 'price_1UWf5cE4dfTcnyKK45Xiqzgo',
    stripePriceYearlyId: 'price_1UWf5cE4dfTcnyKK1M2gQcZI',
    tagline: 'El plan más equilibrado para profesionales, investigadores y creadores independientes.',
  },
};

export function normalizeTierKey(tier?: string | null): SubscriptionTierId {
  const clean = (tier || 'free').toLowerCase().trim();
  if (clean === 'negocios' || clean === 'business') {
    return 'business';
  }
  if (clean === 'empresas' || clean === 'enterprise') {
    return 'enterprise';
  }
  if (clean === 'pro') {
    return 'pro';
  }
  return 'free';
}

export function getTierBorderColor(tier?: string | null): string {
  const norm = normalizeTierKey(tier);
  return PLAN_TIER_CONFIGS[norm].borderColor;
}
