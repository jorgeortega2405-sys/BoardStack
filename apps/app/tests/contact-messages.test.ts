import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('contact messages table schema exists in migration 004 and 02_app.sql', () => {
  const currentDir = resolve(fileURLToPath(import.meta.url), '..');
  const migrationPath = resolve(currentDir, '../../../database/migrations/004_create_contact_messages.sql');
  const appSqlPath = resolve(currentDir, '../../../database/02_app.sql');

  const migrationContent = readFileSync(migrationPath, 'utf8');
  const appSqlContent = readFileSync(appSqlPath, 'utf8');

  assert.ok(migrationContent.includes('CREATE TABLE IF NOT EXISTS contact_messages'));
  assert.ok(migrationContent.includes('uuid VARCHAR(36) NOT NULL UNIQUE'));
  assert.ok(migrationContent.includes('name VARCHAR(120) NOT NULL'));
  assert.ok(migrationContent.includes('email VARCHAR(255) NOT NULL'));
  assert.ok(migrationContent.includes('subject VARCHAR(200) NOT NULL'));
  assert.ok(migrationContent.includes('message TEXT NOT NULL'));
  assert.ok(migrationContent.includes("status ENUM('unread', 'read', 'archived') NOT NULL DEFAULT 'unread'"));

  assert.ok(appSqlContent.includes('CREATE TABLE IF NOT EXISTS contact_messages'));
});

test('contact translations are properly defined in es.json', () => {
  const currentDir = resolve(fileURLToPath(import.meta.url), '..');
  const esJsonPath = resolve(currentDir, '../client/i18n/locales/es.json');
  const esJson = JSON.parse(readFileSync(esJsonPath, 'utf8'));

  assert.ok(esJson.contact);
  assert.ok(esJson.contact.btn_submit);
  assert.ok(esJson.contact.err_required);
  assert.ok(esJson.contact.err_invalid_email);
  assert.ok(esJson.contact.err_send);
  assert.ok(esJson.contact.success);
});

test('email validation regex handles standard and invalid addresses', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  assert.equal(emailRegex.test('user@example.com'), true);
  assert.equal(emailRegex.test('test.user+tag@domain.co.uk'), true);
  assert.equal(emailRegex.test('plainaddress'), false);
  assert.equal(emailRegex.test('@missinguser.com'), false);
  assert.equal(emailRegex.test('missingat.com'), false);
  assert.equal(emailRegex.test('user@.com'), false);
  assert.equal(emailRegex.test(''), false);
});

test('components.css defines component-block--logo and left-aligned pricing plan cards', () => {
  const currentDir = resolve(fileURLToPath(import.meta.url), '..');
  const cssPath = resolve(currentDir, '../public/css/components.css');
  const css = readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.component-block--logo'));
  assert.ok(css.includes('.component-card--plan'));
  assert.ok(css.includes('text-align: left'));
});
