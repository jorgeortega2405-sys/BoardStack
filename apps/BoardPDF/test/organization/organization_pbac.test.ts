import { hasPermission, hasSubscriptionFeature } from '../../src/middlewares/auth.middleware.js';
import { TEST_USERS } from './helpers/fixtures.js';
import { createTestSessionCookie, EphemeralServer, resetOrganizationStore, restoreOriginalService, startMockServer } from './helpers/mock-server.helper.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

describe('Feature F15: PBAC Access Control Suite', () => {
  let serverCtx: EphemeralServer;

  before(async () => {
    serverCtx = await startMockServer();
  });

  after(async () => {
    restoreOriginalService();
    await serverCtx.close();
  });

  beforeEach(() => {
    resetOrganizationStore();
  });

  describe('TC-PBAC-01: Unauthenticated Requests (401)', () => {
    it('returns 401 when requesting GET /api/organization without session cookie', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'No autorizado. Inicia sesión.');
    });

    it('returns 401 when requesting GET /api/organization/members without session cookie', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'No autorizado. Inicia sesión.');
    });

    it('returns 401 when requesting GET /api/organization/sso without session cookie', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'No autorizado. Inicia sesión.');
    });
  });

  describe('TC-PBAC-02: Missing Subscription Feature (403)', () => {
    it('returns 403 for Free tier user lacking subscription:feature:organization', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.freeUser);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization`, {
        headers: { Cookie: cookie },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Acceso denegado: permisos insuficientes para esta operación.');
    });

    it('returns 403 for Pro tier user lacking subscription:feature:organization', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.proUser);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization`, {
        headers: { Cookie: cookie },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Acceso denegado: permisos insuficientes para esta operación.');
    });

    it('returns 403 for Business tier user lacking subscription:feature:organization', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.businessUser);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization`, {
        headers: { Cookie: cookie },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Acceso denegado: permisos insuficientes para esta operación.');
    });

    it('returns 403 for Admin role user if lacking subscription:feature:organization (Rule 10)', async () => {
      const adminWithoutSub = {
        ...TEST_USERS.freeUser,
        id: 99,
        permissions: ['dashboard:view'],
        role: 'ADMIN',
      };
      const cookie = createTestSessionCookie(adminWithoutSub);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization`, {
        headers: { Cookie: cookie },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Acceso denegado: permisos insuficientes para esta operación.');
    });
  });

  describe('TC-PBAC-03: Active Enterprise Subscription Access (200)', () => {
    it('returns 200 for user with active enterprise subscription on GET /api/organization', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.enterpriseOwner);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization`, {
        headers: { Cookie: cookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.organization);
      assert.strictEqual(data.organization.name, 'Empresa Enterprise');
      assert.ok(data.stats);
      assert.strictEqual(typeof data.stats.members_count, 'number');
    });

    it('returns 200 for enterprise viewer on GET /api/organization/members', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.enterpriseViewer);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members`, {
        headers: { Cookie: cookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.members));
      assert.ok(Array.isArray(data.invitations));
    });

    it('returns 200 for enterprise viewer on GET /api/organization/sso', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.enterpriseViewer);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        headers: { Cookie: cookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.sso);
      assert.strictEqual(typeof data.sso.enabled, 'boolean');
    });
  });

  describe('TC-PBAC-04: Inactive Enterprise Subscription (403)', () => {
    it('returns 403 when enterprise subscription is inactive', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.inactiveEnterpriseUser);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization`, {
        headers: { Cookie: cookie },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Acceso denegado: permisos insuficientes para esta operación.');
    });
  });

  describe('TC-PBAC-05: Granular Write Permissions Enforcement (403 vs 200/201)', () => {
    it('blocks POST /api/organization/members/invite when lacking members:invite', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.enterpriseNoInvite);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/invite`, {
        body: JSON.stringify({ email: 'newperson@enterprise.com', role: 'member' }),
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        method: 'POST',
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Acceso denegado: permisos insuficientes para esta operación.');
    });

    it('blocks PUT /api/organization/members/:id/role when lacking members:modify_role', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.enterpriseNoModifyRole);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/2/role`, {
        body: JSON.stringify({ role: 'admin' }),
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Acceso denegado: permisos insuficientes para esta operación.');
    });

    it('blocks DELETE /api/organization/members/:id when lacking members:remove', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.enterpriseNoRemove);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/2`, {
        headers: { Cookie: cookie },
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Acceso denegado: permisos insuficientes para esta operación.');
    });

    it('blocks PUT /api/organization/sso when lacking sso:manage', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.enterpriseNoSsoManage);
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({ enabled: false }),
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Acceso denegado: permisos insuficientes para esta operación.');
    });

    it('allows write operations when user has all granular permissions', async () => {
      const cookie = createTestSessionCookie(TEST_USERS.enterpriseOwner);
      const resInvite = await fetch(`${serverCtx.baseUrl}/api/organization/members/invite`, {
        body: JSON.stringify({ email: 'authorized@enterprise.com', role: 'member' }),
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        method: 'POST',
      });
      assert.strictEqual(resInvite.status, 201);

      const resRole = await fetch(`${serverCtx.baseUrl}/api/organization/members/2/role`, {
        body: JSON.stringify({ role: 'admin' }),
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        method: 'PUT',
      });
      assert.strictEqual(resRole.status, 200);

      const resSso = await fetch(`${serverCtx.baseUrl}/api/organization/sso`, {
        body: JSON.stringify({ enabled: false }),
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        method: 'PUT',
      });
      assert.strictEqual(resSso.status, 200);
    });
  });

  describe('TC-PBAC-06: Permission Utility Functions Evaluation', () => {
    it('hasPermission evaluates string arrays correctly', () => {
      const perms = ['subscription:feature:organization', 'org:view'];
      assert.strictEqual(hasPermission(perms, 'org:view'), true);
      assert.strictEqual(hasPermission(perms, 'org:manage'), false);
      assert.strictEqual(hasPermission(null, 'org:view'), false);
    });

    it('hasPermission evaluates user object with permissions array', () => {
      assert.strictEqual(hasPermission(TEST_USERS.enterpriseOwner, 'org:view'), true);
      assert.strictEqual(hasPermission(TEST_USERS.freeUser, 'org:view'), false);
    });

    it('hasSubscriptionFeature normalizes prefix automatically', () => {
      assert.strictEqual(hasSubscriptionFeature(TEST_USERS.enterpriseOwner, 'organization'), true);
      assert.strictEqual(hasSubscriptionFeature(TEST_USERS.enterpriseOwner, 'subscription:feature:organization'), true);
      assert.strictEqual(hasSubscriptionFeature(TEST_USERS.freeUser, 'organization'), false);
      assert.strictEqual(hasSubscriptionFeature(TEST_USERS.proUser, 'organization'), false);
    });
  });
});
