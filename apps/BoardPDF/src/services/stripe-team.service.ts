import { getDbPool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { PLAN_TIER_CONFIGS } from '../config/plans.config.js';
import { BillingDetailsResponse } from '../types/subscription.types.js';
import { TeamSeatPaymentMethodPreview, TeamSeatPreview } from '../types/team.types.js';
import { verifyPassword } from './auth.service.js';
import { logger } from './logger.service.js';
import { purchaseService } from './purchase.service.js';
import { stripeService } from './stripe.service.js';
import { getTeamById, getTeamMembersAndInvitations, TeamServiceError, updateTeamSubscriptionState } from './team.service.js';
import { trackSecurityEvent } from './telemetry.service.js';
import type { RowDataPacket } from 'mysql2';
import Stripe from 'stripe';

function resolveTeamUnitPrice(billingPeriod: string | null): number {
  const business = PLAN_TIER_CONFIGS.business;
  if (billingPeriod === 'yearly' || billingPeriod === 'one_time_yearly') {
    return Math.round(business.priceYearly * 12 * 100) / 100;
  }
  return business.priceMonthly;
}

async function resolveDefaultCardPreview(
  customerId: string | null,
  subscriptionId: string | null
): Promise<TeamSeatPaymentMethodPreview | null> {
  if (!customerId && !subscriptionId) {
    return null;
  }
  try {
    const stripe = stripeService.getStripeClient();
    let resolvedPm: Stripe.PaymentMethod | null = null;

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method'],
      });
      if (sub.default_payment_method && typeof sub.default_payment_method === 'object') {
        resolvedPm = sub.default_payment_method as Stripe.PaymentMethod;
      } else if (typeof sub.default_payment_method === 'string') {
        resolvedPm = await stripe.paymentMethods.retrieve(sub.default_payment_method);
      }
    }

    if (!resolvedPm && customerId) {
      const customer = await stripe.customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method'],
      });
      if (typeof customer !== 'string' && !customer.deleted) {
        const custPm = customer.invoice_settings?.default_payment_method;
        if (custPm && typeof custPm === 'object') {
          resolvedPm = custPm as Stripe.PaymentMethod;
        } else if (typeof custPm === 'string') {
          resolvedPm = await stripe.paymentMethods.retrieve(custPm);
        }
      }
    }

    if (resolvedPm?.card) {
      return {
        brand: resolvedPm.card.brand || 'card',
        expMonth: resolvedPm.card.exp_month || 0,
        expYear: resolvedPm.card.exp_year || 0,
        last4: resolvedPm.card.last4 || '••••',
      };
    }
  } catch (err) {
    logger.app.warn('No se pudo obtener la tarjeta predeterminada del equipo en Stripe', err);
  }
  return null;
}

async function verifySeatActionSecurity(
  teamId: number,
  actingUserId: number,
  actingUserEmail: string,
  options: {
    confirmed?: boolean;
    currentPassword?: string;
    ip?: string;
    userAgent?: string;
    verificationEmail?: string;
  }
): Promise<void> {
  if (!options.confirmed) {
    throw new TeamServiceError(
      'CONFIRMATION_REQUIRED',
      'Debes confirmar explícitamente la modificación de asientos antes de continuar.',
      400
    );
  }

  const pool = getDbPool();
  const [userRows] = await pool.query<RowDataPacket[]>(
    'SELECT email, password_hash FROM users WHERE id = ? LIMIT 1',
    [actingUserId]
  );
  if (userRows.length === 0) {
    throw new TeamServiceError('USER_NOT_FOUND', 'Usuario no encontrado.', 404);
  }

  const dbUser = userRows[0];
  const hasPassword = Boolean(dbUser.password_hash);
  let verified = false;

  if (hasPassword) {
    const candidatePwd = typeof options.currentPassword === 'string' ? options.currentPassword : '';
    if (candidatePwd.length > 0) {
      verified = await verifyPassword(candidatePwd, String(dbUser.password_hash));
    }
  } else {
    const candidateEmail =
      typeof options.verificationEmail === 'string' ? options.verificationEmail.trim().toLowerCase() : '';
    const expectedEmail = String(dbUser.email || actingUserEmail || '').trim().toLowerCase();
    verified = candidateEmail.length > 0 && candidateEmail === expectedEmail;
  }

  if (!verified) {
    logger.security.warn('Fallo de verificación de seguridad al actualizar asientos de equipo', {
      hasPassword,
      teamId,
      userId: actingUserId,
    });
    trackSecurityEvent({
      actorIdentifier: actingUserEmail,
      eventType: 'team_seat_verification_failed',
      ip: options.ip || '',
      metadata: { teamId },
      outcome: 'blocked',
      reason: hasPassword ? 'invalid_password' : 'invalid_email_confirmation',
      routePattern: '/api/teams/current/seats',
      severity: 'warn',
      userAgent: options.userAgent || '',
      userId: actingUserId,
    });
    throw new TeamServiceError(
      'SEAT_VERIFICATION_FAILED',
      hasPassword
        ? 'Contraseña incorrecta. Verifica tu identidad para continuar.'
        : 'El correo electrónico de confirmación no coincide con tu cuenta.',
      403
    );
  }
}

