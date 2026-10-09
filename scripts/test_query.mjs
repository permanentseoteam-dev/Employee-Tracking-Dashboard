import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://isywkcymfzpgjerfuors.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs'
);

async function run() {
  const { data: users, error: uErr } = await sb.from('users').select('*');
  console.log('USERS:', users, uErr);
  const { data: emps, error: eErr } = await sb.from('employees').select('*');
  console.log('EMPLOYEES:', emps, eErr);
}
run();
