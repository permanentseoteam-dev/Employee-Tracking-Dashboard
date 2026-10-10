-- ==============================================================================
-- MIGRATION 021: FIX EMPLOYEES.ROLE AND SCREENSHOT_RECORDS.DEVICE_ID
-- ==============================================================================
-- Fixes:
--   1. Error 42703: column employees.role does not exist
--   2. Error 23502: null value in column "device_id" of relation "screenshot_records" violates not-null constraint
--
-- Instructions: Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/sql/new
-- ==============================================================================

-- 1. Ensure public.employees has role column with default 'employee'
ALTER TABLE IF EXISTS public.employees ADD COLUMN IF NOT EXISTS role text DEFAULT 'employee';

-- Sync role from public.users or public.profiles where available
UPDATE public.employees e
SET role = COALESCE(u.role, p.role, 'employee')
FROM public.users u
FULL OUTER JOIN public.profiles p ON p.id = u.id
WHERE (e.user_id = u.id OR e.id = u.id OR e.email = u.email);

-- 2. Make device_id in public.screenshot_records nullable with sensible default
ALTER TABLE IF EXISTS public.screenshot_records ALTER COLUMN device_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.screenshot_records ALTER COLUMN device_id SET DEFAULT 'WIN-WORKSTATION';

-- Ensure device_id in public.screenshots is nullable with no constraint conflicts
ALTER TABLE IF EXISTS public.screenshots ALTER COLUMN device_id DROP NOT NULL;

-- 3. Drop any stale foreign key constraints that would block inserts if device doesn't exist
ALTER TABLE IF EXISTS public.screenshot_records DROP CONSTRAINT IF EXISTS screenshot_records_device_id_fkey;
ALTER TABLE IF EXISTS public.screenshot_records DROP CONSTRAINT IF EXISTS screenshot_records_employee_id_fkey;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
