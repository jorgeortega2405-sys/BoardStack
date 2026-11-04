import { getDbPool } from '../../src/config/database.config.js';
import { redis } from '../../src/config/redis.config.js';
import { requestEmailChangeCode, updateEmail } from '../../src/services/settings.service.js';
import { isUserSsoManaged } from '../../src/services/sso.service.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { after, describe, it } from 'node:test';

describe('SSO Email Protection Suite', () => {
  after(async () => {
    try {
      await redis.quit();
    } catch {}
    try {
      await getDbPool().end();
    } catch {}
  });
  it('TC-SSO-EMAIL-01: your-account.html contains badge-sso-email with zero forbidden ids and proper attribute ordering', () => {
    const htmlPath = path.resolve(process.cwd(), 'public/views/settings/your-account.html');
    const content = fs.readFileSync(htmlPath, 'utf-8');

    assert.ok(content.includes('data-ref="badge-sso-email"'), 'badge-sso-email must exist in your-account.html');
    assert.ok(content.includes('data-ref="btn-edit-email"'), 'btn-edit-email must exist in your-account.html');
    assert.strictEqual(/id\s*=\s*["'][^"']+["']/i.test(content), false, 'your-account.html must contain zero forbidden IDs');
  });

  it('TC-SSO-EMAIL-02: isUserSsoManaged accurately flags users in SSO organizations', async () => {
    const pool = getDbPool();

    const [userRows] = await pool.query<any[]>(
      `SELECT u.id, u.email 
       FROM users u 
       JOIN organization_members om ON u.id = om.user_id 
       JOIN organizations o ON om.organization_id = o.id
       JOIN organization_sso_configs sso ON om.organization_id = sso.organization_id 
       WHERE sso.enabled = 1 
         AND (sso.enforce_sso = 1 OR (o.domain IS NOT NULL AND LOWER(SUBSTRING_INDEX(u.email, '@', -1)) = LOWER(o.domain)))
       LIMIT 1`
    );

    assert.ok(Array.isArray(userRows) && userRows.length > 0, 'Must have at least one SSO-matched user in DB');
    const ssoUser = userRows[0];
    const managed = await isUserSsoManaged(ssoUser.id, ssoUser.email);
    assert.strictEqual(managed, true, 'User belonging to enabled SSO organization should be recognized as SSO-managed');

    const freeUserManaged = await isUserSsoManaged(99999999, 'random.unlinked@nonexistent-domain-xyz.com');
    assert.strictEqual(freeUserManaged, false, 'Unlinked user should not be recognized as SSO-managed');
  });

  it('TC-SSO-EMAIL-03: requestEmailChangeCode rejects SSO-managed users with status 403', async () => {
    const pool = getDbPool();

    const [userRows] = await pool.query<any[]>(
      `SELECT u.id, u.email 
       FROM users u 
       JOIN organization_members om ON u.id = om.user_id 
       JOIN organizations o ON om.organization_id = o.id
       JOIN organization_sso_configs sso ON om.organization_id = sso.organization_id 
       WHERE sso.enabled = 1 
         AND (sso.enforce_sso = 1 OR (o.domain IS NOT NULL AND LOWER(SUBSTRING_INDEX(u.email, '@', -1)) = LOWER(o.domain)))
       LIMIT 1`
    );

    assert.ok(Array.isArray(userRows) && userRows.length > 0, 'Must have at least one SSO-matched user in DB');
    const ssoUser = userRows[0];
    const result = await requestEmailChangeCode(ssoUser.id);
    assert.strictEqual(result.success, false, 'Should fail for SSO user');
    assert.strictEqual(result.status, 403, 'Should return status 403 Forbidden');
    assert.ok(result.error?.includes('SSO'), 'Error message should explicitly cite SSO governance');
  });

  it('TC-SSO-EMAIL-04: updateEmail rejects SSO-managed users with status 403', async () => {
    const pool = getDbPool();

    const [userRows] = await pool.query<any[]>(
      `SELECT u.id, u.email 
       FROM users u 
       JOIN organization_members om ON u.id = om.user_id 
       JOIN organizations o ON om.organization_id = o.id
       JOIN organization_sso_configs sso ON om.organization_id = sso.organization_id 
       WHERE sso.enabled = 1 
         AND (sso.enforce_sso = 1 OR (o.domain IS NOT NULL AND LOWER(SUBSTRING_INDEX(u.email, '@', -1)) = LOWER(o.domain)))
       LIMIT 1`
    );

    assert.ok(Array.isArray(userRows) && userRows.length > 0, 'Must have at least one SSO-matched user in DB');
    const ssoUser = userRows[0];
    const result = await updateEmail(ssoUser.id, 'attacker.exfiltrate@gmail.com');
    assert.strictEqual(result.success, false, 'Should fail for SSO user');
    assert.strictEqual(result.status, 403, 'Should return status 403 Forbidden');
    assert.ok(result.error?.includes('SSO'), 'Error message should explicitly cite SSO governance');
  });
});
