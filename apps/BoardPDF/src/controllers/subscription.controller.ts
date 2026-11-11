import { config } from '../config/env.config.js';
import { normalizeTierKey, PLAN_TIER_CONFIGS } from '../config/plans.config.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getWorkspaceTeam } from '../middlewares/workspace.middleware.js';
import { updateActiveAccountInSession } from '../services/auth.service.js';
import { generateInvoicePdf } from '../services/invoice.service.js';
import { logger } from '../services/logger.service.js';
import { purchaseService } from '../services/purchase.service.js';
import { cancelTeamSubscription, getTeamBillingDetails, updateTeamRenewal } from '../services/stripe-team.service.js';
import { stripeService } from '../services/stripe.service.js';
import { SubscriptionTierId } from '../types/subscription.types.js';
import { sendBadRequest, sendForbidden, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

function isSafeClientError(msg: string): boolean {
  return (
    msg.includes('Ya cuentas con') ||
    msg.includes('plan superior') ||
    msg.includes('solicitud de compra en proceso') ||
    msg.includes('no corresponde') ||
    msg.includes('no disponible para contratación') ||
    msg.includes('procesando la confirmación') ||
    msg.includes('aún no se ha completado') ||
    msg.includes('suscripción activa') ||
    msg.includes('No es necesario adquirir')
  );
}

async function getSubscriptions(_req: Request, res: Response): Promise<void> {
  try {
    const subscriptions = Object.values(PLAN_TIER_CONFIGS);
    sendSuccess(res, { subscriptions });
  } catch (error) {
    sendInternalError(res, 'Error al obtener planes de suscripción', error, 'Error al obtener los planes disponibles.');
  }
}

async function createCheckout(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para contratar una suscripción.');
      return;
    }

    const { billingPeriod, planId } = req.body || {};
    const canonicalPlan = normalizeTierKey(planId);

    if (canonicalPlan !== 'pro' && canonicalPlan !== 'business') {
      sendBadRequest(res, 'El plan seleccionado no es válido para compra.');
      return;
    }

    const cycle = billingPeriod === 'yearly' ? 'yearly' : 'monthly';
    const baseUrl = (config.baseUrl || 'http://localhost:3000').replace(/\/+$/, '');

    const checkout = await stripeService.createCheckoutSession(
      user.id,
      user.email,
      canonicalPlan,
      cycle,
      baseUrl
    );

    sendSuccess(res, {
      sessionId: checkout.id,
      success: true,
      url: checkout.url,
    });
  } catch (error: any) {
    if (error?.message && isSafeClientError(error.message)) {
      sendBadRequest(res, error.message);
      return;
    }
    sendInternalError(res, 'Error al generar sesión de checkout en Stripe', error, 'Error al conectar con la pasarela de pagos.');
  }
}

async function verifySession(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado. Inicia sesión.');
      return;
    }

    const sessionId = req.query.session_id as string;
    if (!sessionId) {
      sendBadRequest(res, 'ID de sesión de pago ausente.');
      return;
    }

    const result = await stripeService.verifyAndSyncCheckoutSession(sessionId, user.id);

    updateActiveAccountInSession(res, req, {
      subscription_tier: result.tier as SubscriptionTierId,
    });

    sendSuccess(res, {
      message: 'Suscripción activada con éxito.',
      purchase: result.purchase,
      success: true,
      tier: result.tier,
    });
  } catch (error) {
    sendInternalError(res, 'Error al verificar sesión de Stripe Checkout', error, 'No se pudo verificar el estado del pago.');
  }
}

async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      logger.security.warn('Webhook de Stripe sin cabecera stripe-signature válida');
      res.status(400).send('Webhook Error: Missing stripe-signature');
      return;
    }

    const rawBody = (req as any).rawBody || (typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : null);
    if (!rawBody) {
      logger.security.warn('Webhook de Stripe sin cuerpo binario');
      res.status(400).send('Webhook Error: Missing raw body');
      return;
    }

    const event = stripeService.constructWebhookEvent(rawBody, sig);
    await stripeService.handleWebhookEvent(event);

    res.json({ received: true });
  } catch (error: any) {
    logger.security.error('Error al procesar webhook de Stripe', error);
    res.status(400).send('Webhook Error: Fallo de verificación o procesamiento.');
  }
}

