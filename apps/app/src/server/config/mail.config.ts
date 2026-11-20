import { config } from './env.config.js';
import { logger } from '../utils/logger.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  auth: {
    pass: config.smtp.pass,
    user: config.smtp.user,
  },
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
});

async function verifyMailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    logger.system.info('[Mail] SMTP connection verified successfully.');
    return true;
  } catch (error) {
    logger.system.error('[Mail] Failed to verify SMTP connection:', error);
    return false;
  }
}

export {
  transporter,
  verifyMailConnection
};
