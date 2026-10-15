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

-- Soft launch (Oct 2026): feedback inbox, sign-up rate limit log, payload size cap.
create table if not exists public.jobdone_feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  email text,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.jobdone_feedback enable row level security;
create policy "Insert own feedback" on public.jobdone_feedback for insert to authenticated with check (user_id = auth.uid());
-- Owner read policy: replace OWNER_EMAIL with the app owner's email before running.
create policy "Owner reads feedback" on public.jobdone_feedback for select to authenticated using (auth.jwt()->>'email' = 'OWNER_EMAIL');

create table if not exists public.jobdone_signup_log (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.jobdone_signup_log enable row level security; -- no policies: only the signup function (service role) touches it
create index if not exists jobdone_signup_log_ip on public.jobdone_signup_log (ip_hash, created_at);

alter table public.jobdone_docs add constraint jobdone_docs_body_size check (pg_column_size(body) < 1500000);
