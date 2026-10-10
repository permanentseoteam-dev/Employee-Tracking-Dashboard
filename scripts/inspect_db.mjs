import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: profs, error: pErr } = await sb.from('profiles').select('*');
  console.log('--- PROFILES ---', profs, pErr);

  const { data: emps, error: eErr } = await sb.from('employees').select('*');
  console.log('--- EMPLOYEES ---', emps, eErr);

  const { data: users, error: uErr } = await sb.from('users').select('*');
  console.log('--- USERS ---', users, uErr);
}

main().catch(console.error);
