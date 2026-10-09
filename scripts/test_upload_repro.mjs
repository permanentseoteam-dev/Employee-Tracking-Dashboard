import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function testUpload() {
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets, bErr);

  const { data: epData, error: epErr } = await supabase.from('employee_presence').select('*').limit(5);
  console.log('employee_presence data:', epData, 'error:', epErr);

  const { data: empData, error: empErr } = await supabase.from('employees').select('*');
  console.log('employees data:', empData, 'error:', empErr);
}

testUpload();
