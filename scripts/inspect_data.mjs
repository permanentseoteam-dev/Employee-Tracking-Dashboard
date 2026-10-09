import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function check() {
  const { data: emps, error: empErr } = await supabase.from('employees').select('*');
  console.log('--- EMPLOYEES TABLE ---', emps, empErr);
  const { data: profs, error: profErr } = await supabase.from('profiles').select('*');
  console.log('--- PROFILES TABLE ---', profs, profErr);

  const { data: pres } = await supabase.from('employee_presence').select('*').limit(5);

  console.log('--- PRESENCE ---', JSON.stringify(pres, null, 2));

  const path = 'cccccccc-cccc-cccc-cccc-cccccccccccc/1791522392647_WIN-DESKTOP-QUVQI4B-ok.jpg';
  const { data: pubUrl } = supabase.storage.from('screenshots').getPublicUrl(path);
  console.log('Public URL:', pubUrl.publicUrl);
  try {
    const res = await fetch(pubUrl.publicUrl);
    console.log('Public URL HTTP status:', res.status, res.headers.get('content-type'), res.headers.get('content-length'));
  } catch (err) {
    console.log('Fetch error:', err.message);
  }

  const { data: screens } = await supabase.from('screenshot_records').select('*').order('captured_at', { ascending: false }).limit(5);

  console.log('--- SCREENSHOTS ---', JSON.stringify(screens, null, 2));

  const { data: aggs } = await supabase.from('activity_aggregates').select('*').order('window_start', { ascending: true });
  console.log('--- AGGREGATES BREAKDOWN ---');
  for (const a of aggs || []) {
    const d = new Date(a.window_start);
    console.log(`Agg: emp=${a.employee_id?.slice(0,8)} window=${a.window_start} LocalHr=${d.getHours()} UTCHr=${d.getUTCHours()} Keys=${a.key_press_count} Moves=${a.mouse_move_count}`);
  }


  const { data: storageFiles, error: storageErr } = await supabase.storage.from('screenshots').list('', { limit: 20 });
  console.log('--- STORAGE ROOT ---', storageFiles, storageErr);
  if (storageFiles) {
    for (const f of storageFiles) {
      if (!f.id) {
        // folder
        const { data: subFiles } = await supabase.storage.from('screenshots').list(f.name, { limit: 10 });
        console.log(`--- FOLDER ${f.name} ---`, subFiles);
      }
    }
  }
}
check();
