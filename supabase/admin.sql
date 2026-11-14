-- Admin numbers for the owner's Admin page under Me (v183, bigger in v184, Job 14 Nov 2026).
-- Owner only: jobdone_is_owner() (reports.sql) checks the verified owner id in jobdone_private.
-- Shows names, emails and activity to run the service; no body weight, photos or notes (health data stays private). Days are Manila time (UTC+8).
-- shortcut: scans every workout on each call; fine for a few hundred accounts, add a daily summary table past that.
-- "Online" (v184): the app's once-a-minute jobdone_friends_live call stamps jobdone_seen (at most once per 50 s).
create table if not exists public.jobdone_seen (user_id uuid primary key references auth.users on delete cascade, at timestamptz not null default now());
alter table public.jobdone_seen enable row level security; -- no policies: only security definer functions touch it
revoke all on public.jobdone_seen from anon, authenticated;
create or replace function public.jobdone_friends_live()
returns table(id uuid, at_gym text, at_since timestamptz, stat jsonb, nudged_me timestamptz)
language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := (select public.jobdone_gym_me());
begin
  if me is not null then
    insert into public.jobdone_seen as s (user_id, at) values (me, now())
      on conflict (user_id) do update set at = now() where s.at < now() - interval '50 seconds';
  end if;
  return query select c.user_id,
    case when c.at_since > now() - interval '3 hours' then c.at_gym end,
    case when c.at_since > now() - interval '3 hours' then c.at_since end,
    c.stat,
    (select max(n.at) from public.jobdone_nudges n where n.from_id = c.user_id and n.to_id = me and n.at > now() - interval '20 hours')
  from public.jobdone_friends f join public.jobdone_cards c on c.user_id = f.friend_id
  where f.user_id = me
  limit 200;
end $$;
revoke all on function public.jobdone_friends_live() from public, anon;
grant execute on function public.jobdone_friends_live() to authenticated;

create or replace function public.jobdone_admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public, auth, cron as $$
declare
  t date := (now() at time zone 'Asia/Manila')::date;
  nowms numeric := extract(epoch from now()) * 1000;
  r jsonb;
