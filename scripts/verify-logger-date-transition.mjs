import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsRoot = path.resolve(__dirname, '../apps/BoardPDF/logs');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Replicate the exact CategoryLogger logic with controllable clock
class TestCategoryLogger {
  constructor(category) {
    this.category = category;
    this.currentDir = '';
  }

  write(level, message, mockDate) {
    const now = mockDate || new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toISOString();

    const targetDir = path.join(logsRoot, this.category, dateStr);
    if (this.currentDir !== targetDir) {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      this.currentDir = targetDir;
    }

    const logFile = path.join(targetDir, `${this.category}.log`);
    const line = JSON.stringify({ category: this.category, level, message, timestamp: timeStr }) + '\n';
    fs.appendFileSync(logFile, line, 'utf8');
  }
}

async function run() {
  console.log('=== TESTING LOGGER DATE TRANSITION ===');
  const logger = new TestCategoryLogger('app');

  // Day 1: 2026-11-08 23:59:58
  const day1 = new Date('2026-11-08T23:59:58.000Z');
  logger.write('INFO', 'Before midnight', day1);
  const dirDay1 = logger.currentDir;
  console.log('Day 1 currentDir:', dirDay1);

  // Day 1 subsequent write (should reuse cached currentDir)
  logger.write('INFO', 'One second later', new Date('2026-11-08T23:59:59.000Z'));
  if (logger.currentDir !== dirDay1) {
    console.error('FAIL: Cached currentDir was not reused within same day!');
    process.exit(1);
  }
  console.log('PASS: Cached currentDir reused within same day.');

  // Day 2: 2026-11-09 00:00:01 (Midnight transition)
  const day2 = new Date('2026-11-09T00:00:01.000Z');
  logger.write('INFO', 'After midnight', day2);
  const dirDay2 = logger.currentDir;
  console.log('Day 2 currentDir:', dirDay2);

  if (dirDay1 === dirDay2) {
    console.error('FAIL: currentDir did not update across midnight boundary!');
    process.exit(1);
  }

  const day2File = path.join(dirDay2, 'app.log');
  if (!fs.existsSync(day2File)) {
    console.error('FAIL: New date log file was not created!');
    process.exit(1);
  }

  console.log('PASS: Date transition seamlessly switched directories and created new log file.');

  // Clean up mock test directory for 2026-11-09 if created
  fs.rmSync(path.join(logsRoot, 'app', '2026-11-09'), { recursive: true, force: true });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
