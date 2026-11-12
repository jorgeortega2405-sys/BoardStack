import { config } from '../config/env.config.js';
import { getTierWeight, normalizeTierKey, PLAN_TIER_CONFIGS } from '../config/plans.config.js';
import { redis } from '../config/redis.config.js';
import { BillingDetailsResponse, OneTimePaymentIntentResponse, PaymentMethod, PurchaseRecord, SubscriptionIntentResponse, SubscriptionTierId } from '../types/subscription.types.js';
import { acquireLock, releaseLock } from '../utils/lock.util.js';
import { logger } from './logger.service.js';
import { purchaseService } from './purchase.service.js';
import { activateTeamSubscription, createPendingOrReuseTeamForCheckout, getTeamById, getTeamByStripeSubscriptionId, updateTeamSubscriptionState } from './team.service.js';
import Stripe from 'stripe';

class StripeService {
  private static instance: StripeService;
  private stripe: Stripe;

  private constructor() {
    this.stripe = new Stripe(config.stripe.secretKey || 'sk_test_placeholder_key', {
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
    const lockKey = `lock:purchase:intent:${userId}`;
    const lockToken = await acquireLock(lockKey, 15);
    if (!lockToken) {
      throw new Error('Hay una solicitud de compra en proceso. Por favor espera unos segundos.');
    }

    try {
      const normalizedPlan = normalizeTierKey(planId);
      const tier = PLAN_TIER_CONFIGS[normalizedPlan];

      if (!tier || normalizedPlan === 'free') {
        throw new Error(`Plan "${planId}" no disponible para contratación directa.`);
      }

      const userBilling = await purchaseService.getUserBillingInfo(userId);
      const userTier = userBilling?.subscription_tier ? normalizeTierKey(userBilling.subscription_tier) : 'free';
      const userWeight = getTierWeight(userTier);
      const targetWeight = getTierWeight(normalizedPlan);

      const isPeriodValid = userBilling?.subscription_period_end
        ? new Date(userBilling.subscription_period_end).getTime() > Date.now()
        : true;
      const isStatusActive = userBilling?.subscription_status === 'active' || userBilling?.subscription_status === 'trialing';
      const hasActivePaidTier = userWeight > 0 && (isStatusActive || isPeriodValid);

      if (hasActivePaidTier) {
        if (userWeight === targetWeight) {
          throw new Error(`Ya cuentas con una suscripción activa al plan ${tier.name}.`);
        }
        if (userWeight > targetWeight) {
          throw new Error(`Tu cuenta ya cuenta con un plan superior (${PLAN_TIER_CONFIGS[userTier].name}), el cual incluye todas las características del plan ${tier.name}.`);
        }
      }

      const isYearly = billingPeriod === 'yearly';
      const unitPrice = isYearly ? tier.priceYearly * 12 : tier.priceMonthly;
      const amountInCents = Math.round(unitPrice * 100);

      const customer = await this.getOrCreateCustomer(userId, email);
      const previousSubscriptionId = userBilling?.stripe_subscription_id || null;

      const idempotencyKey = `cs_${userId}_${tier.id}_${billingPeriod}_${Math.floor(Date.now() / 30000)}`;
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
      }, {
        idempotencyKey,
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

      return { id: session.id, url: session.url };
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  public async createSubscriptionIntent(
    userId: number,
    email: string,
    planId: string,
    billingPeriod: 'monthly' | 'yearly' = 'monthly',
    teamOptions?: { scope?: 'personal' | 'team'; seats?: number; teamId?: number; teamName?: string }
  ): Promise<SubscriptionIntentResponse> {
    const lockKey = `lock:purchase:intent:${userId}`;
    const lockToken = await acquireLock(lockKey, 15);
    if (!lockToken) {
      throw new Error('Hay una solicitud de compra en proceso. Por favor espera unos segundos.');
    }

    try {
      const normalizedPlan = normalizeTierKey(planId);
      const tier = PLAN_TIER_CONFIGS[normalizedPlan];

      if (!tier || normalizedPlan === 'free') {
        throw new Error(`Plan "${planId}" no disponible para contratación directa.`);
      }

      const seats = Math.max(1, Math.min(100, Math.floor(Number(teamOptions?.seats || 1))));
      const isTeamScope =
        normalizedPlan === 'business' &&
        (teamOptions?.scope === 'team' || Boolean(teamOptions?.teamId) || Boolean(teamOptions?.teamName?.trim()) || seats > 1);

      if (!isTeamScope) {
        const userBilling = await purchaseService.getUserBillingInfo(userId);
        const userTier = userBilling?.subscription_tier ? normalizeTierKey(userBilling.subscription_tier) : 'free';
        const userWeight = getTierWeight(userTier);
        const targetWeight = getTierWeight(normalizedPlan);

        const isPeriodValid = userBilling?.subscription_period_end
          ? new Date(userBilling.subscription_period_end).getTime() > Date.now()
          : true;
        const isStatusActive = userBilling?.subscription_status === 'active' || userBilling?.subscription_status === 'trialing';
        const hasActivePaidTier = userWeight > 0 && (isStatusActive || isPeriodValid);

        if (hasActivePaidTier) {
          if (userWeight === targetWeight) {
            throw new Error(`Ya cuentas con una suscripción activa al plan ${tier.name}.`);
          }
          if (userWeight > targetWeight) {
            throw new Error(`Tu cuenta ya cuenta con un plan superior (${PLAN_TIER_CONFIGS[userTier].name}), el cual incluye todas las características del plan ${tier.name}.`);
          }
        }
      }

      const isYearly = billingPeriod === 'yearly';
      const priceId = isYearly ? tier.stripePriceYearlyId : tier.stripePriceMonthlyId;
      if (!priceId) {
        throw new Error(`ID de precio de Stripe no configurado para el plan ${tier.name}.`);
      }

      const unitPrice = isYearly ? tier.priceYearly * 12 : tier.priceMonthly;
      const customer = await this.getOrCreateCustomer(userId, email);

      let targetTeamId: number | null = null;
      let targetTeamName: string | null = null;
      if (isTeamScope) {
        if (teamOptions?.teamId) {
          const existingTeam = await getTeamById(teamOptions.teamId);
          if (!existingTeam || existingTeam.owner_id !== userId) {
            throw new Error('No tienes permisos para administrar la suscripción de este equipo.');
          }
          targetTeamId = existingTeam.id;
          targetTeamName = existingTeam.name;
        } else {
          const createdTeam = await createPendingOrReuseTeamForCheckout({
            billingPeriod,
            ownerId: userId,
            seats,
            stripeCustomerId: customer.id,
            teamName: teamOptions?.teamName || '',
          });
          targetTeamId = createdTeam.id;
          targetTeamName = createdTeam.name;
        }
      }

      try {
        const existingIncomplete = await this.stripe.subscriptions.list({
          customer: customer.id,
          status: 'incomplete',
          limit: 5,
        });
        for (const sub of existingIncomplete.data) {
          await this.stripe.subscriptions.cancel(sub.id).catch(() => {});
        }
      } catch {}

      const idempotencyKey = `sub_${userId}_${tier.id}_${billingPeriod}_${targetTeamId || 'p'}_${seats}_${Math.floor(Date.now() / 30000)}`;
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId, quantity: isTeamScope ? seats : 1 }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          billingPeriod,
          planId: tier.id,
          scope: isTeamScope ? 'team' : 'personal',
          teamId: targetTeamId ? String(targetTeamId) : '',
          teamName: targetTeamName || '',
          teamSeats: String(isTeamScope ? seats : 1),
          userId: String(userId),
        },
      }, {
        idempotencyKey,
      });

      const invoice = subscription.latest_invoice as any;
      const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | undefined;
      const clientSecret = paymentIntent?.client_secret;

      if (!clientSecret || !paymentIntent?.id) {
        throw new Error('No se pudo inicializar la pasarela de pagos con Stripe Elements.');
      }

      const effectiveSeats = isTeamScope ? seats : 1;
      const totalAmount = Math.round(unitPrice * effectiveSeats * 100) / 100;

      await purchaseService.recordPurchase({
        amount_total: totalAmount,
        billing_period: billingPeriod,
        currency: 'USD',
        plan_id: tier.id,
        purchase_scope: isTeamScope ? 'team' : 'personal',
        status: 'pending',
        stripe_customer_id: customer.id,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_session_id: paymentIntent.id,
        stripe_subscription_id: subscription.id,
        team_id: targetTeamId,
        team_seats: effectiveSeats,
        user_id: userId,
      });

      logger.app.info('Intento de suscripción con Stripe Elements creado', {
        billingPeriod,
        paymentIntentId: paymentIntent.id,
        plan: tier.id,
        seats: effectiveSeats,
        subscriptionId: subscription.id,
        teamId: targetTeamId,
        userId,
      });

      return {
        amount: totalAmount,
        billingPeriod,
        clientSecret,
        currency: 'USD',
        paymentIntentId: paymentIntent.id,
        planId: tier.id,
        planName: tier.name,
        publishableKey: config.stripe.publishableKey,
        seats: effectiveSeats,
        subscriptionId: subscription.id,
        success: true,
        teamId: targetTeamId,
        teamName: targetTeamName,
      };
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  public getStripeClient(): Stripe {
    return this.stripe;
  }

  public async confirmSubscriptionPayment(
    userId: number,
    subscriptionId: string,
    paymentIntentId?: string
  ): Promise<{ seats?: number; subscriptionId: string; success: boolean; teamId?: number | null; tier: SubscriptionTierId }> {
    const lockKey = `lock:purchase:confirm:${userId}`;
    const lockToken = await acquireLock(lockKey, 20);
    if (!lockToken) {
      throw new Error('Se está procesando la confirmación de tu suscripción. Por favor espera.');
    }

    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['customer', 'latest_invoice.payment_intent'],
      });

      const subUserId = Number(subscription.metadata?.userId);
      if (!subUserId || subUserId !== userId) {
        throw new Error('La suscripción no corresponde a la cuenta del usuario autenticado.');
      }

      const rawPlan = subscription.metadata?.planId || 'pro';
      const planId = normalizeTierKey(rawPlan);

      const rawEnd = (subscription as any).current_period_end;
      const periodEndDate = typeof rawEnd === 'number' ? new Date(rawEnd * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : (subscription.customer as any)?.id;

      const subStatus = subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status;

      const firstItem = subscription.items?.data?.[0];
      const unitAmount = firstItem?.price?.unit_amount || 0;
      const quantity = Math.max(1, Number(subscription.metadata?.teamSeats || firstItem?.quantity || 1));
      const amountTotal = (unitAmount * quantity) / 100;

      const metaTeamId = Number(subscription.metadata?.teamId || 0);
      const isTeamScope = subscription.metadata?.scope === 'team' || metaTeamId > 0;

      if (isTeamScope && metaTeamId > 0) {
        const teamRecord = await getTeamById(metaTeamId);
        const prevTeamSubId = teamRecord?.stripe_subscription_id;
        if (prevTeamSubId && prevTeamSubId !== subscription.id) {
          await this.stripe.subscriptions.cancel(prevTeamSubId).catch(() => {});
        }

        await purchaseService.fulfillPurchase(
          userId,
          planId,
          {
            amount_total: amountTotal,
            billing_period: (subscription.metadata?.billingPeriod as any) || 'monthly',
            currency: (subscription.currency || 'USD').toUpperCase(),
            plan_id: planId,
            purchase_scope: 'team',
            status: 'completed',
            stripe_customer_id: customerId,
            stripe_payment_intent_id: paymentIntentId || null,
            stripe_session_id: paymentIntentId || subscription.id,
            stripe_subscription_id: subscription.id,
            team_id: metaTeamId,
            team_seats: quantity,
            user_id: userId,
          },
          periodEndDate,
          subscription.id,
          subStatus
        );

        await activateTeamSubscription({
          billingPeriod: (subscription.metadata?.billingPeriod as string) || 'monthly',
          periodEnd: periodEndDate,
          seats: quantity,
          stripeCustomerId: customerId || null,
          stripeSubscriptionId: subscription.id,
          teamId: metaTeamId,
        });

        const ownerBilling = await purchaseService.getUserBillingInfo(userId);
        if (!ownerBilling || ownerBilling.subscription_tier !== 'business' || ownerBilling.subscription_status !== 'active') {
          await purchaseService.updateUserSubscription(
            userId,
            'business',
            customerId || null,
            subscription.id,
            subStatus,
            periodEndDate
          );
        }

        logger.security.info('Suscripción de equipo confirmada y activada mediante Stripe Elements', {
          periodEnd: periodEndDate,
          plan: planId,
          seats: quantity,
          status: subscription.status,
          subscriptionId: subscription.id,
          teamId: metaTeamId,
          userId,
        });

        return {
          seats: quantity,
          subscriptionId: subscription.id,
          success: true,
          teamId: metaTeamId,
          tier: planId,
        };
      }

      const userBilling = await purchaseService.getUserBillingInfo(userId);
      const previousSubId = userBilling?.stripe_subscription_id;
      if (previousSubId && previousSubId !== subscription.id) {
        try {
          await this.stripe.subscriptions.cancel(previousSubId);
          logger.security.info('Suscripción anterior cancelada automáticamente para evitar cobro duplicado', {
            newSubscriptionId: subscription.id,
            previousSubId,
            userId,
          });
        } catch (err) {
          logger.security.warn('No se pudo cancelar la suscripción anterior en Stripe', {
            error: err,
            previousSubId,
            userId,
          });
        }
      }

      await purchaseService.fulfillPurchase(
        userId,
        planId,
        {
          amount_total: amountTotal,
          billing_period: (subscription.metadata?.billingPeriod as any) || 'monthly',
          currency: (subscription.currency || 'USD').toUpperCase(),
          plan_id: planId,
          purchase_scope: 'personal',
          status: 'completed',
          stripe_customer_id: customerId,
          stripe_payment_intent_id: paymentIntentId || null,
          stripe_session_id: paymentIntentId || subscription.id,
          stripe_subscription_id: subscription.id,
          user_id: userId,
        },
        periodEndDate,
        subscription.id,
        subStatus
      );

      logger.security.info('Suscripción confirmada y activada mediante Stripe Elements', {
        periodEnd: periodEndDate,
        plan: planId,
        status: subscription.status,
        subscriptionId: subscription.id,
        userId,
      });

      return {
        subscriptionId: subscription.id,
        success: true,
        tier: planId,
      };
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  public async createOneTimePaymentIntent(
    userId: number,
    email: string,
    planId: string,
    duration: '1_month' | '12_months' = '1_month',
    teamOptions?: { scope?: 'personal' | 'team'; seats?: number; teamId?: number; teamName?: string }
  ): Promise<OneTimePaymentIntentResponse> {
    const lockKey = `lock:purchase:intent:${userId}`;
    const lockToken = await acquireLock(lockKey, 15);
    if (!lockToken) {
      throw new Error('Hay una solicitud de compra en proceso. Por favor espera unos segundos.');
    }

    try {
      const normalizedPlan = normalizeTierKey(planId);
      const tier = PLAN_TIER_CONFIGS[normalizedPlan];

      if (!tier || normalizedPlan === 'free') {
        throw new Error(`Plan "${planId}" no disponible para contratación directa.`);
      }

      const seats = Math.max(1, Math.min(100, Math.floor(Number(teamOptions?.seats || 1))));
      const isTeamScope =
        normalizedPlan === 'business' &&
        (teamOptions?.scope === 'team' || Boolean(teamOptions?.teamId) || Boolean(teamOptions?.teamName?.trim()) || seats > 1);

      if (!isTeamScope) {
        const userBilling = await purchaseService.getUserBillingInfo(userId);
        if (userBilling?.subscription_status === 'active' && userBilling?.stripe_subscription_id) {
          throw new Error('Ya cuentas con una suscripción recurrente activa. Administra tu suscripción antes de adquirir pases de pago único.');
        }

        const userTier = userBilling?.subscription_tier ? normalizeTierKey(userBilling.subscription_tier) : 'free';
        const userWeight = getTierWeight(userTier);
        const targetWeight = getTierWeight(normalizedPlan);

        const isPeriodValid = userBilling?.subscription_period_end
          ? new Date(userBilling.subscription_period_end).getTime() > Date.now()
          : true;
        const isStatusActive = userBilling?.subscription_status === 'active' || userBilling?.subscription_status === 'trialing';
        const hasActivePaidTier = userWeight > 0 && (isStatusActive || isPeriodValid);

        if (hasActivePaidTier) {
          if (userWeight === targetWeight) {
            throw new Error(`Ya cuentas con el plan ${tier.name} activo. No es necesario adquirir un pase adicional.`);
          }
          if (userWeight > targetWeight) {
            throw new Error(`Tu cuenta ya cuenta con un plan superior (${PLAN_TIER_CONFIGS[userTier].name}).`);
          }
        }
      }

      const isYearly = duration === '12_months';
      const unitPrice = isYearly ? tier.priceYearly * 12 : tier.priceMonthly;
      const effectiveSeats = isTeamScope ? seats : 1;
      const totalAmount = Math.round(unitPrice * effectiveSeats * 100) / 100;
      const amountInCents = Math.round(totalAmount * 100);

      const customer = await this.getOrCreateCustomer(userId, email);

      let targetTeamId: number | null = null;
      let targetTeamName: string | null = null;
      if (isTeamScope) {
        if (teamOptions?.teamId) {
          const existingTeam = await getTeamById(teamOptions.teamId);
          if (!existingTeam || existingTeam.owner_id !== userId) {
            throw new Error('No tienes permisos para administrar el pago de este equipo.');
          }
          targetTeamId = existingTeam.id;
          targetTeamName = existingTeam.name;
        } else {
          const createdTeam = await createPendingOrReuseTeamForCheckout({
            billingPeriod: isYearly ? 'one_time_yearly' : 'one_time_monthly',
            ownerId: userId,
            seats: effectiveSeats,
            stripeCustomerId: customer.id,
            teamName: teamOptions?.teamName || '',
          });
          targetTeamId = createdTeam.id;
          targetTeamName = createdTeam.name;
        }
      }

      const idempotencyKey = `pi_${userId}_${tier.id}_${duration}_${targetTeamId || 'p'}_${effectiveSeats}_${Math.floor(Date.now() / 30000)}`;
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        customer: customer.id,
        description: `BoardPDF ${tier.name} - Pago único (${isYearly ? '12 meses' : '1 mes'}${isTeamScope ? `, ${effectiveSeats} asientos` : ''})`,
        metadata: {
          billingType: 'one_time',
          duration,
          planId: tier.id,
          scope: isTeamScope ? 'team' : 'personal',
          teamId: targetTeamId ? String(targetTeamId) : '',
          teamName: targetTeamName || '',
          teamSeats: String(effectiveSeats),
          userId: String(userId),
        },
        payment_method_types: ['card'],
      } as any, {
        idempotencyKey,
      });

      if (!paymentIntent.client_secret) {
        throw new Error('No se pudo inicializar la pasarela de pago para pago único.');
      }

      await purchaseService.recordPurchase({
        amount_total: totalAmount,
        billing_period: isYearly ? 'one_time_yearly' : 'one_time_monthly',
        currency: 'USD',
        plan_id: tier.id,
        purchase_scope: isTeamScope ? 'team' : 'personal',
        status: 'pending',
        stripe_customer_id: customer.id,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_session_id: paymentIntent.id,
        team_id: targetTeamId,
        team_seats: effectiveSeats,
        user_id: userId,
      });

      logger.app.info('Intento de pago único creado', {
        amount: totalAmount,
        duration,
        paymentIntentId: paymentIntent.id,
        plan: tier.id,
        seats: effectiveSeats,
        teamId: targetTeamId,
        userId,
      });

      return {
        amount: totalAmount,
        billingType: 'one_time',
        clientSecret: paymentIntent.client_secret,
        currency: 'USD',
        duration,
        paymentIntentId: paymentIntent.id,
        planId: tier.id,
        planName: tier.name,
        publishableKey: config.stripe.publishableKey,
        seats: effectiveSeats,
        success: true,
        teamId: targetTeamId,
        teamName: targetTeamName,
      };
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  public async confirmOneTimePayment(
    userId: number,
    paymentIntentId: string
  ): Promise<{ periodEnd: Date; planId: SubscriptionTierId; seats?: number; success: boolean; teamId?: number | null }> {
    const lockKey = `lock:purchase:confirm:${userId}`;
    const lockToken = await acquireLock(lockKey, 20);
    if (!lockToken) {
      throw new Error('Se está procesando la confirmación de tu pago. Por favor espera.');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      const piUserId = Number(paymentIntent.metadata?.userId);
      if (!piUserId || piUserId !== userId) {
        throw new Error('El intento de pago no corresponde a la cuenta del usuario autenticado.');
      }

      if (paymentIntent.status !== 'succeeded') {
        throw new Error('El pago aún no se ha completado.');
      }

      const existingPurchase = await purchaseService.getPurchaseBySessionId(paymentIntentId);
      if (existingPurchase && existingPurchase.user_id !== userId) {
        throw new Error('La transacción no corresponde a este usuario.');
      }

      const rawPlan = paymentIntent.metadata?.planId || 'pro';
      const planId = normalizeTierKey(rawPlan);
      const duration = paymentIntent.metadata?.duration || '1_month';
      const isYearly = duration === '12_months';
      const metaTeamId = Number(paymentIntent.metadata?.teamId || 0);
      const seats = Math.max(1, Number(paymentIntent.metadata?.teamSeats || 1));
      const isTeamScope = paymentIntent.metadata?.scope === 'team' || metaTeamId > 0;
      const customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : null;
      const durationDays = isYearly ? 365 : 30;

      if (isTeamScope && metaTeamId > 0) {
        const teamRecord = await getTeamById(metaTeamId);
        let baseTs = Date.now();
        if (teamRecord?.subscription_status === 'active' && teamRecord.subscription_period_end) {
          const endMs = new Date(teamRecord.subscription_period_end).getTime();
          if (endMs > baseTs) baseTs = endMs;
        }
        const periodEndDate = new Date(baseTs + durationDays * 24 * 60 * 60 * 1000);

        if (existingPurchase?.status !== 'completed') {
          await purchaseService.fulfillPurchase(
            userId,
            planId,
            {
              amount_total: paymentIntent.amount / 100,
              billing_period: isYearly ? 'one_time_yearly' : 'one_time_monthly',
              currency: (paymentIntent.currency || 'USD').toUpperCase(),
              plan_id: planId,
              purchase_scope: 'team',
              status: 'completed',
              stripe_customer_id: customerId,
              stripe_payment_intent_id: paymentIntent.id,
              stripe_session_id: paymentIntent.id,
              team_id: metaTeamId,
              team_seats: seats,
              user_id: userId,
            },
            periodEndDate,
            null,
            'active'
          );
        }

        await activateTeamSubscription({
          billingPeriod: isYearly ? 'one_time_yearly' : 'one_time_monthly',
          periodEnd: periodEndDate,
          seats,
          stripeCustomerId: customerId,
          stripeSubscriptionId: null,
          teamId: metaTeamId,
        });

        const ownerBilling = await purchaseService.getUserBillingInfo(userId);
        if (!ownerBilling || ownerBilling.subscription_tier !== 'business' || ownerBilling.subscription_status !== 'active') {
          await purchaseService.updateUserSubscription(
            userId,
            'business',
            customerId,
            null,
            'active',
            periodEndDate
          );
        }

        return {
          periodEnd: periodEndDate,
          planId,
          seats,
          success: true,
          teamId: metaTeamId,
        };
      }

      const userBilling = await purchaseService.getUserBillingInfo(userId);

      if (existingPurchase?.status === 'completed') {
        return {
          periodEnd: userBilling?.subscription_period_end || new Date(),
          planId,
          success: true,
        };
      }

      let baseTimestamp = Date.now();
      if (
        userBilling &&
        userBilling.subscription_tier === planId &&
        userBilling.subscription_period_end &&
        new Date(userBilling.subscription_period_end).getTime() > baseTimestamp
      ) {
        baseTimestamp = new Date(userBilling.subscription_period_end).getTime();
      }
      const periodEndDate = new Date(baseTimestamp + durationDays * 24 * 60 * 60 * 1000);

      const fulfillment = await purchaseService.fulfillPurchase(
        userId,
        planId,
        {
          amount_total: paymentIntent.amount / 100,
          billing_period: isYearly ? 'one_time_yearly' : 'one_time_monthly',
          currency: (paymentIntent.currency || 'USD').toUpperCase(),
          plan_id: planId,
          purchase_scope: 'personal',
          status: 'completed',
          stripe_customer_id: customerId,
          stripe_payment_intent_id: paymentIntent.id,
          stripe_session_id: paymentIntent.id,
          user_id: userId,
        },
        periodEndDate,
        null,
        'active'
      );

      if (fulfillment.alreadyCompleted) {
        const refreshed = await purchaseService.getUserBillingInfo(userId);
        return {
          periodEnd: refreshed?.subscription_period_end || periodEndDate,
          planId,
          success: true,
        };
      }

      logger.security.info('Suscripción de pago único activada exitosamente', {
        duration,
        paymentIntentId,
        periodEnd: periodEndDate,
        plan: planId,
        userId,
      });

      return {
        periodEnd: periodEndDate,
        planId,
        success: true,
      };
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  public async verifyAndSyncCheckoutSession(
    sessionId: string,
    userId: number
  ): Promise<{ purchase: PurchaseRecord | null; tier: SubscriptionTierId }> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    const sessionUserId = Number(session.metadata?.userId || session.client_reference_id);
    if (!sessionUserId || sessionUserId !== userId) {
      throw new Error('La sesión de checkout no corresponde al usuario autenticado.');
    }

    const planId = normalizeTierKey(session.metadata?.planId || 'pro');
    const billingPeriod = (session.metadata?.billingPeriod as 'monthly' | 'yearly') || 'monthly';
    const scope = session.metadata?.scope === 'team' ? 'team' : 'personal';
    const metaTeamId = Number(session.metadata?.teamId || 0);
    const metaSeats = Math.max(1, Number(session.metadata?.seats || 1));
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
    const isTeamPurchase = scope === 'team' && metaTeamId > 0;

    if (isPaid) {
      if (!isTeamPurchase) {
        const userBilling = await purchaseService.getUserBillingInfo(userId);
        const previousSubId = userBilling?.stripe_subscription_id;
        if (previousSubId && subscriptionId && previousSubId !== subscriptionId) {
          try {
            await this.stripe.subscriptions.cancel(previousSubId);
          } catch {}
        }
      }

      await purchaseService.fulfillPurchase(
        userId,
        planId,
        {
          amount_total: amountTotal,
          billing_period: billingPeriod,
          currency,
          plan_id: planId,
          purchase_scope: isTeamPurchase ? 'team' : 'personal',
          status: 'completed',
          stripe_customer_id: customerId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_session_id: session.id,
          stripe_subscription_id: subscriptionId,
          team_id: isTeamPurchase ? metaTeamId : null,
          team_seats: isTeamPurchase ? metaSeats : null,
          user_id: userId,
        },
        periodEnd,
        subscriptionId,
        'active'
      );

      if (isTeamPurchase) {
        await activateTeamSubscription({
          billingPeriod,
          periodEnd,
          seats: metaSeats,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          teamId: metaTeamId,
        });
      }
    } else {
      await purchaseService.recordPurchase({
        amount_total: amountTotal,
        billing_period: billingPeriod,
        currency,
        plan_id: planId,
        purchase_scope: isTeamPurchase ? 'team' : 'personal',
        status: 'pending',
        stripe_customer_id: customerId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_session_id: session.id,
        stripe_subscription_id: subscriptionId,
        team_id: isTeamPurchase ? metaTeamId : null,
        team_seats: isTeamPurchase ? metaSeats : null,
        user_id: userId,
      });
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
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.processInvoicePaymentSucceeded(invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.processInvoicePaymentFailed(invoice);
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.processPaymentIntentSucceeded(paymentIntent);
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
    const scope = session.metadata?.scope === 'team' ? 'team' : 'personal';
    const metaTeamId = Number(session.metadata?.teamId || 0);
    const metaSeats = Math.max(1, Number(session.metadata?.seats || 1));
    const isTeamPurchase = scope === 'team' && metaTeamId > 0;
    const amountTotal = (session.amount_total ?? 0) / 100;
    const currency = (session.currency || 'USD').toUpperCase();
    const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as Stripe.Customer)?.id || null;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as Stripe.Subscription)?.id || null;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent as Stripe.PaymentIntent)?.id || null;

    let periodEnd: Date | null = null;
    if (session.subscription) {
      try {
        const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any).id;
        const sub = await this.stripe.subscriptions.retrieve(subId);
        const rawEnd = (sub as any).current_period_end;
        if (typeof rawEnd === 'number') {
          periodEnd = new Date(rawEnd * 1000);
        }
      } catch {}
    }

    await purchaseService.fulfillPurchase(
      userId,
      planId,
      {
        amount_total: amountTotal,
        billing_period: billingPeriod,
        currency,
        plan_id: planId,
        purchase_scope: isTeamPurchase ? 'team' : 'personal',
        status: 'completed',
        stripe_customer_id: customerId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_session_id: session.id,
        stripe_subscription_id: subscriptionId,
        team_id: isTeamPurchase ? metaTeamId : null,
        team_seats: isTeamPurchase ? metaSeats : null,
        user_id: userId,
      },
      periodEnd,
      subscriptionId,
      'active'
    );

    if (isTeamPurchase) {
      await activateTeamSubscription({
        billingPeriod,
        periodEnd,
        seats: metaSeats,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        teamId: metaTeamId,
      });
    }
  }

  private async processInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const subscriptionId = typeof (invoice as any).subscription === 'string'
      ? (invoice as any).subscription
      : (invoice as any).subscription?.id;

    if (!subscriptionId) return;

    let periodEnd: Date | null = null;
    let planId: SubscriptionTierId = 'pro';
    let subTeamId = 0;
    let subSeats = 1;
    let billingPeriod: 'monthly' | 'yearly' = 'monthly';

    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const rawEnd = (subscription as any).current_period_end;
      if (typeof rawEnd === 'number') {
        periodEnd = new Date(rawEnd * 1000);
      }
      if (subscription.metadata?.planId) {
        planId = normalizeTierKey(subscription.metadata.planId);
      }
      if (subscription.metadata?.billingPeriod === 'yearly') {
        billingPeriod = 'yearly';
      }
      subTeamId = Number(subscription.metadata?.teamId || 0);
      const item = subscription.items?.data?.[0];
      subSeats = Math.max(1, Number(item?.quantity || subscription.metadata?.teamSeats || 1));
    } catch {}

