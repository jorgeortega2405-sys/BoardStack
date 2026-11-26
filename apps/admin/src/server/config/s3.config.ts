import { config } from './env.config.js';
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  credentials: {
    accessKeyId: config.awsS3.accessKeyId,
    secretAccessKey: config.awsS3.secretAccessKey,
  },
  endpoint: config.awsS3.endpoint || undefined,
  forcePathStyle: config.awsS3.forcePathStyle,
  region: config.awsS3.region,
});

export {
  s3Client
};
