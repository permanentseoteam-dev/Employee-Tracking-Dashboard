import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://isywkcymfzpgjerfuors.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testStorageAndUrls() {
  console.log('--- 1. Testing Screenshot Records in DB ---');
  const { data: dbScreenshots, error: dbErr } = await supabase
    .from('screenshot_records')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(3);
  
  console.log('DB Screenshot records:', dbScreenshots, dbErr);

  if (dbScreenshots && dbScreenshots.length > 0) {
    const sample = dbScreenshots[0];
    console.log('\n--- 2. Testing Storage URLs for path:', sample.storage_path);

    // Try 'screenshots' bucket
    const { data: pubUrl1 } = supabase.storage.from('screenshots').getPublicUrl(sample.storage_path);
    console.log('Bucket "screenshots" public URL:', pubUrl1?.publicUrl);

    // Try signed URL on 'screenshots' bucket
    const { data: signed1, error: signErr1 } = await supabase.storage.from('screenshots').createSignedUrl(sample.storage_path, 3600);
    console.log('Bucket "screenshots" signed URL:', signed1?.signedUrl, signErr1?.message);

    // Try downloading blob
    const { data: blob1, error: dlErr1 } = await supabase.storage.from('screenshots').download(sample.storage_path);
    console.log('Download from "screenshots":', blob1 ? `Blob size: ${blob1.size} bytes` : `Error: ${dlErr1?.message}`);

    // Try with fetch on publicUrl
    try {
      const res = await fetch(pubUrl1.publicUrl);
      console.log('HTTP Fetch status on public URL:', res.status, res.statusText);
      const text = await res.text();
      console.log('HTTP Fetch body preview:', text.substring(0, 150));
    } catch (e) {
      console.log('HTTP Fetch failed:', e.message);
    }
  }

  console.log('\n--- 3. Testing Commands table (for on-demand recording / capture commands) ---');
  const { data: cmds, error: cmdErr } = await supabase.from('agent_commands').select('*').limit(5);
  console.log('agent_commands table:', cmds, cmdErr?.message);

  const { data: actions, error: actErr } = await supabase.from('commands').select('*').limit(5);
  console.log('commands table:', actions, actErr?.message);
}

testStorageAndUrls();
