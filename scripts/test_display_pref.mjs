import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const r1 = await supabase.from('profiles').update({ display_name_pref: 'first' }).eq('id', 'df8351c6-bb34-4aa0-afd2-ff1a39766242');
  console.log('Update profiles display_name_pref error:', r1.error);

  const r2 = await supabase.from('users').update({ display_name_pref: 'first' }).eq('id', 'df8351c6-bb34-4aa0-afd2-ff1a39766242');
  console.log('Update users display_name_pref error:', r2.error);

  const r3 = await supabase.from('users').select('id, full_name, email, display_name_pref').limit(1);
  console.log('Select users display_name_pref error:', r3.error);
}

test();
