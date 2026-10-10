import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Attempting to delete orphaned shahroz records...');
  const r1 = await supabase.from('profiles').delete().in('email', ['shahroz@gmail.com', 'shahroz@company.com']);
  console.log('Deleted profiles:', r1);

  const r2 = await supabase.from('users').delete().in('email', ['shahroz@gmail.com', 'shahroz@company.com']);
  console.log('Deleted users:', r2);

  const { data: u } = await supabase.from('users').select('*');
  console.log('Remaining users:', u);

  const { data: p } = await supabase.from('profiles').select('*');
  console.log('Remaining profiles:', p);
}

run();
