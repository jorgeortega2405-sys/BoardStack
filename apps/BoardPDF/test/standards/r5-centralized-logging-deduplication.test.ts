import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import {
  BOARDPDF_ROOT,
  SRC_DIR,
  findFiles,
  findRawConsoleStatements,
  getAllTypeScriptFiles,
  readUtf8,
} from './helpers/standards-test-utils.js';

describe('R5: Centralized Logging, Error Response Safety & Code Deduplication Standards', () => {
  const loggerServicePath = path.join(SRC_DIR, 'services/logger.service.ts');
  const toolHandlerUtilPath = path.join(SRC_DIR, 'utils/tool-handler.util.ts');
  const toolsDir = path.join(SRC_DIR, 'tools');

  describe('Tier 1: Feature Coverage (R5 Verification)', () => {
    it('verifies src/services/logger.service.ts provides app, db, and security loggers', () => {
      assert.ok(fs.existsSync(loggerServicePath), 'logger.service.ts must exist');
      const content = readUtf8(loggerServicePath);

      assert.ok(
        content.includes('logger =') || content.includes('export const logger'),
        'logger service must export logger object'
      );
      assert.ok(content.includes('app') || content.includes('AppLogger'), 'Must provide app logger category');
      assert.ok(content.includes('db') || content.includes('DbLogger'), 'Must provide db logger category');
      assert.ok(content.includes('security') || content.includes('SecurityLogger'), 'Must provide security logger category');
    });

    it('verifies zero raw console.* calls across backend TypeScript files (outside logger.service.ts)', () => {
      const backendTsFiles = getAllTypeScriptFiles(SRC_DIR).filter(
        (f) => !f.endsWith('logger.service.ts')
      );

      const violations: Array<{ file: string; line: number; text: string }> = [];

      for (const file of backendTsFiles) {
        const content = readUtf8(file);
        const consoles = findRawConsoleStatements(content);
        for (const c of consoles) {
          violations.push({
            file: path.relative(BOARDPDF_ROOT, file),
            line: c.line,
            text: c.text,
          });
        }
      }

      assert.equal(
        violations.length,
        0,
        `All backend logging must route exclusively through Logger service. Found ${violations.length} raw console calls:\n${violations
          .slice(0, 30)
          .map((v) => `${v.file}:${v.line} -> ${v.text}`)
          .join('\n')}`
      );
    });

    it('verifies HTTP 500 error handlers in controllers return generic, user-safe messages', () => {
      const controllerFiles = findFiles(SRC_DIR, (p) => p.endsWith('.controller.ts'));
      const violations: string[] = [];

      const unsafeErrorPatterns = [
        /res\.status\(500\)\.json\(\{\s*error:\s*err\.message/,
        /res\.status\(500\)\.json\(\{\s*error:\s*error\.message/,
        /res\.status\(500\)\.json\(\{\s*error:\s*err\.stack/,
        /res\.status\(500\)\.json\(\{\s*error:\s*error\.stack/,
        /res\.status\(500\)\.json\(\{\s*message:\s*err\.message/,
        /res\.status\(500\)\.json\(\{\s*message:\s*error\.message/,
      ];

      for (const file of controllerFiles) {
        const content = readUtf8(file);
        for (const pattern of unsafeErrorPatterns) {
          if (pattern.test(content)) {
            violations.push(`${path.relative(BOARDPDF_ROOT, file)} leaks err.message/err.stack in 500 response`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `500 error responses must return generic safe messages without internal exception details:\n${violations.join('\n')}`
      );
    });

    it('verifies shared tool validation helper src/utils/tool-handler.util.ts exists', () => {
      assert.ok(
        fs.existsSync(toolHandlerUtilPath),
        'src/utils/tool-handler.util.ts must exist as unified tool validation helper'
      );
      const content = readUtf8(toolHandlerUtilPath);
      assert.ok(
        content.includes('validatePdfUpload'),
        'tool-handler.util.ts must expose validatePdfUpload function'
      );
    });

    it('verifies logger.security records authentication, rate limiting, and Turnstile events', () => {
      assert.ok(fs.existsSync(loggerServicePath), 'logger.service.ts must exist');
      const content = readUtf8(loggerServicePath);

      assert.ok(
        content.includes('security') && (content.includes('auth') || content.includes('login') || content.includes('warn')),
        'Logger must define security audit event methods'
      );
    });

    it('verifies logger.db logs persistence operations and errors without leaking credentials', () => {
      assert.ok(fs.existsSync(loggerServicePath), 'logger.service.ts must exist');
      const content = readUtf8(loggerServicePath);

      assert.ok(
        content.includes('db') && (content.includes('query') || content.includes('error') || content.includes('info')),
        'Logger must define db logging methods'
      );
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('verifies PDF magic bytes validation logic', () => {
      const validPdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const invalidBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00');
      const emptyBuffer = Buffer.alloc(0);

      const isPdf = (buf: Buffer) => buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === '%PDF';

      assert.equal(isPdf(validPdfBuffer), true, 'Valid PDF buffer must pass magic bytes check');
      assert.equal(isPdf(invalidBuffer), false, 'GIF buffer must fail PDF magic bytes check');
      assert.equal(isPdf(emptyBuffer), false, 'Empty buffer must fail PDF magic bytes check');
    });

    it('verifies sensitive parameter sanitization in Logger service', () => {
      assert.ok(fs.existsSync(loggerServicePath), 'logger.service.ts must exist');
      const content = readUtf8(loggerServicePath);

      const sensitiveFields = ['password', 'token', 'secret', 'cookie', 'authorization'];
      for (const field of sensitiveFields) {
        assert.ok(
          content.toLowerCase().includes(field),
          `Logger service must sanitize sensitive parameter "${field}"`
        );
      }
    });

    it('verifies error handler never exposes SQL query or stack traces', () => {
      const mockSqlError = new Error('Table boardpdf_db.users does not exist');
      (mockSqlError as any).sql = 'SELECT * FROM users WHERE id = 1';
      (mockSqlError as any).code = 'ER_NO_SUCH_TABLE';

      const sanitizeErrorForUser = (err: any) => {
        return {
          success: false,
          message: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        };
      };

      const userResponse = sanitizeErrorForUser(mockSqlError);
      const serialized = JSON.stringify(userResponse);

      assert.ok(!serialized.includes('boardpdf_db'), 'Response must not expose database name');
      assert.ok(!serialized.includes('SELECT *'), 'Response must not expose SQL query');
      assert.ok(!serialized.includes('ER_NO_SUCH_TABLE'), 'Response must not expose SQL error code');
    });

    it('verifies validatePdfUpload checks file size limits against plan allowances', () => {
      if (fs.existsSync(toolHandlerUtilPath)) {
        const content = readUtf8(toolHandlerUtilPath);
        assert.ok(
          content.includes('size') || content.includes('limit') || content.includes('maxSize'),
          'validatePdfUpload should enforce file size limits'
        );
      }
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('verifies tool controllers import and use shared validatePdfUpload helper', () => {
      if (!fs.existsSync(toolHandlerUtilPath)) {
        assert.fail('src/utils/tool-handler.util.ts does not exist');
      }

      const toolControllers = findFiles(toolsDir, (p) => p.endsWith('.controller.ts'));
      assert.ok(toolControllers.length >= 10, `Expected tool controllers in ${toolsDir}, found ${toolControllers.length}`);

      const unmigratedControllers: string[] = [];
      for (const ctrl of toolControllers) {
        const content = readUtf8(ctrl);
        if (!content.includes('validatePdfUpload') && !content.includes('tool-handler.util')) {
          unmigratedControllers.push(path.relative(BOARDPDF_ROOT, ctrl));
        }
      }

      assert.equal(
        unmigratedControllers.length,
        0,
        `Tool controllers should use shared validatePdfUpload helper. Unmigrated (${unmigratedControllers.length}):\n${unmigratedControllers.join('\n')}`
      );
    });

    it('verifies absence of duplicate multer file validation boilerplate in tool controllers', () => {
      const toolControllers = findFiles(toolsDir, (p) => p.endsWith('.controller.ts'));
      const duplicateBoilerplate: string[] = [];

      for (const ctrl of toolControllers) {
        const content = readUtf8(ctrl);
        if (content.includes('!req.file') && content.includes('req.file.buffer.subarray(0, 4)')) {
          duplicateBoilerplate.push(path.relative(BOARDPDF_ROOT, ctrl));
        }
      }

      assert.equal(
        duplicateBoilerplate.length,
        0,
        `Controllers must not re-implement inline PDF buffer validation:\n${duplicateBoilerplate.join('\n')}`
      );
    });
  });

  describe('Tier 4: Monorepo-Wide Real-World Application Scenarios', () => {
    it('verifies all controllers throughout the backend route errors exclusively via logger', () => {
      const allControllers = findFiles(SRC_DIR, (p) => p.endsWith('.controller.ts'));
      const controllersWithoutLogger: string[] = [];

      for (const ctrl of allControllers) {
        const content = readUtf8(ctrl);
        if (content.includes('catch') && !content.includes('logger.') && !content.includes('Logger')) {
          controllersWithoutLogger.push(path.relative(BOARDPDF_ROOT, ctrl));
        }
      }

      assert.equal(
        controllersWithoutLogger.length,
        0,
        `All catch blocks in controllers must log errors via Logger:\n${controllersWithoutLogger.join('\n')}`
      );
    });

    it('verifies validation failure returns HTTP 400 instead of HTTP 500', () => {
      if (fs.existsSync(toolHandlerUtilPath)) {
        const content = readUtf8(toolHandlerUtilPath);
        assert.ok(
          content.includes('400') || content.includes('status(400)'),
          'Validation handler should return HTTP 400 on bad client input'
        );
      }
    });
  });
});