begin
  if not public.jobdone_is_owner() then raise exception 'Not allowed' using errcode = '42501'; end if;
  with wk as (
    select d.user_id, w.v, (w.v->>'date')::date as day,
      case when (w.v->>'start') ~ '^\d+$' then (w.v->>'start')::numeric end as st,
      case when (w.v->>'end') ~ '^\d+$' then (w.v->>'end')::numeric end as en,
      coalesce(jsonb_typeof(w.v->'party') = 'array' and jsonb_array_length(w.v->'party') > 0, false) as party
    from jobdone_docs d, jsonb_each(d.body->'w') w(id, v)
    where d.path like 'months/%' and jsonb_typeof(d.body->'w') = 'object'
      and (w.v->>'date') ~ '^\d{4}-\d{2}-\d{2}$' and coalesce(w.v->>'skipped', '') not in ('true', '1')
  ), sets as (
    select wk.user_id, wk.day, e->>'name' as ex,
      case when (s->>'w') ~ '^\d+(\.\d+)?$' then (s->>'w')::numeric else 0 end * (s->>'r')::numeric as vol
    from wk, jsonb_array_elements(case when jsonb_typeof(wk.v->'ex') = 'array' then wk.v->'ex' else '[]' end) e,
      jsonb_array_elements(case when jsonb_typeof(e->'sets') = 'array' then e->'sets' else '[]' end) s
    where coalesce(s->>'done', 'true') <> 'false' and (s->>'r') ~ '^\d+(\.\d+)?$' and (s->>'r')::numeric > 0
  ), seen as (
    select u.id as user_id, greatest((select max(updated_at) from jobdone_docs d where d.user_id = u.id), (select at from jobdone_seen x where x.user_id = u.id), u.last_sign_in_at) as at
    from auth.users u
  ), days as (
    select g::date as day from generate_series(t - 13, t, interval '1 day') g
  )
  select jsonb_build_object(
    'at', now(),
    -- right now
    'liveWorkouts', (select coalesce(jsonb_agg(jsonb_build_object('n', coalesce(c.card->>'n', '?'), 'split', d.body#>>'{a,splitName}',
        'mins', round((nowms - (d.body#>>'{a,start}')::numeric) / 60000)) order by c.card->>'n'), '[]')
      from jobdone_docs d left join jobdone_cards c on c.user_id = d.user_id
      where d.path = 'jd/active' and jsonb_typeof(d.body->'a') = 'object' and (d.body#>>'{a,start}') ~ '^\d+$'
        and (d.body#>>'{a,touched}') ~ '^\d+$' and (d.body#>>'{a,touched}')::numeric > nowms - 3 * 3600000),
    'atGym', (select coalesce(jsonb_agg(coalesce(card->>'n', '?')), '[]') from jobdone_cards where at_gym is not null and at_since > now() - interval '4 hours'),
    'lastActivity', (select max(at) from seen),
    'online', (select count(*) from jobdone_seen where at > now() - interval '2 minutes'),
    'restQueued', (select count(*) from jobdone_rest_alerts where not sent and due_at > now()),
    -- today
    'today', jsonb_build_object(
      'workouts', (select count(*) from wk where day = t),
      'people', (select count(distinct user_id) from wk where day = t),
      'sets', (select count(*) from sets where day = t),
      'volume', (select coalesce(round(sum(vol)), 0) from sets where day = t),
      'signups', (select count(*) from auth.users where (created_at at time zone 'Asia/Manila')::date = t),
      'active', (select count(*) from seen where (at at time zone 'Asia/Manila')::date = t),
      'posts', (select count(*) from jobdone_posts where (created_at at time zone 'Asia/Manila')::date = t),
      'comments', (select count(*) from jobdone_comments where (created_at at time zone 'Asia/Manila')::date = t),
      'nudges', (select count(*) from jobdone_nudges where (at at time zone 'Asia/Manila')::date = t),
      'reminders', (select count(*) from jobdone_remind_sent where day = t),
      'restPushes', (select count(*) from jobdone_rest_alerts where sent and (due_at at time zone 'Asia/Manila')::date = t)),
    -- growth
    'accounts', (select count(*) from auth.users),
    'new7', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new30', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'signin7', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'active7', (select count(*) from seen where at > now() - interval '7 days'),
    'active30', (select count(*) from seen where at > now() - interval '30 days'),
    'trained7', (select count(distinct user_id) from wk where day > t - 7),
    'trained30', (select count(distinct user_id) from wk where day > t - 30),
    'neverTrained', (select count(*) from auth.users u where not exists (select 1 from wk where wk.user_id = u.id)),
    'signupAttempts24', (select count(*) from jobdone_signup_log where at > now() - interval '24 hours'),
    'days14', (select jsonb_agg(jsonb_build_object('d', day,
        'w', (select count(*) from wk where wk.day = days.day),
        'p', (select count(distinct user_id) from wk where wk.day = days.day),
        's', (select count(*) from auth.users where (created_at at time zone 'Asia/Manila')::date = days.day)) order by day) from days),
    -- training
    'workouts7', (select count(*) from wk where day > t - 7),
    'workouts30', (select count(*) from wk where day > t - 30),
    'workoutsAll', (select count(*) from wk),
    'setsAll', (select count(*) from sets),
    'volumeAll', (select coalesce(round(sum(vol)), 0) from sets),
    'avgMins7', (select round(avg((en - st) / 60000)) from wk where day > t - 7 and en > st and en - st < 6 * 3600000),
    'avgSets7', (select round(count(*)::numeric / nullif((select count(*) from wk where day > t - 7), 0), 1) from sets where day > t - 7),
    'parties7', (select count(*) from wk where party and day > t - 7),
    'partyPeople7', (select count(distinct user_id) from wk where party and day > t - 7),
    'hours30', (select jsonb_agg((select count(*) from wk where day > t - 30 and st is not null
        and extract(hour from to_timestamp(st / 1000) at time zone 'Asia/Manila') = h) order by h) from generate_series(0, 23) h),
    'topLifts7', (select coalesce(jsonb_agg(jsonb_build_object('n', ex, 'c', c) order by c desc), '[]') from
        (select ex, count(*) c from sets where day > t - 7 and ex is not null group by ex order by c desc limit 8) x),
    'topSplits30', (select coalesce(jsonb_agg(jsonb_build_object('n', n, 'c', c) order by c desc), '[]') from
        (select coalesce(v->>'splitName', 'Free workout') n, count(*) c from wk where day > t - 30 group by 1 order by c desc limit 6) x),
    'themes', (select jsonb_object_agg(th, c) from (select coalesce(body#>>'{profile,theme}', 'climb') th, count(*) c from jobdone_docs where path = 'jd/meta' group by 1) x),
    -- people
    'users', (select coalesce(jsonb_agg(x order by x->>'seen' desc nulls last), '[]') from (
      select jsonb_build_object('n', coalesce(c.card->>'n', '(no card)'), 'e', u.email, 'joined', u.created_at,
        'seen', s.at, 'on', coalesce((select at from jobdone_seen x where x.user_id = u.id) > now() - interval '2 minutes', false),
        'now', (select d.body#>>'{a,splitName}' from jobdone_docs d where d.user_id = u.id and d.path = 'jd/active' and jsonb_typeof(d.body->'a') = 'object'
          and (d.body#>>'{a,touched}') ~ '^\d+$' and (d.body#>>'{a,touched}')::numeric > nowms - 3 * 3600000),
        'w30', (select count(*) from wk where wk.user_id = u.id and day > t - 30), 'w7', (select count(*) from wk where wk.user_id = u.id and day > t - 7),
        'wAll', (select count(*) from wk where wk.user_id = u.id), 'last', (select max(day) from wk where wk.user_id = u.id),
        'th', (select body#>>'{profile,theme}' from jobdone_docs where user_id = u.id and path = 'jd/meta'),
        'push', exists (select 1 from jobdone_push_subs p where p.user_id = u.id),
        'fr', (select count(*) from jobdone_friends f where f.user_id = u.id),
        'gym', coalesce(c.at_gym is not null and c.at_since > now() - interval '4 hours', false)) x
      from auth.users u left join jobdone_cards c on c.user_id = u.id left join seen s on s.user_id = u.id) y),
    -- social
    'friendships', (select count(distinct (least(user_id, friend_id), greatest(user_id, friend_id))) from jobdone_friends),
    'requestsPending', (select count(*) from jobdone_friend_requests),
    'posts48', (select count(*) from jobdone_posts where created_at > now() - interval '48 hours'),
    'posts7', (select count(*) from jobdone_posts where created_at > now() - interval '7 days'),
    'comments7', (select count(*) from jobdone_comments where created_at > now() - interval '7 days'),
    'reacts', (select count(*) from jobdone_reacts),
    'nudges7', (select count(*) from jobdone_nudges where at > now() - interval '7 days'),
    'crews', (select count(*) from jobdone_crews),
    'gyms', (select count(*) from jobdone_gyms where not coalesce(hidden, false)),
    'gymMembers', (select count(distinct user_id) from jobdone_gym_members),
    -- notifications
    'pushPeople', (select count(distinct user_id) from jobdone_push_subs),
    'pushDevices', (select count(*) from jobdone_push_subs),
    'restSent24', (select count(*) from jobdone_rest_alerts where sent and due_at > now() - interval '24 hours'),
    'remindOn', (select count(*) from jobdone_docs where path = 'jd/meta' and coalesce(body#>>'{profile,remind,on}', '') = 'true'),
    -- moderation
    'feedback7', (select count(*) from jobdone_feedback where created_at > now() - interval '7 days'),
    'feedbackLast', (select coalesce(jsonb_agg(jsonb_build_object('at', created_at, 'b', left(body, 140)) order by created_at desc), '[]') from
        (select * from jobdone_feedback order by created_at desc limit 3) f),
    'reports', (select count(*) from jobdone_reports where not done),
    'suspended', (select count(*) from jobdone_suspensions where until > now()),
    'hiddenPosts', (select count(*) from jobdone_posts where hidden),
    -- health
    'errors24', (select count(*) from jobdone_errors where at > now() - interval '24 hours'),
    'errors7', (select count(*) from jobdone_errors where at > now() - interval '7 days'),
    'errorsLast', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'm', left(msg, 120), 'v', ver, 'src', left(src, 60)) order by at desc), '[]') from
        (select * from jobdone_errors order by at desc limit 5) e),
    'cron', (select coalesce(jsonb_agg(jsonb_build_object('n', j.jobname, 'sch', j.schedule, 'last', l.start_time, 'ok', l.status = 'succeeded',
        'fails24', (select count(*) from cron.job_run_details f where f.jobid = j.jobid and f.start_time > now() - interval '24 hours' and f.status <> 'succeeded'))
        order by j.jobname), '[]')
      from cron.job j left join lateral (select start_time, status from cron.job_run_details x where x.jobid = j.jobid order by start_time desc limit 1) l on true),
    'backupAt', (select max(taken_at) from jobdone_backups),
    'backupUsers', (select count(distinct user_id) from jobdone_backups where taken_at > (select max(taken_at) from jobdone_backups) - interval '1 hour'),
    'dbBytes', pg_database_size(current_database()),
    'tables', (select jsonb_agg(jsonb_build_object('n', replace(relname, 'jobdone_', ''), 'b', pg_total_relation_size(oid)) order by pg_total_relation_size(oid) desc)
      from (select oid, relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by pg_total_relation_size(oid) desc limit 6) x)
  ) into r;
  return r;
end $$;
revoke execute on function public.jobdone_admin_stats() from public, anon;
grant execute on function public.jobdone_admin_stats() to authenticated;
