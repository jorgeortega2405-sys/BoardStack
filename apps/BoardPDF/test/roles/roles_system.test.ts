import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { getDbPool } from '../../src/config/database.config.js';
import { redis } from '../../src/config/redis.config.js';
import { assignRoleToUser, getAllRoles, getUserRoleNames, removeRoleFromUser } from '../../src/services/role.service.js';
import { createUser, findUserById } from '../../src/services/user.service.js';

describe('Roles System and User Roles Suite', () => {
  const testEmail = `test_roles_${Date.now()}@test.com`;
  const testUsername = `user_role_${Date.now()}`.slice(0, 20);
  let createdUserId: number | null = null;

  after(async () => {
    if (createdUserId) {
      try {
        const pool = getDbPool();
        await pool.query('DELETE FROM users WHERE id = ?', [createdUserId]);
        await pool.end();
        await redis.quit();
      } catch {}
    }
  });

  it('contains all required platform and domain roles in catalog', async () => {
    const roles = await getAllRoles();
    const roleNames = roles.map((r) => r.name);

    assert.ok(roleNames.includes('SUPER_ADMIN'));
    assert.ok(roleNames.includes('PLATFORM_ADMIN'));
    assert.ok(roleNames.includes('SECURITY_ADMIN'));
    assert.ok(roleNames.includes('IAM_ADMIN'));
    assert.ok(roleNames.includes('COMPLIANCE_ADMIN'));
    assert.ok(roleNames.includes('AUDITOR'));
    assert.ok(roleNames.includes('READ_ONLY_ADMIN'));
    assert.ok(roleNames.includes('SUPPORT_L1'));
    assert.ok(roleNames.includes('SUPPORT_L2'));
    assert.ok(roleNames.includes('SUPPORT_L3'));
    assert.ok(roleNames.includes('SUPPORT_MANAGER'));
    assert.ok(roleNames.includes('CUSTOMER_SUCCESS'));
    assert.ok(roleNames.includes('INCIDENT_MANAGER'));
    assert.ok(roleNames.includes('ENGINEER'));
    assert.ok(roleNames.includes('SENIOR_ENGINEER'));
    assert.ok(roleNames.includes('DEVOPS'));
    assert.ok(roleNames.includes('SRE'));
    assert.ok(roleNames.includes('RELEASE_MANAGER'));
    assert.ok(roleNames.includes('DATA_ANALYST'));
    assert.ok(roleNames.includes('DATA_ENGINEER'));
    assert.ok(roleNames.includes('DATA_ADMIN'));
    assert.ok(roleNames.includes('PRIVACY_ADMIN'));
    assert.ok(roleNames.includes('DATA_AUDITOR'));
    assert.ok(roleNames.includes('BILLING_AGENT'));
    assert.ok(roleNames.includes('BILLING_MANAGER'));
    assert.ok(roleNames.includes('FINANCE_ADMIN'));
    assert.ok(roleNames.includes('REFUNDS_ADMIN'));
    assert.ok(roleNames.includes('OPERATIONS_AGENT'));
    assert.ok(roleNames.includes('OPERATIONS_MANAGER'));
    assert.ok(roleNames.includes('WORKFLOW_ADMIN'));
    assert.ok(roleNames.includes('SYSTEM_OPERATOR'));
    assert.ok(roleNames.includes('HR_MANAGER'));
    assert.ok(roleNames.includes('HR_RECRUITER'));
    assert.ok(roleNames.includes('USER'));
  });

  it('assigns USER role by default upon account creation in user_roles', async () => {
    const newUser = await createUser({
      email: testEmail,
      username: testUsername,
    });
    createdUserId = newUser.id;

    assert.strictEqual(newUser.role, 'USER');
    assert.deepStrictEqual(newUser.roles, ['USER']);

    const rolesFromDb = await getUserRoleNames(newUser.id);
    assert.ok(rolesFromDb.includes('USER'));

    const userProfile = await findUserById(newUser.id);
    assert.ok(userProfile);
    assert.ok(Array.isArray(userProfile.roles));
    assert.ok(userProfile.roles.includes('USER'));
  });

  it('supports assigning elevated roles and reflecting them on user profile', async () => {
    assert.ok(createdUserId);
    const assigned = await assignRoleToUser(createdUserId, 'SUPER_ADMIN');
    assert.strictEqual(assigned, true);

    const roles = await getUserRoleNames(createdUserId);
    assert.ok(roles.includes('SUPER_ADMIN'));
    assert.ok(roles.includes('USER'));

    const removed = await removeRoleFromUser(createdUserId, 'SUPER_ADMIN');
    assert.strictEqual(removed, true);

    const rolesAfterRemove = await getUserRoleNames(createdUserId);
    assert.ok(!rolesAfterRemove.includes('SUPER_ADMIN'));
    assert.ok(rolesAfterRemove.includes('USER'));
  });
});
