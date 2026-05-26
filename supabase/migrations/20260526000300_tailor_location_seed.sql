create index if not exists tailor_profiles_location_idx
  on public.tailor_profiles (location_lat, location_lng);

update public.tailor_profiles
set location_lat = 31.5102,
    location_lng = 74.3441,
    address = coalesce(address, 'Liberty Market, Lahore')
where darzi_id = 433
  and (location_lat is null or location_lng is null);
