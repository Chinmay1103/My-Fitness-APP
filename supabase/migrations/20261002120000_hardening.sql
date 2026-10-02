-- Follow-ups from the Oct 2 config audit (docs/supabase-config-audit-2026-10-02.md).

-- The signup trigger runs as its owner; clients never need to call it directly.
-- (The API doesn't expose trigger functions anyway; this also clears the security advisor warning.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Meal photos: images only, at most 10 MB each.
update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'meal-photos';
