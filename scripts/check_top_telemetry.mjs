import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function checkScreenshots() {
  const { data: records } = await supabase.from('screenshot_records').select('*').order('captured_at', { ascending: false }).limit(5);
  console.log('Top screenshot_records:');
  for (const r of records || []) {
    const { data: pub } = supabase.storage.from('screenshots').getPublicUrl(r.storage_path);
    console.log(`- ID: ${r.id} | Emp: ${r.employee_id} | Path: ${r.storage_path} | Size: ${r.file_size_bytes} | Public: ${pub.publicUrl}`);
  }

  const { data: aggs } = await supabase.from('activity_aggregates').select('*').order('window_end', { ascending: false }).limit(5);
  console.log('\nTop activity_aggregates:');
  for (const a of aggs || []) {
    console.log(`- Emp: ${a.employee_id} | Window: ${a.window_start} -> ${a.window_end} | Keys: ${a.key_press_count} | Moves: ${a.mouse_move_count} | Clicks: ${a.mouse_click_count}`);
  }
}

checkScreenshots();
