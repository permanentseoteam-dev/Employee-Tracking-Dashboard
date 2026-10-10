-- ==============================================================================
-- MIGRATION 020: ENABLE FULL DELETE & MANAGEMENT POLICIES FOR SCREENSHOTS
-- ==============================================================================
-- Instructions: Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- URL: https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/sql/new
-- ==============================================================================

-- 1. Enable RLS and Grant Full Access (including DELETE) on public.screenshots
ALTER TABLE IF EXISTS public.screenshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Screenshots delete policy" ON public.screenshots;
CREATE POLICY "Screenshots delete policy"
    ON public.screenshots
    FOR DELETE
    USING (true);

DROP POLICY IF EXISTS "Screenshots select policy" ON public.screenshots;
CREATE POLICY "Screenshots select policy"
    ON public.screenshots
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Screenshots insert policy" ON public.screenshots;
CREATE POLICY "Screenshots insert policy"
    ON public.screenshots
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Screenshots update policy" ON public.screenshots;
CREATE POLICY "Screenshots update policy"
    ON public.screenshots
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 2. Ensure public.screenshot_records has full DELETE / SELECT / INSERT access
ALTER TABLE IF EXISTS public.screenshot_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Legacy screenshots access" ON public.screenshot_records;
CREATE POLICY "Legacy screenshots access"
    ON public.screenshot_records
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Storage Bucket 'screenshots' Full Delete & Select Permissions
DROP POLICY IF EXISTS "Screenshots Delete Access" ON storage.objects;
CREATE POLICY "Screenshots Delete Access"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'screenshots');

DROP POLICY IF EXISTS "Screenshots Public Select" ON storage.objects;
CREATE POLICY "Screenshots Public Select"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'screenshots');

DROP POLICY IF EXISTS "Screenshots Upload Access" ON storage.objects;
CREATE POLICY "Screenshots Upload Access"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'screenshots');

-- 4. Clean up any existing stale/orphaned legacy records from public.screenshots
TRUNCATE TABLE public.screenshots;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
