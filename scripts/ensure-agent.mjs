/**
 * Ensure the LocalAppData employee-agent is the newest release binary,
 * running with the configured EMPLOYEE_ID (kills sandbox/stale copies).
 *
 * Usage: node scripts/ensure-agent.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const installDir = path.join(
  process.env.LOCALAPPDATA || '',
  'EmployeeTracking',
  'agent'
);
const dest = path.join(installDir, 'employee-agent.exe');
const envFile = path.join(installDir, '.env');

const candidates = [
  path.join(root, 'target-employee-agent', 'release', 'employee-agent.exe'),
  path.join(root, 'src-tauri', 'resources', 'agent', 'employee-agent.exe'),
  path.join(root, 'employee-agent', 'target', 'release', 'employee-agent.exe'),
  path.join(root, 'release', 'employee-agent-windows', 'employee-agent.exe'),
];

function killAgents() {
  try {
    execSync('taskkill /IM employee-agent.exe /F /T', { stdio: 'ignore' });
  } catch {
    /* none running */
  }
}

function readEmployeeId() {
  if (!fs.existsSync(envFile)) return null;
  const m = fs.readFileSync(envFile, 'utf8').match(/^EMPLOYEE_ID=(.+)$/m);
  return m ? m[1].trim() : null;
}

const src = candidates
  .filter((p) => fs.existsSync(p))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

if (!src) {
  console.error('No employee-agent.exe found. Run: npm run build:agent && npm run prepare:agent');
  process.exit(1);
}

fs.mkdirSync(installDir, { recursive: true });
killAgents();
await new Promise((r) => setTimeout(r, 500));
const lock = path.join(installDir, 'agent.lock');
if (fs.existsSync(lock)) fs.unlinkSync(lock);

fs.copyFileSync(src, dest);
console.log('Installed:', dest);
console.log('  from:', src);
console.log('  size:', fs.statSync(dest).size);

const eid = readEmployeeId();
if (!eid) {
  console.error('Missing EMPLOYEE_ID in', envFile);
  console.error('Sign in as the employee in the desktop app once, or set EMPLOYEE_ID in that .env');
  process.exit(1);
}
console.log('EMPLOYEE_ID:', eid);

const child = spawn(dest, [], {
  cwd: installDir,
  detached: true,
  stdio: 'ignore',
  env: { ...process.env, DOTENV_PATH: envFile },
});
child.unref();
console.log('Started employee-agent PID', child.pid);
console.log('Live Screen / Record now target this EMPLOYEE_ID.');
