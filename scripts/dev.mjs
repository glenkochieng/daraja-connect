// Start every component that exists, with prefixed output: `npm run dev`
//   ml      Python matching service  http://127.0.0.1:8000  (ml-service/.venv must exist)
//   server  Express API              http://localhost:4000
//   client  React app (Vite)         http://localhost:5173
// Press Ctrl+C once to stop them all.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv, styleText } from 'node:util';

const root = path.resolve(import.meta.dirname, '..');
const isWindows = process.platform === 'win32';

function envFile(file) {
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
}

function firstExisting(...candidates) {
  return candidates.find((candidate) => existsSync(candidate));
}

const services = [];

const mlDir = path.join(root, 'ml-service');
const python = path.join(mlDir, '.venv', isWindows ? 'Scripts/python.exe' : 'bin/python');
if (existsSync(python)) {
  services.push({
    name: 'ml',
    color: 'green',
    cwd: mlDir,
    command: python,
    args: ['-m', 'uvicorn', 'daraja.api:app', '--port', process.env.ML_PORT ?? '8000'],
    env: envFile(path.join(mlDir, '.env')),
  });
} else {
  console.warn(
    `[dev] Skipping the ML service: ${path.relative(root, python)} not found (see ml-service/README.md).`,
  );
}

const serverDir = path.join(root, 'server');
if (existsSync(path.join(serverDir, 'package.json'))) {
  services.push({
    name: 'server',
    color: 'magenta',
    cwd: serverDir,
    command: process.execPath,
    args: ['--watch', 'src/index.js'],
  });
}

const clientDir = path.join(root, 'client');
const vite = firstExisting(
  path.join(clientDir, 'node_modules/vite/bin/vite.js'),
  path.join(root, 'node_modules/vite/bin/vite.js'),
);
if (existsSync(path.join(clientDir, 'package.json')) && vite) {
  services.push({
    name: 'client',
    color: 'cyan',
    cwd: clientDir,
    command: process.execPath,
    args: [vite],
  });
}

if (services.length === 0) {
  console.error('[dev] Nothing to start. Run `npm install` and set up ml-service/.venv first.');
  process.exit(1);
}

const width = Math.max(...services.map((s) => s.name.length));
const children = [];

function pipe(stream, prefix, target) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) target.write(`${prefix} ${line}\n`);
  });
  stream.on('end', () => buffer && target.write(`${prefix} ${buffer}\n`));
}

for (const service of services) {
  const prefix = styleText(service.color, `[${service.name.padEnd(width)}]`);
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    // Keep colours through the pipe, unless the user opted out with NO_COLOR.
    env: { ...process.env, ...service.env, ...(process.env.NO_COLOR ? {} : { FORCE_COLOR: '1' }) },
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  pipe(child.stdout, prefix, process.stdout);
  pipe(child.stderr, prefix, process.stderr);
  child.on('exit', (code, signal) => {
    if (!stopping) console.log(`${prefix} exited (${signal ?? `code ${code}`})`);
  });
  children.push(child);
}

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  console.log('\n[dev] Stopping all services...');
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // On Windows, kill the whole process tree (uvicorn and node --watch spawn children).
    if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 1500);
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
