import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { organizationService } from '../services/organization.service.js';
import { Request, Response } from 'express';

export async function getOrganization(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const orgData = await organizationService.getOrganizationForUser(user.id);
    if (!orgData) {
      res.status(404).json({ error: 'No se encontró la organización o no tienes acceso.' });
      return;
    }

    res.status(200).json(orgData);
  } catch (error) {
    logger.app.error('Error al obtener la organización del usuario', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function updateOrganization(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const orgData = await organizationService.getOrganizationForUser(user.id);
    if (!orgData) {
      res.status(404).json({ error: 'No se encontró la organización o no tienes acceso.' });
      return;
    }

    const { domain, name } = req.body || {};
    const updated = await organizationService.updateOrganization(orgData.organization.id, { domain, name });

    res.status(200).json({
      message: 'Organización actualizada exitosamente.',
      organization: updated,
      success: true,
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar organización.';
    if (msg.includes('caracteres') || msg.includes('dominio')) {
      res.status(400).json({ error: msg });
      return;
    }
    logger.app.error('Error al actualizar la organización', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const orgData = await organizationService.getOrganizationForUser(user.id);
    if (!orgData) {
      res.status(404).json({ error: 'No se encontró la organización o no tienes acceso.' });
      return;
    }

    const data = await organizationService.listMembers(orgData.organization.id);
    res.status(200).json(data);
  } catch (error) {
    logger.app.error('Error al listar miembros de la organización', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function inviteMember(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const orgData = await organizationService.getOrganizationForUser(user.id);
    if (!orgData) {
      res.status(404).json({ error: 'No se encontró la organización o no tienes acceso.' });
      return;
    }

    const { email, role } = req.body || {};
    if (!email) {
      res.status(400).json({ error: 'Ingresa un correo electrónico para la invitación.' });
      return;
    }

    const invitation = await organizationService.inviteMember(
      orgData.organization.id,
      user.id,
      String(email),
      role === 'admin' ? 'admin' : 'member'
    );

    res.status(201).json({
      invitation,
      message: 'Invitación enviada exitosamente.',
      success: true,
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : 'Error al invitar miembro.';
    if (msg.includes('válido') || msg.includes('inválido') || msg.includes('miembro activo') || msg.includes('invitación pendiente')) {
      res.status(400).json({ error: msg });
      return;
    }
    logger.app.error('Error al invitar miembro a la organización', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function updateMemberRole(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const orgData = await organizationService.getOrganizationForUser(user.id);
    if (!orgData) {
      res.status(404).json({ error: 'No se encontró la organización o no tienes acceso.' });
      return;
    }

    const memberId = Number(req.params.id);
    if (!memberId || isNaN(memberId)) {
      res.status(400).json({ error: 'Identificador de miembro inválido.' });
      return;
    }

    const { role } = req.body || {};
    if (role !== 'admin' && role !== 'member') {
      res.status(400).json({ error: 'El rol debe ser admin o member.' });
      return;
    }

    const member = await organizationService.updateMemberRole(orgData.organization.id, memberId, role);
    res.status(200).json({
      member,
      message: 'Rol de miembro actualizado exitosamente.',
      success: true,
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : 'Error al modificar rol.';
    if (msg.includes('no fue encontrado') || msg.includes('propietario')) {
      res.status(400).json({ error: msg });
      return;
    }
    logger.app.error('Error al actualizar rol de miembro en la organización', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const orgData = await organizationService.getOrganizationForUser(user.id);
    if (!orgData) {
      res.status(404).json({ error: 'No se encontró la organización o no tienes acceso.' });
      return;
    }

    const memberId = Number(req.params.id);
    if (!memberId || isNaN(memberId)) {
      res.status(400).json({ error: 'Identificador de miembro inválido.' });
      return;
    }

    await organizationService.removeMember(orgData.organization.id, memberId, user.id);
    res.status(200).json({
      message: 'Miembro eliminado exitosamente.',
      success: true,
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : 'Error al remover miembro.';
    if (msg.includes('no fue encontrado') || msg.includes('propietario') || msg.includes('propia membresía')) {
      res.status(400).json({ error: msg });
      return;
    }
    logger.app.error('Error al remover miembro de la organización', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function revokeInvitation(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const orgData = await organizationService.getOrganizationForUser(user.id);
    if (!orgData) {
      res.status(404).json({ error: 'No se encontró la organización o no tienes acceso.' });
      return;
    }

    const invitationId = Number(req.params.id);
    if (!invitationId || isNaN(invitationId)) {
      res.status(400).json({ error: 'Identificador de invitación inválido.' });
      return;
    }

    await organizationService.revokeInvitation(orgData.organization.id, invitationId);
    res.status(200).json({
      message: 'Invitación revocada exitosamente.',
      success: true,
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : 'Error al revocar invitación.';
    if (msg.includes('no fue encontrada')) {
      res.status(400).json({ error: msg });
      return;
    }
    logger.app.error('Error al revocar invitación de la organización', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function getSsoConfig(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const orgData = await organizationService.getOrganizationForUser(user.id);
    if (!orgData) {
      res.status(404).json({ error: 'No se encontró la organización o no tienes acceso.' });
      return;
    }

    const ssoData = await organizationService.getSsoConfig(orgData.organization.id);
    res.status(200).json(ssoData);
  } catch (error) {
    logger.app.error('Error al obtener configuración SAML/SSO', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function updateSsoConfig(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const orgData = await organizationService.getOrganizationForUser(user.id);
    if (!orgData) {
      res.status(404).json({ error: 'No se encontró la organización o no tienes acceso.' });
      return;
    }

    const result = await organizationService.updateSsoConfig(orgData.organization.id, req.body || {});
    res.status(200).json({
      message: 'Configuración SAML/SSO guardada exitosamente.',
      sso: result.sso,
      success: true,
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : 'Error al guardar configuración SSO.';
    if (
      msg.includes('Entity ID') ||
      msg.includes('URL ACS') ||
      msg.includes('certificado') ||
      msg.includes('metadatos XML') ||
      msg.includes('Base64') ||
      msg.includes('PEM') ||
      msg.includes('SAML') ||
      msg.includes('URL SSO')
    ) {
      res.status(400).json({ error: msg });
      return;
    }
    logger.app.error('Error al actualizar configuración SAML/SSO', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}
