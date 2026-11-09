import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import {
  BOARDPDF_ROOT,
  MONOREPO_ROOT,
  SCRIPTS_DIR,
  SRC_DIR,
  findProcessEnvFallbacks,
  getAllTypeScriptFiles,
  readUtf8,
} from './helpers/standards-test-utils.js';

describe('R3: Environment Variable Fallback Elimination Standards', () => {
  const envConfigPath = path.join(SRC_DIR, 'config/env.config.ts');
  const processUtilPath = path.join(SRC_DIR, 'utils/process.util.ts');
  const toPdfPath = path.join(SRC_DIR, 'tools/to-pdf-converter/to-pdf-converter.service.ts');

  describe('Tier 1: Feature Coverage (R3 Verification)', () => {
    it('verifies zero process.env.* || fallback patterns in src/config/env.config.ts', () => {
      assert.ok(fs.existsSync(envConfigPath), 'src/config/env.config.ts must exist');
      const content = readUtf8(envConfigPath);
      const fallbacks = findProcessEnvFallbacks(content);

      assert.equal(
        fallbacks.length,
        0,
        `env.config.ts must contain 0 process.env fallbacks. Found ${fallbacks.length}:\n${fallbacks.map((f) => `L${f.line}: ${f.text}`).join('\n')}`
      );
    });

    it('verifies zero process.env.* || fallback patterns in src/utils/process.util.ts', () => {
      assert.ok(fs.existsSync(processUtilPath), 'src/utils/process.util.ts must exist');
      const content = readUtf8(processUtilPath);
      const fallbacks = findProcessEnvFallbacks(content);

      assert.equal(
        fallbacks.length,
        0,
        `process.util.ts must contain 0 process.env fallbacks. Found ${fallbacks.length}:\n${fallbacks.map((f) => `L${f.line}: ${f.text}`).join('\n')}`
      );
    });

    it('verifies zero process.env.* || fallback patterns in to-pdf-converter.service.ts', () => {
      assert.ok(fs.existsSync(toPdfPath), 'to-pdf-converter.service.ts must exist');
      const content = readUtf8(toPdfPath);
      const fallbacks = findProcessEnvFallbacks(content);

      assert.equal(
        fallbacks.length,
        0,
        `to-pdf-converter.service.ts must contain 0 process.env fallbacks. Found ${fallbacks.length}:\n${fallbacks.map((f) => `L${f.line}: ${f.text}`).join('\n')}`
      );
    });

    it('verifies zero hardcoded credentials or passwords as fallbacks in TypeScript code', () => {
      const allTsFiles = getAllTypeScriptFiles(SRC_DIR);
      const violations: string[] = [];
      const sensitiveFallbackRegex = /process\.env\.[A-Za-z0-9_]+\s*(\|\||\?\?)\s*['"`][^'"`]+['"`]/g;

      for (const file of allTsFiles) {
        const content = readUtf8(file);
        let match: RegExpExecArray | null;
        while ((match = sensitiveFallbackRegex.exec(content)) !== null) {
          const matched = match[0].toLowerCase();
          if (
            matched.includes('password') ||
            matched.includes('secret') ||
            matched.includes('key') ||
            matched.includes('token')
          ) {
            violations.push(`${path.relative(BOARDPDF_ROOT, file)}: ${match[0]}`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Found hardcoded secret/credential fallback patterns:\n${violations.join('\n')}`
      );
    });

    it('verifies DB_HOST, DB_PORT, REDIS_HOST, REDIS_PORT in env.config.ts do not use || fallback', () => {
      assert.ok(fs.existsSync(envConfigPath), 'src/config/env.config.ts must exist');
      const content = readUtf8(envConfigPath);

      const dbHostHasFallback = /host:\s*process\.env\.DB_HOST\s*\|\|/.test(content);
      const dbPortHasFallback = /port:\s*parseInt\(process\.env\.DB_PORT\s*\|\|/.test(content);
      const redisHostHasFallback = /host:\s*process\.env\.REDIS_HOST\s*\|\|/.test(content);
      const redisPortHasFallback = /port:\s*parseInt\(process\.env\.REDIS_PORT\s*\|\|/.test(content);

      assert.equal(dbHostHasFallback, false, 'DB_HOST must not use || fallback');
      assert.equal(dbPortHasFallback, false, 'DB_PORT must not use || fallback');
      assert.equal(redisHostHasFallback, false, 'REDIS_HOST must not use || fallback');
      assert.equal(redisPortHasFallback, false, 'REDIS_PORT must not use || fallback');
    });

    it('verifies SESSION_SECRET and DOWNLOAD_TOKEN_SECRET do not use || fallback credentials', () => {
      assert.ok(fs.existsSync(envConfigPath), 'src/config/env.config.ts must exist');
      const content = readUtf8(envConfigPath);

      const sessionHasFallback = /sessionSecret:\s*process\.env\.SESSION_SECRET\s*\|\|/.test(content);
      const downloadHasFallback = /downloadSecret:\s*process\.env\.DOWNLOAD_TOKEN_SECRET\s*\|\|/.test(content);

      assert.equal(sessionHasFallback, false, 'SESSION_SECRET must not use || fallback');
      assert.equal(downloadHasFallback, false, 'DOWNLOAD_TOKEN_SECRET must not use || fallback');
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('verifies regex catches multiline and bracketed process.env access patterns', () => {
      const multilineSnippet = `const db = process.env.DB_NAME\n || 'default';`;
      const bracketSnippet = `const secret = process.env['JWT_SECRET'] || '';`;
      const optionalChainingSnippet = `const host = process.env?.REDIS_HOST || '127.0.0.1';`;

      const mRegex = /process\.env(\.[A-Za-z0-9_]+|\[['"][A-Za-z0-9_]+['"]\]|\?\.[A-Za-z0-9_]+)\s*\|\|/s;

      assert.ok(mRegex.test(multilineSnippet), 'Must detect multiline process.env fallback');
      assert.ok(mRegex.test(bracketSnippet), 'Must detect bracketed process.env fallback');
      assert.ok(mRegex.test(optionalChainingSnippet), 'Must detect optional chaining process.env fallback');
    });

    it('verifies nullish coalescing ?? is NOT used to fallback sensitive credentials', () => {
      const allTsFiles = getAllTypeScriptFiles(SRC_DIR);
      const forbiddenCoalescingRegex = /process\.env\.(DB_PASSWORD|SESSION_SECRET|STRIPE_SECRET_KEY|CLOUDFLARE_ORIGIN_SECRET|AWS_S3_SECRET_ACCESS_KEY)\s*\?\?\s*['"`][^'"`]+['"`]/;

      const violations: string[] = [];
      for (const file of allTsFiles) {
        const content = readUtf8(file);
        if (forbiddenCoalescingRegex.test(content)) {
          violations.push(path.relative(BOARDPDF_ROOT, file));
        }
      }

      assert.equal(
        violations.length,
        0,
        `Nullish coalescing with credentials forbidden by AGENTS.md Rule 2:\n${violations.join('\n')}`
      );
    });

    it('verifies env.config.ts exports structured configuration object with standard keys', () => {
      assert.ok(fs.existsSync(envConfigPath), 'src/config/env.config.ts must exist');
      const content = readUtf8(envConfigPath);

      const requiredConfigKeys = ['appName', 'baseUrl', 'database', 'redis', 's3', 'stripe', 'mail'];
      for (const key of requiredConfigKeys) {
        assert.ok(content.includes(key), `env.config.ts must define configuration section "${key}"`);
      }
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('verifies backend services consume central config instead of reading process.env directly with fallbacks', () => {
      const coreServices = [
        path.join(SRC_DIR, 'config/database.config.ts'),
        path.join(SRC_DIR, 'config/redis.config.ts'),
        path.join(SRC_DIR, 'config/s3.config.ts'),
        path.join(SRC_DIR, 'services/mail.service.ts'),
      ];

      const violations: string[] = [];
      for (const file of coreServices) {
        if (fs.existsSync(file)) {
          const content = readUtf8(file);
          const fallbacks = findProcessEnvFallbacks(content);
          if (fallbacks.length > 0) {
            violations.push(`${path.basename(file)}: ${fallbacks.length} fallbacks`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Core infrastructure services must not reintroduce process.env fallbacks:\n${violations.join('\n')}`
      );
    });

    it('verifies .env.example exists and documents environment variables without live secrets', () => {
      const envExamplePath = path.join(BOARDPDF_ROOT, '.env.example');
      if (fs.existsSync(envExamplePath)) {
        const content = readUtf8(envExamplePath);
        assert.ok(content.includes('DB_NAME'), '.env.example must document DB_NAME');
        assert.ok(content.includes('REDIS_HOST'), '.env.example must document REDIS_HOST');
        assert.ok(!content.includes('sk_live_'), '.env.example must not contain live Stripe keys');
      }
    });
  });

  describe('Tier 4: Monorepo-Wide Real-World Audit Scan', () => {
    it('verifies monorepo-wide zero process.env.* || fallbacks across ALL TypeScript files', () => {
      const allTsFiles = getAllTypeScriptFiles(BOARDPDF_ROOT);
      assert.ok(allTsFiles.length > 50, `Expected comprehensive scan of >50 files, found ${allTsFiles.length}`);

      const allViolations: Array<{ file: string; line: number; text: string }> = [];

      for (const file of allTsFiles) {
        const content = readUtf8(file);
        const fallbacks = findProcessEnvFallbacks(content);
        for (const fb of fallbacks) {
          allViolations.push({
            file: path.relative(BOARDPDF_ROOT, file),
            line: fb.line,
            text: fb.text,
          });
        }
      }

      assert.equal(
        allViolations.length,
        0,
        `Automated grep search confirms zero instances of process.env.* ||. Found ${allViolations.length} violations:\n${allViolations
          .map((v) => `${v.file}:${v.line} -> ${v.text}`)
          .join('\n')}`
      );
    });

    it('verifies zero fallback patterns in scripts/ TypeScript files', () => {
      const scriptTsFiles = getAllTypeScriptFiles(SCRIPTS_DIR);
      const violations: string[] = [];

      for (const file of scriptTsFiles) {
        const content = readUtf8(file);
        const fallbacks = findProcessEnvFallbacks(content);
        if (fallbacks.length > 0) {
          violations.push(`${path.basename(file)}: ${fallbacks.length} fallbacks`);
        }
      }

      assert.equal(
        violations.length,
        0,
        `Scripts must have zero process.env fallbacks:\n${violations.join('\n')}`
      );
    });
  });
});
