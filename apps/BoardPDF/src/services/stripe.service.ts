import { config } from '../config/env.config.js';
import { normalizeTierKey, PLAN_TIER_CONFIGS } from '../config/plans.config.js';
import { redis } from '../config/redis.config.js';
import { BillingDetailsResponse, PaymentMethod, PurchaseRecord, SubscriptionTierId } from '../types/subscription.types.js';
import { logger } from './logger.service.js';
import { purchaseService } from './purchase.service.js';
import Stripe from 'stripe';

export class StripeService {
  private static instance: StripeService;
  private stripe: Stripe;

  private constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    });
  }

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  public async getOrCreateCustomer(userId: number, email: string): Promise<Stripe.Customer> {
    const userBilling = await purchaseService.getUserBillingInfo(userId);
    if (userBilling?.stripe_customer_id) {
      try {
        const existing = await this.stripe.customers.retrieve(userBilling.stripe_customer_id);
        if (!existing.deleted) {
          return existing as Stripe.Customer;
        }
      } catch {}
    }

    const customer = await this.stripe.customers.create({
      email: email.toLowerCase().trim(),
      metadata: {
        userId: String(userId),
      },
    });

    await purchaseService.updateUserSubscription(
      userId,
      userBilling?.subscription_tier || 'free',
      customer.id
    );

    return customer;
  }

  public async createCheckoutSession(
    userId: number,
    email: string,
    planId: string,
    billingPeriod: 'monthly' | 'yearly',
    baseUrl: string
  ): Promise<{ id: string; url: string }> {
    const normalizedPlan = normalizeTierKey(planId);
    const tier = PLAN_TIER_CONFIGS[normalizedPlan];

    if (!tier || normalizedPlan === 'free' || normalizedPlan === 'enterprise') {
      throw new Error(`Plan "${planId}" no disponible para contratación directa.`);
    }

    const isYearly = billingPeriod === 'yearly';
    const unitPrice = isYearly ? tier.priceYearly * 12 : tier.priceMonthly;
    const amountInCents = Math.round(unitPrice * 100);

    const customer = await this.getOrCreateCustomer(userId, email);
    const userBilling = await purchaseService.getUserBillingInfo(userId);
    const previousSubscriptionId = userBilling?.stripe_subscription_id || null;

    const session = await this.stripe.checkout.sessions.create({
      client_reference_id: String(userId),
      customer: customer.id,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              description: tier.tagline,
              name: tier.name,
            },
            recurring: {
              interval: isYearly ? 'year' : 'month',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        billingPeriod,
        planId: tier.id,
        previousSubscriptionId: previousSubscriptionId || '',
        userId: String(userId),
      },
      mode: 'subscription',
      subscription_data: {
        metadata: {
          billingPeriod,
          planId: tier.id,
          previousSubscriptionId: previousSubscriptionId || '',
          userId: String(userId),
        },
      },
      success_url: `${baseUrl}/pricing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?payment=cancelled`,
    });

    if (!session.url) {
      throw new Error('No se pudo generar la URL de Stripe Checkout.');
    }

    await purchaseService.recordPurchase({
      amount_total: unitPrice,
      billing_period: billingPeriod,
      currency: 'USD',
      plan_id: tier.id,
      status: 'pending',
      stripe_customer_id: customer.id,
      stripe_session_id: session.id,
      user_id: userId,
    });

    logger.app.info('Sesión de Stripe Checkout creada', {
      period: billingPeriod,
      plan: tier.id,
      sessionId: session.id,
      userId,
    });

    return { id: session.id, sessionId: session.id, url: session.url };
  }

  public async verifyAndSyncCheckoutSession(
    sessionId: string,
    userId: number
  ): Promise<{ purchase: PurchaseRecord | null; tier: SubscriptionTierId }> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    const sessionUserId = Number(session.metadata?.userId || session.client_reference_id);
    if (sessionUserId && sessionUserId !== userId) {
      throw new Error('La sesión de checkout pertenece a otra cuenta.');
    }

    const planId = normalizeTierKey(session.metadata?.planId || 'pro');
    const billingPeriod = (session.metadata?.billingPeriod as 'monthly' | 'yearly') || 'monthly';
    const amountTotal = (session.amount_total ?? 0) / 100;
    const currency = (session.currency || 'USD').toUpperCase();
    const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as Stripe.Customer)?.id || null;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as Stripe.Subscription)?.id || null;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent as Stripe.PaymentIntent)?.id || null;

    let periodEnd: Date | null = null;
    if (session.subscription && typeof session.subscription === 'object') {
      const sub = session.subscription as Stripe.Subscription;
      const rawEnd = (sub as any).current_period_end;
      if (typeof rawEnd === 'number') {
        periodEnd = new Date(rawEnd * 1000);
      }
    }

    const isPaid = session.payment_status === 'paid' || session.status === 'complete';
    const purchaseStatus = isPaid ? 'completed' : 'pending';

    await purchaseService.recordPurchase({
      amount_total: amountTotal,
      billing_period: billingPeriod,
      currency,
      plan_id: planId,
      status: purchaseStatus,
      stripe_customer_id: customerId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_session_id: session.id,
      stripe_subscription_id: subscriptionId,
      user_id: userId,
    });

    if (isPaid) {
      await purchaseService.updateUserSubscription(
        userId,
        planId,
        customerId,
        subscriptionId,
        'active',
        periodEnd
      );
    }

    const purchase = await purchaseService.getPurchaseBySessionId(sessionId);
    return { purchase, tier: isPaid ? planId : 'free' };
  }

  public constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.webhookSecret
    );
  }

  public async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    const eventKey = `webhook:stripe:processed:${event.id}`;
    let isNew = false;
    try {
      isNew = Boolean(await redis.set(eventKey, '1', 'EX', 86400, 'NX'));
    } catch {}

    if (!isNew) {
      logger.app.info('Evento de Stripe Webhook duplicado omitido', { id: event.id, type: event.type });
      return;
    }

    logger.app.info('Procesando evento de Stripe Webhook', { id: event.id, type: event.type });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.processSuccessfulCheckout(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.processSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.processSubscriptionDeleted(subscription);
        break;
      }
      default:
        break;
    }
  }

  private async processSuccessfulCheckout(session: Stripe.Checkout.Session): Promise<void> {
    const userId = Number(session.metadata?.userId || session.client_reference_id);
    if (!userId) return;

    const planId = normalizeTierKey(session.metadata?.planId || 'pro');
    const billingPeriod = (session.metadata?.billingPeriod as 'monthly' | 'yearly') || 'monthly';
    const amountTotal = (session.amount_total ?? 0) / 100;
    const currency = (session.currency || 'USD').toUpperCase();
    const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as Stripe.Customer)?.id || null;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as Stripe.Subscription)?.id || null;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent as Stripe.PaymentIntent)?.id || null;

    await purchaseService.recordPurchase({
      amount_total: amountTotal,
      billing_period: billingPeriod,
      currency,
      plan_id: planId,
      status: 'completed',
      stripe_customer_id: customerId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_session_id: session.id,
      stripe_subscription_id: subscriptionId,
      user_id: userId,
    });

    await purchaseService.updateUserSubscription(
      userId,
      planId,
      customerId,
      subscriptionId,
      'active'
    );
  }

  private async processSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (!customerId) return;

    const user = await purchaseService.getUserByStripeCustomerId(customerId);
    if (!user) return;

    const rawEnd = (subscription as any).current_period_end;
    const periodEnd = typeof rawEnd === 'number' ? new Date(rawEnd * 1000) : null;
    const status = subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status;

    let planId = user.subscription_tier;
    if (subscription.metadata?.planId) {
      planId = normalizeTierKey(subscription.metadata.planId);
    }

    if (subscription.cancel_at_period_end) {
      await purchaseService.updateUserSubscription(
        user.id,
        planId,
        customerId,
        subscription.id,
        'canceled_at_period_end',
        periodEnd
      );
    } else {
      await purchaseService.updateUserSubscription(
        user.id,
        planId,
        customerId,
        subscription.id,
        status,
        periodEnd
      );
    }
  }

  private async processSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (!customerId) return;

    const user = await purchaseService.getUserByStripeCustomerId(customerId);
    if (!user) return;

    await purchaseService.updateUserSubscription(
      user.id,
      'free',
      customerId,
      null,
      'inactive',
      null
    );
  }

  public async getSubscriptionDetails(userId: number): Promise<BillingDetailsResponse> {
    const billing = await purchaseService.getUserBillingInfo(userId);
    if (!billing) {
      return { hasSubscription: false, success: true, tier: 'free' };
    }

    if (!billing.stripe_subscription_id) {
      return {
        hasSubscription: false,
        status: 'inactive',
        success: true,
        tier: billing.subscription_tier,
      };
    }

    try {
      const sub = await this.stripe.subscriptions.retrieve(billing.stripe_subscription_id);
      const rawEnd = (sub as any).current_period_end;
      const rawStart = (sub as any).current_period_start;
      const item = sub.items?.data?.[0];
      const interval: 'month' | 'year' = item?.price?.recurring?.interval === 'year' ? 'year' : 'month';

      return {
        cancel_at_period_end: Boolean(sub.cancel_at_period_end),
        current_period_end: typeof rawEnd === 'number' ? new Date(rawEnd * 1000).toISOString() : null,
        current_period_start: typeof rawStart === 'number' ? new Date(rawStart * 1000).toISOString() : null,
        customer_id: typeof sub.customer === 'string' ? sub.customer : (sub.customer as any)?.id,
        hasSubscription: sub.status === 'active' || sub.status === 'trialing',
        interval,
        status: sub.status,
        stripe_subscription_id: sub.id,
        subscription_id: sub.id,
        success: true,
        tier: billing.subscription_tier,
      };
    } catch {
      return {
        current_period_end: billing.subscription_period_end ? billing.subscription_period_end.toISOString() : null,
        hasSubscription: billing.subscription_status === 'active',
        status: billing.subscription_status,
        stripe_subscription_id: billing.stripe_subscription_id,
        subscription_id: billing.stripe_subscription_id,
        success: true,
        tier: billing.subscription_tier,
      };
    }
  }

  public async updateSubscriptionRenewal(
    userId: number,
    cancelAtPeriodEnd: boolean
  ): Promise<{ cancel_at_period_end: boolean; current_period_end: string | null }> {
    const billing = await purchaseService.getUserBillingInfo(userId);
    if (!billing?.stripe_subscription_id) {
      throw new Error('No cuentas con una suscripción recurrente activa.');
    }

    const updated = await this.stripe.subscriptions.update(billing.stripe_subscription_id, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    const rawEnd = (updated as any).current_period_end;
    const periodEnd = typeof rawEnd === 'number' ? new Date(rawEnd * 1000) : null;

    await purchaseService.updateUserSubscription(
      userId,
      billing.subscription_tier,
      billing.stripe_customer_id,
      billing.stripe_subscription_id,
      cancelAtPeriodEnd ? 'canceled_at_period_end' : 'active',
      periodEnd
    );

    return {
      cancel_at_period_end: Boolean(updated.cancel_at_period_end),
      current_period_end: periodEnd ? periodEnd.toISOString() : null,
    };
  }

  public async cancelSubscriptionNow(userId: number): Promise<void> {
    const billing = await purchaseService.getUserBillingInfo(userId);
    if (!billing?.stripe_subscription_id) {
      throw new Error('No cuentas con una suscripción activa.');
    }

    try {
      await this.stripe.subscriptions.cancel(billing.stripe_subscription_id);
    } catch {}

    await purchaseService.updateUserSubscription(
      userId,
      'free',
      billing.stripe_customer_id,
      null,
      'inactive',
      null
    );
  }

  public async listPaymentMethods(userId: number): Promise<PaymentMethod[]> {
    const billing = await purchaseService.getUserBillingInfo(userId);
    if (!billing?.stripe_customer_id) {
      return [];
    }

    const res = await this.stripe.paymentMethods.list({
      customer: billing.stripe_customer_id,
      type: 'card',
    });

    const customer = await this.stripe.customers.retrieve(billing.stripe_customer_id);
    const defaultPmId = typeof customer !== 'string' && !customer.deleted ? (customer.invoice_settings?.default_payment_method as string) : null;

    return res.data.map((pm) => ({
      brand: pm.card?.brand || 'card',
      expMonth: pm.card?.exp_month || 0,
      expYear: pm.card?.exp_year || 0,
      id: pm.id,
      isDefault: pm.id === defaultPmId,
      last4: pm.card?.last4 || '••••',
    }));
  }

  public async createSetupIntent(
    userId: number,
    email: string,
    username: string
  ): Promise<{ clientSecret: string }> {
    const customer = await this.getOrCreateCustomer(userId, email);
    const intent = await this.stripe.setupIntents.create({
      customer: customer.id,
      metadata: { userId: String(userId), username },
    });

    if (!intent.client_secret) {
      throw new Error('No se pudo generar el secreto de configuración de pago.');
    }

    return { clientSecret: intent.client_secret };
  }

  public async setDefaultPaymentMethod(userId: number, paymentMethodId: string): Promise<void> {
    const billing = await purchaseService.getUserBillingInfo(userId);
    if (!billing?.stripe_customer_id) {
      throw new Error('Cliente no registrado en Stripe.');
    }

    await this.stripe.customers.update(billing.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  public async detachPaymentMethod(userId: number, paymentMethodId: string): Promise<void> {
    const billing = await purchaseService.getUserBillingInfo(userId);
    if (!billing?.stripe_customer_id) {
      throw new Error('Cliente no registrado en Stripe.');
    }

    await this.stripe.paymentMethods.detach(paymentMethodId);
  }
}

export const stripeService = StripeService.getInstance();
