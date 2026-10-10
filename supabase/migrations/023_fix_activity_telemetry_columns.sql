-- Migration 023: Harden activity telemetry schema
-- 1) Add optional window/app labels used by the agent (fixes 42703 if selected)
-- 2) Keep employee_id NOT NULL (already enforced) — app must never insert nulls

ALTER TABLE IF EXISTS public.activity_aggregates
  ADD COLUMN IF NOT EXISTS window_title text;

ALTER TABLE IF EXISTS public.activity_aggregates
  ADD COLUMN IF NOT EXISTS app_name text;

COMMENT ON COLUMN public.activity_aggregates.window_title IS
  'Optional foreground window title for the aggregate window';
COMMENT ON COLUMN public.activity_aggregates.app_name IS
  'Optional short app/process label derived from the window title';

-- Defensive: ensure employee_id cannot be empty string either (UUID type already rejects '')
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_events'
      AND column_name = 'employee_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.activity_events ALTER COLUMN employee_id SET NOT NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
