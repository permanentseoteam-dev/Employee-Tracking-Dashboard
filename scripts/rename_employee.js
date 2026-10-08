import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function rename() {
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: 'Arsal', email: 'arsal@company.com' })
    .eq('id', 'cccccccc-cccc-cccc-cccc-cccccccccccc')
    .select();

  if (error) {
    console.error('Error updating name:', error);
  } else {
    console.log('✅ Successfully updated profile in Supabase:', data);
  }
}

rename();
