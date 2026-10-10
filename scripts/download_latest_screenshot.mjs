import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://isywkcymfzpgjerfuors.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs'
);

async function downloadLatest() {
  const { data: rows } = await supabase
    .from('screenshots')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(1);

  if (!rows || rows.length === 0) {
    console.log('No screenshots found');
    return;
  }

  const row = rows[0];
  console.log('Latest row:', row);
  const pub = supabase.storage.from('screenshots').getPublicUrl(row.storage_path);
  console.log('Downloading from:', pub.data.publicUrl);

  const res = await fetch(pub.data.publicUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log('Downloaded bytes:', buf.length);
  fs.writeFileSync('C:/Users/ok/.gemini/antigravity-ide/brain/9bcf8d68-539b-45ed-bebf-c3ac06425aba/latest_screenshot.jpg', buf);
  console.log('Saved to latest_screenshot.jpg');
}

downloadLatest();
