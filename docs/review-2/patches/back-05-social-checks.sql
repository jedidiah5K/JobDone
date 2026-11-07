-- back-05 (part a applied and validated 7 Nov 2026. Part b NOT applied: its jobdone_feed would undo perf-07, merge them first): server-side checks for friends data.
-- a) Post bodies and friend status are free-form jsonb today; the app trusts their shape when it renders.
--    NOT VALID: old rows are left alone, every new write is checked.
alter table public.jobdone_posts add constraint jobdone_posts_body_shape check (
  jsonb_typeof(body) = 'object'
  and (body->'pr' is null or jsonb_typeof(body->'pr') = 'number')
  and (body->'ex' is null or jsonb_typeof(body->'ex') = 'array')
) not valid;
alter table public.jobdone_cards add constraint jobdone_cards_stat_shape check (
  stat is null or (jsonb_typeof(stat) = 'object' and (stat->'tr' is null or jsonb_typeof(stat->'tr') = 'array'))
) not valid;

-- b) Two-step sign-in: the friends functions only check auth.uid(), so a password-only (aal1) session
--    of an account with two-step on can read friends' stories, post, comment and edit the ID card.
--    Same rule as the workout data: add the aal check. For the SQL-language readers, one extra condition:
create or replace function public.jobdone_feed() returns table (id bigint, user_id uuid, n text, ph text, kind text, body jsonb, photo text, at timestamptz, reacts jsonb, mine text, who jsonb, comments jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, p.user_id, c.card->>'n', case when c.card->>'hidden' = 'true' then null else c.photo end, p.kind, p.body, p.photo, p.created_at,
    (select jsonb_object_agg(x.r, x.k) from (select r.r, count(*) k from public.jobdone_reacts r where r.post_id = p.id group by r.r) x),
    (select r.r from public.jobdone_reacts r where r.post_id = p.id and r.user_id = auth.uid()),
    case when p.user_id = auth.uid() then (select jsonb_agg(jsonb_build_array(c2.card->>'n', r.r)) from public.jobdone_reacts r left join public.jobdone_cards c2 on c2.user_id = r.user_id where r.post_id = p.id) end,
    (select jsonb_agg(jsonb_build_object('id', m.id, 'u', m.user_id, 'n', c3.card->>'n', 'b', m.body, 'at', m.created_at) order by m.created_at)
       from (select * from public.jobdone_comments m0 where m0.post_id = p.id order by m0.created_at desc limit 50) m left join public.jobdone_cards c3 on c3.user_id = m.user_id)
  from public.jobdone_posts p left join public.jobdone_cards c on c.user_id = p.user_id
  where (select public.jobdone_aal_ok())
    and p.created_at > now() - interval '24 hours'
    and (p.user_id = auth.uid() or exists (select 1 from public.jobdone_friends f where f.user_id = auth.uid() and f.friend_id = p.user_id))
  order by p.created_at desc limit 60;
$$;

create or replace function public.jobdone_friends_list() returns table (id uuid, code text, card jsonb, photo text, since timestamptz, at_gym text, at_since timestamptz, stat jsonb, nudged_me timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.user_id, c.code, c.card, case when c.card->>'hidden' = 'true' then null else c.photo end, f.created_at,
    case when c.at_since > now() - interval '3 hours' then c.at_gym end, case when c.at_since > now() - interval '3 hours' then c.at_since end,
    c.stat, (select max(n.at) from public.jobdone_nudges n where n.from_id = c.user_id and n.to_id = auth.uid() and n.at > now() - interval '20 hours')
  from public.jobdone_friends f join public.jobdone_cards c on c.user_id = f.friend_id
  where (select public.jobdone_aal_ok()) and f.user_id = auth.uid()
  order by (c.at_since > now() - interval '3 hours') desc nulls last, f.created_at desc limit 200;
$$;
-- (Check the live jobdone_friends_list signature first; it must match exactly or create or replace fails.)

-- For every plpgsql writer (jobdone_card_get, card_save, card_photo, at_gym, stat, post, post_photo, comment,
-- react, nudge, friend_request, friend_answer) change the first line of the body from
--   declare me uuid := auth.uid();  ...  if me is null then raise exception 'Sign in first'; end if;
-- to
--   declare me uuid := public.jobdone_gym_me();   -- raises unless signed in AND two-step is satisfied
-- jobdone_gym_me already exists (gym.sql) and is callable from inside definer functions.
-- The SQL-language writers (post_delete, comment_delete, friend_remove) get "and (select public.jobdone_aal_ok())".
