/**
 * Prints / verifies project_items schema.
 * DDL cannot run via the anon key — paste supabase/migrations/010_project_items.sql
 * into Supabase Dashboard → SQL Editor → Run.
 *
 * Until that migration is applied, the app stores trees in:
 *   - localStorage
 *   - Storage bucket screenshots/project-trees/{projectId}.json
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const sb = createClient(url, key);
const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '010_project_items.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const { error } = await sb.from('project_items').select('id').limit(1);
if (!error) {
  console.log('OK: public.project_items already exists');
  process.exit(0);
}

console.log('MISSING: public.project_items →', error.message);
console.log('\n--- Paste this into Supabase SQL Editor and Run ---\n');
console.log(sql);
console.log('\n--- end ---\n');

// Verify storage fallback path works
const probe = `project-trees/_schema_probe_${Date.now()}.json`;
const up = await sb.storage
  .from('screenshots')
  .upload(probe, new Blob([JSON.stringify([])], { type: 'application/json' }), {
    upsert: true,
    contentType: 'application/json',
  });
if (up.error) {
  console.warn('Storage fallback probe failed:', up.error.message);
} else {
  await sb.storage.from('screenshots').remove([probe]);
  console.log('OK: screenshots/project-trees storage fallback is writable');
}
process.exit(1);
