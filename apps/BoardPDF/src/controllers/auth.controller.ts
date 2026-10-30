import { getCurrentUser, getLinkedAccounts } from '../middlewares/auth.middleware.js';
import { addAccountToSession, clearSessionCookie, hashPassword, removeAccountFromSession, switchAccountInSession, verifyPassword } from '../services/auth.service.js';
import { logger } from '../services/logger.service.js';
import { sendVerificationCodeEmail, sendWelcomeEmail } from '../services/mail.service.js';
import { createUser, findUserByEmail, findUserDuplicates, updateUserLastLogin } from '../services/user.service.js';
import { generateSixDigitCode, getPendingRegistration, savePendingRegistration, verifyAndConsumeCode } from '../services/verification.service.js';
import { UserPayload } from '../types/auth.types.js';
import { validateEmail, validatePassword, validateUsername, validateVerificationCode } from '../utils/validators.util.js';
import { Request, Response } from 'express';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export function sanitizeUser(user: any): UserPayload {
  return {
    avatar_url: user.avatar_url ?? null,
    created_at: user.created_at ? new Date(user.created_at).toISOString() : undefined,
    email: user.email,
    id: user.id,
    role: user.role || 'USER',
    roles: user.roles || (user.role ? [user.role] : ['USER']),
    subscription_tier: user.subscription_tier || 'free',
    username: user.username,
  };
}

