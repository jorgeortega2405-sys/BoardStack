import { TEST_USERS } from './helpers/fixtures.js';
import { createTestSessionCookie, EphemeralServer, resetOrganizationStore, restoreOriginalService, startMockServer } from './helpers/mock-server.helper.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

describe('Feature F17: Organization Members & Invitations Management Suite', () => {
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
  });

  describe('TC-MEM-01: List Active Members and Pending Invitations', () => {
    it('returns active members and pending invitations with client-safe fields', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members`, {
        headers: { Cookie: ownerCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(Array.isArray(data.members), 'members should be an array');
      assert.ok(Array.isArray(data.invitations), 'invitations should be an array');
      assert.ok(data.members.length >= 1, 'should have at least 1 active member');

      for (const m of data.members) {
        assert.ok(m.id !== undefined, 'member must have id');
        assert.ok(m.user_id !== undefined, 'member must have user_id');
        assert.ok(typeof m.email === 'string', 'member must have email string');
        assert.ok(typeof m.role === 'string', 'member must have role string');
        assert.ok(typeof m.status === 'string', 'member must have status string');
        assert.ok(typeof m.joined_at === 'string', 'member must have joined_at string');

        assert.strictEqual((m as any).password_hash, undefined, 'password_hash must be absent');
        assert.strictEqual((m as any).two_factor_secret, undefined, 'two_factor_secret must be absent');
        assert.strictEqual((m as any).session_token, undefined, 'session_token must be absent');
      }

      for (const inv of data.invitations) {
        assert.ok(inv.id !== undefined, 'invitation must have id');
        assert.ok(typeof inv.email === 'string', 'invitation must have email');
        assert.ok(typeof inv.role === 'string', 'invitation must have role');
        assert.ok(typeof inv.expires_at === 'string', 'invitation must have expires_at');
        assert.strictEqual(inv.status, 'pending', 'invitation must be pending');
        assert.strictEqual((inv as any).token, undefined, 'raw invitation token must not be leaked');
      }
    });
  });

  describe('TC-MEM-02: Invite Member Happy Path', () => {
    it('successfully invites a new member and appends to pending invitations', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/invite`, {
        body: JSON.stringify({ email: 'newdev@enterprise.com', role: 'member' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'POST',
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.invitation.email, 'newdev@enterprise.com');
      assert.strictEqual(data.invitation.role, 'member');
      assert.strictEqual(data.invitation.status, 'pending');

      const listRes = await fetch(`${serverCtx.baseUrl}/api/organization/members`, {
        headers: { Cookie: ownerCookie },
      });
      const listData = await listRes.json();
      const found = listData.invitations.find((i: any) => i.email === 'newdev@enterprise.com');
      assert.ok(found, 'newdev@enterprise.com must appear in invitations list');
    });

    it('successfully invites an admin member', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/invite`, {
        body: JSON.stringify({ email: 'coadmin@enterprise.com', role: 'admin' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'POST',
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.invitation.role, 'admin');
    });
  });

  describe('TC-MEM-03: Email Format Validation on Invite', () => {
    it('returns 400 when email field is missing', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/invite`, {
        body: JSON.stringify({ role: 'member' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'POST',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Ingresa un correo electrónico para la invitación.');
    });

    it('returns 400 when email format is invalid', async () => {
      const invalidEmails = ['invalid-email', 'test@', '@domain.com', 'user with space@domain.com'];
      for (const email of invalidEmails) {
        const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/invite`, {
          body: JSON.stringify({ email, role: 'member' }),
          headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
          method: 'POST',
        });
        assert.strictEqual(res.status, 400, `Expected 400 for email: ${email}`);
        const data = await res.json();
        assert.ok(
          data.error.includes('inválido') || data.error.includes('correo'),
          `Error message should indicate invalid email for ${email}`
        );
      }
    });
  });

  describe('TC-MEM-04: Duplicate Prevention Guards', () => {
    it('returns 400 when inviting an email that is already an active member', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/invite`, {
        body: JSON.stringify({ email: 'viewer@enterprise.com', role: 'member' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'POST',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'El usuario ya es miembro activo de esta organización.');
    });

    it('returns 400 when inviting an email that already has a pending invitation', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/invite`, {
        body: JSON.stringify({ email: 'pending@enterprise.com', role: 'member' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'POST',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Ya existe una invitación pendiente para este correo electrónico.');
    });
  });

  describe('TC-MEM-05: Modify Member Role', () => {
    it('updates a member role between member and admin', async () => {
      const promoteRes = await fetch(`${serverCtx.baseUrl}/api/organization/members/2/role`, {
        body: JSON.stringify({ role: 'admin' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(promoteRes.status, 200);
      const promoteData = await promoteRes.json();
      assert.strictEqual(promoteData.member.role, 'admin');

      const demoteRes = await fetch(`${serverCtx.baseUrl}/api/organization/members/2/role`, {
        body: JSON.stringify({ role: 'member' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(demoteRes.status, 200);
      const demoteData = await demoteRes.json();
      assert.strictEqual(demoteData.member.role, 'member');
    });

    it('returns 400 when role payload is invalid', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/2/role`, {
        body: JSON.stringify({ role: 'superadmin' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'El rol debe ser admin o member.');
    });

    it('returns 400 for invalid non-numeric member id', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/abc/role`, {
        body: JSON.stringify({ role: 'admin' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Identificador de miembro inválido.');
    });

    it('returns 400 when member is not found', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/9999/role`, {
        body: JSON.stringify({ role: 'admin' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'El miembro seleccionado no fue encontrado en la organización.');
    });
  });

  describe('TC-MEM-06: Owner Protection Guards', () => {
    it('prevents demoting the organization owner', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/1/role`, {
        body: JSON.stringify({ role: 'member' }),
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        method: 'PUT',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'No es posible modificar el rol del propietario de la organización.');
    });

    it('prevents removing the organization owner', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/1`, {
        headers: { Cookie: ownerCookie },
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'No es posible eliminar al propietario de la organización.');
    });
  });

  describe('TC-MEM-07: Self-Removal Protection Guard', () => {
    it('prevents an authenticated user from removing their own membership', async () => {
      const user2Cookie = createTestSessionCookie({
        ...TEST_USERS.enterpriseOwner,
        id: 2,
        username: 'Enterprise Viewer',
      });
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/2`, {
        headers: { Cookie: user2Cookie },
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'No puedes eliminar tu propia membresía de la organización.');
    });
  });

  describe('TC-MEM-08: Revoke Pending Invitation', () => {
    it('successfully revokes a pending invitation', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/invitations/101`, {
        headers: { Cookie: ownerCookie },
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.message, 'Invitación revocada exitosamente.');

      const listRes = await fetch(`${serverCtx.baseUrl}/api/organization/members`, {
        headers: { Cookie: ownerCookie },
      });
      const listData = await listRes.json();
      const found = listData.invitations.find((i: any) => i.id === 101);
      assert.strictEqual(found, undefined, 'revoked invitation must no longer be in pending list');
    });

    it('returns 400 when revoking non-existent invitation', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/invitations/9999`, {
        headers: { Cookie: ownerCookie },
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'La invitación no fue encontrada o ya ha sido procesada.');
    });

    it('returns 400 for invalid non-numeric invitation id', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/invitations/abc`, {
        headers: { Cookie: ownerCookie },
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Identificador de invitación inválido.');
    });
  });

  describe('TC-MEM-09: Remove Member Happy Path', () => {
    it('successfully removes a non-owner member from the organization', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/2`, {
        headers: { Cookie: ownerCookie },
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.message, 'Miembro eliminado exitosamente.');

      const listRes = await fetch(`${serverCtx.baseUrl}/api/organization/members`, {
        headers: { Cookie: ownerCookie },
      });
      const listData = await listRes.json();
      const found = listData.members.find((m: any) => m.id === 2);
      assert.strictEqual(found, undefined, 'removed member must no longer be in active members list');
    });

    it('returns 400 when removing non-existent member id', async () => {
      const res = await fetch(`${serverCtx.baseUrl}/api/organization/members/9999`, {
        headers: { Cookie: ownerCookie },
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'El miembro seleccionado no fue encontrado en la organización.');
    });
  });
});
