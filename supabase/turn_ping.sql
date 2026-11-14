-- "Your turn" push for taking turns in a party (v181, Job 14 Nov). Queues a push for a friend through the rest-alert queue
-- (jobdone-rest-push cron, every 5 s). Only works when that friend's own live party lists you and was active in the
-- last 45 minutes, and at most one turn alert per person every 15 seconds. One alert slot per person: it replaces a waiting
-- rest alert, which is what you want while taking turns.
create or replace function public.jobdone_turn_ping(p_to uuid)
returns boolean language plpgsql security definer set search_path to ''
as $$
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
  return true;
end $$;
revoke all on function public.jobdone_turn_ping(uuid) from public, anon;
grant execute on function public.jobdone_turn_ping(uuid) to authenticated;
