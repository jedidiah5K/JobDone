-- Reactions and comments on your own posts, for the bell (v186, Job 14 Nov 2026). Small rows, no photos.
-- Posts are tidied after 48 hours, so this never grows past two days of activity. Blocked people are left out.
create or replace function public.jobdone_activity()
returns table(k text, kind text, n text, r text, body text, at timestamptz)
language sql stable security definer set search_path to '' as $$
  with me as (select public.jobdone_gym_me() as id),
  mine as (select p.id, p.created_at from public.jobdone_posts p, me where p.user_id = me.id and not coalesce(p.hidden, false)
    and p.created_at > now() - interval '48 hours')
  select 'x' || x.post_id || ':' || x.user_id, 'react', public.jobdone_first_name(x.user_id), x.r, null, m.created_at
    from public.jobdone_reacts x join mine m on m.id = x.post_id, me
    where x.user_id <> me.id
      and not exists (select 1 from public.jobdone_blocks b where (b.user_id = me.id and b.blocked_id = x.user_id) or (b.user_id = x.user_id and b.blocked_id = me.id))
  union all
  select 'c' || c.id, 'comment', public.jobdone_first_name(c.user_id), null, left(c.body, 80), c.created_at
    from public.jobdone_comments c join mine m on m.id = c.post_id, me
    where c.user_id <> me.id and not coalesce(c.hidden, false)
      and not exists (select 1 from public.jobdone_blocks b where (b.user_id = me.id and b.blocked_id = c.user_id) or (b.user_id = c.user_id and b.blocked_id = me.id))
  order by 6 desc
  limit 40;
$$;
revoke all on function public.jobdone_activity() from public, anon;
grant execute on function public.jobdone_activity() to authenticated;
