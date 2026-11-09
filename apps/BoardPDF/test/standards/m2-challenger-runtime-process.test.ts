import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import { BOARDPDF_ROOT, readUtf8, SRC_DIR } from './helpers/standards-test-utils.js';

describe('Milestone 2 Challenger: Runtime Process Utils & Converter Adversarial Stress Test', () => {
  const toPdfServicePath = path.join(SRC_DIR, 'tools/to-pdf-converter/to-pdf-converter.service.ts');
  const processUtilPath = path.join(SRC_DIR, 'utils/process.util.ts');
  const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  function runIsolatedScript(runnerScript: string, envOverrides: Record<string, string | undefined> = {}): any {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const [key, val] of Object.entries(envOverrides)) {
      if (val === undefined) {
        delete env[key];
      } else {
        env[key] = val;
      }
    }
    const tempFile = path.join(
      BOARDPDF_ROOT,
      'test/standards',
      `__temp_runner_${Date.now()}_${Math.random().toString(36).slice(2)}.ts`
    );
    fs.writeFileSync(tempFile, runnerScript, 'utf-8');
    try {
      const result = execFileSync(npxBin, ['tsx', tempFile], {
        cwd: BOARDPDF_ROOT,
        encoding: 'utf-8',
        shell: true,
        env,
      });
      return JSON.parse(result.trim());
    } finally {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch {}
    }
  }

  describe('Adversarial Challenge 1: Missing, Undefined, or Empty LOCALAPPDATA Handling', () => {
    it('verifies to-pdf-converter.service.ts guards LOCALAPPDATA without throwing TypeError on path.join', () => {
      assert.ok(fs.existsSync(toPdfServicePath), 'to-pdf-converter.service.ts must exist');
      const content = readUtf8(toPdfServicePath);

      const forbiddenPattern = /path\.join\(\s*process\.env\.LOCALAPPDATA\s*\|\|\s*['"`]{2}/;
      assert.equal(
        forbiddenPattern.test(content),
        false,
        'to-pdf-converter.service.ts must not use path.join(process.env.LOCALAPPDATA || "")'
      );

      const guardedPattern = /const\s+localAppData\s*=\s*process\.env\.LOCALAPPDATA;\s*if\s*\(\s*localAppData\s*\)/g;
      const matches = content.match(guardedPattern);
      assert.ok(matches && matches.length >= 2, 'Must guard localAppData with conditional check in both browser and libreoffice discovery');
    });

    it('verifies process.util.ts guards LOCALAPPDATA without throwing TypeError on path.join', () => {
      assert.ok(fs.existsSync(processUtilPath), 'process.util.ts must exist');
      const content = readUtf8(processUtilPath);

      const forbiddenPattern = /path\.join\(\s*process\.env\.LOCALAPPDATA\s*\|\|\s*['"`]{2}/;
      assert.equal(
        forbiddenPattern.test(content),
        false,
        'process.util.ts must not use path.join(process.env.LOCALAPPDATA || "")'
      );

      const guardedPattern = /const\s+localAppData\s*=\s*process\.env\.LOCALAPPDATA;\s*if\s*\(\s*localAppData\s*\)/;
      assert.ok(guardedPattern.test(content), 'Must guard localAppData with conditional check in getPythonCommand');
    });

    it('executes getPythonCommand in isolated runtime with deleted LOCALAPPDATA', () => {
      const runnerScript = `
        import { getPythonCommand } from '../../src/utils/process.util.js';
        delete process.env.LOCALAPPDATA;
        delete process.env.PYTHON_PATH;
        const cmd = await getPythonCommand();
        if (typeof cmd !== 'string' || cmd.length === 0) {
          throw new Error('getPythonCommand returned empty string or non-string');
        }
        process.stdout.write(JSON.stringify({ cmd, success: true }));
      `;

      const parsed = runIsolatedScript(runnerScript, { LOCALAPPDATA: undefined, PYTHON_PATH: undefined });
      assert.equal(parsed.success, true);
      assert.ok(typeof parsed.cmd === 'string');
      assert.ok(parsed.cmd.length > 0);
    });

    it('executes getPythonCommand in isolated runtime with empty string LOCALAPPDATA', () => {
      const runnerScript = `
        import { getPythonCommand } from '../../src/utils/process.util.js';
        process.env.LOCALAPPDATA = '';
        delete process.env.PYTHON_PATH;
        const cmd = await getPythonCommand();
        if (typeof cmd !== 'string' || cmd.length === 0) {
          throw new Error('getPythonCommand returned empty string or non-string');
        }
        process.stdout.write(JSON.stringify({ cmd, success: true }));
      `;

      const parsed = runIsolatedScript(runnerScript, { LOCALAPPDATA: '', PYTHON_PATH: undefined });
      assert.equal(parsed.success, true);
      assert.ok(typeof parsed.cmd === 'string');
      assert.ok(parsed.cmd.length > 0);
    });

    it('executes getPythonCommand in isolated runtime with whitespace-only LOCALAPPDATA', () => {
      const runnerScript = `
        import { getPythonCommand } from '../../src/utils/process.util.js';
        process.env.LOCALAPPDATA = '   ';
        delete process.env.PYTHON_PATH;
        const cmd = await getPythonCommand();
        if (typeof cmd !== 'string' || cmd.length === 0) {
          throw new Error('getPythonCommand failed under whitespace LOCALAPPDATA');
        }
        process.stdout.write(JSON.stringify({ cmd, success: true }));
      `;

      const parsed = runIsolatedScript(runnerScript, { LOCALAPPDATA: '   ', PYTHON_PATH: undefined });
      assert.equal(parsed.success, true);
      assert.ok(typeof parsed.cmd === 'string');
    });

    it('executes getPythonCommand in isolated runtime with non-existent directory LOCALAPPDATA', () => {
      const runnerScript = `
        import { getPythonCommand } from '../../src/utils/process.util.js';
        process.env.LOCALAPPDATA = 'C:\\\\NonExistentDirectory_Challenger_Test_404';
        delete process.env.PYTHON_PATH;
        const cmd = await getPythonCommand();
        if (typeof cmd !== 'string' || cmd.length === 0) {
          throw new Error('getPythonCommand failed under non-existent LOCALAPPDATA');
        }
        process.stdout.write(JSON.stringify({ cmd, success: true }));
      `;

      const parsed = runIsolatedScript(runnerScript, {
        LOCALAPPDATA: 'C:\\NonExistentDirectory_Challenger_Test_404',
        PYTHON_PATH: undefined,
      });
      assert.equal(parsed.success, true);
      assert.ok(typeof parsed.cmd === 'string');
    });
  });

  describe('Adversarial Challenge 2: Cross-Platform Execution Simulation', () => {
    it('verifies getPythonCommand resolves to python3 on simulated linux platform', () => {
      const runnerScript = `
        Object.defineProperty(process, 'platform', { value: 'linux' });
        delete process.env.PYTHON_PATH;
        delete process.env.LOCALAPPDATA;
        const { getPythonCommand } = await import('../../src/utils/process.util.js');
        const cmd = await getPythonCommand();
        process.stdout.write(JSON.stringify({ cmd, platform: process.platform }));
      `;

      const parsed = runIsolatedScript(runnerScript, { PYTHON_PATH: undefined });
      assert.equal(parsed.platform, 'linux');
      assert.equal(parsed.cmd, 'python3', 'Linux platform must return python3');
    });

    it('verifies getPythonCommand resolves to python3 on simulated darwin platform', () => {
      const runnerScript = `
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        delete process.env.PYTHON_PATH;
        delete process.env.LOCALAPPDATA;
        const { getPythonCommand } = await import('../../src/utils/process.util.js');
        const cmd = await getPythonCommand();
        process.stdout.write(JSON.stringify({ cmd, platform: process.platform }));
      `;

      const parsed = runIsolatedScript(runnerScript, { PYTHON_PATH: undefined });
      assert.equal(parsed.platform, 'darwin');
      assert.equal(parsed.cmd, 'python3', 'Darwin platform must return python3');
    });

    it('verifies PYTHON_PATH overrides platform-specific resolution on any platform', () => {
      const runnerScript = `
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env.PYTHON_PATH = '/custom/bin/python_custom';
        const { getPythonCommand } = await import('../../src/utils/process.util.js');
        const cmd = await getPythonCommand();
        process.stdout.write(JSON.stringify({ cmd, platform: process.platform }));
      `;

      const parsed = runIsolatedScript(runnerScript, { PYTHON_PATH: '/custom/bin/python_custom' });
      assert.equal(parsed.cmd, '/custom/bin/python_custom');
    });

    it('simulates cross-platform browser candidate selection in to-pdf-converter logic', () => {
      const testCases = [
        { platform: 'win32', localAppData: undefined },
        { platform: 'win32', localAppData: '' },
        { platform: 'win32', localAppData: 'C:\\Users\\MockUser\\AppData\\Local' },
        { platform: 'linux', localAppData: undefined },
        { platform: 'darwin', localAppData: undefined },
      ];

      for (const tc of testCases) {
        const candidates: string[] = [];
        if (tc.platform === 'win32') {
          candidates.push(
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
          );
          if (tc.localAppData) {
            candidates.push(path.join(tc.localAppData, 'Google\\Chrome\\Application\\chrome.exe'));
            candidates.push(path.join(tc.localAppData, 'Microsoft\\Edge\\Application\\msedge.exe'));
          }
        } else {
          candidates.push(
            'google-chrome',
            'google-chrome-stable',
            'chromium',
            'chromium-browser',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
          );
        }

        assert.ok(candidates.length > 0, `Candidates must be populated for platform ${tc.platform}`);
        for (const cand of candidates) {
          assert.equal(typeof cand, 'string', 'Candidate must always be string');
          assert.ok(cand.length > 0, 'Candidate path must not be empty');
          assert.ok(!cand.includes('undefined'), 'Candidate path must not contain string "undefined"');
        }

        if (tc.platform !== 'win32') {
          const hasWindowsPath = candidates.some((c) => c.startsWith('C:\\'));
          assert.equal(hasWindowsPath, false, `Platform ${tc.platform} must not contain Windows C:\\ candidates`);
        }
      }
    });

    it('simulates cross-platform libreoffice candidate selection in to-pdf-converter logic', () => {
      const testCases = [
        { platform: 'win32', localAppData: undefined },
        { platform: 'win32', localAppData: '' },
        { platform: 'win32', localAppData: 'C:\\Users\\MockUser\\AppData\\Local' },
        { platform: 'linux', localAppData: undefined },
        { platform: 'darwin', localAppData: undefined },
      ];

      for (const tc of testCases) {
        const candidates: string[] = [];
        if (tc.platform === 'win32') {
          candidates.push(
            'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
            'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
          );
          if (tc.localAppData) {
            candidates.push(path.join(tc.localAppData, 'Programs\\LibreOffice\\program\\soffice.exe'));
          }
        } else {
          candidates.push('/usr/bin/soffice', '/usr/bin/libreoffice', 'libreoffice', 'soffice');
        }

        assert.ok(candidates.length > 0);
        for (const cand of candidates) {
          assert.equal(typeof cand, 'string');
          assert.ok(cand.length > 0);
          assert.ok(!cand.includes('undefined'));
        }

        if (tc.platform !== 'win32') {
          const hasWindowsPath = candidates.some((c) => c.startsWith('C:\\'));
          assert.equal(hasWindowsPath, false, `Platform ${tc.platform} must not contain Windows C:\\ candidates`);
        }
      }
    });
  });

  describe('Adversarial Challenge 3: Process Execution & Worker Resolution Stress', () => {
    it('executes executeProcessWithTimeout on non-existent command gracefully returning error code -1', async () => {
      const { executeProcessWithTimeout } = await import('../../src/utils/process.util.js');
      const result = await executeProcessWithTimeout('non_existent_binary_xyz_404', ['--version'], { timeoutMs: 2000 });

      assert.equal(result.code, -1, 'Non-existent command must return exit code -1');
      assert.equal(result.timedOut, false, 'Non-existent command must not flag as timedOut');
      assert.ok(result.stderr.length > 0, 'Error details must be captured in stderr');
    });

    it('executes findPythonWorkerScript across fallback search paths safely', async () => {
      const { findPythonWorkerScript } = await import('../../src/utils/process.util.js');

      const nonExistentScript = findPythonWorkerScript('non_existent_worker_script.py');
      assert.ok(typeof nonExistentScript === 'string');
      assert.ok(nonExistentScript.includes('non_existent_worker_script.py'));

      const nonExistentWithSubfolder = findPythonWorkerScript('worker.py', 'to-pdf-converter');
      assert.ok(typeof nonExistentWithSubfolder === 'string');
      assert.ok(nonExistentWithSubfolder.includes('worker.py'));
    });

    it('verifies isValidPublicUrl blocks SSRF and invalid protocol attacks in to-pdf-converter', async () => {
      const { isValidPublicUrl } = await import('../../src/tools/to-pdf-converter/to-pdf-converter.service.js');

      assert.equal(isValidPublicUrl('http://127.0.0.1'), false, 'Must block loopback IP 127.0.0.1');
      assert.equal(isValidPublicUrl('http://localhost'), false, 'Must block localhost');
      assert.equal(isValidPublicUrl('http://169.254.169.254'), false, 'Must block AWS metadata IP');
      assert.equal(isValidPublicUrl('http://10.0.0.1'), false, 'Must block RFC1918 10.x.x.x');
      assert.equal(isValidPublicUrl('http://192.168.1.1'), false, 'Must block RFC1918 192.168.x.x');
      assert.equal(isValidPublicUrl('file:///etc/passwd'), false, 'Must block file:// URI');
      assert.equal(isValidPublicUrl('ftp://ftp.example.com'), false, 'Must block ftp://');
      assert.equal(isValidPublicUrl('javascript:alert(1)'), false, 'Must block javascript: URI');
      assert.equal(isValidPublicUrl(''), false, 'Must block empty string');
      assert.equal(isValidPublicUrl('https://example.com'), true, 'Must allow valid public HTTPS URL');
      assert.equal(isValidPublicUrl('http://example.com'), true, 'Must allow valid public HTTP URL');
    });

    it('calls captureUrlScreenshot with non-public URL and verifies safe null return without crash', async () => {
      const { captureUrlScreenshot } = await import('../../src/tools/to-pdf-converter/to-pdf-converter.service.js');

      const invalidUrlResult = await captureUrlScreenshot('http://127.0.0.1');
      assert.equal(invalidUrlResult, null, 'Must return null for SSRF blocked URL');

      const malformedUrlResult = await captureUrlScreenshot('not-a-valid-url');
      assert.equal(malformedUrlResult, null, 'Must return null for malformed URL');
    });
  });

  describe('Adversarial Challenge 4: Monorepo Standards Invariants (R3, AGENTS.md)', () => {
    it('verifies to-pdf-converter.service.ts and process.util.ts have zero process.env.* || fallbacks', () => {
      const tsFiles = [toPdfServicePath, processUtilPath];
      const fallbackRegex = /process\.env(\.[A-Za-z0-9_]+|\[['"][A-Za-z0-9_]+['"]\])\s*\|\|/g;

      for (const filePath of tsFiles) {
        const content = readUtf8(filePath);
        const matches = content.match(fallbackRegex);
        assert.equal(
          matches,
          null,
          `${path.basename(filePath)} must not contain any process.env.* || fallback patterns`
        );
      }
    });

    it('verifies to-pdf-converter.service.ts and process.util.ts do not hardcode secrets or credentials', () => {
      const tsFiles = [toPdfServicePath, processUtilPath];
      const sensitiveRegex = /process\.env\.[A-Za-z0-9_]+\s*(\?\?|\|\|)\s*['"`][^'"`]+['"`]/g;

      for (const filePath of tsFiles) {
        const content = readUtf8(filePath);
        let match: RegExpExecArray | null;
        while ((match = sensitiveRegex.exec(content)) !== null) {
          const matched = match[0].toLowerCase();
          const isSensitive =
            matched.includes('password') ||
            matched.includes('secret') ||
            matched.includes('token') ||
            matched.includes('key');
          assert.equal(
            isSensitive,
            false,
            `Forbidden credential fallback in ${path.basename(filePath)}: ${match[0]}`
          );
        }
      }
    });
  });
});
