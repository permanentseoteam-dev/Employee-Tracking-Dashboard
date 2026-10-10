import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data: u, error: uErr } = await supabase.from('users').select('*').limit(1);
  console.log('users columns:', u ? Object.keys(u[0] || {}) : null, uErr);

  const { data: p, error: pErr } = await supabase.from('profiles').select('*').limit(1);
  console.log('profiles columns:', p ? Object.keys(p[0] || {}) : null, pErr);

  const { data: e, error: eErr } = await supabase.from('employees').select('*').limit(1);
  console.log('employees columns:', e ? Object.keys(e[0] || {}) : null, eErr);
}

check();
