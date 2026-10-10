/**
 * Upload a local signed build as GitHub release v{version}.
 * Requires: gh auth login (or GH_TOKEN).
 *
 * Usage: node scripts/publish-github-release.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const conf = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const version = conf.version;
const tag = `v${version}`;
const nsisCandidates = [
  join(root, 'src-tauri/target/release/bundle/nsis'),
  join(root, 'target-employee-agent/release/bundle/nsis'),
];
const setupName = `Employee Tracking App_${version}_x64-setup.exe`;
const nsisDir = nsisCandidates.find((d) => existsSync(join(d, setupName))) || nsisCandidates[0];
const setup = join(nsisDir, setupName);
const sigPath = `${setup}.sig`;

if (!existsSync(setup) || !existsSync(sigPath)) {
  console.error(`Missing ${setupName} (+ .sig). Run: npm run build:desktop`);
  process.exit(1);
}

const signature = readFileSync(sigPath, 'utf8').trim();
// GitHub release assets replace spaces with dots in the published filename.
const publishedName = setupName.replace(/ /g, '.');
const url = `https://github.com/permanentseoteam-dev/Employee-Tracking-Dashboard/releases/download/${tag}/${publishedName}`;
const latest = {
  version,
  notes: `Employee Tracking ${tag}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': { signature, url },
  },
};
const latestPath = join(nsisDir, 'latest.json');
writeFileSync(latestPath, JSON.stringify(latest, null, 2));

function gh(args) {
  const r = spawnSync('gh', args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

gh([
  'release',
  'create',
  tag,
  setup,
  sigPath,
  latestPath,
  '--title',
  `Employee Tracking ${tag}`,
  '--notes',
  'Desktop installer + signed updater channel (latest.json).',
]);

// Re-upload latest.json after create so URL matches GitHub's dotted asset name.
gh([
  'release',
  'upload',
  tag,
  latestPath,
  '--clobber',
]);
console.log(`Published ${tag}. Channel: .../releases/latest/download/latest.json`);
