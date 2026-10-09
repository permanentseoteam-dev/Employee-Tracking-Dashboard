/**
 * Removes dummy/sample screen recording events from Supabase activity_events.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  const text = readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing Supabase URL/key in .env');
  process.exit(1);
}

const supabase = createClient(url, key);
const dummyNeedle = /(gtv-videos-bucket|forbiggerblazes|unsplash\.com|sample\/)/i;

const { data: events, error } = await supabase
  .from('activity_events')
  .select('id, metadata, event_type')
  .in('event_type', ['screen_recording', 'on_demand_screen_recording']);

if (error) {
  console.error('Fetch activity_events failed:', error.message);
  process.exit(1);
}

let purged = 0;
for (const ev of events || []) {
  const meta = ev.metadata || {};
  const videoUrl = meta.video_url || '';
  if (!videoUrl || dummyNeedle.test(videoUrl) || dummyNeedle.test(meta.thumbnail_url || '')) {
    const { error: delErr } = await supabase.from('activity_events').delete().eq('id', ev.id);
    if (delErr) console.warn('Delete failed', ev.id, delErr.message);
    else {
      purged += 1;
      console.log('Deleted event', ev.id);
    }
  }
}

console.log(`Purged ${purged} of ${(events || []).length} recording events`);
console.log('Done');
