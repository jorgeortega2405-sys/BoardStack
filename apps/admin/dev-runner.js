import { spawn } from 'child_process';

const vite = spawn('npx', ['vite', 'build', '--watch'], {
  env: { ...process.env, CHOKIDAR_USEPOLLING: 'true' },
  shell: true,
  stdio: 'inherit',
});

const server = spawn('npx', ['tsx', 'watch', 'src/server/index.ts'], {
  env: { ...process.env, CHOKIDAR_USEPOLLING: 'true' },
  shell: true,
  stdio: 'inherit',
});

function handleExit() {
  vite.kill();
  server.kill();
  process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
