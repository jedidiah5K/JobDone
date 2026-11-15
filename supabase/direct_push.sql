-- v195 (Job, 15 Nov): friend requests, party invites and turns go straight to the push sender. Before, they shared one
-- slot per person with the rest timer, so an invite to someone who was resting was dropped.
create or replace function public.jobdone_push_now(p_to uuid, p_title text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(url := 'https://xvyibgnjibzopwtxajin.supabase.co/functions/v1/rest-push',
    body := jsonb_build_object('now', jsonb_build_object('u', p_to::text, 'title', left(p_title, 60), 'body', left(p_body, 140))),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', (select v from public.jobdone_private where k = 'cron_key')));
  -- a sent row, so "Your turn" pings can still be rate-limited; never overwrites a rest timer that is waiting
  insert into public.jobdone_rest_alerts as a (user_id, due_at, title, body, sent) values (p_to, now(), left(p_title, 60), left(p_body, 140), true)
  on conflict (user_id) do update set due_at = excluded.due_at, title = excluded.title, body = excluded.body, sent = true where a.sent;
end $$;
revoke all on function public.jobdone_push_now(uuid, text, text) from public, anon, authenticated;

create or replace function public.jobdone_queue_alert(p_to uuid, p_title text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.jobdone_push_now(p_to, p_title, p_body);
end $$;

create or replace function public.jobdone_turn_ping(p_to uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select public.jobdone_gym_me()); nm text;
begin
  if me is null or p_to is null or p_to = me then return false; end if;
  if not exists (select 1 from public.jobdone_friends where user_id = me and friend_id = p_to) then return false; end if;
  if not exists (select 1 from public.jobdone_cards c where c.user_id = p_to
      and jsonb_typeof(c.stat -> 'lv' -> 'party') = 'array' and (c.stat -> 'lv' -> 'party') ? me::text
      and coalesce((c.stat -> 'lv' ->> 'at')::numeric, 0) > extract(epoch from now()) * 1000 - 45 * 60000) then return false; end if;
  if exists (select 1 from public.jobdone_rest_alerts a where a.user_id = p_to and a.title = 'Your turn' and a.due_at > now() - interval '15 seconds') then return false; end if;
  select left(split_part(coalesce(c.card ->> 'n', 'Your friend'), ' ', 1), 20) into nm from public.jobdone_cards c where c.user_id = me;
  delete from public.jobdone_rest_alerts where user_id = p_to and not sent; -- your turn now, so their rest alert is moot
  perform public.jobdone_push_now(p_to, 'Your turn', coalesce(nm, 'Your friend') || ' finished their set. You’re up.');
  return true;
end $$;
