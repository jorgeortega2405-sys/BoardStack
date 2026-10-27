import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const isInsideBoardPdf = fs.existsSync(path.resolve(process.cwd(), 'src/index.ts'));
const basePrefix = isInsideBoardPdf ? 'tests' : 'apps/BoardPDF/tests';

const backendTest = path.join(basePrefix, 'tools-backend.test.ts');
const frontendTest = path.join(basePrefix, 'tools-frontend.test.ts');

function main(): void {
  process.stdout.write('\n=================================================================\n');
  process.stdout.write('   BoardPDF - Automated End-to-End Tools Test Runner\n');
  process.stdout.write('=================================================================\n\n');

  try {
    const isWin = process.platform === 'win32';
    const npxCmd = isWin ? 'call npx' : 'npx';
    execSync(`${npxCmd} tsx --test "${backendTest}"`, {
      stdio: 'inherit',
    });
    execSync(`${npxCmd} tsx --test "${frontendTest}"`, {
      stdio: 'inherit',
    });

    process.stdout.write('\n=================================================================\n');
    process.stdout.write('   ALL TOOLS BACKEND & FRONTEND TESTS PASSED TO PERFECTION (100%)\n');
    process.stdout.write('=================================================================\n\n');
  } catch (err: any) {
    process.exit(err.status ?? 1);
  }
}

main();
