-- Admin numbers for the owner's Admin sheet under Me (v183, Job 14 Nov 2026).
-- Owner only: jobdone_is_owner() (reports.sql) checks the verified owner id in jobdone_private.
-- Counts only, never anyone's email, name or workout details. Days are Manila time (UTC+8).
create or replace function public.jobdone_admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  t date := (now() at time zone 'Asia/Manila')::date;
  r jsonb;
begin
  if not public.jobdone_is_owner() then raise exception 'Not allowed' using errcode = '42501'; end if;
  with wk as ( -- this month's and last month's workouts: who trained on which day, and in a party or not
    select d.user_id, (w.v->>'date')::date as day, coalesce(jsonb_typeof(w.v->'party') = 'array' and jsonb_array_length(w.v->'party') > 0, false) as party
    from jobdone_docs d, jsonb_each(d.body->'w') w(id, v)
    where d.path in ('months/' || to_char(t, 'YYYY-MM'), 'months/' || to_char(t - 31, 'YYYY-MM'))
      and jsonb_typeof(d.body->'w') = 'object' and (w.v->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
  )
  select jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'new7', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signin7', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'active7', (select count(distinct user_id) from jobdone_docs where updated_at > now() - interval '7 days'),
    'activeToday', (select count(distinct user_id) from jobdone_docs where (updated_at at time zone 'Asia/Manila')::date = t),
    'days', (select jsonb_agg((select count(distinct user_id) from wk where wk.day = g::date) order by g)
             from generate_series(t - 6, t, interval '1 day') g),
    'parties7', (select count(*) from wk where party and day > t - 7),
    'partyPeople7', (select count(distinct user_id) from wk where party and day > t - 7),
    'friendships', (select count(distinct (least(user_id, friend_id), greatest(user_id, friend_id))) from jobdone_friends),
    'posts48', (select count(*) from jobdone_posts where created_at > now() - interval '48 hours'),
    'feedback7', (select count(*) from jobdone_feedback where created_at > now() - interval '7 days'),
    'reports', (select count(*) from jobdone_reports where not done),
    'errors7', (select count(*) from jobdone_errors where at > now() - interval '7 days'),
    'lastError', (select left(msg, 120) from jobdone_errors where at > now() - interval '7 days' order by at desc limit 1),
    'backupAt', (select max(taken_at) from jobdone_backups),
    'backupUsers', (select count(distinct user_id) from jobdone_backups where taken_at > (select max(taken_at) from jobdone_backups) - interval '1 hour'),
    'dbBytes', pg_database_size(current_database())
  ) into r;
  return r;
end $$;
revoke execute on function public.jobdone_admin_stats() from public, anon;
grant execute on function public.jobdone_admin_stats() to authenticated;
