const fs = require('fs');
const path = require('path');

const sqlPath = path.resolve(__dirname, '../database/db_identity.sql');
const migrationsDir = path.resolve(__dirname, '../database/migrations');

console.log('--- 1. Testing migrations folder absence ---');
const migrationsExist = fs.existsSync(migrationsDir);
console.log('database/migrations exists:', migrationsExist);
if (migrationsExist) {
  console.error('FAIL: database/migrations still exists!');
  process.exit(1);
} else {
  console.log('PASS: database/migrations completely removed.');
}

console.log('--- 2. Testing db_identity.sql existence & authority ---');
if (!fs.existsSync(sqlPath)) {
  console.error('FAIL: database/db_identity.sql does not exist!');
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');
const tableRegex = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\)\s*ENGINE=InnoDB/gi;
const tables = new Map();
let match;
while ((match = tableRegex.exec(sql)) !== null) {
  tables.set(match[1], match[2]);
}

console.log(`PASS: Found ${tables.size} tables defined in db_identity.sql:`);
console.log(Array.from(tables.keys()).join(', '));

// Verify tables from former migrations 001-004
const requiredTables = [
  'ai_token_logs',
  'project_folders',
  'collaborative_documents',
  'user_storage_assets',
  'user_cloud_integrations',
  'roles',
  'permissions',
  'role_permissions',
  'user_roles',
  'subscription_tier_permissions',
  'sales_inquiries'
];

let missingTables = 0;
for (const table of requiredTables) {
  if (tables.has(table)) {
    console.log(`PASS: Required table '${table}' exists.`);
  } else {
    console.error(`FAIL: Required table '${table}' is MISSING!`);
    missingTables++;
  }
}

// Verify columns in users table
const usersBody = tables.get('users') || '';
const requiredUserCols = ['ai_tokens_balance', 'ai_tokens_reset_at'];
for (const col of requiredUserCols) {
  if (usersBody.includes(col)) {
    console.log(`PASS: Column 'users.${col}' exists.`);
  } else {
    console.error(`FAIL: Column 'users.${col}' is MISSING!`);
    missingTables++;
  }
}

// Verify foreign key integrity
const fkRegex = /FOREIGN KEY\s*\(([\w,\s]+)\)\s*REFERENCES\s+(\w+)\s*\(([\w,\s]+)\)/gi;
let fkMatch;
let fkErrors = 0;
while ((fkMatch = fkRegex.exec(sql)) !== null) {
  const [_, localCols, targetTable, targetCols] = fkMatch;
  if (!tables.has(targetTable)) {
    console.error(`FAIL: Foreign key references unknown table '${targetTable}'`);
    fkErrors++;
  }
}

if (fkErrors === 0) {
  console.log('PASS: All foreign keys point to tables declared in db_identity.sql.');
}

if (missingTables > 0 || fkErrors > 0) {
  console.error('Database verification failed!');
  process.exit(1);
} else {
  console.log('ALL DATABASE CHECKS PASSED.');
}
