import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';
import fs from 'fs';
import nodemailer from 'nodemailer';
import path from 'path';

export interface EmailTemplate {
  html: string;
  subject: string;
  text: string;
}

function loadEmailTemplates(): Record<string, EmailTemplate> {
  const candidates = [
    path.resolve(import.meta.dirname, '../config/email-templates.json'),
    path.resolve(process.cwd(), 'src/config/email-templates.json'),
    path.resolve(process.cwd(), 'apps/BoardPDF/src/config/email-templates.json'),
    path.resolve(import.meta.dirname, '../../src/config/email-templates.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch {}
    }
  }
  return {};
}

const transporter = nodemailer.createTransport({
  auth: {
    pass: config.smtp.pass,
    user: config.smtp.user,
  },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  socketTimeout: 10000,
});

export function escapeHtml(str: unknown): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTemplateString(
  template: string,
  variables: Record<string, string | number>,
  isHtml = false
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    if (key in variables) {
      const val = variables[key];
      return isHtml ? escapeHtml(val) : String(val);
    }
    return match;
  });
}

export async function sendTemplateEmail(
  templateKey: string,
  toEmail: string,
  variables: Record<string, string | number> = {}
): Promise<void> {
  const templates = loadEmailTemplates();
  const template: EmailTemplate | undefined = templates[templateKey];
  if (!template) {
    throw new Error(`Plantilla de email no encontrada: ${templateKey}`);
  }

  const mergedVariables: Record<string, string | number> = {
    appName: config.appName,
    year: new Date().getFullYear(),
    ...variables,
  };

  const subject = renderTemplateString(template.subject, mergedVariables, false);
  const html = renderTemplateString(template.html, mergedVariables, true);
  const text = renderTemplateString(template.text, mergedVariables, false);

  const fromAddress = `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`;

  try {
    await transporter.sendMail({
      from: fromAddress,
      html,
      subject,
      text,
      to: toEmail,
    });
    logger.app.info(`Correo enviado exitosamente a ${toEmail} con plantilla ${templateKey}`);
  } catch (err) {
    logger.app.error(`Error al enviar correo con plantilla ${templateKey} a ${toEmail}`, err);
    throw err;
  }
}

export async function sendVerificationCodeEmail(
  toEmail: string,
  username: string,
  code: string,
  expiresInMinutes = 15
): Promise<void> {
  await sendTemplateEmail('verification_code', toEmail, {
    code,
    expiresIn: expiresInMinutes,
    username,
  });
}

export async function sendWelcomeEmail(
  toEmail: string,
  username: string
): Promise<void> {
  await sendTemplateEmail('welcome', toEmail, {
    username,
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  username: string,
  resetUrl: string,
  expiresInMinutes = 15
): Promise<void> {
  await sendTemplateEmail('password_reset', toEmail, {
    expiresIn: expiresInMinutes,
    resetUrl,
    username,
  });
}
