interface AppConfig {
  appUrl: string;
  awsS3: {
    accessKeyId: string;
    bucket: string;
    endpoint?: string;
    forcePathStyle: boolean;
    publicUrl: string;
    region: string;
    secretAccessKey: string;
  };
  db: {
    host: string;
    name: string;
    password?: string;
    port: number;
    user: string;
  };
  googleOAuth: {
    callbackUrl: string;
    clientId: string;
    clientSecret: string;
  };
  host: string;
  nodeEnv: string;
  port: number;
  redis: {
    host: string;
    password?: string;
    port: number;
  };
  roomServer: {
    host: string;
    port: number;
  };
  sessionSecret: string;
  smtp: {
    from: string;
    host: string;
    pass: string;
    port: number;
    user: string;
  };
  stripe: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  turnstile: {
    enabled: boolean;
    secretKey: string;
    siteKey: string;
  };
}

const config: AppConfig = {
  appUrl: process.env.APP_URL || '',
  awsS3: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || '',
    bucket: process.env.AWS_S3_BUCKET || '',
    endpoint: process.env.AWS_S3_ENDPOINT || undefined,
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
    publicUrl: process.env.AWS_S3_PUBLIC_URL || '',
    region: process.env.AWS_S3_REGION || '',
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || '',
  },
  db: {
    host: process.env.DB_HOST || '',
    name: process.env.DB_NAME || '',
    password: process.env.DB_PASSWORD || undefined,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || '',
  },
  googleOAuth: {
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'production',
  port: Number(process.env.PORT) || 3000,
  redis: {
    host: process.env.REDIS_HOST || '',
    password: process.env.REDIS_PASSWORD || undefined,
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  roomServer: {
    host: process.env.ROOM_SERVER_HOST || (process.env.DB_HOST === 'mysql' ? 'room-server' : '127.0.0.1'),
    port: Number(process.env.ROOM_SERVER_PORT) || 3001,
  },
  sessionSecret: process.env.SESSION_SECRET || '',
  smtp: {
    from: process.env.SMTP_FROM || '',
    host: process.env.SMTP_HOST || '',
    pass: process.env.SMTP_PASS || '',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
  },
  stripe: {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  turnstile: {
    enabled: process.env.CLOUDFLARE_TURNSTILE_ENABLED === 'true',
    secretKey: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || '',
    siteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || '',
  },
};

export {
  config
};

export type {
  AppConfig
};
