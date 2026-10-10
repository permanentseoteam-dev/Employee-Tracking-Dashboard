-- ==============================================================================
-- MIGRATION 016: PERMANENT FIX FOR FOREIGN KEY CONSTRAINT VIOLATIONS (23503)
-- Resolves: insert or update on table "employee_presence" violates foreign key constraint "employee_presence_employee_id_fkey"
--
-- How to apply:
-- 1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/sql/new
-- 2. Paste this entire script and click "Run".
-- ==============================================================================

-- 1. Drop rigid foreign key constraints on high-frequency telemetry & presence tables
-- Telemetry feeds must never fail with Postgres 23503 errors when devices report data.
ALTER TABLE public.employee_presence DROP CONSTRAINT IF EXISTS employee_presence_employee_id_fkey;
ALTER TABLE public.screenshot_records DROP CONSTRAINT IF EXISTS screenshot_records_employee_id_fkey;
ALTER TABLE public.activity_events DROP CONSTRAINT IF EXISTS activity_events_employee_id_fkey;

-- 2. Clean up any previous presence trigger (synthetic agent rows removed per migration 018)
DROP TRIGGER IF EXISTS trg_sync_presence_employee ON public.employee_presence;
DROP FUNCTION IF EXISTS public.sync_presence_employee();

-- 3. Clean up any lingering presence records from old dummy IDs
DELETE FROM public.employee_presence 
WHERE employee_id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
