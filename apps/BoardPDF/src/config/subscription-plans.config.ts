export type SubscriptionTierKey = 'business' | 'edu_individual' | 'edu_school' | 'edu_university' | 'enterprise' | 'free' | 'pro';

export interface ToolLimitTierConfig {
  maxFiles: number;
  maxFileSizeMB: number;
  maxTotalSizeMB: number;
  requiredPermission?: string;
}

export interface ToolTierLimits {
  business: ToolLimitTierConfig;
  enterprise: ToolLimitTierConfig;
  free: ToolLimitTierConfig;
  premium: ToolLimitTierConfig;
  pro: ToolLimitTierConfig;
}

export type AllPdfToolsLimits = Record<string, ToolTierLimits>;

export interface PlanFeatureItem {
  description: string;
  highlight?: boolean;
  icon?: string;
  title: string;
}

export interface PlanBenefitsDefinition {
  badge?: string;
  buttonText: string;
  category: 'education' | 'general';
  description: string;
  features: PlanFeatureItem[];
  hasAdvancedAi: boolean;
  hasBatchProcessing: boolean;
  hasOrganization: boolean;
  hasSaml: boolean;
  hasSso: boolean;
  id: SubscriptionTierKey;
  isPopular?: boolean;
  maxWorkflows: number;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  storageGB: number;
  storageLabel: string;
  supportLevel: 'community' | 'priority' | 'dedicated_24_7';
  tagline: string;
}

export const WORKFLOW_LIMITS: Record<SubscriptionTierKey, number> = {
  business: 200,
  edu_individual: 50,
  edu_school: 200,
  edu_university: 1000,
  enterprise: 1000,
  free: 5,
  pro: 50,
};

