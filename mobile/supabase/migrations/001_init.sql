-- Enable uuid extension
create extension if not exists "pgcrypto";

-- Profiles
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Public profiles" on profiles for select using (true);
create policy "Own profile insert" on profiles for insert with check (auth.uid() = id);
create policy "Own profile update" on profiles for update using (auth.uid() = id);

-- Markers
create table markers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references profiles not null,
  marker_code text unique not null,
  area_name text not null,
  geohash text not null,
  photo_url text,
  status text default 'pending' check (status in ('pending','approved','expired')),
  created_at timestamptz default now(),
  approved_at timestamptz,
  expires_at timestamptz
);
alter table markers enable row level security;
create policy "View approved markers" on markers for select
  using (status = 'approved' or creator_id = auth.uid());
create policy "Insert own marker" on markers for insert
  with check (auth.uid() = creator_id);

-- Discoveries
create table discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  marker_id uuid references markers not null,
  discovered_at timestamptz default now(),
  unique (user_id, marker_id)
);
alter table discoveries enable row level security;
create policy "Own discoveries" on discoveries for select using (auth.uid() = user_id);
create policy "Insert discovery" on discoveries for insert with check (auth.uid() = user_id);

-- Likes
create table likes (
  user_id uuid references profiles not null,
  marker_id uuid references markers not null,
  created_at timestamptz default now(),
  primary key (user_id, marker_id)
);
alter table likes enable row level security;
create policy "View likes" on likes for select using (true);
create policy "Own likes" on likes for insert with check (auth.uid() = user_id);
create policy "Delete own like" on likes for delete using (auth.uid() = user_id);

-- Comments
create table comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  marker_id uuid references markers not null,
  body text not null,
  created_at timestamptz default now()
);
alter table comments enable row level security;
create policy "View comments" on comments for select using (true);
create policy "Insert comment" on comments for insert with check (auth.uid() = user_id);

-- Stats view (avoids N+1 on map)
create view marker_stats as
  select
    m.id,
    count(distinct d.id)::int as discovery_count,
    count(distinct l.user_id)::int as like_count,
    count(distinct c.id)::int as comment_count
  from markers m
  left join discoveries d on d.marker_id = m.id
  left join likes l on l.marker_id = m.id
  left join comments c on c.marker_id = m.id
  group by m.id;

-- Storage bucket for marker photos
insert into storage.buckets (id, name, public)
  values ('marker-photos', 'marker-photos', true);

create policy "Anyone can view photos" on storage.objects
  for select using (bucket_id = 'marker-photos');
create policy "Auth users upload photos" on storage.objects
  for insert with check (bucket_id = 'marker-photos' and auth.role() = 'authenticated');
