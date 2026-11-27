import { csrfProtectionMiddleware } from '../src/server/middlewares/csrf.middleware.js';
import {
  FileSanitizationError,
  detectFileSignature,
  generateSafeFilename,
  sanitizeUploadedFile,
} from '../src/server/utils/sanitizer.util.js';
import assert from 'node:assert/strict';
import test from 'node:test';

interface MockResponse {
  body: any;
  headers: Record<string, string>;
  statusCode: number;
  json(data: any): this;
  status(code: number): this;
}

function createMockResponse(): MockResponse {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    json(data: any) {
      this.body = data;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
}

test('csrf middleware allows safe http methods and exempt webhook endpoints', () => {
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  const safeReq = {
    headers: {},
    method: 'GET',
    path: '/api/rooms',
  } as any;
  const res = createMockResponse() as any;

  csrfProtectionMiddleware(safeReq, res, next);
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);

  nextCalled = false;
  const webhookReq = {
    headers: {},
    method: 'POST',
    path: '/api/subscription/webhook',
  } as any;

  csrfProtectionMiddleware(webhookReq, res, next);
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);

  nextCalled = false;
  const samlAcsReq = {
    headers: {},
    method: 'POST',
    path: '/api/auth/sso/saml/acs',
  } as any;

  csrfProtectionMiddleware(samlAcsReq, res, next);
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('csrf middleware rejects cross-site, missing headers, and mismatched origins', () => {
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  const crossSiteReq = {
    headers: {
      'host': 'boardstack.local',
      'origin': 'http://boardstack.local',
      'sec-fetch-site': 'cross-site',
    },
    method: 'POST',
    path: '/api/auth/login',
  } as any;
  const crossSiteRes = createMockResponse() as any;
  csrfProtectionMiddleware(crossSiteReq, crossSiteRes, next);
  assert.equal(nextCalled, false);
  assert.equal(crossSiteRes.statusCode, 403);

  const missingHeadersReq = {
    headers: {
      host: 'boardstack.local',
    },
    method: 'POST',
    path: '/api/auth/login',
  } as any;
  const missingHeadersRes = createMockResponse() as any;
  csrfProtectionMiddleware(missingHeadersReq, missingHeadersRes, next);
  assert.equal(nextCalled, false);
  assert.equal(missingHeadersRes.statusCode, 403);

  const mismatchedOriginReq = {
    headers: {
      host: 'boardstack.local',
      origin: 'http://attacker.example.com',
    },
    method: 'POST',
    path: '/api/auth/login',
  } as any;
  const mismatchedOriginRes = createMockResponse() as any;
  csrfProtectionMiddleware(mismatchedOriginReq, mismatchedOriginRes, next);
  assert.equal(nextCalled, false);
  assert.equal(mismatchedOriginRes.statusCode, 403);

  const validReq = {
    headers: {
      host: 'boardstack.local',
      origin: 'http://boardstack.local',
    },
    method: 'POST',
    path: '/api/auth/login',
  } as any;
  const validRes = createMockResponse() as any;
  csrfProtectionMiddleware(validReq, validRes, next);
  assert.equal(nextCalled, true);
  assert.equal(validRes.statusCode, 200);
});

test('sanitizer rejects dangerous executable binaries by magic bytes', () => {
  const windowsPeBuffer = Buffer.concat([
    Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
    Buffer.alloc(24, 0x00),
  ]);
  assert.throws(
    () => {
      sanitizeUploadedFile(windowsPeBuffer, {
        allowedCategories: ['any'],
        originalName: 'payload.exe',
      });
    },
    (err: any) => err instanceof FileSanitizationError && err.code === 'DANGEROUS_BINARY_DETECTED'
  );

  const linuxElfBuffer = Buffer.concat([
    Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]),
    Buffer.alloc(24, 0x00),
  ]);
  assert.throws(
    () => {
      sanitizeUploadedFile(linuxElfBuffer, {
        allowedCategories: ['any'],
        originalName: 'exploit.bin',
      });
    },
    (err: any) => err instanceof FileSanitizationError && err.code === 'DANGEROUS_BINARY_DETECTED'
  );
});

test('sanitizer detects valid png image signature and generates safe filename', () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const detected = detectFileSignature(pngHeader);
  assert.ok(detected);
  assert.equal(detected?.canonicalExtension, '.png');
  assert.equal(detected?.category, 'image');
  assert.equal(detected?.mimeType, 'image/png');

  const dangerousName = '../../etc/passwd..//avatar..png';
  const safe = generateSafeFilename(dangerousName, '.png', 'avatar');
  assert.ok(!safe.includes('/'));
  assert.ok(!safe.includes('\\'));
  assert.ok(!safe.includes('..'));
  assert.ok(safe.endsWith('.png'));
  assert.ok(safe.startsWith('avatar_'));
});