async function getTeamBillingDetails(teamId: number): Promise<BillingDetailsResponse> {
  const team = await getTeamById(teamId);
  if (!team) {
    throw new TeamServiceError('TEAM_NOT_FOUND', 'Equipo no encontrado.', 404);
  }

  const purchases = await purchaseService.getPurchasesByTeamId(teamId);
  const latestPurchase = purchases.find((p) => p.status === 'completed') || null;
  const periodEndIso = team.subscription_period_end
    ? new Date(team.subscription_period_end).toISOString()
    : null;
  const isYearly = team.billing_period === 'yearly' || team.billing_period === 'one_time_yearly';
  const isOneTime = Boolean(
    team.billing_period?.includes('one_time') || !team.stripe_subscription_id
  );

  if (!team.stripe_subscription_id || isOneTime) {
    const unitPrice = resolveTeamUnitPrice(team.billing_period);
    return {
      amount: Math.round(unitPrice * team.seat_limit * 100) / 100,
      billing_period: team.billing_period || (isYearly ? 'one_time_yearly' : 'one_time_monthly'),
      cancel_at_period_end: false,
      current_period_end: periodEndIso,
      customer_id: team.stripe_customer_id,
      hasSubscription: team.subscription_status === 'active',
      interval: isYearly ? 'year' : 'month',
      is_one_time: isOneTime,
      scope: 'team',
      seat_limit: team.seat_limit,
      seats_used: team.seats_used || 1,
      status: team.subscription_status,
      stripe_subscription_id: team.stripe_subscription_id,
      subscription_id: team.stripe_subscription_id,
      success: true,
      team_id: team.id,
      team_name: team.name,
      tier: team.subscription_tier,
    };
  }

  try {
    const stripe = stripeService.getStripeClient();
    const sub = await stripe.subscriptions.retrieve(team.stripe_subscription_id);
    const rawEnd = (sub as any).current_period_end;
    const rawStart = (sub as any).current_period_start;
    const item = sub.items?.data?.[0];
    const interval: 'month' | 'year' = item?.price?.recurring?.interval === 'year' ? 'year' : 'month';
    const unitAmount = item?.price?.unit_amount;
    const quantity = item?.quantity || team.seat_limit || 1;

    return {
      amount: typeof unitAmount === 'number'
        ? Math.round(((unitAmount * quantity) / 100) * 100) / 100
        : latestPurchase
          ? Number(latestPurchase.amount_total)
          : Math.round(resolveTeamUnitPrice(team.billing_period) * team.seat_limit * 100) / 100,
      billing_period: team.billing_period || (interval === 'year' ? 'yearly' : 'monthly'),
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      current_period_end: typeof rawEnd === 'number' ? new Date(rawEnd * 1000).toISOString() : periodEndIso,
      current_period_start: typeof rawStart === 'number' ? new Date(rawStart * 1000).toISOString() : null,
      customer_id: typeof sub.customer === 'string' ? sub.customer : (sub.customer as Stripe.Customer)?.id,
      hasSubscription: sub.status === 'active' || sub.status === 'trialing',
      interval,
      is_one_time: false,
      scope: 'team',
      seat_limit: quantity,
      seats_used: team.seats_used || 1,
      status: sub.status,
      stripe_subscription_id: sub.id,
      subscription_id: sub.id,
      success: true,
      team_id: team.id,
      team_name: team.name,
      tier: team.subscription_tier,
    };
  } catch {
    return {
      amount: latestPurchase ? Number(latestPurchase.amount_total) : Math.round(resolveTeamUnitPrice(team.billing_period) * team.seat_limit * 100) / 100,
      billing_period: team.billing_period || (isYearly ? 'yearly' : 'monthly'),
      cancel_at_period_end: false,
      current_period_end: periodEndIso,
      customer_id: team.stripe_customer_id,
      hasSubscription: team.subscription_status === 'active',
      interval: isYearly ? 'year' : 'month',
      is_one_time: isOneTime,
      scope: 'team',
      seat_limit: team.seat_limit,
      seats_used: team.seats_used || 1,
      status: team.subscription_status,
      stripe_subscription_id: team.stripe_subscription_id,
      subscription_id: team.stripe_subscription_id,
      success: true,
      team_id: team.id,
      team_name: team.name,
      tier: team.subscription_tier,
    };
  }
}

