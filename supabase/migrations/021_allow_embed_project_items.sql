-- Migration 021: Allow embed project items and add embed_url column
ALTER TABLE IF EXISTS public.project_items
  DROP CONSTRAINT IF EXISTS project_items_item_type_check;

ALTER TABLE IF EXISTS public.project_items
  ADD CONSTRAINT project_items_item_type_check
  CHECK (item_type IN ('folder', 'embed', 'uploaded_file', 'document', 'spreadsheet', 'presentation'));

ALTER TABLE IF EXISTS public.project_items
  ADD COLUMN IF NOT EXISTS embed_url TEXT;

NOTIFY pgrst, 'reload schema';