    const teamRecord = subTeamId > 0
      ? await getTeamById(subTeamId)
      : await getTeamByStripeSubscriptionId(subscriptionId);

    const amountPaid = (invoice.amount_paid ?? 0) / 100;
    const currency = (invoice.currency || 'USD').toUpperCase();
    const paymentIntentId = typeof (invoice as any).payment_intent === 'string' ? (invoice as any).payment_intent : null;

    if (teamRecord) {
      await purchaseService.fulfillPurchase(
        teamRecord.owner_id,
        'business',
        {
          amount_total: amountPaid,
          billing_period: billingPeriod,
          currency,
          plan_id: 'business',
          purchase_scope: 'team',
          status: 'completed',
          stripe_customer_id: customerId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_session_id: invoice.id,
          stripe_subscription_id: subscriptionId,
          team_id: teamRecord.id,
          team_seats: subSeats,
          user_id: teamRecord.owner_id,
        },
        periodEnd,
        subscriptionId,
        'active'
      );

      await activateTeamSubscription({
        billingPeriod,
        periodEnd: periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        seats: subSeats,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        teamId: teamRecord.id,
      });
      return;
    }

    const user = await purchaseService.getUserByStripeCustomerId(customerId);
    if (!user) return;
    if (!planId || planId === 'free') {
      planId = user.subscription_tier;
    }