export const ALL_TOOLS_LIMITS: AllPdfToolsLimits = {
  'collaborative-pdf': {
    business: { maxFiles: 50, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'subscription:feature:business' },
    enterprise: { maxFiles: 100, maxFileSizeMB: 2000, maxTotalSizeMB: 5000, requiredPermission: 'subscription:feature:enterprise' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    premium: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'subscription:feature:pro' },
    pro: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'subscription:feature:pro' },
  },
  'compare-pdf': {
    business: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 2, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 2, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 2, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'compress-pdf': {
    business: { maxFiles: 25, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 50, maxFileSizeMB: 2000, maxTotalSizeMB: 5000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    premium: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
  },
  'crop-pdf': {
    business: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 20, maxFileSizeMB: 2000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    premium: { maxFiles: 5, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 5, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'edit-pdf': {
    business: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 20, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    premium: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
  },
  'excel-to-pdf': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'extract-pdf-pages': {
    business: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:split:by_size' },
    enterprise: { maxFiles: 50, maxFileSizeMB: 2000, maxTotalSizeMB: 2000, requiredPermission: 'tools:split:by_size' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    premium: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:split:by_size' },
    pro: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:split:by_size' },
  },
  'html-to-pdf': {
    business: { maxFiles: 50, maxFileSizeMB: 200, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    premium: { maxFiles: 20, maxFileSizeMB: 200, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 20, maxFileSizeMB: 200, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
  },
  'jpg-to-pdf': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'merge-pdf': {
    business: { maxFiles: 500, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:merge:batch_500' },
    enterprise: { maxFiles: 1000, maxFileSizeMB: 2000, maxTotalSizeMB: 5000, requiredPermission: 'tools:merge:batch_500' },
    free: { maxFiles: 25, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 500, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:merge:batch_500' },
    pro: { maxFiles: 500, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:merge:batch_500' },
  },
  'ocr-pdf': {
    business: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 50, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    premium: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'organize-pdf': {
    business: { maxFiles: 500, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:merge:batch_500' },
    enterprise: { maxFiles: 1000, maxFileSizeMB: 2000, maxTotalSizeMB: 5000, requiredPermission: 'tools:merge:batch_500' },
    free: { maxFiles: 25, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 500, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:merge:batch_500' },
    pro: { maxFiles: 500, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:merge:batch_500' },
  },
  'page-numbers': {
    business: { maxFiles: 25, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 50, maxFileSizeMB: 2000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    premium: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-converter': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-excel': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-jpg': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-markdown': {
    business: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 20, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    premium: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-pdfa': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-powerpoint': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-word': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'powerpoint-to-pdf': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'protect-pdf': {
    business: { maxFiles: 25, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 50, maxFileSizeMB: 2000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    premium: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'redact-pdf': {
    business: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 20, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    premium: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
  },
  'remove-pdf-pages': {
    business: { maxFiles: 5, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 20, maxFileSizeMB: 2000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    premium: { maxFiles: 1, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 1, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'repair-pdf': {
    business: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 20, maxFileSizeMB: 2000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    premium: { maxFiles: 5, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 5, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'rotate-pdf': {
    business: { maxFiles: 50, maxFileSizeMB: 1000, maxTotalSizeMB: 1500, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 100, maxFileSizeMB: 2000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    premium: { maxFiles: 20, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 20, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'split-pdf': {
    business: { maxFiles: 5, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:split:by_size' },
    enterprise: { maxFiles: 20, maxFileSizeMB: 2000, maxTotalSizeMB: 2000, requiredPermission: 'tools:split:by_size' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    premium: { maxFiles: 1, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:split:by_size' },
    pro: { maxFiles: 1, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:split:by_size' },
  },
  'summarize-pdf': {
    business: { maxFiles: 3, maxFileSizeMB: 200, maxTotalSizeMB: 300, requiredPermission: 'tools:ai:advanced' },
    enterprise: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:ai:advanced' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    premium: { maxFiles: 1, maxFileSizeMB: 200, maxTotalSizeMB: 200, requiredPermission: 'tools:ai:advanced' },
    pro: { maxFiles: 1, maxFileSizeMB: 200, maxTotalSizeMB: 200, requiredPermission: 'tools:ai:advanced' },
  },
  'to-pdf-converter': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'translate-pdf': {
    business: { maxFiles: 3, maxFileSizeMB: 200, maxTotalSizeMB: 300, requiredPermission: 'tools:ai:advanced' },
    enterprise: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:ai:advanced' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    premium: { maxFiles: 1, maxFileSizeMB: 200, maxTotalSizeMB: 200, requiredPermission: 'tools:ai:advanced' },
    pro: { maxFiles: 1, maxFileSizeMB: 200, maxTotalSizeMB: 200, requiredPermission: 'tools:ai:advanced' },
  },
  'unlock-pdf': {
    business: { maxFiles: 25, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 50, maxFileSizeMB: 2000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    premium: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'watermark-pdf': {
    business: { maxFiles: 25, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 50, maxFileSizeMB: 2000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    premium: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'word-to-pdf': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    enterprise: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 3000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'workflows': {
    business: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'subscription:feature:business' },
    enterprise: { maxFiles: 1000, maxFileSizeMB: 2000, maxTotalSizeMB: 5000, requiredPermission: 'subscription:feature:enterprise' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    premium: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'subscription:feature:pro' },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'subscription:feature:pro' },
  },
};

export const PLAN_TIER_BENEFITS: Record<SubscriptionTierKey, PlanBenefitsDefinition> = {
  business: {
    badge: 'Para Equipos',
    buttonText: 'Obtener Negocios',
    category: 'general',
    description: 'Almacenamiento corporativo, edición colaborativa simultánea y flujos compartidos.',
    features: [
      {
        description: 'Espacio ampliado en la nube para centralizar y compartir archivos con tu grupo.',
        title: '500 GB de almacenamiento para equipos',
      },
      {
        description: 'Lotes de hasta 500 archivos simultáneos y soporte total de archivos hasta 1,000 MB.',
        title: 'Capacidad ultra alta de procesamiento',
      },
      {
        description: 'Edición conjunta de documentos interactivos con control y trazabilidad de cambios.',
        title: 'Colaboración en tiempo real',
      },
      {
        description: 'Crea, estandariza y distribuye cadenas de automatización entre miembros del equipo.',
        title: 'Flujos de trabajo compartidos',
      },
      {
        description: 'Administración centralizada de integrantes, consumo de recursos y permisos.',
        title: 'Panel de control y gestión de licencias',
      },
    ],
    hasAdvancedAi: true,
    hasBatchProcessing: true,
    hasOrganization: true,
    hasSaml: false,
    hasSso: false,
    id: 'business',
    maxWorkflows: 200,
    name: 'BoardPDF Negocios',
    priceMonthly: 19.99,
    priceYearly: 15.99,
    storageGB: 500,
    storageLabel: '500 GB de almacenamiento',
    supportLevel: 'priority',
    tagline: 'Máxima potencia, automatización y colaboración avanzada para despachos y equipos en crecimiento.',
  },
  edu_individual: {
    badge: 'Comunidad Académica',
    buttonText: 'Reclamar 1 año gratis',
    category: 'education',
    description: 'Acceso completo a herramientas Pro para docentes y estudiantes de educación básica, media y superior.',
    features: [
      {
        description: 'Reconocimiento óptico de caracteres y extracción precisa de texto en documentos escaneados.',
        title: 'OCR avanzado y exportación',
      },
      {
        description: 'Espacio seguro en la nube para almacenar apuntes, libros y documentos de estudio.',
        title: '100 GB de almacenamiento en nube',
      },
      {
        description: 'Convierte, comprime y une sin límites de espera ni marcas de agua en tus entregas.',
        title: 'Herramientas de conversión sin límites',
      },
      {
        description: 'Acceso completo a funciones avanzadas de edición y síntesis con IA para investigación.',
        title: 'Edición y resumen con IA',
      },
      {
        description: 'Acceso total sin costo durante 12 meses renovables con verificación institucional.',
        title: '1 año gratis con correo .edu',
      },
    ],
    hasAdvancedAi: true,
    hasBatchProcessing: true,
    hasOrganization: false,
    hasSaml: false,
    hasSso: false,
    id: 'edu_individual',
    maxWorkflows: 50,
    name: 'Docentes y Estudiantes',
    priceMonthly: 0,
    priceYearly: 0,
    storageGB: 100,
    storageLabel: '100 GB de almacenamiento',
    supportLevel: 'priority',
    tagline: 'Acceso completo a herramientas Pro para docentes y estudiantes de educación con correo institucional.',
  },
  edu_school: {
    badge: 'Para Escuelas K-12',
    buttonText: 'Plan Institucional',
    category: 'education',
    description: 'Colaboración escolar masiva, gestión administrativa y SSO para instituciones K-12.',
    features: [
      {
        description: 'Panel escolar centralizado para matricular profesores, personal y alumnos de forma masiva.',
        title: 'Gestión centralizada de licencias',
      },
      {
        description: 'Autenticación mediante Google Classroom, Microsoft Office 365 Educación y SAML 2.0.',
        title: 'Integración SSO institucional',
      },
      {
        description: 'Infraestructura compartida para trabajo colegiado y revisión de material didáctico.',
        title: '500 GB de almacenamiento escolar',
      },
      {
        description: 'Cumplimiento normativo para protección de identidad de menores y auditoría educativa.',
        title: 'Privacidad y cumplimiento FERPA / COPPA',
      },
      {
        description: 'Canal directo de asistencia técnica y capacitación para el personal docente.',
        title: 'Soporte prioritario para administradores',
      },
    ],
    hasAdvancedAi: true,
    hasBatchProcessing: true,
    hasOrganization: true,
    hasSaml: true,
    hasSso: true,
    id: 'edu_school',
    maxWorkflows: 200,
    name: 'Escuelas y Sistemas Educativos',
    priceMonthly: 0,
    priceYearly: 0,
    storageGB: 500,
    storageLabel: '500 GB de almacenamiento escolar',
    supportLevel: 'priority',
    tagline: 'Colaboración escolar masiva, gestión administrativa y SSO para instituciones K-12.',
  },
  edu_university: {
    badge: 'Para Campus y Universidades',
    buttonText: 'Convenio de Campus',
    category: 'education',
    description: 'Convenio de campus, alta concurrencia, integración SSO y soporte prioritario.',
    features: [
      {
        description: 'Licenciamiento global para toda la comunidad académica, investigadores y facultades.',
        title: 'Acceso ilimitado para campus completo',
      },
      {
        description: 'Federación Shibboleth, eduGAIN, Microsoft Entra ID y Okta con aprovisionamiento SCIM.',
        title: 'Federación SSO y aprovisionamiento',
      },
      {
        description: 'Infraestructura de alta capacidad para tesis, repositorios y producción científica.',
        title: 'Almacenamiento de campus a medida (1 TB+)',
      },
      {
        description: 'Métricas de adopción de herramientas por facultad y trazabilidad de operaciones.',
        title: 'Auditoría avanzada y analíticas de uso',
      },
      {
        description: 'Garantía de servicio 99.9% y soporte técnico directo 24/7 para el equipo de TI.',
        title: 'SLA universitario y gestor dedicado',
      },
    ],
    hasAdvancedAi: true,
    hasBatchProcessing: true,
    hasOrganization: true,
    hasSaml: true,
    hasSso: true,
    id: 'edu_university',
    maxWorkflows: 1000,
    name: 'Universidades e Institutos',
    priceMonthly: 0,
    priceYearly: 0,
    storageGB: 1024,
    storageLabel: 'Almacenamiento de campus a medida',
    supportLevel: 'dedicated_24_7',
    tagline: 'Convenio de campus, alta concurrencia, integración SSO y soporte prioritario.',
  },
  enterprise: {
    badge: 'Para Empresas',
    buttonText: 'Plan Corporativo',
    category: 'general',
    description: 'Seguridad corporativa, control granular de accesos e infraestructura dedicada a gran escala.',
    features: [
      {
        description: 'Integración directa con Google Workspace, Microsoft Entra ID, Okta y Shibboleth.',
        title: 'Single Sign-On (SSO) y SAML 2.0 estándar',
      },
      {
        description: 'Control de accesos por permisos, asignación de roles y métricas de uso corporativo.',
        title: 'Consola de Organización y PBAC avanzado',
      },
      {
        description: 'Espacio escalable de alta capacidad con políticas de retención y cifrado seguro.',
        title: 'Almacenamiento corporativo a medida (1 TB+)',
      },
      {
        description: 'Procesamiento sin colas de espera con hasta 1,000 archivos y 2,000 MB por tarea.',
        title: 'Infraestructura dedicada de alto volumen',
      },
      {
        description: 'Disponibilidad corporativa garantizada con gestor de cuenta técnico dedicado.',
        title: 'SLA del 99.9% y soporte técnico 24/7',
      },
    ],
    hasAdvancedAi: true,
    hasBatchProcessing: true,
    hasOrganization: true,
    hasSaml: true,
    hasSso: true,
    id: 'enterprise',
    maxWorkflows: 1000,
    name: 'BoardPDF Empresas',
    priceMonthly: 0,
    priceYearly: 0,
    storageGB: 1024,
    storageLabel: 'Almacenamiento a medida (1 TB+)',
    supportLevel: 'dedicated_24_7',
    tagline: 'Seguridad corporativa, control granular de accesos e infraestructura dedicada a gran escala.',
  },
  free: {
    buttonText: 'Plan actual',
    category: 'general',
    description: 'Herramientas esenciales para procesar y gestionar documentos sin costo.',
    features: [
      {
        description: 'Combina, organiza y rota documentos con límites de 50 MB por archivo.',
        title: 'Lotes estándar de hasta 25 archivos',
      },
      {
        description: 'Espacio personal sincronizado para respaldar y gestionar tus documentos.',
        title: '5 GB de almacenamiento en nube',
      },
      {
        description: 'Convierte archivos JPG, Word, Excel y PowerPoint a formato PDF sin marca de agua.',
        title: 'Herramientas de conversión esenciales',
      },
      {
        description: 'Aplica contraseñas, bloqueos y marcas de agua personalizadas en tus PDFs.',
        title: 'Seguridad y protección básica',
      },
      {
        description: 'Automatiza secuencias básicas de procesamiento documental en tu navegador.',
        title: '5 flujos de trabajo locales',
      },
    ],
    hasAdvancedAi: false,
    hasBatchProcessing: false,
    hasOrganization: false,
    hasSaml: false,
    hasSso: false,
    id: 'free',
    maxWorkflows: 5,
    name: 'BoardPDF Free',
    priceMonthly: 0,
    priceYearly: 0,
    storageGB: 5,
    storageLabel: '5 GB de almacenamiento',
    supportLevel: 'community',
    tagline: 'Ideal para comenzar a explorar y procesar documentos sin costo.',
  },
  pro: {
    badge: 'Más Popular',
    buttonText: 'Obtener BoardPDF Pro',
    category: 'general',
    description: 'El plan más equilibrado para profesionales, investigadores y creadores independientes.',
    features: [
      {
        description: 'Convierte, une y organiza hasta 500 archivos por tarea sin límites de espera.',
        title: 'Procesamiento masivo por lotes',
      },
      {
        description: 'Procesa documentos extensos con soporte de alta fidelidad y máxima compresión.',
        title: 'Archivos de gran capacidad (1,000 MB)',
      },
      {
        description: 'Sincronización instantánea, respaldo seguro y acceso desde cualquier dispositivo.',
        title: '100 GB de almacenamiento en nube',
      },
      {
        description: 'Reconocimiento óptico de texto, resumen inteligente y traducción con IA.',
        title: 'OCR y herramientas de Inteligencia Artificial',
      },
      {
        description: 'Guarda y encadena automatizaciones personalizadas para optimizar tu tiempo.',
        title: '50 flujos de trabajo avanzados',
      },
    ],
    hasAdvancedAi: true,
    hasBatchProcessing: true,
    hasOrganization: false,
    hasSaml: false,
    hasSso: false,
    id: 'pro',
    isPopular: true,
    maxWorkflows: 50,
    name: 'BoardPDF Pro',
    priceMonthly: 9.99,
    priceYearly: 7.99,
    storageGB: 100,
    storageLabel: '100 GB de almacenamiento',
    supportLevel: 'priority',
    tagline: 'El plan más equilibrado para profesionales, investigadores y creadores independientes.',
  },
};

export function normalizeTierKey(tier?: string | null): SubscriptionTierKey {
  const clean = (tier || 'free').toLowerCase().trim();
  if (clean === 'negocios' || clean === 'business') {
    return 'business';
  }
  if (clean === 'edu_individual' || clean === 'educacion_individual') {
    return 'edu_individual';
  }
  if (clean === 'edu_school' || clean === 'escuelas') {
    return 'edu_school';
  }
  if (clean === 'edu_university' || clean === 'universidades') {
    return 'edu_university';
  }
  if (clean === 'empresas' || clean === 'enterprise') {
    return 'enterprise';
  }
  if (clean === 'pro') {
    return 'pro';
  }
  return 'free';
}

export function getPlanBenefits(tier?: string | null): PlanBenefitsDefinition {
  const norm = normalizeTierKey(tier);
  return PLAN_TIER_BENEFITS[norm];
}

export function getToolTierLimits(toolId: string, tier: SubscriptionTierKey = 'free'): ToolLimitTierConfig {
  const tool = ALL_TOOLS_LIMITS[toolId];
  if (!tool) {
    return { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 };
  }
  const norm = normalizeTierKey(tier);
  if (norm === 'edu_individual') {
    return tool.pro;
  }
  if (norm === 'edu_school') {
    return tool.business;
  }
  if (norm === 'edu_university') {
    return tool.enterprise;
  }
  return tool[norm];
}

export function resolveToolLimits(toolId: string, permissions: string[] = []): ToolLimitTierConfig {
  const tool = ALL_TOOLS_LIMITS[toolId];
  if (!tool) {
    return { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 };
  }

  const perms = permissions ?? [];

  if (perms.includes('subscription:feature:enterprise')) {
    return tool.enterprise;
  }
  if (perms.includes('subscription:feature:business')) {
    return tool.business;
  }
  if (perms.includes('subscription:feature:pro')) {
    return tool.pro;
  }

  if (tool.pro.requiredPermission && perms.includes(tool.pro.requiredPermission)) {
    return tool.pro;
  }
  if (tool.enterprise.requiredPermission && perms.includes(tool.enterprise.requiredPermission)) {
    return tool.enterprise;
  }
  if (tool.business.requiredPermission && perms.includes(tool.business.requiredPermission)) {
    return tool.business;
  }

  return tool.free;
}
