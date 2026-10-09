import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function check() {
  // Let's test inserting a dummy record with ccc...
  const empId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const { data, error } = await supabase.from('screenshot_records').insert([
    {
      employee_id: empId,
      device_id: 'WIN-CLIENT',
      captured_at: new Date().toISOString(),
      storage_path: 'test.jpg',
      file_size_bytes: 100,
    }
  ]).select();
  console.log('Insert with ccc result:', data, 'Error:', error);

  // Let's test inserting a dummy record with a random uuid
  const randomUuid = '12345678-1234-1234-1234-123456789012';
  const { data: d2, error: e2 } = await supabase.from('screenshot_records').insert([
    {
      employee_id: randomUuid,
      device_id: 'WIN-CLIENT',
      captured_at: new Date().toISOString(),
      storage_path: 'test.jpg',
      file_size_bytes: 100,
    }
  ]).select();
  console.log('Insert with random uuid result:', d2, 'Error:', e2);
}

check();
