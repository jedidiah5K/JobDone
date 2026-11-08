-- Block (7 Nov 2026, expert review L3). Applied to the live database 7 Nov 2026. Safe to run twice.
-- Blocking someone ends the friendship both ways, cancels requests both ways, and stops new requests between the two
-- (the request quietly goes nowhere, so the blocked person isn't told). The app calls jobdone_block(p_user) from a
-- friend's post ⋯ menu and their ID card; until this runs, the app says "Couldn't block. Try again later."
--
-- The live jobdone_friend_request function isn't in the repo, so instead of rewriting it, a trigger on each table
-- refuses rows between blocked people. That covers every path (request, accept, both-ask) without touching the function.
--
-- Before running, check the request table's columns. This file assumes jobdone_friend_requests(from_id, to_id):
--   select column_name from information_schema.columns where table_schema = 'public' and table_name = 'jobdone_friend_requests';
-- If they're named differently, change from_id / to_id below. The first step stops with an error if they're missing,
-- and everything runs in one transaction, so nothing half-applies.
--
-- Not covered yet: comments a blocked person left on a mutual friend's post still show (that needs a jobdone_feed change),
-- and there's no unblock button. To undo a block by hand: delete from public.jobdone_blocks where user_id = '<id>' and blocked_id = '<id>';

begin;

do $$ begin
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'jobdone_friend_requests' and column_name in ('from_id', 'to_id')) <> 2
  then raise exception 'jobdone_friend_requests has no from_id/to_id columns: fix the names in block.sql first'; end if;
end $$;

create table if not exists public.jobdone_blocks (
  user_id uuid not null references auth.users on delete cascade,
  blocked_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);
alter table public.jobdone_blocks enable row level security; -- no policies: only the functions below touch it
revoke all on public.jobdone_blocks from anon, authenticated;
create index if not exists jobdone_blocks_blocked on public.jobdone_blocks (blocked_id);

-- True when either person has blocked the other. Internal only.
create or replace function public.jobdone_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jobdone_blocks x where (x.user_id = a and x.blocked_id = b) or (x.user_id = b and x.blocked_id = a));
$$;
revoke execute on function public.jobdone_blocked(uuid, uuid) from public, anon, authenticated;

create or replace function public.jobdone_block(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); -- raises unless signed in and two-step (if on) is done
begin
  if p_user is null or p_user = me then return; end if;
  if (select count(*) from public.jobdone_blocks where user_id = me) >= 500 then raise exception 'Too many blocks'; end if;
  insert into public.jobdone_blocks (user_id, blocked_id) values (me, p_user) on conflict do nothing;
  delete from public.jobdone_friends where (user_id = me and friend_id = p_user) or (user_id = p_user and friend_id = me);
  delete from public.jobdone_friend_requests where (from_id = me and to_id = p_user) or (from_id = p_user and to_id = me);
end $$;
revoke execute on function public.jobdone_block(uuid) from public, anon;
grant execute on function public.jobdone_block(uuid) to authenticated;

-- Refuse new friendships and requests between blocked people. Returning null skips the row without an error,
-- so jobdone_friend_request still answers as if it worked and the blocked person learns nothing.
create or replace function public.jobdone_block_guard_friends() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.jobdone_blocked(new.user_id, new.friend_id) then return null; end if;
  return new;
end $$;
create or replace function public.jobdone_block_guard_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.jobdone_blocked(new.from_id, new.to_id) then return null; end if;
  return new;
end $$;
revoke execute on function public.jobdone_block_guard_friends() from public, anon, authenticated;
revoke execute on function public.jobdone_block_guard_requests() from public, anon, authenticated;

drop trigger if exists jobdone_block_guard on public.jobdone_friends;
create trigger jobdone_block_guard before insert on public.jobdone_friends for each row execute function public.jobdone_block_guard_friends();
drop trigger if exists jobdone_block_guard on public.jobdone_friend_requests;
create trigger jobdone_block_guard before insert on public.jobdone_friend_requests for each row execute function public.jobdone_block_guard_requests();

commit;

-- Check after running:
--   select proname from pg_proc where proname in ('jobdone_block', 'jobdone_blocked');   -- 2 rows
--   select tgname, tgrelid::regclass from pg_trigger where tgname = 'jobdone_block_guard'; -- 2 rows
