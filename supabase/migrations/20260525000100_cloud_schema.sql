create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_type text not null default 'customer' check (user_type in ('customer', 'tailor')),
  full_name text,
  phone text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

create table if not exists public.tailor_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  shop_name text not null,
  darzi_id serial unique not null,
  location_lat double precision,
  location_lng double precision,
  address text,
  pricing_json jsonb not null default '{}'::jsonb,
  expertise_tags text[] not null default '{}'::text[],
  rating numeric(2, 1) not null default 5.0 check (rating >= 0 and rating <= 5)
);

create table if not exists public.measurement_vault (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.profiles(id) on delete cascade,
  measurements_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  tailor_id uuid references public.tailor_profiles(id) on delete set null,
  customer_name text not null default '',
  customer_mobile text not null default '',
  suit_type text not null default '',
  delivery_date timestamptz not null default now(),
  measurements_json jsonb not null default '{}'::jsonb,
  total_bill numeric(12, 2) not null default 0,
  advance_paid numeric(12, 2) not null default 0,
  remaining_balance numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'cutting', 'stitching', 'ready', 'delivered')),
  qr_code_str text,
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists customer_name text not null default '',
  add column if not exists customer_mobile text not null default '',
  add column if not exists suit_type text not null default '',
  add column if not exists delivery_date timestamptz not null default now(),
  add column if not exists measurements_json jsonb not null default '{}'::jsonb,
  add column if not exists total_bill numeric(12, 2) not null default 0,
  add column if not exists advance_paid numeric(12, 2) not null default 0,
  add column if not exists remaining_balance numeric(12, 2) not null default 0;

alter table public.orders
  alter column customer_id drop not null,
  alter column tailor_id drop not null;

create table if not exists public.posts (
  id text primary key,
  title text not null,
  tailor_name text not null,
  darzi_id integer not null,
  expertise text not null,
  image_uri text not null,
  thumbnail_uri text not null,
  likes_count integer not null default 0,
  description text not null,
  area text not null,
  created_at timestamptz not null default now()
);

create index if not exists tailor_profiles_darzi_id_idx on public.tailor_profiles(darzi_id);
create index if not exists tailor_profiles_expertise_tags_idx on public.tailor_profiles using gin(expertise_tags);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_tailor_id_idx on public.orders(tailor_id);
create index if not exists orders_customer_mobile_idx on public.orders(customer_mobile);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_darzi_id_idx on public.posts(darzi_id);

create or replace function public.touch_measurement_vault_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists measurement_vault_touch_updated_at on public.measurement_vault;
create trigger measurement_vault_touch_updated_at
before update on public.measurement_vault
for each row
execute function public.touch_measurement_vault_updated_at();

alter table public.profiles enable row level security;
alter table public.tailor_profiles enable row level security;
alter table public.measurement_vault enable row level security;
alter table public.orders enable row level security;
alter table public.posts enable row level security;

drop policy if exists profiles_select_own_or_tailors on public.profiles;
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_insert_self_or_placeholder on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_authenticated
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy profiles_insert_self_or_placeholder
  on public.profiles for insert
  with check (
    auth.uid() = id
    or (
      auth.role() = 'authenticated'
      and user_type = 'customer'
      and phone is not null
    )
  );

create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists tailor_profiles_public_read on public.tailor_profiles;
drop policy if exists tailor_profiles_insert_own_tailor on public.tailor_profiles;
drop policy if exists tailor_profiles_update_own_tailor on public.tailor_profiles;

create policy tailor_profiles_public_read
  on public.tailor_profiles for select
  using (true);

create policy tailor_profiles_insert_own_tailor
  on public.tailor_profiles for insert
  with check (
    auth.uid() = id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.user_type = 'tailor'
    )
  );

create policy tailor_profiles_update_own_tailor
  on public.tailor_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists measurement_vault_owner_all on public.measurement_vault;

create policy measurement_vault_owner_all
  on public.measurement_vault for all
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

drop policy if exists orders_select_participants on public.orders;
drop policy if exists orders_select_customer_mobile_or_tailor on public.orders;
drop policy if exists orders_insert_customer_own on public.orders;
drop policy if exists orders_insert_authenticated on public.orders;
drop policy if exists orders_update_tailor_status on public.orders;

