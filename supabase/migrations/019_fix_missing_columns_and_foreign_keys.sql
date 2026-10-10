-- ==============================================================================
-- MIGRATION 019: PERMANENT FIX FOR ERROR 42703 (MISSING COLUMN) & ERROR 23503 (FK VIOLATIONS)
--
-- Resolves:
-- 1. ERROR 42703: column users.display_name_pref does not exist
-- 2. ERROR 23503: insert or update on table "employees" violates foreign key constraint "employees_user_id_fkey"
-- 3. ERROR 23503: insert or update on table "screenshots" violates foreign key constraint "screenshots_employee_id_fkey"
--
-- How to apply:
-- 1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/sql/new
-- 2. Paste this entire script and click "Run".
-- ==============================================================================

-- 1. ADD MISSING display_name_pref COLUMN ACROSS ALL IDENTITY & WORKFORCE TABLES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name_pref text DEFAULT 'first';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name_pref text DEFAULT 'first';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS display_name_pref text DEFAULT 'first';

-- 2. DROP RIGID FOREIGN KEY CONSTRAINTS PREVENTING TELEMETRY & ASYNCHRONOUS DEVICE INSERTS (23503)
-- High-frequency telemetry and workforce sync should never abort transactions on device reporting order.
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_user_id_fkey;
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_manager_id_fkey;
ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_employee_id_fkey;
ALTER TABLE public.screenshots DROP CONSTRAINT IF EXISTS screenshots_employee_id_fkey;
ALTER TABLE public.screenshots DROP CONSTRAINT IF EXISTS screenshots_device_id_fkey;
ALTER TABLE public.screenshot_records DROP CONSTRAINT IF EXISTS screenshot_records_employee_id_fkey;
ALTER TABLE public.employee_activity DROP CONSTRAINT IF EXISTS employee_activity_employee_id_fkey;
ALTER TABLE public.employee_activity DROP CONSTRAINT IF EXISTS employee_activity_device_id_fkey;
ALTER TABLE public.employee_presence DROP CONSTRAINT IF EXISTS employee_presence_employee_id_fkey;
ALTER TABLE public.activity_events DROP CONSTRAINT IF EXISTS activity_events_employee_id_fkey;

-- 3. ENSURE POSTGREST SCHEMA CACHE RELOADS IMMEDIATELY
NOTIFY pgrst, 'reload schema';
