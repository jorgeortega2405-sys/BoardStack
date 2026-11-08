import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../apps/BoardPDF/dist/services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsRoot = path.resolve(__dirname, '../apps/BoardPDF/logs');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== EMPIRICAL LOGGER STRESS TEST SUITE ===');

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  console.log('--- 1. Testing Category & Date Hierarchy Creation ---');
  logger.app.info('Testing app log category initialization', { init: true });
  logger.db.warn('Testing db log category initialization', { queryTime: 120 });
  logger.security.error('Testing security log category initialization', { blocked: true });

  await sleep(150); // wait for async fs.appendFile

  const categories = ['app', 'db', 'security'];
  for (const cat of categories) {
    const logDir = path.join(logsRoot, cat, dateStr);
    const logFile = path.join(logDir, `${cat}.log`);

    if (!fs.existsSync(logDir)) {
      console.error(`FAIL: Directory ${logDir} was not created!`);
      process.exit(1);
    }
    if (!fs.existsSync(logFile)) {
      console.error(`FAIL: Log file ${logFile} was not created!`);
      process.exit(1);
    }
    const content = fs.readFileSync(logFile, 'utf8');
    if (!content.includes(cat)) {
      console.error(`FAIL: Log file ${logFile} missing expected category content!`);
      process.exit(1);
    }
    console.log(`PASS: Category '${cat}' written correctly to ${cat}/${dateStr}/${cat}.log`);
  }

  console.log('--- 2. Testing Payload Sanitization Edge Cases ---');

  // Test various sensitive keys and casings
  const testPayload = {
    // Standard sensitive keys
    password: 'super_secret_password',
    PASSWORD: 'UPPER_PASSWORD',
    pass_word: 'snake_password',
    passwordHash: 'hash_123',
    secret: 'top_secret',
    SECRET_KEY: 'secret_key_val',
    token: 'jwt.token.here',
    accessToken: 'access_123',
    refreshToken: 'refresh_123',
    authorization: 'Bearer secret_jwt',
    cookie: 'session_id=abcdef',
    csrf: 'csrf_token_abc',
    csrfToken: 'csrf_token_def',
    cardNumber: '4111222233334444',
    card_number: '5500111122223333',
    cvv: '123',
    privateKey: 'BEGIN RSA PRIVATE KEY',
    smtpPass: 'smtp_secret_pass',
    // Sensitive object (parent key matches SENSITIVE_PATTERN)
    nestedAuth: {
      rawToken: 'token123',
    },
    // Non-sensitive parent object with nested sensitive keys
    user: {
      id: 42,
      username: 'alice',
      password: 'alice_secret_pw',
      details: {
        bearerToken: 'nested_bearer',
        apiKey: 'deep_api_key',
        safeData: 'safe_info',
      },
    },
    // Array of objects with sensitive fields
    items: [
      { id: 1, publicName: 'Doc1', secretNotes: 'secret' },
      { id: 2, apiKey: 'arr_api_key' },
    ],
    // Clean fields that should NOT be redacted
    publicInfo: 'Hello World',
    userCount: 99,
    isActive: true,
  };

  logger.app.info('Sanitization stress test 2', testPayload);
  await sleep(150);

  const appLogPath = path.join(logsRoot, 'app', dateStr, 'app.log');
  const appContent = fs.readFileSync(appLogPath, 'utf8');
  const lines = appContent.trim().split('\n');
  const lastLine = JSON.parse(lines[lines.length - 1]);

  console.log('Validating redacted fields in meta...');
  const meta = lastLine.meta;

  const checks = [
    ['password', meta.password === '[REDACTED]'],
    ['PASSWORD', meta.PASSWORD === '[REDACTED]'],
    ['pass_word', meta.pass_word === '[REDACTED]'],
    ['passwordHash', meta.passwordHash === '[REDACTED]'],
    ['secret', meta.secret === '[REDACTED]'],
    ['SECRET_KEY', meta.SECRET_KEY === '[REDACTED]'],
    ['token', meta.token === '[REDACTED]'],
    ['accessToken', meta.accessToken === '[REDACTED]'],
    ['refreshToken', meta.refreshToken === '[REDACTED]'],
    ['authorization', meta.authorization === '[REDACTED]'],
    ['cookie', meta.cookie === '[REDACTED]'],
    ['csrf', meta.csrf === '[REDACTED]'],
    ['csrfToken', meta.csrfToken === '[REDACTED]'],
    ['cardNumber', meta.cardNumber === '[REDACTED]'],
    ['card_number', meta.card_number === '[REDACTED]'],
    ['cvv', meta.cvv === '[REDACTED]'],
    ['privateKey', meta.privateKey === '[REDACTED]'],
    ['smtpPass', meta.smtpPass === '[REDACTED]'],
    ['parent object matching sensitive pattern (nestedAuth)', meta.nestedAuth === '[REDACTED]'],
    ['nested user.password', meta.user.password === '[REDACTED]'],
    ['nested user.details.bearerToken', meta.user.details.bearerToken === '[REDACTED]'],
    ['nested user.details.apiKey', meta.user.details.apiKey === '[REDACTED]'],
    ['nested user.details.safeData preserved', meta.user.details.safeData === 'safe_info'],
    ['array item 0 secretNotes', meta.items[0].secretNotes === '[REDACTED]'],
    ['array item 1 apiKey', meta.items[1].apiKey === '[REDACTED]'],
    ['preserved user.id', meta.user.id === 42],
    ['preserved user.username', meta.user.username === 'alice'],
    ['preserved publicInfo', meta.publicInfo === 'Hello World'],
  ];

  let failedChecks = 0;
  for (const [name, passed] of checks) {
    if (!passed) {
      console.error(`FAIL: Sanitization check failed for: ${name}`);
      failedChecks++;
    }
  }

  if (failedChecks === 0) {
    console.log(`PASS: All ${checks.length} sanitization checks passed!`);
  } else {
    process.exit(1);
  }

  console.log('--- 3. Testing Error Object Sanitization ---');
  const testError = new Error('Database connection failed with credentials');
  testError.password = 'leaked_db_pass';
  testError.authDetails = { token: 'leaked_token' };

  logger.db.error('Error logging test', testError);
  await sleep(150);

  const dbLogPath = path.join(logsRoot, 'db', dateStr, 'db.log');
  const dbLines = fs.readFileSync(dbLogPath, 'utf8').trim().split('\n');
  const lastDbLine = JSON.parse(dbLines[dbLines.length - 1]);

  console.log('Validating error sanitization...');
  if (
    lastDbLine.meta.password === '[REDACTED]' &&
    lastDbLine.meta.authDetails === '[REDACTED]' && // authDetails matches auth pattern -> [REDACTED]
    lastDbLine.meta.name === 'Error'
  ) {
    console.log('PASS: Error object custom properties sanitized properly.');
  } else {
    console.error('FAIL: Error object was not properly sanitized!', lastDbLine.meta);
    process.exit(1);
  }

  console.log('--- 4. Testing Extreme & Adversarial Inputs ---');
  // Extreme inputs:
  // a) Null prototype object
  const nullProto = Object.create(null);
  nullProto.password = 'super_secret';
  nullProto.safe = 'ok';
  logger.security.warn('Null prototype test', nullProto);

  // b) Unicode, emojis, null bytes in message
  const extremeMessage = 'Unicode: 🚀 Español Ñandú, CJK: 漢字, Arabic: العربية, NullByte: \0';
  logger.app.info(extremeMessage, { test: 'unicode' });

  // c) Arrays with empty slots
  const sparseArray = [1, , { token: 'sparse_token' }];
  logger.app.info('Sparse array test', { sparse: sparseArray });

  // d) Non-object primitives in meta
  logger.app.info('Primitive string in meta', 'just a string');
  logger.app.info('Primitive number in meta', 42);
  logger.app.info('Primitive null in meta', null);
  logger.app.info('Primitive undefined in meta', undefined);

  // e) Circular structure: logger should not crash the process!
  const circularObj = { a: 1 };
  circularObj.self = circularObj;
  logger.app.info('Circular reference resilience test', circularObj);

  await sleep(200);

  console.log('PASS: Logger survived null prototype, unicode, sparse array, primitives, and circular reference without process crash.');

  console.log('=== ALL LOGGER TESTS PASSED SUCCESSFULLY ===');
}

run().catch((err) => {
  console.error('Logger test failed with exception:', err);
  process.exit(1);
});
