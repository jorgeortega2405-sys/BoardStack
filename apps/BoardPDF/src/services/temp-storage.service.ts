import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { redis } from '../config/redis.config.js';
import { ensureBucketExists, isS3Configured, S3_BUCKET_NAME, s3Client } from '../config/s3.config.js';
import { markFileOperationDeleted, markFileOperationExpired, recordFileOperation } from './db-storage-log.service.js';
import { type GeneratedTokenResult, generateDownloadToken, verifyDownloadToken } from './download-token.service.js';
import { logger } from './logger.service.js';

export interface StoredTempFile {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  [key: string]: any;
}

export interface StoredTempFileMeta {
  contentType: string;
  createdAt: number;
  filename: string;
  fileSize?: number;
  size?: number;
  [key: string]: any;
}

export interface TempFileStreamResult {
  contentType: string;
  fileSize: number;
  filename: string;
  stream: Readable;
}

const memoryStore = new Map<string, StoredTempFile>();
const memoryMetaStore = new Map<string, StoredTempFileMeta>();
const PREFIX_META = 'tempfile:meta:';
const EXPIRATION_QUEUE_KEY = 's3:expiration_queue';
export const DEFAULT_TTL_SECONDS = 60 * 60;

setInterval(() => {
  const now = Date.now();
  const maxAgeMs = DEFAULT_TTL_SECONDS * 1000;

  for (const [key, item] of memoryStore.entries()) {
    if (now - item.createdAt > maxAgeMs) {
      memoryStore.delete(key);
    }
  }

  for (const [key, item] of memoryMetaStore.entries()) {
    if (now - item.createdAt > maxAgeMs) {
      memoryMetaStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function buildS3Key(token: string): string {
  return `temp/${token}`;
}

function resolveTokenInternalId(rawToken: string): { expired: boolean; fileId: string } {
  const verified = verifyDownloadToken(rawToken);
  if (verified.valid) {
    return { expired: false, fileId: verified.fileId };
  }
  if (verified.expired) {
    return { expired: true, fileId: verified.fileId };
  }
  return { expired: false, fileId: rawToken };
}

export async function storeTempFile(
  token: string,
  file: StoredTempFile,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<GeneratedTokenResult> {
  if (!file.createdAt) {
    file.createdAt = Date.now();
  }
  if (!file.fileSize && file.buffer) {
    file.fileSize = file.buffer.length;
  }
  if (!file.size && file.buffer) {
    file.size = file.buffer.length;
  }

  const { buffer, ...meta } = file;
  memoryMetaStore.set(token, meta);

  if (redis.status === 'ready') {
    try {
      await redis.set(`${PREFIX_META}${token}`, JSON.stringify(meta), 'EX', ttlSeconds);
      const expiresAtEpoch = Math.floor(Date.now() / 1000) + ttlSeconds;
      await redis.zadd(EXPIRATION_QUEUE_KEY, expiresAtEpoch, token);
    } catch {}
  }

  if (isS3Configured()) {
    const isReady = await ensureBucketExists();
    if (isReady) {
      try {
        const s3Key = buildS3Key(token);
        const metadata: Record<string, string> = {
          createdat: String(file.createdAt),
          filename: encodeURIComponent(file.filename || 'documento.pdf'),
          ttlseconds: String(ttlSeconds),
        };
        if (file.contentType) {
          metadata.contenttype = file.contentType;
        }

        await s3Client.send(
          new PutObjectCommand({
            Body: buffer,
            Bucket: S3_BUCKET_NAME,
            ContentType: file.contentType || 'application/octet-stream',
            Key: s3Key,
            Metadata: metadata,
          })
        );

        await recordFileOperation({
          fileSize: file.fileSize,
          filename: file.filename || 'documento.pdf',
          mimeType: file.contentType || file.mimeType || 'application/pdf',
          s3Bucket: S3_BUCKET_NAME,
          s3Key,
          token,
          toolName: file.toolName || 'general',
          ttlSeconds,
        });

        return generateDownloadToken(token, file.filename || 'documento.pdf', ttlSeconds);
      } catch (err) {
        logger.db.warn('Error al guardar archivo en AWS S3 / MinIO', err);
      }
    }
  }

  memoryStore.set(token, file);
  return generateDownloadToken(token, file.filename || 'documento.pdf', ttlSeconds);
}

export async function getTempFile<T extends StoredTempFile = StoredTempFile>(
  token: string
): Promise<T | null> {
  const resolved = resolveTokenInternalId(token);
  if (resolved.expired) return null;
  const storageToken = resolved.fileId;

  const meta = await getTempFileMeta(storageToken);
  if (meta && meta.createdAt) {
    const now = Date.now();
    const ttlMs = (meta.ttlSeconds || DEFAULT_TTL_SECONDS) * 1000;
    if (now - meta.createdAt > ttlMs) {
      await deleteTempFile(storageToken);
      await markFileOperationExpired(storageToken);
      return null;
    }
  }

  if (isS3Configured()) {
    try {
      const s3Key = buildS3Key(storageToken);
      const res = await s3Client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: s3Key,
        })
      );

      if (res.Body) {
        const byteArray = await res.Body.transformToByteArray();
        const buffer = Buffer.from(byteArray);
        const resolvedMeta = meta || {
          contentType: res.ContentType || 'application/octet-stream',
          createdAt: Number(res.Metadata?.createdat || Date.now()),
          filename: res.Metadata?.filename ? decodeURIComponent(res.Metadata.filename) : 'documento.pdf',
        };

        return {
          ...resolvedMeta,
          buffer,
          fileSize: buffer.length,
          size: buffer.length,
        } as unknown as T;
      }
    } catch (err: any) {
      const isNotFound = err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey';
      if (!isNotFound) {
        logger.db.warn('Error al recuperar archivo temporal de S3', err);
      }
    }
  }

  const local = memoryStore.get(storageToken);
  return (local as unknown as T) || null;
}

export async function getTempFileStream(token: string): Promise<TempFileStreamResult | null> {
  const resolved = resolveTokenInternalId(token);
  if (resolved.expired) return null;
  const storageToken = resolved.fileId;

  const meta = await getTempFileMeta(storageToken);
  if (meta && meta.createdAt) {
    const now = Date.now();
    const ttlMs = (meta.ttlSeconds || DEFAULT_TTL_SECONDS) * 1000;
    if (now - meta.createdAt > ttlMs) {
      await deleteTempFile(storageToken);
      await markFileOperationExpired(storageToken);
      return null;
    }
  }

  if (isS3Configured()) {
    try {
      const s3Key = buildS3Key(storageToken);
      const res = await s3Client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: s3Key,
        })
      );

      if (res.Body) {
        const stream = res.Body as Readable;
        const resolvedFilename = meta?.filename || (res.Metadata?.filename ? decodeURIComponent(res.Metadata.filename) : 'documento.pdf');
        const resolvedContentType = res.ContentType || meta?.contentType || 'application/octet-stream';
        const resolvedSize = res.ContentLength || meta?.fileSize || meta?.size || 0;

        return {
          contentType: resolvedContentType,
          fileSize: resolvedSize,
          filename: resolvedFilename,
          stream,
        };
      }
    } catch (err: any) {
      const isNotFound = err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey';
      if (!isNotFound) {
        logger.db.warn('Error al obtener stream de S3', err);
      }
    }
  }

  const fallbackFile = await getTempFile(storageToken);
  if (fallbackFile && fallbackFile.buffer) {
    const stream = Readable.from(fallbackFile.buffer);
    return {
      contentType: fallbackFile.contentType || 'application/octet-stream',
      fileSize: fallbackFile.buffer.length,
      filename: fallbackFile.filename || 'documento.pdf',
      stream,
    };
  }

  return null;
}

