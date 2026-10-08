import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://isywkcymfzpgjerfuors.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const t1 = await supabase.from('screen_recordings').select('*').limit(1);
  console.log('screen_recordings:', t1.error ? t1.error.message : 'EXISTS');

  const t2 = await supabase.from('recordings').select('*').limit(1);
  console.log('recordings:', t2.error ? t2.error.message : 'EXISTS');

  const b = await supabase.storage.listBuckets();
  console.log('Storage buckets:', b.data?.map(x => x.name));
}

check();