create policy orders_select_customer_mobile_or_tailor
  on public.orders for select
  using (
    auth.role() = 'authenticated'
    and (
      customer_id = auth.uid()
      or exists (
        select 1 from public.tailor_profiles
        where tailor_profiles.id = orders.tailor_id
        and tailor_profiles.id = auth.uid()
      )
      or customer_mobile = (
        select phone from public.profiles where profiles.id = auth.uid()
      )
    )
  );

create policy orders_insert_authenticated
  on public.orders for insert
  with check (auth.role() = 'authenticated');

create policy orders_update_tailor_status
  on public.orders for update
  using (
    exists (
      select 1 from public.tailor_profiles
      where tailor_profiles.id = orders.tailor_id
      and tailor_profiles.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tailor_profiles
      where tailor_profiles.id = orders.tailor_id
      and tailor_profiles.id = auth.uid()
    )
  );

drop policy if exists posts_public_read on public.posts;
drop policy if exists posts_insert_authenticated on public.posts;
drop policy if exists posts_update_authenticated on public.posts;

create policy posts_public_read
  on public.posts for select
  using (true);

create policy posts_insert_authenticated
  on public.posts for insert
  with check (auth.role() = 'authenticated');

create policy posts_update_authenticated
  on public.posts for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into public.profiles (id, user_type, full_name, phone)
values ('00000000-0000-4000-8000-000000000433', 'tailor', 'Khan Tailors', '+920000000433')
on conflict (id) do update
set user_type = excluded.user_type,
    full_name = excluded.full_name,
    phone = excluded.phone;

insert into public.tailor_profiles (
  id,
  shop_name,
  darzi_id,
  location_lat,
  location_lng,
  address,
  pricing_json,
  expertise_tags,
  rating
)
values (
  '00000000-0000-4000-8000-000000000433',
  'Khan Tailors',
  433,
  31.5102,
  74.3441,
  'Liberty Market, Lahore',
  '{"kurta":1500,"sherwani":3500}'::jsonb,
  array['Gents Master','Kurta Pajama','Sherwani Alteration'],
  4.8
)
on conflict (id) do update
set shop_name = excluded.shop_name,
    darzi_id = excluded.darzi_id,
    location_lat = excluded.location_lat,
    location_lng = excluded.location_lng,
    address = excluded.address,
    pricing_json = excluded.pricing_json,
    expertise_tags = excluded.expertise_tags,
    rating = excluded.rating;

insert into public.posts (
  id,
  title,
  tailor_name,
  darzi_id,
  expertise,
  image_uri,
  thumbnail_uri,
  likes_count,
  description,
  area,
  created_at
)
values
  (
    'velvet-sherwani-433',
    'Velvet Gents Sherwani',
    'Royal Stitch House',
    433,
    'Gents Master',
    'https://images.unsplash.com/photo-1610189029775-777d70fe2f78?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    1840,
    'Deep maroon velvet sherwani with antique dull-gold buttons, structured shoulders, and hand-finished piping for baraat wear.',
    'Liberty Market, Lahore',
    '2026-05-24T11:00:00+05:00'
  ),
  (
    'bridal-shalwar-kameez-118',
    'Designer Bridal Shalwar Kameez',
    'Nigar Bridal Studio',
    118,
    'Bridal Specialist',
    'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    3215,
    'Ivory bridal shalwar kameez finished with resham, dabka, and pearl detailing for nikkah day styling.',
    'Tariq Road, Karachi',
    '2026-05-23T16:20:00+05:00'
  ),
  (
    'luxury-eid-kurta-567',
    'Luxury Eid Kurta',
    'Master Iqbal Tailors',
    567,
    'Kurta Pajama Expert',
    'https://images.unsplash.com/photo-1593032465175-481ac7f401f0?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80',
    956,
    'Breathable cotton-silk kurta with tonal embroidery on the ban collar, built for Eid namaz and family dinners.',
    'F-10 Markaz, Islamabad',
    '2026-05-22T13:45:00+05:00'
  )
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
    ) then
      alter publication supabase_realtime add table public.orders;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
    ) then
      alter publication supabase_realtime add table public.posts;
    end if;
  end if;
end $$;
