import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function checkProfiles() {
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  console.log('Profiles in Supabase:', profiles, 'Error:', pErr);

  const { data: emps, error: eErr } = await supabase.from('employees').select('*');
  console.log('Employees in Supabase:', emps, 'Error:', eErr);

  const { data: cProfile } = await supabase.from('profiles').select('*').eq('id', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
  console.log('Is ccc... in profiles?:', cProfile);
}

checkProfiles();
