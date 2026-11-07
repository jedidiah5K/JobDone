-- Unblock, the blocked list, and no comments from blocked people (7 Nov 2026). Applied to the live database 7 Nov 2026.
-- Safe to run twice. The feed is edited in place so perf-07 (no avatars) and the two-step check stay.
create or replace function public.jobdone_blocks_list() returns table (id uuid, n text, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.blocked_id, c.card->>'n', b.created_at from public.jobdone_blocks b left join public.jobdone_cards c on c.user_id = b.blocked_id
  where b.user_id = (select public.jobdone_gym_me()) order by b.created_at desc limit 500;
$$;
revoke execute on function public.jobdone_blocks_list() from public, anon;
grant execute on function public.jobdone_blocks_list() to authenticated;

create or replace function public.jobdone_unblock(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.jobdone_blocks where user_id = (select public.jobdone_gym_me()) and blocked_id = p_user;
$$;
revoke execute on function public.jobdone_unblock(uuid) from public, anon;
grant execute on function public.jobdone_unblock(uuid) to authenticated;

-- Comments from someone either of you blocked don't show on a mutual friend's post.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.jobdone_feed()'::regprocedure);
  if d like '%jobdone_blocked%' then return; end if;
  n := replace(d, 'where m0.post_id = p.id order by', 'where m0.post_id = p.id and not public.jobdone_blocked((select public.jobdone_gym_me()), m0.user_id) order by');
  if n = d then raise exception 'unexpected jobdone_feed body'; end if;
  execute n;
end $$;