async function getBillingDetails(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const teamCtx = getWorkspaceTeam(req);
    if (teamCtx) {
      if (teamCtx.permissions.includes('team:billing:manage')) {
        const teamBilling = await getTeamBillingDetails(teamCtx.id);
        sendSuccess(res, teamBilling);
        return;
      }
      sendSuccess(res, {
        hasSubscription: teamCtx.subscription_status === 'active' || teamCtx.subscription_status === 'past_due',
        scope: 'team',
        seat_limit: teamCtx.seat_limit,
        seats_used: teamCtx.seats_used,
        status: teamCtx.subscription_status,
        success: true,
        team_id: teamCtx.id,
        team_name: teamCtx.name,
        tier: teamCtx.subscription_tier,
      });
      return;
    }

    const details = await stripeService.getSubscriptionDetails(user.id);
    sendSuccess(res, details);
  } catch (error) {
    sendInternalError(res, 'Error al obtener detalles de facturación', error, 'Error al consultar detalles de facturación.');
  }
}

async function getPurchaseHistory(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const teamCtx = getWorkspaceTeam(req);
    if (teamCtx) {
      if (!teamCtx.permissions.includes('team:billing:manage')) {
        sendSuccess(res, { purchases: [], scope: 'team', success: true });
        return;
      }
      const purchases = await purchaseService.getPurchasesByTeamId(teamCtx.id);
      sendSuccess(res, { purchases, scope: 'team', success: true });
      return;
    }

    const purchases = await purchaseService.getPurchasesByUserId(user.id);
    sendSuccess(res, { purchases, scope: 'personal', success: true });
  } catch (error) {
    sendInternalError(res, 'Error al obtener historial de compras', error, 'Error al obtener el historial de compras.');
  }
}

async function downloadPurchaseInvoice(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const purchaseId = Number(req.params.id);
    if (!purchaseId || isNaN(purchaseId)) {
      sendBadRequest(res, 'ID de compra inválido.');
      return;
    }

    const teamCtx = getWorkspaceTeam(req);
    let purchase = null;
    if (teamCtx) {
      if (!teamCtx.permissions.includes('team:billing:manage')) {
        sendForbidden(res, 'No tienes permisos para descargar facturas de este equipo.');
        return;
      }
      purchase = await purchaseService.getPurchaseByIdForTeam(purchaseId, teamCtx.id);
    } else {
      purchase = await purchaseService.getPurchaseById(purchaseId, user.id);
    }

    if (!purchase) {
      sendBadRequest(res, 'No se encontró el registro de la compra solicitada.');
      return;
    }

    const pdfBytes = await generateInvoicePdf(purchase, {
      email: user.email,
      id: user.id,
      username: user.username,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Factura-BoardPDF-${purchase.id}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.status(200).end(Buffer.from(pdfBytes));
  } catch (error) {
    sendInternalError(res, 'Error al generar factura de compra', error, 'No se pudo generar la factura solicitada.');
  }
}

async function updateAutoRenewal(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { cancelAtPeriodEnd } = req.body || {};
    const teamCtx = getWorkspaceTeam(req);
    if (teamCtx) {
      if (!teamCtx.permissions.includes('team:billing:manage')) {
        sendForbidden(res, 'No tienes permisos para gestionar la facturación del equipo.');
        return;
      }
      const teamResult = await updateTeamRenewal(teamCtx.id, Boolean(cancelAtPeriodEnd));
      sendSuccess(res, {
        cancel_at_period_end: teamResult.cancel_at_period_end,
        current_period_end: teamResult.current_period_end,
        message: cancelAtPeriodEnd
          ? 'Renovación automática del equipo cancelada. Mantendrán la suscripción hasta el término del período actual.'
          : 'Renovación automática del equipo reactivada exitosamente.',
        success: true,
      });
      return;
    }

    const result = await stripeService.updateSubscriptionRenewal(user.id, Boolean(cancelAtPeriodEnd));

    sendSuccess(res, {
      cancel_at_period_end: result.cancel_at_period_end,
      current_period_end: result.current_period_end,
      message: cancelAtPeriodEnd
        ? 'Renovación automática cancelada. Mantendrás tu suscripción hasta el término del período actual.'
        : 'Renovación automática reactivada exitosamente.',
      success: true,
    });
  } catch (error) {
    sendInternalError(res, 'Error al modificar renovación automática', error, 'No se pudo actualizar la renovación automática.');
  }
}

