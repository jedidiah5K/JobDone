-- v189 (Job, 14 Nov 2026): the daily reminder carries the user's gym bag list (profile.remind.bag, max 60 chars).
-- Same function as before; only the due row gains 'bag'. Pairs with rest-push/index.ts appending "Bag: …".
create or replace function public.jobdone_remind_tick()
 returns void language plpgsql security definer set search_path to 'public'
as $function$
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
      due := due || jsonb_build_object('u', r.user_id, 'theme', coalesce(r.p->>'theme', 'mono'), 'bag', left(coalesce(r.p->'remind'->>'bag', ''), 60));
    exception when others then null;
    end;
  end loop;
  if jsonb_array_length(due) > 0 then
    perform net.http_post(url := 'https://xvyibgnjibzopwtxajin.supabase.co/functions/v1/rest-push', body := jsonb_build_object('remind', due),
      headers := jsonb_build_object('Content-Type','application/json','x-cron-key',(select v from jobdone_private where k='cron_key')));
  end if;
end $function$;
