-- perf-07 (applied to the live database 7 Nov 2026, after v135 went live): the feed stops sending each author's ID photo again on every post (up to 88 KB per row).
-- The app already has those photos from jobdone_friends_list; perf-04 makes postHTML fall back to them.
-- Ship perf-04 (app) first, then run this. Same columns, so no drop is needed; ph is always null.
create or replace function public.jobdone_feed() returns table (id bigint, user_id uuid, n text, ph text, kind text, body jsonb, photo text, at timestamptz, reacts jsonb, mine text, who jsonb, comments jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, p.user_id, c.card->>'n', null::text, p.kind, p.body, p.photo, p.created_at,
    (select jsonb_object_agg(x.r, x.k) from (select r.r, count(*) k from public.jobdone_reacts r where r.post_id = p.id group by r.r) x),
    (select r.r from public.jobdone_reacts r where r.post_id = p.id and r.user_id = auth.uid()),
    case when p.user_id = auth.uid() then (select jsonb_agg(jsonb_build_array(c2.card->>'n', r.r)) from public.jobdone_reacts r left join public.jobdone_cards c2 on c2.user_id = r.user_id where r.post_id = p.id) end,
    (select jsonb_agg(jsonb_build_object('id', m.id, 'u', m.user_id, 'n', c3.card->>'n', 'b', m.body, 'at', m.created_at) order by m.created_at)
       from (select * from public.jobdone_comments m0 where m0.post_id = p.id order by m0.created_at desc limit 50) m left join public.jobdone_cards c3 on c3.user_id = m.user_id)
  from public.jobdone_posts p left join public.jobdone_cards c on c.user_id = p.user_id
  where p.created_at > now() - interval '24 hours'
    and (p.user_id = auth.uid() or exists (select 1 from public.jobdone_friends f where f.user_id = auth.uid() and f.friend_id = p.user_id))
  order by p.created_at desc limit 60;
$$;
