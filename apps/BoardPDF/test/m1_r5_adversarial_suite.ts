import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRedisConnection, redis } from '../src/config/redis.config.js';
import { handleAvatarRequest } from '../src/controllers/avatar.controller.js';
import authRouter from '../src/routes/auth.routes.js';
import { CACHE_KEYS, cacheService } from '../src/services/cache.service.js';
import { logger } from '../src/services/logger.service.js';
import { updateAvatar } from '../src/services/settings.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_ROOT_DIR = path.resolve(__dirname, '../logs');

interface MockResponse {
  body: any;
  headers: Record<string, string>;
  statusCode: number;
  json(data: any): MockResponse;
  send(data: any): MockResponse;
  setHeader(name: string, value: string): MockResponse;
  status(code: number): MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    body: null,
    headers: {},
    statusCode: 200,
    json(data: any) {
      this.body = data;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
  return res;
}

async function runAdversarialM1Suite(): Promise<void> {
  console.log('================================================================');
  console.log('CHALLENGER 1 (M1): EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
  console.log('================================================================');

  let totalTests = 0;
  let passedTests = 0;

  async function test(title: string, fn: () => void | Promise<void>): Promise<void> {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  [PASS] ${title}`);
    } catch (err: any) {
      console.error(`  [FAIL] ${title}`);
      console.error(err);
      throw err;
    }
  }

  // ============================================================================
  // SUITE 1: Logger Concurrency & Hierarchical Directory Structure Verification
  // ============================================================================
  console.log('\n--- SUITE 1: Logger Concurrency & Directory Structure ---');

  await test('writes 300 concurrent log messages across categories without file corruption', async () => {
    const categories: Array<'app' | 'db' | 'security'> = ['app', 'db', 'security'];
    const levels = ['info', 'warn', 'error', 'debug'] as const;
    const writePromises: Array<Promise<void>> = [];

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    for (let i = 0; i < 300; i++) {
      const cat = categories[i % categories.length];
      const level = levels[i % levels.length];
      const message = `Adversarial stress message batch ${i} category ${cat}`;
      const meta = {
        batchIndex: i,
        apiKey: `super_secret_key_${i}`,
        password: `P@ssw0rd_${i}`,
        token: `jwt_token_${i}`,
        safeData: `public_info_${i}`,
        nested: {
          secret: `nested_secret_${i}`,
          username: `user_${i}`,
        },
      };

      writePromises.push(
        new Promise<void>((resolve) => {
          logger[cat][level](message, meta);
          resolve();
        })
      );
    }

    await Promise.all(writePromises);
    await new Promise((resolve) => setTimeout(resolve, 300));

    for (const cat of categories) {
      const catDir = path.join(LOGS_ROOT_DIR, cat, dateStr);
      assert.ok(fs.existsSync(catDir), `Directory ${catDir} must exist`);

      const logFile = path.join(catDir, `${cat}.log`);
      assert.ok(fs.existsSync(logFile), `Log file ${logFile} must exist`);

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);

      const batchLines = lines.filter((l) => l.includes('Adversarial stress message batch'));
      assert.ok(batchLines.length >= 100, `Category ${cat} should contain at least 100 batch log entries`);

      for (const line of batchLines) {
        let parsed: any;
        try {
          parsed = JSON.parse(line);
        } catch (e: any) {
          assert.fail(`Batch log line is corrupted or not valid JSON: "${line}"`);
        }

        assert.strictEqual(parsed.category, cat);
        assert.ok(['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(parsed.level));
        assert.ok(typeof parsed.message === 'string');
        assert.ok(typeof parsed.timestamp === 'string');

        if (parsed.meta) {
          if (parsed.meta.password) {
            assert.strictEqual(parsed.meta.password, '[REDACTED]');
          }
          if (parsed.meta.apiKey) {
            assert.strictEqual(parsed.meta.apiKey, '[REDACTED]');
          }
          if (parsed.meta.token) {
            assert.strictEqual(parsed.meta.token, '[REDACTED]');
          }
          if (parsed.meta.nested && parsed.meta.nested.secret) {
            assert.strictEqual(parsed.meta.nested.secret, '[REDACTED]');
          }
        }
      }
    }
  });

  await test('handles Error instances with sensitive fields sanitized', async () => {
    const errorWithSecret = new Error('Database connection failed');
    (errorWithSecret as any).password = 'my_db_password_123';
    (errorWithSecret as any).secretToken = 'my_secret_token_abc';

    logger.db.error('Error logging test', errorWithSecret);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const dateStr = new Date().toISOString().split('T')[0];
    const logFile = path.join(LOGS_ROOT_DIR, 'db', dateStr, 'db.log');
    const content = fs.readFileSync(logFile, 'utf8');
    assert.ok(content.includes('Database connection failed'));
    assert.ok(!content.includes('my_db_password_123'));
    assert.ok(!content.includes('my_secret_token_abc'));
  });

  // ============================================================================
  // SUITE 2: Centralized Cache Invalidation Key Eviction Verification
  // ============================================================================
  console.log('\n--- SUITE 2: Centralized Redis Cache Invalidation Key Eviction ---');

  const isRedisOnline = await checkRedisConnection(2, 200);

  if (isRedisOnline) {
    await test('cacheService.invalidateUser evicts all base keys plus email and username', async () => {
      const testUserId = 'test_stress_user_42';
      const testEmail = 'StressTester@Example.COM';
      const testUsername = '  StressUser42  ';

      const normalizedEmail = testEmail.toLowerCase().trim();
      const normalizedUsername = testUsername.toLowerCase().trim();

      const expectedKeys = [
        CACHE_KEYS.userById(testUserId),
        CACHE_KEYS.userProfile(testUserId),
        `user:cache:${testUserId}`,
        CACHE_KEYS.userPerms(testUserId),
        `user:permissions:${testUserId}`,
        CACHE_KEYS.userBilling(testUserId),
        CACHE_KEYS.userEmail(normalizedEmail),
        CACHE_KEYS.userUsername(normalizedUsername),
      ];

      const controlKey = `cache:user:id:unrelated_control_user_99`;

      for (const k of expectedKeys) {
        await redis.set(k, JSON.stringify({ cached: true, key: k }));
      }
      await redis.set(controlKey, JSON.stringify({ cached: true, key: controlKey }));

      for (const k of expectedKeys) {
        const val = await redis.get(k);
        assert.ok(val !== null, `Key ${k} must exist prior to invalidation`);
      }
      assert.ok((await redis.get(controlKey)) !== null, 'Control key must exist');

      await cacheService.invalidateUser(testUserId, testEmail, testUsername);

      for (const k of expectedKeys) {
        const val = await redis.get(k);
        assert.strictEqual(val, null, `Key ${k} must be evicted by invalidateUser`);
      }

      const controlVal = await redis.get(controlKey);
      assert.ok(controlVal !== null, 'Control key must NOT be evicted by invalidateUser');
      await redis.del(controlKey);
    });

    await test('cacheService.invalidateUserPrefs evicts prefs key', async () => {
      const testUserId = 'test_prefs_stress_88';
      const prefKey = CACHE_KEYS.userPrefs(testUserId);
      await redis.set(prefKey, '{"theme":"dark"}');

      await cacheService.invalidateUserPrefs(testUserId);
      const val = await redis.get(prefKey);
      assert.strictEqual(val, null, `Prefs key ${prefKey} must be evicted`);
    });

    await test('cacheService handles edge cases (undefined identifiers, empty del) gracefully', async () => {
      const testUserId = 'test_edge_user_55';
      const userKey = CACHE_KEYS.userById(testUserId);
      await redis.set(userKey, 'test');

      await cacheService.invalidateUser(testUserId, undefined, undefined);
      const val = await redis.get(userKey);
      assert.strictEqual(val, null, 'User key must be evicted even with undefined email/username');

      const delEmpty = await cacheService.del();
      assert.strictEqual(delEmpty, false, 'cacheService.del() with no keys returns false without throwing');
    });
  } else {
    console.log('  [WARN] Redis offline, skipping live Redis key eviction tests');
  }

  // ============================================================================
  // SUITE 3: Avatar Delivery Throttling Immunity & S3 Error Handling
  // ============================================================================
  console.log('\n--- SUITE 3: Avatar Delivery Throttling Immunity & S3 Error Handling ---');

  await test('GET /avatar route in authRouter has no rate-limiting middleware attached', () => {
    const avatarRoute = (authRouter as any).stack.find((layer: any) => {
      return layer.route && layer.route.path === '/avatar';
    });

    assert.ok(avatarRoute, 'Route /avatar must exist in authRouter');
    assert.strictEqual(avatarRoute.route.methods.get, true, '/avatar must support GET');

    const middlewareNames = avatarRoute.route.stack.map((s: any) => s.name);
    assert.ok(!middlewareNames.includes('avatarLimiter'), 'avatarLimiter must NOT be attached to /avatar');
    assert.ok(!middlewareNames.some((n: string) => n.toLowerCase().includes('limiter')), 'No rate limiters should wrap /avatar');
    assert.ok(middlewareNames.includes('handleAvatarRequest'), 'handleAvatarRequest must be the handler');
  });

  await test('handleAvatarRequest responds to 50 rapid requests with 200 SVG and zero 429 errors', () => {
    for (let i = 0; i < 50; i++) {
      const req: any = {
        query: {
          name: `User ${i}`,
          size: 100 + (i % 20),
        },
      };
      const res = createMockResponse();

      handleAvatarRequest(req, res as any);

      assert.strictEqual(res.statusCode, 200, `Request ${i} must return HTTP 200`);
      assert.ok(res.headers['content-type'].includes('image/svg+xml'), 'Must return image/svg+xml');
      assert.ok(typeof res.body === 'string' && res.body.startsWith('<svg'), 'Body must be valid SVG string');
      assert.ok(res.body.includes(`User ${i}`[0]), 'SVG must contain the initial letter');
    }
  });

  await test('updateAvatar rejects oversized image (>2MB) without writing to storage', async () => {
    const oversizedBuffer = Buffer.alloc(2 * 1024 * 1024 + 1024);
    const mockFile: any = {
      buffer: oversizedBuffer,
      size: oversizedBuffer.length,
    };

    const result = await updateAvatar(1, mockFile);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'La imagen supera el límite permitido de 2 MB.');
  });

  await test('updateAvatar rejects invalid magic bytes', async () => {
    const invalidBuffer = Buffer.from('NOT_AN_IMAGE_CONTENT');
    const mockFile: any = {
      buffer: invalidBuffer,
      size: invalidBuffer.length,
    };

    const result = await updateAvatar(1, mockFile);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Formato de imagen no compatible. Usa PNG, JPG o WEBP.');
  });

  await test('updateAvatar cleans up temporary file on disk in finally block even on failure', async () => {
    const tempFilePath = path.join(os.tmpdir(), `test_avatar_adversarial_${Date.now()}.png`);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    await fs.promises.writeFile(tempFilePath, pngHeader);

    assert.ok(fs.existsSync(tempFilePath), 'Temp file must exist before updateAvatar call');

    const mockFile: any = {
      path: tempFilePath,
      size: pngHeader.length,
    };

    const result = await updateAvatar(999999999, mockFile);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Usuario no encontrado.');

    assert.strictEqual(
      fs.existsSync(tempFilePath),
      false,
      'Temporary file on disk must be strictly unlinked in finally block'
    );
  });

  // ============================================================================
  // SUITE 4: Database Cleanliness & Monorepo Reorganization Verification
  // ============================================================================
  console.log('\n--- SUITE 4: Database Cleanliness & Monorepo Structure ---');

  await test('database/migrations folder is completely deleted', () => {
    const migrationsPath = path.resolve(__dirname, '../../../database/migrations');
    assert.strictEqual(fs.existsSync(migrationsPath), false, 'database/migrations must NOT exist');
  });

  await test('canonical database/db_identity.sql exists and contains consolidated schemas', () => {
    const dbIdentityPath = path.resolve(__dirname, '../../../database/db_identity.sql');
    assert.ok(fs.existsSync(dbIdentityPath), 'database/db_identity.sql must exist');
    const sql = fs.readFileSync(dbIdentityPath, 'utf8');
    assert.ok(sql.includes('ai_tokens_balance'), 'Must include ai_tokens_balance');
    assert.ok(sql.includes('project_folders'), 'Must include project_folders');
    assert.ok(sql.includes('user_cloud_integrations'), 'Must include user_cloud_integrations');
    assert.ok(!sql.includes('user_roles'), 'Must NOT include user_roles');
  });

  await test('apps/BoardPDF/collab-server and apps/BoardPDF/board-wasm are present in new locations', () => {
    const collabServerCargo = path.resolve(__dirname, '../collab-server/Cargo.toml');
    const boardWasmCargo = path.resolve(__dirname, '../board-wasm/Cargo.toml');

    assert.ok(fs.existsSync(collabServerCargo), 'apps/BoardPDF/collab-server/Cargo.toml must exist');
    assert.ok(fs.existsSync(boardWasmCargo), 'apps/BoardPDF/board-wasm/Cargo.toml must exist');

    const oldCollab = path.resolve(__dirname, '../../../apps/collab-server');
    const oldWasm = path.resolve(__dirname, '../../../apps/board-wasm');
    assert.strictEqual(fs.existsSync(oldCollab), false, 'apps/collab-server must not exist in old location');
    assert.strictEqual(fs.existsSync(oldWasm), false, 'apps/board-wasm must not exist in old location');
  });

  console.log('\n================================================================');
  console.log(`ALL ADVERSARIAL TESTS COMPLETED: ${passedTests}/${totalTests} PASSED`);
  console.log('================================================================\n');

  if (redis.status === 'ready' || redis.status === 'connecting') {
    await redis.quit();
  }
  process.exit(0);
}

runAdversarialM1Suite().catch((err) => {
  console.error('Adversarial suite encountered a critical failure:', err);
  process.exit(1);
});
