-- Friends today (6 Nov 2026): training status, Done Stamps, snaps, reactions and nudges. Migration "friends_today_posts".
-- stat (on jobdone_cards): what friends see on the Today board, sent by the app: {d, tr [splits], rest, wd, wg, k, nn}.
-- Posts (stamps and snaps) show to friends for 24 hours and are deleted after 48 (cron jobdone-posts-tidy).
-- Photos are small JPEG data URLs (under 120 KB). Nudges go out through the rest-alert push queue; one per friend per 20 hours,
-- 20 a day, and never to someone who turned nudges off (stat.nn). A queued rest alert is never overwritten.
alter table public.jobdone_cards add column if not exists stat jsonb check (stat is null or pg_column_size(stat) < 1024);

create or replace function public.jobdone_stat(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  perform public.jobdone_card_get();
  update public.jobdone_cards set stat = case when p is null or jsonb_typeof(p) <> 'object' then null else p end where user_id = me;
end $$;

create table if not exists public.jobdone_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('stamp', 'snap')),
  body jsonb not null default '{}'::jsonb check (pg_column_size(body) < 2048),
  photo text check (photo is null or (length(photo) < 120000 and photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')),
  created_at timestamptz not null default now());
create index if not exists jobdone_posts_user_at on public.jobdone_posts (user_id, created_at desc);
alter table public.jobdone_posts enable row level security;

create table if not exists public.jobdone_reacts (
  post_id bigint not null references public.jobdone_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  r text not null check (r in ('light', 'strong', 'respect')),
  primary key (post_id, user_id));
alter table public.jobdone_reacts enable row level security;

create table if not exists public.jobdone_nudges (
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now());
create index if not exists jobdone_nudges_to on public.jobdone_nudges (to_id, at desc);
create index if not exists jobdone_nudges_from on public.jobdone_nudges (from_id, at desc);
alter table public.jobdone_nudges enable row level security;

drop function if exists public.jobdone_friends_list();
create function public.jobdone_friends_list() returns table (id uuid, code text, card jsonb, photo text, since timestamptz, at_gym text, at_since timestamptz, stat jsonb, nudged_me timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.user_id, c.code, c.card, case when c.card->>'hidden' = 'true' then null else c.photo end, f.created_at,
    case when c.at_since > now() - interval '3 hours' then c.at_gym end, case when c.at_since > now() - interval '3 hours' then c.at_since end,
    c.stat, (select max(n.at) from public.jobdone_nudges n where n.from_id = c.user_id and n.to_id = auth.uid() and n.at > now() - interval '20 hours')
  from public.jobdone_friends f join public.jobdone_cards c on c.user_id = f.friend_id
  where f.user_id = auth.uid() order by (c.at_since > now() - interval '3 hours') desc nulls last, f.created_at desc limit 200;
$$;

create or replace function public.jobdone_post(p_kind text, p_body jsonb, p_photo text) returns bigint language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); nid bigint;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if (select count(*) from public.jobdone_posts where user_id = me and created_at > now() - interval '24 hours') >= 12 then raise exception 'Too many posts today' using errcode = '54000'; end if;
  insert into public.jobdone_posts (user_id, kind, body, photo) values (me, p_kind, coalesce(p_body, '{}'::jsonb), p_photo) returning id into nid;
  return nid;
end $$;

create or replace function public.jobdone_post_photo(p_id bigint, p_photo text) returns void language sql security definer set search_path = '' as $$
  update public.jobdone_posts set photo = p_photo where id = p_id and user_id = auth.uid();
$$;

create or replace function public.jobdone_post_delete(p_id bigint) returns void language sql security definer set search_path = '' as $$
  delete from public.jobdone_posts where id = p_id and user_id = auth.uid();
$$;

create or replace function public.jobdone_feed() returns table (id bigint, user_id uuid, n text, kind text, body jsonb, photo text, at timestamptz, reacts jsonb, mine text, who jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, p.user_id, c.card->>'n', p.kind, p.body, p.photo, p.created_at,
    (select jsonb_object_agg(x.r, x.k) from (select r.r, count(*) k from public.jobdone_reacts r where r.post_id = p.id group by r.r) x),
    (select r.r from public.jobdone_reacts r where r.post_id = p.id and r.user_id = auth.uid()),
    case when p.user_id = auth.uid() then (select jsonb_agg(jsonb_build_array(c2.card->>'n', r.r)) from public.jobdone_reacts r left join public.jobdone_cards c2 on c2.user_id = r.user_id where r.post_id = p.id) end
  from public.jobdone_posts p left join public.jobdone_cards c on c.user_id = p.user_id
  where p.created_at > now() - interval '24 hours'
    and (p.user_id = auth.uid() or exists (select 1 from public.jobdone_friends f where f.user_id = auth.uid() and f.friend_id = p.user_id))
  order by p.created_at desc limit 60;
$$;

create or replace function public.jobdone_react(p_id bigint, p_r text) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.jobdone_posts p where p.id = p_id and p.created_at > now() - interval '24 hours'
    and (p.user_id = me or exists (select 1 from public.jobdone_friends f where f.user_id = me and f.friend_id = p.user_id))) then return; end if;
  if p_r is null then delete from public.jobdone_reacts where post_id = p_id and user_id = me;
  else insert into public.jobdone_reacts (post_id, user_id, r) values (p_id, me, p_r) on conflict (post_id, user_id) do update set r = excluded.r; end if;
end $$;

create or replace function public.jobdone_nudge(p_friend uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); nm text; st jsonb;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.jobdone_friends where user_id = me and friend_id = p_friend) then return jsonb_build_object('none', true); end if;
  select stat into st from public.jobdone_cards where user_id = p_friend;
  if st->>'nn' = 'true' then return jsonb_build_object('off', true); end if;
  if exists (select 1 from public.jobdone_nudges where from_id = me and to_id = p_friend and at > now() - interval '20 hours') then return jsonb_build_object('done', true); end if;
  if (select count(*) from public.jobdone_nudges where from_id = me and at > now() - interval '24 hours') >= 20 then return jsonb_build_object('many', true); end if;
  insert into public.jobdone_nudges (from_id, to_id) values (me, p_friend);
  select left(coalesce(nullif(card->>'n', ''), 'A friend'), 40) into nm from public.jobdone_cards where user_id = me;
  nm := coalesce(nm, 'A friend');
  insert into public.jobdone_rest_alerts (user_id, due_at, title, body, sent) values (p_friend, now(), nm, 'Training today?', false)
    on conflict (user_id) do update set due_at = excluded.due_at, title = excluded.title, body = excluded.body, sent = false where public.jobdone_rest_alerts.sent;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.jobdone_stat(jsonb), public.jobdone_friends_list(), public.jobdone_post(text, jsonb, text), public.jobdone_post_photo(bigint, text), public.jobdone_post_delete(bigint), public.jobdone_feed(), public.jobdone_react(bigint, text), public.jobdone_nudge(uuid) from public, anon;
grant execute on function public.jobdone_stat(jsonb), public.jobdone_friends_list(), public.jobdone_post(text, jsonb, text), public.jobdone_post_photo(bigint, text), public.jobdone_post_delete(bigint), public.jobdone_feed(), public.jobdone_react(bigint, text), public.jobdone_nudge(uuid) to authenticated;

select cron.schedule('jobdone-posts-tidy', '10 * * * *', $$delete from public.jobdone_posts where created_at < now() - interval '48 hours'; delete from public.jobdone_nudges where at < now() - interval '3 days';$$);
