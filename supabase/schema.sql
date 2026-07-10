-- EnthusiastToolboxRetracked schema
-- Run this once in the Supabase project's SQL editor.
-- No RLS lockdown: this is a private tool for a small trusted friend group,
-- the anon key is used directly from the browser, and "who am I" is enforced
-- at the app layer rather than via Postgres row security.

create table if not exists users (
  id bigint generated always as identity primary key,
  name text not null unique,
  pin text not null,
  created_at timestamptz not null default now()
);

create table if not exists parks (
  id bigint generated always as identity primary key,
  rcdb_id bigint unique,
  name text not null,
  city text,
  state text,
  country text,
  lat double precision,
  lng double precision,
  main_picture_url text,
  social_media jsonb
);

create table if not exists coasters (
  id bigint generated always as identity primary key,
  rcdb_id bigint unique,
  name text not null,
  park_id bigint references parks (id) on delete set null,
  make text,
  model text,
  type text,
  design text,
  status text, -- raw RCDB status string (e.g. "Operating", "Closed", "SBNO", "Under Construction") - not constrained, source data isn't a clean enum
  opened_date text,
  closed_date text,
  stats jsonb,
  main_picture_url text,
  pictures jsonb,
  lat double precision,
  lng double precision,
  rcdb_link text
);

create index if not exists coasters_park_id_idx on coasters (park_id);
create index if not exists coasters_name_idx on coasters using gin (to_tsvector('simple', name));

create table if not exists user_coasters (
  id bigint generated always as identity primary key,
  user_id bigint not null references users (id) on delete cascade,
  coaster_id bigint not null references coasters (id) on delete cascade,
  score numeric(3, 1) check (score >= 1 and score <= 10 and score * 2 = floor(score * 2)),
  comment text,
  tags text[],
  added_at timestamptz not null default now(),
  unique (user_id, coaster_id)
);

create table if not exists user_rankings (
  id bigint generated always as identity primary key,
  user_id bigint not null references users (id) on delete cascade,
  coaster_id bigint not null references coasters (id) on delete cascade,
  position integer not null,
  unique (user_id, coaster_id),
  unique (user_id, position)
);

-- Seed the 7 friends. Everyone starts on PIN 1234 and can change it later
-- from the Account Settings page.
insert into users (name, pin) values
  ('Joe', '1234'),
  ('Ben', '1234'),
  ('Casey', '1234'),
  ('Mike', '1234'),
  ('Emily', '1234'),
  ('Rocco', '1234'),
  ('Mark', '1234')
on conflict (name) do nothing;