export async function validateStage1(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      res.status(400).json({ error: emailValidation.error });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.error });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const existing = await findUserByEmail(trimmedEmail);

    if (existing) {
      logger.security.warn('Intento de registro con correo existente', { email: trimmedEmail });
      res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
      return;
    }

    res.status(200).json({ message: 'Datos válidos para continuar a la etapa 2.' });
  } catch (error) {
    logger.security.error('Error al validar etapa 1 de registro', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function sendRegistrationCode(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, username } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      res.status(400).json({ error: emailValidation.error });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.error });
      return;
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      res.status(400).json({ error: usernameValidation.error });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedUsername = String(username).trim();

    const { emailExists, usernameExists } = await findUserDuplicates(trimmedEmail, trimmedUsername);

    if (usernameExists) {
      logger.security.warn('Intento de registro con nombre de usuario existente', { username: trimmedUsername });
      res.status(409).json({ error: 'El nombre de usuario ya está en uso.' });
      return;
    }

    if (emailExists) {
      logger.security.warn('Intento de registro con correo existente', { email: trimmedEmail });
      res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
      return;
    }

    const code = generateSixDigitCode();
    const passwordHash = await hashPassword(String(password));

    await savePendingRegistration(
      trimmedEmail,
      {
        code,
        passwordHash,
        username: trimmedUsername,
      },
      900
    );

    await sendVerificationCodeEmail(trimmedEmail, trimmedUsername, code);

    logger.security.info('Código de verificación de registro enviado exitosamente', { email: trimmedEmail, username: trimmedUsername });
    res.status(200).json({ message: `Código de verificación enviado exitosamente a ${trimmedEmail}.` });
  } catch (error) {
    logger.security.error('Error al enviar código de registro', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function resendRegistrationCode(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      res.status(400).json({ error: emailValidation.error });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const pending = await getPendingRegistration(trimmedEmail);

    if (!pending) {
      logger.security.warn('Intento de reenvío con registro expirado', { email: trimmedEmail });
      res.status(400).json({ error: 'La sesión de registro ha expirado. Debes iniciar desde el principio.' });
      return;
    }

    const newCode = generateSixDigitCode();
    await savePendingRegistration(trimmedEmail, {
      code: newCode,
      passwordHash: pending.passwordHash,
      username: pending.username,
    });

    await sendVerificationCodeEmail(trimmedEmail, pending.username, newCode);

    logger.security.info('Nuevo código de verificación enviado', { email: trimmedEmail });
    res.status(200).json({ message: 'Nuevo código enviado exitosamente.' });
  } catch (error) {
    logger.security.error('Error al reenviar código', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function verifyRegistrationCode(req: Request, res: Response): Promise<void> {
  try {
    const { code, email } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      res.status(400).json({ error: emailValidation.error });
      return;
    }

    const codeValidation = validateVerificationCode(code);
    if (!codeValidation.valid) {
      res.status(400).json({ error: codeValidation.error });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const verificationResult = await verifyAndConsumeCode(trimmedEmail, cleanCode);

    if (!verificationResult.success || !verificationResult.data) {
      logger.security.warn('Fallo en verificación de código de registro', { email: trimmedEmail, error: verificationResult.error });
      res.status(400).json({ error: verificationResult.error || 'Código incorrecto o expirado.' });
      return;
    }

    const pending = verificationResult.data;
    const clientIp = getClientIp(req);

    const newUser = await createUser({
      email: pending.email,
      passwordHash: pending.passwordHash,
      registrationIp: clientIp,
      username: pending.username,
    });

    const session = await addAccountToSession(res, req, newUser);

    try {
      void sendWelcomeEmail(newUser.email, newUser.username);
    } catch {}

    logger.security.info('Cuenta creada y verificada exitosamente', { email: newUser.email, userId: newUser.id });

    res.status(201).json({
      accounts: session.accounts.map(sanitizeUser),
      message: 'Cuenta creada y verificada exitosamente.',
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    logger.security.error('Error al verificar código de registro', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Ingresa correo y contraseña.' });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const userRow = await findUserByEmail(trimmedEmail);

    if (!userRow || !userRow.password_hash) {
      logger.security.warn('Intento de inicio de sesión fallido: correo no encontrado', { email: trimmedEmail });
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    const isMatch = await verifyPassword(String(password), userRow.password_hash);
    if (!isMatch) {
      logger.security.warn('Intento de inicio de sesión fallido: contraseña incorrecta', { email: trimmedEmail });
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    const user = sanitizeUser(userRow);
    const clientIp = getClientIp(req);
    void updateUserLastLogin(user.id, clientIp);

    const session = await addAccountToSession(res, req, user);

    logger.security.info('Inicio de sesión exitoso', { email: user.email, userId: user.id });

    res.status(200).json({
      accounts: session.accounts.map(sanitizeUser),
      message: 'Inicio de sesión exitoso.',
      user,
    });
  } catch (error) {
    logger.security.error('Error al iniciar sesión', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const accounts = getLinkedAccounts(req);

    res.status(200).json({
      accounts: accounts.map(sanitizeUser),
      user: user ? sanitizeUser(user) : null,
    });
  } catch (error) {
    logger.security.error('Error al obtener usuario actual', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function switchAccount(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;
    const targetUserId = Number(userId);

    if (!targetUserId || isNaN(targetUserId)) {
      res.status(400).json({ error: 'Identificador de usuario inválido.' });
      return;
    }

    const result = await switchAccountInSession(res, req, targetUserId);

    if (!result.success || !result.activeUser) {
      res.status(400).json({ error: 'No se pudo cambiar a la cuenta especificada.' });
      return;
    }

    logger.security.info('Cambio de cuenta exitoso', { targetUserId });

    res.status(200).json({
      accounts: result.accounts.map(sanitizeUser),
      message: 'Cuenta cambiada exitosamente.',
      success: true,
      user: sanitizeUser(result.activeUser),
    });
  } catch (error) {
    logger.security.error('Error al cambiar de cuenta', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body || {};
    const targetUserId = userId ? Number(userId) : undefined;

    const result = await removeAccountFromSession(res, req, targetUserId);

    res.status(200).json({
      accounts: result.accounts.map(sanitizeUser),
      remainingCount: result.remainingCount,
      success: true,
      switched: result.remainingCount > 0,
      user: result.activeUser ? sanitizeUser(result.activeUser) : null,
    });
  } catch (error) {
    logger.security.error('Error al cerrar sesión', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  try {
    clearSessionCookie(res);
    res.status(200).json({
      accounts: [],
      message: 'Todas las sesiones han sido cerradas.',
      success: true,
      user: null,
    });
  } catch (error) {
    logger.security.error('Error al cerrar todas las sesiones', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}
