-- "At the gym" (5 Nov 2026): you choose to tell friends when a workout starts; it clears when you finish, or after 3 hours.
-- Migration "friends_at_gym". No general online status (Job, 5 Nov).
alter table public.jobdone_cards add column if not exists at_gym text check (at_gym is null or length(at_gym) <= 80);
alter table public.jobdone_cards add column if not exists at_since timestamptz;

create or replace function public.jobdone_at_gym(p_gym text) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  perform public.jobdone_card_get();
  update public.jobdone_cards set at_gym = case when p_gym is null then null else left(coalesce(nullif(trim(p_gym), ''), 'the gym'), 80) end,
    at_since = case when p_gym is null then null else now() end where user_id = me;
end $$;

drop function if exists public.jobdone_friends_list();
create function public.jobdone_friends_list() returns table (id uuid, code text, card jsonb, photo text, since timestamptz, at_gym text, at_since timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.user_id, c.code, c.card, case when c.card->>'hidden' = 'true' then null else c.photo end, f.created_at,
    case when c.at_since > now() - interval '3 hours' then c.at_gym end, case when c.at_since > now() - interval '3 hours' then c.at_since end
  from public.jobdone_friends f join public.jobdone_cards c on c.user_id = f.friend_id
  where f.user_id = auth.uid() order by (c.at_since > now() - interval '3 hours') desc nulls last, f.created_at desc limit 200;
$$;
revoke execute on function public.jobdone_at_gym(text), public.jobdone_friends_list() from public, anon;
grant execute on function public.jobdone_at_gym(text), public.jobdone_friends_list() to authenticated;
