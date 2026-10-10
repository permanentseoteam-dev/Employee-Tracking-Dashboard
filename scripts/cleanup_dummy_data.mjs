import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const DUMMY_IDS = [
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'd9b4bfb3-9953-522d-84af-3de709e7caa8'
];

async function cleanup() {
  console.log('Cleaning up dummy UUIDs from database...');

  for (const id of DUMMY_IDS) {
    const { error: e1 } = await sb.from('employee_presence').delete().eq('employee_id', id);
    console.log(`Deleted employee_presence for ${id}:`, e1 || 'OK');

    const { error: e2 } = await sb.from('activity_events').delete().eq('employee_id', id);
    console.log(`Deleted activity_events for ${id}:`, e2 || 'OK');

    const { error: e3 } = await sb.from('activity_aggregates').delete().eq('employee_id', id);
    console.log(`Deleted activity_aggregates for ${id}:`, e3 || 'OK');

    const { error: e4 } = await sb.from('devices').delete().eq('employee_id', id);
    console.log(`Deleted devices for ${id}:`, e4 || 'OK');

    const { error: e5 } = await sb.from('screenshots').delete().eq('employee_id', id);
    console.log(`Deleted screenshots for ${id}:`, e5 || 'OK');

    const { error: e6 } = await sb.from('screenshot_records').delete().eq('employee_id', id);
    console.log(`Deleted screenshot_records for ${id}:`, e6 || 'OK');

    const { error: e7 } = await sb.from('employees').delete().eq('id', id);
    console.log(`Deleted employees for ${id}:`, e7 || 'OK');

    const { error: e8 } = await sb.from('users').delete().eq('id', id);
    console.log(`Deleted users for ${id}:`, e8 || 'OK');

    const { error: e9 } = await sb.from('profiles').delete().eq('id', id);
    console.log(`Deleted profiles for ${id}:`, e9 || 'OK');
  }

  // Check presence table after cleanup
  const { data: pres } = await sb.from('employee_presence').select('*');
  console.log('--- REMAINING PRESENCE RECORDS ---', pres);
}

cleanup().catch(console.error);