async function previewTeamSeatChange(teamId: number, rawNewSeats: number): Promise<TeamSeatPreview> {
  if (!Number.isInteger(rawNewSeats) || rawNewSeats < 1 || rawNewSeats > 100) {
    throw new TeamServiceError('INVALID_SEATS', 'La cantidad de asientos debe ser un número entero entre 1 y 100.', 400);
  }

  const team = await getTeamById(teamId);
  if (!team || team.subscription_status !== 'active') {
    throw new TeamServiceError('TEAM_INACTIVE', 'El equipo no tiene una suscripción activa.', 403);
  }

  const newSeats = rawNewSeats;
  const snapshot = await getTeamMembersAndInvitations(teamId);
  const minimumRequired = Math.max(1, snapshot.seatsUsed + snapshot.pendingCount);
  if (newSeats < minimumRequired) {
    throw new TeamServiceError(
      'SEATS_IN_USE',
      `Hay ${snapshot.seatsUsed} miembro(s) activos y ${snapshot.pendingCount} invitación(es) pendientes. Necesitas al menos ${minimumRequired} asiento(s).`,
      409
    );
  }

  const pricePerSeat = resolveTeamUnitPrice(team.billing_period);
  const nextCycleAmount = Math.round(pricePerSeat * newSeats * 100) / 100;
  const isOneTime = Boolean(team.billing_period?.includes('one_time') || !team.stripe_subscription_id);
  const defaultPaymentMethod = !isOneTime && team.stripe_subscription_id
    ? await resolveDefaultCardPreview(team.stripe_customer_id, team.stripe_subscription_id)
    : null;
  const hasDefaultPaymentMethod = Boolean(defaultPaymentMethod);

  if (newSeats <= team.seat_limit) {
    return {
      amountDueNow: 0,
      billingPeriod: team.billing_period || 'monthly',
      currency: 'USD',
      currentSeats: team.seat_limit,
      defaultPaymentMethod,
      hasDefaultPaymentMethod,
      isOneTime,
      newSeats,
      nextCycleAmount,
      pricePerSeat,
    };
  }

  if (!isOneTime && team.stripe_subscription_id && team.stripe_customer_id) {
    try {
      const stripe = stripeService.getStripeClient();
      const sub = await stripe.subscriptions.retrieve(team.stripe_subscription_id);
      const itemId = sub.items?.data?.[0]?.id;
      if (itemId) {
        const preview = await stripe.invoices.createPreview({
          customer: team.stripe_customer_id,
          subscription: team.stripe_subscription_id,
          subscription_details: {
            items: [{ id: itemId, quantity: newSeats }],
            proration_behavior: 'always_invoice',
          },
        });
        const amountDueNow = Math.max(0, Math.round(((preview.amount_due ?? 0) / 100) * 100) / 100);
        return {
          amountDueNow,
          billingPeriod: team.billing_period || 'monthly',
          currency: (preview.currency || 'USD').toUpperCase(),
          currentSeats: team.seat_limit,
          defaultPaymentMethod,
          hasDefaultPaymentMethod,
          isOneTime: false,
          newSeats,
          nextCycleAmount,
          pricePerSeat,
        };
      }
    } catch (err) {
      logger.app.warn('Aviso al previsualizar prorrateo en Stripe; usando cálculo estimado', err);
    }
  }

  const extraSeats = newSeats - team.seat_limit;
  const totalPeriodDays = team.billing_period?.includes('yearly') ? 365 : 30;
  const remainingMs = team.subscription_period_end
    ? Math.max(0, new Date(team.subscription_period_end).getTime() - Date.now())
    : totalPeriodDays * 24 * 60 * 60 * 1000;
  const fraction = Math.min(1, Math.max(0.1, remainingMs / (totalPeriodDays * 24 * 60 * 60 * 1000)));
  const amountDueNow = Math.max(0.5, Math.round(extraSeats * pricePerSeat * fraction * 100) / 100);

  return {
    amountDueNow,
    billingPeriod: team.billing_period || 'monthly',
    currency: 'USD',
    currentSeats: team.seat_limit,
    defaultPaymentMethod,
    hasDefaultPaymentMethod,
    isOneTime,
    newSeats,
    nextCycleAmount,
    pricePerSeat,
  };
}

