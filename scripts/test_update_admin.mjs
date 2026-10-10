import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data: u, error: e1 } = await supabase.from('users').update({ email: 'admin@permanentseo.com' }).eq('id', 'df8351c6-bb34-4aa0-afd2-ff1a39766242').select();
  console.log('Update users:', u, e1);
  const { data: p, error: e2 } = await supabase.from('profiles').update({ email: 'admin@permanentseo.com' }).eq('id', 'df8351c6-bb34-4aa0-afd2-ff1a39766242').select();
  console.log('Update profiles:', p, e2);
  const { data: d, error: e3 } = await supabase.from('employees').delete().eq('id', 'df8351c6-bb34-4aa0-afd2-ff1a39766242').select();
  console.log('Delete employees:', d, e3);
}

test();
