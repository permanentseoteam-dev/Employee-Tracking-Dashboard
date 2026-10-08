import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function check() {
  console.log('=== VERIFYING SCREENSHOT STORAGE & DATABASE RECORDS ===');
  const { data: records, error } = await supabase
    .from('screenshots')
    .select('*')
    .order('captured_at', { ascending: false });

  console.log('Total Screenshots in DB:', records?.length ?? 0, error ? `(Error: ${error.message})` : '');

  if (records && records.length > 0) {
    for (const r of records) {
      const { data: pubUrl } = supabase.storage.from('screenshots').getPublicUrl(r.storage_path);
      console.log(`\n📸 Record ID: ${r.id}`);
      console.log(`   Employee:  ${r.employee_id}`);
      console.log(`   Path:      ${r.storage_path}`);
      console.log(`   Size:      ${r.file_size_bytes} bytes (${r.width}x${r.height})`);
      console.log(`   Public URL:${pubUrl?.publicUrl}`);

      const { data: blob, error: dlErr } = await supabase.storage.from('screenshots').download(r.storage_path);
      if (dlErr) {
        console.log(`   ⚠️ Storage Download: ${dlErr.message}`);
      } else {
        console.log(`   ✅ Storage Download: Verified OK (${blob?.size} bytes downloaded)`);
      }
    }
  }
  console.log('======================================================');
}

check();