    await purchaseService.fulfillPurchase(
      user.id,
      planId,
      {
        amount_total: amountPaid,
        billing_period: billingPeriod,
        currency,
        plan_id: planId,
        purchase_scope: 'personal',
        status: 'completed',
        stripe_customer_id: customerId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_session_id: invoice.id,
        stripe_subscription_id: subscriptionId,
        user_id: user.id,
      },
      periodEnd,
      subscriptionId,
      'active'
    );
  }

  private async processInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const subscriptionId = typeof (invoice as any).subscription === 'string'
      ? (invoice as any).subscription
      : (invoice as any).subscription?.id;

    if (subscriptionId) {
      const teamRecord = await getTeamByStripeSubscriptionId(subscriptionId);
      if (teamRecord) {
        await updateTeamSubscriptionState(teamRecord.id, {
          subscriptionStatus: 'past_due',
        });
        logger.security.warn('Pago recurrente fallido en Stripe para equipo', {
          invoiceId: invoice.id,
          teamId: teamRecord.id,
        });
        return;
      }
    }

    const user = await purchaseService.getUserByStripeCustomerId(customerId);
    if (!user) return;

    await purchaseService.updateUserSubscription(
      user.id,
      user.subscription_tier,
      customerId,
      user.stripe_subscription_id,
      'past_due'
    );

    logger.security.warn('Pago recurrente fallido en Stripe para usuario', {
      invoiceId: invoice.id,
      userId: user.id,
    });
  }

  private async processPaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = Number(paymentIntent.metadata?.userId);
    if (!userId) return;

    if (paymentIntent.metadata?.billingType === 'one_time') {
      try {
        await this.confirmOneTimePayment(userId, paymentIntent.id);
      } catch (err) {
        logger.app.info('Confirmación de pago único por webhook ya procesada', {
          paymentIntentId: paymentIntent.id,
          userId,
        });
      }
    }
  }

  private async processSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (!customerId) return;

    const rawEnd = (subscription as any).current_period_end;
    const periodEnd = typeof rawEnd === 'number' ? new Date(rawEnd * 1000) : null;
    const status = subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status;

    const metaTeamId = Number(subscription.metadata?.teamId || 0);
    const teamRecord = metaTeamId > 0
      ? await getTeamById(metaTeamId)
      : await getTeamByStripeSubscriptionId(subscription.id);

    if (teamRecord) {
      const itemQuantity = Math.max(1, Number(subscription.items?.data?.[0]?.quantity || teamRecord.seat_limit || 1));
      await updateTeamSubscriptionState(teamRecord.id, {
        seatLimit: itemQuantity,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionPeriodEnd: periodEnd,
        subscriptionStatus: status,
      });
      return;
    }

    const user = await purchaseService.getUserByStripeCustomerId(customerId);
    if (!user) return;

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

    const metaTeamId = Number(subscription.metadata?.teamId || 0);
    const teamRecord = metaTeamId > 0
      ? await getTeamById(metaTeamId)
      : await getTeamByStripeSubscriptionId(subscription.id);

    if (teamRecord) {
      await updateTeamSubscriptionState(teamRecord.id, {
        stripeSubscriptionId: null,
        subscriptionStatus: 'canceled',
      });
      return;
    }

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

    const purchases = await purchaseService.getPurchasesByUserId(userId);
    const latestPurchase = purchases.find((p) => p.status === 'completed') || purchases[0];

    const isNonFree = Boolean(billing.subscription_tier && billing.subscription_tier !== 'free');
    const isOneTime = Boolean(
      latestPurchase?.billing_period?.includes('one_time') ||
      (!billing.stripe_subscription_id && isNonFree)
    );
    const periodEndIso = billing.subscription_period_end ? billing.subscription_period_end.toISOString() : null;

    if (!billing.stripe_subscription_id) {
      const isActive = isNonFree && (billing.subscription_status === 'active' || Boolean(billing.subscription_period_end && new Date(billing.subscription_period_end).getTime() > Date.now()));
      const isYearly = latestPurchase?.billing_period === 'one_time_yearly' || latestPurchase?.billing_period === 'yearly';

      return {
        amount: latestPurchase ? Number(latestPurchase.amount_total) : undefined,
        billing_period: latestPurchase?.billing_period || (isYearly ? 'one_time_yearly' : 'one_time_monthly'),
        cancel_at_period_end: false,
        current_period_end: periodEndIso,
        customer_id: billing.stripe_customer_id,
        hasSubscription: isActive,
        interval: isYearly ? 'year' : 'month',
        is_one_time: true,
        status: isActive ? 'active' : 'inactive',
        stripe_subscription_id: null,
        subscription_id: null,
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
      const unitAmount = item?.price?.unit_amount;
      const quantity = Math.max(1, Number(item?.quantity || 1));

      return {
        amount: typeof unitAmount === 'number'
          ? Math.round(((unitAmount * quantity) / 100) * 100) / 100
          : (latestPurchase ? Number(latestPurchase.amount_total) : undefined),
        billing_period: (latestPurchase?.billing_period as any) || (interval === 'year' ? 'yearly' : 'monthly'),
        cancel_at_period_end: Boolean(sub.cancel_at_period_end),
        current_period_end: typeof rawEnd === 'number' ? new Date(rawEnd * 1000).toISOString() : periodEndIso,
        current_period_start: typeof rawStart === 'number' ? new Date(rawStart * 1000).toISOString() : null,
        customer_id: typeof sub.customer === 'string' ? sub.customer : (sub.customer as any)?.id,
        hasSubscription: sub.status === 'active' || sub.status === 'trialing',
        interval,
        is_one_time: false,
        status: sub.status,
        stripe_subscription_id: sub.id,
        subscription_id: sub.id,
        success: true,
        tier: billing.subscription_tier,
      };
    } catch {
      const isYearly = latestPurchase?.billing_period === 'yearly' || latestPurchase?.billing_period === 'one_time_yearly';
      const isActive = billing.subscription_status === 'active' || isNonFree;

      return {
        amount: latestPurchase ? Number(latestPurchase.amount_total) : undefined,
        billing_period: latestPurchase?.billing_period || (isYearly ? 'yearly' : 'monthly'),
        cancel_at_period_end: false,
        current_period_end: periodEndIso,
        customer_id: billing.stripe_customer_id,
        hasSubscription: isActive,
        interval: isYearly ? 'year' : 'month',
        is_one_time: isOneTime,
        status: billing.subscription_status || 'active',
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

const stripeService = StripeService.getInstance();

export { StripeService, stripeService };
