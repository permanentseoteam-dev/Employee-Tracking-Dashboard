import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('f:/TrackingDashboard/.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();

const sb = createClient(url, key);

async function checkRec() {
  const { data } = await sb.from('screenshot_records').select('*').eq('id', '406f29e8-8ce4-4075-95a5-3b4d4f64cc25');
  console.log('Is record still in screenshot_records?', data);
}

checkRec();
