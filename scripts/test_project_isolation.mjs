import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

async function runTest() {
  console.log('Testing manager projects isolation...');
  const { data: projs } = await supabase.from('projects').select('*, tasks(*)');
  console.log(`Total projects in DB: ${projs.length}`);
  projs.forEach(p => {
    console.log(`- Project: "${p.name}" (ID: ${p.id}, MgrID: ${p.manager_id}, Tasks: ${p.tasks?.length})`);
    p.tasks?.forEach(t => console.log(`    Task: "${t.title}" assigned to ${t.assigned_to}`));
  });
}

runTest();
