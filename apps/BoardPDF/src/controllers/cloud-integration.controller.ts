import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { disconnectUserCloudIntegration, getUserCloudAccessToken, getUserCloudIntegrations, saveUserCloudIntegration } from '../services/cloud-integration.service.js';
import { logger } from '../services/logger.service.js';
import type { Request, Response } from 'express';

export async function handleGetCloudIntegrations(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesión no iniciada.', ok: false });
      return;
    }

    const integrations = await getUserCloudIntegrations(user.id);
    res.json({ integrations, ok: true });
  } catch (err) {
    logger.app.error('Error al obtener integraciones de nube del usuario', { err });
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al consultar los servicios en la nube.', ok: false });
  }
}

export async function handleConnectCloudIntegration(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesión no iniciada.', ok: false });
      return;
    }

    const { accountEmail, accountId, accessToken, expiresInSec, provider, refreshToken } = req.body || {};

    if (!provider || (provider !== 'google_drive' && provider !== 'dropbox')) {
      res.status(400).json({ error: 'Proveedor de nube no admitido.', ok: false });
      return;
    }

    if (!accessToken || typeof accessToken !== 'string' || accessToken.trim().length === 0) {
      res.status(400).json({ error: 'Token de acceso no válido o ausente.', ok: false });
      return;
    }

    const success = await saveUserCloudIntegration(user.id, provider, {
      accessToken: accessToken.trim(),
      accountEmail: typeof accountEmail === 'string' ? accountEmail.trim() : undefined,
      accountId: typeof accountId === 'string' ? accountId.trim() : undefined,
      expiresInSec: typeof expiresInSec === 'number' ? expiresInSec : 3600,
      refreshToken: typeof refreshToken === 'string' ? refreshToken.trim() : undefined,
    });

    if (!success) {
      res.status(500).json({ error: 'No se pudo guardar la vinculación con el servicio en la nube.', ok: false });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    logger.app.error('Error al conectar servicio en la nube', { err });
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al vincular el servicio en la nube.', ok: false });
  }
}

export async function handleDisconnectCloudIntegration(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesión no iniciada.', ok: false });
      return;
    }

    const { provider } = req.body || {};

    if (!provider || (provider !== 'google_drive' && provider !== 'dropbox')) {
      res.status(400).json({ error: 'Proveedor de nube no admitido.', ok: false });
      return;
    }

    const success = await disconnectUserCloudIntegration(user.id, provider);
    if (!success) {
      res.status(500).json({ error: 'No se pudo desconectar el servicio en la nube.', ok: false });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    logger.app.error('Error al desconectar servicio en la nube', { err });
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al desconectar el servicio.', ok: false });
  }
}

export async function handleGetCloudAccessToken(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesión no iniciada.', ok: false });
      return;
    }

    const providerParam = req.params.provider;
    if (providerParam !== 'google_drive' && providerParam !== 'dropbox') {
      res.status(400).json({ error: 'Proveedor de nube no válido.', ok: false });
      return;
    }

    const token = await getUserCloudAccessToken(user.id, providerParam);
    if (!token) {
      res.json({ accessToken: null, connected: false, ok: true });
      return;
    }

    res.json({ accessToken: token, connected: true, ok: true });
  } catch (err) {
    logger.app.error('Error al obtener token de acceso de nube', { err });
    res.status(500).json({ error: 'Error al verificar la conexión con el servicio en la nube.', ok: false });
  }
}
