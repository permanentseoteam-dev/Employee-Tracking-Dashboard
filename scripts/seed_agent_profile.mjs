import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function insertProfile() {
  const profileId = 'd9b4bfb3-9953-522d-84af-3de709e7caa8';
  console.log('Inserting fallback profile for ID:', profileId);

  const { data, error } = await supabase.from('profiles').upsert([
    {
      id: profileId,
      email: 'arsal.agent@company.com',
      full_name: 'Arsal',
      role: 'employee',
      department: 'Engineering',
    }
  ]).select();

  console.log('Upsert profile result:', data, 'Error:', error);

  // Also in employees table
  const { data: empData, error: empErr } = await supabase.from('employees').upsert([
    {
      id: profileId,
      user_id: profileId,
      full_name: 'Arsal',
      email: 'arsal.agent@company.com',
      department: 'Engineering',
      status: 'active',
    }
  ]).select();
  console.log('Upsert employee result:', empData, 'Error:', empErr);
}

insertProfile();
