-- ==============================================================================
-- MIGRATION 018: UPDATE ADMIN EMAIL & PURGE AGENT SYNTHETIC EMPLOYEES
--
-- 1. Updates Administrator email to admin@permanentseo.com across auth.users,
--    public.users, and public.profiles.
-- 2. Removes synthetic 'Agent (DESKTOP-WORKSTATION)' and agent-*@local.device
--    records from public.employees and public.profiles.
-- 3. Drops trg_sync_presence_employee so presence reporting NEVER creates
--    synthetic employee entries.
--
-- How to apply:
-- 1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/sql/new
-- 2. Paste this entire script and click "Run".
-- ==============================================================================

-- 1. DROP THE TRIGGER & FUNCTION THAT AUTO-CREATED SYNTHETIC AGENT EMPLOYEES
DROP TRIGGER IF EXISTS trg_sync_presence_employee ON public.employee_presence;
DROP FUNCTION IF EXISTS public.sync_presence_employee();

-- 2. PURGE ANY SYNTHETIC AGENT RECORDS FROM EMPLOYEES & PROFILES
DELETE FROM public.employees 
WHERE email LIKE '%@local.device' 
   OR email LIKE 'agent-%'
   OR full_name LIKE 'Agent (%'
   OR full_name LIKE '%(Agent)%'
   OR user_id IN (SELECT id FROM public.users WHERE role = 'admin')
   OR id IN (SELECT id FROM public.users WHERE role = 'admin');

DELETE FROM public.profiles 
WHERE email LIKE '%@local.device' 
   OR email LIKE 'agent-%'
   OR email LIKE '%.agent@%'
   OR full_name LIKE 'Agent (%'
   OR full_name LIKE '%(Agent)%';

-- 3. UPDATE ADMINISTRATOR EMAIL IN auth.users
UPDATE auth.users
SET email = 'admin@permanentseo.com',
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_user_meta_data = jsonb_set(
      coalesce(raw_user_meta_data, '{}'::jsonb),
      '{email}',
      '"admin@permanentseo.com"'
    )
WHERE id = 'df8351c6-bb34-4aa0-afd2-ff1a39766242'
   OR email = 'shahroz@gmail.com'
   OR email LIKE 'admin@%';

-- 4. UPDATE ADMINISTRATOR EMAIL IN public.users
UPDATE public.users
SET email = 'admin@permanentseo.com'
WHERE id = 'df8351c6-bb34-4aa0-afd2-ff1a39766242'
   OR role = 'admin'
   OR email = 'shahroz@gmail.com';

-- 5. UPDATE ADMINISTRATOR EMAIL IN public.profiles
UPDATE public.profiles
SET email = 'admin@permanentseo.com'
WHERE id = 'df8351c6-bb34-4aa0-afd2-ff1a39766242'
   OR role = 'admin'
   OR email = 'shahroz@gmail.com';

-- 6. ENSURE NO ADMIN RECORD ACCIDENTALLY EXISTS IN EMPLOYEES
DELETE FROM public.employees 
WHERE email = 'admin@permanentseo.com' 
   OR id = 'df8351c6-bb34-4aa0-afd2-ff1a39766242'
   OR user_id = 'df8351c6-bb34-4aa0-afd2-ff1a39766242';
