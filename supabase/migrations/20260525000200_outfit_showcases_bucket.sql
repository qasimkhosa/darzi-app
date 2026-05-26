insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'outfit-showcases',
  'outfit-showcases',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists outfit_showcases_public_read on storage.objects;
drop policy if exists outfit_showcases_authenticated_upload on storage.objects;
drop policy if exists outfit_showcases_authenticated_update on storage.objects;
drop policy if exists outfit_showcases_authenticated_delete on storage.objects;

create policy outfit_showcases_public_read
  on storage.objects for select
  using (bucket_id = 'outfit-showcases');

create policy outfit_showcases_authenticated_upload
  on storage.objects for insert
  with check (
    bucket_id = 'outfit-showcases'
    and auth.role() = 'authenticated'
  );

create policy outfit_showcases_authenticated_update
  on storage.objects for update
  using (
    bucket_id = 'outfit-showcases'
    and auth.role() = 'authenticated'
  )
  with check (
    bucket_id = 'outfit-showcases'
    and auth.role() = 'authenticated'
  );

create policy outfit_showcases_authenticated_delete
  on storage.objects for delete
  using (
    bucket_id = 'outfit-showcases'
    and auth.role() = 'authenticated'
  );
