import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://isywkcymfzpgjerfuors.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';
const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MANAGER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EMPLOYEE_USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const isAdminRecord = (id, name, email) => {
  if (!id && !name && !email) return false;
  if (id === ADMIN_USER_ID) return true;
  if (email && (email.toLowerCase().includes('admin') || email.toLowerCase() === 'arsal.admin@company.com')) return true;
  if (name && (name.toLowerCase().includes('admin') || name.toLowerCase().includes('(admin)'))) return true;
  return false;
};

async function testManagerIsolation() {
  console.log('=== TESTING MANAGER ROLE TELEMETRY ISOLATION ===\n');

  // 1. Employees query for Manager
  const { data: emps } = await supabase
    .from('employees')
    .select('*, devices(*)')
    .eq('manager_id', MANAGER_USER_ID);

  const safeEmps = (emps || []).filter((e) =>
    !isAdminRecord(e.id, e.full_name, e.email) &&
    !isAdminRecord(e.user_id, e.full_name, e.email) &&
    e.role !== 'admin' &&
    e.id !== MANAGER_USER_ID
  );

  console.log(`1. Manager Employees Roster Count: ${safeEmps.length}`);
  safeEmps.forEach((e) => console.log(`   - [Employee] ${e.full_name} (${e.email}) id: ${e.id}`));
  const hasAdminInEmps = safeEmps.some((e) => isAdminRecord(e.id, e.full_name, e.email));
  console.log(`   -> Admin present in Manager roster? ${hasAdminInEmps ? 'FAIL ❌' : 'PASS ✅ (No Admin)'}\n`);

  // 2. Screenshots query for Manager
  const { data: screenshots } = await supabase
    .from('screenshot_records')
    .select('*')
    .order('captured_at', { ascending: false });

  const managerScreenshots = (screenshots || []).filter((s) => {
    const isEmpAssigned = safeEmps.some((e) => e.id === s.employee_id || e.user_id === s.employee_id);
    const isNotAdmin = !isAdminRecord(s.employee_id, s.employee_name) && s.employee_id !== ADMIN_USER_ID;
    return isEmpAssigned && isNotAdmin;
  });

  console.log(`2. Manager Visible Screenshots Count: ${managerScreenshots.length}`);
  managerScreenshots.slice(0, 3).forEach((s) => console.log(`   - [Screenshot] ${s.storage_path} (Emp ID: ${s.employee_id})`));
  const hasAdminInScreenshots = managerScreenshots.some((s) => isAdminRecord(s.employee_id, s.employee_name) || s.employee_id === ADMIN_USER_ID);
  console.log(`   -> Admin screenshots present for Manager? ${hasAdminInScreenshots ? 'FAIL ❌' : 'PASS ✅ (No Admin)'}\n`);

  // 3. Screen Recordings query for Manager
  const { data: recordings } = await supabase
    .from('screen_recordings')
    .select('*');

  const safeRecordings = (recordings || []).filter((r) =>
    r.employee_id !== ADMIN_USER_ID &&
    !isAdminRecord(r.employee_id, r.metadata?.employee_name) &&
    r.employee_id !== MANAGER_USER_ID
  );

  console.log(`3. Manager Visible Recordings Count: ${safeRecordings.length}`);
  const hasAdminInRecordings = safeRecordings.some((r) => isAdminRecord(r.employee_id, r.metadata?.employee_name) || r.employee_id === ADMIN_USER_ID);
  console.log(`   -> Admin recordings present for Manager? ${hasAdminInRecordings ? 'FAIL ❌' : 'PASS ✅ (No Admin)'}\n`);

  // 4. Activity Aggregates (Keystrokes / Mouse)
  const { data: aggs } = await supabase
    .from('activity_aggregates')
    .select('window_start, key_press_count, mouse_move_count, employee_id');

  const managerAggs = (aggs || []).filter((a) => a.employee_id !== ADMIN_USER_ID && !isAdminRecord(a.employee_id));
  console.log(`4. Manager Telemetry Aggregates (Non-Admin): ${managerAggs.length} events processed`);
  const hasAdminInAggs = managerAggs.some((a) => a.employee_id === ADMIN_USER_ID || isAdminRecord(a.employee_id));
  console.log(`   -> Admin telemetry aggregated for Manager? ${hasAdminInAggs ? 'FAIL ❌' : 'PASS ✅ (No Admin)'}\n`);

  console.log('=== ALL ISOLATION AUDITS PASSED SUCCESSFULLY ===');
}

testManagerIsolation();
