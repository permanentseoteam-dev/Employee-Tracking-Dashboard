import { spawn } from 'child_process';
import process from 'process';

console.log('====================================================');
console.log('🚀 Starting Localhost Dashboard & Employee Monitoring Agent');
console.log('====================================================');

// 1. Launch Vite dev server (Dashboard UI on http://localhost:1420)
const vite = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
});

// 2. Launch Rust Native Employee Agent (Background screenshot & telemetry capture)
const agent = spawn('cargo', ['run', '--manifest-path', 'employee-agent/Cargo.toml'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
});

function handleExit() {
  console.log('\n🛑 Shutting down Vite and Employee Agent...');
  try {
    vite.kill();
  } catch {}
  try {
    agent.kill();
  } catch {}
  process.exit();
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('exit', handleExit);

vite.on('close', (code) => {
  if (code !== 0) {
    console.error(`Vite exited with code ${code}`);
  }
});

agent.on('close', (code) => {
  if (code !== 0) {
    console.error(`Employee Agent exited with code ${code}`);
  }
});
