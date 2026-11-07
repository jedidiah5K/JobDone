-- back-04: daily safety copy keeps only documents that changed, instead of a full copy of every row every day.
-- Today: every doc (photos/ included) is copied daily and kept 14 days, so storage is ~15x the live data,
-- and one account filling its 20 MB quota costs ~300 MB of the 500 MB free database within two weeks.
-- After: a doc is copied the day it changes. Restore = for each path, the newest copy at or before the chosen time.
-- Every live doc keeps at least its newest copy, so nothing that exists today loses its backup.

-- 1) Copy only rows changed since the last run (25 h window covers cron drift).
select cron.unschedule('jobdone-weekly-backup');
select cron.schedule('jobdone-daily-backup', '30 18 * * *', $$
  insert into public.jobdone_backups (user_id, path, body)
  select user_id, path, body from public.jobdone_docs where updated_at > now() - interval '25 hours'
$$);

-- 2) Trim: drop copies older than 14 days unless it's the newest copy of a doc that still exists.
select cron.unschedule('jobdone-backup-trim');
select cron.schedule('jobdone-backup-trim', '45 18 * * *', $$
  delete from public.jobdone_backups b
  where b.taken_at < now() - interval '14 days'
    and (exists (select 1 from public.jobdone_backups n where n.user_id = b.user_id and n.path = b.path and n.taken_at > b.taken_at)
         or not exists (select 1 from public.jobdone_docs d where d.user_id = b.user_id and d.path = b.path))
$$);

-- 3) The trim and account deletion look rows up by user; the primary key starts with taken_at.
create index if not exists jobdone_backups_user_path on public.jobdone_backups (user_id, path, taken_at desc);

-- 4) Lower the per-account cap from 20 MB to 8 MB. Biggest real account today is far under 1 MB.
-- (Edit jobdone_docs_quota: 20000000 -> 8000000.)

-- Restore one account to time T (run by hand):
-- insert into public.jobdone_docs (user_id, path, body, updated_at)
-- select distinct on (path) user_id, path, body, now() from public.jobdone_backups
-- where user_id = '<uuid>' and taken_at <= 'T' order by path, taken_at desc
-- on conflict (user_id, path) do update set body = excluded.body, updated_at = now();