export async function getTempFileMeta(token: string): Promise<StoredTempFileMeta | null> {
  const resolved = resolveTokenInternalId(token);
  if (resolved.expired) return null;
  const storageToken = resolved.fileId;

  if (redis.status === 'ready') {
    try {
      const metaKey = `${PREFIX_META}${storageToken}`;
      const rawMeta = await redis.get(metaKey);
      if (rawMeta) {
        return JSON.parse(rawMeta);
      }
    } catch (err) {
      logger.db.warn('Error al recuperar metadatos de archivo temporal de Redis', err);
    }
  }

  const memoryMeta = memoryMetaStore.get(storageToken);
  if (memoryMeta) {
    return memoryMeta;
  }

  const local = memoryStore.get(storageToken);
  if (local) {
    const { buffer, ...meta } = local;
    return meta;
  }

  if (isS3Configured()) {
    try {
      const s3Key = buildS3Key(storageToken);
      const head = await s3Client.send(
        new HeadObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: s3Key,
        })
      );

      const filename = head.Metadata?.filename ? decodeURIComponent(head.Metadata.filename) : 'documento.pdf';
      const createdAt = head.Metadata?.createdat ? Number(head.Metadata.createdat) : Date.now();
      const ttlSeconds = head.Metadata?.ttlseconds ? Number(head.Metadata.ttlseconds) : DEFAULT_TTL_SECONDS;

      return {
        contentType: head.ContentType || 'application/octet-stream',
        createdAt,
        fileSize: head.ContentLength || 0,
        filename,
        size: head.ContentLength || 0,
        ttlSeconds,
      };
    } catch {}
  }

  return null;
}

export async function getTempFilePresignedUrl(token: string, expiresInSeconds: number = DEFAULT_TTL_SECONDS): Promise<string | null> {
  if (!isS3Configured()) {
    return null;
  }

  const resolved = resolveTokenInternalId(token);
  if (resolved.expired) return null;
  const storageToken = resolved.fileId;

  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: buildS3Key(storageToken),
    });
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  } catch (err) {
    logger.db.warn('Error al generar URL prefirmada S3', err);
    return null;
  }
}

export async function deleteTempFile(token: string): Promise<void> {
  const resolved = resolveTokenInternalId(token);
  const storageToken = resolved.fileId;

  memoryStore.delete(storageToken);
  memoryMetaStore.delete(storageToken);

  if (isS3Configured()) {
    try {
      const s3Key = buildS3Key(storageToken);
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: s3Key,
        })
      );
    } catch (err) {
      logger.db.warn('Error al eliminar archivo temporal en S3', err);
    }
  }

  if (redis.status === 'ready') {
    try {
      await redis.zrem(EXPIRATION_QUEUE_KEY, storageToken);
      await redis.del(`${PREFIX_META}${storageToken}`);
    } catch (err) {
      logger.db.warn('Error al eliminar metadatos de archivo temporal en Redis', err);
    }
  }

  await markFileOperationDeleted(storageToken);
}

export { type GeneratedTokenResult, generateDownloadToken, verifyDownloadToken };
