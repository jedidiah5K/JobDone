-- JobDone database. Run once in Supabase → SQL Editor → New query → Run.
create table if not exists public.jobdone_docs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null,
  body jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, path)
);

alter table public.jobdone_docs enable row level security;

-- Each signed-in person can only see and change their own data.
drop policy if exists "Own data only" on public.jobdone_docs;
create policy "Own data only" on public.jobdone_docs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Step sync keys: an Apple Shortcut posts steps to the "steps" edge function with this key.
-- Only the sha256 of the key is stored.
create table if not exists public.jobdone_sync_keys (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.jobdone_sync_keys enable row level security;
create policy "Own key only" on public.jobdone_sync_keys
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
