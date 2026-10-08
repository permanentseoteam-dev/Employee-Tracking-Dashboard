import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://isywkcymfzpgjerfuors.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTables() {
  const tables = [
    'employees',
    'devices',
    'employee_presence',
    'screenshots',
    'screenshot_records',
    'activity_events',
    'activity_aggregates',
    'tasks',
    'projects',
    'attendance_records',
    'users'
  ];

  console.log('--- Testing Supabase Tables ---');
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' }).limit(5);
      if (error) {
        console.log(`❌ Table [${table}]: Error ->`, error.message, error.code, error.details);
      } else {
        console.log(`✅ Table [${table}]: Count = ${count ?? data?.length}, Sample row ->`, data?.[0] ? JSON.stringify(data[0]) : 'empty');
      }
    } catch (e) {
      console.log(`💥 Table [${table}]: Exception ->`, e.message);
    }
  }

  console.log('\n--- Testing Storage Buckets ---');
  try {
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) {
      console.log('❌ Storage Buckets Error ->', bErr.message);
    } else {
      console.log('✅ Storage Buckets ->', buckets.map(b => b.name));
    }
  } catch (e) {
    console.log('💥 Storage Exception ->', e.message);
  }
}

testTables();
