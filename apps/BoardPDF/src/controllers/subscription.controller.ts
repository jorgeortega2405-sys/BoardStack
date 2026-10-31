import { config } from '../config/env.config.js';
import { normalizeTierKey, PLAN_TIER_CONFIGS } from '../config/plans.config.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { updateActiveAccountInSession } from '../services/auth.service.js';
import { logger } from '../services/logger.service.js';
import { purchaseService } from '../services/purchase.service.js';
import { stripeService } from '../services/stripe.service.js';
import { SubscriptionTierId } from '../types/subscription.types.js';
import { sendBadRequest, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function getSubscriptions(_req: Request, res: Response): Promise<void> {
  try {
    const subscriptions = Object.values(PLAN_TIER_CONFIGS);
    sendSuccess(res, { subscriptions });
  } catch (error) {
    sendInternalError(res, 'Error al obtener planes de suscripción', error, 'Error al obtener los planes disponibles.');
  }
}

export async function createCheckout(req: Request, res: Response): Promise<void> {
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
  } catch (error) {
    sendInternalError(res, 'Error al generar sesión de checkout en Stripe', error, 'Error al conectar con la pasarela de pagos.');
  }
}

export async function verifySession(req: Request, res: Response): Promise<void> {
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

export async function handleWebhook(req: Request, res: Response): Promise<void> {
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

export async function getBillingDetails(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const details = await stripeService.getSubscriptionDetails(user.id);
    sendSuccess(res, details);
  } catch (error) {
    sendInternalError(res, 'Error al obtener detalles de facturación', error, 'Error al consultar detalles de facturación.');
  }
}

export async function getPurchaseHistory(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const purchases = await purchaseService.getPurchasesByUserId(user.id);
    sendSuccess(res, { purchases, success: true });
  } catch (error) {
    sendInternalError(res, 'Error al obtener historial de compras', error, 'Error al obtener el historial de compras.');
  }
}

export async function updateAutoRenewal(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { cancelAtPeriodEnd } = req.body || {};
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

export async function cancelSubscriptionImmediate(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
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

export async function getPaymentMethods(req: Request, res: Response): Promise<void> {
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

export async function createSetupIntent(req: Request, res: Response): Promise<void> {
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

export async function setDefaultPaymentMethod(req: Request, res: Response): Promise<void> {
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

export async function deletePaymentMethod(req: Request, res: Response): Promise<void> {
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
