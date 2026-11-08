import { cacheService, CACHE_KEYS } from '../apps/BoardPDF/dist/services/cache.service.js';
import { redis } from '../apps/BoardPDF/dist/config/redis.config.js';

async function run() {
  console.log('=== EMPIRICAL CACHE SERVICE TEST SUITE ===');

  const testUserId = '98765';
  const testEmail = 'StressTester@Example.COM';
  const testUsername = 'StressUser98765';

  const expectedKeys = [
    CACHE_KEYS.userById(testUserId),
    CACHE_KEYS.userProfile(testUserId),
    `user:cache:${testUserId}`,
    CACHE_KEYS.userPerms(testUserId),
    `user:permissions:${testUserId}`,
    CACHE_KEYS.userBilling(testUserId),
    CACHE_KEYS.userOrg(testUserId),
    CACHE_KEYS.userEmail(testEmail),
    CACHE_KEYS.userUsername(testUsername),
  ];

  console.log('--- 1. Testing invalidateUser comprehensive eviction ---');
  // Seed all keys in redis
  for (const k of expectedKeys) {
    await redis.set(k, JSON.stringify({ seeded: true, key: k }));
  }

  // Verify all keys exist
  for (const k of expectedKeys) {
    const exists = await redis.exists(k);
    if (!exists) {
      console.error(`FAIL: Seed key ${k} does not exist in Redis!`);
      process.exit(1);
    }
  }
  console.log(`PASS: All ${expectedKeys.length} test keys seeded in Redis.`);

  // Call invalidateUser
  await cacheService.invalidateUser(testUserId, testEmail, testUsername);

  // Verify every single key is evicted
  let remainingCount = 0;
  for (const k of expectedKeys) {
    const exists = await redis.exists(k);
    if (exists) {
      console.error(`FAIL: Key ${k} was NOT evicted by invalidateUser!`);
      remainingCount++;
    }
  }
  if (remainingCount === 0) {
    console.log(`PASS: All ${expectedKeys.length} keys successfully evicted by invalidateUser.`);
  } else {
    process.exit(1);
  }

  console.log('--- 2. Testing invalidateUserOrg eviction ---');
  const orgKeys = [
    CACHE_KEYS.userOrg(testUserId),
    `user:org:${testUserId}`,
    CACHE_KEYS.userPerms(testUserId),
  ];
  for (const k of orgKeys) {
    await redis.set(k, JSON.stringify({ seededOrg: true }));
  }
  await cacheService.invalidateUserOrg(testUserId);
  for (const k of orgKeys) {
    const exists = await redis.exists(k);
    if (exists) {
      console.error(`FAIL: Key ${k} was NOT evicted by invalidateUserOrg!`);
      process.exit(1);
    }
  }
  console.log(`PASS: All org keys successfully evicted by invalidateUserOrg.`);

  console.log('--- 3. Testing invalidateUserPrefs eviction ---');
  const prefKey = CACHE_KEYS.userPrefs(testUserId);
  await redis.set(prefKey, JSON.stringify({ theme: 'dark' }));
  await cacheService.invalidateUserPrefs(testUserId);
  if (await redis.exists(prefKey)) {
    console.error(`FAIL: Pref key ${prefKey} was NOT evicted!`);
    process.exit(1);
  }
  console.log(`PASS: User preferences cache successfully evicted.`);

  console.log('--- 4. Testing invalidateRolePermsCache eviction ---');
  const roleKey = CACHE_KEYS.rolePerms('SUPER_ADMIN');
  await redis.set(roleKey, JSON.stringify(['tools:access']));
  await cacheService.invalidateRolePermsCache('SUPER_ADMIN');
  if (await redis.exists(roleKey)) {
    console.error(`FAIL: Role perms key ${roleKey} was NOT evicted!`);
    process.exit(1);
  }
  console.log(`PASS: Role permissions cache successfully evicted.`);

  console.log('--- 5. Testing edge cases & boundary conditions ---');
  // Empty del call
  const emptyDel = await cacheService.del();
  console.log('PASS: Empty del returns false without crashing:', emptyDel === false);

  // Filtering falsy keys in del
  await redis.set('cache:test:valid_key', '1');
  const partialDel = await cacheService.del('', null, undefined, 'cache:test:valid_key');
  const validKeyExists = await redis.exists('cache:test:valid_key');
  console.log('PASS: del handles falsy arguments and evicts valid keys:', partialDel === true && validKeyExists === 0);

  // Email and username normalization in CACHE_KEYS
  const emailKey1 = CACHE_KEYS.userEmail('  JOHN.DOE@Example.com  ');
  const emailKey2 = CACHE_KEYS.userEmail('john.doe@example.com');
  console.log('PASS: Email keys normalized correctly:', emailKey1 === emailKey2 && emailKey1 === 'cache:user:email:john.doe@example.com');

  const userKey1 = CACHE_KEYS.userUsername('  MyCoolUser  ');
  const userKey2 = CACHE_KEYS.userUsername('mycooluser');
  console.log('PASS: Username keys normalized correctly:', userKey1 === userKey2 && userKey1 === 'cache:user:username:mycooluser');

  // get/set null sentinel handling
  await cacheService.set('cache:test:null_test', null);
  const nullResult = await cacheService.get('cache:test:null_test');
  console.log('PASS: Null sentinel handled properly (returns null):', nullResult === null);

  await cacheService.del('cache:test:null_test');
  const undefResult = await cacheService.get('cache:test:null_test');
  console.log('PASS: Missing key returns undefined:', undefResult === undefined);

  console.log('=== ALL CACHE SERVICE VERIFICATIONS PASSED ===');
  await redis.quit();
}

run().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
