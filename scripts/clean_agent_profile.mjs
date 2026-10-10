import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanProfiles() {
  const { data: d1 } = await supabase.from('profiles').delete().eq('id', 'd9b4bfb3-9953-522d-84af-3de709e7caa8').select();
  console.log('Deleted agent profile:', d1);
  const { data: d2 } = await supabase.from('users').delete().eq('id', 'd9b4bfb3-9953-522d-84af-3de709e7caa8').select();
  console.log('Deleted agent user:', d2);
  const { data: d3 } = await supabase.from('employees').delete().eq('id', 'd9b4bfb3-9953-522d-84af-3de709e7caa8').select();
  console.log('Deleted agent employee:', d3);
}

cleanProfiles();
