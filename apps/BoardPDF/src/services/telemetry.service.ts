import { config } from '../config/env.config.js';
import { redis } from '../config/redis.config.js';
import { logger } from './logger.service.js';
import crypto from 'crypto';

type TelemetryEventKind =
  | 'ai_collab'
  | 'application_error'
  | 'http_request'
  | 'pdf_processing'
  | 'security_auth'
  | 'storage_lifecycle';

interface QueuedTelemetryItem {
  payloadJson: string;
  type: TelemetryEventKind;
}

interface HttpRequestTelemetryInput {
  countryCode?: string;
  durationUs?: number;
  ip?: string;
  latencyMs: number;
  method: string;
  rawPath: string;
  requestBytes?: number;
  requestId?: string;
  responseBytes?: number;
  routePattern: string;
  statusCode: number;
  subscriptionTier?: string;
  userAgent?: string;
  userId?: number | null;
}

interface PdfProcessingTelemetryInput {
  clientType?: string;
  errorCode?: string;
  fileCount?: number;
  inputBytes?: number;
  isAuthenticated?: boolean;
  metadata?: Record<string, unknown>;
  operationId?: string;
  outputBytes?: number;
  pageCount?: number;
  processingMs: number;
  status: 'error' | 'success';
  storageProvider?: string;
  toolName: string;
  userId?: number | null;
}

interface SecurityAuthTelemetryInput {
  actorIdentifier?: string;
  eventType: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  outcome: 'allowed' | 'blocked' | 'failure' | 'pending' | 'success';
  reason?: string;
  routePattern?: string;
  severity?: 'critical' | 'high' | 'info' | 'low' | 'warn';
  userAgent?: string;
  userId?: number | null;
}

interface AiCollabTelemetryInput {
  documentId?: string;
  eventType: string;
  featureName: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
  status?: 'error' | 'rejected' | 'success';
  tokensConsumed?: number;
  tokensRemaining?: number;
  userId?: number | null;
}

interface StorageLifecycleTelemetryInput {
  bytesDelta?: number;
  eventType: string;
  fileCount?: number;
  fileId?: string;
  metadata?: Record<string, unknown>;
  objectKey?: string;
  status?: 'completed' | 'error' | 'expired' | 'pending';
  storageTier?: string;
  userId?: number | null;
}

interface ApplicationErrorTelemetryInput {
  errorCode?: string;
  errorName: string;
  message: string;
  metadata?: Record<string, unknown>;
  method?: string;
  requestId?: string;
  routePattern?: string;
  severity?: 'critical' | 'error' | 'warn';
  userId?: number | null;
}

const MAX_MEMORY_QUEUE = 10000;
const SENSITIVE_KEY_PATTERN = /(password|token|secret|cookie|authorization|csrf|signature|private_key)/i;

const queue: QueuedTelemetryItem[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

function hashSensitiveValue(rawValue?: string | null): string {
  if (!rawValue) return '';
  const normalized = String(rawValue).trim();
  if (!normalized) return '';
  if (config.telemetry.ipSalt) {
    return crypto.createHmac('sha256', config.telemetry.ipSalt).update(normalized).digest('hex');
  }
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function sanitizeMetadata(input?: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (!input || typeof input !== 'object' || depth > 3) {
    return {};
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      clean[key] = '[REDACTED]';
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'string') {
      clean[key] = value.slice(0, 512);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    } else if (Array.isArray(value)) {
      clean[key] = value.slice(0, 20).map((item) => (typeof item === 'string' ? item.slice(0, 128) : item));
    } else if (typeof value === 'object') {
      clean[key] = sanitizeMetadata(value as Record<string, unknown>, depth + 1);
    }
  }
  return clean;
}

function ensureFlushTimer(): void {
  if (flushTimer || !config.telemetry.enabled) {
    return;
  }
  flushTimer = setInterval(() => {
    void flushTelemetryQueue();
  }, config.telemetry.flushIntervalMs);
  if (typeof flushTimer.unref === 'function') {
    flushTimer.unref();
  }
}

function enqueueEvent(type: TelemetryEventKind, body: Record<string, unknown>): void {
  if (!config.telemetry.enabled) {
    return;
  }
  try {
    ensureFlushTimer();
    const enriched = {
      created_at: new Date().toISOString(),
      event_id: crypto.randomUUID(),
      service_name: config.telemetry.serviceName,
      ...body,
    };
    const payloadJson = JSON.stringify(enriched);
    if (queue.length >= MAX_MEMORY_QUEUE) {
      queue.shift();
    }
    queue.push({ payloadJson, type });

    if (queue.length >= config.telemetry.batchSize) {
      void flushTelemetryQueue();
    }
  } catch {
  }
}

async function flushTelemetryQueue(): Promise<void> {
  if (isFlushing || queue.length === 0) {
    return;
  }
  if (redis.status !== 'ready' && redis.status !== 'connect') {
    return;
  }

  isFlushing = true;
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, config.telemetry.batchSize);
      const pipeline = redis.pipeline();
      for (const item of batch) {
        pipeline.xadd(
          config.telemetry.streamKey,
          'MAXLEN',
          '~',
          String(config.telemetry.streamMaxLen),
          '*',
          'type',
          item.type,
          'payload',
          item.payloadJson
        );
      }
      await pipeline.exec();
    }
  } catch (err) {
    logger.db.warn('Telemetry Redis stream flush failed (fail-open)', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isFlushing = false;
  }
}

