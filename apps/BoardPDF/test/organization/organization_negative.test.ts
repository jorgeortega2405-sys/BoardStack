import { findRoute } from '../../client/config/routes.config.js';
import { organizationService } from '../../src/services/organization.service.js';
import { TEST_USERS } from './helpers/fixtures.js';
import { createTestSessionCookie, EphemeralServer, installMockService, resetOrganizationStore, restoreOriginalService, startMockServer } from './helpers/mock-server.helper.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

describe('Feature F19: Negative Tests & AGENTS.md Rule 1 Security Audit Suite', () => {
  let serverCtx: EphemeralServer;
  let ownerCookie: string;

  before(async () => {
    serverCtx = await startMockServer();
    ownerCookie = createTestSessionCookie(TEST_USERS.enterpriseOwner);
  });

  after(async () => {
    restoreOriginalService();
    await serverCtx.close();
  });

  beforeEach(() => {
    resetOrganizationStore();
    installMockService();
  });

  describe('TC-NEG-01: Sales Contact Form Omission & Absence of Sales Routes', () => {
    it('returns 404 for unmounted sales routes at HTTP level', async () => {
      const salesEndpoints = [
        { method: 'GET', url: '/sales' },
        { method: 'POST', url: '/sales' },
        { method: 'GET', url: '/contact-sales' },
        { method: 'POST', url: '/contact-sales' },
        { method: 'GET', url: '/api/sales' },
        { method: 'POST', url: '/api/sales' },
        { method: 'GET', url: '/api/contact-sales' },
        { method: 'POST', url: '/api/contact-sales' },
      ];

      for (const endpoint of salesEndpoints) {
        const res = await fetch(`${serverCtx.baseUrl}${endpoint.url}`, {
          method: endpoint.method,
        });
        assert.strictEqual(
          res.status,
          404,
          `Endpoint ${endpoint.method} ${endpoint.url} must return 404`
        );
      }
    });

    it('confirms SPA client route resolver findRoute has no sales or contact-sales route definitions', () => {
      const salesPaths = [
        '/sales',
        '/es/sales',
        '/en/sales',
        '/enterprise/sales',
        '/enterprise/contact-sales',
      ];

      for (const p of salesPaths) {
        const matched = findRoute(p);
        assert.strictEqual(
          matched,
          null,
          `findRoute("${p}") must resolve to null (sales excluded from SPA)`
        );
      }

      const contactSalesMatch = findRoute('/contact-sales');
      assert.notStrictEqual(contactSalesMatch?.routeId, 'sales');
      assert.notStrictEqual(contactSalesMatch?.routeId, 'contact-sales');
    });

    it('verifies public/views template directories contain no sales or contact-sales files', () => {
      const viewsDir = path.resolve(process.cwd(), 'public/views');

      function scanDir(dir: string): string[] {
        let results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results = results.concat(scanDir(fullPath));
          } else if (entry.isFile() && entry.name.endsWith('.html')) {
            results.push(entry.name);
          }
        }
        return results;
      }

      const allHtmlFiles = scanDir(viewsDir);
      for (const filename of allHtmlFiles) {
        const lower = filename.toLowerCase();
        assert.ok(
          !lower.includes('sales') && !lower.includes('contact-sales'),
          `Forbidden sales template found: ${filename}`
        );
      }
    });
  });

  describe('TC-NEG-02: AGENTS.md Rule 1 Security Audit (Zero Sensitive Error Leakage)', () => {
    it('returns generic safe error on simulated database failure in getOrganization', async () => {
      organizationService.getOrganizationForUser = async () => {
        throw new Error('ER_BAD_FIELD_ERROR: Unknown column "secret_key" in "field list" at Query.Sequence._packetDispatch');
      };

      const res = await fetch(`${serverCtx.baseUrl}/api/organization`, {
        headers: { Cookie: ownerCookie },
      });
      assert.strictEqual(res.status, 500);

      const rawText = await res.text();
      assert.strictEqual(
        rawText,
        JSON.stringify({
          error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        })
      );

      assert.doesNotMatch(rawText, /SELECT|INSERT|UPDATE|DELETE/i);
      assert.doesNotMatch(rawText, /sqlMessage|sqlState|errno|ER_BAD_FIELD_ERROR/i);
      assert.doesNotMatch(rawText, /at\s+[\w.<>]+\s+\(/);
      assert.doesNotMatch(rawText, /node_modules|apps\/BoardPDF|src\//);
      assert.doesNotMatch(rawText, /secret_key/);
    });

    it('returns generic safe error on simulated database connection drop in listMembers', async () => {
      organizationService.listMembers = async () => {
        throw new Error('PROTOCOL_CONNECTION_LOST: The database server closed the connection abruptly at Connection.ping');
      };

      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members`, {
        headers: { Cookie: ownerCookie },
      });
      assert.strictEqual(res.status, 500);

      const rawText = await res.text();
      assert.strictEqual(
        rawText,
        JSON.stringify({
          error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        })
      );

      assert.doesNotMatch(rawText, /PROTOCOL_CONNECTION_LOST/i);
      assert.doesNotMatch(rawText, /database server|Connection\.ping/i);
      assert.doesNotMatch(rawText, /node_modules|src\//);
    });

    it('returns generic safe error on simulated critical error in getSsoConfig', async () => {
      organizationService.getSsoConfig = async () => {
        throw new Error('TypeError: Cannot read properties of undefined (reading "private_key") at /var/app/src/services/sso.service.ts:145:12');
      };

      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        headers: { Cookie: ownerCookie },
      });
      assert.strictEqual(res.status, 500);

      const rawText = await res.text();
      assert.strictEqual(
        rawText,
        JSON.stringify({
          error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        })
      );

      assert.doesNotMatch(rawText, /private_key|sso\.service\.ts/);
      assert.doesNotMatch(rawText, /TypeError/);
      assert.doesNotMatch(rawText, /\/var\/app/);
    });

    it('returns generic safe error on simulated unexpected failure in updateSsoConfig', async () => {
      organizationService.updateSsoConfig = async () => {
        throw new Error('UnhandledFatalDatabaseException: Password authentication failed for user "boardpdf_admin"');
      };

      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({ enabled: false }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 500);

      const rawText = await res.text();
      assert.strictEqual(
        rawText,
        JSON.stringify({
          error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        })
      );

      assert.doesNotMatch(rawText, /boardpdf_admin|Password authentication/i);
      assert.doesNotMatch(rawText, /UnhandledFatalDatabaseException/);
    });
  });
});
