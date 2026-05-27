create table if not exists public.whatsapp_auth_challenges (
  id text primary key,
  lookup_token text not null,
  phone text not null,
  user_type text not null check (user_type in ('customer', 'tailor')),
  challenge_code text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired', 'rejected')),
  auth_user_id uuid,
  verification_note text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz
);

create index if not exists whatsapp_auth_challenges_phone_idx
  on public.whatsapp_auth_challenges(phone);

create index if not exists whatsapp_auth_challenges_challenge_code_idx
  on public.whatsapp_auth_challenges(challenge_code);

create index if not exists whatsapp_auth_challenges_status_idx
  on public.whatsapp_auth_challenges(status);

alter table public.whatsapp_auth_challenges enable row level security;

drop policy if exists whatsapp_auth_challenges_insert_pending on public.whatsapp_auth_challenges;

create policy whatsapp_auth_challenges_insert_pending
  on public.whatsapp_auth_challenges for insert
  with check (
    status = 'pending'
    and phone ~ '^\+[0-9]{10,15}$'
    and expires_at > now()
    and expires_at <= now() + interval '15 minutes'
    and char_length(lookup_token) >= 24
    and challenge_code ~ '^DZ-[A-Z0-9]{6}$'
  );

create or replace function public.get_whatsapp_auth_challenge_status(
  target_id text,
  target_lookup_token text
)
returns table (
  status text,
  phone text,
  user_type text,
  verified_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.whatsapp_auth_challenges
  set status = 'expired'
  where id = target_id
    and lookup_token = target_lookup_token
    and status = 'pending'
    and expires_at <= now();

  return query
  select
    challenge.status,
    challenge.phone,
    challenge.user_type,
    challenge.verified_at,
    challenge.expires_at
  from public.whatsapp_auth_challenges as challenge
  where challenge.id = target_id
    and challenge.lookup_token = target_lookup_token
  limit 1;
end;
$$;

grant execute on function public.get_whatsapp_auth_challenge_status(text, text) to anon, authenticated;

comment on table public.whatsapp_auth_challenges is
  'User-initiated WhatsApp login challenge queue. A trusted WhatsApp webhook using the service role must mark rows verified after receiving the matching inbound customer message.';
