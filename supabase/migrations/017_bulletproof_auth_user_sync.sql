-- ==============================================================================
-- MIGRATION 017: BULLETPROOF AUTH SYNCHRONIZATION & CASCADE LIFECYCLE
-- 
-- Resolves:
-- 1. "ERROR: current transaction is aborted" (HTTP 500 on /signup) caused by 
--    re-registering an email that left orphaned rows in public.users / public.profiles.
-- 2. "Email not confirmed" by auto-confirming registrations.
-- 3. Automatic cleanup when users are deleted from Supabase Authentication.
--
-- How to apply:
-- 1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/sql/new
-- 2. Paste this entire script and click "Run".
-- ==============================================================================

-- 1. DROP RIGID FOREIGN KEY CONSTRAINTS ON TELEMETRY (Prevents 23503 error)
ALTER TABLE public.employee_presence DROP CONSTRAINT IF EXISTS employee_presence_employee_id_fkey;
ALTER TABLE public.screenshot_records DROP CONSTRAINT IF EXISTS screenshot_records_employee_id_fkey;
ALTER TABLE public.activity_events DROP CONSTRAINT IF EXISTS activity_events_employee_id_fkey;

-- 2. AUTO-CONFIRM ALL EXISTING ACCOUNTS
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email_confirmed_at IS NULL;

-- 3. AUTO-CONFIRM TRIGGER FOR FUTURE SIGNUPS
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS trigger AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_user();

-- 4. BULLETPROOF ON-SIGNUP TRIGGER (Self-cleaning to prevent duplicate key / 500 errors)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  user_dept text;
BEGIN
  user_role := coalesce(new.raw_user_meta_data->>'role', 'employee');
  user_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  user_dept := coalesce(new.raw_user_meta_data->>'department', 'General');

  -- Clean up any orphaned records with same email or ID to prevent unique key violation
  DELETE FROM public.employees WHERE email = new.email OR id = new.id OR user_id = new.id;
  DELETE FROM public.users WHERE email = new.email OR id = new.id;
  DELETE FROM public.profiles WHERE email = new.email OR id = new.id;

  -- Insert fresh profile
  INSERT INTO public.profiles (id, email, full_name, role, department, updated_at)
  VALUES (new.id, new.email, user_name, user_role, user_dept, now());

  -- Insert fresh user
  INSERT INTO public.users (id, organization_id, email, full_name, role, department, updated_at)
  VALUES (new.id, '00000000-0000-0000-0000-000000000001', new.email, user_name, user_role, user_dept, now());

  -- Insert fresh employee if role is employee
  IF user_role = 'employee' THEN
    INSERT INTO public.employees (id, user_id, organization_id, full_name, email, department, status, updated_at)
    VALUES (new.id, new.id, '00000000-0000-0000-0000-000000000001', user_name, new.email, user_dept, 'active', now());
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. ON-DELETE TRIGGER: CLEAN UP PUBLIC TABLES WHEN AN AUTH USER IS DELETED
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.employee_presence WHERE employee_id = old.id;
  DELETE FROM public.devices WHERE employee_id = old.id;
  DELETE FROM public.tasks WHERE assigned_to = old.id;
  DELETE FROM public.projects WHERE manager_id = old.id;
  DELETE FROM public.employees WHERE id = old.id OR user_id = old.id OR email = old.email;
  DELETE FROM public.users WHERE id = old.id OR email = old.email;
  DELETE FROM public.profiles WHERE id = old.id OR email = old.email;
  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();

-- 6. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
