import { config } from '../config/env.config.js';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { FileCategory, SanitizedFile } from '../utils/sanitizer.util.js';
import { logger } from '../utils/logger.js';
import { s3Client } from '../config/s3.config.js';
import { sanitizeUploadedFile } from '../utils/sanitizer.util.js';

interface UploadS3Params {
  body: Buffer | Uint8Array | string;
  cacheControl?: string;
  contentType: string;
  key: string;
}

interface UploadS3Result {
  bucket: string;
  key: string;
  url: string;
}

interface SanitizeAndUploadParams {
  allowedCategories?: FileCategory[];
  allowedMimeTypes?: string[];
  body: Buffer;
  cacheControl?: string;
  folder?: string;
  maxSizeBytes?: number;
  minSizeBytes?: number;
  originalName: string;
  prefix?: string;
}

interface SanitizeAndUploadResult extends UploadS3Result {
  sanitized: SanitizedFile;
}

function cleanS3Key(keyOrUrl: string): string {
  const bucket = config.awsS3.bucket;
  let key = keyOrUrl.trim();

  if (key.startsWith('http://') || key.startsWith('https://')) {
    try {
      const urlObj = new URL(key);
      key = urlObj.pathname;
    } catch {
      key = key.replace(/^https?:\/\/[^/]+/i, '');
    }
  }

  if (key.startsWith(`/${bucket}/`)) {
    key = key.substring(bucket.length + 2);
  } else if (key.startsWith(`${bucket}/`)) {
    key = key.substring(bucket.length + 1);
  }

  key = key.replace(/^\/+/, '').replace(/\.\.+/g, '');

  return key;
}

function getS3PublicUrl(keyOrUrl: string): string {
  const key = cleanS3Key(keyOrUrl);
  const base = config.awsS3.publicUrl.replace(/\/+$/, '');
  return `${base}/${key}`;
}

async function initS3Bucket(): Promise<boolean> {
  const bucketName = config.awsS3.bucket;
  if (!bucketName) {
    logger.system.warn('AWS S3 bucket name is not configured in environment.');
    return false;
  }

  try {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      logger.system.info(`AWS S3 bucket "${bucketName}" is ready.`);
    } catch {
      logger.system.info(`AWS S3 bucket "${bucketName}" not found. Creating it...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      logger.system.info(`AWS S3 bucket "${bucketName}" created successfully.`);
    }

    return true;
  } catch (error) {
    logger.system.error(`Failed to initialize AWS S3 bucket "${bucketName}":`, error);
    return false;
  }
}

async function uploadToS3(params: UploadS3Params): Promise<UploadS3Result> {
  const key = cleanS3Key(params.key);
  const bucket = config.awsS3.bucket;

  await s3Client.send(
    new PutObjectCommand({
      Body: params.body,
      Bucket: bucket,
      CacheControl: params.cacheControl || 'private, max-age=0, no-cache',
      ContentType: params.contentType,
      Key: key,
    })
  );

  const url = getS3PublicUrl(key);
  logger.app.info(`File uploaded to AWS S3: ${key} -> ${url}`);

  return {
    bucket,
    key,
    url,
  };
}

async function sanitizeAndUploadToS3(params: SanitizeAndUploadParams): Promise<SanitizeAndUploadResult> {
  const sanitized = sanitizeUploadedFile(
    params.body,
    {
      allowedCategories: params.allowedCategories,
      allowedMimeTypes: params.allowedMimeTypes,
      maxSizeBytes: params.maxSizeBytes,
      minSizeBytes: params.minSizeBytes,
      originalName: params.originalName,
    },
    params.prefix
  );

  const folder = params.folder ? params.folder.replace(/^\/+|\/+$/g, '') : '';
  const key = folder ? `${folder}/${sanitized.safeFilename}` : sanitized.safeFilename;

  const uploadResult = await uploadToS3({
    body: sanitized.buffer,
    cacheControl: params.cacheControl,
    contentType: sanitized.detectedMimeType,
    key,
  });

  return {
    ...uploadResult,
    sanitized,
  };
}

async function deleteFromS3(keyOrUrl: string): Promise<boolean> {
  const key = cleanS3Key(keyOrUrl);
  if (!key) return false;

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: config.awsS3.bucket,
        Key: key,
      })
    );
    logger.app.info(`File deleted from AWS S3: ${key}`);
    return true;
  } catch (error) {
    logger.app.error(`Failed to delete file from AWS S3 (${key}):`, error);
    return false;
  }
}

async function getS3Object(keyOrUrl: string) {
  const key = cleanS3Key(keyOrUrl);
  return await s3Client.send(
    new GetObjectCommand({
      Bucket: config.awsS3.bucket,
      Key: key,
    })
  );
}

export {
  cleanS3Key,
  deleteFromS3,
  getS3Object,
  getS3PublicUrl,
  initS3Bucket,
  sanitizeAndUploadToS3,
  uploadToS3
};

export type {
  SanitizeAndUploadParams,
  SanitizeAndUploadResult,
  UploadS3Params,
  UploadS3Result
};
