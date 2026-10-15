-- Weekly safety copy of every account's data (free plan has no point-in-time restore).
-- Runs Sundays 18:30 UTC. Rows go with the account when it is deleted (foreign key cascade).
-- Only the service role can read this table (RLS on, no policies, grants revoked).
create table if not exists public.jobdone_backups (taken_at timestamptz not null default now(), user_id uuid not null, path text not null, body jsonb, primary key (taken_at, user_id, path));
alter table public.jobdone_backups enable row level security;
revoke all on public.jobdone_backups from anon, authenticated;
alter table public.jobdone_backups add constraint jobdone_backups_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
select cron.schedule('jobdone-weekly-backup', '30 18 * * 0', $$insert into public.jobdone_backups (user_id, path, body) select user_id, path, body from public.jobdone_docs$$);
-- Restore one account (run by hand): pick a taken_at, then upsert those rows back into jobdone_docs.
