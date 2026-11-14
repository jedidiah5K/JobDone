-- Phone alerts for friend requests and party invites while the app is closed (v186, Job 14 Nov 2026).
-- Rides the rest-alert queue (jobdone-rest-push cron, every 5 s). That queue has one slot per person, so these
-- only use a free slot: they never replace a rest timer or a "Your turn" alert that hasn't gone out yet.
create or replace function public.jobdone_queue_alert(p_to uuid, p_title text, p_body text)
returns void language sql security definer set search_path to '' as $$
  insert into public.jobdone_rest_alerts as a (user_id, due_at, title, body, sent)
    values (p_to, now(), p_title, left(p_body, 140), false)
  on conflict (user_id) do update set due_at = excluded.due_at, title = excluded.title, body = excluded.body, sent = false
    where a.sent or a.due_at < now() - interval '2 minutes';
$$;
revoke all on function public.jobdone_queue_alert(uuid, text, text) from public, anon, authenticated;

create or replace function public.jobdone_first_name(u uuid) returns text
language sql stable security definer set search_path to '' as $$
  select coalesce((select nullif(left(split_part(trim(c.card ->> 'n'), ' ', 1), 20), '') from public.jobdone_cards c where c.user_id = u), 'Someone');
$$;
revoke all on function public.jobdone_first_name(uuid) from public, anon, authenticated;

-- New friend request
create or replace function public.jobdone_req_push() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  perform public.jobdone_queue_alert(new.to_id, 'Friend request', public.jobdone_first_name(new.from_id) || ' wants to add you on Job’s Done.');
  return null;
exception when others then return null; -- an alert must never block the request itself
end $$;
drop trigger if exists jobdone_req_push on public.jobdone_friend_requests;
create trigger jobdone_req_push after insert on public.jobdone_friend_requests for each row execute function public.jobdone_req_push();

-- Party invite: someone's live party (stat.lv.party) gains a friend. Only while the party is fresh (45 min, same as the app).
create or replace function public.jobdone_lv_fresh(st jsonb) returns boolean
language sql immutable set search_path to '' as $f$
  select jsonb_typeof(st -> 'lv' -> 'party') = 'array' and jsonb_array_length(st -> 'lv' -> 'party') > 0
    and coalesce(st -> 'lv' ->> 'at', '') ~ '^[0-9]+([.][0-9]+)?$'
$f$;
create or replace function public.jobdone_lv_fresh_now(st jsonb) returns boolean
language sql stable set search_path to '' as $f$
  select case when public.jobdone_lv_fresh(st) then (st -> 'lv' ->> 'at')::numeric > extract(epoch from now()) * 1000 - 45 * 60000 else false end -- case: cast only after the check
$f$;
create or replace function public.jobdone_party_push() returns trigger
language plpgsql security definer set search_path to '' as $f$
declare
  f text;
  nm text;
  was jsonb := '[]';
begin
  if not public.jobdone_lv_fresh_now(new.stat) then
    return null;
  end if;
  if jsonb_typeof(old.stat -> 'lv' -> 'party') = 'array' then
    was := old.stat -> 'lv' -> 'party';
  end if;
  for f in select x from jsonb_array_elements_text(new.stat -> 'lv' -> 'party') x where not was ? x loop
    if f ~ '^[0-9a-f-]{36}$'
       and exists (select 1 from public.jobdone_friends where user_id = new.user_id and friend_id = f::uuid)
       -- skip anyone already in a live party: a joiner listing the host, or someone with the app open anyway
       and not exists (select 1 from public.jobdone_cards c where c.user_id = f::uuid and public.jobdone_lv_fresh_now(c.stat)) then
      nm := coalesce(nm, public.jobdone_first_name(new.user_id));
      perform public.jobdone_queue_alert(f::uuid, 'Party invite', nm || ' wants you to train together. Open the app to join.');
    end if;
  end loop;
  return null;
exception when others then
  return null; -- an alert must never block saving the card
end
$f$;
drop trigger if exists jobdone_party_push on public.jobdone_cards;
create trigger jobdone_party_push after update of stat on public.jobdone_cards for each row
  when (new.stat -> 'lv' -> 'party' is distinct from old.stat -> 'lv' -> 'party') execute function public.jobdone_party_push();
