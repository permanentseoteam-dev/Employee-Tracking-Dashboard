import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_USER_ID = 'df8351c6-bb34-4aa0-afd2-ff1a39766242';

function isAgentRecord(id, name, email) {
  if (!id && !name && !email) return false;
  const n = (name || '').toLowerCase();
  const em = (email || '').toLowerCase();
  if (n.startsWith('agent (') || n.includes('(agent)') || n === 'agent' || n.startsWith('agent-') || n.includes('desktop-workstation')) return true;
  if (em.includes('@local.device') || em.startsWith('agent-') || em.includes('.agent@') || em.includes('agent@')) return true;
  return false;
}

function isAdminRecord(id, name, email) {
  if (!id && !name && !email) return false;
  if (id && (id === ADMIN_USER_ID || id === 'df8351c6-bb34-4aa0-afd2-ff1a39766242')) return true;
  const em = (email || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (em === 'admin@permanentseo.com' || em === 'shahroz@gmail.com' || em.includes('admin@')) return true;
  if (n.includes('admin') || n.includes('(admin)')) return true;
  return false;
}

function isExcludedEmployeeRecord(e) {
  if (!e) return false;
  const name = e.full_name || e.name;
  if (e.role === 'admin') return true;
  if (isAgentRecord(e.id, name, e.email)) return true;
  if (isAgentRecord(e.user_id, name, e.email)) return true;
  if (isAdminRecord(e.id, name, e.email)) return true;
  if (isAdminRecord(e.user_id, name, e.email)) return true;
  return false;
}

async function verify() {
  const { data: rawEmployees } = await supabase.from('employees').select('*');
  console.log('RAW EMPLOYEES COUNT:', rawEmployees?.length);
  console.log('RAW EMPLOYEES:', rawEmployees);

  const filtered = (rawEmployees || []).filter(e => !isExcludedEmployeeRecord(e));
  console.log('FILTERED EMPLOYEES COUNT:', filtered.length);
  console.log('FILTERED EMPLOYEES:', filtered.map(e => ({ name: e.full_name, email: e.email })));

  const { data: users } = await supabase.from('users').select('*');
  console.log('USERS:', users.map(u => ({ role: u.role, email: u.email, name: u.full_name })));

  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log('PROFILES:', profiles.map(p => ({ role: p.role, email: p.email, name: p.full_name })));
}

verify();
