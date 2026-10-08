import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://isywkcymfzpgjerfuors.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTelemetry() {
  console.log('--- 1. Employees ---');
  const { data: emps } = await supabase.from('employees').select('*, devices(*)');
  console.log('Employees:', emps);

  console.log('\n--- 2. Employee Presence ---');
  const { data: presence } = await supabase.from('employee_presence').select('*');
  console.log('Presence:', presence);

  console.log('\n--- 3. Activity Aggregates (latest 5) ---');
  const { data: aggs } = await supabase.from('activity_aggregates').select('*').order('window_end', { ascending: false }).limit(5);
  console.log('Aggregates:', aggs);

  console.log('\n--- 4. Activity Events (latest 5) ---');
  const { data: events } = await supabase.from('activity_events').select('*').order('occurred_at', { ascending: false }).limit(5);
  console.log('Events:', events);

  console.log('\n--- 5. Screenshot Records (latest 3) ---');
  const { data: scs } = await supabase.from('screenshot_records').select('*').order('captured_at', { ascending: false }).limit(3);
  console.log('Screenshot records:', scs);
}

testTelemetry();
