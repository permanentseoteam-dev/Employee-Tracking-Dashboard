import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://isywkcymfzpgjerfuors.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs'
);

async function check() {
  const { data: rows, error: rErr } = await supabase
    .from('screenshots')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(5);

  console.log('Screenshots rows:', JSON.stringify(rows, null, 2));

  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets, 'bErr:', bErr);

  if (rows && rows.length > 0) {
    for (const r of rows) {
      console.log('Row storage_path:', r.storage_path);
      const pub = supabase.storage.from('screenshots').getPublicUrl(r.storage_path);
      console.log('Public URL:', pub.data.publicUrl);

      // Check if URL returns 200 or 400 or 404
      try {
        const res = await fetch(pub.data.publicUrl);
        console.log('Fetch public URL status:', res.status, res.statusText);
        if (res.status !== 200) {
          const text = await res.text();
          console.log('Fetch body:', text);
        }
      } catch (e) {
        console.log('Fetch error:', e.message);
      }

      const signed = await supabase.storage.from('screenshots').createSignedUrl(r.storage_path, 60);
      console.log('Signed URL result:', signed);
      if (signed.data?.signedUrl) {
        const res2 = await fetch(signed.data.signedUrl);
        console.log('Fetch signed URL status:', res2.status, res2.statusText);
      }
      break;
    }
  }
}

check();
