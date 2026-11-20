interface PlanFeature {
  description: string;
  title: string;
}

interface PlanConfig {
  badge: string;
  buttonText: string;
  description: string;
  features: PlanFeature[];
  id: 'pro';
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

function getPriceAmount(billingType: 'one_time' | 'recurring', period: '1_month' | '6_months' | '12_months' | 'monthly' | 'yearly'): number {
  if (billingType === 'recurring') {
    return period === 'yearly' ? PRO_PLAN.prices.recurring.yearly * 12 : PRO_PLAN.prices.recurring.monthly;
  }
  if (period === '6_months') return PRO_PLAN.prices.oneTime['6_months'];
  if (period === '12_months') return PRO_PLAN.prices.oneTime['12_months'];
  return PRO_PLAN.prices.oneTime['1_month'];
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
  PRO_PLAN,
  calculatePeriodEnd,
  getPriceAmount
};

export type {
  PlanConfig,
  PlanFeature
};
