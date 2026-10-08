import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkAll() {
  console.log('===============================================================');
  console.log('📡 SUPABASE LIVE DATABASE & AGENT DATA CHECK');
  console.log('URL:', SUPABASE_URL);
  console.log('===============================================================\n');

  const tables = [
    'profiles',
    'teams',
    'projects',
    'tasks',
    'employee_presence',
    'activity_events',
    'activity_aggregates',
    'screenshot_records',
    'task_sessions',
    'attendance_records'
  ];

  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .limit(3);

    if (error) {
      console.log(`❌ Table [${table}]: ERROR -> ${error.message} (${error.code || 'NO_CODE'})`);
    } else {
      console.log(`✅ Table [${table}]: ${count ?? data?.length ?? 0} total records`);
      if (data && data.length > 0) {
        console.log('   Sample row:', JSON.stringify(data[0], null, 2));
      }
    }
    console.log('---------------------------------------------------------------');
  }
}

checkAll();
