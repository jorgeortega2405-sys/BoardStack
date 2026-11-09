import { getDbPool } from '../config/database.config.js';
import { addAccountToSession, hashPassword } from '../services/auth.service.js';
import { logger } from '../services/logger.service.js';
import { permissionService } from '../services/permission.service.js';
import { ssoService } from '../services/sso.service.js';
import { createUser, findUserByEmail, updateUserLastLogin } from '../services/user.service.js';
import { sanitizeUser } from './auth.controller.js';
import crypto from 'crypto';
import { Request, Response } from 'express';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function resolveBaseUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

function spMetadata(req: Request, res: Response): void {
  try {
    const baseUrl = resolveBaseUrl(req);
    const xml = ssoService.getSpMetadataXml(baseUrl);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(xml);
  } catch (error) {
    logger.app.error('Error al generar metadatos SAML SP', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

async function samlLogin(req: Request, res: Response): Promise<void> {
  try {
    const queryTarget = req.query.email || req.query.domain;
    if (!queryTarget || typeof queryTarget !== 'string') {
      res.redirect('/login?error=missing_email');
      return;
    }

    const trimmed = queryTarget.trim().toLowerCase();
    const domain = trimmed.includes('@') ? trimmed.split('@')[1] : trimmed;

    const ssoConfig = await ssoService.findSsoConfigByDomain(domain);
    if (!ssoConfig || !ssoConfig.enabled || !ssoConfig.idp_sso_url) {
      logger.security.warn('Intento de login SSO para dominio no configurado o inactivo', { domain });
      res.redirect('/login?error=sso_not_configured');
      return;
    }

    const baseUrl = resolveBaseUrl(req);
    const acsUrl = baseUrl.includes('localhost') ? `${baseUrl}/api/sso/saml/acs` : (ssoConfig.acs_url || `${baseUrl}/api/sso/saml/acs`);
    const entityId = `${baseUrl}/api/sso/saml/metadata`;

    const samlRequest = ssoService.buildAuthnRequest({
      acsUrl,
      entityId,
      idpSsoUrl: ssoConfig.idp_sso_url,
    });

    const relayState = (req.query.relay || req.query.redirect || '/') as string;
    const redirectUrl = new URL(ssoConfig.idp_sso_url);
    redirectUrl.searchParams.set('SAMLRequest', samlRequest);
    redirectUrl.searchParams.set('RelayState', relayState);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.security.error('Error al procesar solicitud de inicio de sesión SAML SP', error);
    res.redirect('/login?error=sso_failed');
  }
}

async function samlAcs(req: Request, res: Response): Promise<void> {
  try {
    const samlResponseBase64 = req.body?.SAMLResponse;
    if (!samlResponseBase64 || typeof samlResponseBase64 !== 'string') {
      logger.security.warn('Petición a SAML ACS sin SAMLResponse');
      res.redirect('/login?error=missing_saml_response');
      return;
    }

    const xml = Buffer.from(samlResponseBase64, 'base64').toString('utf-8');
    const email = ssoService.extractSamlEmail(xml);

    if (!email) {
      logger.security.warn('No se pudo extraer email de la aserción SAML recibida');
      res.redirect('/login?error=invalid_saml_assertion');
      return;
    }

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      res.redirect('/login?error=invalid_saml_assertion');
      return;
    }

    const ssoConfig = await ssoService.findSsoConfigByDomain(domain);
    if (!ssoConfig || !ssoConfig.enabled) {
      logger.security.warn('Aserción SAML recibida para dominio sin SSO activo', { domain });
      res.redirect('/login?error=sso_not_configured');
      return;
    }

    if (ssoConfig.idp_certificate) {
      const isValid = ssoService.verifySamlResponseSignature(xml, ssoConfig.idp_certificate);
      if (!isValid) {
        logger.security.warn('Firma digital de la aserción SAML no válida contra certificado IdP registrado', { domain, email });
        res.redirect('/login?error=invalid_saml_assertion');
        return;
      }
    }

    let userRow = await findUserByEmail(email);
    const clientIp = getClientIp(req);

    if (!userRow) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(randomPassword);
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30) || 'user';
      await createUser({
        email,
        passwordHash,
        registrationIp: clientIp,
        username,
      });
      userRow = await findUserByEmail(email);
    }

    if (!userRow) {
      logger.security.error('No se pudo cargar o crear el usuario federado', { email });
      res.redirect('/login?error=sso_failed');
      return;
    }

    const pool = getDbPool();
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, status)
       VALUES (?, ?, 'member', 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [ssoConfig.organization_id, userRow.id]
    );

    const permissions = await permissionService.getUserPermissions(
      userRow.id,
      userRow.subscription_tier,
      userRow.subscription_status
    );
    userRow.permissions = permissions;

    const user = sanitizeUser(userRow);
    user.is_sso = true;
    void updateUserLastLogin(user.id, clientIp);

    await addAccountToSession(res, req, user);

    logger.security.info('Sesión SAML federada iniciada exitosamente', {
      email: user.email,
      organizationId: ssoConfig.organization_id,
      userId: user.id,
    });

    const relayState = req.body?.RelayState;
    const target = (typeof relayState === 'string' && relayState.startsWith('/')) ? relayState : '/';
    res.redirect(target);
  } catch (error) {
    logger.security.error('Error al procesar ACS SAML', error);
    res.redirect('/login?error=sso_failed');
  }
}

export { samlAcs, samlLogin, spMetadata };