async function updateTeamSeats(
  teamId: number,
  actingUserId: number,
  actingUserEmail: string,
  rawNewSeats: number,
  options: {
    confirmed?: boolean;
    currentPassword?: string;
    ip?: string;
    useNewCard?: boolean;
    userAgent?: string;
    verificationEmail?: string;
  } = {}
): Promise<{
  amountCharged: number;
  clientSecret?: string;
  paymentIntentId?: string;
  publishableKey?: string;
  requiresPaymentAction?: boolean;
  seatLimit: number;
}> {
  await verifySeatActionSecurity(teamId, actingUserId, actingUserEmail, options);

  const preview = await previewTeamSeatChange(teamId, rawNewSeats);
  const team = await getTeamById(teamId);
  if (!team) {
    throw new TeamServiceError('TEAM_NOT_FOUND', 'Equipo no encontrado.', 404);
  }

  if (preview.newSeats === team.seat_limit) {
    return { amountCharged: 0, seatLimit: team.seat_limit };
  }

  const stripe = stripeService.getStripeClient();

  if (preview.newSeats < team.seat_limit) {
    if (!preview.isOneTime && team.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(team.stripe_subscription_id);
        const itemId = sub.items?.data?.[0]?.id;
        if (itemId) {
          await stripe.subscriptions.update(team.stripe_subscription_id, {
            items: [{ id: itemId, quantity: preview.newSeats }],
            metadata: { ...sub.metadata, teamSeats: String(preview.newSeats) },
            proration_behavior: 'none',
          });
        }
      } catch (stripeErr) {
        logger.security.warn('Error al reducir asientos de suscripción en Stripe', {
          error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
          teamId,
        });
        throw new TeamServiceError('SEAT_UPDATE_FAILED', 'No se pudo actualizar la suscripción en Stripe.', 502);
      }
    }
    await updateTeamSubscriptionState(teamId, { seatLimit: preview.newSeats });
    return { amountCharged: 0, seatLimit: preview.newSeats };
  }

  if (!preview.isOneTime && team.stripe_subscription_id) {
    const mustPromptNewCard = (Boolean(options.useNewCard) || !preview.hasDefaultPaymentMethod) && preview.amountDueNow > 0;
    if (mustPromptNewCard) {
      const amountCents = Math.max(50, Math.round(preview.amountDueNow * 100));
      const customerId = team.stripe_customer_id
        || (await stripe.customers.create({ email: actingUserEmail, metadata: { userId: String(actingUserId) } })).id;

      const pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: customerId,
        metadata: {
          newSeats: String(preview.newSeats),
          previousSeats: String(team.seat_limit),
          subscriptionId: team.stripe_subscription_id,
          teamId: String(teamId),
          type: 'team_seat_upgrade_sub',
          userId: String(actingUserId),
        },
        payment_method_types: ['card'],
        setup_future_usage: 'off_session',
      } as any);

      return {
        amountCharged: amountCents / 100,
        clientSecret: pi.client_secret || '',
        paymentIntentId: pi.id,
        publishableKey: config.stripe.publishableKey,
        requiresPaymentAction: true,
        seatLimit: team.seat_limit,
      };
    }

    const sub = await stripe.subscriptions.retrieve(team.stripe_subscription_id);
    const itemId = sub.items?.data?.[0]?.id;
    if (!itemId) {
      throw new TeamServiceError('STRIPE_ITEM_MISSING', 'No se encontró el ítem de suscripción en Stripe.', 400);
    }

    let updatedSub: Stripe.Subscription;
    try {
      updatedSub = await stripe.subscriptions.update(team.stripe_subscription_id, {
        expand: ['latest_invoice.payment_intent'],
        items: [{ id: itemId, quantity: preview.newSeats }],
        metadata: { ...sub.metadata, teamSeats: String(preview.newSeats) },
        payment_behavior: 'pending_if_incomplete',
        proration_behavior: 'always_invoice',
      });
    } catch (stripeErr: any) {
      logger.security.warn('Error al cobrar prorrateo de asientos adicionales en Stripe', {
        error: stripeErr?.message,
        teamId,
      });
      throw new TeamServiceError(
        'SEAT_PAYMENT_FAILED',
        'No se pudo procesar el cobro de los asientos adicionales con tu tarjeta predeterminada.',
        402
      );
    }

    const latestInvoice = updatedSub.latest_invoice as Stripe.Invoice | null;
    const rawPi = latestInvoice && typeof latestInvoice === 'object' ? (latestInvoice as any).payment_intent : null;
    let piObj: Stripe.PaymentIntent | null =
      rawPi && typeof rawPi === 'object' ? (rawPi as Stripe.PaymentIntent) : null;
    if (!piObj && typeof rawPi === 'string') {
      try {
        piObj = await stripe.paymentIntents.retrieve(rawPi);
      } catch {}
    }

    if (latestInvoice && typeof latestInvoice === 'object' && latestInvoice.status !== 'paid') {
      if (
        piObj &&
        piObj.client_secret &&
        (piObj.status === 'requires_action' ||
          piObj.status === 'requires_confirmation' ||
          piObj.status === 'requires_payment_method')
      ) {
        return {
          amountCharged: Math.max(0, (piObj.amount || Math.round(preview.amountDueNow * 100)) / 100),
          clientSecret: piObj.client_secret,
          paymentIntentId: piObj.id,
          publishableKey: config.stripe.publishableKey,
          requiresPaymentAction: true,
          seatLimit: team.seat_limit,
        };
      }
      throw new TeamServiceError(
        'SEAT_PAYMENT_FAILED',
        'No se pudo completar el cobro con la tarjeta predeterminada. Intenta usar otra tarjeta.',
        402
      );
    }

    const paidAmount = latestInvoice && typeof latestInvoice === 'object'
      ? Math.max(0, (latestInvoice.amount_paid ?? 0) / 100)
      : preview.amountDueNow;

    if (latestInvoice && typeof latestInvoice === 'object' && paidAmount > 0) {
      await purchaseService.fulfillPurchase(
        actingUserId,
        'business',
        {
          amount_total: paidAmount,
          billing_period: (team.billing_period as any) || 'monthly',
          currency: (latestInvoice.currency || 'USD').toUpperCase(),
          plan_id: 'business',
          purchase_scope: 'team',
          status: 'completed',
          stripe_customer_id: team.stripe_customer_id,
          stripe_payment_intent_id: piObj ? piObj.id : typeof rawPi === 'string' ? rawPi : null,
          stripe_session_id: latestInvoice.id,
          stripe_subscription_id: team.stripe_subscription_id,
          team_id: teamId,
          team_seats: preview.newSeats,
          user_id: actingUserId,
        },
        team.subscription_period_end ? new Date(team.subscription_period_end) : undefined,
        team.stripe_subscription_id,
        'active'
      );
    }

    await updateTeamSubscriptionState(teamId, { seatLimit: preview.newSeats });
    return { amountCharged: paidAmount, seatLimit: preview.newSeats };
  }

  const amountCents = Math.max(50, Math.round(preview.amountDueNow * 100));
  const customerId = team.stripe_customer_id
    || (await stripe.customers.create({ email: actingUserEmail, metadata: { userId: String(actingUserId) } })).id;

  const pi = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: customerId,
    metadata: {
      newSeats: String(preview.newSeats),
      previousSeats: String(team.seat_limit),
      teamId: String(teamId),
      type: 'team_seat_upgrade',
      userId: String(actingUserId),
    },
    payment_method_types: ['card'],
  } as any);

  return {
    amountCharged: amountCents / 100,
    clientSecret: pi.client_secret || '',
    paymentIntentId: pi.id,
    publishableKey: config.stripe.publishableKey,
    requiresPaymentAction: true,
    seatLimit: team.seat_limit,
  };
}

