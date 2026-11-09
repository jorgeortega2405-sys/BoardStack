type SubscriptionTierId = 'business' | 'free' | 'pro';

interface PurchaseRecord {
  amount_total: number;
  billing_period: 'monthly' | 'yearly' | 'one_time_monthly' | 'one_time_yearly';
  created_at?: Date | string;
  currency: string;
  id?: number;
  plan_id: string;
  status: string;
  stripe_customer_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_session_id: string;
  stripe_subscription_id?: string | null;
  updated_at?: Date | string;
  user_id: number;
}

interface PaymentMethod {
  brand: string;
  expMonth: number;
  expYear: number;
  id: string;
  isDefault: boolean;
  last4: string;
}

interface BillingDetailsResponse {
  amount?: number;
  billing_period?: string;
  cancel_at_period_end?: boolean;
  current_period_end?: string | null;
  current_period_start?: string | null;
  customer_id?: string | null;
  hasSubscription: boolean;
  interval?: 'month' | 'year';
  is_one_time?: boolean;
  status?: string;
  stripe_subscription_id?: string | null;
  subscription_id?: string | null;
  success: boolean;
  tier: SubscriptionTierId | string;
}

interface SubscriptionTier {
  badge?: string;
  borderColor: string;
  buttonText: string;
  currency: string;
  id: SubscriptionTierId;
  isPopular?: boolean;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  ringBg: string;
  stripePriceMonthlyId?: string;
  stripePriceYearlyId?: string;
  tagline: string;
}

interface SubscriptionIntentResponse {
  amount: number;
  billingPeriod: 'monthly' | 'yearly';
  clientSecret: string;
  currency: string;
  paymentIntentId: string;
  planId: SubscriptionTierId;
  planName: string;
  publishableKey: string;
  subscriptionId: string;
  success: boolean;
}

interface OneTimePaymentIntentResponse {
  amount: number;
  billingType: 'one_time';
  clientSecret: string;
  currency: string;
  duration: '1_month' | '12_months';
  paymentIntentId: string;
  planId: SubscriptionTierId;
  planName: string;
  publishableKey: string;
  success: boolean;
}

export type { BillingDetailsResponse, OneTimePaymentIntentResponse, PaymentMethod, PurchaseRecord, SubscriptionIntentResponse, SubscriptionTier, SubscriptionTierId };
