import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function runTest() {
  console.log('Testing live data fetch directly from Supabase...');
  
  // 1. Presence
  const { data: pres } = await supabase.from('employee_presence').select('*').order('updated_at', { ascending: false });
  console.log('Latest Presence:', pres?.map(p => ({ emp: p.employee_id.slice(0,8), status: p.status, updated: p.updated_at })));

  // 2. Screenshots
  const { data: scs } = await supabase.from('screenshot_records').select('*').order('captured_at', { ascending: false }).limit(2);
  console.log('Latest Screenshots:', scs?.map(s => ({ emp: s.employee_id.slice(0,8), path: s.storage_path, time: s.captured_at })));

  // 3. Activity Aggregates
  const { data: aggs } = await supabase.from('activity_aggregates').select('*').order('window_start', { ascending: false }).limit(3);
  console.log('Latest Aggregates:', aggs?.map(a => ({ emp: a.employee_id.slice(0,8), keys: a.key_press_count, moves: a.mouse_move_count, time: a.window_start })));
}

runTest();
