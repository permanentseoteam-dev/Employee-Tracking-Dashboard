-- ==============================================================================
-- MIGRATION 015: AUTO CONFIRM AUTH USERS
-- Resolves "Email not confirmed yet" error when signing in to Supabase.
-- 
-- How to apply:
-- 1. Open Supabase Dashboard: https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/sql/new
-- 2. Paste this entire script and click "Run".
-- 3. Also in Authentication -> Providers -> Email (https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/auth/providers):
--    Toggle OFF "Confirm email" and click Save so Supabase doesn't require confirmation.
-- ==============================================================================

-- 1. Immediately confirm all existing registered accounts (including shahroz@gmail.com)
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email_confirmed_at IS NULL;

-- 2. Create trigger function to automatically set email_confirmed_at on any future signup
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS trigger AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind trigger BEFORE INSERT on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_user();

-- Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
