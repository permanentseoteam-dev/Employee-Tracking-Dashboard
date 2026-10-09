/**
 * Creates agent_runtime_config via REST if possible; otherwise prints SQL to run.
 * Upserts default Mon–Fri 09:00–17:00 office hours.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const payload = {
  id: 1,
  enabled: true,
  work_start: '09:00:00',
  work_end: '17:00:00',
  work_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  capture_outside_hours: false,
  timezone_note: 'Uses each workstation local clock',
  updated_at: new Date().toISOString(),
};

const { data, error } = await supabase
  .from('agent_runtime_config')
  .upsert(payload, { onConflict: 'id' })
  .select()
  .maybeSingle();

if (error) {
  console.error('Upsert failed (run migration 006 in SQL editor first):', error.message);
  console.log('\nOpen: https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/sql/new');
  console.log('Paste: supabase/migrations/006_agent_office_hours.sql');
  process.exit(1);
}

console.log('agent_runtime_config ready:', data);