async function confirmTeamSeatUpgradeIntent(
  teamId: number,
  actingUserId: number,
  paymentIntentId: string
): Promise<{ seatLimit: number }> {
  const pool = getDbPool();
  const [existingPurchases] = await pool.query<RowDataPacket[]>(
    `SELECT team_seats FROM purchases
     WHERE team_id = ? AND (stripe_payment_intent_id = ? OR stripe_session_id = ?) AND status = 'completed'
     LIMIT 1`,
    [teamId, paymentIntentId, paymentIntentId]
  );
  if (existingPurchases.length > 0) {
    const teamNow = await getTeamById(teamId);
    return { seatLimit: Number(existingPurchases[0].team_seats || teamNow?.seat_limit || 1) };
  }

  const stripe = stripeService.getStripeClient();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== 'succeeded' && pi.status !== 'processing') {
    throw new TeamServiceError('PAYMENT_NOT_SUCCEEDED', 'El pago aún no se ha completado.', 402);
  }

  const team = await getTeamById(teamId);
  if (!team) {
    throw new TeamServiceError('TEAM_NOT_FOUND', 'Equipo no encontrado.', 404);
  }

  const metaType = pi.metadata?.type;
  const customerId = typeof pi.customer === 'string' ? pi.customer : (pi.customer as Stripe.Customer)?.id || null;

  if (metaType === 'team_seat_upgrade' || metaType === 'team_seat_upgrade_sub') {
    const metaTeamId = Number(pi.metadata?.teamId || 0);
    const metaUserId = Number(pi.metadata?.userId || 0);
    const newSeats = Number(pi.metadata?.newSeats || 0);
    if (
      metaTeamId !== teamId ||
      (metaUserId > 0 && metaUserId !== actingUserId) ||
      !Number.isInteger(newSeats) ||
      newSeats <= 0 ||
      newSeats > 100
    ) {
      throw new TeamServiceError('INVALID_SEAT_PAYMENT', 'El pago no corresponde a una ampliación de asientos para este equipo.', 400);
    }

    if (metaType === 'team_seat_upgrade_sub' && team.stripe_subscription_id) {
      const paymentMethodId = typeof pi.payment_method === 'string' ? pi.payment_method : null;
      if (customerId && paymentMethodId) {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        }).catch(() => {});
      }

      const sub = await stripe.subscriptions.retrieve(team.stripe_subscription_id);
      const itemId = sub.items?.data?.[0]?.id;
      if (itemId) {
        await stripe.subscriptions.update(team.stripe_subscription_id, {
          ...(paymentMethodId ? { default_payment_method: paymentMethodId } : {}),
          items: [{ id: itemId, quantity: newSeats }],
          metadata: { ...sub.metadata, teamSeats: String(newSeats) },
          proration_behavior: 'none',
        });
      }
    }

    await purchaseService.fulfillPurchase(
      actingUserId,
      'business',
      {
        amount_total: pi.amount / 100,
        billing_period: (team.billing_period as any) || 'one_time_monthly',
        currency: (pi.currency || 'USD').toUpperCase(),
        plan_id: 'business',
        purchase_scope: 'team',
        status: 'completed',
        stripe_customer_id: customerId || team.stripe_customer_id,
        stripe_payment_intent_id: pi.id,
        stripe_session_id: pi.id,
        stripe_subscription_id: team.stripe_subscription_id || null,
        team_id: teamId,
        team_seats: newSeats,
        user_id: actingUserId,
      },
      team.subscription_period_end ? new Date(team.subscription_period_end) : undefined,
      team.stripe_subscription_id || null,
      'active'
    );

    await updateTeamSubscriptionState(teamId, {
      seatLimit: newSeats,
      stripeCustomerId: customerId || team.stripe_customer_id,
    });
    return { seatLimit: newSeats };
  }

  const rawInvoiceId = typeof (pi as any).invoice === 'string'
    ? (pi as any).invoice
    : (pi as any).invoice?.id || '';
  if (rawInvoiceId && team.stripe_subscription_id) {
    const invoice = await stripe.invoices.retrieve(rawInvoiceId);
    const invoiceSubId = typeof (invoice as any).subscription === 'string'
      ? (invoice as any).subscription
      : (invoice as any).subscription?.id || '';
    if (invoiceSubId !== team.stripe_subscription_id) {
      throw new TeamServiceError('INVALID_SEAT_PAYMENT', 'El pago no corresponde a la suscripción de este equipo.', 400);
    }

    const sub = await stripe.subscriptions.retrieve(team.stripe_subscription_id);
    const pendingQty = (sub as any).pending_update?.subscription_items?.[0]?.quantity;
    const resolvedSeats = Math.max(
      1,
      Number(pendingQty || sub.items?.data?.[0]?.quantity || sub.metadata?.teamSeats || team.seat_limit)
    );

    await purchaseService.fulfillPurchase(
      actingUserId,
      'business',
      {
        amount_total: pi.amount / 100,
        billing_period: (team.billing_period as any) || 'monthly',
        currency: (pi.currency || 'USD').toUpperCase(),
        plan_id: 'business',
        purchase_scope: 'team',
        status: 'completed',
        stripe_customer_id: customerId || team.stripe_customer_id,
        stripe_payment_intent_id: pi.id,
        stripe_session_id: invoice.id,
        stripe_subscription_id: team.stripe_subscription_id,
        team_id: teamId,
        team_seats: resolvedSeats,
        user_id: actingUserId,
      },
      team.subscription_period_end ? new Date(team.subscription_period_end) : undefined,
      team.stripe_subscription_id,
      'active'
    );

    await updateTeamSubscriptionState(teamId, { seatLimit: resolvedSeats });
    return { seatLimit: resolvedSeats };
  }

  throw new TeamServiceError('INVALID_SEAT_PAYMENT', 'El pago no corresponde a una ampliación de asientos para este equipo.', 400);
}

