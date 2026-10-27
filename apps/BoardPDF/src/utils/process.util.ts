import { spawn, SpawnOptions } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../services/logger.service.js';

export interface ProcessExecutionOptions extends SpawnOptions {
  timeoutMs?: number;
}

export interface ProcessExecutionResult {
  code: number | null;
  stderr: string;
  stdout: string;
  timedOut: boolean;
}

let resolvedPythonCmd: string | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getPythonCommand(): Promise<string> {
  if (resolvedPythonCmd) {
    return resolvedPythonCmd;
  }
  if (process.env.PYTHON_PATH) {
    resolvedPythonCmd = process.env.PYTHON_PATH;
    return resolvedPythonCmd;
  }
  if (process.platform === 'win32') {
    const localPython = path.join(process.env.LOCALAPPDATA || '', 'Python', 'bin', 'python.exe');
    if (fs.existsSync(localPython)) {
      resolvedPythonCmd = localPython;
      return resolvedPythonCmd;
    }
    const pyCheck = await executeProcessWithTimeout('py', ['-c', 'import sys; print(1)'], { timeoutMs: 3000 });
    if (pyCheck.code === 0) {
      resolvedPythonCmd = 'py';
      return 'py';
    }
    resolvedPythonCmd = 'python';
    return 'python';
  }
  resolvedPythonCmd = 'python3';
  return 'python3';
}

export function findPythonWorkerScript(scriptName: string, subfolder?: string): string {
  const candidatePaths = [
    path.resolve(process.cwd(), 'scripts', scriptName),
    path.resolve(process.cwd(), 'apps/BoardPDF/scripts', scriptName),
    subfolder ? path.resolve(process.cwd(), `apps/BoardPDF/src/tools/${subfolder}/scripts`, scriptName) : '',
    path.resolve(__dirname, '../../scripts', scriptName),
    path.resolve(__dirname, '../../../scripts', scriptName),
    path.resolve(__dirname, '../../../../scripts', scriptName),
    subfolder ? path.resolve(__dirname, `../${subfolder}/scripts`, scriptName) : '',
    subfolder ? path.resolve(__dirname, `../../${subfolder}/scripts`, scriptName) : '',
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidatePaths[0];
}

export function executeProcessWithTimeout(
  command: string,
  args: string[],
  options: ProcessExecutionOptions = {}
): Promise<ProcessExecutionResult> {
  const { timeoutMs = 60000, ...spawnOptions } = options;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let timer: NodeJS.Timeout | null = null;

    let proc;
    try {
      proc = spawn(command, args, spawnOptions);
    } catch (spawnErr) {
      logger.app.error(`Fallo inmediato al invocar comando: ${command}`, spawnErr);
      resolve({ code: -1, stderr: String(spawnErr), stdout: '', timedOut: false });
      return;
    }

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        logger.app.warn(`Subproceso excedió tiempo límite de ${timeoutMs}ms: ${command}`, { args });
        try {
          proc.kill('SIGKILL');
        } catch {}
      }, timeoutMs);
    }

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      if (timer) clearTimeout(timer);
      logger.app.warn(`Error en subproceso: ${command}`, err);
      resolve({ code: -1, stderr: stderr || err.message, stdout, timedOut });
    });

    proc.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stderr, stdout, timedOut });
    });
  });
}
