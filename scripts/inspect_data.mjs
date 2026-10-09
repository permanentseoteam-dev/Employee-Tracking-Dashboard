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

  const { data: screens } = await supabase.from('screenshot_records').select('*').order('captured_at', { ascending: false }).limit(5);
  console.log('--- SCREENSHOTS ---', JSON.stringify(screens, null, 2));

  const { data: agg } = await supabase.from('activity_aggregates').select('*').order('window_start', { ascending: false }).limit(5);
  console.log('--- AGGREGATES (Keys / Mouse) ---', JSON.stringify(agg, null, 2));

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