async function updateTeamRenewal(
  teamId: number,
  cancelAtPeriodEnd: boolean
): Promise<{ cancel_at_period_end: boolean; current_period_end: string | null }> {
  const team = await getTeamById(teamId);
  if (!team?.stripe_subscription_id) {
    throw new TeamServiceError('NO_RECURRING_SUB', 'Este equipo no tiene una suscripción recurrente activa.', 400);
  }

  const stripe = stripeService.getStripeClient();
  const updated = await stripe.subscriptions.update(team.stripe_subscription_id, {
    cancel_at_period_end: cancelAtPeriodEnd,
  });

  const rawEnd = (updated as any).current_period_end;
  const periodEnd = typeof rawEnd === 'number' ? new Date(rawEnd * 1000) : null;

  await updateTeamSubscriptionState(teamId, {
    subscriptionPeriodEnd: periodEnd,
    subscriptionStatus: 'active',
  });

  return {
    cancel_at_period_end: Boolean(updated.cancel_at_period_end),
    current_period_end: periodEnd ? periodEnd.toISOString() : null,
  };
}

async function cancelTeamSubscription(teamId: number): Promise<void> {
  const team = await getTeamById(teamId);
  if (!team) {
    throw new TeamServiceError('TEAM_NOT_FOUND', 'Equipo no encontrado.', 404);
  }
  if (team.stripe_subscription_id) {
    const stripe = stripeService.getStripeClient();
    await stripe.subscriptions.cancel(team.stripe_subscription_id).catch(() => {});
  }
  await updateTeamSubscriptionState(teamId, {
    stripeSubscriptionId: null,
    subscriptionStatus: 'canceled',
  });
}

export { cancelTeamSubscription, confirmTeamSeatUpgradeIntent, getTeamBillingDetails, previewTeamSeatChange, updateTeamRenewal, updateTeamSeats };
