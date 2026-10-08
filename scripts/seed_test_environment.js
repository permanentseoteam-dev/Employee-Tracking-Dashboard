import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function seedTestEnvironment() {
  console.log('===============================================================');
  console.log('🌱 STEP 1: INITIALIZING COMPLETE TEST ENVIRONMENT');
  console.log('===============================================================\n');

  // 1. Organization
  const orgId = '00000000-0000-0000-0000-000000000001';
  await supabase.from('organizations').upsert([
    { id: orgId, name: 'Enterprise Technology Corp' }
  ]);
  console.log('✅ 1 Organization seeded: Enterprise Technology Corp');

  // 2. Users (1 Admin, 1 Manager, 2 Employees)
  const users = [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      organization_id: orgId,
      email: 'admin@company.com',
      full_name: 'Admin User',
      role: 'admin',
    },
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      organization_id: orgId,
      email: 'alex.v@company.com',
      full_name: 'Alex Vance',
      role: 'manager',
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      organization_id: orgId,
      email: 'arsal@company.com',
      full_name: 'Arsal',
      role: 'employee',
    },
    {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      organization_id: orgId,
      email: 'michael.c@company.com',
      full_name: 'Michael Chen',
      role: 'employee',
    }
  ];

  await supabase.from('users').upsert(users);
  console.log('✅ 4 Users seeded: 1 Admin, 1 Manager, 2 Employees');

  // Sync profiles table
  await supabase.from('profiles').upsert(users.map(u => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    department: 'Engineering'
  })));

  // 3. Employees Table
  const employees = [
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      organization_id: orgId,
      manager_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      full_name: 'Arsal',
      email: 'arsal@company.com',
      department: 'Engineering',
      status: 'active'
    },
    {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      user_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      organization_id: orgId,
      manager_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      full_name: 'Michael Chen',
      email: 'michael.c@company.com',
      department: 'Engineering',
      status: 'active'
    }
  ];

  await supabase.from('employees').upsert(employees);
  console.log('✅ 2 Employees mapped: Arsal and Michael Chen (both managed by Alex Vance)');

  // 4. Devices Table (2 Test Devices)
  const devices = [
    {
      id: '99999999-9999-9999-9999-999999999999',
      employee_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      device_name: 'DESKTOP-QUVQI4B',
      device_identifier: 'WIN-DESKTOP-ARSAL-01',
      os_version: 'Windows 10/11 x86_64',
      agent_version: '0.1.0',
      last_seen_at: new Date().toISOString()
    },
    {
      id: '88888888-8888-8888-8888-888888888888',
      employee_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      device_name: 'LAPTOP-MICHAEL-DEV',
      device_identifier: 'WIN-LAPTOP-MICHAEL-02',
      os_version: 'Windows 10/11 x86_64',
      agent_version: '0.1.0',
      last_seen_at: new Date().toISOString()
    }
  ];

  await supabase.from('devices').upsert(devices);
  console.log('✅ 2 Workstation Devices seeded: WIN-DESKTOP-ARSAL-01 & WIN-LAPTOP-MICHAEL-02');

  // 5. Initial Presence
  await supabase.from('employee_presence').upsert([
    {
      employee_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      device_id: 'WIN-DESKTOP-ARSAL-01',
      status: 'active',
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      employee_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      device_id: 'WIN-LAPTOP-MICHAEL-02',
      status: 'active',
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]);
  console.log('✅ Live Presence initialized for both test workstations');

  console.log('\n===============================================================');
  console.log('✨ TEST ENVIRONMENT READY: 1 Admin, 1 Manager, 2 Employees, 2 Devices');
  console.log('===============================================================\n');
}

seedTestEnvironment();
