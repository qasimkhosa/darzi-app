create or replace function public.increment_post_like_count(
  target_post_id text,
  delta integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_likes_count integer;
begin
  if delta not in (-1, 1) then
    raise exception 'delta must be -1 or 1';
  end if;

  update public.posts
  set likes_count = greatest(0, likes_count + delta)
  where id = target_post_id
  returning likes_count into next_likes_count;

  if next_likes_count is null then
    raise exception 'post not found';
  end if;

  return next_likes_count;
end;
$$;

grant execute on function public.increment_post_like_count(text, integer) to authenticated;
