import {
  ADMIN_ALIAS_ROLE_SLUGS,
  DEFAULT_USER_ROLE_SLUG,
  PLATFORM_ROLES_CATALOG,
  PLATFORM_ROLE_SLUGS,
  SUPER_ADMIN_ROLE_SLUG,
  getPlatformRoleDefinition,
  isPlatformRoleSlug,
  isSuperAdminRole,
  matchesRoleRequirement,
} from '../src/server/config/roles.config.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('roles catalog defines exactly 15 platform roles with required fields', () => {
  assert.equal(PLATFORM_ROLES_CATALOG.length, 15);
  assert.equal(PLATFORM_ROLE_SLUGS.length, 15);

  const categories = new Set(PLATFORM_ROLES_CATALOG.map((r) => r.category));
  assert.ok(categories.has('platform'));
  assert.ok(categories.has('support'));
  assert.ok(categories.has('engineering'));
  assert.ok(categories.has('data'));
  assert.ok(categories.has('finance'));
  assert.ok(categories.has('general'));

  for (const role of PLATFORM_ROLES_CATALOG) {
    assert.ok(role.slug, 'Slug must be non-empty');
    assert.ok(role.name, 'Name must be non-empty');
    assert.ok(role.description, 'Description must be non-empty');
    assert.ok(role.level >= 10 && role.level <= 100, 'Level must be between 10 and 100');
    assert.ok(Array.isArray(role.defaultPermissions), 'Default permissions must be array');
    assert.ok(typeof role.isDefault === 'boolean');
    assert.ok(typeof role.isGlobal === 'boolean');
  }
});

test('operations agent role is excluded as unmapped domain', () => {
  const operationsSlug = 'OPERATIONS_AGENT';
  assert.equal(isPlatformRoleSlug(operationsSlug), false);
  assert.equal(getPlatformRoleDefinition(operationsSlug), undefined);
  assert.equal(PLATFORM_ROLES_CATALOG.some((r) => r.slug === operationsSlug), false);
});

test('super admin and default user role constants are correctly assigned', () => {
  assert.equal(SUPER_ADMIN_ROLE_SLUG, 'SUPER_ADMIN');
  assert.equal(DEFAULT_USER_ROLE_SLUG, 'USER');

  const superAdminDef = getPlatformRoleDefinition('SUPER_ADMIN');
  assert.ok(superAdminDef);
  assert.equal(superAdminDef?.isGlobal, true);
  assert.equal(superAdminDef?.level, 100);

  const defaultUserDef = getPlatformRoleDefinition('USER');
  assert.ok(defaultUserDef);
  assert.equal(defaultUserDef?.isDefault, true);
  assert.equal(defaultUserDef?.level, 10);
});

test('isSuperAdminRole correctly checks super admin identity', () => {
  assert.equal(isSuperAdminRole('SUPER_ADMIN'), true);
  assert.equal(isSuperAdminRole('super_admin'), true);
  assert.equal(isSuperAdminRole('  SUPER_ADMIN  '), true);
  assert.equal(isSuperAdminRole('PLATFORM_ADMIN'), false);
  assert.equal(isSuperAdminRole('USER'), false);
  assert.equal(isSuperAdminRole(''), false);
});

test('matchesRoleRequirement handles direct match, admin alias, and case insensitivity', () => {
  assert.equal(matchesRoleRequirement(['SUPER_ADMIN'], 'admin'), true);
  assert.equal(matchesRoleRequirement(['PLATFORM_ADMIN'], 'admin'), true);
  assert.equal(matchesRoleRequirement(['platform_admin'], 'admin'), true);
  assert.equal(matchesRoleRequirement(['USER'], 'admin'), false);
  assert.equal(matchesRoleRequirement(['SUPPORT_L1'], 'admin'), false);

  assert.equal(matchesRoleRequirement(['USER'], 'USER'), true);
  assert.equal(matchesRoleRequirement(['user'], 'USER'), true);
  assert.equal(matchesRoleRequirement(['USER'], 'user'), true);
  assert.equal(matchesRoleRequirement(['USER'], 'PLATFORM_ADMIN'), false);

  assert.equal(matchesRoleRequirement([], 'admin'), false);
  assert.equal(matchesRoleRequirement(['USER'], ''), false);
});

test('admin alias slugs contain only super admin and platform admin', () => {
  assert.deepEqual([...ADMIN_ALIAS_ROLE_SLUGS], ['SUPER_ADMIN', 'PLATFORM_ADMIN']);
});

test('i18n locale bundles define translations for all 15 roles', () => {
  const currentDir = resolve(fileURLToPath(import.meta.url), '..');
  const appLocalePath = resolve(currentDir, '../client/i18n/locales/es.json');
  const adminLocalePath = resolve(currentDir, '../../admin/client/i18n/locales/es.json');

  const appLocale = JSON.parse(readFileSync(appLocalePath, 'utf8'));
  const adminLocale = JSON.parse(readFileSync(adminLocalePath, 'utf8'));

  for (const role of PLATFORM_ROLES_CATALOG) {
    const slugKey = role.slug.toLowerCase();
    assert.ok(appLocale.roles[slugKey], `apps/app missing translation for ${slugKey}`);
    assert.ok(appLocale.role_descriptions[slugKey], `apps/app missing description for ${slugKey}`);
    assert.ok(adminLocale.admin.roles[slugKey], `apps/admin missing translation for ${slugKey}`);
    assert.ok(adminLocale.admin.role_descriptions[slugKey], `apps/admin missing description for ${slugKey}`);
  }
});
