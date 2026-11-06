-- Friends feed v2 (6 Nov 2026): emoji reactions and comments. Migration "friends_emoji_comments".
-- Reactions become one emoji per person per post from a fixed set. Comments are up to 200 characters, 40 a day per person,
-- only on posts you can see (your own or a friend's, last 24 hours). The writer or the post's owner can delete a comment.
-- Comments go when the post goes (48-hour tidy) or the account is deleted.
delete from public.jobdone_reacts;
alter table public.jobdone_reacts drop constraint if exists jobdone_reacts_r_check;
alter table public.jobdone_reacts add constraint jobdone_reacts_r_check check (r in ('🔥', '💪', '👏', '😂', '😮', '❤️'));

create table if not exists public.jobdone_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.jobdone_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now());
create index if not exists jobdone_comments_post on public.jobdone_comments (post_id, created_at);
create index if not exists jobdone_comments_user on public.jobdone_comments (user_id, created_at desc);
alter table public.jobdone_comments enable row level security;

create or replace function public.jobdone_can_see(p_id bigint) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jobdone_posts p where p.id = p_id and p.created_at > now() - interval '24 hours'
    and (p.user_id = auth.uid() or exists (select 1 from public.jobdone_friends f where f.user_id = auth.uid() and f.friend_id = p.user_id)));
$$;

create or replace function public.jobdone_react(p_id bigint, p_r text) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not public.jobdone_can_see(p_id) then return; end if;
  if p_r is null then delete from public.jobdone_reacts where post_id = p_id and user_id = me;
  else insert into public.jobdone_reacts (post_id, user_id, r) values (p_id, me, p_r) on conflict (post_id, user_id) do update set r = excluded.r; end if;
end $$;

create or replace function public.jobdone_comment(p_id bigint, p_body text) returns bigint language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b text := btrim(coalesce(p_body, '')); nid bigint;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if b = '' or char_length(b) > 200 then raise exception 'Comment must be 1 to 200 characters'; end if;
  if not public.jobdone_can_see(p_id) then raise exception 'Post not found'; end if;
  if (select count(*) from public.jobdone_comments where user_id = me and created_at > now() - interval '24 hours') >= 40 then raise exception 'Too many comments today' using errcode = '54000'; end if;
  insert into public.jobdone_comments (post_id, user_id, body) values (p_id, me, b) returning id into nid;
  return nid;
end $$;

create or replace function public.jobdone_comment_delete(p_cid bigint) returns void language sql security definer set search_path = '' as $$
  delete from public.jobdone_comments c where c.id = p_cid
    and (c.user_id = auth.uid() or exists (select 1 from public.jobdone_posts p where p.id = c.post_id and p.user_id = auth.uid()));
$$;

drop function if exists public.jobdone_feed();
create function public.jobdone_feed() returns table (id bigint, user_id uuid, n text, ph text, kind text, body jsonb, photo text, at timestamptz, reacts jsonb, mine text, who jsonb, comments jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, p.user_id, c.card->>'n', case when c.card->>'hidden' = 'true' then null else c.photo end, p.kind, p.body, p.photo, p.created_at,
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

revoke execute on function public.jobdone_can_see(bigint), public.jobdone_react(bigint, text), public.jobdone_comment(bigint, text), public.jobdone_comment_delete(bigint), public.jobdone_feed() from public, anon;
grant execute on function public.jobdone_react(bigint, text), public.jobdone_comment(bigint, text), public.jobdone_comment_delete(bigint), public.jobdone_feed() to authenticated;
