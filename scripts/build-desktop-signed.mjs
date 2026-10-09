import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const keyPath =
  process.env.TAURI_SIGNING_PRIVATE_KEY_PATH ||
  join(homedir(), '.tauri', 'employee-tracking.key');

if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
  if (!existsSync(keyPath)) {
    console.error(
      `Missing signing key. Set TAURI_SIGNING_PRIVATE_KEY or place key at:\n  ${keyPath}`
    );
    process.exit(1);
  }
  process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyPath, 'utf8').trim();
}

if (!process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD =
    process.env.TAURI_UPDATER_KEY_PASSWORD || 'tracking-updater';
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('npm', ['run', 'prepare:agent']);
run('npm', ['run', 'tauri', '--', 'build']);
