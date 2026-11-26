interface AdminConfig {
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
    appName: string;
    coreName: string;
    host: string;
    password?: string;
    port: number;
    user: string;
  };
  host: string;
  nodeEnv: string;
  port: number;
  redis: {
    host: string;
    password?: string;
    port: number;
  };
  sessionSecret: string;
}

const config: AdminConfig = {
  appUrl: process.env.ADMIN_URL || process.env.APP_URL || '',
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
    appName: process.env.APP_DB_NAME || '',
    coreName: process.env.CORE_DB_NAME || '',
    host: process.env.DB_HOST || '',
    password: process.env.DB_PASSWORD || undefined,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || '',
  },
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'production',
  port: Number(process.env.ADMIN_PORT || process.env.PORT) || 3002,
  redis: {
    host: process.env.REDIS_HOST || '',
    password: process.env.REDIS_PASSWORD || undefined,
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  sessionSecret: process.env.SESSION_SECRET || '',
};

export {
  config
};

export type {
  AdminConfig
};
