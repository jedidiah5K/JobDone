-- Run once in the Supabase SQL editor (project jobdone). Safe to run twice.
-- 1) New posts from older app versions get the author's current theme saved with them.
create or replace function public.jobdone_post(p_kind text, p_body jsonb, p_photo text) returns bigint language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); nid bigint; b jsonb := coalesce(p_body, '{}'::jsonb);
begin
  if me is null then raise exception 'Sign in first'; end if;
  if (select count(*) from public.jobdone_posts where user_id = me and created_at > now() - interval '24 hours') >= 12 then raise exception 'Too many posts today' using errcode = '54000'; end if;
  if not (b ? 'th') then b := b || jsonb_build_object('th', coalesce((select c.card->>'t' from public.jobdone_cards c where c.user_id = me), 'mono')); end if;
  insert into public.jobdone_posts (user_id, kind, body, photo) values (me, p_kind, b, p_photo) returning id into nid;
  return nid;
end $$;

-- 2) Job's two old stories were posted in Skyline (profile backups on 5 and 6 Nov say spidey).
update public.jobdone_posts set body = body || '{"th":"spidey"}'::jsonb
where not (body ? 'th') and user_id = (select id from auth.users where email = 'jobchua123@gmail.com');

-- 3) Any other old post keeps its author's current theme from now on.
update public.jobdone_posts p set body = p.body || jsonb_build_object('th', coalesce((select c.card->>'t' from public.jobdone_cards c where c.user_id = p.user_id), 'mono'))
where not (p.body ? 'th');
