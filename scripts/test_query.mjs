import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://oiaacggukmufsnmubfwo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pYWFjZ2d1a211ZnNubXViZndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ0Mzc5OCwiZXhwIjoyMDg4MDE5Nzk4fQ.a_nE_G7mfgUoG0g5Z13e11qGg6f5mY91471dZf-x490'
);

async function run() {
  const res1 = await sb.from('employees').select('*, devices(*)');
  console.log('res1 (with devices) error:', res1.error, 'data length:', res1.data?.length);

  const res2 = await sb.from('employees').select('*');
  console.log('res2 (without devices) error:', res2.error, 'data:', res2.data);
}
run();
