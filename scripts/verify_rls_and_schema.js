import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function verify() {
  console.log('===============================================================');
  console.log('🔍 SUPABASE CONNECTION & SCHEMA + RLS VERIFICATION');
  console.log('Project URL:', SUPABASE_URL);
  console.log('===============================================================\n');

  const coreTables = [
    'organizations',
    'users',
    'employees',
    'devices',
    'screenshots',
    'employee_activity',
    'tasks',
    'projects'
  ];

  console.log('--- 1. Checking 8 Core Tables ---');
  for (const tbl of coreTables) {
    const { data, error, count } = await supabase
      .from(tbl)
      .select('*', { count: 'exact' })
      .limit(3);

    if (error) {
      console.log(`❌ Table [${tbl}]: FAILED -> ${error.message} (${error.code || 'ERR'})`);
    } else {
      console.log(`✅ Table [${tbl}]: OK -> ${count ?? data?.length ?? 0} records found`);
      if (data && data.length > 0) {
        console.log(`   Sample:`, JSON.stringify(data[0]));
      }
    }
  }

  console.log('\n--- 2. Checking Storage Bucket ---');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.log('❌ Storage Buckets Error:', bErr.message);
  } else {
    const scBucket = buckets?.find(b => b.name === 'screenshots');
    console.log(`✅ Storage Bucket ['screenshots']: ${scBucket ? 'EXISTS & ACTIVE' : 'MISSING'}`);
  }

  console.log('\n===============================================================');
}

verify();
