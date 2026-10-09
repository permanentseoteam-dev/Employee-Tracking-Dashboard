import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function inspectDevices() {
  const { data: devices, error: dErr } = await supabase.from('devices').select('*');
  console.log('Devices in Supabase:', devices, 'Error:', dErr);
}

inspectDevices();
