import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';

interface TierDefinition {
  description: string;
  id: 'pro' | 'business';
  name: string;
  prices: {
    monthly: number;
    oneTime: number;
    yearly: number;
  };
}

interface InitializedTierResult {
  monthlyPriceId: string;
  oneTimePriceId: string;
  productId: string;
  tier: 'pro' | 'business';
  tierName: string;
  yearlyPriceId: string;
}

const TIERS: TierDefinition[] = [
  {
    description: 'The balanced plan for professionals, researchers, and independent creators.',
    id: 'pro',
    name: 'BoardPDF Pro',
    prices: {
      monthly: 499,
      oneTime: 9900,
      yearly: 4790,
    },
  },
  {
    description: 'Maximum power, automation, and advanced collaboration for growing teams and firms.',
    id: 'business',
    name: 'BoardPDF Business',
    prices: {
      monthly: 999,
      oneTime: 19900,
      yearly: 9590,
    },
  },
];

function loadEnvironment(): void {
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/BoardPDF/.env'),
    path.resolve(import.meta.dirname, '../.env'),
  ];
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  }
}

async function findOrCreateProduct(stripe: Stripe, tier: TierDefinition): Promise<Stripe.Product> {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find((p) => {
    return (
      p.metadata?.tier === tier.id ||
      p.metadata?.planId === tier.id ||
      p.name.toLowerCase() === tier.name.toLowerCase()
    );
  });

  if (existing) {
    if (existing.metadata?.tier !== tier.id) {
      return await stripe.products.update(existing.id, {
        metadata: { ...existing.metadata, platform: 'boardpdf', tier: tier.id },
      });
    }
    return existing;
  }

  return await stripe.products.create({
    description: tier.description,
    metadata: {
      platform: 'boardpdf',
      tier: tier.id,
    },
    name: tier.name,
  });
}

async function findOrCreateRecurringPrice(
  stripe: Stripe,
  productId: string,
  amountInCents: number,
  interval: 'month' | 'year'
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({ active: true, limit: 100, product: productId });
  const existing = prices.data.find((price) => {
    return (
      price.type === 'recurring' &&
      price.recurring?.interval === interval &&
      price.unit_amount === amountInCents &&
      price.currency === 'usd'
    );
  });

  if (existing) {
    return existing;
  }

  return await stripe.prices.create({
    currency: 'usd',
    product: productId,
    recurring: {
      interval,
    },
    unit_amount: amountInCents,
  });
}

async function findOrCreateOneTimePrice(
  stripe: Stripe,
  productId: string,
  amountInCents: number
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({ active: true, limit: 100, product: productId });
  const existing = prices.data.find((price) => {
    return price.type === 'one_time' && price.unit_amount === amountInCents && price.currency === 'usd';
  });

  if (existing) {
    return existing;
  }

  return await stripe.prices.create({
    currency: 'usd',
    product: productId,
    unit_amount: amountInCents,
  });
}

async function initializeStripeProducts(): Promise<InitializedTierResult[]> {
  loadEnvironment();

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    process.stderr.write('Error: STRIPE_SECRET_KEY environment variable is required.\n');
    process.exit(1);
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia' as any,
  });

  const results: InitializedTierResult[] = [];

  for (const tier of TIERS) {
    const product = await findOrCreateProduct(stripe, tier);
    const monthlyPrice = await findOrCreateRecurringPrice(stripe, product.id, tier.prices.monthly, 'month');
    const yearlyPrice = await findOrCreateRecurringPrice(stripe, product.id, tier.prices.yearly, 'year');
    const oneTimePrice = await findOrCreateOneTimePrice(stripe, product.id, tier.prices.oneTime);

    results.push({
      monthlyPriceId: monthlyPrice.id,
      oneTimePriceId: oneTimePrice.id,
      productId: product.id,
      tier: tier.id,
      tierName: tier.name,
      yearlyPriceId: yearlyPrice.id,
    });
  }

  process.stdout.write('\n=== STRIPE PRODUCTS & PRICES INITIALIZED SUCCESSFULLY ===\n\n');
  console.table(
    results.flatMap((r) => [
      {
        Amount: `$${(r.tier === 'pro' ? 4.99 : 9.99).toFixed(2)}`,
        Billing: 'Monthly (Recurring)',
        PriceId: r.monthlyPriceId,
        ProductId: r.productId,
        Tier: r.tierName,
      },
      {
        Amount: `$${(r.tier === 'pro' ? 47.9 : 95.9).toFixed(2)}`,
        Billing: 'Annual (Recurring)',
        PriceId: r.yearlyPriceId,
        ProductId: r.productId,
        Tier: r.tierName,
      },
      {
        Amount: `$${(r.tier === 'pro' ? 99.0 : 199.0).toFixed(2)}`,
        Billing: 'One-Time (Prepaid)',
        PriceId: r.oneTimePriceId,
        ProductId: r.productId,
        Tier: r.tierName,
      },
    ])
  );

  process.stdout.write('\n=== CONFIGURATION FOR .env ===\n');
  for (const r of results) {
    const prefix = r.tier.toUpperCase();
    process.stdout.write(`STRIPE_PRODUCT_${prefix}=${r.productId}\n`);
    process.stdout.write(`STRIPE_PRICE_${prefix}_MONTHLY=${r.monthlyPriceId}\n`);
    process.stdout.write(`STRIPE_PRICE_${prefix}_YEARLY=${r.yearlyPriceId}\n`);
    process.stdout.write(`STRIPE_PRICE_${prefix}_ONETIME=${r.oneTimePriceId}\n`);
  }

  process.stdout.write('\n=== CONFIGURATION FOR src/config/plans.config.ts ===\n');
  const proResult = results.find((r) => r.tier === 'pro');
  const businessResult = results.find((r) => r.tier === 'business');
  process.stdout.write(`// Pro:\nstripePriceMonthlyId: '${proResult?.monthlyPriceId}',\nstripePriceYearlyId: '${proResult?.yearlyPriceId}',\n\n`);
  process.stdout.write(`// Business:\nstripePriceMonthlyId: '${businessResult?.monthlyPriceId}',\nstripePriceYearlyId: '${businessResult?.yearlyPriceId}',\n\n`);

  return results;
}

if (process.argv[1] && (process.argv[1].endsWith('init-stripe-products.ts') || process.argv[1].endsWith('init-stripe-products.js'))) {
  void initializeStripeProducts();
}

export {
  findOrCreateOneTimePrice,
  findOrCreateProduct,
  findOrCreateRecurringPrice,
  initializeStripeProducts,
  TIERS,
};
export type {
  InitializedTierResult,
  TierDefinition,
};
