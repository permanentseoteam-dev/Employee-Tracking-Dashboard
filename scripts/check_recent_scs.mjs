import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function checkScreenshots() {
  const { data: scs } = await supabase.from('screenshot_records').select('*').order('captured_at', { ascending: false }).limit(5);
  console.log('Most recent screenshot_records:');
  console.dir(scs, { depth: null });
}

checkScreenshots();
