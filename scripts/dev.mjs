// Runs the API server (with reload) and the Vite dev server together.
import { spawn } from 'node:child_process';

const procs = [
  spawn('npm', ['run', 'dev:server'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn('npm', ['run', 'dev:client'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];
const stop = (code = 0) => {
  for (const p of procs) p.kill('SIGTERM');
  process.exit(code);
};
for (const p of procs) p.on('exit', (code) => stop(code ?? 0));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
