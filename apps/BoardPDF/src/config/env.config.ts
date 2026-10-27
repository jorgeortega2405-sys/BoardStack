import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();
const localEnvPath = path.resolve(import.meta.dirname, '../../.env');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

export const config = {
  appName: process.env.APP_NAME || 'BoardPDF',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  db: {
    database: process.env.DB_NAME || 'boardpdf_db',
    host: process.env.DB_HOST || '127.0.0.1',
    password: process.env.DB_PASSWORD || 'boardpdf_secure_password_2026',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'boardpdf_user',
  },
  deepl: {
    apiKey: process.env.DEEPL_API_KEY || '',
  },
  downloadSecret: process.env.DOWNLOAD_TOKEN_SECRET || process.env.SESSION_SECRET || 'boardpdf_secure_cryptographic_download_token_master_secret_2026',
  dropbox: {
    appKey: process.env.DROPBOX_APP_KEY || '',
    appSecret: process.env.DROPBOX_APP_SECRET || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  },
  googlePicker: {
    apiKey: process.env.VITE_GOOGLE_API_KEY || '',
    clientId: process.env.VITE_GOOGLE_CLIENT_ID || '',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  originProtection: {
    enforceCloudflare: process.env.ENFORCE_CLOUDFLARE_ORIGIN === 'true',
    secret: process.env.CLOUDFLARE_ORIGIN_SECRET || '',
  },
  port: parseInt(process.env.PORT || '3000', 10),
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    password: process.env.REDIS_PASSWORD || undefined,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  s3: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || '',
    bucket: process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || '',
    endpoint: process.env.AWS_S3_ENDPOINT || process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true' || process.env.S3_FORCE_PATH_STYLE === 'true',
    region: process.env.AWS_S3_REGION || process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || '',
  },
  sessionSecret: process.env.SESSION_SECRET || 'boardpdf_session_secret_key_2026',
  turnstile: {
    enabled: process.env.TURNSTILE_ENABLED === 'true' || Boolean(process.env.TURNSTILE_SECRET_KEY),
    secretKey: process.env.TURNSTILE_SECRET_KEY || '',
    siteKey: process.env.TURNSTILE_SITE_KEY || process.env.VITE_TURNSTILE_SITE_KEY || '',
  },
};
