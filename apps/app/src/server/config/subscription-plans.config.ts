interface PlanFeature {
  description: string;
  title: string;
}

interface PlanConfig {
  badge: string;
  baseSeats?: number;
  buttonText: string;
  description: string;
  extraSeatPriceMonthly?: number;
  extraSeatPriceYearly?: number;
  features: PlanFeature[];
  id: 'pro' | 'business' | 'enterprise';
  isPopular: boolean;
  maxSeats?: number;
  minSeats?: number;
  name: string;
  prices: {
    oneTime: {
      '1_month': number;
      '6_months': number;
      '12_months': number;
    };
    recurring: {
      monthly: number;
      yearly: number;
    };
  };
  storageLabel: string;
  tagline: string;
}

const PRO_PLAN: PlanConfig = {
  badge: 'Most Popular',
  buttonText: 'Get BoardStack Pro',
  description: 'The most balanced plan for professionals, researchers, and independent creators.',
  features: [
    {
      description: 'Massive processing without delays.',
      title: 'Batch Processing',
    },
    {
      description: 'High capacity files up to 1,000 MB.',
      title: 'Large File Support',
    },
    {
      description: '100 GB of secure encrypted cloud storage.',
      title: '100 GB Secure Storage',
    },
    {
      description: 'Advanced AI and OCR automation tools.',
      title: 'AI Tools',
    },
    {
      description: '50 customized productivity workflows.',
      title: 'Custom Workflows',
    },
  ],
  id: 'pro',
  isPopular: true,
  name: 'BoardStack Pro',
  prices: {
    oneTime: {
      '1_month': 9.99,
      '6_months': 49.99,
      '12_months': 89.99,
    },
    recurring: {
      monthly: 9.99,
      yearly: 7.99,
    },
  },
  storageLabel: '100 GB cloud storage',
  tagline: 'Maximum speed, advanced tools, and expanded limits for your daily productivity.',
};

const BUSINESS_PLAN: PlanConfig = {
  badge: 'Teams & Startups',
  baseSeats: 3,
  buttonText: 'Get BoardStack Business',
  description: 'Scalable collaboration for teams and agencies with dynamic seats and central organization.',
  extraSeatPriceMonthly: 6.00,
  extraSeatPriceYearly: 5.00,
  features: [
    {
      description: 'Collaborate with your team from a centralized dashboard.',
      title: 'Dynamic Team Seats',
    },
    {
      description: '1 TB of high-speed encrypted cloud storage for team files.',
      title: '1 TB Cloud Storage',
    },
    {
      description: 'Permanent 24/7 team rooms with custom passwords and permissions.',
      title: 'Unlimited Team Rooms',
    },
    {
      description: 'SAML 2.0 Single Sign-On and Google Workspace authentication.',
      title: 'SAML 2.0 & SSO',
    },
    {
      description: 'Custom corporate organization link and member role controls.',
      title: 'Organization Workspace',
    },
  ],
  id: 'business',
  isPopular: true,
  maxSeats: 50,
  minSeats: 3,
  name: 'BoardStack Business',
  prices: {
    oneTime: {
      '1_month': 29.00,
      '6_months': 149.00,
      '12_months': 288.00,
    },
    recurring: {
      monthly: 29.00,
      yearly: 24.00,
    },
  },
  storageLabel: '1 TB cloud storage',
  tagline: 'Streamlined collaboration, unified billing, and flexible team seats.',
};

const ENTERPRISE_PLAN: PlanConfig = {
  badge: '',
  buttonText: 'Get BoardStack Enterprise',
  description: 'Advanced capacity, dedicated team management, SAML 2.0 and Single Sign-On for organizations.',
  features: [
    {
      description: 'High-volume persistent cloud storage tailored dynamically to your enterprise demand.',
      title: 'Scalable Cloud Storage',
    },
    {
      description: 'Enterprise Single Sign-On with SAML 2.0 (Okta, Azure AD, Google).',
      title: 'SAML 2.0 & SSO',
    },
    {
      description: 'Dedicated organization dashboard tailored to any team size with priority account manager.',
      title: 'Unlimited Custom Seats',
    },
    {
      description: 'Branded links, 24/7 persistent rooms and customizable passwords.',
      title: 'Custom URLs & Persistence',
    },
    {
      description: 'Granular download restrictions and programmable room expiration.',
      title: 'Advanced Access Controls',
    },
  ],
  id: 'enterprise',
  isPopular: false,
  name: 'BoardStack Enterprise',
  prices: {
    oneTime: {
      '1_month': 99.00,
      '6_months': 499.00,
      '12_months': 899.00,
    },
    recurring: {
      monthly: 99.00,
      yearly: 79.00,
    },
  },
  storageLabel: 'Scalable storage on demand',
  tagline: 'High-volume infrastructure, custom identity management, and team collaboration.',
};

