create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  bio text,
  github_login text,
  github_data jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{"auto_publish": false, "timezone": "UTC"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('github', 'hashnode', 'devto')),
  encrypted_secret text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  body_markdown text not null,
  tags text[] not null default '{}',
  cover_image_url text,
  canonical_url text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_for timestamptz,
  published_targets jsonb not null default '{}'::jsonb,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.connections enable row level security;
alter table public.articles enable row level security;

create policy "users manage their profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "users manage their connections" on public.connections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage their articles" on public.articles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
