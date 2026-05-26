alter table public.posts
  add column if not exists owner_id uuid references public.profiles(id) on delete set null default auth.uid();

update public.posts
set owner_id = '00000000-0000-4000-8000-000000000433'
where owner_id is null
  and exists (
    select 1
    from public.profiles
    where profiles.id = '00000000-0000-4000-8000-000000000433'
  );

create or replace function public.guard_posts_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.owner_id then
    return new;
  end if;

  if (to_jsonb(new) - 'likes_count') = (to_jsonb(old) - 'likes_count') then
    return new;
  end if;

  raise exception 'Only the post owner can update showcase metadata';
end;
$$;

drop trigger if exists posts_guard_update on public.posts;
create trigger posts_guard_update
before update on public.posts
for each row
execute function public.guard_posts_update();

drop policy if exists orders_insert_authenticated on public.orders;
drop policy if exists orders_update_tailor_status on public.orders;
drop policy if exists orders_insert_tailor_own on public.orders;
drop policy if exists orders_update_tailor_own on public.orders;

create policy orders_insert_tailor_own
  on public.orders for insert
  with check (
    auth.role() = 'authenticated'
    and tailor_id = auth.uid()
    and exists (
      select 1 from public.tailor_profiles
      where tailor_profiles.id = auth.uid()
    )
  );

create policy orders_update_tailor_own
  on public.orders for update
  using (
    tailor_id = auth.uid()
    and exists (
      select 1 from public.tailor_profiles
      where tailor_profiles.id = auth.uid()
    )
  )
  with check (
    tailor_id = auth.uid()
    and exists (
      select 1 from public.tailor_profiles
      where tailor_profiles.id = auth.uid()
    )
  );

drop policy if exists posts_insert_authenticated on public.posts;
drop policy if exists posts_update_authenticated on public.posts;
drop policy if exists posts_insert_owner on public.posts;
drop policy if exists posts_update_owner_or_like_count on public.posts;

create policy posts_insert_owner
  on public.posts for insert
  with check (
    auth.role() = 'authenticated'
    and owner_id = auth.uid()
  );

create policy posts_update_owner_or_like_count
  on public.posts for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists outfit_showcases_authenticated_upload on storage.objects;
drop policy if exists outfit_showcases_authenticated_update on storage.objects;
drop policy if exists outfit_showcases_authenticated_delete on storage.objects;
drop policy if exists outfit_showcases_authenticated_upload_own_folder on storage.objects;
drop policy if exists outfit_showcases_authenticated_update_own_folder on storage.objects;
drop policy if exists outfit_showcases_authenticated_delete_own_folder on storage.objects;

create policy outfit_showcases_authenticated_upload_own_folder
  on storage.objects for insert
  with check (
    bucket_id = 'outfit-showcases'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy outfit_showcases_authenticated_update_own_folder
  on storage.objects for update
  using (
    bucket_id = 'outfit-showcases'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'outfit-showcases'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy outfit_showcases_authenticated_delete_own_folder
  on storage.objects for delete
  using (
    bucket_id = 'outfit-showcases'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