function getPriceAmount(
  arg1: 'pro' | 'business' | 'enterprise' | 'one_time' | 'recurring',
  arg2: 'one_time' | 'recurring' | '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly',
  arg3?: '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly',
  arg4?: number
): number {
  let planId: 'pro' | 'business' | 'enterprise' = 'pro';
  let billingType: 'one_time' | 'recurring' = 'recurring';
  let period: '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly' = 'monthly';
  let seats = 3;

  if (arg1 === 'pro' || arg1 === 'business' || arg1 === 'enterprise') {
    planId = arg1;
    billingType = arg2 as 'one_time' | 'recurring';
    period = (arg3 || 'monthly') as any;
    seats = typeof arg4 === 'number' && arg4 >= 3 ? Math.floor(arg4) : 3;
  } else {
    billingType = arg1 as 'one_time' | 'recurring';
    period = arg2 as any;
  }

  if (planId === 'business') {
    const extraSeats = Math.max(0, seats - 3);
    if (billingType === 'recurring') {
      if (period === 'yearly') {
        const baseYearly = BUSINESS_PLAN.prices.recurring.yearly * 12;
        const extraYearly = extraSeats * 5.00 * 12;
        return baseYearly + extraYearly;
      }
      return BUSINESS_PLAN.prices.recurring.monthly + (extraSeats * 6.00);
    }
    if (period === '6_months') {
      return BUSINESS_PLAN.prices.oneTime['6_months'] + (extraSeats * 30.00);
    }
    if (period === '12_months') {
      return BUSINESS_PLAN.prices.oneTime['12_months'] + (extraSeats * 60.00);
    }
    return BUSINESS_PLAN.prices.oneTime['1_month'] + (extraSeats * 6.00);
  }

  const plan = planId === 'enterprise' ? ENTERPRISE_PLAN : PRO_PLAN;
  if (billingType === 'recurring') {
    return period === 'yearly' ? plan.prices.recurring.yearly * 12 : plan.prices.recurring.monthly;
  }
  if (period === '6_months') return plan.prices.oneTime['6_months'];
  if (period === '12_months') return plan.prices.oneTime['12_months'];
  return plan.prices.oneTime['1_month'];
}

function calculatePeriodEnd(startDate: Date, billingType: 'one_time' | 'recurring', period: '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly'): Date {
  const end = new Date(startDate.getTime());
  if (billingType === 'recurring') {
    if (period === 'yearly') {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
  } else {
    if (period === '12_months') {
      end.setFullYear(end.getFullYear() + 1);
    } else if (period === '6_months') {
      end.setMonth(end.getMonth() + 6);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
  }
  return end;
}

const STORAGE_TIER_LIMITS = {
  business: 1099511627776,
  enterprise: 10995116277760,
  free: 5368709120,
  pro: 107374182400,
} as const;

const TIER_RANK = {
  business: 2,
  enterprise: 3,
  free: 0,
  pro: 1,
} as const;

function getTierRank(tier: string | null | undefined): number {
  const clean = (tier || 'free').trim().toLowerCase();
  if (clean === 'enterprise') return TIER_RANK.enterprise;
  if (clean === 'business') return TIER_RANK.business;
  if (clean === 'pro') return TIER_RANK.pro;
  return TIER_RANK.free;
}

function getStorageTierLimitBytes(tier: string | null | undefined): number {
  if (tier === 'enterprise') return STORAGE_TIER_LIMITS.enterprise;
  if (tier === 'business') return STORAGE_TIER_LIMITS.business;
  if (tier === 'pro') return STORAGE_TIER_LIMITS.pro;
  return STORAGE_TIER_LIMITS.free;
}

function getStorageTierLabel(tier: string | null | undefined): string {
  if (tier === 'enterprise') return 'Custom';
  if (tier === 'business') return '1 TB';
  if (tier === 'pro') return '100 GB';
  return '5 GB';
}

export {
  BUSINESS_PLAN,
  ENTERPRISE_PLAN,
  PRO_PLAN,
  STORAGE_TIER_LIMITS,
  TIER_RANK,
  calculatePeriodEnd,
  getPriceAmount,
  getStorageTierLabel,
  getStorageTierLimitBytes,
  getTierRank
};

export type {
  PlanConfig,
  PlanFeature
};
