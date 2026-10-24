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

-- Rest-done notifications (Oct 2026). Applied as migration "rest_push_alerts".
-- jobdone_private holds the VAPID key pair and the cron key; insert your own values (never commit them).
create extension if not exists pg_cron;
create table if not exists public.jobdone_push_subs (endpoint text primary key, user_id uuid not null references auth.users on delete cascade, p256dh text not null, auth text not null, created_at timestamptz default now());
create table if not exists public.jobdone_rest_alerts (user_id uuid primary key references auth.users on delete cascade, due_at timestamptz not null, title text not null default 'Rest done', body text not null default 'Time for your next set.', sent boolean not null default false);
create index if not exists jobdone_rest_alerts_due on public.jobdone_rest_alerts (due_at) where not sent;
create table if not exists public.jobdone_private (k text primary key, v text not null); -- rows: vapid_public, vapid_private, cron_key
alter table public.jobdone_push_subs enable row level security;
alter table public.jobdone_rest_alerts enable row level security;
alter table public.jobdone_private enable row level security;
revoke all on public.jobdone_private from anon, authenticated;
create or replace function public.jobdone_rest_tick() returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from jobdone_rest_alerts where not sent and due_at <= now() + interval '2 seconds') then
    perform net.http_post(url := 'https://<project-ref>.supabase.co/functions/v1/rest-push', body := '{"cron":true}'::jsonb,
      headers := jsonb_build_object('Content-Type','application/json','x-cron-key',(select v from jobdone_private where k='cron_key')));
  end if;
end $$;
revoke execute on function public.jobdone_rest_tick() from public, anon, authenticated;
select cron.schedule('jobdone-rest-push', '5 seconds', 'select public.jobdone_rest_tick()');

-- Daily workout reminders (Oct 2026). Applied as migration "daily_workout_reminders".
-- The app keeps profile.remind {on, at 'HH:MM', days [0-6, Sunday 0], tz} in jd/meta. Every minute this finds accounts whose
-- reminder time has just passed (up to 2 hours late) on a chosen day, with nothing logged that day, no workout open,
-- no rest week and no reminder sent yet today, and asks rest-push to send one.
create table if not exists public.jobdone_remind_sent (user_id uuid primary key references auth.users on delete cascade, day date not null);
alter table public.jobdone_remind_sent enable row level security;
create or replace function public.jobdone_remind_tick() returns void language plpgsql security definer set search_path = public as $$
declare r record; lt timestamp; due jsonb := '[]'::jsonb; at time;
begin
  for r in
    select m.user_id, m.body->'profile' as p from jobdone_docs m
    where m.path = 'jd/meta' and m.body->'profile'->'remind'->>'on' = 'true'
      and exists (select 1 from jobdone_push_subs s where s.user_id = m.user_id)
  loop
    begin
      if not exists (select 1 from pg_timezone_names where name = r.p->'remind'->>'tz') then continue; end if;
      if coalesce(r.p->'remind'->>'at', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then continue; end if;
      lt := now() at time zone (r.p->'remind'->>'tz'); at := (r.p->'remind'->>'at')::time;
      if lt < lt::date + at or lt > lt::date + at + interval '2 hours' then continue; end if;
      if jsonb_typeof(r.p->'remind'->'days') = 'array' and not (r.p->'remind'->'days' @> to_jsonb(extract(dow from lt)::int)) then continue; end if;
      if exists (select 1 from jobdone_remind_sent x where x.user_id = r.user_id and x.day = lt::date) then continue; end if;
      if jsonb_typeof(r.p->'restWeeks') = 'array' and r.p->'restWeeks' ? to_char(lt::date - (extract(isodow from lt)::int - 1), 'YYYY-MM-DD') then continue; end if;
      if exists (select 1 from jobdone_docs d, jsonb_each(case when jsonb_typeof(d.body->'w') = 'object' then d.body->'w' else '{}'::jsonb end) w
        where d.user_id = r.user_id and d.path = 'months/' || to_char(lt, 'YYYY-MM') and w.value->>'date' = to_char(lt, 'YYYY-MM-DD')) then continue; end if;
      if exists (select 1 from jobdone_docs d where d.user_id = r.user_id and d.path = 'jd/active' and jsonb_typeof(d.body->'a') = 'object' and d.updated_at > now() - interval '3 hours') then continue; end if;
      insert into jobdone_remind_sent (user_id, day) values (r.user_id, lt::date) on conflict (user_id) do update set day = excluded.day;
      due := due || jsonb_build_object('u', r.user_id, 'theme', coalesce(r.p->>'theme', 'mono'));
    exception when others then null; -- one account's odd data never stops the others
    end;
  end loop;
  if jsonb_array_length(due) > 0 then
    perform net.http_post(url := 'https://<project-ref>.supabase.co/functions/v1/rest-push', body := jsonb_build_object('remind', due),
      headers := jsonb_build_object('Content-Type','application/json','x-cron-key',(select v from jobdone_private where k='cron_key')));
  end if;
end $$;
revoke execute on function public.jobdone_remind_tick() from public, anon, authenticated;
select cron.schedule('jobdone-remind', '* * * * *', 'select public.jobdone_remind_tick()');
