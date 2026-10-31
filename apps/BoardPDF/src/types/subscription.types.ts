export type SubscriptionTierId = 'business' | 'enterprise' | 'free' | 'pro';

export interface PurchaseRecord {
  amount_total: number;
  billing_period: 'monthly' | 'yearly';
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

export interface PaymentMethod {
  brand: string;
  expMonth: number;
  expYear: number;
  id: string;
  isDefault: boolean;
  last4: string;
}

export interface BillingDetailsResponse {
  amount?: number;
  cancel_at_period_end?: boolean;
  current_period_end?: string | null;
  current_period_start?: string | null;
  customer_id?: string | null;
  hasSubscription: boolean;
  interval?: 'month' | 'year';
  status?: string;
  stripe_subscription_id?: string | null;
  subscription_id?: string | null;
  success: boolean;
  tier: SubscriptionTierId | string;
}

export interface SubscriptionTier {
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
  tagline: string;
}
