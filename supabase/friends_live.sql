-- Light version of jobdone_friends_list for the once-a-minute refresh (v180, Job 14 Nov):
-- the same rows without the card or photo (~60 KB each), so polling costs a few KB instead of every friend's picture.
-- The app still calls jobdone_friends_list on open and every 10 minutes for names and photos.
create or replace function public.jobdone_friends_live()
returns table(id uuid, at_gym text, at_since timestamptz, stat jsonb, nudged_me timestamptz)
language sql stable security definer set search_path to ''
as $$
  select c.user_id,
    case when c.at_since > now() - interval '3 hours' then c.at_gym end,
    case when c.at_since > now() - interval '3 hours' then c.at_since end,
    c.stat,
    (select max(n.at) from public.jobdone_nudges n where n.from_id = c.user_id and n.to_id = (select public.jobdone_gym_me()) and n.at > now() - interval '20 hours')
  from public.jobdone_friends f join public.jobdone_cards c on c.user_id = f.friend_id
  where f.user_id = (select public.jobdone_gym_me())
  limit 200;
$$;
revoke all on function public.jobdone_friends_live() from public, anon;
grant execute on function public.jobdone_friends_live() to authenticated;
