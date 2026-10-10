-- Remove hardcoded placeholder active_window defaults (e.g. "Visual Studio Code")
ALTER TABLE IF EXISTS public.screen_recordings
  ALTER COLUMN active_window DROP DEFAULT;

ALTER TABLE IF EXISTS public.screen_recordings
  ALTER COLUMN active_window SET DEFAULT '';

UPDATE public.screen_recordings
SET active_window = ''
WHERE active_window IN ('Visual Studio Code', 'Desktop Workspace', 'Testing app', 'Workstation');

NOTIFY pgrst, 'reload schema';
