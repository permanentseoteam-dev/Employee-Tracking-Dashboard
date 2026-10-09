import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: users } = await supabase.from('users').select('*');
  console.log('USERS:', JSON.stringify(users, null, 2));

  const { data: emps } = await supabase.from('employees').select('*');
  console.log('EMPLOYEES:', JSON.stringify(emps, null, 2));

  const { data: pres } = await supabase.from('employee_presence').select('*');
  console.log('PRESENCE:', JSON.stringify(pres, null, 2));
}

run();