async function cancelSubscriptionImmediate(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const teamCtx = getWorkspaceTeam(req);
    if (teamCtx) {
      if (!teamCtx.permissions.includes('team:billing:manage')) {
        sendForbidden(res, 'No tienes permisos para cancelar la suscripción del equipo.');
        return;
      }
      await cancelTeamSubscription(teamCtx.id);
      sendSuccess(res, {
        message: 'La suscripción del equipo ha sido cancelada.',
        success: true,
        tier: 'free',
      });
      return;
    }

    await stripeService.cancelSubscriptionNow(user.id);

    updateActiveAccountInSession(res, req, {
      subscription_tier: 'free',
    });

    sendSuccess(res, {
      message: 'Tu suscripción ha sido cancelada. Has vuelto al plan gratuito.',
      success: true,
      tier: 'free',
    });
  } catch (error) {
    sendInternalError(res, 'Error al cancelar suscripción inmediatamente', error, 'No se pudo cancelar la suscripción.');
  }
}

async function getPaymentMethods(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const paymentMethods = await stripeService.listPaymentMethods(user.id);
    sendSuccess(res, { paymentMethods, success: true });
  } catch (error) {
    sendInternalError(res, 'Error al listar métodos de pago', error, 'Error al consultar métodos de pago.');
  }
}

async function createSetupIntent(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const result = await stripeService.createSetupIntent(user.id, user.email, user.username);
    sendSuccess(res, { clientSecret: result.clientSecret, success: true });
  } catch (error) {
    sendInternalError(res, 'Error al crear SetupIntent en Stripe', error, 'No se pudo iniciar el proceso para agregar tarjeta.');
  }
}

async function setDefaultPaymentMethod(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const paymentMethodId = req.params.id;
    if (!paymentMethodId) {
      sendBadRequest(res, 'ID de método de pago no especificado.');
      return;
    }

    await stripeService.setDefaultPaymentMethod(user.id, paymentMethodId);
    sendSuccess(res, { message: 'Método de pago predeterminado actualizado.', success: true });
  } catch (error) {
    sendInternalError(res, 'Error al establecer método de pago predeterminado', error, 'No se pudo actualizar el método de pago.');
  }
}

async function deletePaymentMethod(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const paymentMethodId = req.params.id;
    if (!paymentMethodId) {
      sendBadRequest(res, 'ID de método de pago no especificado.');
      return;
    }

    await stripeService.detachPaymentMethod(user.id, paymentMethodId);
    sendSuccess(res, { message: 'Tarjeta eliminada exitosamente.', success: true });
  } catch (error) {
    sendInternalError(res, 'Error al eliminar método de pago', error, 'No se pudo eliminar la tarjeta.');
  }
}

