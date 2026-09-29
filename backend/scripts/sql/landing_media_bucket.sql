-- ═══════════════════════════════════════════════════════════════
--  The landing page's footage bucket (plan 167), for the Supabase SQL Editor
--
--  Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to run
--  again: it only ever creates the bucket or puts its settings back.
--
--  What it makes: a PUBLIC bucket named `landing`, which the landing
--  page (frontend/landing/, public/landing/landing.js) reads its
--  footage from at
--
--      <project>/storage/v1/object/public/landing/<file>
--
--  Public means anyone can READ a file by its name, which is what a
--  video on a public web page needs, and nothing more: no policy below
--  lets anyone else write, list or delete. Files go in from the
--  dashboard (Storage -> landing -> Upload), by the exact names in
--  frontend/landing/README.md; the dashboard uploads as the project's
--  owner, which needs no policy.
--
--  The limits keep the bucket to what the page plays: MP4 and WebM
--  video, JPEG stills and WebVTT captions, 25 MB a file (the overview
--  presentation's ceiling; each feature clip should stay under 3 MB).
--
--  Nothing here touches a learner's data, and the app itself never
--  reads this bucket.
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing',
  'landing',
  true,
  26214400,
  array['video/mp4', 'video/webm', 'image/jpeg', 'text/vtt']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- What it left, to read back:
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'landing';
