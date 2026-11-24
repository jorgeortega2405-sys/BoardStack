interface PlanFeature {
  description: string;
  title: string;
}

interface PlanConfig {
  badge: string;
  buttonText: string;
  description: string;
  features: PlanFeature[];
  id: 'pro' | 'enterprise';
  isPopular: boolean;
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

const ENTERPRISE_PLAN: PlanConfig = {
  badge: 'Enterprise',
  buttonText: 'Get BoardStack Enterprise',
  description: 'Advanced capacity, dedicated team management, SAML 2.0 and Single Sign-On for organizations.',
  features: [
    {
      description: 'Persistent cloud storage up to 10 TB for enterprise transfers.',
      title: '10 TB Cloud Storage',
    },
    {
      description: 'Enterprise Single Sign-On with SAML 2.0 (Okta, Azure AD, Google).',
      title: 'SAML 2.0 & SSO',
    },
    {
      description: 'Centralized organization dashboard with 25 team member seats.',
      title: 'Organization & Seats',
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
  storageLabel: '10 TB cloud storage',
  tagline: 'High-volume infrastructure, custom identity management, and team collaboration.',
};

function getPriceAmount(
  arg1: 'pro' | 'enterprise' | 'one_time' | 'recurring',
  arg2: 'one_time' | 'recurring' | '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly',
  arg3?: '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly'
): number {
  let planId: 'pro' | 'enterprise' = 'pro';
  let billingType: 'one_time' | 'recurring' = 'recurring';
  let period: '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly' = 'monthly';

  if (arg1 === 'pro' || arg1 === 'enterprise') {
    planId = arg1;
    billingType = arg2 as 'one_time' | 'recurring';
    period = (arg3 || 'monthly') as any;
  } else {
    billingType = arg1 as 'one_time' | 'recurring';
    period = arg2 as any;
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

export {
  ENTERPRISE_PLAN,
  PRO_PLAN,
  calculatePeriodEnd,
  getPriceAmount
};

export type {
  PlanConfig,
  PlanFeature
};
