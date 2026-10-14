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
