-- v192 (Job, 14 Nov 2026): pushes go out the moment they're queued instead of waiting for the 5-second cron,
-- and the rest-timer check runs every second. jobdone_rest_tick() only calls the edge function when something is due,
-- and the function marks rows sent atomically, so an extra tick never sends twice.
create or replace function public.jobdone_queue_alert(p_to uuid, p_title text, p_body text)
returns void language plpgsql security definer set search_path to '' as $f$
begin
  insert into public.jobdone_rest_alerts as a (user_id, due_at, title, body, sent)
    values (p_to, now(), p_title, left(p_body, 140), false)
  on conflict (user_id) do update set due_at = excluded.due_at, title = excluded.title, body = excluded.body, sent = false
    where a.sent or a.due_at < now() - interval '2 minutes';
  perform public.jobdone_rest_tick();
end $f$;

create or replace function public.jobdone_turn_ping(p_to uuid)
returns boolean language plpgsql security definer set search_path to '' as $f$
declare me uuid := (select public.jobdone_gym_me()); nm text;
begin
  if me is null or p_to is null or p_to = me then return false; end if;
  if not exists (select 1 from public.jobdone_friends where user_id = me and friend_id = p_to) then return false; end if;
  if not exists (select 1 from public.jobdone_cards c where c.user_id = p_to
      and jsonb_typeof(c.stat -> 'lv' -> 'party') = 'array' and (c.stat -> 'lv' -> 'party') ? me::text
      and coalesce((c.stat -> 'lv' ->> 'at')::numeric, 0) > extract(epoch from now()) * 1000 - 45 * 60000) then return false; end if;
  if exists (select 1 from public.jobdone_rest_alerts a where a.user_id = p_to and a.title = 'Your turn' and a.due_at > now() - interval '15 seconds') then return false; end if;
  select left(split_part(coalesce(c.card ->> 'n', 'Your friend'), ' ', 1), 20) into nm from public.jobdone_cards c where c.user_id = me;
  insert into public.jobdone_rest_alerts (user_id, due_at, title, body, sent)
    values (p_to, now(), 'Your turn', coalesce(nm, 'Your friend') || ' finished their set. You’re up.', false)
    on conflict (user_id) do update set due_at = excluded.due_at, title = excluded.title, body = excluded.body, sent = false;
  perform public.jobdone_rest_tick();
  return true;
end $f$;

select cron.alter_job((select jobid from cron.job where jobname = 'jobdone-rest-push'), schedule := '1 seconds');
