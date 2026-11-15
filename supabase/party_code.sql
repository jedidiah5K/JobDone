-- Party code (v194, Job 15 Nov): 4 letters that work for 2 hours. Typing it makes the two of you friends
-- (the code is shared in person, so both agreed) and the app then joins the party.
create table if not exists public.jobdone_party_codes (
  code text primary key,
  host uuid not null references auth.users on delete cascade,
  at timestamptz not null default now()
);
alter table public.jobdone_party_codes enable row level security; -- no policies: only the functions below touch it

create or replace function public.jobdone_party_code_make() returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); c text; abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ';
begin
  if me is null then raise exception 'Sign in first'; end if;
  if public.jobdone_suspended(me) then raise exception 'Suspended' using errcode = '42501'; end if;
  delete from public.jobdone_party_codes where host = me or at < now() - interval '2 hours';
  loop
    c := (select string_agg(substr(abc, 1 + floor(random() * length(abc))::int, 1), '') from generate_series(1, 4));
    begin insert into public.jobdone_party_codes (code, host) values (c, me); exit; exception when unique_violation then end;
  end loop;
  return c;
end $$;

create or replace function public.jobdone_party_code_use(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); raw text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z]', '', 'g')); h uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if public.jobdone_suspended(me) then raise exception 'Suspended' using errcode = '42501'; end if;
  if (select count(*) from public.jobdone_friend_tries where user_id = me and at > now() - interval '1 hour') >= 10 then raise exception 'Too many tries. Wait an hour.' using errcode = '54000'; end if;
  insert into public.jobdone_friend_tries (user_id) values (me);
  select host into h from public.jobdone_party_codes where code = raw and at > now() - interval '2 hours';
  if h is null then return jsonb_build_object('none', true); end if;
  if h = me then return jsonb_build_object('self', true); end if;
  if exists (select 1 from public.jobdone_blocks where (user_id = h and blocked_id = me) or (user_id = me and blocked_id = h)) then return jsonb_build_object('none', true); end if;
  if not exists (select 1 from public.jobdone_friends where user_id = me and friend_id = h) then
    if (select count(*) from public.jobdone_friends where user_id = me) >= 200 or (select count(*) from public.jobdone_friends where user_id = h) >= 200 then return jsonb_build_object('full', true); end if;
    insert into public.jobdone_friends (user_id, friend_id) values (me, h), (h, me) on conflict do nothing;
    delete from public.jobdone_friend_requests where (from_id = me and to_id = h) or (from_id = h and to_id = me);
  end if;
  return jsonb_build_object('host', h, 'n', (select card->>'n' from public.jobdone_cards where user_id = h));
end $$;

revoke all on function public.jobdone_party_code_make() from public, anon;
revoke all on function public.jobdone_party_code_use(text) from public, anon;
grant execute on function public.jobdone_party_code_make() to authenticated;
grant execute on function public.jobdone_party_code_use(text) to authenticated;
