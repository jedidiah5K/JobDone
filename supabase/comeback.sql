-- Comeback nudges (Job, 22 Nov 2026): a push on day 0, 1, 3, 7 and 14 after sign-up, around 6 pm local time.
-- Free alternative to follow-up emails. Each one is skipped if the person trained in the last 2 days (day 0: any workout),
-- if they turned nudges off (profile.noNudge), or if the phone has no push subscription. Sent once per step.
create table if not exists public.jobdone_comeback (user_id uuid primary key references auth.users on delete cascade, step int not null, at timestamptz not null default now());
alter table public.jobdone_comeback enable row level security; -- no policies: server only

create or replace function public.jobdone_comeback_tick()
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare r record; tz text; lt timestamp; d int; st int; msg text[]; trained boolean;
  steps int[] := array[0, 1, 3, 7, 14];
  titles text[] := array['Your plan is ready', 'Quick one today?', 'Your next workout is waiting', 'One week in', 'Still here when you’re ready'];
  bodies text[] := array['Your first workout is set up. Tap Start when you get to the gym.', 'Even three lifts count. Open the app and start your next one.', 'It’s been a few days. Your plan picks up where you left off.', 'Log one workout this week to get your streak going.', 'Your plan and your numbers are saved. Start again any day.'];
begin
  for r in
    select u.id as user_id, u.created_at, m.body->'profile' as p
    from auth.users u join jobdone_docs m on m.user_id = u.id and m.path = 'jd/meta'
    where u.created_at > now() - interval '16 days'
      and coalesce(m.body->'profile'->>'noNudge', 'false') <> 'true'
      and exists (select 1 from jobdone_push_subs s where s.user_id = u.id)
  loop
    begin
      tz := coalesce(nullif(r.p->'remind'->>'tz', ''), nullif(r.p->>'tz', ''), 'Asia/Manila');
      if not exists (select 1 from pg_timezone_names where name = tz) then tz := 'Asia/Manila'; end if;
      lt := now() at time zone tz;
      if extract(hour from lt) <> 18 then continue; end if;
      d := lt::date - (r.created_at at time zone tz)::date;
      st := array_position(steps, d); if st is null then continue; end if;
      if exists (select 1 from jobdone_comeback c where c.user_id = r.user_id and c.step >= d) then continue; end if;
      insert into jobdone_comeback (user_id, step) values (r.user_id, d) on conflict (user_id) do update set step = excluded.step, at = now();
      select exists (select 1 from jobdone_docs x, jsonb_each(case when jsonb_typeof(x.body->'w') = 'object' then x.body->'w' else '{}'::jsonb end) w
        where x.user_id = r.user_id and x.path like 'months/%'
          and (d = 0 or w.value->>'date' >= to_char(lt::date - 2, 'YYYY-MM-DD'))) into trained;
      if trained then continue; end if;
      if exists (select 1 from jobdone_docs x where x.user_id = r.user_id and x.path = 'jd/active' and jsonb_typeof(x.body->'a') = 'object' and x.updated_at > now() - interval '3 hours') then continue; end if;
      perform jobdone_push_now(r.user_id, titles[st], bodies[st]);
    exception when others then null;
    end;
  end loop;
end $function$;
revoke all on function public.jobdone_comeback_tick() from public, anon, authenticated;

select cron.unschedule('jobdone-comeback') where exists (select 1 from cron.job where jobname = 'jobdone-comeback');
select cron.schedule('jobdone-comeback', '2 * * * *', 'select public.jobdone_comeback_tick()');
