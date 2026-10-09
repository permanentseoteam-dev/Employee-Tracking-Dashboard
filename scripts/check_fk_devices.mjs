import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function checkAll() {
  const { data: devices } = await supabase.from('devices').select('*');
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, role');
  const profileIds = new Set(profiles.map(p => p.id));
  
  console.log('Valid profiles in Supabase:');
  for (const p of profiles) {
    console.log(`  ${p.id} -> ${p.full_name} (${p.role})`);
  }

  console.log('\nChecking all devices in Supabase:');
  for (const d of devices) {
    const isValid = profileIds.has(d.employee_id);
    console.log(`  Device: ${d.device_identifier} | employee_id: ${d.employee_id} | Valid FK? ${isValid}`);
  }
}

checkAll();
