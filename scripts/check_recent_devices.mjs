import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function checkRecent() {
  const { data: devices } = await supabase.from('devices').select('*').order('last_seen_at', { ascending: false }).limit(5);
  console.log('Most recent devices:');
  console.dir(devices, { depth: null });
}

checkRecent();