async function createSubscriptionIntent(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { billingPeriod, planId, scope, seats, teamId, teamName } = req.body;
    if (!planId) {
      sendBadRequest(res, 'El plan es obligatorio.');
      return;
    }

    const canonicalPlan = normalizeTierKey(planId);
    if (canonicalPlan !== 'pro' && canonicalPlan !== 'business') {
      sendBadRequest(res, 'El plan solicitado no admite suscripción directa.');
      return;
    }

    const cycle: 'monthly' | 'yearly' = billingPeriod === 'yearly' ? 'yearly' : 'monthly';
    const result = await stripeService.createSubscriptionIntent(
      user.id,
      user.email,
      canonicalPlan,
      cycle,
      {
        scope: scope === 'team' ? 'team' : 'personal',
        seats: Number(seats || 1),
        teamId: teamId ? Number(teamId) : undefined,
        teamName: typeof teamName === 'string' ? teamName : undefined,
      }
    );

    sendSuccess(res, result);
  } catch (error: any) {
    if (error?.message && isSafeClientError(error.message)) {
      sendBadRequest(res, error.message);
      return;
    }
    sendInternalError(res, 'Error al inicializar pasarela de suscripción', error, 'No se pudo iniciar el proceso de pago.');
  }
}

async function confirmSubscriptionPayment(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { paymentIntentId, subscriptionId } = req.body;
    if (!subscriptionId) {
      sendBadRequest(res, 'ID de suscripción ausente.');
      return;
    }

    const result = await stripeService.confirmSubscriptionPayment(
      user.id,
      subscriptionId,
      paymentIntentId
    );

    if (!result.teamId) {
      updateActiveAccountInSession(res, req, {
        subscription_tier: result.tier as SubscriptionTierId,
      });
    }

    sendSuccess(res, result);
  } catch (error: any) {
    if (error?.message && isSafeClientError(error.message)) {
      sendBadRequest(res, error.message);
      return;
    }
    sendInternalError(res, 'Error al confirmar activación de suscripción', error, 'No se pudo activar la suscripción.');
  }
}

async function createOneTimeIntent(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { duration, planId, scope, seats, teamId, teamName } = req.body;
    if (!planId) {
      sendBadRequest(res, 'El plan es obligatorio.');
      return;
    }

    const canonicalPlan = normalizeTierKey(planId);
    if (canonicalPlan !== 'pro' && canonicalPlan !== 'business') {
      sendBadRequest(res, 'El plan solicitado no admite suscripción directa.');
      return;
    }

    const dur: '1_month' | '12_months' = duration === '12_months' ? '12_months' : '1_month';
    const result = await stripeService.createOneTimePaymentIntent(
      user.id,
      user.email,
      canonicalPlan,
      dur,
      {
        scope: scope === 'team' ? 'team' : 'personal',
        seats: Number(seats || 1),
        teamId: teamId ? Number(teamId) : undefined,
        teamName: typeof teamName === 'string' ? teamName : undefined,
      }
    );

    sendSuccess(res, result);
  } catch (error: any) {
    if (error?.message && isSafeClientError(error.message)) {
      sendBadRequest(res, error.message);
      return;
    }
    sendInternalError(res, 'Error al inicializar pago único', error, 'No se pudo iniciar el proceso de pago único.');
  }
}

async function confirmOneTimePayment(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      sendBadRequest(res, 'ID de intento de pago ausente.');
      return;
    }

    const result = await stripeService.confirmOneTimePayment(user.id, paymentIntentId);

    if (!result.teamId) {
      updateActiveAccountInSession(res, req, {
        subscription_tier: result.planId as SubscriptionTierId,
      });
    }

    sendSuccess(res, result);
  } catch (error: any) {
    if (error?.message && isSafeClientError(error.message)) {
      sendBadRequest(res, error.message);
      return;
    }
    sendInternalError(res, 'Error al confirmar activación de pago único', error, 'No se pudo confirmar el pago.');
  }
}

export { cancelSubscriptionImmediate, confirmOneTimePayment, confirmSubscriptionPayment, createCheckout, createOneTimeIntent, createSetupIntent, createSubscriptionIntent, deletePaymentMethod, downloadPurchaseInvoice, getBillingDetails, getPaymentMethods, getPurchaseHistory, getSubscriptions, handleWebhook, setDefaultPaymentMethod, updateAutoRenewal, verifySession };