function trackHttpRequest(input: HttpRequestTelemetryInput): void {
  enqueueEvent('http_request', {
    country_code: (input.countryCode || '').slice(0, 16),
    duration_us: Math.max(0, Math.round(input.durationUs ?? input.latencyMs * 1000)),
    ip_hash: hashSensitiveValue(input.ip),
    latency_ms: Math.max(0, Math.round(input.latencyMs)),
    method: input.method.toUpperCase().slice(0, 16),
    raw_path: input.rawPath.slice(0, 512),
    request_bytes: Math.max(0, Math.round(input.requestBytes || 0)),
    request_id: input.requestId || crypto.randomUUID(),
    response_bytes: Math.max(0, Math.round(input.responseBytes || 0)),
    route_pattern: input.routePattern.slice(0, 256),
    status_code: input.statusCode,
    subscription_tier: (input.subscriptionTier || 'anonymous').slice(0, 32),
    user_agent: (input.userAgent || '').slice(0, 512),
    user_id: input.userId ?? null,
  });
}

function trackPdfProcessing(input: PdfProcessingTelemetryInput): void {
  enqueueEvent('pdf_processing', {
    client_type: (input.clientType || 'web').slice(0, 32),
    error_code: (input.errorCode || '').slice(0, 64),
    file_count: Math.max(0, Math.round(input.fileCount ?? 1)),
    input_bytes: Math.max(0, Math.round(input.inputBytes || 0)),
    is_authenticated: Boolean(input.isAuthenticated ?? Boolean(input.userId)),
    metadata: sanitizeMetadata(input.metadata),
    operation_id: input.operationId || crypto.randomUUID(),
    output_bytes: Math.max(0, Math.round(input.outputBytes || 0)),
    page_count: Math.max(0, Math.round(input.pageCount || 0)),
    processing_ms: Math.max(0, Math.round(input.processingMs)),
    status: input.status,
    storage_provider: (input.storageProvider || 's3').slice(0, 32),
    tool_name: (input.toolName || 'general').slice(0, 64),
    user_id: input.userId ?? null,
  });
}

function trackSecurityEvent(input: SecurityAuthTelemetryInput): void {
  enqueueEvent('security_auth', {
    actor_hash: hashSensitiveValue(input.actorIdentifier),
    event_type: input.eventType.slice(0, 64),
    ip_hash: hashSensitiveValue(input.ip),
    metadata: sanitizeMetadata(input.metadata),
    outcome: input.outcome,
    reason: (input.reason || '').slice(0, 256),
    route_pattern: (input.routePattern || '').slice(0, 256),
    severity: input.severity || 'info',
    user_agent: (input.userAgent || '').slice(0, 512),
    user_id: input.userId ?? null,
  });
}

function trackAiCollabEvent(input: AiCollabTelemetryInput): void {
  enqueueEvent('ai_collab', {
    document_id: (input.documentId || '').slice(0, 64),
    event_type: input.eventType.slice(0, 64),
    feature_name: (input.featureName || 'general').slice(0, 64),
    latency_ms: Math.max(0, Math.round(input.latencyMs || 0)),
    metadata: sanitizeMetadata(input.metadata),
    status: input.status || 'success',
    tokens_consumed: Math.max(0, Math.round(input.tokensConsumed || 0)),
    tokens_remaining: Math.max(0, Math.round(input.tokensRemaining || 0)),
    user_id: input.userId ?? null,
  });
}

function trackStorageEvent(input: StorageLifecycleTelemetryInput): void {
  enqueueEvent('storage_lifecycle', {
    bytes_delta: Math.round(input.bytesDelta || 0),
    event_type: input.eventType.slice(0, 64),
    file_count: Math.max(0, Math.round(input.fileCount ?? 1)),
    file_id: (input.fileId || '').slice(0, 128),
    metadata: sanitizeMetadata(input.metadata),
    object_key: (input.objectKey || '').slice(0, 512),
    status: input.status || 'completed',
    storage_tier: (input.storageTier || 's3_hot').slice(0, 32),
    user_id: input.userId ?? null,
  });
}

function trackApplicationError(input: ApplicationErrorTelemetryInput): void {
  enqueueEvent('application_error', {
    error_code: (input.errorCode || '').slice(0, 64),
    error_name: (input.errorName || 'Error').slice(0, 128),
    message: (input.message || 'Unexpected error').slice(0, 1024),
    metadata: sanitizeMetadata(input.metadata),
    method: (input.method || '').toUpperCase().slice(0, 16),
    request_id: input.requestId || crypto.randomUUID(),
    route_pattern: (input.routePattern || '').slice(0, 256),
    severity: input.severity || 'error',
    user_id: input.userId ?? null,
  });
}

export {
  flushTelemetryQueue,
  trackAiCollabEvent,
  trackApplicationError,
  trackHttpRequest,
  trackPdfProcessing,
  trackSecurityEvent,
  trackStorageEvent,
};
export type {
  AiCollabTelemetryInput,
  ApplicationErrorTelemetryInput,
  HttpRequestTelemetryInput,
  PdfProcessingTelemetryInput,
  SecurityAuthTelemetryInput,
  StorageLifecycleTelemetryInput,
};
